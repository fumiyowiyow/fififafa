import prisma from '../prisma.js'
import { STUDIO_DIHITUNG, LAPORAN_DIHITUNG, USER_BUKAN_KOLABORASI_SAJA } from '../utils/kolaborasi.js'
import { kelolaStudio as canManageStudio } from '../utils/roles.js' // per unit (21 Okt 2026)
import { getCpmMapForStudiosBulan } from '../utils/cpm.js'
import { getKasMapForStudios } from '../utils/kas.js'
import { lingkupKeuangan, filterStudioId, infoLingkup, samarkan } from '../utils/lingkup.js'


// ── ECOSYSTEM DATA (Dana PE, Rumah Usaha) ──────────────────

export const getEcosystemData = async (req, res) => {
  try {
    // Dana PE / Forum / Berkah = dana level EKOSISTEM: hanya Advisor & Kepala Ekosistem.
    const lingkup = await lingkupKeuangan(req.userRoles)
    if (!lingkup.semua) return res.json({ success: true, data: { danaPE: null, danaForum: null, danaBerkah: null, rumahUsaha: null, terbatas: true } })
    const bulan = Number(req.query.bulan) || new Date().getMonth() + 1
    const tahun = Number(req.query.tahun) || new Date().getFullYear()

    let data = await prisma.monthlyEcosystemData.findUnique({
      where: { bulan_tahun: { bulan, tahun } },
    })

    // Kalau bulan ini belum ada, ambil data terakhir SEBELUM bulan ini (bukan bulan setelahnya --
    // dulu mengambil yang paling baru, sehingga Okt 2026 tampak terisi dengan angka Nov 2026).
    // Respons selalu memuat bulan/tahun baris yang dipakai, supaya tampilan bisa memberi tahu.
    if (!data) {
      data = await prisma.monthlyEcosystemData.findFirst({
        where: { OR: [{ tahun: { lt: tahun } }, { tahun, bulan: { lt: bulan } }] },
        orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
      })
    }

    return res.json({ success: true, data: data ?? { danaPE: 0, rumahUsaha: 5, bulan, tahun } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const upsertEcosystemData = async (req, res) => {
  try {
    const { bulan, tahun, danaPE, danaForum, danaBerkah, rumahUsaha, catatan } = req.body
    if (!bulan || !tahun) return res.status(422).json({ success: false, message: 'bulan dan tahun wajib diisi' })

    const data = await prisma.monthlyEcosystemData.upsert({
      where: { bulan_tahun: { bulan: Number(bulan), tahun: Number(tahun) } },
      update: {
        ...(danaPE     !== undefined && { danaPE:     Number(danaPE) }),
        ...(danaForum  !== undefined && { danaForum:  Number(danaForum) }),
        ...(danaBerkah !== undefined && { danaBerkah: Number(danaBerkah) }),
        ...(rumahUsaha !== undefined && { rumahUsaha: Number(rumahUsaha) }),
        ...(catatan    !== undefined && { catatan }),
      },
      create: {
        bulan:      Number(bulan),
        tahun:      Number(tahun),
        danaPE:     danaPE     ? Number(danaPE)     : 0,
        danaForum:  danaForum  ? Number(danaForum)  : 0,
        danaBerkah: danaBerkah ? Number(danaBerkah) : 0,
        rumahUsaha: rumahUsaha ? Number(rumahUsaha) : 5,
        catatan:    catatan ?? null,
      },
    })
    return res.json({ success: true, data })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── STUDIO CPM BULANAN ─────────────────────────────────────

export const getStudioCpm = async (req, res) => {
  try {
    const bulan = Number(req.query.bulan) || new Date().getMonth() + 1
    const tahun = Number(req.query.tahun) || new Date().getFullYear()

    const lingkup = await lingkupKeuangan(req.userRoles)
    const notes = await prisma.studioMonthlyNote.findMany({
      where: { bulan, tahun },
      include: { studio: { select: { id: true, nama: true, tipe: true } } },
    })
    // Semua unit tetap tampil; "dana di luar kas" (ekuitas) unit di luar wilayah disamarkan.
    return res.json({ success: true, data: notes.map(n => (lingkup.boleh(n.studioId) ? n : samarkan(n, ['ekuitas']))) })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// CPM bukan lagi diisi bulanan di sini — sekarang dihitung otomatis per studio, lihat utils/cpm.js.
// Endpoint ini sekarang cuma buat "Dana di Luar Kas" (ekuitas) bulanan.
export const upsertStudioCpm = async (req, res) => {
  try {
    const { studioId, bulan, tahun, ekuitas } = req.body
    if (!studioId || !bulan || !tahun) {
      return res.status(422).json({ success: false, message: 'studioId, bulan, tahun wajib diisi' })
    }
    if (ekuitas != null && (isNaN(Number(ekuitas)) || Number(ekuitas) < 0)) {
      return res.status(422).json({ success: false, message: 'ekuitas harus angka, tidak boleh negatif' })
    }

    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa input data studio sendiri' })
    }

    const note = await prisma.studioMonthlyNote.upsert({
      where: { studioId_bulan_tahun: { studioId, bulan: Number(bulan), tahun: Number(tahun) } },
      update: { ekuitas: Number(ekuitas) || 0 },
      create: { studioId, bulan: Number(bulan), tahun: Number(tahun), ekuitas: Number(ekuitas) || 0 },
    })
    return res.json({ success: true, data: note })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan data' })
  }
}

// ── FULL MONTHLY FINANCIAL SUMMARY ────────────────────────

export const getMonthlySummary = async (req, res) => {
  try {
    const bulan = Number(req.query.bulan) || new Date().getMonth() + 1
    const tahun = Number(req.query.tahun) || new Date().getFullYear()

    const startOfMonth = new Date(tahun, bulan - 1, 1)
    const endOfMonth   = new Date(tahun, bulan, 0, 23, 59, 59)

    const lingkup = await lingkupKeuangan(req.userRoles)
    const [studios, weeklyReports, ecosystemData, notesThisMonth, totalAnggota] = await Promise.all([
      // Studio kolaborasi (angkanya dihitung di circle mitra) tidak ikut ringkasan keuangan ekosistem.
      prisma.studio.findMany({
        where: { statusAktif: true, ...STUDIO_DIHITUNG },
        select: { id: true, tipe: true },
      }),
      prisma.weeklyReport.findMany({
        where: { periodeAwal: { gte: startOfMonth, lte: endOfMonth }, ...LAPORAN_DIHITUNG },
        select: { studioId: true, totalUsd: true, kasSekarang: true, pengeluaran: true, kurs: true },
        orderBy: { periodeAwal: 'asc' },
      }),
      prisma.monthlyEcosystemData.findFirst({
        where: { bulan, tahun },
      }).then(async d => {
        if (d) return d
        return prisma.monthlyEcosystemData.findFirst({ orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }] })
      }),
      prisma.studioMonthlyNote.findMany({ where: { bulan, tahun } }),
      prisma.user.count({ where: { statusAktif: true, ...USER_BUKAN_KOLABORASI_SAJA } }),
    ])

    // Dana di Luar Kas (ekuitas) per studio -- kalau bulan ini belum ada catatan, pakai catatan
    // TERAKHIR studio itu (bukan langsung 0) -- pola sama kayak ecosystemData di atas, biar angka
    // gak "reset" tiap ganti bulan sebelum koordinator sempat update ulang. Per-studio (bukan satu
    // fallback global) karena tiap studio update di waktu beda-beda. Diputuskan 1 Agustus 2026.
    const notedStudioIds = new Set(notesThisMonth.map(n => n.studioId))
    const missingStudioIds = studios.map(s => s.id).filter(id => !notedStudioIds.has(id))
    // Catatan terakhir SAMPAI bulan yang dilihat (bukan sesudahnya) -- dulu mengambil yang paling
    // baru, jadi Okt yang kosong ikut tampil dengan angka Nov. Dikoreksi 4 Nov 2026.
    const fallbackNotes = missingStudioIds.length > 0
      ? await prisma.studioMonthlyNote.findMany({
          where: { studioId: { in: missingStudioIds }, OR: [{ tahun: { lt: tahun } }, { tahun, bulan: { lte: bulan } }] },
          distinct: ['studioId'],
          orderBy: [{ studioId: 'asc' }, { tahun: 'desc' }, { bulan: 'desc' }],
        })
      : []
    const cpmNotes = [...notesThisMonth, ...fallbackNotes]

    // Agregasi per studio
    const reportsByStudio = {}
    for (const r of weeklyReports) {
      if (!reportsByStudio[r.studioId]) reportsByStudio[r.studioId] = []
      reportsByStudio[r.studioId].push(r)
    }

    // CPM sekarang dihitung otomatis per studio (THP + pengeluaran rutin + SHU, Rupiah-native)
    // -- lihat utils/cpm.js. Bukan lagi Studio.cpmTarget (USD, dihapus 26 Juli 2026).
    const cpmMap = await getCpmMapForStudiosBulan(studios.map(s => s.id), bulan, tahun)
    // Kas bulan berjalan (dan bulan depan) = live SUM(saldo) Rekening Bank (Bio Studio) --
    // diputuskan 31 Juli 2026, lihat utils/kas.js. Bulan yang SUDAH LEWAT = snapshot kas
    // (WeeklyReport.kasSekarang) laporan terakhir sampai akhir bulan itu, supaya bulan lalu tetap
    // "versi bulan lalu" -- saldo rekening gak punya riwayat, jadi rekening yang baru ditambah
    // (mis. Koperasi pindah dari Dana di Luar Kas) gak ikut mengubah bulan lampau & gak terhitung
    // dobel dengan catatan Dana di Luar Kas bulan itu. Studio tanpa laporan sama sekali sampai
    // bulan itu tetap pakai saldo live. Diputuskan 4 Nov 2026.
    const kini = new Date()
    const bulanLewat = tahun < kini.getFullYear() || (tahun === kini.getFullYear() && bulan < kini.getMonth() + 1)
    const kasMap = await getKasMapForStudios(studios.map(s => s.id))
    if (bulanLewat && studios.length > 0) {
      const snapshot = await prisma.weeklyReport.findMany({
        where: { studioId: { in: studios.map(s => s.id) }, periodeAwal: { lte: endOfMonth }, ...LAPORAN_DIHITUNG },
        distinct: ['studioId'],
        orderBy: [{ studioId: 'asc' }, { periodeAwal: 'desc' }],
        select: { studioId: true, kasSekarang: true },
      })
      for (const r of snapshot) if (r.kasSekarang != null) kasMap[r.studioId] = r.kasSekarang
    }

    let totalKas = 0, totalOmsetIdr = 0, totalCpm = 0, totalEkuitas = 0, totalPengeluaran = 0
    const totalStudio  = studios.filter(s => s.tipe === 'STUDIO').length
    const totalProject = studios.filter(s => s.tipe === 'PROJECT').length
    const totalKorporasi = studios.filter(s => s.tipe === 'KORPORASI').length

    const ekuitasMap = Object.fromEntries(cpmNotes.map(n => [n.studioId, n.ekuitas ?? 0]))

    for (const s of studios) {
      // Jumlah unit tetap seluruhnya (totalStudio/totalProject di atas); UANG hanya dari unit dalam wilayah.
      if (!lingkup.boleh(s.id)) continue
      const reps = reportsByStudio[s.id] ?? []
      const kasAkhir  = kasMap[s.id] ?? 0
      const omsetIdr  = reps.reduce((a, r) => a + r.totalUsd * r.kurs, 0)
      const pengeluaran = reps.reduce((a, r) => a + (r.pengeluaran ?? 0), 0)
      totalKas          += kasAkhir
      totalOmsetIdr     += omsetIdr
      totalCpm          += cpmMap[s.id]?.totalCpm ?? 0
      totalEkuitas      += ekuitasMap[s.id] ?? 0
      totalPengeluaran  += pengeluaran
    }

    const totalEkuitasUsaha = totalKas + totalEkuitas
    // Dana level ekosistem (PE/Forum/Berkah) hanya Advisor & Kepala Ekosistem; yang lain 0 (bukan angka bocoran).
    const danaPE      = lingkup.semua ? (ecosystemData?.danaPE     ?? 0) : 0
    const danaForum   = lingkup.semua ? (ecosystemData?.danaForum  ?? 0) : 0
    const danaBerkah  = lingkup.semua ? (ecosystemData?.danaBerkah ?? 0) : 0
    const rumahUsaha  = ecosystemData?.rumahUsaha ?? 5

    // Dana Circle/Rumah Usaha sekarang dari OrgFundReport (laporan mingguan) -- dana "akhir
    // bulan" per entity = laporan terakhir dalam rentang bulan itu, mirror perhitungan kasAkhir
    // studio di atas (bukan jumlah semua laporan minggu dalam bulan itu).
    const orgReportsThisMonth = await prisma.orgFundReport.findMany({
      where: { periodeAwal: { gte: startOfMonth, lte: endOfMonth }, ...(lingkup.semua ? {} : { OR: [ ...(lingkup.circleIds.size ? [{ circleId: { in: [...lingkup.circleIds] } }] : []), ...(lingkup.rumahUsahaIds.size ? [{ rumahUsahaId: { in: [...lingkup.rumahUsahaIds] } }] : []), { id: 'tidak-ada' } ] }) },
      orderBy: { periodeAwal: 'asc' },
      select: { circleId: true, rumahUsahaId: true, dana: true },
    })
    const lastDanaByCircle = {}, lastDanaByRumahUsaha = {}
    for (const r of orgReportsThisMonth) {
      if (r.circleId)     lastDanaByCircle[r.circleId]         = r.dana
      if (r.rumahUsahaId) lastDanaByRumahUsaha[r.rumahUsahaId] = r.dana
    }
    const totalDanaCircle     = Object.values(lastDanaByCircle).reduce((a, v) => a + v, 0)
    const totalDanaRumahUsaha = Object.values(lastDanaByRumahUsaha).reduce((a, v) => a + v, 0)
    const totalEkuitasPE = totalEkuitasUsaha + danaPE + danaForum + danaBerkah + totalDanaCircle + totalDanaRumahUsaha

    return res.json({
      success: true,
      data: {
        bulan, tahun,
        totalKas,
        totalEkuitas,
        totalEkuitasUsaha,
        totalPengeluaran,
        danaPE, danaForum, danaBerkah,
        totalDanaCircle, totalDanaRumahUsaha,
        totalEkuitasPE,
        totalCpm, totalStudio, totalProject, totalKorporasi, totalAnggota, rumahUsaha,
        lingkup: infoLingkup(lingkup),
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
