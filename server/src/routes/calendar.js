import { Router }    from 'express'
import { getEvents } from '../controllers/calendar.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.get('/', authenticate, getEvents)
export default router
