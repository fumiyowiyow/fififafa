import prisma from '../prisma.js'
import { STAFF_PLUS, hasAnyRole, kelolaStudio } from '../utils/roles.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { LAPORAN_DIHITUNG } from '../utils/kolaborasi.js'
import { getMonthAttributionRange, isReportInMonth } from '../utils/week.js'
import { getCpmMapForStudios } from '../utils/cpm.js'
import { targetUnitRows } from '../utils/targetDb.js'
import { ROLE_DINILAI } from '../utils/penilaianKader.js'
import { peranKerja, studioBolehDilihat, pengelolaAtauPemilikBaca, permintaanBaca, pemilikDiManaPun } from './circle.js'
import { jenisNormal } from '../utils/alur.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'
import { statusPace, statusOmzet, statusKoleksi, statusOtd, statusRevisi, statusSdm, statusBeban, bebanOrderBulan, ketepatanDeadline, tingkatRevisi, keterlambatan, siklus, radarSdm, r1, r2 } from '../utils/kaizen.js'

// SKOR EKSEKUTIF & KAIZEN web circle (20 Okt 2026) — adaptasi OGS ExecutiveScorecardService, PaceComputerService, KaizenAnalyticsService,
// KaizenActionController. Cakupan = unit dalam wewenang pemanggil di circle/rumah usaha alamat ini. Omset diambil dari LAPORAN OMSET Ekosistem
// (WeeklyReport; studio kolaborasi tidak dihitung), BUKAN dari order (tidak ada omset otomatis). Koordinator/Pendamping ke atas.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
// Wewenang PER UNIT (21 Okt 2026): unit dihitung hanya bila pemanggil Koordinator/Pendamping unit itu ke atas.
const pelapor = (req) => hasAnyRole(peranKerja(req), STAFF_PLUS)
const atasan = (req, studioId) => kelolaStudio(peranKerja(req), studioId) // target unit: Koordinator unit ke atas (CEO unit, 21 Okt 2026)
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'
const bulanOk = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(b ?? '')
const sekarangWIB = () => new Date(Date.now() + 7 * 3600000)
const ymSekarang = () => sekarangWIB().toISOString().slice(0, 7)
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const angka = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN }

/** Unit dalam wewenang di circle ini (opsional dipersempit ke satu unit). Mengembalikan null + menulis 403 bila tak sah. */
async function lingkup(req, res) {
  // pemilik unit: hanya BACA (tindakan Kaizen tidak bisa dibuat/diubah lewat status pemilik)
  if (!pelapor(req) && !(permintaanBaca(req) && (await pemilikDiManaPun(req)))) { gagal(res, 403, 'Hanya Koordinator/Pendamping ke atas'); return null }
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  const where = whereLingkup(web.lingkup)
  const semua = await prisma.studio.findMany({ where: { ...where, statusAktif: true }, select: { id: true, nama: true, hitungDiEkosistem: true }, orderBy: { nama: 'asc' } })
  const dalam = []
  for (const s of semua) if ((await studioBolehDilihat(req, s.id)) && (await pengelolaAtauPemilikBaca(req, s.id))) dalam.push(s)
  const { studioId } = req.query
  const unit = studioId ? dalam.filter(s => s.id === studioId) : dalam
  if (studioId && !unit.length) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  return { unit, ids: unit.map(s => s.id), nama: new Map(unit.map(s => [s.id, s.nama])), web }
}
const muatOrders = async (ids, extra = {}) => {
  const orders = ids.length ? await prisma.orderProduksi.findMany({ where: { studioId: { in: ids }, status: { not: 'BATAL' }, ...extra }, select: { id: true, studioId: true, judul: true, klien: true, status: true, subStatus: true, deadline: true, tanggalMasuk: true, tanggalSelesai: true, revisiKe: true, tahap: { select: { nama: true, jenis: true } } } }) : []
  const riw = orders.length ? await prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: orders.map(o => o.id) } }, orderBy: { mulai: 'asc' }, select: { orderId: true, namaTahap: true, jenis: true, mulai: true, selesai: true } }) : []
  const peta = new Map(); for (const r of riw) { if (!peta.has(r.orderId)) peta.set(r.orderId, []); peta.get(r.orderId).push(r) }
  return orders.map(o => { const riwayat = peta.get(o.id) ?? []; const jenisSaatIni = jenisNormal(o.tahap?.jenis ?? (o.status === 'SELESAI' ? 'SELESAI' : o.status === 'MASUK' ? 'MASUK' : 'KERJA')); return { ...o, riwayat, jenisSaatIni, tahapNama: o.tahap?.nama ?? o.subStatus, terkirim: o.status === 'SELESAI' || riwayat.some(r => ['DELIVERY', 'SELESAI'].includes(jenisNormal(r.jenis))) } })
}
const awalAkhirBulan = (ym) => { const [a] = [new Date(ym + '-01T00:00:00Z')]; const b = new Date(a); b.setUTCMonth(b.getUTCMonth() + 1); return [new Date(a.getTime() - 7 * 3600000), new Date(b.getTime() - 7 * 3600000 - 1)] }

// Omset (USD & Rp) per unit dari laporan omset Ekosistem, diatribusikan ke bulan lewat aturan Ekosistem (isReportInMonth)
async function omsetBulan(ids, bulan, tahun) {
  if (!ids.length) return new Map()
  const { rangeStart, rangeEnd } = getMonthAttributionRange(bulan, tahun)
  const lap = (await prisma.weeklyReport.findMany({ where: { studioId: { in: ids }, periodeAwal: { gte: rangeStart, lte: rangeEnd }, ...LAPORAN_DIHITUNG }, select: { studioId: true, totalUsd: true, kurs: true, periodeAwal: true, periodeAkhir: true } })).filter(r => isReportInMonth(r, bulan, tahun))
  const m = new Map(); for (const r of lap) { const e = m.get(r.studioId) ?? { usd: 0, idr: 0 }; e.usd += r.totalUsd; e.idr += r.totalUsd * r.kurs; m.set(r.studioId, e) }
  return m
}

export const getEksekutif = wrap(async (req, res) => {
  const ym = req.query.bulan ?? ymSekarang()
  if (!bulanOk(ym)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const L = await lingkup(req, res); if (!L) return
  const [tahun, bulan] = ym.split('-').map(Number)
  const [awal, akhir] = awalAkhirBulan(ym)
  const sekarang = new Date(), berjalan = ym === ymSekarang()
  const refDay = berjalan ? sekarangWIB().getUTCDate() : new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const hariDalamBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const hitung = L.unit.filter(s => s.hitungDiEkosistem).map(s => s.id)

  // Omzet vs target (niat)
  const [omset, targetRows] = await Promise.all([omsetBulan(hitung, bulan, tahun), targetUnitRows(hitung, tahun, bulan)])
  const aktualUsd = r2([...omset.values()].reduce((a, x) => a + x.usd, 0)), aktualIdr = Math.round([...omset.values()].reduce((a, x) => a + x.idr, 0))
  const targetUsd = r2(targetRows.reduce((a, t) => a + t.targetUsd, 0))
  const pace = statusPace({ aktual: aktualUsd, target: targetUsd, hariKe: refDay, hariDalamBulan, bulanBerjalan: berjalan })
  const omzet = { aktualUsd, aktualIdr, targetUsd, adaTarget: targetUsd > 0, ...pace, status: statusOmzet(pace.status, targetUsd > 0), paceStatus: pace.status, unit: L.unit.map(s => ({ studioId: s.id, nama: s.nama, aktualUsd: r2(omset.get(s.id)?.usd ?? 0), targetUsd: targetRows.find(t => t.studioId === s.id)?.targetUsd ?? null, dihitung: s.hitungDiEkosistem })) }

  // Koleksi: termin diterima bulan ini vs yang masih jatuh tempo bulan ini
  const [diterima, belum] = await Promise.all([
    prisma.terminBayarOrder.aggregate({ where: { dibayarPada: { gte: new Date(ym + '-01T00:00:00Z'), lt: new Date(new Date(ym + '-01T00:00:00Z').setUTCMonth(bulan)) }, order: { studioId: { in: L.ids } } }, _sum: { jumlah: true } }),
    prisma.terminBayarOrder.aggregate({ where: { dibayarPada: null, jatuhTempo: { gte: new Date(ym + '-01T00:00:00Z'), lt: new Date(new Date(ym + '-01T00:00:00Z').setUTCMonth(bulan)) }, order: { studioId: { in: L.ids }, status: { not: 'BATAL' } } }, _sum: { jumlah: true } }),
  ])
  const cashIn = diterima._sum.jumlah ?? 0, piutang = belum._sum.jumlah ?? 0
  const koleksi = { diterima: cashIn, piutang, persen: cashIn + piutang > 0 ? r1((cashIn / (cashIn + piutang)) * 100) : null, status: statusKoleksi(cashIn, piutang) }

  // Beban order, ketepatan, revisi (bulan laporan)
  const orders = await muatOrders(L.ids)
  const beban = bebanOrderBulan({ orders, awalBulan: awal, akhirBulan: akhir })
  const terbuka = beban.in + beban.wip + beban.delivery
  const otd = ketepatanDeadline({ orders, dari: awal, sampai: akhir, hariIni: sekarang })
  const revisi = tingkatRevisi({ orders, dari: awal, sampai: akhir })

  // SDM: Penilaian Kader di unit-unit ini (skala 1–5 → 10)
  const pengguna = await prisma.userRole.findMany({ where: { studioId: { in: L.ids }, roleType: { in: ROLE_DINILAI } }, select: { userId: true } })
  const penilaian = pengguna.length ? await prisma.penilaianKader.findMany({ where: { userId: { in: [...new Set(pengguna.map(p => p.userId))] }, tanggalPenilaian: { gte: awal, lte: akhir } } }) : []
  const sdm = radarSdm(penilaian)

  const kartu = [
    { kunci: 'omzet', label: 'Omset bulan ini', status: omzet.status, nilai: `$${aktualUsd.toLocaleString('en-US')}`, petunjuk: omzet.adaTarget ? `${pace.progressPct}% dari target $${targetUsd.toLocaleString('en-US')}` : 'Target belum diisi' },
    { kunci: 'koleksi', label: 'Penagihan', status: koleksi.status, nilai: koleksi.persen == null ? '—' : `${koleksi.persen}%`, petunjuk: `diterima Rp ${Math.round(cashIn).toLocaleString('id-ID')} · jatuh tempo belum dibayar Rp ${Math.round(piutang).toLocaleString('id-ID')}` },
    { kunci: 'beban', label: 'Beban order', status: statusBeban({ total: beban.total, carryOver: beban.carryOver, wip: beban.wip, terbuka }), nilai: String(beban.total), petunjuk: `${beban.carryOver} terbawa · ${beban.baru} baru` },
    { kunci: 'otd', label: 'Ketepatan deadline', status: statusOtd(otd.rate), nilai: otd.rate == null ? '—' : `${otd.rate}%`, petunjuk: `${otd.terkirim}/${otd.rencana} terkirim · ${otd.telat} telat` },
    { kunci: 'revisi', label: 'Tingkat revisi', status: statusRevisi(revisi.rate), nilai: revisi.rate == null ? '—' : `${revisi.rate}%`, petunjuk: `${revisi.denganRevisi}/${revisi.selesai} order selesai pernah direvisi` },
    { kunci: 'sdm', label: 'Skor SDM', status: statusSdm(sdm.rata), nilai: sdm.rata == null ? '—' : String(sdm.rata), petunjuk: `${sdm.jumlahPenilaian} penilaian bulan ini (skala 10)` },
  ]
  return res.json({ success: true, data: { bulan: ym, berjalan, cakupan: L.unit.map(s => ({ id: s.id, nama: s.nama })), kartu, omzet, koleksi, beban: { ...beban, terbuka }, otd, revisi, sdm, bisaAturTarget: pelapor(req) } })
})

export const getOmzetTahun = wrap(async (req, res) => {
  const tahun = Number(req.query.tahun) || sekarangWIB().getUTCFullYear()
  if (!(tahun >= 2024 && tahun <= 2100)) return gagal(res, 422, 'tahun tidak valid')
  const L = await lingkup(req, res); if (!L) return
  const hitung = L.unit.filter(s => s.hitungDiEkosistem).map(s => s.id)
  const cpm = await getCpmMapForStudios(hitung)
  const baseline = Math.round(hitung.reduce((a, id) => a + (cpm[id]?.totalCpm ?? 0), 0))
  const bulanData = []
  const perUnit = new Map(hitung.map(id => [id, Array(12).fill(0)]))
  const targetRows = await targetUnitRows(hitung, tahun)
  for (let b = 1; b <= 12; b++) {
    const m = await omsetBulan(hitung, b, tahun)
    let usd = 0, idr = 0
    for (const [id, v] of m) { usd += v.usd; idr += v.idr; perUnit.get(id)[b - 1] = r2(v.usd) }
    bulanData.push({ bulan: b, usd: r2(usd), idr: Math.round(idr), targetUsd: r2(targetRows.filter(t => t.bulan === b).reduce((a, t) => a + t.targetUsd, 0)) })
  }
  const total = r2(bulanData.reduce((a, b) => a + b.usd, 0))
  return res.json({ success: true, data: { tahun, bulan: bulanData, totalUsd: total, cpmBaselineRp: baseline, unit: [...perUnit.entries()].map(([id, v]) => ({ studioId: id, nama: L.nama.get(id), bulanan: v, totalUsd: r2(v.reduce((a, x) => a + x, 0)) })).sort((a, b) => b.totalUsd - a.totalUsd), catatan: 'Sumber: Laporan Omset Ekosistem (studio kolaborasi tidak dihitung). Garis dasar = CPM otomatis per bulan.' } })
})

export const getSiklus = wrap(async (req, res) => {
  const L = await lingkup(req, res); if (!L) return
  const orders = await muatOrders(L.ids)
  const minSampel = Math.min(20, Math.max(1, Number(req.query.minSampel) || 3))
  return res.json({ success: true, data: siklus({ orders, namaUnit: L.nama, minSampel }) })
})
export const getKeterlambatan = wrap(async (req, res) => {
  const L = await lingkup(req, res); if (!L) return
  const d = keterlambatan({ orders: await muatOrders(L.ids), hariIni: new Date() })
  return res.json({ success: true, data: { ...d, daftar: d.daftar.slice(0, 100).map(x => ({ ...x, unit: L.nama.get(x.studioId) })) } })
})
export const getKetepatan = wrap(async (req, res) => {
  const L = await lingkup(req, res); if (!L) return
  const bulanMundur = Math.min(12, Math.max(1, Number(req.query.bulan) || 6))
  const sekarang = new Date(), dari = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - (bulanMundur - 1), 1))
  const d = ketepatanDeadline({ orders: await muatOrders(L.ids), dari, sampai: new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() + 1, 0, 23, 59, 59)), hariIni: sekarang })
  return res.json({ success: true, data: { ...d, bulanMundur, perUnit: d.perUnit.map(u => ({ ...u, unit: L.nama.get(u.studioId) })).sort((a, b) => b.rencana - a.rencana) } })
})

// ── Target omset (niat) per unit per bulan ───────────────────────────────────────────────────────────────────────────────
export const getTarget = wrap(async (req, res) => {
  const tahun = Number(req.query.tahun) || sekarangWIB().getUTCFullYear(), bulan = Number(req.query.bulan) || sekarangWIB().getUTCMonth() + 1
  if (!(bulan >= 1 && bulan <= 12 && tahun >= 2024 && tahun <= 2100)) return gagal(res, 422, 'bulan/tahun tidak valid')
  const L = await lingkup(req, res); if (!L) return
  const rows = await targetUnitRows(L.ids, tahun, bulan)
  return res.json({ success: true, data: { tahun, bulan, bisaUbah: pelapor(req), unit: L.unit.map(s => ({ studioId: s.id, nama: s.nama, dihitung: s.hitungDiEkosistem, targetUsd: rows.find(r => r.studioId === s.id)?.targetUsd ?? null, dariAkun: !!rows.find(r => r.studioId === s.id)?.dariAkun })) } })
})
export const simpanTarget = wrap(async (req, res) => {
  const { studioId, tahun, bulan } = req.body ?? {}
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  if (!(await atasan(req, studioId))) return gagal(res, 403, 'Target hanya diatur Koordinator unit ini ke atas')
  if (!(Number.isInteger(bulan) && bulan >= 1 && bulan <= 12 && Number.isInteger(tahun) && tahun >= 2024 && tahun <= 2100)) return gagal(res, 422, 'bulan/tahun tidak valid')
  const t = angka(req.body.targetUsd); if (!(t >= 0)) return gagal(res, 422, 'Target tidak boleh negatif')
  const oleh = await namaPengguna(req)
  if (t === 0) await prisma.targetOmsetUnit.deleteMany({ where: { studioId, tahun, bulan } })
  else await prisma.targetOmsetUnit.upsert({ where: { studioId_tahun_bulan: { studioId, tahun, bulan } }, update: { targetUsd: t, diubahOleh: oleh }, create: { studioId, tahun, bulan, targetUsd: t, diubahOleh: oleh } })
  return res.json({ success: true, message: t === 0 ? 'Target dihapus' : 'Target disimpan' })
})

// ── Tindakan Kaizen (OGS KaizenAction) ───────────────────────────────────────────────────────────────────────────────────
const STATUS = ['BARU', 'PROSES', 'SELESAI', 'BATAL'], PRIORITAS = ['RENDAH', 'SEDANG', 'TINGGI']
const rapiTindakan = (t) => ({ id: t.id, judul: t.judul, deskripsi: t.deskripsi, sumberTab: t.sumberTab, snapshot: t.snapshot, pemilikId: t.pemilikId, dibuatOleh: t.dibuatOleh, jatuhTempo: ISO(t.jatuhTempo), status: t.status, prioritas: t.prioritas, selesaiPada: t.selesaiPada, catatanHasil: t.catatanHasil, dibuat: t.createdAt })
export const getTindakan = wrap(async (req, res) => {
  const L = await lingkup(req, res); if (!L) return
  const { status } = req.query
  const where = { lingkupJenis: L.web.lingkup.jenis, lingkupId: L.web.lingkup.id, ...(STATUS.includes(status) ? { status } : {}) }
  const [daftar, jumlah, anggota] = await Promise.all([prisma.kaizenTindakan.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }), prisma.kaizenTindakan.groupBy({ by: ['status'], where: { lingkupJenis: L.web.lingkup.jenis, lingkupId: L.web.lingkup.id }, _count: true }), prisma.userRole.findMany({ where: { studioId: { in: L.ids }, user: { statusAktif: true }, roleType: { not: 'DIGNITY' } }, select: { user: { select: { id: true, nama: true } } } })])
  const nama = new Map(anggota.map(a => [a.user.id, a.user.nama]))
  const hariIni = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const n = (s) => jumlah.find(j => j.status === s)?._count ?? 0
  return res.json({ success: true, data: { tindakan: daftar.map(t => ({ ...rapiTindakan(t), pemilik: t.pemilikId ? nama.get(t.pemilikId) ?? '—' : null, terlambat: ['BARU', 'PROSES'].includes(t.status) && t.jatuhTempo && t.jatuhTempo < hariIni })), ringkasan: { baru: n('BARU'), proses: n('PROSES'), selesai: n('SELESAI'), terlambat: daftar.filter(t => ['BARU', 'PROSES'].includes(t.status) && t.jatuhTempo && t.jatuhTempo < hariIni).length }, anggota: [...nama.entries()].map(([id, nm]) => ({ id, nama: nm })) } })
})
export const buatTindakan = wrap(async (req, res) => {
  const L = await lingkup(req, res); if (!L) return
  const judul = String(req.body?.judul ?? '').trim(); if (!judul || judul.length > 200) return gagal(res, 422, 'Judul wajib diisi (maks 200 huruf)')
  const prioritas = req.body.prioritas ?? 'SEDANG'; if (!PRIORITAS.includes(prioritas)) return gagal(res, 422, `prioritas harus ${PRIORITAS.join(', ')}`)
  let jatuhTempo = null; if (req.body.jatuhTempo) { jatuhTempo = new Date(req.body.jatuhTempo + 'T00:00:00Z'); if (isNaN(jatuhTempo)) return gagal(res, 422, 'jatuhTempo harus YYYY-MM-DD') }
  const t = await prisma.kaizenTindakan.create({ data: { lingkupJenis: L.web.lingkup.jenis, lingkupId: L.web.lingkup.id, judul, deskripsi: req.body.deskripsi ? String(req.body.deskripsi).slice(0, 2000) : null, sumberTab: req.body.sumberTab ? String(req.body.sumberTab).slice(0, 40) : null, snapshot: req.body.snapshot && typeof req.body.snapshot === 'object' ? req.body.snapshot : undefined, pemilikId: req.body.pemilikId || null, dibuatOlehId: req.user.id, dibuatOleh: await namaPengguna(req), jatuhTempo, prioritas } })
  return res.status(201).json({ success: true, data: rapiTindakan(t) })
})
export const ubahTindakan = wrap(async (req, res) => {
  const L = await lingkup(req, res); if (!L) return
  const t = await prisma.kaizenTindakan.findUnique({ where: { id: req.params.id } })
  if (!t || t.lingkupJenis !== L.web.lingkup.jenis || t.lingkupId !== L.web.lingkup.id) return gagal(res, 404, 'Tindakan tidak ditemukan')
  const data = {}
  if (req.body.judul !== undefined) { const j = String(req.body.judul).trim(); if (!j || j.length > 200) return gagal(res, 422, 'Judul wajib diisi (maks 200 huruf)'); data.judul = j }
  if (req.body.deskripsi !== undefined) data.deskripsi = req.body.deskripsi ? String(req.body.deskripsi).slice(0, 2000) : null
  if (req.body.pemilikId !== undefined) data.pemilikId = req.body.pemilikId || null
  if (req.body.jatuhTempo !== undefined) { if (!req.body.jatuhTempo) data.jatuhTempo = null; else { const d = new Date(req.body.jatuhTempo + 'T00:00:00Z'); if (isNaN(d)) return gagal(res, 422, 'jatuhTempo harus YYYY-MM-DD'); data.jatuhTempo = d } }
  if (req.body.prioritas !== undefined) { if (!PRIORITAS.includes(req.body.prioritas)) return gagal(res, 422, `prioritas harus ${PRIORITAS.join(', ')}`); data.prioritas = req.body.prioritas }
  if (req.body.catatanHasil !== undefined) data.catatanHasil = req.body.catatanHasil ? String(req.body.catatanHasil).slice(0, 2000) : null
  if (req.body.status !== undefined) { if (!STATUS.includes(req.body.status)) return gagal(res, 422, `status harus ${STATUS.join(', ')}`); data.status = req.body.status; if (req.body.status === 'SELESAI' && t.status !== 'SELESAI') data.selesaiPada = new Date(); if (req.body.status !== 'SELESAI') data.selesaiPada = null }
  return res.json({ success: true, data: rapiTindakan(await prisma.kaizenTindakan.update({ where: { id: t.id }, data })) })
})
