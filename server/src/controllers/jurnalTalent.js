import prisma from '../prisma.js'
import { canManageMember } from '../utils/roles.js'

// Jurnal Talent = ARSIP sejak 30 Jul 2026 (digantikan Penilaian Kader). Cuma baca riwayat lama
// yang tersisa; endpoint tulis (POST/PATCH/DELETE) & badge dihapus 13 Okt 2026 -- gak ada
// pemanggilnya lagi di client.

const MENTOR_ROLES = ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR']

function isMentor(roles) {
  return roles?.some(r => MENTOR_ROLES.includes(r.roleType))
}

export async function getByUser(req, res) {
  try {
    if (!isMentor(req.userRoles)) return res.status(403).json({ success: false, message: 'Akses ditolak' })
    const { userId } = req.params
    // Dibatasi lingkup masing-masing (13 Okt 2026): Super Admin semua; Koordinator/Pendamping
    // unitnya; Kepala Circle / Rumah Usaha wilayahnya. Dulu semua mentor bisa baca jurnal siapa pun.
    if (!(await canManageMember(userId, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }
    const jurnal = await prisma.jurnalTalent.findMany({
      where: { userId },
      include: { penulis: { select: { id: true, nama: true } } },
      orderBy: { periodeAwal: 'desc' },
    })
    res.json({ success: true, data: jurnal })
  } catch {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
