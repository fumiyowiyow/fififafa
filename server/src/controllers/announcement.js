import prisma from '../prisma.js'
import { notifyUser }  from '../bot.js'
import { parsePagination } from '../utils/roles.js'


async function sendToTelegram(targetTipe, targetId, judul, konten) {
  const msg = `📢 *${judul}*\n\n${konten}`

  let users = []

  if (targetTipe === 'ALL') {
    users = await prisma.user.findMany({
      where: { telegramId: { not: null }, statusAktif: true },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'CIRCLE' && targetId) {
    users = await prisma.user.findMany({
      where: {
        telegramId: { not: null }, statusAktif: true,
        roles: { some: { circleId: targetId } },
      },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'RUMAH_USAHA' && targetId) {
    users = await prisma.user.findMany({
      where: {
        telegramId: { not: null }, statusAktif: true,
        roles: { some: { rumahUsahaId: targetId } },
      },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'STUDIO' && targetId) {
    users = await prisma.user.findMany({
      where: {
        telegramId: { not: null }, statusAktif: true,
        roles: { some: { studioId: targetId } },
      },
      select: { telegramId: true },
    })
  } else if (targetTipe === 'ROLE' && targetId) {
    const where = targetId === 'LIVE_IN'
      ? { telegramId: { not: null }, statusAktif: true, isLiveIn: true }
      : { telegramId: { not: null }, statusAktif: true, roles: { some: { roleType: targetId } } }
    users = await prisma.user.findMany({ where, select: { telegramId: true } })
  }

  let sent = 0
  for (const u of users) {
    const ok = await notifyUser(u.telegramId, msg)
    if (ok) sent++
  }
  return sent
}

export const getAll = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20)

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.announcement.count(),
    ])

    // Fetch semua pembuat sekaligus (2 queries total, bukan N+1)
    const userIds = [...new Set(items.map(a => a.dibuatOleh))]
    const users   = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nama: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u.nama]))

    const data = items.map(a => ({ ...a, namaPembuat: userMap[a.dibuatOleh] ?? 'Unknown' }))
    return res.json({ success: true, data, pagination: { page, limit, total } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengumuman' })
  }
}

export const create = async (req, res) => {
  try {
    const { judul, konten, targetTipe = 'ALL', targetId, kirimTelegram = false } = req.body
    if (!judul || !konten) {
      return res.status(422).json({ success: false, message: 'judul dan konten wajib diisi' })
    }
    if (['CIRCLE','RUMAH_USAHA','STUDIO','ROLE'].includes(targetTipe) && !targetId) {
      return res.status(422).json({ success: false, message: `targetId wajib diisi untuk targetTipe ${targetTipe}` })
    }

    const item = await prisma.announcement.create({
      data: {
        dibuatOleh: req.user.id,
        judul, konten, targetTipe,
        targetId: targetId ?? null,
      },
    })

    let telegramSent = 0
    if (kirimTelegram && process.env.TELEGRAM_BOT_TOKEN) {
      telegramSent = await sendToTelegram(targetTipe, targetId, judul, konten)
    }

    return res.status(201).json({
      success: true,
      data: item,
      message: kirimTelegram
        ? `Pengumuman dibuat & dikirim ke ${telegramSent} anggota via Telegram`
        : 'Pengumuman berhasil dibuat',
      telegramSent,
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal membuat pengumuman' })
  }
}

export const remove = async (req, res) => {
  try {
    const item = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!item) return res.status(404).json({ success: false, message: 'Pengumuman tidak ditemukan' })

    const isOwner = item.dibuatOleh === req.user.id
    const userRoles = await prisma.userRole.findMany({ where: { userId: req.user.id }, select: { roleType: true } })
    const isAdmin = userRoles.some(r => ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'].includes(r.roleType))
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Tidak bisa menghapus pengumuman orang lain' })
    }

    await prisma.announcement.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Pengumuman dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengumuman' })
  }
}
