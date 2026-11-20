import { Router } from 'express'
import { notifyUser, broadcast } from '../bot.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'
import { canManageMember } from '../utils/roles.js'
import prisma from '../prisma.js'

const router = Router()

const canNotify = checkRole(['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'])

// Kirim notifikasi ke satu user berdasarkan userId
router.post('/notify/:userId', authenticate, canNotify, async (req, res) => {
  try {
    if (!(await canManageMember(req.params.userId, req.userRoles))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke anggota ini' })
    }
    const { message } = req.body
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { telegramId: true, nama: true },
    })
    if (!user?.telegramId) {
      return res.status(404).json({ success: false, message: 'User belum daftarkan Telegram' })
    }
    const ok = await notifyUser(user.telegramId, message)
    return res.json({ success: ok, message: ok ? 'Terkirim' : 'Gagal kirim' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
})

// Broadcast ke semua koordinator+
router.post('/broadcast', authenticate,
  checkRole(['KEPALA_EKOSISTEM']),
  async (req, res) => {
    try {
      const { message } = req.body
      if (!message) return res.status(422).json({ success: false, message: 'message wajib' })
      const count = await broadcast(message)
      return res.json({ success: true, message: `Terkirim ke ${count} user`, count })
    } catch {
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
    }
  }
)

export default router
