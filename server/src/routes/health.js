import { Router } from 'express'
import { getEcosystem } from '../controllers/health.js'
import { authenticate } from '../middleware/auth.js'
import { checkMinRole } from '../middleware/checkRole.js'

const router = Router()

// KADER ke atas (23 Okt 2026): Karyawan/Magang tidak mengirim laporan studio, data per circle bukan untuk mereka.
router.get('/ecosystem', authenticate, checkMinRole('KADER'), getEcosystem)

export default router
