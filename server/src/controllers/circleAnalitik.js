import prisma from '../prisma.js'
import { jadwalUnit } from '../utils/jamKerjaUnit.js'
import { SUPER_ADMIN, hasAnyRole } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat, peranStudio, saringAkun } from './circle.js'
import { kunciTanggalWIB } from '../utils/jamKerja.js'
import { susunNadi, susunKinerja, susunRevisi, susunTren } from '../utils/analitik.js'

// ANALITIK web circle (20 Okt 2026): adaptasi OGS (papan nadi, kinerja per orang, laporan revisi, tren) di atas data
// order + riwayat tahap Ekosistem. Tanpa angka uang. Manajer (Koordinator ke atas) per unit; anggota hanya miliknya sendiri.
const gagal = (res, status, message) => res.status(status).json({ success: false, message })
const HARI = 86400000

async function manajer(req, res) {
  const { studioId } = req.query
  if (!(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return false }
  const p = await peranStudio(req, studioId)
  if (!p.manajer) { gagal(res, 403, 'Analitik hanya untuk Koordinator ke atas'); return false }
  req._saringAkun = saringAkun(p) // admin per akun jualan: analitik hanya order akunnya
  return true
}
const tanggal = (v, cadangan) => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : cadangan }
const SELECT_ORDER = {
  id: true, judul: true, klien: true, status: true, tanggalMasuk: true, tanggalSelesai: true, deadline: true, revisiKe: true,
  tahap: { select: { nama: true, jenis: true } },
  assignments: { where: { userId: { not: null }, berhentiPada: null }, select: { user: { select: { id: true, nama: true } } } },
}
async function muatRiwayat(orders) {
  const baris = orders.length ? await prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: orders.map(o => o.id) } }, orderBy: { mulai: 'asc' } }) : []
  const peta = new Map()
  for (const r of baris) { if (!peta.has(r.orderId)) peta.set(r.orderId, []); peta.get(r.orderId).push(r) }
  return peta
}
async function muatPenugasan(orders) {
  const baris = orders.length ? await prisma.penugasanTahap.findMany({ where: { orderId: { in: orders.map(o => o.id) } } }) : []
  const peta = new Map()
  for (const b of baris) { if (!peta.has(b.orderId)) peta.set(b.orderId, []); peta.get(b.orderId).push(b) }
  const ids = [...new Set(baris.map(b => b.userId))]
  const nama = new Map((ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nama: true } }) : []).map(u => [u.id, u.nama]))
  return { penugasanByOrder: peta, namaPengguna: nama }
}
async function muatLibur(dari, sampai) {
  const baris = await prisma.hariLiburKerja.findMany({ where: { jenis: 'LIBUR', tanggal: { gte: new Date(dari.getTime() - 2 * HARI), lte: new Date(sampai.getTime() + 2 * HARI) } }, select: { tanggal: true } })
  return new Set(baris.map(b => b.tanggal.toISOString().slice(0, 10)))
}
const OPEN = ['MASUK', 'PROSES']
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }

// KONDISI HARI INI satu unit — SATU rumus untuk Analitik › Kondisi hari ini (web circle) & halaman Web Circle di Management Dashboard (14 Nov 2026)
export async function nadiStudio(studioId, saring = {}, sekarang = new Date()) {
  const awal = new Date(kunciTanggalWIB(sekarang) + 'T00:00:00+07:00')
  const orders = await prisma.orderProduksi.findMany({ where: { studioId, ...saring, OR: [{ status: { in: OPEN } }, { updatedAt: { gte: awal } }] }, select: SELECT_ORDER })
  return susunNadi({ orders, riwayatByOrder: await muatRiwayat(orders), ...(await muatPenugasan(orders)), sekarang, libur: await muatLibur(new Date(sekarang.getTime() - 30 * HARI), sekarang), jadwal: await jadwalUnit(studioId) }) // jam kerja bersih menurut jadwal unit (16 Nov 2026)
}
export const getNadi = wrap(async (req, res) => {
  if (!(await manajer(req, res))) return
  const sekarang = new Date()
  const data = await nadiStudio(req.query.studioId, req._saringAkun, sekarang)
  return res.json({ success: true, data: { ...data, perJam: sekarang.toISOString() } })
})

const kinerjaStudio = async (studioId, dari, sampai, saring = {}) => {
  const sekarang = new Date()
  const orders = await prisma.orderProduksi.findMany({ where: { studioId, ...saring, OR: [{ status: { in: OPEN } }, { updatedAt: { gte: new Date(dari.getTime() - HARI) } }] }, select: SELECT_ORDER })
  return susunKinerja({ orders, riwayatByOrder: await muatRiwayat(orders), ...(await muatPenugasan(orders)), dari, sampai, sekarang, libur: await muatLibur(dari, sampai), jadwal: await jadwalUnit(studioId) })
}
export const getKinerja = wrap(async (req, res) => {
  if (!(await manajer(req, res))) return
  const sampai = tanggal(req.query.sampai, new Date()), dari = tanggal(req.query.dari, new Date(sampai.getTime() - 30 * HARI))
  return res.json({ success: true, data: await kinerjaStudio(req.query.studioId, dari, sampai, req._saringAkun) })
})
// Anggota biasa: hanya barisnya sendiri (tanpa data orang lain, tanpa uang)
export const getKinerjaSaya = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  const sampai = tanggal(req.query.sampai, new Date()), dari = tanggal(req.query.dari, new Date(sampai.getTime() - 30 * HARI))
  const k = await kinerjaStudio(studioId, dari, sampai)
  return res.json({ success: true, data: { dari: k.dari, sampai: k.sampai, saya: k.orang.find(o => o.userId === req.user.id) ?? null } })
})

export const getRevisi = wrap(async (req, res) => {
  if (!(await manajer(req, res))) return
  const sekarang = new Date()
  const sampai = tanggal(req.query.sampai, sekarang), dari = tanggal(req.query.dari, new Date(sampai.getTime() - 180 * HARI))
  const orders = await prisma.orderProduksi.findMany({ where: { studioId: req.query.studioId, status: { not: 'BATAL' }, ...req._saringAkun, tanggalMasuk: { gte: dari, lte: sampai } }, select: SELECT_ORDER })
  return res.json({ success: true, data: { dari: dari.toISOString(), sampai: sampai.toISOString(), ...susunRevisi({ orders, riwayatByOrder: await muatRiwayat(orders), sekarang }) } })
})

export const getTren = wrap(async (req, res) => {
  if (!(await manajer(req, res))) return
  const grain = req.query.grain === 'bulan' ? 'bulan' : 'minggu'
  const sekarang = new Date()
  const dari = new Date(sekarang.getTime() - (grain === 'bulan' ? 400 : 100) * HARI)
  const orders = await prisma.orderProduksi.findMany({ where: { studioId: req.query.studioId, status: { not: 'BATAL' }, ...req._saringAkun, OR: [{ tanggalMasuk: { gte: dari } }, { tanggalSelesai: { gte: dari } }] }, select: { tanggalMasuk: true, tanggalSelesai: true, revisiKe: true } })
  return res.json({ success: true, data: susunTren({ orders, grain, jumlah: 12, sekarang }) })
})

// ── Kalender kerja: hari libur (dasar jam kerja bersih) ─────────────────────────────────────────────────────────────────
export const getLibur = wrap(async (req, res) => {
  const tahun = Number(req.query.tahun) || new Date().getFullYear()
  const baris = await prisma.hariLiburKerja.findMany({ where: { tanggal: { gte: new Date(Date.UTC(tahun, 0, 1)), lt: new Date(Date.UTC(tahun + 1, 0, 1)) } }, orderBy: { tanggal: 'asc' } })
  return res.json({ success: true, data: { tahun, libur: baris.map(b => ({ id: b.id, tanggal: b.tanggal.toISOString().slice(0, 10), nama: b.nama, jenis: b.jenis, catatan: b.catatan })), bisaUbah: hasAnyRole(peranKerja(req), SUPER_ADMIN) } })
})
export const tambahLibur = wrap(async (req, res) => {
  if (!hasAnyRole(peranKerja(req), SUPER_ADMIN)) return gagal(res, 403, 'Hanya Super Admin yang mengatur hari libur')
  const { tanggal: t, nama } = req.body ?? {}
  const jenis = req.body?.jenis ?? 'LIBUR'
  if (!['LIBUR', 'WFA', 'LAINNYA'].includes(jenis)) return gagal(res, 422, 'jenis harus LIBUR, WFA, atau LAINNYA')
  if (jenis === 'LAINNYA' && !String(req.body?.catatan ?? '').trim()) return gagal(res, 422, 'Catatan wajib untuk jenis LAINNYA')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t ?? '') || isNaN(new Date(t))) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (!String(nama ?? '').trim() || String(nama).length > 80) return gagal(res, 422, 'Nama libur wajib diisi (maks 80 huruf)')
  const tgl = new Date(t + 'T00:00:00Z')
  if (await prisma.hariLiburKerja.findUnique({ where: { tanggal: tgl } })) return gagal(res, 409, 'Tanggal itu sudah tercatat')
  const b = await prisma.hariLiburKerja.create({ data: { tanggal: tgl, nama: String(nama).trim(), jenis, catatan: req.body?.catatan ? String(req.body.catatan).slice(0, 500) : null } })
  return res.status(201).json({ success: true, data: { id: b.id, tanggal: t, nama: b.nama, jenis } })
})
export const hapusLibur = wrap(async (req, res) => {
  if (!hasAnyRole(peranKerja(req), SUPER_ADMIN)) return gagal(res, 403, 'Hanya Super Admin yang mengatur hari libur')
  const b = await prisma.hariLiburKerja.findUnique({ where: { id: req.params.id } })
  if (!b) return gagal(res, 404, 'Hari libur tidak ditemukan')
  await prisma.hariLiburKerja.delete({ where: { id: b.id } })
  return res.json({ success: true, message: 'Hari libur dihapus' })
})
