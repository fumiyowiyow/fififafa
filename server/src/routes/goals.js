import { Router } from 'express'
import { getAll, create, updateProgress, remove } from '../controllers/goals.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'

const router = Router()

router.get('/',           authenticate, populateRoles, getAll)
router.post('/',          authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), create)
router.patch('/:id',      authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), updateProgress)
router.delete('/:id',     authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), remove)

export default router
