import { Router } from 'express'
import { getAll, create, updateStatus, remove, getBadge, jadikanAnggota } from '../controllers/rekrutmen.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()

router.get('/badge',      authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), getBadge)
router.get('/',           authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), getAll)
router.post('/',          authenticate, checkRole(['ADVISOR','KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), create)
router.patch('/:id/status',          authenticate, checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), updateStatus)
router.post('/:id/jadikan-anggota',  authenticate, checkRole(['ADVISOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), jadikanAnggota)
// KOORDINATOR sengaja TIDAK termasuk di sini (beda dari route lain) -- studioTujuan cuma
// teks bebas (bukan FK ke Studio), jadi belum bisa dibatasi per-studio; hapus permanen data
// kandidat (termasuk rantai referral) dibatasi ke level circle/rumah usaha/admin ke atas dulu
// sampai ada keputusan bikin studioTujuan jadi relasi asli.
router.delete('/:id',                authenticate, checkRole(['ADVISOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']), remove)

export default router
