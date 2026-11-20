import prisma from '../prisma.js'
import { canManageStudio } from '../utils/roles.js'

// Roster anggota studio KHUSUS buat Bio Studio — beda dari GET /api/members?studioId=X yang
// terbuka buat semua staf (lihat komentar di getAll, sengaja org-wide). Endpoint ini cuma buka
// buat admin studio/circle itu sendiri, dan TIDAK masking takeHomePay (perlu buat edit inline).
export const getStudioRoster = async (req, res) => {
  try {
    const { studioId } = req.params
    const allowed = await canManageStudio(req.userRoles ?? [], studioId)
    if (!allowed) return res.status(403).json({ success: false, message: 'Tidak punya akses ke roster studio ini' })

    const users = await prisma.user.findMany({
      where: { statusAktif: true, roles: { some: { studioId } } },
      select: {
        id: true, nama: true, nomorWa: true,
        roles: {
          where: { studioId },
          select: { id: true, roleType: true, studioId: true, circleId: true, takeHomePay: true },
        },
      },
      orderBy: { nama: 'asc' },
    })
    return res.json({ success: true, data: users })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil roster studio' })
  }
}
