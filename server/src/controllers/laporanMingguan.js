// ─────────────────────────────────────────────────────────────────────────
// WEEKLY REPORT per unit usaha (13 Okt 2026) — data untuk PDF slide 16:9 satu unit satu bulan.
// PDF-nya disusun di peramban (client/src/components/laporan/LaporanMingguanPDF.jsx, diadaptasi
// dari playgroundecos.app); endpoint ini menyusun data dengan BENTUK yang sama, dari sumber Ekosistem:
//   · Progres Omset       = laporan mingguan per platform × periode minggu + riwayat 6 bulan
//                           (Ekosistem belum mencatat nama akun per platform)
//   · Financial Forecasting = komponen CPM (THP per orang, pengeluaran rutin, SHU) + pengeluaran
//                           per item bulan itu. Centang = THP yang Penggajian-nya sudah DIBAYAR
//                           (Payroll) dan pengeluaran yang sudah tercatat.
//   · Financial Overview  = alur kas yang SAMA dengan Monthly Report (laporanProgres.js)
//   · Potensi Pendapatan  = Order Produksi berstatus MASUK/PROSES (per akun) + Marketing Lead
//                           yang masih berjalan
//   · Renstra/KPI         = Goals unit
//   · Team                = Koordinator & talent + Penilaian Kader bulan itu (bukan Evaluasi
//                           Mingguan Playground — Jurnal Talent Ekosistem sudah diarsipkan)
// Tidak ada rumus uang baru.
// ─────────────────────────────────────────────────────────────────────────
import prisma from '../prisma.js'
import { hasAnyRole, SUPER_ADMIN } from '../utils/roles.js'
import { getCpmMapForStudios } from '../utils/cpm.js'
import { getKasMapForStudios } from '../utils/kas.js'
import { getMonthAttributionRange, isReportInMonth, getReportingPeriod } from '../utils/week.js'
import { rataRataSkor } from '../utils/penilaianKader.js'
import { ambilLogo } from './logoLaporan.js'
import { NAMA_BULAN, MARKET, geserBulan, omsetDariLaporan, organisasiDari } from './laporanProgres.js'

const TIM_UNIT = ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG']
const LABEL_POSISI = { KOORDINATOR: 'Koordinator', KADER: 'Kader', KARYAWAN: 'Talent', MAGANG: 'Magang' }
const URUT_POSISI = { KOORDINATOR: 0, KADER: 1, KARYAWAN: 2, MAGANG: 3 }
const LABEL_RUTIN = { SUPPORT: 'Support System', SUBSCRIPTION: 'Subscription/Langganan', LAINNYA: 'Lainnya' }
const STATUS_ORDER = { MASUK: 'antre', PROSES: 'proses' }
const STATUS_LEAD_BERJALAN = ['DISCUSSING', 'FOLLOW_UP', 'NEGO']
const BULAN_RIWAYAT = 6
const MAKS_BUTIR = 8
const HARI_MS = 24 * 60 * 60 * 1000
const ID_SAH = /^[A-Za-z0-9_-]{1,64}$/

const bulat = (v) => Math.round(Number(v) || 0)
const sen = (v) => Math.round((Number(v) || 0) * 100) / 100
const fotoAman = (f) => (typeof f === 'string' && f.length <= 400_000 && /^data:image\/(jpeg|png|webp);base64,/.test(f) ? f : null)

/** Weekly Report hanya untuk yang berkaitan dengan unit: Super Admin, kepala/admin organisasinya,
 *  dan pemegang unit (Koordinator / Pendamping / Kader). */
export function bolehLaporanUnit(roles = [], s) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  return roles.some(r =>
    (['KEPALA_CIRCLE', 'ADMIN_FUNGSIONAL'].includes(r.roleType) && s.circleId && r.circleId === s.circleId) ||
    (r.roleType === 'KEPALA_RUMAH_USAHA' && s.rumahUsahaId && r.rumahUsahaId === s.rumahUsahaId) ||
    (['KOORDINATOR', 'PENDAMPING', 'KADER'].includes(r.roleType) && r.studioId === s.id) ||
    // Koordinator Korporasi juga untuk unit di bawahnya.
    (r.roleType === 'KOORDINATOR' && s.indukId && r.studioId === s.indukId))
}

const SEL_UNIT = {
  id: true, nama: true, tipe: true, market: true, niche: true, circleId: true, rumahUsahaId: true, indukId: true, statusShu: true, totalShu: true,
  circle: { select: { id: true, nama: true, colorHex: true } },
  rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
  induk: { select: { id: true, nama: true } },
}

/** GET /api/reports/mingguan/unit — unit yang boleh dibuatkan Weekly Report + bawaan. */
export const getUnitMingguan = async (req, res) => {
  try {
    const roles = req.userRoles ?? []
    const units = await prisma.studio.findMany({ where: { statusAktif: true }, select: SEL_UNIT, orderBy: { nama: 'asc' } })
    const boleh = units.filter(s => bolehLaporanUnit(roles, s))
      .map(s => ({ id: s.id, nama: s.nama, tipe: s.tipe, organisasi: organisasiDari(s), situs: null }))
      .sort((a, b) => String(a.organisasi?.nama ?? '~').localeCompare(String(b.organisasi?.nama ?? '~'), 'id') || a.nama.localeCompare(b.nama, 'id'))
    // Bawaan = unit tempat pemakai memegang posisi, selain itu yang pertama.
    const milik = new Set(roles.filter(r => r.studioId).map(r => r.studioId))
    return res.json({ success: true, data: { unit: boleh, bawaan: boleh.find(u => milik.has(u.id))?.id ?? boleh[0]?.id ?? null } })
  } catch (e) {
    console.error('[laporanMingguan] unit gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

/** Periode laporan dalam satu bulan (sama dengan getReportingPeriod: minggu dipotong di batas bulan). */
function periodeBulan(bulan, tahun) {
  const akhir = new Date(Date.UTC(tahun, bulan, 0))
  const hasil = []
  let t = new Date(Date.UTC(tahun, bulan - 1, 1))
  while (t <= akhir && hasil.length < 7) {
    const { periodeAwal, periodeAkhir } = getReportingPeriod(t)
    hasil.push({ nomor: hasil.length + 1, periodeAwal, periodeAkhir, label: `${periodeAwal.getUTCDate()}–${periodeAkhir.getUTCDate()}` })
    t = new Date(periodeAkhir.getTime() + HARI_MS)
  }
  return hasil
}

/** Butir catatan: satu baris = satu butir, tanpa duplikat. */
function butir(daftar) {
  const hasil = []
  const sudah = new Set()
  for (const teks of daftar) {
    for (const b of String(teks ?? '').split('\n').map(x => x.trim().replace(/^[-•·]\s*/, '')).filter(Boolean)) {
      const k = b.toLowerCase()
      if (sudah.has(k)) continue
      sudah.add(k); hasil.push(b)
      if (hasil.length >= MAKS_BUTIR) return hasil
    }
  }
  return hasil
}

/** Status dari rata-rata skor Penilaian Kader (skala 1–5; ambang sama dengan Kondisi Tim). */
const statusDariSkor = (rata) => (rata >= 3 ? 'BAIK' : rata >= 2 ? 'PERHATIAN' : 'KRITIS')

/** GET /api/reports/mingguan?studioId=&bulan=&tahun=&gaji=1 */
export const getLaporanMingguan = async (req, res) => {
  try {
    const studioId = String(req.query.studioId ?? '')
    if (!ID_SAH.test(studioId)) return res.status(422).json({ success: false, message: 'Unit tidak dikenal' })
    const now = new Date()
    const bulan = Math.min(12, Math.max(1, parseInt(req.query.bulan) || now.getMonth() + 1))
    const tahun = Math.min(2100, Math.max(2020, parseInt(req.query.tahun) || now.getFullYear()))
    const ringkas = req.query.ringkas === '1'

    const s = await prisma.studio.findFirst({ where: { id: studioId, statusAktif: true }, select: SEL_UNIT })
    if (!s) return res.status(404).json({ success: false, message: 'Unit usaha tidak ditemukan' })
    const roles = req.userRoles ?? []
    if (!bolehLaporanUnit(roles, s)) {
      return res.status(403).json({ success: false, message: 'Weekly Report hanya untuk pengurus unit ini (Koordinator / Kader / Pendamping), kepala organisasinya, dan Super Admin' })
    }
    const org = organisasiDari(s)

    const periode = periodeBulan(bulan, tahun)
    const deret = Array.from({ length: BULAN_RIWAYAT }, (_, i) => geserBulan(bulan, tahun, i - (BULAN_RIWAYAT - 1)))
    const { rangeStart: awalRiwayat } = getMonthAttributionRange(deret[0].bulan, deret[0].tahun)
    const { rangeStart: awalBulan, rangeEnd: akhirBulanAtribusi } = getMonthAttributionRange(bulan, tahun)
    const kalender = { gte: new Date(Date.UTC(tahun, bulan - 1, 1)), lt: new Date(Date.UTC(tahun, bulan, 1)) }
    const akhirBulan = new Date(Date.UTC(tahun, bulan, 0))
    // Rincian gaji per orang = dokumen internal: diminta (?gaji=1) DAN pemakai pengurus.
    const gajiDirinci = req.query.gaji === '1'

    const [laporanRows, kasPrev, kasLive, note, cpmMap, thpRows, rutinRows, itemRows, gajiRows, rekeningRows, rosterRows, orderRows, leadRows, goalRows] = await Promise.all([
      prisma.weeklyReport.findMany({
        where: { studioId: s.id, periodeAwal: { gte: awalRiwayat, lte: akhirBulanAtribusi } },
        select: { periodeAwal: true, periodeAkhir: true, kurs: true, totalUsd: true, pengeluaran: true, ...Object.fromEntries(MARKET.map(m => [m.kolom, true])) },
        orderBy: { periodeAwal: 'asc' },
      }),
      prisma.weeklyReport.findFirst({ where: { studioId: s.id, periodeAwal: { lt: awalBulan } }, orderBy: { periodeAwal: 'desc' }, select: { kasSekarang: true } }),
      getKasMapForStudios([s.id]),
      prisma.studioMonthlyNote.findFirst({
        where: { studioId: s.id, OR: [{ tahun: { lt: tahun } }, { tahun, bulan: { lte: bulan } }] },
        orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }], select: { ekuitas: true },
      }),
      getCpmMapForStudios([s.id]),
      prisma.userRole.findMany({ where: { studioId: s.id, takeHomePay: { not: null }, OR: [{ roleType: 'DIGNITY' }, { user: { statusAktif: true } }] }, select: { userId: true, roleType: true, takeHomePay: true, user: { select: { nama: true } } } }),
      prisma.studioPengeluaranRutin.findMany({ where: { studioId: s.id }, orderBy: [{ kategori: 'asc' }, { createdAt: 'asc' }] }),
      prisma.pengeluaran.findMany({ where: { studioId: s.id, tanggal: kalender }, orderBy: { tanggal: 'asc' } }),
      prisma.penggajian.findMany({ where: { studioId: s.id, bulan, tahun }, select: { userId: true, status: true } }),
      // Nomor rekening & atas nama SENGAJA tidak dipilih: dokumen ini dibagikan.
      prisma.studioRekening.findMany({ where: { studioId: s.id }, select: { namaBank: true, saldo: true }, orderBy: { createdAt: 'asc' } }),
      prisma.userRole.findMany({
        where: { studioId: s.id, roleType: { in: TIM_UNIT }, user: { statusAktif: true } },
        select: { roleType: true, user: { select: { id: true, nama: true, fotoUrl: true } } },
      }),
      prisma.orderProduksi.findMany({
        where: { studioId: s.id, status: { in: Object.keys(STATUS_ORDER) } },
        select: { klien: true, judul: true, nilaiKotor: true, status: true, deadline: true, akun: { select: { platform: true, namaAkun: true } } },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.marketingLead.findMany({ where: { studioId: s.id, status: { in: STATUS_LEAD_BERJALAN } }, select: { estimasiNilai: true } }),
      prisma.goal.findMany({
        where: { studioId: s.id, OR: [{ deadline: { gte: kalender.gte } }, { tercapaiAt: kalender }] },
        select: { nama: true, targetValue: true, currentValue: true, satuan: true, tercapai: true, deadline: true },
        orderBy: { deadline: 'asc' }, take: 10,
      }),
    ])

    // ── Progres omset: per platform × periode minggu ─────────────────────
    const laporanBulan = laporanRows.filter(r => isReportInMonth(r, bulan, tahun))
    const indeksMinggu = (r) => {
      const t = new Date(r.periodeAwal).getTime()
      const i = periode.findIndex(p => p.periodeAwal.getTime() === t)
      if (i >= 0) return i
      let j = periode.findIndex(p => p.periodeAwal.getTime() > t) - 1
      if (j < 0) j = t < periode[0].periodeAwal.getTime() ? 0 : periode.length - 1
      return j
    }
    const barisMarket = new Map()
    const perMinggu = periode.map(() => 0)
    for (const r of laporanBulan) {
      const i = indeksMinggu(r)
      const kurs = Number(r.kurs) > 0 ? Number(r.kurs) : 17000
      for (const m of MARKET) {
        const u = Number(r[m.kolom]) || 0
        if (!(u > 0)) continue
        const b = barisMarket.get(m.key) ?? { kunci: m.key, market: m.key, marketLabel: m.label, akun: null, label: m.label, perMinggu: periode.map(() => 0), totalUsd: 0, totalIdr: 0 }
        b.perMinggu[i] += u; b.totalUsd += u; b.totalIdr += u * kurs
        barisMarket.set(m.key, b)
        perMinggu[i] += u
      }
    }
    const omsetBulan = omsetDariLaporan(laporanBulan)
    const omset = {
      baris: [...barisMarket.values()].sort((a, b) => b.totalUsd - a.totalUsd)
        .map(b => ({ ...b, perMinggu: b.perMinggu.map(sen), totalUsd: sen(b.totalUsd), totalIdr: bulat(b.totalIdr) })),
      perMinggu: perMinggu.map(sen),
      totalUsd: omsetBulan.usd, totalIdr: omsetBulan.idr, jumlahLaporan: laporanBulan.length,
      riwayat: deret.map(m => {
        const o = omsetDariLaporan(laporanRows.filter(r => isReportInMonth(r, m.bulan, m.tahun)))
        return { bulan: m.bulan, tahun: m.tahun, label: NAMA_BULAN[m.bulan - 1], usd: o.usd, idr: o.idr, laporan: o.jumlahLaporan }
      }),
    }

    // ── Posisi tim (dipakai Forecasting & Team) ─────────────────────────
    const posisi = new Map()
    for (const r of rosterRows) {
      const ada = posisi.get(r.user.id)
      if (!ada || URUT_POSISI[r.roleType] < ada.urut) posisi.set(r.user.id, { urut: URUT_POSISI[r.roleType], label: LABEL_POSISI[r.roleType], user: r.user })
    }

    // ── Financial Forecasting ───────────────────────────────────────────
    const dibayar = new Set(gajiRows.filter(g => g.status === 'DIBAYAR').map(g => g.userId))
    const kelompok = []
    if (thpRows.length) {
      if (gajiDirinci) {
        const perOrang = new Map()
        for (const t of thpRows) {
          const g = perOrang.get(t.userId) ?? { id: `thp:${t.userId}`, jenis: 'THP', judul: t.user?.nama ?? 'Anggota', sub: posisi.get(t.userId)?.label ?? null, baris: [] }
          g.baris.push({ kunci: `thp:${t.userId}:${g.baris.length}`, label: 'THP', jumlah: bulat(t.takeHomePay), centang: dibayar.has(t.userId) })
          perOrang.set(t.userId, g)
        }
        kelompok.push(...perOrang.values())
      } else {
        const orang = new Set(thpRows.map(t => t.userId))
        kelompok.push({
          id: 'thp', jenis: 'THP', judul: 'Pendapatan Anggota', sub: `${orang.size} orang`,
          baris: [{ kunci: 'thp', label: `Pendapatan Anggota (${orang.size} orang)`, jumlah: thpRows.reduce((a, t) => a + bulat(t.takeHomePay), 0), centang: [...orang].every(id => dibayar.has(id)) }],
        })
      }
    }
    for (const id of ['SUPPORT', 'SUBSCRIPTION', 'LAINNYA']) {
      const isi = rutinRows.filter(r => r.kategori === id)
      if (isi.length) kelompok.push({ id: `rutin:${id}`, jenis: id, judul: LABEL_RUTIN[id], baris: isi.map(r => ({ kunci: `rutin:${r.id}`, label: r.nama, jumlah: bulat(r.jumlah), centang: false })) })
    }
    const shu = s.statusShu ? bulat(s.totalShu) : 0
    if (shu > 0) kelompok.push({ id: 'shu', jenis: 'SHU', judul: 'SHU', baris: [{ kunci: 'shu', label: 'SHU (saham unit)', jumlah: shu, centang: false }] })
    // Pengeluaran per item + total laporan lama yang belum punya rincian (data lama) — supaya
    // jumlahnya = total pengeluaran laporan bulan ini (sama dengan Monthly Report).
    const tanpaItem = laporanBulan.filter(r => (r.pengeluaran ?? 0) > 0 && !itemRows.some(p => p.tanggal >= r.periodeAwal && p.tanggal <= r.periodeAkhir))
    const tambahan = [
      ...itemRows.map(p => ({ nama: p.nama, jumlah: p.jumlah, tanggal: p.tanggal, kategori: p.kategori })),
      ...tanpaItem.map(r => ({ nama: `Pengeluaran ${r.periodeAwal.toISOString().slice(5, 10).split('-').reverse().join('/')} (tanpa rincian)`, jumlah: r.pengeluaran, tanggal: r.periodeAwal })),
    ]
    if (tambahan.length) {
      const padat = tambahan.length > 14
      kelompok.push({
        id: 'tambahan', jenis: 'TAMBAHAN', judul: 'Pengeluaran Tambahan', sub: `${tambahan.length} catatan`,
        baris: padat
          ? [{ kunci: 'tambahan', label: `Pengeluaran Tambahan (${tambahan.length} catatan)`, jumlah: tambahan.reduce((a, p) => a + bulat(p.jumlah), 0), centang: true }]
          : tambahan.map((p, i) => ({ kunci: `tambahan:${i}`, label: p.nama, jumlah: bulat(p.jumlah), centang: true, tanggal: p.tanggal, kategori: p.kategori ?? null })),
      })
    }
    for (const g of kelompok) g.subtotal = g.baris.reduce((a, b) => a + b.jumlah, 0)
    const totalCpm = bulat(cpmMap[s.id]?.totalCpm ?? 0)
    const totalTambahan = bulat(laporanBulan.reduce((a, r) => a + (r.pengeluaran ?? 0), 0))
    const totalPengeluaran = totalCpm + totalTambahan
    const forecasting = {
      kelompok, totalCpm, totalTambahan, totalPengeluaran,
      cpmHariIni: totalCpm, selisihCpm: 0, cpmDari: 'hari-ini',
      totalTercentang: kelompok.flatMap(g => g.baris).filter(b => b.centang).reduce((a, b) => a + b.jumlah, 0),
      totalPos: kelompok.reduce((a, g) => a + g.subtotal, 0),
      jumlahPos: kelompok.reduce((a, g) => a + g.baris.length, 0),
      gajiDirinci, gajiDiminta: gajiDirinci,
      pendapatan: { baris: omset.baris.map(b => ({ kunci: b.kunci, label: b.label, usd: b.totalUsd, idr: b.totalIdr })), totalIdr: omsetBulan.idr, totalUsd: omsetBulan.usd },
      laba: omsetBulan.idr - totalPengeluaran,
    }

    // ── Financial Overview (alur kas sama dengan Monthly Report) ─────────
    const berjalan = bulan === now.getMonth() + 1 && tahun === now.getFullYear()
    const bank = bulat(kasPrev?.kasSekarang ?? kasLive[s.id] ?? 0)
    const luar = bulat(note?.ekuitas ?? 0)
    const menabung = omsetBulan.idr - totalPengeluaran
    const keuangan = {
      kas: { bank, luar, total: bank + luar }, cpm: totalCpm, tambahan: totalTambahan, beban: totalPengeluaran,
      omset: { usd: omsetBulan.usd, idr: omsetBulan.idr },
      menabung, estKasAkhir: bank + luar + menabung,
      sah: false, sumber: laporanBulan.length ? 'laporan' : 'kosong', berjalan,
      rekening: [
        ...rekeningRows.map(r => ({ nama: r.namaBank, jenis: 'BANK', saldo: bulat(r.saldo), saldoUsd: null })),
        ...(luar > 0 ? [{ nama: 'Dana di Luar Kas', jenis: 'LUAR', saldo: luar, saldoUsd: null }] : []),
      ],
      rekeningDari: berjalan ? 'hari-ini' : 'saldo-sekarang',
    }

    // ── Potensi pendapatan: order berjalan per akun + lead marketing ────
    const perAkun = new Map()
    for (const o of orderRows) {
      const platform = o.akun?.platform ?? 'Lainnya'
      const akun = o.akun?.namaAkun ?? null
      const k = `${platform}|${String(akun ?? '').toLowerCase()}`
      const g = perAkun.get(k) ?? { kunci: k, platform, akun, label: akun ? `${platform} · ${akun}` : platform, jumlah: 0, usd: 0, idr: 0, order: [] }
      g.jumlah += 1
      g.idr += Number(o.nilaiKotor) || 0
      g.order.push({ klien: o.klien, brief: o.judul, nilai: Number(o.nilaiKotor) || 0, mataUang: 'IDR', status: STATUS_ORDER[o.status] ?? o.status, deadline: o.deadline })
      perAkun.set(k, g)
    }
    const akunOrder = [...perAkun.values()].sort((a, b) => b.jumlah - a.jumlah).map(g => ({ ...g, idr: bulat(g.idr), order: g.order.slice(0, 6) }))
    const potensi = {
      akun: akunOrder, jumlah: orderRows.length,
      totalUsd: 0, totalIdr: akunOrder.reduce((a, g) => a + g.idr, 0),
      prospek: { jumlah: leadRows.length, usd: 0, idr: bulat(leadRows.reduce((a, l) => a + (Number(l.estimasiNilai) || 0), 0)) },
    }

    // ── Team + Penilaian Kader bulan itu ────────────────────────────────
    const idOrang = [...posisi.keys()]
    // Penilaian s.d. akhir bulan laporan: yang di bulan itu dipakai semua; talent yang belum dinilai
    // bulan itu memakai penilaian TERAKHIR yang sudah diisi (tanggalnya ikut tercetak) — supaya
    // halaman Team tidak kosong hanya karena mentor belum sempat menilai bulan ini.
    const penilaian = idOrang.length
      ? await prisma.penilaianKader.findMany({ where: { userId: { in: idOrang }, tanggalPenilaian: { lt: kalender.lt } }, orderBy: { tanggalPenilaian: 'desc' } })
      : []
    const diBulan = (p) => p.tanggalPenilaian >= kalender.gte
    const ANGKA = (p, k) => `${p[k]}/5`
    let anggaranFoto = 2_500_000
    const tim = [...posisi.entries()]
      .sort((a, b) => (a[1].urut - b[1].urut) || a[1].user.nama.localeCompare(b[1].user.nama, 'id'))
      .map(([userId, o]) => {
        const semua = penilaian.filter(p => p.userId === userId)
        const bulanIni = semua.filter(diBulan)
        // Bulan ini ada → semua penilaian bulan ini; belum ada → penilaian terakhir saja.
        const ps = bulanIni.length ? bulanIni : semua.slice(0, 1)
        const terbaru = ps[0]
        let fotoUrl = ringkas ? null : fotoAman(o.user.fotoUrl)
        if (fotoUrl && fotoUrl.length > anggaranFoto) fotoUrl = null
        else if (fotoUrl) anggaranFoto -= fotoUrl.length
        return {
          userId, nama: o.user.nama, fotoUrl, label: o.label,
          status: terbaru ? statusDariSkor(rataRataSkor(terbaru)) : null, mingguDinilai: bulanIni.length,
          tanggalPenilaian: terbaru?.tanggalPenilaian ?? null, penilaianLama: !bulanIni.length && !!terbaru,
          // Teknis ← hasil kerja (pencapaian/perkembangan + skor kompetensi); non-teknis ← sikap
          // & kehadiran (catatan/kendala + skor kedisiplinan & adab).
          teknis: terbaru ? butir([...ps.map(p => p.pencapaian), ...ps.map(p => p.perkembangan),
            `Kualitas kerja ${ANGKA(terbaru, 'skorKualitasKerja')} · Penguasaan skill ${ANGKA(terbaru, 'skorPenguasaanSkill')}`,
            `Inisiatif ${ANGKA(terbaru, 'skorInisiatif')} · Kerja sama ${ANGKA(terbaru, 'skorKerjaSama')}`]) : [],
          nonTeknis: terbaru ? butir([...ps.map(p => p.catatan), ...ps.map(p => p.kendala),
            `Kehadiran ${ANGKA(terbaru, 'skorKehadiran')} · Ketepatan waktu ${ANGKA(terbaru, 'skorKetepatanWaktu')}`,
            `Adab ${ANGKA(terbaru, 'skorAdab')} · Kejujuran ${ANGKA(terbaru, 'skorKejujuran')} · Menerima masukan ${ANGKA(terbaru, 'skorMenerimaMasukan')}`]) : [],
        }
      })

    const goal = goalRows.map(g => ({
      nama: g.nama, target: g.targetValue, kini: g.currentValue, satuan: g.satuan, tercapai: !!g.tercapai, deadline: g.deadline,
      persen: g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : (g.tercapai ? 100 : 0),
    }))

    const tanggalAcuan = berjalan ? now : akhirBulan
    const tanggalLabel = berjalan
      ? now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
      : `${akhirBulan.getUTCDate()} ${NAMA_BULAN[bulan - 1]} ${tahun}`
    return res.json({
      success: true,
      data: {
        dibuat: now.toISOString(), tanggalAcuan: tanggalAcuan.toISOString(), tanggalLabel,
        bulan, tahun, labelBulan: `${NAMA_BULAN[bulan - 1]} ${tahun}`, berjalan,
        kursLuar: null,
        unit: {
          id: s.id, nama: s.nama, tipe: s.tipe, market: s.market ?? null, logoUrl: await ambilLogo('unit', s.id),
          bidangUsaha: s.niche ?? null, jenisUsaha: null, kategoriPasar: null,
        },
        lingkup: org
          ? { kunci: `${org.jenis}:${org.id}`, jenis: org.jenis, id: org.id, nama: org.nama, slotWarna: org.slotWarna, situs: null, logoUrl: await ambilLogo(org.jenis === 'korporasi' ? 'unit' : org.jenis, org.id) }
          : { kunci: 'tanpa', jenis: null, id: null, nama: null, slotWarna: 1, situs: null },
        minggu: periode.map(p => ({ nomor: p.nomor, periodeAwal: p.periodeAwal.toISOString(), periodeAkhir: p.periodeAkhir.toISOString(), label: p.label })),
        omset, forecasting, keuangan, potensi, goal, tim,
      },
    })
  } catch (e) {
    console.error('[laporanMingguan] gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
