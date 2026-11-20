// ─────────────────────────────────────────────────────────────────────────
// GALERI FOTO SAMPUL laporan (13 Okt 2026, diadaptasi dari playgroundecos.app): foto yang
// diunggah di Unduh Laporan TERSIMPAN untuk circle / rumah usaha / unit usaha / ekosistem itu,
// supaya bisa dipakai lagi tanpa mengunggah ulang, oleh semua pengurusnya.
//
// Foto dikecilkan di PERAMBAN lalu dikirim sebagai data URL (tabel FotoSampul, ikut backup
// harian DB). `thumb` = versi kecil untuk galeri, `dataUrl` penuh hanya diambil saat foto
// dipilih. Maksimal MAKS_GALERI foto per sasaran.
// Hak tulis: ekosistem = Super Admin; circle / rumah usaha = canManageOrgUnit; unit =
// canManageStudio. Hak baca = KADER+ (gerbang rute, sama dengan laporan yang memakainya).
// ─────────────────────────────────────────────────────────────────────────
import prisma from '../prisma.js'
import { canManageOrgUnit, canManageStudio, hasAnyRole, SUPER_ADMIN } from '../utils/roles.js'

// ±650 KB JPEG — batas body JSON aplikasi 2 MB; PDF menanam foto ini apa adanya.
export const MAKS_FOTO_SAMPUL = 900_000
export const MAKS_THUMB = 80_000
export const MAKS_GALERI = 12
const DATA_URL_SAH = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/
const ID_SAH = /^[A-Za-z0-9_-]{1,64}$/
const JENIS = new Set(['ekosistem', 'circle', 'rumah-usaha', 'unit'])
const NAMA_JENIS = { ekosistem: 'ekosistem', circle: 'circle', 'rumah-usaha': 'rumah usaha', unit: 'unit usaha' }
const PILIH_RINGKAS = { id: true, nama: true, thumb: true, createdAt: true, diunggahOleh: true }

/** Sasaran galeri → { id, nama, … } atau null bila tidak ada. */
async function sasaran(jenis, targetId) {
  if (jenis === 'ekosistem') return { id: '', nama: 'Ekosistem' }
  if (!targetId) return null
  if (jenis === 'circle') return prisma.circle.findUnique({ where: { id: targetId }, select: { id: true, nama: true } })
  if (jenis === 'rumah-usaha') return prisma.rumahUsaha.findUnique({ where: { id: targetId }, select: { id: true, nama: true } })
  return prisma.studio.findUnique({ where: { id: targetId }, select: { id: true, nama: true, circleId: true, rumahUsahaId: true } })
}

/** Bolehkah pemegang `roles` menambah/menghapus foto sampul sasaran ini? (async) */
export async function bolehUbahFotoSampul(roles = [], jenis, target) {
  if (!target) return false
  if (jenis === 'ekosistem') return hasAnyRole(roles, SUPER_ADMIN)
  if (jenis === 'circle') return canManageOrgUnit(roles, { circleId: target.id })
  if (jenis === 'rumah-usaha') return canManageOrgUnit(roles, { rumahUsahaId: target.id })
  return canManageStudio(roles, target.id)
}

const uraiKunci = (q = {}) => {
  const jenis = String(q.jenis ?? '').trim()
  const id = String(q.id ?? '').trim()
  if (!JENIS.has(jenis)) return null
  if (jenis !== 'ekosistem' && !ID_SAH.test(id)) return null
  return { jenis, targetId: jenis === 'ekosistem' ? '' : id }
}

/** GET /api/reports/foto-sampul?jenis=ekosistem|circle|rumah-usaha|unit&id= */
export const daftarFotoSampul = async (req, res) => {
  try {
    const k = uraiKunci(req.query)
    if (!k) return res.status(422).json({ success: false, message: 'Sasaran galeri tidak dikenal' })
    const target = await sasaran(k.jenis, k.targetId)
    if (!target) return res.status(404).json({ success: false, message: 'Sasaran galeri tidak ditemukan' })
    const foto = await prisma.fotoSampul.findMany({ where: k, orderBy: { createdAt: 'desc' }, take: MAKS_GALERI, select: PILIH_RINGKAS })
    return res.json({ success: true, data: { foto, bolehUbah: await bolehUbahFotoSampul(req.userRoles ?? [], k.jenis, target), maks: MAKS_GALERI, nama: target.nama } })
  } catch (e) {
    console.error('[fotoSampul] daftar gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal memuat galeri foto sampul' })
  }
}

/** GET /api/reports/foto-sampul/:fid → foto penuh (data URL) */
export const ambilFotoSampul = async (req, res) => {
  try {
    const { fid } = req.params
    if (!ID_SAH.test(fid ?? '')) return res.status(422).json({ success: false, message: 'Id foto tidak sah' })
    const f = await prisma.fotoSampul.findUnique({ where: { id: fid }, select: { id: true, jenis: true, targetId: true, nama: true, dataUrl: true, createdAt: true } })
    if (!f) return res.status(404).json({ success: false, message: 'Foto sampul tidak ditemukan' })
    return res.json({ success: true, data: f })
  } catch (e) {
    console.error('[fotoSampul] ambil gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal memuat foto sampul' })
  }
}

/** POST /api/reports/foto-sampul   body { jenis, id, nama?, dataUrl, thumb? } */
export const simpanFotoSampul = async (req, res) => {
  try {
    const k = uraiKunci(req.body ?? {})
    if (!k) return res.status(422).json({ success: false, message: 'Sasaran galeri tidak dikenal' })
    const target = await sasaran(k.jenis, k.targetId)
    if (!target) return res.status(404).json({ success: false, message: 'Sasaran galeri tidak ditemukan' })
    if (!(await bolehUbahFotoSampul(req.userRoles ?? [], k.jenis, target))) {
      return res.status(403).json({ success: false, message: `Hanya pengurus ${NAMA_JENIS[k.jenis]} ini yang bisa menyimpan foto sampulnya` })
    }
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl.trim() : ''
    if (dataUrl.length > MAKS_FOTO_SAMPUL) {
      return res.status(413).json({ success: false, message: 'Foto terlalu besar — kecilkan dulu (maksimal ±650 KB)' })
    }
    if (!DATA_URL_SAH.test(dataUrl)) return res.status(422).json({ success: false, message: 'Foto harus JPG atau PNG' })
    const thumbMasuk = typeof req.body?.thumb === 'string' ? req.body.thumb.trim() : ''
    const thumb = thumbMasuk && thumbMasuk.length <= MAKS_THUMB && DATA_URL_SAH.test(thumbMasuk) ? thumbMasuk : null
    const nama = String(req.body?.nama ?? '').trim().slice(0, 80) || null
    const jumlah = await prisma.fotoSampul.count({ where: k })
    if (jumlah >= MAKS_GALERI) {
      return res.status(409).json({ success: false, message: `Galeri foto ${target.nama} sudah penuh (${MAKS_GALERI} foto) — hapus salah satu dulu` })
    }
    const f = await prisma.fotoSampul.create({ data: { ...k, nama, dataUrl, thumb, diunggahOleh: req.user?.id ?? null }, select: PILIH_RINGKAS })
    return res.status(201).json({ success: true, data: f, message: `Foto sampul disimpan untuk ${target.nama}` })
  } catch (e) {
    console.error('[fotoSampul] simpan gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal menyimpan foto sampul' })
  }
}

/** DELETE /api/reports/foto-sampul/:fid */
export const hapusFotoSampul = async (req, res) => {
  try {
    const { fid } = req.params
    if (!ID_SAH.test(fid ?? '')) return res.status(422).json({ success: false, message: 'Id foto tidak sah' })
    const f = await prisma.fotoSampul.findUnique({ where: { id: fid }, select: { id: true, jenis: true, targetId: true } })
    if (!f) return res.status(404).json({ success: false, message: 'Foto sampul tidak ditemukan' })
    const target = await sasaran(f.jenis, f.targetId)
    if (!(await bolehUbahFotoSampul(req.userRoles ?? [], f.jenis, target))) {
      return res.status(403).json({ success: false, message: `Hanya pengurus ${NAMA_JENIS[f.jenis]} ini yang bisa menghapus foto sampulnya` })
    }
    await prisma.fotoSampul.delete({ where: { id: f.id } })
    return res.json({ success: true, data: null, message: 'Foto sampul dihapus' })
  } catch (e) {
    console.error('[fotoSampul] hapus gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal menghapus foto sampul' })
  }
}
