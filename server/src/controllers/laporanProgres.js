// ─────────────────────────────────────────────────────────────────────────
// MONTHLY REPORT / PROGRESS REPORT (13 Okt 2026) — data untuk PDF slide 16:9 per circle,
// rumah usaha, atau satu ekosistem. PDF-nya disusun di peramban (client/src/components/laporan/,
// diadaptasi dari playgroundecos.app); endpoint ini menyusun data dengan BENTUK yang sama
// seperti di sana, tapi dari sumber Ekosistem. Tidak ada rumus baru selain alur kas laporan:
//
//   Kas Awal  = kas bank + dana di luar kas
//               · bank: snapshot kas (WeeklyReport.kasSekarang) laporan TERAKHIR sebelum bulan
//                 itu; belum ada → saldo Rekening Bank sekarang (utils/kas.js)
//               · luar: "Dana di Luar Kas" (StudioMonthlyNote.ekuitas) bulan itu / terakhir
//   Pengeluaran (beban) = CPM (utils/cpm.js) + pengeluaran tambahan (Σ WeeklyReport.pengeluaran
//               bulan itu = total item Pengeluaran, utils/pengeluaran.js)
//   Menabung  = Omset − Pengeluaran        Est. Kas Akhir = Kas Awal + Menabung
//   Omset     = Σ totalUsd × kurs laporan bulan itu (atribusi bulan resmi: isReportInMonth)
// ─────────────────────────────────────────────────────────────────────────
import prisma from '../prisma.js'
import { hasAnyRole, SUPER_ADMIN } from '../utils/roles.js'
import { getCpmMapForStudiosBulan } from '../utils/cpm.js'
import { getKasMapForStudios } from '../utils/kas.js'
import { getMonthAttributionRange, isReportInMonth } from '../utils/week.js'
import { ambilLogo } from './logoLaporan.js'
import { ECOSYSTEM_NAME_FULL } from '../config/ecosystem.js'
import { STUDIO_DIHITUNG } from '../utils/kolaborasi.js'

export const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Tim sebuah unit = yang BEKERJA di unit itu (tanpa pendamping/penasihat/dignity).
const TIM_UNIT = ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG']
// Anggota lingkup = tim unit + kepala organisasinya.
const ROLE_ANGGOTA = [...TIM_UNIT, 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA']

// Market Ekosistem (kolom WeeklyReport) — kunci mengikuti palet PDF (config/warna-pdf.js di klien).
export const MARKET = [
  { key: 'fiverr',    label: 'Fiverr',    kolom: 'omsetFiverr' },
  { key: 'etsy',      label: 'Etsy',      kolom: 'omsetEtsy' },
  { key: 'upwork',    label: 'Upwork',    kolom: 'omsetUpwork' },
  { key: 'vgen',      label: 'VGen',      kolom: 'omsetVgen' },
  { key: 'komunitas', label: 'Komunitas', kolom: 'omsetKomunitas' },
  { key: 'others',    label: 'Lainnya',   kolom: 'omsetLainnya' },
]
const SEL_LAPORAN = Object.fromEntries([
  'studioId', 'kurs', 'periodeAwal', 'periodeAkhir', 'totalUsd', 'kasSekarang', 'pengeluaran', 'createdAt',
  ...MARKET.map(m => m.kolom),
].map(k => [k, true]))

const rp = (v) => Math.round(Number(v) || 0)
const sen = (v) => Math.round((Number(v) || 0) * 100) / 100

export function omsetKosong() {
  return { usd: 0, idr: 0, perMarket: MARKET.map(m => ({ key: m.key, label: m.label, usd: 0, idr: 0 })), jumlahLaporan: 0 }
}

/** Omset dari laporan yang sudah disaring → { usd, idr, perMarket, jumlahLaporan }. */
export function omsetDariLaporan(laporan = []) {
  const o = omsetKosong()
  let idrMentah = 0
  const idrMarket = MARKET.map(() => 0)
  for (const r of laporan) {
    const kurs = Number(r.kurs) > 0 ? Number(r.kurs) : 17000
    o.usd += r.totalUsd ?? 0
    idrMentah += (r.totalUsd ?? 0) * kurs
    MARKET.forEach((m, i) => {
      const u = Number(r[m.kolom]) || 0
      o.perMarket[i].usd += u
      idrMarket[i] += u * kurs
    })
  }
  o.usd = sen(o.usd)
  o.idr = Math.round(idrMentah)
  o.perMarket.forEach((m, i) => { m.usd = sen(m.usd); m.idr = Math.round(idrMarket[i]) })
  // Selisih pembulatan ditempel ke market terbesar supaya Σ perMarket.idr === idr.
  const sisa = o.idr - o.perMarket.reduce((a, m) => a + m.idr, 0)
  if (sisa) o.perMarket.reduce((a, m) => (m.idr > a.idr ? m : a)).idr += sisa
  o.jumlahLaporan = laporan.length
  return o
}

/** Jumlahkan angka beberapa unit (ringkasan lingkup / kelompok). */
function jumlahkanUnit(units) {
  const h = {
    kas: { bank: 0, luar: 0, total: 0 }, cpm: 0, tambahan: 0, beban: 0,
    omset: omsetKosong(), menabung: 0, estKasAkhir: 0, kasSekarang: 0, unitDihitung: 0, tanpaData: 0,
  }
  for (const u of units) {
    h.unitDihitung += 1
    if (u.kas == null || !(u.cpm > 0)) h.tanpaData += 1
    if (u.kas) { h.kas.bank += u.kas.bank; h.kas.luar += u.kas.luar; h.kas.total += u.kas.total }
    h.cpm += u.cpm ?? 0
    h.tambahan += u.tambahan
    h.beban += u.beban
    h.omset.usd += u.omset.usd
    h.omset.idr += u.omset.idr
    h.omset.jumlahLaporan += u.omset.jumlahLaporan
    u.omset.perMarket.forEach((m, i) => { h.omset.perMarket[i].usd += m.usd; h.omset.perMarket[i].idr += m.idr })
    h.menabung += u.menabung
    h.kasSekarang += u.kasSekarang ?? 0   // kas rekening (saldo Bio Studio) = angka yang sama dengan Dashboard
  }
  h.omset.usd = sen(h.omset.usd)
  h.omset.perMarket.forEach(m => { m.usd = sen(m.usd) })
  h.estKasAkhir = h.kas.total + h.menabung
  return h
}

function bacaPeriode(q) {
  const now = new Date()
  const bulan = Math.min(12, Math.max(1, parseInt(q.bulan) || now.getMonth() + 1))
  const tahun = Math.min(2100, Math.max(2020, parseInt(q.tahun) || now.getFullYear()))
  return { bulan, tahun }
}

export function geserBulan(bulan, tahun, d) {
  const i = tahun * 12 + (bulan - 1) + d
  return { bulan: (i % 12) + 1, tahun: Math.floor(i / 12) }
}

/** 'ekosistem' | 'circle:<id>' | 'rumah-usaha:<id>' → objek lingkup; null = tidak sah. */
function bacaLingkup(teks) {
  const s = String(teks ?? 'ekosistem')
  if (s === 'ekosistem') return { jenis: 'ekosistem' }
  const m = /^(circle|rumah-usaha):([A-Za-z0-9_-]{1,64})$/.exec(s)
  return m ? { jenis: m[1], id: m[2] } : null
}

/**
 * Hak Monthly Report (16 Okt 2026, keputusan user): HANYA Kepala Circle ke atas. Super Admin / Kepala
 * Ekosistem = semua (termasuk satu ekosistem); Kepala Circle = circle-nya sendiri. Kepala Rumah Usaha,
 * Admin Fungsional, dan peran di bawahnya TIDAK boleh mengunduh Monthly Report.
 * -> 'semua' | Set('circle:<id>')
 */
export function hakLaporanBulanan(roles = []) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return 'semua'
  const hak = new Set()
  for (const r of roles) {
    if (r.roleType === 'KEPALA_CIRCLE' && r.circleId) hak.add(`circle:${r.circleId}`)
  }
  return hak
}

/** Foto profil hanya data URL gambar kecil — URL luar / data raksasa tidak dikirim. */
const fotoAman = (f) => (typeof f === 'string' && f.length <= 400_000 && /^data:image\/(jpeg|png|webp);base64,/.test(f) ? f : null)

/** Anggaran foto per respons (±2,5 MB) — sisanya tampil inisial. */
function hematFoto(daftar, anggaran = 2_500_000) {
  let sisa = anggaran
  for (const o of daftar) {
    if (!o.fotoUrl) continue
    if (o.fotoUrl.length > sisa) o.fotoUrl = null
    else sisa -= o.fotoUrl.length
  }
  return daftar
}

// Korporasi (PT, 8 Nov 2026) dan unit di bawahnya dikelompokkan sebagai satu organisasi "korporasi".
export const organisasiDari = (s) => (s.tipe === 'KORPORASI'
  ? { jenis: 'korporasi', id: s.id, nama: s.nama, slotWarna: null }
  : s.induk
  ? { jenis: 'korporasi', id: s.induk.id, nama: s.induk.nama, slotWarna: null }
  : s.circle
  ? { jenis: 'circle', id: s.circle.id, nama: s.circle.nama, slotWarna: s.circle.colorHex }
  : s.rumahUsaha
    ? { jenis: 'rumah-usaha', id: s.rumahUsaha.id, nama: s.rumahUsaha.nama, slotWarna: s.rumahUsaha.colorHex }
    : null)
const kunciOrg = (o) => (o ? `${o.jenis}:${o.id}` : 'tanpa')

/** GET /api/reports/progres/lingkup — circle/rumah usaha yang boleh dipilih + bawaan. */
export const getLingkupLaporan = async (req, res) => {
  try {
    const [circles, rumah, units] = await Promise.all([
      prisma.circle.findMany({ select: { id: true, nama: true, colorHex: true }, orderBy: { nama: 'asc' } }),
      prisma.rumahUsaha.findMany({ where: { statusAktif: true }, select: { id: true, nama: true, colorHex: true }, orderBy: { nama: 'asc' } }),
      // Studio kolaborasi (angkanya dihitung di circle mitra) tidak masuk Monthly Report sama sekali.
      prisma.studio.findMany({ where: { statusAktif: true, ...STUDIO_DIHITUNG }, select: { circleId: true, rumahUsahaId: true } }),
    ])
    const hitung = (pred) => units.filter(pred).length
    let orgs = [
      ...circles.map(c => ({ kunci: `circle:${c.id}`, jenis: 'circle', id: c.id, nama: c.nama, slotWarna: c.colorHex, unit: hitung(u => u.circleId === c.id) })),
      ...rumah.map(r => ({ kunci: `rumah-usaha:${r.id}`, jenis: 'rumah-usaha', id: r.id, nama: r.nama, slotWarna: r.colorHex, unit: hitung(u => u.rumahUsahaId === r.id) })),
    ]
    const hak = hakLaporanBulanan(req.userRoles ?? [])
    if (hak !== 'semua') orgs = orgs.filter(o => hak.has(o.kunci))
    const lingkup = hak === 'semua'
      ? [{ kunci: 'ekosistem', jenis: 'ekosistem', nama: ECOSYSTEM_NAME_FULL, unit: hitung(() => true) }, ...orgs]
      : orgs
    // Bawaan = organisasi pertama yang dipimpin pemakai (kalau ada), selain itu entri pertama.
    const bawaan = (hak !== 'semua' ? orgs[0]?.kunci : null) ?? lingkup[0]?.kunci ?? null
    return res.json({ success: true, data: { lingkup, bawaan } })
  } catch (e) {
    console.error('[laporanProgres] lingkup gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

/** Rincian pengeluaran satu unit: komponen CPM + pengeluaran tambahan bulan itu. */
function susunRincian({ thp, rutin, shu, tambahan }) {
  const baris = []
  // Gaji TIDAK dirinci per orang: PDF mudah diteruskan, jadi hanya total per unit (keputusan 31 Okt 2026).
  const totalThp = thp.reduce((a, t) => a + rp(t.jumlah), 0)
  if (thp.length && totalThp > 0) baris.push({ kunci: 'thp', kelompok: 'THP', label: `Gaji anggota (${thp.length} orang)`, jumlah: totalThp })
  for (const r of rutin) baris.push({ kunci: `rutin:${r.id}`, kelompok: r.kategori, label: r.nama, jumlah: rp(r.jumlah) })
  if (shu > 0) baris.push({ kunci: 'shu', kelompok: 'SHU', label: 'SHU', jumlah: rp(shu) })
  const t2 = tambahan.map(p => ({ kelompok: 'TAMBAHAN', label: p.nama, jumlah: rp(p.jumlah), tanggal: p.tanggal }))
  const jumlah = (a) => a.reduce((x, b) => x + b.jumlah, 0)
  return { baris, tambahan: t2, totalCpm: jumlah(baris), totalTambahan: jumlah(t2), gajiDirinci: false }
}

/** Rincian bulan yang sudah lewat: dari foto CPM akhir bulan (tidak ikut berubah kalau data anggota berubah). */
function susunRincianFoto(foto, tambahan) {
  const baris = []
  if (foto.totalThp > 0) baris.push({ kunci: 'thp', kelompok: 'THP', label: `Gaji anggota (${foto.jumlahOrang} orang)`, jumlah: rp(foto.totalThp) })
  if (foto.totalPengeluaranRutin > 0) baris.push({ kunci: 'rutin', kelompok: 'LAINNYA', label: 'Pengeluaran rutin', jumlah: rp(foto.totalPengeluaranRutin) })
  if (foto.totalShu > 0) baris.push({ kunci: 'shu', kelompok: 'SHU', label: 'SHU', jumlah: rp(foto.totalShu) })
  const t2 = tambahan.map(p => ({ kelompok: 'TAMBAHAN', label: p.nama, jumlah: rp(p.jumlah), tanggal: p.tanggal }))
  const jumlah = (a) => a.reduce((x, b) => x + b.jumlah, 0)
  return { baris, tambahan: t2, totalCpm: jumlah(baris), totalTambahan: jumlah(t2), gajiDirinci: false }
}

/** GET /api/reports/progres?lingkup=&bulan=&tahun=&rinci=1 */
export const getLaporanProgres = async (req, res) => {
  try {
    const { bulan, tahun } = bacaPeriode(req.query)
    const lingkup = bacaLingkup(req.query.lingkup)
    if (!lingkup) return res.status(422).json({ success: false, message: 'Lingkup laporan tidak dikenal' })
    const hak = hakLaporanBulanan(req.userRoles ?? [])
    const ekosistem = lingkup.jenis === 'ekosistem'
    if (hak !== 'semua' && (ekosistem || !hak.has(`${lingkup.jenis}:${lingkup.id}`))) {
      return res.status(403).json({ success: false, message: 'Monthly Report hanya untuk Kepala Circle (circle-nya sendiri) ke atas' })
    }
    const rinci = req.query.rinci === '1'

    // ── Organisasi lingkup ────────────────────────────────────────────
    let org = null
    if (lingkup.jenis === 'circle') org = await prisma.circle.findUnique({ where: { id: lingkup.id }, select: { id: true, nama: true, colorHex: true } })
    if (lingkup.jenis === 'rumah-usaha') org = await prisma.rumahUsaha.findUnique({ where: { id: lingkup.id }, select: { id: true, nama: true, colorHex: true } })
    if (!ekosistem && !org) return res.status(404).json({ success: false, message: 'Circle / rumah usaha tidak ditemukan' })
    const saringOrg = lingkup.jenis === 'circle' ? { circleId: org.id } : lingkup.jenis === 'rumah-usaha' ? { rumahUsahaId: org.id } : {}

    const studios = await prisma.studio.findMany({
      where: { statusAktif: true, ...STUDIO_DIHITUNG, ...saringOrg },
      select: {
        id: true, nama: true, tipe: true, niche: true, market: true, statusShu: true, totalShu: true,
        circle: { select: { id: true, nama: true, colorHex: true } },
        rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
        induk: { select: { id: true, nama: true } },
      },
      orderBy: { nama: 'asc' },
    })
    const ids = studios.map(s => s.id)

    // ── Rentang: riwayat 7 bulan + snapshot kas sebelum bulan ini ──────
    const deretBulan = Array.from({ length: 7 }, (_, i) => geserBulan(bulan, tahun, i - 6))
    const { rangeStart: awalRiwayat } = getMonthAttributionRange(deretBulan[0].bulan, deretBulan[0].tahun)
    const { rangeStart: awalBulan, rangeEnd: akhirBulan } = getMonthAttributionRange(bulan, tahun)
    const kalenderBulan = { gte: new Date(Date.UTC(tahun, bulan - 1, 1)), lt: new Date(Date.UTC(tahun, bulan, 1)) }

    const syaratTokoh = ekosistem
      ? { roleType: { in: ['KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA'] } }
      : { OR: [
          { roleType: lingkup.jenis === 'circle' ? 'KEPALA_CIRCLE' : 'KEPALA_RUMAH_USAHA', ...saringOrg },
          { roleType: 'KOORDINATOR', studioId: { in: ids } },
        ] }
    const syaratAnggota = ekosistem
      ? { roleType: { in: ROLE_ANGGOTA }, OR: [{ studioId: { in: ids } }, { circleId: { not: null } }, { rumahUsahaId: { not: null } }] }
      : { roleType: { in: ROLE_ANGGOTA }, OR: [{ studioId: { in: ids } }, saringOrg] }

    const [laporan, kasPrevRows, kasLive, notes, cpmMap, tokohRows, anggotaRows, thpRows, rutinRows, itemRows] = await Promise.all([
      ids.length ? prisma.weeklyReport.findMany({ where: { studioId: { in: ids }, periodeAwal: { gte: awalRiwayat, lte: akhirBulan } }, select: SEL_LAPORAN }) : [],
      // Snapshot kas terakhir SEBELUM bulan laporan = kas awal bulan.
      ids.length ? prisma.weeklyReport.findMany({
        where: { studioId: { in: ids }, periodeAwal: { lt: awalBulan } },
        distinct: ['studioId'], orderBy: [{ studioId: 'asc' }, { periodeAwal: 'desc' }],
        select: { studioId: true, kasSekarang: true, periodeAwal: true, periodeAkhir: true },
      }) : [],
      getKasMapForStudios(ids),
      ids.length ? prisma.studioMonthlyNote.findMany({
        where: { studioId: { in: ids }, OR: [{ tahun: { lt: tahun } }, { tahun, bulan: { lte: bulan } }] },
        distinct: ['studioId'], orderBy: [{ studioId: 'asc' }, { tahun: 'desc' }, { bulan: 'desc' }],
        select: { studioId: true, ekuitas: true },
      }) : [],
      getCpmMapForStudiosBulan(ids, bulan, tahun),
      prisma.userRole.findMany({
        where: { OR: [{ roleType: 'DIGNITY' }, { user: { statusAktif: true } }], ...syaratTokoh },
        select: {
          roleType: true,
          studio: { select: { nama: true } },
          circle: { select: { nama: true, colorHex: true } },
          rumahUsaha: { select: { nama: true, colorHex: true } },
          user: { select: { id: true, nama: true, fotoUrl: true } },
        },
      }),
      prisma.user.findMany({
        where: { statusAktif: true, roles: { some: syaratAnggota } },
        select: { id: true, roles: { where: { roleType: { in: ROLE_ANGGOTA } }, select: { roleType: true, studioId: true, circleId: true, rumahUsahaId: true, studio: { select: { circleId: true, rumahUsahaId: true, tipe: true, indukId: true } } } } },
      }),
      rinci && ids.length ? prisma.userRole.findMany({
        where: { studioId: { in: ids }, takeHomePay: { not: null }, user: { statusAktif: true } },
        select: { studioId: true, userId: true, takeHomePay: true, user: { select: { nama: true } } },
      }) : [],
      rinci && ids.length ? prisma.studioPengeluaranRutin.findMany({ where: { studioId: { in: ids } }, orderBy: [{ kategori: 'asc' }, { createdAt: 'asc' }] }) : [],
      rinci && ids.length ? prisma.pengeluaran.findMany({ where: { studioId: { in: ids }, tanggal: kalenderBulan }, orderBy: { tanggal: 'asc' } }) : [],
    ])

    // ── Tim bernama per unit (Tim Kerja / Pemagang / Pendamping) ─────────
    const timRows = ids.length ? await prisma.userRole.findMany({
      where: { studioId: { in: ids }, roleType: { in: [...TIM_UNIT, 'PENDAMPING', 'PENASIHAT'] }, user: { statusAktif: true } },
      select: { studioId: true, roleType: true, user: { select: { id: true, nama: true, posisi: true } } },
    }) : []
    const URUT_TIM = { KOORDINATOR: 0, KADER: 1, KARYAWAN: 2, MAGANG: 3 }
    const timPerUnitRinci = new Map(ids.map(id => [id, { advisor: new Map(), pendamping: new Map(), orang: new Map() }]))
    for (const r of timRows) {
      const t = timPerUnitRinci.get(r.studioId)
      if (!t) continue
      if (r.roleType === 'PENASIHAT') { t.advisor.set(r.user.id, r.user.nama); continue }
      if (r.roleType === 'PENDAMPING') { t.pendamping.set(r.user.id, r.user.nama); continue }
      const ada = t.orang.get(r.user.id)
      if (!ada || URUT_TIM[r.roleType] < URUT_TIM[ada.peran]) t.orang.set(r.user.id, { nama: r.user.nama, posisi: r.user.posisi ?? null, peran: r.roleType })
    }
    const urutNama = (a, b) => (URUT_TIM[a.peran] - URUT_TIM[b.peran]) || a.nama.localeCompare(b.nama, 'id')
    const timRinciDari = (id) => {
      const t = timPerUnitRinci.get(id)
      const orang = [...(t?.orang.values() ?? [])].sort(urutNama)
      return {
        advisor: [...(t?.advisor.values() ?? [])].sort((a, b) => a.localeCompare(b, 'id')),
        pendamping: [...(t?.pendamping.values() ?? [])].sort((a, b) => a.localeCompare(b, 'id')),
        kerja: orang.filter(o => o.peran !== 'MAGANG'),
        magang: orang.filter(o => o.peran === 'MAGANG'),
      }
    }

    // ── Per unit per bulan ────────────────────────────────────────────
    const laporanBulanIni = laporan.filter(r => isReportInMonth(r, bulan, tahun))
    const perUnit = (rows) => {
      const m = new Map(ids.map(id => [id, []]))
      for (const r of rows) m.get(r.studioId)?.push(r)
      return m
    }
    const bulanIniPerUnit = perUnit(laporanBulanIni)
    const riwayatPerUnit = new Map(ids.map(id => [id, []]))
    for (const mo of deretBulan) {
      const m = perUnit(laporan.filter(r => isReportInMonth(r, mo.bulan, mo.tahun)))
      for (const id of ids) {
        const o = omsetDariLaporan(m.get(id))
        riwayatPerUnit.get(id).push({ bulan: mo.bulan, tahun: mo.tahun, usd: o.usd, idr: o.idr })
      }
    }
    const kasAwalBank = Object.fromEntries(kasPrevRows.map(r => [r.studioId, r.kasSekarang]))
    const luarMap = Object.fromEntries(notes.map(n => [n.studioId, n.ekuitas ?? 0]))

    // ── Anggota: per unit (tim) & per organisasi ──────────────────────
    const unitAktif = new Set(ids)
    const timPerUnit = new Map()
    const anggotaPerOrg = new Map()
    const magangPerOrg = new Map()
    // Tim magang = orang yang perannya (di antara peran anggota) HANYA Magang; selebihnya "anggota" (11 Nov 2026).
    const hanyaMagang = (u) => u.roles.length > 0 && u.roles.every(r => r.roleType === 'MAGANG')
    for (const u of anggotaRows) {
      const orgUser = new Set()
      for (const r of u.roles) {
        if (r.studioId) {
          if (!unitAktif.has(r.studioId)) continue
          if (TIM_UNIT.includes(r.roleType)) {
            if (!timPerUnit.has(r.studioId)) timPerUnit.set(r.studioId, new Set())
            timPerUnit.get(r.studioId).add(u.id)
          }
        }
        const cid = r.circleId ?? r.studio?.circleId ?? null
        const rid = r.rumahUsahaId ?? r.studio?.rumahUsahaId ?? null
        if (cid) orgUser.add(`circle:${cid}`)
        if (rid) orgUser.add(`rumah-usaha:${rid}`)
        const kid = r.studio?.tipe === 'KORPORASI' ? r.studioId : r.studio?.indukId
        if (kid) orgUser.add(`korporasi:${kid}`)
      }
      for (const k of orgUser) {
        anggotaPerOrg.set(k, (anggotaPerOrg.get(k) ?? 0) + 1)
        if (hanyaMagang(u)) magangPerOrg.set(k, (magangPerOrg.get(k) ?? 0) + 1)
      }
    }

    // ── Leader & Key Person (satu kartu per orang, peran tertinggi) ────
    const URUT = { KEPALA_EKOSISTEM: 1, KEPALA_CIRCLE: 2, KEPALA_RUMAH_USAHA: 2, KOORDINATOR: 6 }
    const LABEL = { KEPALA_EKOSISTEM: 'Kepala Ekosistem', KEPALA_CIRCLE: 'Kepala Circle', KEPALA_RUMAH_USAHA: 'Kepala Rumah Usaha', KOORDINATOR: 'Koordinator' }
    const perOrang = new Map()
    for (const r of tokohRows) {
      const orgR = r.circle ?? r.rumahUsaha ?? null
      const label = r.roleType === 'KOORDINATOR' && r.studio?.nama ? `Koordinator · ${r.studio.nama}`
        : ekosistem && orgR ? `${LABEL[r.roleType]} · ${orgR.nama}` : LABEL[r.roleType]
      const t = { userId: r.user.id, nama: r.user.nama, fotoUrl: fotoAman(r.user.fotoUrl), label, urut: URUT[r.roleType] ?? 9 }
      const ada = perOrang.get(r.user.id)
      if (!ada || t.urut < ada.urut) perOrang.set(r.user.id, t)
    }
    const tokoh = hematFoto([...perOrang.values()]
      .sort((a, b) => (a.urut - b.urut) || a.label.localeCompare(b.label, 'id') || a.nama.localeCompare(b.nama, 'id'))
      .map(({ urut, ...t }) => t))

    // ── Unit ──────────────────────────────────────────────────────────
    const kini = new Date()
    const bulanBerjalan = bulan === kini.getMonth() + 1 && tahun === kini.getFullYear()
    // Kas = saldo Bio Studio terkini (sama dengan Dashboard) untuk bulan berjalan DAN bulan sebelumnya
    // (bulan yang baru ditutup masih dilaporkan di awal bulan berikutnya); bulan yang lebih lama = snapshot laporan.
    const bulanLalu = new Date(kini.getFullYear(), kini.getMonth() - 1, 1)
    const pakaiKasLive = bulanBerjalan || (bulan === bulanLalu.getMonth() + 1 && tahun === bulanLalu.getFullYear())
    const units = studios.map(s => {
      const reps = bulanIniPerUnit.get(s.id) ?? []
      const omset = omsetDariLaporan(reps)
      const bank = rp(kasAwalBank[s.id] ?? kasLive[s.id] ?? 0)
      const luar = rp(luarMap[s.id] ?? 0)
      const cpm = rp(cpmMap[s.id]?.totalCpm ?? 0)
      const tambahan = rp(reps.reduce((a, r) => a + (r.pengeluaran ?? 0), 0))
      const beban = cpm + tambahan
      const menabung = omset.idr - beban
      // Kas Sekarang (tabel Omset & Kas Studio/Project): bulan berjalan = saldo Rekening Bank
      // terkini; bulan lampau = snapshot kas laporan TERAKHIR di bulan itu (utils/kas.js).
      const terakhir = reps.reduce((a, r) => (!a || r.periodeAwal > a.periodeAwal ? r : a), null)
      const kasSekarang = rp(pakaiKasLive || !terakhir ? (kasLive[s.id] ?? 0) : terakhir.kasSekarang)
      const hasil = {
        kasSekarang,
        id: s.id, nama: s.nama, tipe: s.tipe, niche: s.niche ?? null, market: s.market ?? null,
        bidangUsaha: null, jenisUsaha: null, kategoriPasar: null,
        organisasi: organisasiDari(s), logoUrl: null,
        sah: false, sumber: reps.length ? 'laporan' : 'kosong',
        kas: { bank, luar, total: bank + luar },
        kasAkhir: bank + luar + menabung,
        cpm, tambahan, beban,
        omset: { ...omset, akunPerMarket: {} },
        menabung,
        tim: timPerUnit.get(s.id)?.size ?? 0,
        timRinci: timRinciDari(s.id),
        riwayat: riwayatPerUnit.get(s.id) ?? [],
      }
      if (rinci) {
        const items = itemRows.filter(p => p.studioId === s.id)
        // Laporan bulan ini yang punya total pengeluaran tapi belum ada itemnya (data lama) →
        // satu baris per laporan, supaya rincian tetap = total yang dipakai di atas.
        const tanpaItem = reps.filter(r => (r.pengeluaran ?? 0) > 0 && !items.some(p => p.tanggal >= r.periodeAwal && p.tanggal <= r.periodeAkhir))
          .map(r => ({ nama: `Pengeluaran ${r.periodeAwal.toISOString().slice(5, 10).split('-').reverse().join('/')} (tanpa rincian)`, jumlah: r.pengeluaran, tanggal: r.periodeAwal }))
        const thp = thpRows.filter(t => t.studioId === s.id).map(t => ({ userId: t.userId, nama: t.user?.nama ?? 'Anggota', jumlah: t.takeHomePay }))
        const shu = s.statusShu ? (s.totalShu ?? 0) : 0
        const foto = cpmMap[s.id]?.tersimpan ? cpmMap[s.id] : null
        hasil.rincian = foto
          ? susunRincianFoto(foto, [...items, ...tanpaItem])
          : susunRincian({ thp, rutin: rutinRows.filter(r => r.studioId === s.id), shu, tambahan: [...items, ...tanpaItem] })
      }
      return hasil
    })
      // Unit yang baru didaftarkan & belum berjalan (tanpa omset/riwayat omset, pengeluaran, tim, dan kas) tidak
      // ikut laporan sama sekali — bukan sekadar halamannya yang disembunyikan; jumlah unit pun tidak menghitungnya.
      .filter(u => (u.omset.jumlahLaporan ?? 0) > 0 || u.beban > 0 || u.tim > 0 || u.kas.total > 0 || u.kasAkhir !== 0
        || (u.riwayat ?? []).some(r => (r.usd ?? 0) > 0 || (r.idr ?? 0) > 0))

    // ── Ringkasan lingkup & per organisasi ────────────────────────────
    const ringkasUnit = (daftar, anggota, magang = 0) => ({
      ...jumlahkanUnit(daftar),
      unitUsaha: { studio: daftar.filter(u => u.tipe === 'STUDIO').length, project: daftar.filter(u => u.tipe === 'PROJECT').length, korporasi: daftar.filter(u => u.tipe === 'KORPORASI').length, total: daftar.length },
      posRumah: 0, sah: 0, anggota, magang,
    })
    const ringkas = { ...ringkasUnit(units, anggotaRows.length, anggotaRows.filter(hanyaMagang).length), pengesahan: { sah: 0, total: units.length } }

    // Angka utama Executive Summary (ekosistem) -- sama dengan Monthly Report manual:
    // Ekuitas Usaha = kas + dana di luar kas. Ekuitas Ekosistem = SAMA dengan Dashboard (getMonthlySummary):
    // Ekuitas Usaha + Dana PE + Dana Forum + Dana Berkah + Dana Circle + Dana Rumah Usaha, lalu + Dana Pengembangan.
    if (ekosistem) {
      const kasUsaha = units.reduce((a, u) => a + u.kasSekarang, 0)
      const luarKas = units.reduce((a, u) => a + u.kas.luar, 0)
      const [dataBulan, dpUnits, dpPool, laporanDanaOrg] = await Promise.all([
        // Bulan ini belum diisi → data terakhir sebelumnya, sama seperti Dashboard (getMonthlySummary).
        prisma.monthlyEcosystemData.findFirst({
          where: { OR: [{ tahun: { lt: tahun } }, { tahun, bulan: { lte: bulan } }] },
          orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }], select: { danaPE: true, danaForum: true, danaBerkah: true, bulan: true, tahun: true },
        }),
        prisma.danaPengembanganUnit.findMany({
          select: { modalAwalUsd: true, laporan: { where: { periodeAwal: { lte: akhirBulan } }, orderBy: { periodeAwal: 'desc' }, take: 1, select: { equityUsd: true } } },
        }),
        prisma.danaPengembanganPool.findFirst({ select: { kurs: true } }),
        // Dana Circle / Rumah Usaha = laporan dana TERAKHIR dalam bulan itu (sama dengan Dashboard).
        prisma.orgFundReport.findMany({
          where: { periodeAwal: { gte: new Date(tahun, bulan - 1, 1), lte: new Date(tahun, bulan, 0, 23, 59, 59) } },
          orderBy: { periodeAwal: 'asc' }, select: { circleId: true, rumahUsahaId: true, dana: true },
        }),
      ])
      const terakhirCircle = {}, terakhirRumah = {}
      for (const r of laporanDanaOrg) {
        if (r.circleId) terakhirCircle[r.circleId] = r.dana
        if (r.rumahUsahaId) terakhirRumah[r.rumahUsahaId] = r.dana
      }
      const danaCircle = rp(Object.values(terakhirCircle).reduce((a, v) => a + v, 0))
      const danaRumahUsaha = rp(Object.values(terakhirRumah).reduce((a, v) => a + v, 0))
      const danaForum = rp(dataBulan?.danaForum ?? 0)
      const danaBerkah = rp(dataBulan?.danaBerkah ?? 0)
      const dpUsd = dpUnits.reduce((a, u) => a + (u.laporan[0]?.equityUsd ?? u.modalAwalUsd), 0)
      const danaPengembangan = rp(dpUsd * (dpPool?.kurs ?? 17000))
      const danaPE = rp(dataBulan?.danaPE ?? 0)
      const ekuitasUsaha = kasUsaha + luarKas
      ringkas.eksekutif = {
        kasUsaha, ekuitasUsaha, cpm: ringkas.cpm ?? units.reduce((a, u) => a + u.cpm, 0),
        danaPengembangan, danaPE, danaForum, danaBerkah, danaCircle, danaRumahUsaha,
        ekuitasEkosistem: ekuitasUsaha + danaPE + danaForum + danaBerkah + danaCircle + danaRumahUsaha + danaPengembangan,
        danaPEDari: dataBulan && !(dataBulan.bulan === bulan && dataBulan.tahun === tahun) ? { bulan: dataBulan.bulan, tahun: dataBulan.tahun } : null,
      }
    }

    let kelompok = []
    if (ekosistem) {
      const peta = new Map()
      for (const u of units) {
        const k = kunciOrg(u.organisasi)
        if (!peta.has(k)) peta.set(k, { kunci: k, org: u.organisasi, unit: [] })
        peta.get(k).unit.push(u)
      }
      kelompok = [...peta.values()]
        .sort((a, b) => String(a.org?.nama ?? '~').localeCompare(String(b.org?.nama ?? '~'), 'id'))
        .map(g => ({
          kunci: g.kunci, jenis: g.org?.jenis ?? null, id: g.org?.id ?? null,
          nama: g.org?.nama ?? 'Tanpa Circle', slotWarna: g.org?.slotWarna ?? null,
          unitIds: g.unit.map(u => u.id),
          ...ringkasUnit(g.unit, anggotaPerOrg.get(g.kunci) ?? 0, magangPerOrg.get(g.kunci) ?? 0),
        }))
    }

    const logoUrl = org ? await ambilLogo(lingkup.jenis, org.id) : null
    const now = new Date()
    return res.json({
      success: true,
      data: {
        bulan, tahun, labelBulan: `${NAMA_BULAN[bulan - 1]} ${tahun}`,
        berjalan: bulan === now.getMonth() + 1 && tahun === now.getFullYear(),
        lingkup: ekosistem
          ? { kunci: 'ekosistem', jenis: 'ekosistem', nama: ECOSYSTEM_NAME_FULL, slotWarna: 1 }
          : { kunci: `${lingkup.jenis}:${org.id}`, jenis: lingkup.jenis, id: org.id, nama: org.nama, slotWarna: org.colorHex, logoUrl, situs: null },
        deretBulan: deretBulan.map(m => ({ ...m, label: NAMA_BULAN[m.bulan - 1] })),
        ringkas, tokoh, kelompok, units,
        jumlahUnitUsaha: units.length,
        rinci,
        rincianGaji: rinci ? false : null,
      },
    })
  } catch (e) {
    console.error('[laporanProgres] laporan gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
