import { Router } from 'express'
import { authenticate }             from '../middleware/auth.js'
import { populateRoles, checkRole } from '../middleware/checkRole.js'
import * as ctrl                    from '../controllers/modul.js'

const ADMIN_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']

const router    = Router()
const allAuth   = [authenticate, populateRoles]
const adminAuth = [authenticate, checkRole(ADMIN_ROLES)]

router.get('/',       ...allAuth,  ctrl.getAll)
router.get('/:id',    ...allAuth,  ctrl.getById)
router.post('/',      ...adminAuth, ctrl.create)
router.put('/:id',    ...adminAuth, ctrl.update)
router.delete('/:id', ...adminAuth, ctrl.remove)

export default router
