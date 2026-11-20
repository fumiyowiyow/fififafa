import { Router } from 'express'
import { authenticate }             from '../middleware/auth.js'
import { populateRoles }            from '../middleware/checkRole.js'
import * as ctrl                    from '../controllers/memori.js'

const router = Router()
const auth   = [authenticate, populateRoles]

router.get('/',       ...auth, ctrl.getAll)
router.get('/:id',    ...auth, ctrl.getById)
router.post('/',      ...auth, ctrl.create)
router.put('/:id',    ...auth, ctrl.update)
router.delete('/:id', ...auth, ctrl.remove)

export default router
