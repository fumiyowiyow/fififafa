import { Router } from 'express'
import { list, create, update, remove, hapusTotalLama } from '../controllers/pengeluaran.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()

// Role sama dengan yang boleh kirim laporan mingguan; cakupan studio dicek di controller.
const pelapor = checkRole(['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'])

router.get('/',       authenticate, pelapor, list)
router.post('/',      authenticate, pelapor, create)
router.put('/:id',    authenticate, pelapor, update)
router.delete('/total-lama', authenticate, pelapor, hapusTotalLama) // sebelum '/:id'
router.delete('/:id', authenticate, pelapor, remove)

export default router
