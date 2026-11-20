import { Router }           from 'express'
import { authenticate }     from '../middleware/auth.js'
import { checkMinRole }     from '../middleware/checkRole.js'
import {
  getEcosystemData,
  upsertEcosystemData,
  getStudioCpm,
  upsertStudioCpm,
  getMonthlySummary,
} from '../controllers/monthlyData.js'

const router = Router()

router.get('/summary',   authenticate, checkMinRole('KADER'), getMonthlySummary)
router.get('/ecosystem', authenticate, checkMinRole('KADER'), getEcosystemData)
router.post('/ecosystem', authenticate, checkMinRole('ADMIN_FUNGSIONAL'), upsertEcosystemData)
router.get('/cpm',  authenticate, checkMinRole('KADER'), getStudioCpm)
router.post('/cpm', authenticate, checkMinRole('KOORDINATOR'), upsertStudioCpm)

export default router
