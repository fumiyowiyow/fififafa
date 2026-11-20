import { Router } from 'express'
import { getAll, create, update, remove } from '../controllers/asset.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, checkMinRole } from '../middleware/checkRole.js'
import { ASSET_MANAGERS } from '../utils/roles.js'

const router = Router()

// Aset & Inventaris hanya untuk Koordinator ke atas (15 Okt 2026) -- Kader dan di bawahnya tidak punya akses.
router.get('/',        authenticate, checkMinRole('KOORDINATOR'), getAll)
router.post('/',       authenticate, checkRole(ASSET_MANAGERS), create)
router.patch('/:id',   authenticate, checkRole(ASSET_MANAGERS), update)
router.delete('/:id',  authenticate, checkRole(ASSET_MANAGERS), remove)

export default router
