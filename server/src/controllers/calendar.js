import prisma from '../prisma.js'


export const getEvents = async (req, res) => {
  try {
    const { bulan, tahun } = req.query
    const b = parseInt(bulan) || new Date().getMonth() + 1
    const t = parseInt(tahun) || new Date().getFullYear()

    const start = new Date(t, b - 1, 1)
    const end   = new Date(t, b, 0, 23, 59, 59)

    // Ulang tahun bulan ini
    const birthdays = await prisma.$queryRaw`
      SELECT id, nama, "tanggalLahir", "telegramUsername", "nomorWa"
      FROM "User"
      WHERE EXTRACT(MONTH FROM "tanggalLahir") = ${b}
        AND "statusAktif" = true
        AND "tanggalLahir" IS NOT NULL
    `

    const [kanban, goals, rekrutmen, kader] = await Promise.all([
      // Kanban deadline
      prisma.kanbanCard.findMany({
        where: { deadline: { gte: start, lte: end }, status: { not: 'DONE' } },
        select: { id: true, judul: true, deadline: true, status: true, platform: true,
          studioId: true },
        orderBy: { deadline: 'asc' },
      }),
      // Goal deadline
      prisma.goal.findMany({
        where: { deadline: { gte: start, lte: end } },
        select: { id: true, nama: true, deadline: true, currentValue: true, targetValue: true, satuan: true },
        orderBy: { deadline: 'asc' },
      }),
      // Rekrutmen baru bulan ini
      prisma.rekrutmen.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { id: true, namaCalon: true, createdAt: true, status: true, jalurMasuk: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Kader events
      prisma.kaderTimeline.findMany({
        where: { tanggal: { gte: start, lte: end } },
        select: { id: true, userId: true, tipeEvent: true, deskripsi: true, tanggal: true },
        orderBy: { tanggal: 'asc' },
      }),
    ])

    // Enrich studio names
    const studioIds = [...new Set([
      ...kanban.map(k => k.studioId),
    ].filter(Boolean))]
    const studios = await prisma.studio.findMany({
      where: { id: { in: studioIds } },
      select: { id: true, nama: true,
        circle:     { select: { colorHex: true } },
        rumahUsaha: { select: { colorHex: true } },
      },
    })
    const sMap = Object.fromEntries(studios.map(s => [s.id, s]))

    // Enrich user names
    const userIds = [...new Set([
      ...kader.map(k => k.userId),
    ].filter(Boolean))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nama: true },
    })
    const uMap = Object.fromEntries(users.map(u => [u.id, u.nama]))

    // Normalise ke format { id, tanggal, tipe, judul, detail, color }
    const events = [
      ...birthdays.map(u => {
        const tgl = new Date(u.tanggalLahir)
        // Gunakan tahun sekarang agar muncul di bulan yang tepat
        const tanggalIni = new Date(t, tgl.getMonth(), tgl.getDate())
        const usia = t - tgl.getFullYear()
        return {
          id: `bday-${u.id}`, tanggal: tanggalIni,
          tipe: 'ULANG_TAHUN',
          judul: `🎂 ${u.nama}`,
          detail: `Ulang tahun ke-${usia}${u.telegramUsername ? ` · @${u.telegramUsername}` : ''}`,
          color: '#ec4899',
        }
      }),
      ...kanban.map(k => ({
        id: `kanban-${k.id}`, tanggal: k.deadline,
        tipe: 'DEADLINE_PRODUKSI',
        judul: k.judul,
        detail: `${sMap[k.studioId]?.nama ?? '—'} · ${k.platform ?? k.status}`,
        color: (sMap[k.studioId]?.circle ?? sMap[k.studioId]?.rumahUsaha)?.colorHex ?? '#6B7280',
      })),
      ...goals.map(g => ({
        id: `goal-${g.id}`, tanggal: g.deadline,
        tipe: 'DEADLINE_GOAL',
        judul: g.nama,
        detail: `${g.currentValue}/${g.targetValue} ${g.satuan}`,
        color: '#7C3AED',
      })),
      ...rekrutmen.map(r => ({
        id: `rekrut-${r.id}`, tanggal: r.createdAt,
        tipe: 'REKRUTMEN',
        judul: r.namaCalon,
        detail: `${r.jalurMasuk.replace('_',' ')} · ${r.status}`,
        color: '#EA580C',
      })),
      ...kader.map(k => ({
        id: `kader-${k.id}`, tanggal: k.tanggal,
        tipe: 'EVENT_KADER',
        judul: k.tipeEvent,
        detail: `${uMap[k.userId] ?? '—'} · ${k.deskripsi.slice(0, 50)}`,
        color: '#06b6d4',
      })),
    ].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))

    return res.json({ success: true, data: events, bulan: b, tahun: t })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
