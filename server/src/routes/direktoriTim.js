import { Router } from 'express'
import { authenticate }  from '../middleware/auth.js'
import { populateRoles } from '../middleware/checkRole.js'
import { getHierarchy }  from '../controllers/direktoriTim.js'

const router = Router()
router.get('/', authenticate, populateRoles, getHierarchy)

export default router
