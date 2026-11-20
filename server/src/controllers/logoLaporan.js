// ─────────────────────────────────────────────────────────────────────────
// LOGO circle / rumah usaha / unit usaha untuk laporan PDF (13 Okt 2026, diadaptasi dari
// playgroundecos.app). Disimpan di tabel LogoLaporan (bukan kolom di Circle/Studio — lihat
// komentar di schema.prisma). Kosong = PDF memakai logo otomatis (inisial + warna circle).
// Hak tulis = pengurus pemiliknya: circle/rumah usaha → canManageOrgUnit, unit → canManageStudio.
// Hak baca = KADER+ (gerbang rute).
// ─────────────────────────────────────────────────────────────────────────
import prisma from '../prisma.js'
import { canManageOrgUnit, canManageStudio } from '../utils/roles.js'

// ±300 KB berkas — logo 512 px sudah lebih dari cukup untuk cetak 16:9.
export const MAKS_LOGO = 400_000
const DATA_URL_SAH = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/
const ID_SAH = /^[A-Za-z0-9_-]{1,64}$/
const JENIS = {
  circle:        { model: 'circle',     nama: 'circle',      boleh: async (roles, id) => canManageOrgUnit(roles, { circleId: id }) },
  'rumah-usaha': { model: 'rumahUsaha', nama: 'rumah usaha', boleh: async (roles, id) => canManageOrgUnit(roles, { rumahUsahaId: id }) },
  unit:          { model: 'studio',     nama: 'unit usaha',  boleh: async (roles, id) => canManageStudio(roles, id) },
}

const uraiKunci = (q = {}) => {
  const jenis = String(q.jenis ?? '').trim()
  const id = String(q.id ?? '').trim()
  if (!JENIS[jenis] || !ID_SAH.test(id)) return null
  return { jenis, id }
}

/** Logo sebuah sasaran — null bila belum ada (laporan tetap jalan dengan logo otomatis). */
export async function ambilLogo(jenis, id) {
  if (!JENIS[jenis] || !id) return null
  try {
    const r = await prisma.logoLaporan.findUnique({ where: { jenis_targetId: { jenis, targetId: id } }, select: { dataUrl: true } })
    return r && DATA_URL_SAH.test(r.dataUrl) ? r.dataUrl : null
  } catch (e) {
    console.warn('[logo] baca gagal:', e?.code ?? e?.message)
    return null
  }
}

/** GET /api/reports/logo?jenis=circle|rumah-usaha|unit&id= → { logoUrl, bolehUbah, nama } */
export const bacaLogo = async (req, res) => {
  try {
    const k = uraiKunci(req.query)
    if (!k) return res.status(422).json({ success: false, message: 'Sasaran logo tidak dikenal' })
    const j = JENIS[k.jenis]
    const ada = await prisma[j.model].findUnique({ where: { id: k.id }, select: { id: true, nama: true } })
    if (!ada) return res.status(404).json({ success: false, message: `${j.nama[0].toUpperCase()}${j.nama.slice(1)} tidak ditemukan` })
    return res.json({ success: true, data: { logoUrl: await ambilLogo(k.jenis, k.id), nama: ada.nama, bolehUbah: await j.boleh(req.userRoles ?? [], k.id) } })
  } catch (e) {
    console.error('[logo] baca gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal memuat logo' })
  }
}

/** PUT /api/reports/logo   body { jenis, id, dataUrl } */
export const simpanLogo = async (req, res) => {
  try {
    const k = uraiKunci(req.body ?? {})
    if (!k) return res.status(422).json({ success: false, message: 'Sasaran logo tidak dikenal' })
    const j = JENIS[k.jenis]
    if (!(await j.boleh(req.userRoles ?? [], k.id))) {
      return res.status(403).json({ success: false, message: `Hanya pengurus ${j.nama} ini yang bisa mengganti logonya` })
    }
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl.trim() : ''
    if (dataUrl.length > MAKS_LOGO) return res.status(413).json({ success: false, message: 'Logo terlalu besar — kecilkan dulu (maksimal ±300 KB)' })
    if (!DATA_URL_SAH.test(dataUrl)) return res.status(422).json({ success: false, message: 'Logo harus PNG atau JPG' })
    const ada = await prisma[j.model].findUnique({ where: { id: k.id }, select: { id: true } })
    if (!ada) return res.status(404).json({ success: false, message: `${j.nama[0].toUpperCase()}${j.nama.slice(1)} tidak ditemukan` })
    await prisma.logoLaporan.upsert({
      where: { jenis_targetId: { jenis: k.jenis, targetId: k.id } },
      create: { jenis: k.jenis, targetId: k.id, dataUrl, diunggahOleh: req.user?.id ?? null },
      update: { dataUrl, diunggahOleh: req.user?.id ?? null },
    })
    return res.json({ success: true, data: { logoUrl: dataUrl }, message: 'Logo disimpan' })
  } catch (e) {
    console.error('[logo] simpan gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal menyimpan logo' })
  }
}

/** DELETE /api/reports/logo?jenis=&id= */
export const hapusLogo = async (req, res) => {
  try {
    const k = uraiKunci(req.query)
    if (!k) return res.status(422).json({ success: false, message: 'Sasaran logo tidak dikenal' })
    const j = JENIS[k.jenis]
    if (!(await j.boleh(req.userRoles ?? [], k.id))) {
      return res.status(403).json({ success: false, message: `Hanya pengurus ${j.nama} ini yang bisa menghapus logonya` })
    }
    await prisma.logoLaporan.deleteMany({ where: { jenis: k.jenis, targetId: k.id } })
    return res.json({ success: true, data: { logoUrl: null }, message: 'Logo dihapus — laporan memakai logo otomatis' })
  } catch (e) {
    console.error('[logo] hapus gagal:', e?.message)
    return res.status(500).json({ success: false, message: 'Gagal menghapus logo' })
  }
}
