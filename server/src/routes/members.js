import { Router } from 'express'
import { getAll, getById, onboard, nonaktifkan, updateRole, updateRoleThp, addUserRole, removeUserRole, updateProfile, toggleLiveIn, toggleKoperasi, resetPassword, grantAccess, deleteUser } from '../controllers/members.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'

const router = Router()

const adminOnly = checkRole(['ADVISOR', 'KOORDINATOR', 'PENDAMPING', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA'])

router.get('/',                  authenticate, populateRoles, getAll)
router.get('/:id',               authenticate, populateRoles, getById)
router.post('/',                 authenticate, adminOnly, onboard)
router.patch('/:id/nonaktifkan',    authenticate, adminOnly, nonaktifkan)
router.patch('/roles/:roleId',      authenticate, adminOnly, updateRole)
router.patch('/roles/:roleId/thp',  authenticate, adminOnly, updateRoleThp)
router.delete('/roles/:roleId',     authenticate, adminOnly, removeUserRole)
router.post('/:id/roles',           authenticate, adminOnly, addUserRole)
router.patch('/:id/livein',          authenticate, adminOnly, toggleLiveIn)
router.patch('/:id/koperasi',        authenticate, adminOnly, toggleKoperasi)
router.patch('/:id/reset-password', authenticate, adminOnly, resetPassword)
router.patch('/:id/grant-access',   authenticate, adminOnly, grantAccess)
router.patch('/:id/profile',        authenticate, adminOnly, updateProfile)
router.delete('/:id',               authenticate, checkRole(['ADVISOR','KEPALA_EKOSISTEM']), deleteUser)

export default router
