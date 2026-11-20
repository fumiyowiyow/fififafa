import { Router } from 'express'
import { getStudioRanking, getMonthlyTrend } from '../controllers/performance.js'
import { authenticate } from '../middleware/auth.js'
import { checkMinRole } from '../middleware/checkRole.js'

const router = Router()

router.get('/studios', authenticate, checkMinRole('KADER'), getStudioRanking)
router.get('/monthly', authenticate, checkMinRole('KADER'), getMonthlyTrend)

export default router
