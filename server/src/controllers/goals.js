import prisma from '../prisma.js'
import { SUPER_ADMIN, hasAnyRole } from '../utils/roles.js'

async function checkGoalAccess(goalId, userRoles) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal) return { goal: null, ok: false, notFound: true }
  // SUPER_ADMIN (bukan blanket FULL_ADMIN) -- FULL_ADMIN ikut KEPALA_CIRCLE, yang bikin Kepala
  // Circle mana pun bisa kelola goal circle lain lewat short-circuit ini, padahal di bawah
  // sudah ada pengecekan circleId/studioId yang benar tapi jadi gak pernah kepakai.
  if (hasAnyRole(userRoles ?? [], SUPER_ADMIN)) return { goal, ok: true }
  if (goal.circleId) {
    if ((userRoles ?? []).some(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId === goal.circleId))
      return { goal, ok: true }
  }
  // Rumah Usaha sejajar Circle -- pola sama persis, cuma role & field beda.
  if (goal.rumahUsahaId) {
    if ((userRoles ?? []).some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === goal.rumahUsahaId))
      return { goal, ok: true }
  }
  if (goal.studioId) {
    if ((userRoles ?? []).some(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType) && r.studioId === goal.studioId))
      return { goal, ok: true }
  }
  // KOORDINATOR/PENDAMPING on circle-level goal: check if their studio belongs to that circle
  if (goal.circleId && !goal.studioId) {
    const studioIds = (userRoles ?? [])
      .filter(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType) && r.studioId)
      .map(r => r.studioId)
    if (studioIds.length > 0) {
      const count = await prisma.studio.count({ where: { id: { in: studioIds }, circleId: goal.circleId } })
      if (count > 0) return { goal, ok: true }
    }
  }
  // KOORDINATOR/PENDAMPING on rumah-usaha-level goal: sama pola, lewat rumahUsahaId studio
  if (goal.rumahUsahaId && !goal.studioId) {
    const studioIds = (userRoles ?? [])
      .filter(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType) && r.studioId)
      .map(r => r.studioId)
    if (studioIds.length > 0) {
      const count = await prisma.studio.count({ where: { id: { in: studioIds }, rumahUsahaId: goal.rumahUsahaId } })
      if (count > 0) return { goal, ok: true }
    }
  }
  return { goal, ok: false }
}

export const getAll = async (req, res) => {
  try {
    const { circleId, rumahUsahaId, studioId } = req.query
    const where = {}
    if (circleId)     where.circleId = circleId
    if (rumahUsahaId) where.rumahUsahaId = rumahUsahaId
    if (studioId)     where.studioId = studioId

    const goals = await prisma.goal.findMany({ where, orderBy: { deadline: 'asc' } })

    const circleIds     = [...new Set(goals.map(g => g.circleId).filter(Boolean))]
    const rumahUsahaIds = [...new Set(goals.map(g => g.rumahUsahaId).filter(Boolean))]
    const studioIds     = [...new Set(goals.map(g => g.studioId).filter(Boolean))]

    const [circles, rumahUsahaList, studios] = await Promise.all([
      prisma.circle.findMany({ where: { id: { in: circleIds } }, select: { id: true, nama: true, colorHex: true } }),
      prisma.rumahUsaha.findMany({ where: { id: { in: rumahUsahaIds } }, select: { id: true, nama: true, colorHex: true } }),
      prisma.studio.findMany({ where: { id: { in: studioIds } }, select: {
        id: true, nama: true, tipe: true,
        circle: { select: { nama: true, colorHex: true } },
        rumahUsaha: { select: { nama: true, colorHex: true } },
      } }),
    ])

    const circleMap     = Object.fromEntries(circles.map(c => [c.id, c]))
    const rumahUsahaMap = Object.fromEntries(rumahUsahaList.map(r => [r.id, r]))
    const studioMap     = Object.fromEntries(studios.map(s => [s.id, s]))

    const myStudioIds = (req.userRoles ?? [])
      .filter(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId)
      .map(r => r.studioId)
    const myStudios = myStudioIds.length
      ? await prisma.studio.findMany({ where: { id: { in: myStudioIds } }, select: { circleId: true, rumahUsahaId: true } })
      : []
    const myCircleIdsViaStudio     = new Set(myStudios.map(s => s.circleId).filter(Boolean))
    const myRumahUsahaIdsViaStudio = new Set(myStudios.map(s => s.rumahUsahaId).filter(Boolean))

    return res.json({
      success: true,
      data: goals.map(g => ({
        ...g,
        circle:     g.circleId     ? circleMap[g.circleId]         : null,
        rumahUsaha: g.rumahUsahaId ? rumahUsahaMap[g.rumahUsahaId] : null,
        studio:     g.studioId     ? studioMap[g.studioId]         : null,
        myStudioInCircle:     g.circleId     ? myCircleIdsViaStudio.has(g.circleId)         : false,
        myStudioInRumahUsaha: g.rumahUsahaId ? myRumahUsahaIdsViaStudio.has(g.rumahUsahaId) : false,
      })),
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { nama, targetValue, satuan, deadline, circleId, rumahUsahaId, studioId } = req.body
    if (!nama || !targetValue || !satuan || !deadline) {
      return res.status(422).json({ success: false, message: 'nama, targetValue, satuan, deadline wajib' })
    }
    if (circleId && rumahUsahaId) {
      return res.status(422).json({ success: false, message: 'Pilih salah satu: Circle atau Rumah Usaha' })
    }
    const goal = await prisma.goal.create({
      data: {
        nama,
        targetValue:  Number(targetValue),
        satuan,
        deadline:     new Date(deadline),
        circleId:     circleId     ?? null,
        rumahUsahaId: rumahUsahaId ?? null,
        studioId:     studioId     ?? null,
        currentValue: 0,
      },
    })
    return res.status(201).json({ success: true, data: goal })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateProgress = async (req, res) => {
  try {
    const { nama, targetValue, satuan, deadline, circleId, rumahUsahaId, currentValue } = req.body
    const { goal, ok, notFound } = await checkGoalAccess(req.params.id, req.userRoles)
    if (notFound) return res.status(404).json({ success: false, message: 'Goal tidak ditemukan' })
    if (!ok) return res.status(403).json({ success: false, message: 'Hanya bisa update goals circle/rumah usaha/studio sendiri' })
    if (circleId && rumahUsahaId) {
      return res.status(422).json({ success: false, message: 'Pilih salah satu: Circle atau Rumah Usaha' })
    }

    const data = {}
    if (nama !== undefined)        data.nama = nama
    if (targetValue !== undefined) data.targetValue = Number(targetValue)
    if (satuan !== undefined)      data.satuan = satuan
    if (deadline)                  data.deadline = new Date(deadline)
    if (circleId !== undefined)     data.circleId = circleId || null
    if (rumahUsahaId !== undefined) data.rumahUsahaId = rumahUsahaId || null
    if (currentValue !== undefined) data.currentValue = Number(currentValue)

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data,
    })

    if (!goal.tercapai && updated.currentValue >= updated.targetValue) {
      const now = new Date()
      await prisma.goal.update({ where: { id: goal.id }, data: { tercapai: true, tercapaiAt: now } })
      const deskripsi = `Goal "${updated.nama}" berhasil tercapai 🎉 — ${updated.currentValue} dari target ${updated.targetValue} ${updated.satuan}`
      prisma.milestone.create({
        data: { tipe: '🏆 Goal Tercapai', deskripsi, studioId: updated.studioId ?? null, tanggal: now },
      }).catch(() => {})
      if (updated.studioId) {
        prisma.userRole.findMany({
          where: { studioId: updated.studioId },
          select: { userId: true },
          distinct: ['userId'],
        }).then(roles =>
          prisma.kaderTimeline.createMany({
            data: roles.map(r => ({
              userId: r.userId,
              tipeEvent: 'Goal Tercapai',
              deskripsi,
              tanggal: now,
              dicatatOleh: req.user.id,
            })),
            skipDuplicates: true,
          })
        ).catch(() => {})
      }
      return res.json({ success: true, data: { ...updated, tercapai: true, tercapaiAt: now } })
    }

    return res.json({ success: true, data: updated })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    const { goal, ok, notFound } = await checkGoalAccess(req.params.id, req.userRoles)
    if (notFound) return res.status(404).json({ success: false, message: 'Goal tidak ditemukan' })
    if (!ok) return res.status(403).json({ success: false, message: 'Hanya bisa hapus goals circle/studio sendiri' })
    await prisma.goal.delete({ where: { id: goal.id } })
    return res.json({ success: true, message: 'Goal dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
