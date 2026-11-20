import prisma from '../prisma.js'
import { hasAnyRole, ROLE_LEVEL, bestLevel } from '../utils/roles.js'

const ADMIN_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']

// Threshold per opsi aksesRole (lihat Modul.aksesRole di schema.prisma) -- diturunkan dari
// ROLE_LEVEL canonical di utils/roles.js, BUKAN angka hardcoded terpisah kayak sebelumnya. File
// ini sempat punya salinan ROLE_LEVEL sendiri yang udah drift dari yang asli (KEPALA_RUMAH_USAHA
// ditambah ke hierarki canonical tapi salinan di sini gak ikut update, jadi ADMIN_FUNGSIONAL/
// PENDAMPING/KOORDINATOR/dst semua kegeser 1 level lebih senior dari yang seharusnya) -- pakai
// referensi langsung ke ROLE_LEVEL biar gak bisa drift lagi.
// CO_ADMIN dihapus dari opsi 25 Juli 2026 (role-nya sendiri dihapus, redundan sama ADVISOR) --
// modul lama yang kadung ke-set aksesRole='CO_ADMIN' (kalau ada) otomatis fallback ke `?? 99` di
// canReadModul() di bawah, jadi kebuka buat semua role (aman, cuma nambah visibilitas dokumen/SOP,
// bukan ngurangin) -- bukan hilang total.
const AKSES_LEVEL = {
  SEMUA: 99, KOORDINATOR: ROLE_LEVEL.KOORDINATOR, KEPALA_CIRCLE: ROLE_LEVEL.KEPALA_CIRCLE,
}

function canManage(userRoles) {
  return hasAnyRole(userRoles ?? [], ADMIN_ROLES)
}

function canReadModul(aksesRole, userRoles) {
  return bestLevel(userRoles ?? []) <= (AKSES_LEVEL[aksesRole] ?? 99)
}

export const getAll = async (req, res) => {
  try {
    const { kategori } = req.query
    const where = {}
    if (kategori) where.kategori = kategori

    const moduls = await prisma.modul.findMany({
      where,
      orderBy: [{ kategori: 'asc' }, { urutan: 'asc' }, { createdAt: 'asc' }],
    })

    const visible = moduls.filter(m => canReadModul(m.aksesRole, req.userRoles))
    return res.json({ success: true, data: visible })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getById = async (req, res) => {
  try {
    const modul = await prisma.modul.findUnique({ where: { id: req.params.id } })
    if (!modul) return res.status(404).json({ success: false, message: 'Modul tidak ditemukan' })
    if (!canReadModul(modul.aksesRole, req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }
    return res.json({ success: true, data: modul })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    if (!canManage(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    const { judul, deskripsi, linkDrive, kategori, aksesRole, urutan } = req.body
    if (!judul || !linkDrive || !kategori) {
      return res.status(422).json({ success: false, message: 'judul, linkDrive, dan kategori wajib diisi' })
    }
    const modul = await prisma.modul.create({
      data: {
        judul, deskripsi: deskripsi || null, linkDrive, kategori,
        aksesRole: aksesRole || 'SEMUA',
        urutan:    urutan ? Number(urutan) : 0,
        authorId:  req.user.id,
      },
    })
    return res.status(201).json({ success: true, data: modul })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const update = async (req, res) => {
  try {
    if (!canManage(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    const existing = await prisma.modul.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Modul tidak ditemukan' })

    const { judul, deskripsi, linkDrive, kategori, aksesRole, urutan } = req.body
    const modul = await prisma.modul.update({
      where: { id: req.params.id },
      data: {
        ...(judul     !== undefined && { judul }),
        ...(deskripsi !== undefined && { deskripsi: deskripsi || null }),
        ...(linkDrive !== undefined && { linkDrive }),
        ...(kategori  !== undefined && { kategori }),
        ...(aksesRole !== undefined && { aksesRole }),
        ...(urutan    !== undefined && { urutan: Number(urutan) }),
      },
    })
    return res.json({ success: true, data: modul })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    if (!canManage(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    const existing = await prisma.modul.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Modul tidak ditemukan' })
    await prisma.modul.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Modul dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
