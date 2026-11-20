import { Router } from 'express'
import {
  getRateCard, createRateCard, updateRateCard, getLembur, createLembur,
  getTunjanganTemplate, createTunjanganTemplate, updateTunjanganTemplate,
  generatePenggajian, updatePenggajian, finalizePenggajian, tandaiDibayarPenggajian,
  getPenggajianList, getSlip,
  addTunjanganExtra, updateTunjanganJumlah, deleteTunjangan, getOrderOpsi, getLemburPresensi, setTarifLembur } from '../controllers/payroll.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'
import { STAFF_PLUS } from '../utils/roles.js'

// Fase 3 bagian 2/2 -- Penggajian. Rate card & catatan lembur (bagian 1/2) semua KOORDINATOR ke
// atas, TERMASUK read (data payroll lebih sensitif dari order tracking biasa). Penggajian beda
// dikit: GET list & GET slip pakai `populateRoles` (bukan checkRole) biar KARYAWAN/MAGANG/KADER
// biasa juga bisa lewat middleware-nya -- controller yang nyaring ke "lihat punya sendiri doang"
// buat non-manager, sama persis pola getOrders di produksi.js.
const router = Router()

router.get('/rate-card',    authenticate, checkRole(STAFF_PLUS), getRateCard)
router.post('/rate-card',   authenticate, checkRole(STAFF_PLUS), createRateCard)
router.patch('/rate-card/:id', authenticate, checkRole(STAFF_PLUS), updateRateCard)

router.get('/lembur',  authenticate, checkRole(STAFF_PLUS), getLembur)
router.get('/order-opsi', authenticate, checkRole(STAFF_PLUS), getOrderOpsi)
router.get('/lembur-presensi', authenticate, checkRole(STAFF_PLUS), getLemburPresensi)
router.put('/tarif-lembur', authenticate, checkRole(STAFF_PLUS), setTarifLembur)
router.post('/lembur', authenticate, checkRole(STAFF_PLUS), createLembur)

router.get('/tunjangan-template',     authenticate, checkRole(STAFF_PLUS), getTunjanganTemplate)
router.post('/tunjangan-template',    authenticate, checkRole(STAFF_PLUS), createTunjanganTemplate)
router.patch('/tunjangan-template/:id', authenticate, checkRole(STAFF_PLUS), updateTunjanganTemplate)

router.post('/generate', authenticate, checkRole(STAFF_PLUS), generatePenggajian)

router.get('/',  authenticate, populateRoles, getPenggajianList)
router.patch('/:id', authenticate, checkRole(STAFF_PLUS), updatePenggajian)
router.post('/:id/finalize',       authenticate, checkRole(STAFF_PLUS), finalizePenggajian)
router.post('/:id/tandai-dibayar', authenticate, checkRole(STAFF_PLUS), tandaiDibayarPenggajian)
router.get('/:id/slip', authenticate, populateRoles, getSlip)

router.post('/:id/tunjangan',   authenticate, checkRole(STAFF_PLUS), addTunjanganExtra)
router.patch('/tunjangan/:id',  authenticate, checkRole(STAFF_PLUS), updateTunjanganJumlah)
router.delete('/tunjangan/:id', authenticate, checkRole(STAFF_PLUS), deleteTunjangan)

export default router
