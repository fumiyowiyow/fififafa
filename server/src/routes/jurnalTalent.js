import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'
import { getByUser } from '../controllers/jurnalTalent.js'

// Arsip baca-saja sejak 13 Okt 2026 -- lihat controllers/jurnalTalent.js.
const router = Router()
const mentorOnly = checkRole(['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'])

router.get('/:userId',  authenticate, mentorOnly, getByUser)

export default router
