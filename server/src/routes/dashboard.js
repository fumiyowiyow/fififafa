import { Router } from 'express'
import { overview } from '../controllers/dashboard.js'
import { authenticate } from '../middleware/auth.js'
import { populateRoles } from '../middleware/checkRole.js'

const router = Router()

// Bukan checkMinRole -- endpoint ini juga dipakai halaman Goals (unrestricted) buat ambil daftar
// circle/rumah usaha (bukan data keuangan). Field omset di dalamnya di-mask di controller,
// bukan di-block total di sini.
router.get('/overview', authenticate, populateRoles, overview)

export default router
