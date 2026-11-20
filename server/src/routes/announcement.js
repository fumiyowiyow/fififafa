import { Router } from 'express'
import { getAll, create, remove } from '../controllers/announcement.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()

router.get('/',    authenticate, getAll)
router.post('/',   authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), create)
router.delete('/:id', authenticate, remove)

export default router
