import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio } from './circle.js'

// AKUN JUALAN per studio + status "Mulai di sini" (21 Okt 2026). Tabel sama dengan modul Produksi Ekosistem (AkunProduksi) —
// koordinator ke atas boleh menambah/ubah/hapus dari web circle supaya dropdown "Masuk lewat akun" terisi.
// feePersen disimpan sebagai pecahan (0.2 = 20%), sama seperti di Ekosistem.
// WhatsApp/Telegram/Instagram: order yang masuk dari luar marketplace (10 Nov 2026, masukan tim) — tetap dicatat sebagai akun agar tampil di analitik; omzetnya masuk kolom "Lainnya" di laporan mingguan
const PLATFORM = ['Fiverr', 'Etsy', 'Upwork', 'Vgen', 'Komunitas', 'WhatsApp', 'Telegram', 'Instagram', 'Internal', 'Lainnya']
const AKUN_OTOMATIS = 'Order Internal' // dibuat sistem untuk order tanpa akun, bukan akun jualan sungguhan
const gagal = (res, status, message) => res.status(status).json({ success: false, message })

// Wewenang (16 Nov 2026, masukan tim — Aturan 8a): MELIHAT = pengelola order unit (Koordinator/Pendamping & Admin Market; admin per akun
// hanya akunnya). MENAMBAH/UBAH/HAPUS = hanya Koordinator/Pendamping unit (`pengelola`) — akun jualan adalah pengaturan unit, bukan order.
async function manajer(req, res, studioId, { tulis = true } = {}) {
  if (!(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return false }
  const p = await peranStudio(req, studioId)
  if (!p.manajer) { gagal(res, 403, 'Hanya Koordinator ke atas'); return false }
  if (tulis && (!p.pengelola || p.lihatSaja)) { gagal(res, 403, 'Akun jualan diatur Koordinator unit'); return false }
  return p
}
const rapi = (a) => ({ id: a.id, platform: a.platform, namaAkun: a.namaAkun, feePersen: Math.round(a.feePersen * 1000) / 10 })

function bersihkan(b, { baru }) {
  const out = {}
  if (baru || b.platform !== undefined) { if (!PLATFORM.includes(b.platform)) return { galat: `Platform harus salah satu: ${PLATFORM.join(', ')}` }; out.platform = b.platform }
  if (baru || b.namaAkun !== undefined) { const n = String(b.namaAkun ?? '').trim(); if (!n || n.length > 80) return { galat: 'Nama akun wajib diisi (maks 80 huruf)' }; if (n === AKUN_OTOMATIS) return { galat: 'Nama itu dipakai sistem' }; out.namaAkun = n }
  if (b.feePersen !== undefined && b.feePersen !== '') { const f = Number(b.feePersen); if (isNaN(f) || f < 0 || f > 100) return { galat: 'Fee harus 0–100%' }; out.feePersen = f / 100 }
  return { data: out }
}

export const getAkunJualan = async (req, res) => {
  try {
    const { studioId } = req.query
    const p = await manajer(req, res, studioId, { tulis: false }); if (!p) return
    const akun = await prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS }, ...(p.akunAdmin ? { id: { in: p.akunAdmin } } : {}) }, orderBy: [{ platform: 'asc' }, { namaAkun: 'asc' }] })
    return res.json({ success: true, data: { akun: akun.map(rapi), platform: PLATFORM, bisaUbah: !!p.pengelola && !p.lihatSaja } })
  } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') }
}

export const buatAkunJualan = async (req, res) => {
  try {
    const { studioId } = req.body
    if (!(await manajer(req, res, studioId))) return
    const { galat, data } = bersihkan(req.body, { baru: true })
    if (galat) return gagal(res, 422, galat)
    if (await prisma.akunProduksi.findUnique({ where: { studioId_namaAkun: { studioId, namaAkun: data.namaAkun } } })) return gagal(res, 409, 'Akun dengan nama itu sudah ada di studio ini')
    const a = await prisma.akunProduksi.create({ data: { studioId, ...data } })
    return res.status(201).json({ success: true, data: rapi(a) })
  } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') }
}

const lewatAkun = (isi) => async (req, res) => {
  try {
    const a = await prisma.akunProduksi.findUnique({ where: { id: req.params.id } })
    if (!a || a.namaAkun === AKUN_OTOMATIS) return gagal(res, 404, 'Akun tidak ditemukan')
    if (!(await manajer(req, res, a.studioId))) return
    return await isi(req, res, a)
  } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') }
}

export const ubahAkunJualan = lewatAkun(async (req, res, a) => {
  const { galat, data } = bersihkan(req.body, { baru: false })
  if (galat) return gagal(res, 422, galat)
  if (data.namaAkun && data.namaAkun !== a.namaAkun && await prisma.akunProduksi.findUnique({ where: { studioId_namaAkun: { studioId: a.studioId, namaAkun: data.namaAkun } } })) return gagal(res, 409, 'Akun dengan nama itu sudah ada di studio ini')
  return res.json({ success: true, data: rapi(await prisma.akunProduksi.update({ where: { id: a.id }, data })) })
})

export const hapusAkunJualan = lewatAkun(async (req, res, a) => {
  const dipakai = await prisma.orderProduksi.count({ where: { akunId: a.id } })
  if (dipakai) return gagal(res, 409, `Akun ini dipakai ${dipakai} order, tidak bisa dihapus. Ubah namanya saja bila perlu.`)
  await prisma.akunProduksi.delete({ where: { id: a.id } })
  return res.json({ success: true, message: 'Akun dihapus' })
})

// Status "Mulai di sini": akun jualan terisi, Tim dikonfirmasi (alur tidak bisa dideteksi → ditandai koordinator di klien).
export const getMulai = async (req, res) => {
  try {
    const { studioId } = req.query
    if (!(await manajer(req, res, studioId))) return
    const [akun, timOk, order] = await Promise.all([
      prisma.akunProduksi.count({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS } } }),
      prisma.fungsiAnggota.count({ where: { studioId, terkonfirmasi: true } }),
      prisma.orderProduksi.count({ where: { studioId } }),
    ])
    return res.json({ success: true, data: { akun, timTerkonfirmasi: timOk, order } })
  } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') }
}
