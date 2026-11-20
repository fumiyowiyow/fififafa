import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'
import { getByUser, create, update, remove, getSkorRingkasan } from '../controllers/penilaianKader.js'

const router = Router()
const mentorOnly = checkRole(['KOORDINATOR', 'PENDAMPING', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM', 'ADVISOR'])

// /skor-ringkasan WAJIB didaftarkan sebelum /:userId -- kalau kebalik, request ke /skor-ringkasan
// bakal ketangkep /:userId (dengan userId="skor-ringkasan") duluan.
router.get('/skor-ringkasan', authenticate, mentorOnly, getSkorRingkasan)
router.get('/:userId',        authenticate, mentorOnly, getByUser)
router.post('/',              authenticate, mentorOnly, create)
router.patch('/:id',          authenticate, mentorOnly, update)
router.delete('/:id',         authenticate, mentorOnly, remove)

export default router
