import { Router } from 'express'
import {
  getPool, updatePool, getPengelolaList, getTimeline,
  getUnits, createUnit, updateUnit, removeUnit,
  getLaporan, createLaporan, updateLaporan, removeLaporan,
  getTransaksi, createTransaksi, removeTransaksi,
} from '../controllers/danaPengembangan.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole } from '../middleware/checkRole.js'

const router = Router()
const onlyPengelola = checkRole(['PENGELOLA_DANA']) // TIDAK ada bypass admin — sengaja isolated

router.get('/pool', authenticate, onlyPengelola, getPool)
router.put('/pool', authenticate, onlyPengelola, updatePool)

router.get('/pengelola', authenticate, onlyPengelola, getPengelolaList)
router.get('/timeline', authenticate, onlyPengelola, getTimeline)

router.get('/units', authenticate, onlyPengelola, getUnits)
router.post('/units', authenticate, onlyPengelola, createUnit)
router.put('/units/:id', authenticate, onlyPengelola, updateUnit)
router.delete('/units/:id', authenticate, onlyPengelola, removeUnit)

router.get('/units/:unitId/laporan', authenticate, onlyPengelola, getLaporan)
router.post('/units/:unitId/laporan', authenticate, onlyPengelola, createLaporan)
router.put('/laporan/:id', authenticate, onlyPengelola, updateLaporan)
router.delete('/laporan/:id', authenticate, onlyPengelola, removeLaporan)

router.get('/units/:unitId/transaksi', authenticate, onlyPengelola, getTransaksi)
router.post('/units/:unitId/transaksi', authenticate, onlyPengelola, createTransaksi)
router.delete('/transaksi/:id', authenticate, onlyPengelola, removeTransaksi)

export default router
