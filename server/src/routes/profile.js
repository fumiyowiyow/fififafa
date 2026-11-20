import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { getProfile, updateProfile, changePassword, buatKodeTelegram, putuskanTelegram } from '../controllers/profile.js'
import { authenticate } from '../middleware/auth.js'

// Ganti password butuh passwordLama yang benar — tanpa limiter khusus, endpoint ini cuma
// dilindungi rate limit global (1000/15menit), jauh lebih longgar dari loginLimiter (30/15menit)
// padahal sama-sama rawan dipakai brute-force kalau access token seseorang bocor.
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan, coba lagi dalam 15 menit' },
})

// Membuat kode tautan Telegram: batasi per AKUN (bukan per IP — banyak anggota sering memakai IP yang
// sama, mis. WiFi kantor/sekolah, dan tidak boleh saling menghabiskan jatah).
const kodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `kode-telegram:${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan kode, coba lagi dalam 15 menit' },
})

const router = Router()

router.get('/',           authenticate, getProfile)
router.put('/',           authenticate, updateProfile)
router.post('/password',  authenticate, passwordLimiter, changePassword)
router.post('/telegram/kode', authenticate, kodeLimiter, buatKodeTelegram)
router.delete('/telegram',    authenticate, putuskanTelegram)

export default router
