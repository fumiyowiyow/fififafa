import prisma from '../prisma.js'


export const getAll = async (req, res) => {
  try {
    const items = await prisma.milestone.findMany({
      orderBy: { tanggal: 'desc' },
      take: 50,
    })

    const userIds   = [...new Set(items.map(m => m.userId).filter(Boolean))]
    const studioIds = [...new Set(items.map(m => m.studioId).filter(Boolean))]

    const [users, studios] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nama: true } }),
      prisma.studio.findMany({ where: { id: { in: studioIds } }, select: { id: true, nama: true,
        circle:     { select: { colorHex: true } },
        rumahUsaha: { select: { colorHex: true } },
      } }),
    ])

    const userMap   = Object.fromEntries(users.map(u => [u.id, u.nama]))
    const studioMap = Object.fromEntries(studios.map(s => [s.id, s]))

    return res.json({
      success: true,
      data: items.map(m => ({
        ...m,
        namaUser:   m.userId   ? userMap[m.userId]   : null,
        namaStudio: m.studioId ? studioMap[m.studioId]?.nama : null,
        circleColor: m.studioId ? (studioMap[m.studioId]?.circle ?? studioMap[m.studioId]?.rumahUsaha)?.colorHex : null,
      })),
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { tipe, deskripsi, studioId, userId, shareAsPengumuman = false } = req.body
    if (!tipe || !deskripsi) {
      return res.status(422).json({ success: false, message: 'tipe dan deskripsi wajib' })
    }

    const milestone = await prisma.milestone.create({
      data: {
        tipe, deskripsi,
        studioId: studioId ?? null,
        userId:   userId   ?? null,
        tanggal:  new Date(),
      },
    })

    // Auto-share sebagai pengumuman jika diminta
    if (shareAsPengumuman) {
      await prisma.announcement.create({
        data: {
          dibuatOleh: req.user.id,
          judul:      `🎉 ${tipe}`,
          konten:     deskripsi,
          targetTipe: 'ALL',
        },
      })
    }

    return res.status(201).json({ success: true, data: milestone })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
