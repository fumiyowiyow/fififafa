import prisma from '../prisma.js'
import { kelolaStudio as canManageStudio } from '../utils/roles.js' // per unit, tanpa talent (21 Okt 2026)
import { getStudioCpmBreakdown, getDefaultPengeluaranRutinTemplate } from '../utils/cpm.js'

const KATEGORI_VALID = ['SUBSCRIPTION', 'SUPPORT', 'LAINNYA']

export const getPengeluaranRutin = async (req, res) => {
  try {
    const { studioId } = req.params
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke data ini' })

    const [items, cpm] = await Promise.all([
      prisma.studioPengeluaranRutin.findMany({
        where: { studioId },
        orderBy: [{ kategori: 'asc' }, { createdAt: 'asc' }],
      }),
      getStudioCpmBreakdown(studioId),
    ])
    return res.json({ success: true, data: { items, cpm } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data pengeluaran rutin' })
  }
}

export const createPengeluaranRutin = async (req, res) => {
  try {
    const { studioId } = req.params
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke data ini' })

    const { kategori, nama, jumlah } = req.body
    if (!KATEGORI_VALID.includes(kategori)) {
      return res.status(422).json({ success: false, message: 'kategori wajib salah satu: SUBSCRIPTION, SUPPORT, LAINNYA' })
    }
    if (!nama?.trim()) return res.status(422).json({ success: false, message: 'nama wajib diisi' })
    const jml = Number(jumlah)
    if (!Number.isFinite(jml) || jml < 0) return res.status(422).json({ success: false, message: 'jumlah wajib angka >= 0' })

    const item = await prisma.studioPengeluaranRutin.create({
      data: { studioId, kategori, nama: nama.trim(), jumlah: jml },
    })
    return res.status(201).json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menambah pengeluaran rutin' })
  }
}

export const updatePengeluaranRutin = async (req, res) => {
  try {
    const { studioId, id } = req.params
    const existing = await prisma.studioPengeluaranRutin.findUnique({ where: { id } })
    if (!existing || existing.studioId !== studioId) {
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan' })
    }
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke data ini' })

    const { kategori, nama, jumlah } = req.body
    if (kategori !== undefined && !KATEGORI_VALID.includes(kategori)) {
      return res.status(422).json({ success: false, message: 'kategori wajib salah satu: SUBSCRIPTION, SUPPORT, LAINNYA' })
    }
    if (nama !== undefined && !nama.trim()) {
      return res.status(422).json({ success: false, message: 'nama tidak boleh kosong' })
    }
    let jml
    if (jumlah !== undefined) {
      jml = Number(jumlah)
      if (!Number.isFinite(jml) || jml < 0) return res.status(422).json({ success: false, message: 'jumlah wajib angka >= 0' })
    }

    const item = await prisma.studioPengeluaranRutin.update({
      where: { id },
      data: {
        ...(kategori !== undefined && { kategori }),
        ...(nama     !== undefined && { nama: nama.trim() }),
        ...(jumlah   !== undefined && { jumlah: jml }),
      },
    })
    return res.json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengeluaran rutin' })
  }
}

export const deletePengeluaranRutin = async (req, res) => {
  try {
    const { studioId, id } = req.params
    const existing = await prisma.studioPengeluaranRutin.findUnique({ where: { id } })
    if (!existing || existing.studioId !== studioId) {
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan' })
    }
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke data ini' })

    await prisma.studioPengeluaranRutin.delete({ where: { id } })
    return res.json({ success: true, message: 'Item dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pengeluaran rutin' })
  }
}

// Isi template default -- cuma nambahin item yang NAMANYA belum ada di studio ini (idempotent,
// aman dipencet berkali-kali), dipicu manual lewat tombol UI (bukan otomatis pas GET).
export const seedDefaultPengeluaranRutin = async (req, res) => {
  try {
    const { studioId } = req.params
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke data ini' })

    const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { nama: true } })
    if (!studio) return res.status(404).json({ success: false, message: 'Studio tidak ditemukan' })

    const existing = await prisma.studioPengeluaranRutin.findMany({ where: { studioId }, select: { nama: true } })
    const existingNames = new Set(existing.map(i => i.nama.toLowerCase()))

    const toCreate = getDefaultPengeluaranRutinTemplate(studio.nama)
      .filter(t => !existingNames.has(t.nama.toLowerCase()))
      .map(t => ({ ...t, studioId }))

    if (toCreate.length > 0) {
      await prisma.studioPengeluaranRutin.createMany({ data: toCreate })
    }
    const items = await prisma.studioPengeluaranRutin.findMany({
      where: { studioId },
      orderBy: [{ kategori: 'asc' }, { createdAt: 'asc' }],
    })
    return res.json({ success: true, data: items, message: `${toCreate.length} item template ditambahkan` })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengisi template default' })
  }
}
