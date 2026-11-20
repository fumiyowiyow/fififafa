import prisma from '../prisma.js'

export const getHierarchy = async (_req, res) => {
  try {
    const studioInclude = {
      where:   { statusAktif: true },
      orderBy: { nama: 'asc' },
      include: {
        userRoles: {
          include: {
            user: {
              select: { id: true, nama: true, fotoUrl: true, posisi: true, statusAktif: true },
            },
          },
        },
      },
    }

    const [circles, rumahUsaha] = await Promise.all([
      prisma.circle.findMany({
        orderBy: { nama: 'asc' },
        include: { studios: studioInclude },
      }),
      // Rumah Usaha sejajar Circle -- gak boleh kelewat kayak sebelumnya (studio yang pindah
      // ke sini gak pernah muncul di Direktori Tim/Struktur Tim lama).
      prisma.rumahUsaha.findMany({
        where: { statusAktif: true },
        orderBy: { nama: 'asc' },
        include: { studios: studioInclude },
      }),
    ])

    // Also get ecosystem-level roles (no circle/studio/rumahUsaha)
    const ekoRoles = await prisma.userRole.findMany({
      where: { circleId: null, studioId: null, rumahUsahaId: null },
      include: { user: { select: { id: true, nama: true, fotoUrl: true, posisi: true, statusAktif: true } } },
    })

    return res.json({ success: true, data: { circles, rumahUsaha, ekoRoles } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
