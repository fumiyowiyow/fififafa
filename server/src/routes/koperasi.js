import { Router } from 'express'
import {
  getNasabah, getRiwayat,
  laporSimpanan, upsertSimpanan,
  konfirmasiSimpanan, getMenunggu, getBadgeCount, getMonthlySummary,
} from '../controllers/koperasi.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'

const router   = Router()
// Cocok persis dengan isAdmin() di controllers/koperasi.js — sebelumnya route ini lebih
// sempit dari controller (gak termasuk ADVISOR/KEPALA_CIRCLE/KEPALA_RUMAH_USAHA), jadi ketiga
// role itu keliatan tombol admin di client tapi 403 pas diklik.
const adminOnly = checkRole(['ADVISOR','ADMIN_FUNGSIONAL','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA'])

router.get('/badge',                 authenticate, adminOnly, getBadgeCount)
router.get('/monthly-summary',       authenticate, adminOnly, getMonthlySummary)
router.get('/nasabah',               authenticate, populateRoles, getNasabah)
router.get('/riwayat/:tipe/:id',     authenticate, populateRoles, getRiwayat)
router.get('/menunggu',              authenticate, adminOnly, getMenunggu)

router.post('/lapor',                authenticate, populateRoles, laporSimpanan) // self-report
router.post('/simpanan',             authenticate, adminOnly, upsertSimpanan) // admin input langsung
router.patch('/konfirmasi/:id',      authenticate, adminOnly, konfirmasiSimpanan) // admin confirm/tolak

export default router
