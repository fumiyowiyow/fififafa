import prisma from '../prisma.js'
import { resolveWeb } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, saringAkun } from './circle.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'
import { KATALOG, TAHAP_AKTIVITAS } from '../utils/marketing.js'
import * as X from '../utils/tambahanOgs.js'
import { masihDiUnit } from '../utils/fungsi.js'

// Timeline order, Jenis Order, laporan harian marketer, checklist setoran (21 Okt 2026) — adaptasi OGS. Tidak menulis ke keuangan Ekosistem.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const dt = (s) => new Date(s + 'T00:00:00.000Z')
const tglOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(dt(s))
const hariIni = () => kunciTanggalWIB(new Date())
async function akses(req, res, studioId, { semua = true } = {}) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (semua && !(p.manajer || p.marketer)) { gagal(res, 403, 'Hanya Koordinator ke atas atau Marketer unit ini'); return null }
  return p
}

// Marketer unit = berfungsi MARKETER di unit ∪ ditugaskan ke akun jualan unit — hanya yang aktif & MASIH berperan di unit itu (masihDiUnit)
async function daftarMarketer(studioId) {
  const [fungsi, tugas] = await Promise.all([
    prisma.fungsiAnggota.findMany({ where: { studioId, fungsi: 'MARKETER', user: masihDiUnit(studioId) }, select: { user: { select: { id: true, nama: true } } } }),
    prisma.penugasanAkunMarketer.findMany({ where: { akun: { studioId }, user: masihDiUnit(studioId) }, select: { user: { select: { id: true, nama: true } } } }),
  ])
  return [...new Map([...fungsi, ...tugas].map(x => [x.user.id, { id: x.user.id, nama: x.user.nama }])).values()]
}

// ── Timeline ──────────────────────────────────────────────────────────────────────────────────────
export const getTimeline = wrap(async (req, res) => {
  const { studioId, status = 'aktif', q } = req.query
  const p = await akses(req, res, studioId, { semua: false }); if (!p) return
  const lihatSemua = p.manajer || p.marketer
  const sekarang = new Date(), hari = hariIni()
  const where = { studioId, ...(status === 'aktif' ? { status: { in: ['MASUK', 'PROSES'] } } : status === 'selesai' ? { status: 'SELESAI', tanggalSelesai: { gte: new Date(sekarang.getTime() - 30 * 86400000) } } : { status: { not: 'BATAL' } }), ...(q?.trim() ? { OR: [{ judul: { contains: q.trim(), mode: 'insensitive' } }, { klien: { contains: q.trim(), mode: 'insensitive' } }] } : {}), ...(lihatSemua ? {} : { OR: [{ penugasanTahap: { some: { userId: req.user.id } } }, { assignments: { some: { userId: req.user.id, berhentiPada: null } } }] }), ...saringAkun(p) }
  const orders = await prisma.orderProduksi.findMany({ where, take: 300, include: { riwayatTahap: { select: { jenis: true, mulai: true, selesai: true } }, penugasanTahap: { where: { status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, select: { userId: true } }, assignments: { where: { berhentiPada: null }, select: { userId: true } } } })
  const ids = [...new Set(orders.flatMap(o => [...o.penugasanTahap, ...o.assignments].map(x => x.userId)))]
  const nama = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
  const baris = orders.map(o => {
    const penanggung = [...new Set([...o.penugasanTahap, ...o.assignments].map(x => nama.get(x.userId)).filter(Boolean))]
    const t = X.barisTimeline({ o, riwayat: o.riwayatTahap, penanggung, hariIni: hari, sekarang, kunci: kunciTanggalWIB })
    return { id: o.id, judul: o.judul, klien: o.klien, tahap: o.subStatus, kategori: o.kategori, status: o.status, selesai: o.status === 'SELESAI', mulai: kunciTanggalWIB(o.tanggalMasuk), deadline: o.deadline ? kunciTanggalWIB(o.deadline) : null, penanggung, ...t }
  }).sort(X.urutTimeline)
  return res.json({ success: true, data: { hariIni: hari, kpi: X.kpiTimeline(baris), baris } })
})

// ── Jenis Order ───────────────────────────────────────────────────────────────────────────────────
export const getJenisOrder = wrap(async (req, res) => {
  const { studioId } = req.query, view = req.query.view === 'bulan' ? 'bulan' : 'minggu', tanggal = req.query.tanggal ?? hariIni()
  const p = await akses(req, res, studioId); if (!p) return
  if (!tglOk(tanggal)) return gagal(res, 422, 'tanggal harus YYYY-MM-DD')
  const r = X.rentangPeriode(view, tanggal)
  const [orders, akun] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, ...saringAkun(p), tanggalMasuk: { gte: new Date(r.dari + 'T00:00:00+07:00'), lt: new Date(new Date(r.sampai + 'T00:00:00+07:00').getTime() + 86400000) } }, select: { akunId: true, kategori: true } }),
    prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true, platform: true, namaAkun: true } }),
  ])
  return res.json({ success: true, data: { view, ...r, ...X.hitungJenisOrder(orders, new Map(akun.map(a => [a.id, a]))) } })
})

// ── Laporan harian marketer ──────────────────────────────────────────────────────────────────────
export const getLaporanHarian = wrap(async (req, res) => {
  const { studioId } = req.query, tanggal = req.query.tanggal ?? hariIni()
  const p = await akses(req, res, studioId); if (!p) return
  if (!tglOk(tanggal)) return gagal(res, 422, 'tanggal harus YYYY-MM-DD')
  const uniq = await daftarMarketer(studioId)
  const aktivitas = await prisma.aktivitasMarketer.findMany({ where: { studioId, tanggal: dt(tanggal), userId: { in: uniq.map(u => u.id) } }, select: { userId: true, jenis: true, jumlah: true, selesai: true } })
  return res.json({ success: true, data: { tanggal, teks: X.susunLaporanHarian({ tanggal, marketer: uniq, aktivitas, katalog: KATALOG, tahapLabel: TAHAP_AKTIVITAS }) } })
})

// ── Setoran marketer BEBAS WAKTU (10 Nov 2026) ───────────────────────────────────────────────────────
// Marketer mencatat tiap kali menyetor pemasukan akun jualan ke kas studio — kapan saja (bukan lagi periode tetap tanggal 11/24 dan tanpa checklist
// "belum setor" otomatis). Koordinator/Admin Market melihat semua + ringkasan per marketer (total & terakhir setor) dan boleh mencatatkan untuk marketer.
const HARI_SETORAN = 86400000
export const getSetoran = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const bulan = req.query.bulan
  if (bulan && !/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  // Tanpa bulan: 90 hari terakhir s/d hari ini WIB. Batas dihitung dari tanggal WIB (bukan Date.now()), karena kolom
  // `tanggal` bertipe DATE dan Prisma memotong batas ke tanggal UTC: dulu pukul 00.00–07.00 WIB setoran hari ini hilang dari daftar.
  const awal = bulan ? dt(bulan + '-01') : new Date(dt(hariIni()).getTime() - 90 * HARI_SETORAN)
  const akhir = bulan ? new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5)), 1)) : new Date(dt(hariIni()).getTime() + HARI_SETORAN)
  const milik = p.manajer ? {} : { marketerId: req.user.id }
  const baris = await prisma.setoranMarketer.findMany({ where: { studioId, tanggal: { gte: awal, lt: akhir }, ...milik }, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 300 })
  const marketer = await daftarMarketer(studioId)
  const nama = new Map(marketer.map(m => [m.id, m.nama]))
  for (const u of await prisma.user.findMany({ where: { id: { in: [...new Set(baris.map(b => b.marketerId))].filter(id => !nama.has(id)) } }, select: { id: true, nama: true } })) nama.set(u.id, u.nama)
  // ringkasan per marketer: seluruh riwayat terakhir (bukan hanya bulan terpilih) supaya "terakhir setor" selalu benar
  const terakhir = await prisma.setoranMarketer.groupBy({ by: ['marketerId'], where: { studioId, ...milik }, _max: { tanggal: true } })
  const lastMap = new Map(terakhir.map(t => [t.marketerId, t._max.tanggal]))
  const ringkas = (p.manajer ? marketer : marketer.filter(m => m.id === req.user.id)).map(m => {
    const l = baris.filter(b => b.marketerId === m.id)
    const last = lastMap.get(m.id)
    return { marketerId: m.id, marketer: m.nama, kali: l.length, total: l.reduce((a, b) => a + (b.jumlah ?? 0), 0), terakhir: last ? last.toISOString().slice(0, 10) : null, hariLalu: last ? Math.floor((Date.parse(hariIni() + 'T00:00:00Z') - last.getTime()) / HARI_SETORAN) : null, milikSaya: m.id === req.user.id }
  })
  const transfer = p.manajer ? await prisma.transferPendapatan.findMany({ where: { studioId, tanggal: { gte: new Date(Date.now() - 120 * HARI_SETORAN) } }, orderBy: { tanggal: 'desc' }, select: { id: true, tanggal: true, jumlah: true } }) : []
  return res.json({ success: true, data: {
    hariIni: hariIni(), bulan: bulan ?? null, bisaKelola: p.manajer, bisaCatat: p.manajer ? true : marketer.some(m => m.id === req.user.id),
    marketer: p.manajer ? marketer.map(m => ({ id: m.id, nama: m.nama })) : [], ringkasan: ringkas,
    transfer: transfer.map(t => ({ id: t.id, tanggal: t.tanggal.toISOString().slice(0, 10), jumlah: t.jumlah })),
    baris: baris.map(b => ({ id: b.id, tanggal: b.tanggal.toISOString().slice(0, 10), marketerId: b.marketerId, marketer: nama.get(b.marketerId) ?? '—', jumlah: b.jumlah, catatan: b.catatan, transferId: b.transferId, dicatatOleh: b.dicatatOleh, milikSaya: b.marketerId === req.user.id })),
  } })
})
export const catatSetoran = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  const p = await akses(req, res, studioId); if (!p) return
  const b = req.body ?? {}
  const marketerId = b.marketerId && p.manajer ? String(b.marketerId) : req.user.id
  const marketer = await daftarMarketer(studioId)
  if (!marketer.some(m => m.id === marketerId)) return gagal(res, 422, marketerId === req.user.id ? 'Kamu bukan marketer unit ini' : 'Orang itu bukan marketer unit ini')
  const tanggal = b.tanggal ? dt(String(b.tanggal)) : dt(hariIni())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.tanggal ?? hariIni())) || isNaN(tanggal)) return gagal(res, 422, 'tanggal harus YYYY-MM-DD')
  if (tanggal.getTime() > Date.parse(hariIni() + 'T00:00:00Z')) return gagal(res, 422, 'Tanggal setoran tidak boleh di masa depan')
  if (tanggal.getTime() < Date.now() - 120 * HARI_SETORAN) return gagal(res, 422, 'Tanggal setoran terlalu lama (maks 120 hari ke belakang)')
  let jumlah = null
  if (b.jumlah != null && b.jumlah !== '') { jumlah = Number(b.jumlah); if (!Number.isFinite(jumlah) || jumlah < 0 || jumlah > 100000000000) return gagal(res, 422, 'Jumlah harus angka ≥ 0 (Rp)'); jumlah = Math.round(jumlah) }
  if (b.transferId && !(await prisma.transferPendapatan.findFirst({ where: { id: String(b.transferId), studioId } }))) return gagal(res, 422, 'Transfer bukan milik unit ini')
  const catatan = b.catatan ? String(b.catatan).trim().slice(0, 500) || null : null
  const pencatat = marketerId !== req.user.id ? (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Koordinator' : null
  const s = await prisma.setoranMarketer.create({ data: { studioId, marketerId, tanggal, jumlah, transferId: b.transferId ? String(b.transferId) : null, catatan, dicatatOleh: pencatat } })
  return res.status(201).json({ success: true, data: { id: s.id }, message: 'Setoran dicatat' })
})
export const hapusSetoran = wrap(async (req, res) => {
  const s = await prisma.setoranMarketer.findUnique({ where: { id: req.params.id } })
  if (!s) return gagal(res, 404, 'Setoran tidak ditemukan')
  const p = await akses(req, res, s.studioId); if (!p) return
  const miliknya = s.marketerId === req.user.id && Date.now() - s.createdAt.getTime() < 7 * HARI_SETORAN
  if (!p.manajer && !miliknya) return gagal(res, 403, 'Hanya pencatatnya (maks 7 hari) atau Koordinator yang bisa menghapus')
  await prisma.setoranMarketer.delete({ where: { id: s.id } })
  return res.json({ success: true, message: 'Catatan setoran dihapus' })
})
