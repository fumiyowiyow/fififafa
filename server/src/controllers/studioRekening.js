import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { snapshotKasMingguIni } from '../utils/kas.js'

// Saldo rekening = sumber kas resmi; laporan mingguan minggu berjalan ikut diselaraskan tiap
// saldo berubah. Gagal sinkron gak boleh ngegagalin simpan rekening-nya sendiri.
const sinkronKas = (studioId) => snapshotKasMingguIni(studioId).catch(() => {})

// Data rekening bank studio sensitif, jadi wajib dibatasi. 21 Okt 2026 (keputusan user): HANYA pengelola unit itu
// (Koordinator/Pendamping unit, Kepala Circle/Rumah Usaha pemiliknya, Super Admin) — talent (Kader/Karyawan/Magang) tidak
// melihat uang, dan peran pengelola di unit lain tidak berlaku di sini.
function canAccessStudioRekening(req, studioId) {
  return kelolaStudio(req.userRoles ?? [], studioId)
}

export const getRekening = async (req, res) => {
  try {
    const allowed = await canAccessStudioRekening(req, req.params.studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke rekening studio ini' })

    const rekening = await prisma.studioRekening.findMany({
      where: { studioId: req.params.studioId },
      orderBy: { createdAt: 'asc' },
    })
    return res.json({ success: true, data: rekening })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data rekening' })
  }
}

export const createRekening = async (req, res) => {
  try {
    const allowed = await canAccessStudioRekening(req, req.params.studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke rekening studio ini' })

    const { namaBank, nomorRekening, atasNama, saldo } = req.body
    if (!namaBank || !nomorRekening || !atasNama) {
      return res.status(422).json({ success: false, message: 'namaBank, nomorRekening, atasNama wajib diisi' })
    }
    const rekening = await prisma.studioRekening.create({
      data: {
        studioId:      req.params.studioId,
        namaBank,
        nomorRekening,
        atasNama,
        saldo:         saldo != null ? Number(saldo) : 0,
      },
    })
    await sinkronKas(req.params.studioId)
    return res.status(201).json({ success: true, data: rekening })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menambah rekening' })
  }
}

export const updateRekening = async (req, res) => {
  try {
    const existing = await prisma.studioRekening.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.studioId !== req.params.studioId) {
      return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan' })
    }
    const allowed = await canAccessStudioRekening(req, req.params.studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke rekening studio ini' })

    const { namaBank, nomorRekening, atasNama, saldo } = req.body
    const rekening = await prisma.studioRekening.update({
      where: { id: req.params.id },
      data: {
        ...(namaBank      !== undefined && { namaBank }),
        ...(nomorRekening !== undefined && { nomorRekening }),
        ...(atasNama      !== undefined && { atasNama }),
        ...(saldo         !== undefined && { saldo: Number(saldo) }),
      },
    })
    if (saldo !== undefined) await sinkronKas(req.params.studioId)
    return res.json({ success: true, data: rekening })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui rekening' })
  }
}

export const deleteRekening = async (req, res) => {
  try {
    const existing = await prisma.studioRekening.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.studioId !== req.params.studioId) {
      return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan' })
    }
    const allowed = await canAccessStudioRekening(req, req.params.studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke rekening studio ini' })

    await prisma.studioRekening.delete({ where: { id: req.params.id } })
    await sinkronKas(req.params.studioId)
    return res.json({ success: true, message: 'Rekening dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus rekening' })
  }
}
