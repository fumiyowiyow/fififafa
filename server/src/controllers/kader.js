import prisma from '../prisma.js'
import { parsePagination, canManageMember } from '../utils/roles.js'

// Requester sendiri (lihat riwayatnya sendiri) boleh, atau canManageMember terpusat (dulu di
// sini pakai blanket FULL_ADMIN yang bikin Kepala Circle mana pun bisa akses kader circle lain
// — bug yang sama yang sudah diperbaiki di canManageMember, sekarang dipakai ulang dari sana).
async function canAccessKader(targetUserId, req) {
  if (targetUserId === req.user.id) return true
  return canManageMember(targetUserId, req.userRoles ?? [])
}


export const getTimeline = async (req, res) => {
  try {
    if (!(await canAccessKader(req.params.userId, req))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke riwayat anggota ini' })
    }
    const events = await prisma.kaderTimeline.findMany({
      where: { userId: req.params.userId },
      orderBy: { tanggal: 'desc' },
    })

    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true, nama: true, fotoUrl: true, tanggalMasuk: true,
        roles: {
          include: {
            circle:     { select: { nama: true, colorHex: true } },
            rumahUsaha: { select: { nama: true, colorHex: true } },
            studio:     { select: { nama: true } },
          },
        },
      },
    })

    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    return res.json({ success: true, data: { user, events } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const addEvent = async (req, res) => {
  try {
    const { userId, tipeEvent, deskripsi, tanggal } = req.body
    if (!userId || !tipeEvent || !deskripsi || !tanggal) {
      return res.status(422).json({ success: false, message: 'userId, tipeEvent, deskripsi, tanggal wajib' })
    }
    if (!(await canAccessKader(userId, req))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke anggota ini' })
    }

    const event = await prisma.kaderTimeline.create({
      data: {
        userId,
        tipeEvent,
        deskripsi,
        tanggal:    new Date(tanggal),
        dicatatOleh: req.user.id,
      },
    })
    return res.status(201).json({ success: true, data: event })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params
    const { tipeEvent, deskripsi, tanggal } = req.body

    const existing = await prisma.kaderTimeline.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' })
    if (!(await canAccessKader(existing.userId, req))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke anggota ini' })
    }

    const event = await prisma.kaderTimeline.update({
      where: { id },
      data: {
        ...(tipeEvent  && { tipeEvent }),
        ...(deskripsi  && { deskripsi }),
        ...(tanggal    && { tanggal: new Date(tanggal) }),
      },
    })
    return res.json({ success: true, data: event })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const removeEvent = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await prisma.kaderTimeline.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Event tidak ditemukan' })
    if (!(await canAccessKader(existing.userId, req))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke anggota ini' })
    }
    await prisma.kaderTimeline.delete({ where: { id } })
    return res.json({ success: true, message: 'Event berhasil dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getAll = async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req.query, 30)
    const events = await prisma.kaderTimeline.findMany({
      skip,
      take: limit,
      orderBy: { tanggal: 'desc' },
    })

    const userIds = [...new Set(events.map(e => e.userId))]
    const users   = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nama: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u.nama]))

    return res.json({
      success: true,
      data: events.map(e => ({ ...e, namaAnggota: userMap[e.userId] ?? '—' })),
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
