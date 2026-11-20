import { Router } from 'express'
import { getStatus, create, update } from '../controllers/orgFundReport.js'
import { authenticate } from '../middleware/auth.js'
import { populateRoles, checkMinRole } from '../middleware/checkRole.js'

const router = Router()

router.get('/status', authenticate, checkMinRole('KADER'), getStatus)
router.post('/',      authenticate, populateRoles, create)
router.put('/:id',    authenticate, populateRoles, update)

export default router
