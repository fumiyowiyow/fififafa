import { Router } from 'express'
import { getCpmBulanan, simpanCpmBulanan, resetCpmBulanan } from '../controllers/cpmBulanan.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()

// Cakupan unit dicek di controller (kelolaStudio).
const pengelola = checkRole(['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KOORDINATOR','PENDAMPING'])

router.get('/',    authenticate, pengelola, getCpmBulanan)
router.put('/',    authenticate, pengelola, simpanCpmBulanan)
router.delete('/', authenticate, pengelola, resetCpmBulanan)

export default router
