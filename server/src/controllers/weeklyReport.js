import prisma from '../prisma.js'
import { STUDIO_DIHITUNG, LAPORAN_DIHITUNG } from '../utils/kolaborasi.js'
// Tulis laporan per unit (21 Okt 2026): pelapor harus Koordinator/Pendamping UNIT ITU ke atas, bukan pelapor di unit lain.
import { parsePagination, kelolaStudio as canManageStudio } from '../utils/roles.js'
import { getStartOfWeekWIB, getMonthAttributionRange, getReportingPeriod, isReportInMonth } from '../utils/week.js'
import { getCpmMapForStudios } from '../utils/cpm.js'
import { getKasMapForStudios, getStudioKas } from '../utils/kas.js'
import { totalPengeluaranPeriode } from '../utils/pengeluaran.js'
import { laporLewatAnak } from '../utils/korporasi.js'
import { lingkupKeuangan, filterStudioId, samarkan, FIELD_UANG_LAPORAN } from '../utils/lingkup.js'


export const getAll = async (req, res) => {
  try {
    const { studioId } = req.query
    const { page, limit, skip } = parsePagination(req.query, 20)

    // studioId boleh satu id atau beberapa dipisah koma (dipakai client buat scope riwayat ke
    // studio yang dikoordinasi user, bukan cuma studio tunggal) -- backward-compatible, single id
    // tetap jalan seperti biasa.
    const lingkup = await lingkupKeuangan(req.userRoles)
    const studioIds = studioId ? studioId.split(',').filter(Boolean) : null
    const where = studioIds ? { studioId: { in: studioIds } } : {}

    const [reports, total] = await Promise.all([
      prisma.weeklyReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          studio: { select: { id: true, nama: true, circleId: true } },
        },
      }),
      prisma.weeklyReport.count({ where }),
    ])

    // Semua laporan tetap tampil; angka uang unit di luar wilayah disamarkan (null).
    return res.json({
      success: true,
      data: reports.map(r => (lingkup.boleh(r.studioId) ? r : samarkan(r, FIELD_UANG_LAPORAN))),
      pagination: { page, limit, total },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getStatusThisWeek = async (req, res) => {
  try {
    const lingkup2 = await lingkupKeuangan(req.userRoles)
    const rawInput = req.query.weekStart
      ? new Date(req.query.weekStart)
      : getStartOfWeekWIB()
    // Periode yang ditampilkan/dicocokkan ke laporan dipotong di batas bulan (getReportingPeriod)
    // -- laporan baru (mulai Juli 2026) periodeAwal-nya udah pasti gak nyebrang bulan, jadi
    // window query-nya juga harus ngikut, bukan selalu +7 hari mentah dari input.
    const { periodeAwal: startOfWeek, periodeAkhir } = getReportingPeriod(rawInput)
    const endOfWeek = new Date(periodeAkhir.getTime() + 24 * 60 * 60 * 1000)
    // Ranking "juara" pakai total omset SEBULAN BERJALAN (bulan yang ditempati minggu yang
    // lagi dilihat), bukan cuma omset minggu itu sendiri -- baris tabelnya tetap nampilin
    // status/omset per-minggu, cuma urutannya yang ngikutin performa bulanan. Bulan "yang
    // ditempati" ditentukan dari MINGGU ALAMI (belum dipotong) lewat hari ke-4 (Kamis)-nya --
    // lihat getMonthAttributionRange -- biar tetap benar buat data lama yang periodenya masih
    // nyebrang bulan (bukan startOfWeek di atas yang udah dipotong).
    const naturalWeekStart = getStartOfWeekWIB(rawInput)
    const attribusiDate = new Date(naturalWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000)
    const attribusiBulan = attribusiDate.getUTCMonth() + 1
    const attribusiTahun = attribusiDate.getUTCFullYear()
    const { rangeStart: monthStart, rangeEnd: monthEnd } = getMonthAttributionRange(attribusiBulan, attribusiTahun)
    // groupBy diganti findMany+reduce manual -- groupBy agregasi di level SQL pakai rentang
    // monthStart/monthEnd yang sekarang cuma batas AMAN (over-inclusive), butuh baris mentah
    // (periodeAwal/periodeAkhir) buat difilter presisi lewat isReportInMonth() dulu sebelum
    // dijumlah, gak bisa lagi diserahkan ke SQL langsung.
    const monthReports = await prisma.weeklyReport.findMany({
      select: { studioId: true, totalUsd: true, periodeAwal: true, periodeAkhir: true },
      where: { periodeAwal: { gte: monthStart, lte: monthEnd } },
    })
    const monthTotalMap = {}
    for (const r of monthReports.filter(r => isReportInMonth(r, attribusiBulan, attribusiTahun))) {
      monthTotalMap[r.studioId] = (monthTotalMap[r.studioId] ?? 0) + r.totalUsd
    }

    const studios = await prisma.studio.findMany({
      where: { statusAktif: true },
      select: {
        id: true,
        nama: true,
        tipe: true,
        indukId: true,
        circleId: true,
        rumahUsahaId: true,
        // Penanda studio kolaborasi: tetap muncul di status mingguan (kepatuhan), tapi klien tidak
        // menjumlahkannya ke total ekosistem.
        hitungDiEkosistem: true,
        mitraKolaborasi: true,
        circle: { select: { nama: true, colorHex: true } },
        rumahUsaha: { select: { nama: true, colorHex: true } },
        weeklyReports: {
          where: { periodeAwal: { gte: startOfWeek, lt: endOfWeek } },
          select: { id: true, totalUsd: true, kasSekarang: true, pengeluaran: true, createdAt: true, omsetFiverr: true, omsetEtsy: true, omsetUpwork: true, omsetVgen: true, omsetKomunitas: true, omsetLainnya: true, kurs: true, kendala: true, skorSemangat: true, periodeAwal: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
    })

    // kasLive = SUM(saldo) Rekening Bank (Bio Studio) saat ini -- sumber kebenaran "Kas Sekarang"
    // di tab Kas Studio sekarang (bukan lagi kasSekarang laporan mingguan terakhir yang manual,
    // atau kas dari laporan sebelumnya buat yang belum lapor). Diputuskan 31 Juli 2026.
    const kasMap = await getKasMapForStudios(studios.map(s => s.id))

    const data = laporLewatAnak(studios.map(s => ({
      ...s,
      sudahLapor: s.weeklyReports.length > 0,
      laporanTerakhir: s.weeklyReports[0] ?? null,
      kasLive: kasMap[s.id] ?? 0,
      omsetBulanIni: monthTotalMap[s.id] ?? 0,
    })))

    // Studio yang sudah lapor MINGGU INI diurutkan dari juara omset BULAN BERJALAN (bukan cuma
    // minggu itu) ke yang terendah, kayak ranking di Dashboard -- yang belum lapor minggu ini
    // tetap di bawah, urut circle/abjad seperti semula (Prisma orderBy di atas).
    data.sort((a, b) => {
      if (a.sudahLapor && !b.sudahLapor) return -1
      if (!a.sudahLapor && b.sudahLapor) return 1
      if (a.sudahLapor && b.sudahLapor) {
        return b.omsetBulanIni - a.omsetBulanIni
      }
      return 0
    })

    // Urutan juara sudah ditetapkan dari angka asli di atas; sekarang samarkan uang unit di luar wilayah.
    const tampil = data.map(d => {
      if (lingkup2.boleh(d.id)) return d
      return {
        ...d,
        weeklyReports: d.weeklyReports.map(w => samarkan(w, FIELD_UANG_LAPORAN)),
        laporanTerakhir: samarkan(d.laporanTerakhir, FIELD_UANG_LAPORAN),
        kasLive: null,
        omsetBulanIni: null,
      }
    })
    return res.json({ success: true, data: tampil })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const {
      studioId, periodeAwal, periodeAkhir,
      omsetFiverr = 0, omsetEtsy = 0, omsetUpwork = 0,
      omsetVgen = 0, omsetKomunitas = 0, omsetLainnya = 0,
      kurs,
      kendala, skorSemangat,
    } = req.body
    // pengeluaran & kasSekarang sengaja gak diterima -- dihitung server: total item Pengeluaran
    // di periode ini (utils/pengeluaran.js) dan snapshot saldo Rekening Bank (utils/kas.js).

    if (!studioId || !periodeAwal) {
      return res.status(422).json({ success: false, message: 'studioId dan periodeAwal wajib diisi' })
    }
    if (isNaN(new Date(periodeAwal).getTime())) {
      return res.status(422).json({ success: false, message: 'periodeAwal tidak valid' })
    }
    const angkaNegatif = [omsetFiverr, omsetEtsy, omsetUpwork, omsetVgen, omsetKomunitas, omsetLainnya]
      .some(v => isNaN(Number(v)) || Number(v) < 0)
    if (angkaNegatif) {
      return res.status(422).json({ success: false, message: 'Omset tidak boleh negatif' })
    }
    // Sebelumnya create gak ngecek cakupan studio (update/remove sudah) -- koordinator studio A
    // bisa bikin laporan atas nama studio B.
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa membuat laporan untuk studio sendiri' })
    }

    // periodeAwal/periodeAkhir SELALU di-derive server-side dari tanggal yang dipilih user
    // (bukan percaya periodeAkhir kiriman client) -- lewat getReportingPeriod, minggu dipotong
    // di batas bulan (gak pernah nyebrang bulan buat laporan baru mulai Juli 2026).
    const { periodeAwal: periodeAwalReal, periodeAkhir: periodeAkhirReal } = getReportingPeriod(new Date(periodeAwal))

    const existing = await prisma.weeklyReport.findFirst({
      where: { studioId, periodeAwal: periodeAwalReal },
    })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Laporan untuk studio dan minggu ini sudah ada. Gunakan tombol Edit jika ingin mengubah.' })
    }

    const _fiverr    = Number(omsetFiverr)    || 0
    const _etsy      = Number(omsetEtsy)      || 0
    const _upwork    = Number(omsetUpwork)    || 0
    const _vgen      = Number(omsetVgen)      || 0
    const _komunitas = Number(omsetKomunitas) || 0
    const _lainnya   = Number(omsetLainnya)   || 0
    const totalUsd   = _fiverr + _etsy + _upwork + _vgen + _komunitas + _lainnya

    // Kalau caller gak kirim kurs sama sekali, pakai kurs yang terakhir kali diinput (laporan
    // mana pun) -- bukan angka statis basi. Fallback 17000 kalau belum pernah ada laporan sama
    // sekali. Dashboard web sendiri udah selalu kirim kurs (default form-nya juga kurs terakhir),
    // ini jaring pengaman buat caller lain (mis. request langsung ke API).
    let kursReal = Number(kurs)
    if (kurs == null || isNaN(kursReal)) {
      const lastReport = await prisma.weeklyReport.findFirst({ orderBy: { createdAt: 'desc' }, select: { kurs: true } })
      kursReal = lastReport?.kurs ?? 17000
    }

    const report = await prisma.weeklyReport.create({
      data: {
        studioId,
        userId: req.user.id,
        periodeAwal:    periodeAwalReal,
        periodeAkhir:   periodeAkhirReal,
        omsetFiverr:    _fiverr,
        omsetEtsy:      _etsy,
        omsetUpwork:    _upwork,
        omsetVgen:      _vgen,
        omsetKomunitas: _komunitas,
        omsetLainnya:   _lainnya,
        totalUsd,
        kurs:           kursReal,
        // Snapshot otomatis saldo Rekening Bank saat laporan dikirim -- gak diterima dari client
        // lagi (13 Okt 2026), lihat snapshotKasMingguIni di utils/kas.js.
        kasSekarang:    await getStudioKas(studioId),
        pengeluaran:    await totalPengeluaranPeriode(studioId, periodeAwalReal, periodeAkhirReal),
        kendala,
        skorSemangat:   skorSemangat ? Number(skorSemangat) : null,
      },
      include: { studio: { select: { nama: true } } },
    })

    return res.status(201).json({ success: true, data: report, message: 'Laporan mingguan berhasil disimpan' })
  } catch (err) {
    // P2002 = unique constraint (studioId+periodeAwal) — jaring pengaman kedua kalau 2 request
    // nyaris bersamaan sama-sama lolos cek findFirst di atas sebelum salah satunya commit duluan.
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Laporan untuk studio dan minggu ini sudah ada. Gunakan tombol Edit jika ingin mengubah.' })
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const update = async (req, res) => {
  try {
    const { id } = req.params
    const {
      omsetFiverr, omsetEtsy, omsetUpwork, omsetVgen, omsetKomunitas, omsetLainnya,
      kurs, kendala, skorSemangat, periodeAwal,
    } = req.body
    // kasSekarang & pengeluaran sengaja gak diterima -- dihitung server (utils/kas.js,
    // utils/pengeluaran.js). Pengeluaran diubah lewat item di /api/pengeluaran.

    const existing = await prisma.weeklyReport.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' })

    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa edit laporan studio sendiri' })
    }
    const angkaNegatif = [omsetFiverr, omsetEtsy, omsetUpwork, omsetVgen, omsetKomunitas, omsetLainnya]
      .some(v => v != null && (isNaN(Number(v)) || Number(v) < 0))
    if (angkaNegatif) {
      return res.status(422).json({ success: false, message: 'Omset tidak boleh negatif' })
    }

    // Periode (minggu) laporan ini boleh dikoreksi kalau salah input -- dihitung ulang lewat
    // getReportingPeriod (dipotong di batas bulan), BUKAN selalu +6 hari mentah -- sebelumnya di
    // sini hard-code Senin+6=Minggu, yang diam-diam nimpa balik minggu pendek (stub akhir/awal
    // bulan) jadi minggu penuh kalau periodenya diedit.
    let periodeUpdate = {}
    if (periodeAwal != null) {
      const d = new Date(periodeAwal)
      if (isNaN(d.getTime())) {
        return res.status(422).json({ success: false, message: 'Periode tidak valid' })
      }
      periodeUpdate = getReportingPeriod(d)
      // Periode dikoreksi -> total pengeluaran ikut periode baru, KALAU di sana sudah ada item.
      // Laporan lama tanpa rincian item dibiarkan angkanya (jangan sampai jadi 0 diam-diam).
      const adaItem = await prisma.pengeluaran.count({
        where: { studioId: existing.studioId, tanggal: { gte: periodeUpdate.periodeAwal, lte: periodeUpdate.periodeAkhir } },
      })
      if (adaItem > 0) {
        periodeUpdate.pengeluaran = await totalPengeluaranPeriode(existing.studioId, periodeUpdate.periodeAwal, periodeUpdate.periodeAkhir)
      }
    }

    const merged = {
      omsetFiverr:    omsetFiverr    != null ? Number(omsetFiverr)    : existing.omsetFiverr,
      omsetEtsy:      omsetEtsy      != null ? Number(omsetEtsy)      : existing.omsetEtsy,
      omsetUpwork:    omsetUpwork    != null ? Number(omsetUpwork)    : existing.omsetUpwork,
      omsetVgen:      omsetVgen      != null ? Number(omsetVgen)      : existing.omsetVgen,
      omsetKomunitas: omsetKomunitas != null ? Number(omsetKomunitas) : existing.omsetKomunitas,
      omsetLainnya:   omsetLainnya   != null ? Number(omsetLainnya)   : existing.omsetLainnya,
    }
    const totalUsd = Object.values(merged).reduce((a, v) => a + v, 0)

    const report = await prisma.weeklyReport.update({
      where: { id },
      data: {
        ...(omsetFiverr    != null && { omsetFiverr:    Number(omsetFiverr)    }),
        ...(omsetEtsy      != null && { omsetEtsy:      Number(omsetEtsy)      }),
        ...(omsetUpwork    != null && { omsetUpwork:    Number(omsetUpwork)    }),
        ...(omsetVgen      != null && { omsetVgen:      Number(omsetVgen)      }),
        ...(omsetKomunitas != null && { omsetKomunitas: Number(omsetKomunitas) }),
        ...(omsetLainnya   != null && { omsetLainnya:   Number(omsetLainnya)   }),
        totalUsd,
        ...(kurs        != null && { kurs:        Number(kurs)        }),
        ...(kendala     !== undefined && { kendala }),
        ...(skorSemangat != null && { skorSemangat: Number(skorSemangat) }),
        ...periodeUpdate,
      },
      include: { studio: { select: { nama: true } } },
    })

    return res.json({ success: true, data: report, message: 'Laporan berhasil diperbarui' })
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Studio ini sudah punya laporan di minggu itu — pilih minggu lain' })
    }
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getMonthlyReport = async (req, res) => {
  try {
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear()

    const { rangeStart, rangeEnd } = getMonthAttributionRange(bulan, tahun)
    const lingkup = await lingkupKeuangan(req.userRoles)

    // Studio aktif DALAM WILAYAH peran (Advisor/Kepala Ekosistem = semua).
    // Studio kolaborasi (angkanya dihitung di circle mitra) TIDAK masuk Rekap Bulanan maupun totalnya.
    const studios = await prisma.studio.findMany({
      where: { statusAktif: true, ...STUDIO_DIHITUNG },
      select: {
        id: true, nama: true, tipe: true, indukId: true,
        circle:     { select: { id: true, nama: true, colorHex: true } },
        rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
      },
      orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
    })
    const cpmMap = await getCpmMapForStudios(studios.map(s => s.id))
    const kasMap = await getKasMapForStudios(studios.map(s => s.id))

    // Semua laporan bulan ini -- minggu/stub yang nyebrang atau deket batas bulan diatribusikan
    // ke bulan dengan hari terbanyak (lihat getMonthAttributionRange + isReportInMonth), bukan ke
    // bulan periodeAwal-nya doang. rangeStart/rangeEnd cuma batas fetch AMAN (over-inclusive),
    // filter presisi ada di isReportInMonth() -- WAJIB, bukan opsional (baris di luar rentang
    // presisinya tetap ke-fetch di sini kalau gak difilter).
    const reports = (await prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: rangeStart, lte: rangeEnd }, ...LAPORAN_DIHITUNG },
      orderBy: { periodeAwal: 'asc' },
    })).filter(r => isReportInMonth(r, bulan, tahun))

    // Agregasi per studio
    const reportsByStudio = {}
    for (const r of reports) {
      if (!reportsByStudio[r.studioId]) reportsByStudio[r.studioId] = []
      reportsByStudio[r.studioId].push(r)
    }

    const studioSummaries = studios.map(s => {
      const reps = reportsByStudio[s.id] ?? []
      const totalUsd       = reps.reduce((a, r) => a + r.totalUsd, 0)
      const totalPengeluaran = reps.reduce((a, r) => a + r.pengeluaran, 0)
      // Kas sekarang live dari SUM(saldo) Rekening Bank (Bio Studio) -- bukan lagi kasSekarang
      // laporan mingguan terakhir (manual, bisa basi). Diputuskan 31 Juli 2026, lihat utils/kas.js.
      const kasAkhir       = kasMap[s.id] ?? 0
      // Rupiah = tiap laporan x kursnya sendiri, lalu dijumlah (bukan total USD x rata-rata kurs, yang meleset
      // kalau kurs berbeda antarlaporan). avgKurs = kurs efektif (totalIdr/totalUsd) agar pemakai lama
      // `totalUsd * avgKurs` ikut tepat.
      const totalIdr       = reps.reduce((a, r) => a + r.totalUsd * r.kurs, 0)
      const avgKurs        = totalUsd > 0 ? totalIdr / totalUsd : (reps.length > 0 ? reps.reduce((a, r) => a + r.kurs, 0) / reps.length : 17000)
      const semangat       = reps.filter(r => r.skorSemangat).map(r => r.skorSemangat)
      const avgSemangat    = semangat.length ? (semangat.reduce((a, v) => a + v, 0) / semangat.length).toFixed(1) : null

      const platformTotals = {
        omsetFiverr:    reps.reduce((a, r) => a + r.omsetFiverr, 0),
        omsetEtsy:      reps.reduce((a, r) => a + r.omsetEtsy, 0),
        omsetUpwork:    reps.reduce((a, r) => a + r.omsetUpwork, 0),
        omsetVgen:      reps.reduce((a, r) => a + r.omsetVgen, 0),
        omsetKomunitas: reps.reduce((a, r) => a + r.omsetKomunitas, 0),
        omsetLainnya:   reps.reduce((a, r) => a + r.omsetLainnya, 0),
      }

      // id/studioId/kurs/omset* ditambahin biar baris "Minggu N" di Rekap Bulanan bisa langsung
      // buka EditModal yang sama kayak tab Riwayat Laporan (sebelumnya cuma field buat DITAMPILIN,
      // gak cukup buat NGEDIT -- user harus balik ke tab Riwayat Laporan buat cari & edit minggu
      // yang sama, padahal sering ke-notice salah input pas lihat rekap bulanan).
      const mingguLaporan = reps.map(r => ({
        id:           r.id,
        studioId:     r.studioId,
        periodeAwal:  r.periodeAwal,
        periodeAkhir: r.periodeAkhir,
        totalUsd:     r.totalUsd,
        kasSekarang:  r.kasSekarang,
        pengeluaran:  r.pengeluaran,
        skorSemangat: r.skorSemangat,
        kendala:      r.kendala,
        kurs:         r.kurs,
        omsetFiverr:    r.omsetFiverr,
        omsetEtsy:      r.omsetEtsy,
        omsetUpwork:    r.omsetUpwork,
        omsetVgen:      r.omsetVgen,
        omsetKomunitas: r.omsetKomunitas,
        omsetLainnya:   r.omsetLainnya,
      }))

      return {
        ...s,
        jumlahLaporan:  reps.length,
        sudahLapor:     reps.length > 0,
        totalUsd,
        totalIdr,
        totalPengeluaran,
        kasAkhir,
        avgKurs,
        avgSemangat,
        platformTotals,
        mingguLaporan,
        // CPM sekarang dihitung otomatis (THP + pengeluaran rutin + SHU, Rupiah-native) --
        // lihat utils/cpm.js. Bukan lagi Studio.cpmTarget (USD, dihapus 26 Juli 2026).
        cpmRp: cpmMap[s.id]?.totalCpm ?? 0,
      }
    })

    laporLewatAnak(studioSummaries)

    // Ringkasan keseluruhan
    const totalStudio      = studioSummaries.length
    const sudahLapor       = studioSummaries.filter(s => s.sudahLapor).length
    const belumLapor       = totalStudio - sudahLapor
    // Total uang hanya menjumlah unit dalam wilayah peran; hitungan unit/laporan tetap seluruhnya.
    const dalam = studioSummaries.filter(s => lingkup.boleh(s.id))
    const grandTotalUsd    = dalam.reduce((a, s) => a + s.totalUsd, 0)
    const grandTotalIdr    = dalam.reduce((a, s) => a + s.totalIdr, 0)
    const grandTotalPengeluaran = dalam.reduce((a, s) => a + s.totalPengeluaran, 0)
    const grandTotalKas    = dalam.reduce((a, s) => a + (s.kasAkhir ?? 0), 0)

    // Samarkan uang unit di luar wilayah SETELAH semua total dihitung dari angka asli.
    // `peringkat` = urutan omset sebenarnya (1 = tertinggi) -- bilangan urut, bukan uang, jadi aman dikirim untuk semua unit.
    const urutan = [...studioSummaries].sort((a, b) => b.totalUsd - a.totalUsd)
    const peringkatDari = Object.fromEntries(urutan.map((s, i) => [s.id, i + 1]))
    const studiosTampil = studioSummaries.map(s0 => { const s = { ...s0, peringkat: peringkatDari[s0.id] }; return (lingkup.boleh(s.id) ? s : {
      ...samarkan(s, ['totalUsd', 'totalIdr', 'totalPengeluaran', 'kasAkhir', 'avgKurs', 'cpmRp']),
      platformTotals: samarkan(s.platformTotals, Object.keys(s.platformTotals)),
      mingguLaporan: s.mingguLaporan.map(m => samarkan(m, [...FIELD_UANG_LAPORAN, 'kurs'])),
    }) })

    return res.json({
      success: true,
      data: {
        bulan, tahun,
        summary: { totalStudio, sudahLapor, belumLapor, grandTotalUsd, grandTotalIdr, grandTotalPengeluaran, grandTotalKas },
        studios: studiosTampil,
        lingkup: { semua: lingkup.semua },
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.weeklyReport.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' })

    if (!(await canManageStudio(req.userRoles, existing.studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa hapus laporan studio sendiri' })
    }

    await prisma.weeklyReport.delete({ where: { id } })
    return res.json({ success: true, message: 'Laporan berhasil dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

