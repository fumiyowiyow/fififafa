import { Router } from 'express'
import { getTimeline, addEvent, updateEvent, removeEvent, getAll } from '../controllers/kader.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'

const router = Router()

const canWrite = checkRole(['ADVISOR','KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'])
// getAll = feed org-wide (bukan punya siapapun spesifik) — staff-only, beda dari getTimeline
// yang boleh diakses pemilik sendiri juga (dicek di controller lewat canAccessKader).
const canViewFeed = checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'])

router.get('/',          authenticate, canViewFeed, getAll)
router.get('/:userId',   authenticate, populateRoles, getTimeline)
router.post('/',         authenticate, canWrite, addEvent)
router.put('/:id',       authenticate, canWrite, updateEvent)
router.delete('/:id',    authenticate, canWrite, removeEvent)

export default router
