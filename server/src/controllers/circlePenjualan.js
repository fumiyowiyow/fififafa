import prisma from '../prisma.js'
import { resolveWeb, whereLingkup } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, peranKerja } from './circle.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'
import { hariIniWIB } from '../utils/kehadiran.js'
import { kelolaStudio, atasanLingkup } from '../utils/roles.js'
import { bersihUsd, kursRata, KURS_BAWAAN } from '../utils/uang.js'
import { periodeBulan, rincianPeriode, statusPeriode } from '../utils/penjualan.js'
import { targetUnitRows } from '../utils/targetDb.js'
import { barisBelumDibayar } from './circleOps.js'

// PENJUALAN / SALES DASHBOARD web circle (21 Okt 2026) — adaptasi OGS FinanceDashboardController + StudioTargetService + AccountTargetService.
// Omzet = nilai BERSIH order (tanggal masuk, bukan BATAL) dalam USD (order USD: kurs ordernya; order Rupiah: rata-rata kurs laporan mingguan bulan itu).
// Target (niat) diisi per AKUN; target unit = jumlah target akunnya (atau target unit langsung bila akun belum punya). Manajer melihat semua akun;
// marketer hanya akun yang ditugaskan padanya.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const r2 = (n) => Math.round(n * 100) / 100
const atasan = (req, studioId) => kelolaStudio(peranKerja(req), studioId) // target per akun: Koordinator unit ke atas (CEO unit, 21 Okt 2026)
// Penjualan = omzet akun (gabungan order semua orang) → HANYA Koordinator ke atas unit itu. Marketer talent tidak melihat omzet (keputusan user 21 Okt 2026).
async function akses(req, res, studioId) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!p.manajer) { gagal(res, 403, 'Penjualan hanya untuk Koordinator ke atas unit ini'); return null }
  return p
}
const wibAwal = (s) => new Date(s + 'T00:00:00+07:00')
const parse = (q) => { const sekarang = hariIniWIB(); const tahun = Number(q.tahun) || Number(sekarang.slice(0, 4)), bulan = Number(q.bulan) || Number(sekarang.slice(5, 7)); return { tahun, bulan } }
const tahunOk = (t, b) => Number.isInteger(t) && t >= 2024 && t <= 2100 && Number.isInteger(b) && b >= 1 && b <= 12

export const getPenjualan = wrap(async (req, res) => {
  const { studioId } = req.query, { tahun, bulan } = parse(req.query)
  const p = await akses(req, res, studioId); if (!p) return
  if (!tahunOk(tahun, bulan)) return gagal(res, 422, 'bulan/tahun tidak valid')
  const hari = hariIniWIB()
  const akunSemua = await prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true, namaAkun: true, platform: true }, orderBy: { namaAkun: 'asc' } })
  const dapat = p.akunAdmin ? new Set(akunSemua.map(a => a.id).filter(id => p.akunAdmin.includes(id))) : p.manajer ? new Set(akunSemua.map(a => a.id)) : new Set((await prisma.penugasanAkunMarketer.findMany({ where: { userId: req.user.id, akun: { studioId } }, select: { akunId: true } })).map(x => x.akunId))
  const akun = akunSemua.filter(a => dapat.has(a.id))
  const [orders, lap, tAkun, tUnit] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, akunId: { in: [...dapat] }, tanggalMasuk: { gte: wibAwal(`${tahun}-01-01`), lt: wibAwal(`${tahun + 1}-01-01`) } }, select: { akunId: true, tanggalMasuk: true, nilaiBersih: true, nilaiKotor: true, mataUang: true, kurs: true } }),
    prisma.weeklyReport.findMany({ where: { studioId, periodeAwal: { gte: wibAwal(`${tahun}-01-01`), lt: wibAwal(`${tahun + 1}-01-01`) } }, select: { periodeAwal: true, kurs: true } }),
    prisma.targetOmsetAkun.findMany({ where: { akunId: { in: akunSemua.map(a => a.id) }, tahun } }),
    targetUnitRows([studioId], tahun),
  ])
  const kursBulan = Array.from({ length: 12 }, (_, i) => kursRata(lap.filter(l => Number(kunciTanggalWIB(l.periodeAwal).slice(5, 7)) === i + 1).map(l => l.kurs)))
  const bulanDari = (o) => Number(kunciTanggalWIB(o.tanggalMasuk).slice(5, 7))
  const usd = (o) => bersihUsd(o, kursBulan[bulanDari(o) - 1] ?? KURS_BAWAAN)
  const targetAkunBulan = (akunId, b) => tAkun.find(t => t.akunId === akunId && t.bulan === b)?.targetUsd ?? 0
  const targetUnitBulan = (b) => p.manajer ? (tUnit.find(t => t.bulan === b)?.targetUsd ?? 0) : r2(akun.reduce((a, x) => a + targetAkunBulan(x.id, b), 0))
  const dalamBulan = orders.filter(o => bulanDari(o) === bulan)
  const aktualPerTanggal = new Map(); for (const o of dalamBulan) { const t = kunciTanggalWIB(o.tanggalMasuk); aktualPerTanggal.set(t, (aktualPerTanggal.get(t) ?? 0) + usd(o)) }
  const targetBulan = targetUnitBulan(bulan)
  const periode = rincianPeriode({ periode: periodeBulan(tahun, bulan), targetBulan, aktualPerTanggal, hariIni: hari })
  const rowAkun = akun.map(a => { const l = dalamBulan.filter(o => o.akunId === a.id), akt = r2(l.reduce((s, o) => s + usd(o), 0)), tg = targetAkunBulan(a.id, bulan); return { akunId: a.id, nama: a.namaAkun, platform: a.platform, order: l.length, aktualUsd: akt, targetUsd: tg || null, persen: tg > 0 ? Math.round((akt / tg) * 1000) / 10 : null } }).sort((x, y) => y.aktualUsd - x.aktualUsd)
  const tahunan = Array.from({ length: 12 }, (_, i) => { const b = i + 1, akt = r2(orders.filter(o => bulanDari(o) === b).reduce((s, o) => s + usd(o), 0)), tg = targetUnitBulan(b); return { bulan: b, aktualUsd: akt, targetUsd: tg || null, persen: tg > 0 ? Math.round((akt / tg) * 1000) / 10 : null, masaDepan: `${tahun}-${String(b).padStart(2, '0')}` > hari.slice(0, 7) } })
  const aktualBulan = r2(dalamBulan.reduce((s, o) => s + usd(o), 0))
  return res.json({ success: true, data: { studioId, tahun, bulan, kursBawaan: kursBulan[bulan - 1], lihatSemua: p.manajer, total: { aktualUsd: aktualBulan, targetUsd: targetBulan || null, persen: targetBulan > 0 ? Math.round((aktualBulan / targetBulan) * 1000) / 10 : null, order: dalamBulan.length }, periode, akun: rowAkun, tahunan, catatan: 'Omset = nilai bersih order (tanggal masuk) dalam USD; order Rupiah dikonversi dengan rata-rata kurs laporan mingguan bulan itu.' } })
})

export const getTargetAkun = wrap(async (req, res) => {
  const { studioId } = req.query, { tahun, bulan } = parse(req.query)
  const p = await akses(req, res, studioId); if (!p) return
  if (!p.manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  if (!tahunOk(tahun, bulan)) return gagal(res, 422, 'bulan/tahun tidak valid')
  const akunList = await prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true, namaAkun: true, platform: true }, orderBy: { namaAkun: 'asc' } }), akunIds = akunList.map(a => a.id)
  const [akun, rows, unit] = await Promise.all([Promise.resolve(akunList), prisma.targetOmsetAkun.findMany({ where: { akunId: { in: akunIds }, tahun, bulan } }), targetUnitRows([studioId], tahun, bulan)])
  return res.json({ success: true, data: { tahun, bulan, bisaUbah: await atasan(req, studioId), targetUnit: unit[0]?.targetUsd ?? null, targetUnitDariAkun: !!unit[0]?.dariAkun, akun: akun.map(a => ({ akunId: a.id, nama: a.namaAkun, platform: a.platform, targetUsd: rows.find(r => r.akunId === a.id)?.targetUsd ?? null })) } })
})
export const simpanTargetAkun = wrap(async (req, res) => {
  const { akunId, tahun, bulan } = req.body ?? {}
  const a = await prisma.akunProduksi.findUnique({ where: { id: akunId ?? '' } })
  if (!a || !(await studioBolehDilihat(req, a.studioId))) return gagal(res, 403, 'Akun bukan dalam wewenangmu')
  if (!(await atasan(req, a.studioId))) return gagal(res, 403, 'Target hanya diatur Koordinator unit ini ke atas')
  if (!tahunOk(tahun, bulan)) return gagal(res, 422, 'bulan/tahun tidak valid')
  const t = Number(req.body.targetUsd); if (!Number.isFinite(t) || t < 0) return gagal(res, 422, 'Target tidak boleh negatif')
  const oleh = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'
  if (t === 0) await prisma.targetOmsetAkun.deleteMany({ where: { akunId, tahun, bulan } })
  else await prisma.targetOmsetAkun.upsert({ where: { akunId_tahun_bulan: { akunId, tahun, bulan } }, update: { targetUsd: t, diubahOleh: oleh }, create: { akunId, tahun, bulan, targetUsd: t, diubahOleh: oleh } })
  return res.json({ success: true, message: t === 0 ? 'Target akun dihapus' : 'Target akun disimpan' })
})

// Dashboard Manajemen (adaptasi OGS ManagementController): leaderboard unit berdasarkan pace omzet vs target + piutang (outstanding) seluruh unit.
// Kepala Circle ke atas; hanya unit dalam wewenang.
// PERINGKAT TARGET unit (pace omset order vs target, USD) — SATU rumus untuk Manajemen (web circle) & halaman Web Circle di Management Dashboard (14 Nov 2026).
// `unit` = [{ id, nama, hitungDiEkosistem }] yang SUDAH disaring wewenangnya oleh pemanggil.
export async function papanTarget(unit, tahun, bulan) {
  const hari = hariIniWIB(), berjalan = hari.slice(0, 7) === `${tahun}-${String(bulan).padStart(2, '0')}`
  const ids = unit.map(u => u.id)
  const awal = wibAwal(`${tahun}-${String(bulan).padStart(2, '0')}-01`), akhir = new Date(awal); akhir.setUTCMonth(akhir.getUTCMonth() + 1)
  const [orders, lap, targets] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { studioId: { in: ids }, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir } }, select: { studioId: true, nilaiBersih: true, nilaiKotor: true, mataUang: true, kurs: true } }),
    prisma.weeklyReport.findMany({ where: { studioId: { in: ids }, periodeAwal: { gte: awal, lt: akhir } }, select: { studioId: true, kurs: true } }),
    targetUnitRows(ids, tahun, bulan),
  ])
  const hariKe = berjalan ? Number(hari.slice(8)) : new Date(Date.UTC(tahun, bulan, 0)).getUTCDate(), hariBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const papan = unit.map(u => {
    const kurs = kursRata(lap.filter(l => l.studioId === u.id).map(l => l.kurs))
    const akt = r2(orders.filter(o => o.studioId === u.id).reduce((a, o) => a + bersihUsd(o, kurs), 0)), tg = targets.find(t => t.studioId === u.id)?.targetUsd ?? 0
    const persen = tg > 0 ? Math.round((akt / tg) * 1000) / 10 : null
    return { studioId: u.id, nama: u.nama, dihitung: u.hitungDiEkosistem, aktualUsd: akt, targetUsd: tg || null, persen, harapanPersen: berjalan ? Math.round((hariKe / hariBulan) * 1000) / 10 : 100, status: statusPeriode({ aktual: akt, efektif: tg, berjalan, hariKe, hari: hariBulan }) }
  }).sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1) || b.aktualUsd - a.aktualUsd)
  return { berjalan, papan }
}

export const getManajemen = wrap(async (req, res) => {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') return gagal(res, 403, 'Hanya untuk web circle')
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) return gagal(res, 403, 'Token bukan untuk alamat ini')
  if (!atasanLingkup(peranKerja(req), web.lingkup)) return gagal(res, 403, 'Hanya Kepala Circle ke atas')
  const { tahun, bulan } = parse(req.query)
  if (!tahunOk(tahun, bulan)) return gagal(res, 422, 'bulan/tahun tidak valid')
  const kunci = whereLingkup(web.lingkup)
  const semua = await prisma.studio.findMany({ where: { ...kunci, statusAktif: true }, select: { id: true, nama: true, hitungDiEkosistem: true } })
  const unit = []; for (const s of semua) if (await studioBolehDilihat(req, s.id)) unit.push(s)
  // Piutang = definisi Belum dibayar klien (14 Nov 2026, keputusan: satu arti piutang di semua layar): project yang SUDAH Delivery/Done & belum
  // lunas. Order yang masih dikerjakan tidak masuk daftar, tetapi jumlahnya tetap dikirim (masihDikerjakan) agar informasinya tidak hilang.
  const [{ berjalan, papan }, perUnit] = await Promise.all([papanTarget(unit, tahun, bulan), Promise.all(unit.map(async u => (await barisBelumDibayar(u.id)).map(b => ({ ...b, unit: u.nama }))))])
  const semuaBelum = perUnit.flat()
  const piutang = semuaBelum.filter(b => b.sudahDelivery).map(b => ({ orderId: b.id, unit: b.unit, judul: b.judul, klien: b.klien, nilaiBersih: b.nilaiBersih, dibayar: b.dibayar, sisa: b.sisa, umurHari: b.umurHari, kelompok: b.kelompok, sudahDitagih: b.sudahDitagih }))
  const dikerjakan = semuaBelum.filter(b => !b.sudahDelivery)
  const masihDikerjakan = { jumlah: dikerjakan.length, total: r2(dikerjakan.reduce((a, b) => a + b.sisa, 0)) }
  const aging = {}; for (const b of piutang) { aging[b.kelompok] ??= { jumlah: 0, total: 0 }; aging[b.kelompok].jumlah++; aging[b.kelompok].total = r2(aging[b.kelompok].total + b.sisa) }
  const hitungPapan = papan.filter(p => p.dihitung)
  return res.json({ success: true, data: { tahun, bulan, berjalan, papan, total: { aktualUsd: r2(hitungPapan.reduce((a, p) => a + p.aktualUsd, 0)), targetUsd: r2(hitungPapan.reduce((a, p) => a + (p.targetUsd ?? 0), 0)) || null }, piutang: { total: r2(piutang.reduce((a, b) => a + b.sisa, 0)), aging, masihDikerjakan, baris: piutang.sort((a, b) => b.sisa - a.sisa) }, catatan: 'Total hanya menjumlahkan unit yang dihitung di ekosistem (studio kolaborasi dikecualikan).' } })
})

// KURS BAWAAN FORM (13 Nov 2026, masukan tim — keputusan user: SATU sumber kurs): form USD (Tambah order, Prospek, Jadikan order,
// Ubah order, Laporan Mingguan) memakai kurs Laporan Mingguan TERBARU unit itu — yang diisi koordinator tiap minggu di menu Keuangan.
// Tidak ada pengaturan kurs terpisah (agar tidak ada dua angka kurs). Belum pernah lapor → KURS_BAWAAN. Kurs per order tetap bisa diganti.
export const getKurs = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!studioId || !(await studioBolehDilihat(req, studioId))) return res.status(403).json({ success: false, message: 'Bukan unit dalam wewenangmu' })
    const p = await peranStudio(req, studioId)
    if (!p.manajer && !p.marketer) return res.status(403).json({ success: false, message: 'Kurs hanya untuk pengelola & marketer unit' })
    const l = await prisma.weeklyReport.findFirst({ where: { studioId, kurs: { gt: 0 } }, orderBy: { periodeAwal: 'desc' }, select: { kurs: true, periodeAwal: true } })
    return res.json({ success: true, data: { kurs: l?.kurs ?? KURS_BAWAAN, dari: l ? 'laporan' : 'bawaan', periode: l ? kunciTanggalWIB(l.periodeAwal) : null } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal membaca kurs' })
  }
}
