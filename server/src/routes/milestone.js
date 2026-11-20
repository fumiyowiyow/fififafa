import { Router } from 'express'
import { getAll, create } from '../controllers/milestone.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()
router.get('/',  authenticate, getAll)
router.post('/', authenticate, checkRole(['ADVISOR', 'KOORDINATOR', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM']), create)
export default router
