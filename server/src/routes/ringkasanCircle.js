import { Router } from 'express'
import { getRingkasan } from '../controllers/ringkasanCircle.js'
import { authenticate } from '../middleware/auth.js'
import { checkMinRole } from '../middleware/checkRole.js'

const router = Router()

// Halaman "Web Circle" di Management Dashboard (14 Nov 2026): Koordinator ke atas; isi disaring per wilayah (lingkupKeuangan) di controller.
// Token web circle (aud:'circle') tidak bisa menjangkau rute ini (hanya /api/circle & /api/auth — middleware/auth.js).
router.get('/ringkasan', authenticate, checkMinRole('KOORDINATOR'), getRingkasan)

export default router
