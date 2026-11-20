import prisma from '../prisma.js'
import { canManageStudio } from '../utils/roles.js'


export const getByStudio = async (req, res) => {
  try {
    const { studioId } = req.params
    const cards = await prisma.kanbanCard.findMany({
      where: { studioId },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })
    return res.json({ success: true, data: cards })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getAllStudios = async (req, res) => {
  try {
    const studios = await prisma.studio.findMany({
      where: { statusAktif: true },
      select: {
        id: true, nama: true, tipe: true,
        circle:     { select: { id: true, nama: true, colorHex: true } },
        rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
        _count: { select: { weeklyReports: true } },
      },
      orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
    })
    return res.json({ success: true, data: studios })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const create = async (req, res) => {
  try {
    const { studioId, judul, platform, nilaiOrder, deadline, assigneeId, linkBrief, kolomId } = req.body
    if (!studioId || !judul) {
      return res.status(422).json({ success: false, message: 'studioId dan judul wajib' })
    }
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa buat card studio sendiri' })
    }
    const card = await prisma.kanbanCard.create({
      data: {
        studioId, judul,
        platform:   platform   ?? null,
        nilaiOrder: nilaiOrder ? Number(nilaiOrder) : null,
        deadline:   deadline   ? new Date(deadline) : null,
        assigneeId: assigneeId ?? null,
        linkBrief:  linkBrief  ?? null,
        kolomId:    kolomId    ?? null,
        status: 'TODO',
      },
    })
    return res.status(201).json({ success: true, data: card })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── KanbanColumn CRUD ────────────────────────────────────

export const getColumns = async (req, res) => {
  try {
    const cols = await prisma.kanbanColumn.findMany({
      where: { studioId: req.params.studioId },
      orderBy: { urutan: 'asc' },
    })
    return res.json({ success: true, data: cols })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createColumn = async (req, res) => {
  try {
    const { studioId, nama, warna, urutan } = req.body
    if (!studioId || !nama) return res.status(422).json({ success: false, message: 'studioId dan nama wajib' })
    if (!(await canManageStudio(req.userRoles, studioId))) {
      return res.status(403).json({ success: false, message: 'Hanya bisa kelola kolom studio sendiri' })
    }
    const col = await prisma.kanbanColumn.create({
      data: { studioId, nama, warna: warna || '#6B7280', urutan: urutan ?? 0 },
    })
    return res.status(201).json({ success: true, data: col })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

async function checkColumnOwnership(columnId, userRoles) {
  const column = await prisma.kanbanColumn.findUnique({ where: { id: columnId }, select: { studioId: true } })
  if (!column) return { error: 'Kolom tidak ditemukan', status: 404 }
  if (!(await canManageStudio(userRoles, column.studioId))) {
    return { error: 'Hanya bisa kelola kolom studio sendiri', status: 403 }
  }
  return { column }
}

export const updateColumn = async (req, res) => {
  try {
    const check = await checkColumnOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    const { nama, warna, urutan } = req.body
    const col = await prisma.kanbanColumn.update({
      where: { id: req.params.id },
      data: {
        ...(nama   !== undefined && { nama }),
        ...(warna  !== undefined && { warna }),
        ...(urutan !== undefined && { urutan: Number(urutan) }),
      },
    })
    return res.json({ success: true, data: col })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const deleteColumn = async (req, res) => {
  try {
    const check = await checkColumnOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    // Reset card yang pakai kolom ini ke null
    await prisma.kanbanCard.updateMany({ where: { kolomId: req.params.id }, data: { kolomId: null } })
    await prisma.kanbanColumn.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Kolom dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ─────────────────────────────────────────────────────────

async function checkCardOwnership(cardId, userRoles) {
  const card = await prisma.kanbanCard.findUnique({ where: { id: cardId }, select: { studioId: true } })
  if (!card) return { error: 'Card tidak ditemukan', status: 404 }
  if (!(await canManageStudio(userRoles, card.studioId))) {
    return { error: 'Hanya bisa edit card studio sendiri', status: 403 }
  }
  return { card }
}

export const update = async (req, res) => {
  try {
    const check = await checkCardOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    const { judul, platform, nilaiOrder, deadline, assigneeId, linkBrief, linkHasilKarya, kolomId } = req.body
    const card = await prisma.kanbanCard.update({
      where: { id: req.params.id },
      data: {
        ...(judul          !== undefined && { judul }),
        ...(platform       !== undefined && { platform: platform || null }),
        ...(nilaiOrder     !== undefined && { nilaiOrder: nilaiOrder ? Number(nilaiOrder) : null }),
        ...(deadline       !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(assigneeId     !== undefined && { assigneeId: assigneeId || null }),
        ...(linkBrief      !== undefined && { linkBrief: linkBrief || null }),
        ...(linkHasilKarya !== undefined && { linkHasilKarya: linkHasilKarya || null }),
        ...(kolomId        !== undefined && { kolomId: kolomId || null }),
      },
    })
    return res.json({ success: true, data: card })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateStatus = async (req, res) => {
  try {
    const check = await checkCardOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    const { status } = req.body
    const VALID = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']
    if (!VALID.includes(status)) {
      return res.status(422).json({ success: false, message: `Status harus salah satu: ${VALID.join(', ')}` })
    }
    const card = await prisma.kanbanCard.update({
      where: { id: req.params.id },
      data:  { status },
    })
    return res.json({ success: true, data: card })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const remove = async (req, res) => {
  try {
    const check = await checkCardOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    await prisma.kanbanCard.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Card dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const uploadHasil = async (req, res) => {
  try {
    if (!req.file) return res.status(422).json({ success: false, message: 'File tidak ditemukan' })
    const check = await checkCardOwnership(req.params.id, req.userRoles)
    if (check.error) return res.status(check.status).json({ success: false, message: check.error })

    const fileUrl = `/uploads/kanban/${req.file.filename}`
    const card = await prisma.kanbanCard.update({
      where: { id: req.params.id },
      data: { linkHasilKarya: fileUrl },
    })
    return res.json({ success: true, data: card, url: fileUrl })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
