import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, refresh, logout, me } from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true, // yang dihitung hanya percobaan GAGAL — satu WiFi studio boleh login serempak
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit' },
})

const router = Router()

router.post('/login',   loginLimiter, login)
router.post('/refresh', refresh)
router.post('/logout',  logout)
router.get('/me',       authenticate, me)

export default router
