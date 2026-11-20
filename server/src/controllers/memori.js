import prisma from '../prisma.js'
import { hasAnyRole } from '../utils/roles.js'

const ADMIN_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']

export const getAll = async (req, res) => {
  try {
    const { tipe, search } = req.query
    const where = {}
    if (tipe) where.tipe = tipe
    if (search) where.OR = [
      { judul:  { contains: search, mode: 'insensitive' } },
      { konten: { contains: search, mode: 'insensitive' } },
      { tags:   { contains: search, mode: 'insensitive' } },
    ]

    const items = await prisma.memori.findMany({
      where,
      orderBy: { tanggal: 'desc' },
      select: { id: true, judul: true, tipe: true, tanggal: true, tags: true, authorId: true, createdAt: true, updatedAt: true },
    })
    return res.json({ success: true, data: items })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getById = async (req, res) => {
  try {
    const item = await prisma.memori.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ success: false, message: 'Memori tidak ditemukan' })

    const author = await prisma.user.findUnique({ where: { id: item.authorId }, select: { id: true, nama: true } })
    return res.json({ success: true, data: { ...item, author } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    if (!hasAnyRole(req.userRoles ?? [], ADMIN_ROLES)) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    const { judul, konten, tipe, tanggal, tags } = req.body
    if (!judul || !konten) {
      return res.status(422).json({ success: false, message: 'judul dan konten wajib diisi' })
    }
    const item = await prisma.memori.create({
      data: {
        judul, konten,
        tipe:     tipe     || 'Lainnya',
        tanggal:  tanggal  ? new Date(tanggal) : new Date(),
        tags:     tags     || null,
        authorId: req.user.id,
      },
    })
    return res.status(201).json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const update = async (req, res) => {
  try {
    if (!hasAnyRole(req.userRoles ?? [], ADMIN_ROLES)) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    const existing = await prisma.memori.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Memori tidak ditemukan' })

    const { judul, konten, tipe, tanggal, tags } = req.body
    const item = await prisma.memori.update({
      where: { id: req.params.id },
      data: {
        ...(judul   !== undefined && { judul }),
        ...(konten  !== undefined && { konten }),
        ...(tipe    !== undefined && { tipe }),
        ...(tanggal !== undefined && { tanggal: tanggal ? new Date(tanggal) : existing.tanggal }),
        ...(tags    !== undefined && { tags: tags || null }),
      },
    })
    return res.json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    if (!hasAnyRole(req.userRoles ?? [], ADMIN_ROLES)) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    const existing = await prisma.memori.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Memori tidak ditemukan' })

    await prisma.memori.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Memori dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
