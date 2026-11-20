import prisma from '../prisma.js'


const ROLE_LEVEL = {
  ADVISOR:            0,
  KEPALA_EKOSISTEM:   1,
  KEPALA_CIRCLE:      3,
  KEPALA_RUMAH_USAHA: 4,
  ADMIN_FUNGSIONAL:   5,
  PENDAMPING:         5,
  KOORDINATOR:        6,
  KADER:              7,
  KARYAWAN:           8,
  MAGANG:             9,
}

// Isi req.userRoles tanpa membatasi akses — untuk GET routes yang butuh info role
export const populateRoles = async (req, res, next) => {
  try {
    req.userRoles = await prisma.userRole.findMany({ where: { userId: req.user.id } })
    next()
  } catch {
    req.userRoles = []
    next()
  }
}

export const checkRole = (allowedRoles) => async (req, res, next) => {
  try {
    const roles = await prisma.userRole.findMany({ where: { userId: req.user.id } })
    req.userRoles = roles

    const hasAccess = roles.some(ur => allowedRoles.includes(ur.roleType))
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }
    next()
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal verifikasi role' })
  }
}

export const checkMinRole = (minRole) => async (req, res, next) => {
  try {
    const roles = await prisma.userRole.findMany({ where: { userId: req.user.id } })
    req.userRoles = roles

    const minLevel = ROLE_LEVEL[minRole] ?? 99
    const hasAccess = roles.some(ur => (ROLE_LEVEL[ur.roleType] ?? 99) <= minLevel)
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }
    next()
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal verifikasi role' })
  }
}

export const checkCircleAccess = async (req, res, next) => {
  const circleId = req.params.circleId || req.body.circleId
  if (!circleId) return next()

  const roles = req.userRoles || []
  const isSuperUser = roles.some(ur =>
    ['KEPALA_EKOSISTEM', 'ADVISOR'].includes(ur.roleType)
  )
  if (isSuperUser) return next()

  const hasCircleAccess = roles.some(ur => ur.circleId === circleId)
  if (!hasCircleAccess) {
    return res.status(403).json({ success: false, message: 'Tidak punya akses ke circle ini' })
  }
  next()
}

export const checkStudioAccess = async (req, res, next) => {
  const studioId = req.params.studioId || req.body.studioId
  if (!studioId) return next()

  const roles = req.userRoles || []
  const isSuperUser = roles.some(ur =>
    ['KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADVISOR'].includes(ur.roleType)
  )
  if (isSuperUser) return next()

  const hasStudioAccess = roles.some(ur => ur.studioId === studioId)
  if (!hasStudioAccess) {
    return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
  }
  next()
}
