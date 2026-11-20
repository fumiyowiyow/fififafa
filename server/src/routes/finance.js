import { Router } from 'express'
import { getPosts, getPaymentMatrix, getKasSummary, createPost, updatePost, deletePost } from '../controllers/finance.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, checkMinRole, populateRoles } from '../middleware/checkRole.js'

const router = Router()
const adminOnly = checkRole(['ADVISOR', 'KEPALA_EKOSISTEM'])

router.get('/posts',                   authenticate, checkMinRole('KADER'), getPosts)
router.get('/payments/:bulan/:tahun',  authenticate, checkMinRole('KADER'), getPaymentMatrix)
router.get('/kas',                     authenticate, checkMinRole('KADER'), getKasSummary)

router.post('/posts',      authenticate, adminOnly, createPost)
// PUT bukan adminOnly -- Kepala Circle/Kepala Rumah Usaha (scope cocok) dan si Admin/pengelola
// pos itu sendiri juga boleh update, dicek di dalam controller (lihat updatePost). Tambah pos
// baru & hapus pos tetap superadmin-only.
router.put('/posts/:id',   authenticate, populateRoles, updatePost)
router.delete('/posts/:id', authenticate, adminOnly, deletePost)

export default router
