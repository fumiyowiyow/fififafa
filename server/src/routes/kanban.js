import { Router } from 'express'
import { getByStudio, getAllStudios, create, update, updateStatus, remove,
         getColumns, createColumn, updateColumn, deleteColumn, uploadHasil } from '../controllers/kanban.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, checkMinRole } from '../middleware/checkRole.js'
import { uploadKanban } from '../middleware/upload.js'

const KANBAN_MANAGERS = ['ADVISOR', 'KOORDINATOR', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM', 'ADMIN_FUNGSIONAL']

const router = Router()

router.get('/studios',                 authenticate, getAllStudios)
// KanbanColumn routes harus SEBELUM /:studioId agar tidak tertimpa
router.get('/columns/:studioId',       authenticate, getColumns)
router.post('/columns',                authenticate, checkRole(KANBAN_MANAGERS), createColumn)
router.put('/columns/:id',             authenticate, checkRole(KANBAN_MANAGERS), updateColumn)
router.delete('/columns/:id',          authenticate, checkRole(KANBAN_MANAGERS), deleteColumn)
// Upload hasil karya
router.post('/:id/upload-hasil',       authenticate, checkRole(KANBAN_MANAGERS), uploadKanban.single('file'), uploadHasil)
// Generic routes di bawah
// checkMinRole('KADER') -- KanbanCard.nilaiOrder itu nilai order/deal per kartu (data finansial),
// gak dijaga sama sekali sebelumnya (cuma authenticate). Gak ada halaman web yang konsumsi
// endpoint ini (Kanban cuma ada di Telegram bot, yang query Prisma langsung bukan lewat sini),
// jadi aman di-block penuh, gak perlu field-mask kayak health.js/dashboard.js.
router.get('/:studioId',              authenticate, checkMinRole('KADER'), getByStudio)
router.post('/',                       authenticate, checkRole(KANBAN_MANAGERS), create)
router.put('/:id',                     authenticate, checkRole(KANBAN_MANAGERS), update)
router.patch('/:id/status',            authenticate, checkRole(KANBAN_MANAGERS), updateStatus)
router.delete('/:id',                  authenticate, checkRole(KANBAN_MANAGERS), remove)

export default router
