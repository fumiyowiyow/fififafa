import prisma from '../prisma.js'
import { canManageStudio } from '../utils/roles.js'

export const getPemilik = async (req, res) => {
  try {
    const { studioId } = req.params
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke kepemilikan studio ini' })

    const pemilik = await prisma.studioPemilik.findMany({
      where: { studioId },
      include: { user: { select: { id: true, nama: true, fotoUrl: true } } },
      orderBy: { persenSaham: 'desc' },
    })
    return res.json({ success: true, data: pemilik })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data kepemilikan' })
  }
}

export const createPemilik = async (req, res) => {
  try {
    const { studioId } = req.params
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke kepemilikan studio ini' })

    const { userId, persenSaham, keterangan } = req.body
    if (!userId) return res.status(422).json({ success: false, message: 'userId wajib diisi' })
    const persen = Number(persenSaham)
    if (persenSaham == null || Number.isNaN(persen) || persen < 0 || persen > 100) {
      return res.status(422).json({ success: false, message: 'persenSaham wajib angka 0-100' })
    }

    const pemilik = await prisma.$transaction(async (tx) => {
      // Total saham semua pemilik studio ini gak boleh lebih dari 100% -- dicek dalam transaction
      // (bukan cuma sebelum create) supaya aman dari race condition dua request nambah pemilik bersamaan.
      const agg = await tx.studioPemilik.aggregate({ where: { studioId }, _sum: { persenSaham: true } })
      const totalSaatIni = agg._sum.persenSaham ?? 0
      if (totalSaatIni + persen > 100) {
        throw Object.assign(new Error('OVER_100'), {
          message: `Total saham studio ini sudah ${totalSaatIni}% -- tambah ${persen}% akan melebihi 100%`,
        })
      }
      return tx.studioPemilik.create({
        data: { studioId, userId, persenSaham: persen, keterangan: keterangan || null },
        include: { user: { select: { id: true, nama: true, fotoUrl: true } } },
      })
    })
    return res.status(201).json({ success: true, data: pemilik })
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Orang ini sudah jadi pemilik studio ini' })
    }
    if (e.message?.includes('Total saham')) {
      return res.status(422).json({ success: false, message: e.message })
    }
    return res.status(500).json({ success: false, message: 'Gagal menambah pemilik' })
  }
}

export const updatePemilik = async (req, res) => {
  try {
    const { studioId, id } = req.params
    const existing = await prisma.studioPemilik.findUnique({ where: { id } })
    if (!existing || existing.studioId !== studioId) {
      return res.status(404).json({ success: false, message: 'Data kepemilikan tidak ditemukan' })
    }
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke kepemilikan studio ini' })

    const { persenSaham, keterangan } = req.body
    let persen
    if (persenSaham !== undefined) {
      persen = Number(persenSaham)
      if (Number.isNaN(persen) || persen < 0 || persen > 100) {
        return res.status(422).json({ success: false, message: 'persenSaham wajib angka 0-100' })
      }
    }

    const pemilik = await prisma.$transaction(async (tx) => {
      if (persen !== undefined) {
        // Total saham SEMUA pemilik LAIN (bukan baris yang sedang diedit) + persen baru gak boleh
        // lebih dari 100% -- dicek dalam transaction supaya aman dari race condition.
        const agg = await tx.studioPemilik.aggregate({
          where: { studioId, id: { not: id } },
          _sum: { persenSaham: true },
        })
        const totalLain = agg._sum.persenSaham ?? 0
        if (totalLain + persen > 100) {
          throw Object.assign(new Error('OVER_100'), {
            message: `Total saham pemilik lain sudah ${totalLain}% -- ${persen}% akan melebihi 100%`,
          })
        }
      }
      return tx.studioPemilik.update({
        where: { id },
        data: {
          ...(persen      !== undefined && { persenSaham: persen }),
          ...(keterangan  !== undefined && { keterangan: keterangan || null }),
        },
        include: { user: { select: { id: true, nama: true, fotoUrl: true } } },
      })
    })
    return res.json({ success: true, data: pemilik })
  } catch (e) {
    if (e.message?.includes('Total saham')) {
      return res.status(422).json({ success: false, message: e.message })
    }
    return res.status(500).json({ success: false, message: 'Gagal memperbarui kepemilikan' })
  }
}

export const deletePemilik = async (req, res) => {
  try {
    const { studioId, id } = req.params
    const existing = await prisma.studioPemilik.findUnique({ where: { id } })
    if (!existing || existing.studioId !== studioId) {
      return res.status(404).json({ success: false, message: 'Data kepemilikan tidak ditemukan' })
    }
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke kepemilikan studio ini' })

    await prisma.studioPemilik.delete({ where: { id } })
    return res.json({ success: true, message: 'Pemilik dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pemilik' })
  }
}
