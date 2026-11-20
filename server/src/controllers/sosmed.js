import prisma from '../prisma.js'
import { hasAnyRole, canManageStudio, ROLE_LEVEL } from '../utils/roles.js'

const ADMIN_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']

function isKoordinatorPlus(roles = []) {
  return roles.some(r => (ROLE_LEVEL[r.roleType] ?? 99) <= ROLE_LEVEL.KOORDINATOR)
}

export const getAll = async (req, res) => {
  try {
    const { userId, platform, studioId } = req.query
    const where = {}
    if (userId)   where.userId   = userId
    if (platform) where.platform = platform
    if (studioId) where.studioId = studioId

    let links = await prisma.sosmedLink.findMany({
      where,
      orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }],
    })

    // Aset studio (link.studioId terisi) cuma boleh dilihat Koordinator ke atas -- sosmed
    // pribadi tetap terbuka buat semua orang.
    if (!isKoordinatorPlus(req.userRoles ?? [])) {
      links = links.filter(l => !l.studioId)
    }

    const userIds   = [...new Set(links.map(l => l.userId).filter(Boolean))]
    const studioIds = [...new Set(links.map(l => l.studioId).filter(Boolean))]
    const [users, studios] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nama: true, fotoUrl: true, posisi: true,
          roles: { include: {
            studio:     { select: { id: true, nama: true } },
            circle:     { select: { id: true, nama: true, colorHex: true } },
            rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
          } },
        },
      }),
      prisma.studio.findMany({
        where: { id: { in: studioIds } },
        select: { id: true, nama: true, tipe: true, circle: { select: { colorHex: true } }, rumahUsaha: { select: { colorHex: true } } },
      }),
    ])
    const userMap   = Object.fromEntries(users.map(u => [u.id, u]))
    const studioMap = Object.fromEntries(studios.map(s => [s.id, s]))

    return res.json({
      success: true,
      data: links.map(l => ({
        ...l,
        user:   l.userId   ? (userMap[l.userId] ?? null)   : null,
        studio: l.studioId ? (studioMap[l.studioId] ?? null) : null,
      })),
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { platform, url, username, targetUserId, studioId } = req.body
    if (!platform || !url) {
      return res.status(422).json({ success: false, message: 'platform dan url wajib diisi' })
    }
    if (studioId && targetUserId) {
      return res.status(422).json({ success: false, message: 'Pilih salah satu: milik studio atau milik orang tertentu' })
    }

    let data
    if (studioId) {
      if (!(await canManageStudio(req.userRoles, studioId))) {
        return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
      }
      data = { studioId, userId: null, platform, url, username: username || null }
    } else {
      const isAdmin = hasAnyRole(req.userRoles ?? [], ADMIN_ROLES)
      const userId  = (isAdmin && targetUserId) ? targetUserId : req.user.id
      data = { userId, studioId: null, platform, url, username: username || null }
    }

    const link = await prisma.sosmedLink.create({ data })
    return res.status(201).json({ success: true, data: link })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const update = async (req, res) => {
  try {
    const existing = await prisma.sosmedLink.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Link tidak ditemukan' })

    const isAdmin = hasAnyRole(req.userRoles ?? [], ADMIN_ROLES)
    const allowed = existing.studioId
      ? await canManageStudio(req.userRoles, existing.studioId)
      : (isAdmin || existing.userId === req.user.id)
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Hanya bisa edit link milik sendiri' })
    }

    const { platform, url, username } = req.body
    const link = await prisma.sosmedLink.update({
      where: { id: req.params.id },
      data: {
        ...(platform !== undefined && { platform }),
        ...(url      !== undefined && { url }),
        ...(username !== undefined && { username: username || null }),
      },
    })
    return res.json({ success: true, data: link })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    const existing = await prisma.sosmedLink.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Link tidak ditemukan' })

    const isAdmin = hasAnyRole(req.userRoles ?? [], ADMIN_ROLES)
    const allowed = existing.studioId
      ? await canManageStudio(req.userRoles, existing.studioId)
      : (isAdmin || existing.userId === req.user.id)
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Hanya bisa hapus link milik sendiri' })
    }

    await prisma.sosmedLink.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Link dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
