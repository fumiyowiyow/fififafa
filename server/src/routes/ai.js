import { Router } from 'express'
import { getInsights, chatWithAI } from '../controllers/ai.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()

const aiAccess = checkRole(['ADVISOR','KOORDINATOR','KEPALA_EKOSISTEM'])

router.get('/insights',  authenticate, aiAccess, getInsights)
router.post('/chat',     authenticate, aiAccess, chatWithAI)

export default router
