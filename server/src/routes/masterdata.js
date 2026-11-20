import { Router } from 'express'
import {
  getMasterdata,
  getCircles, createCircle, updateCircle,
  getStudios, createStudio, updateStudio, deleteStudio,
  uploadStudioSkb, deleteStudioSkb,
  getKoordinators,
  getRumahUsahaList, createRumahUsaha, updateRumahUsaha, deleteRumahUsaha,
} from '../controllers/masterdata.js'
import {
  getRekening, createRekening, updateRekening, deleteRekening,
} from '../controllers/studioRekening.js'
import { getStudioRoster } from '../controllers/studioRoster.js'
import {
  getPemilik, createPemilik, updatePemilik, deletePemilik,
} from '../controllers/studioPemilik.js'
import {
  getPengeluaranRutin, createPengeluaranRutin, updatePengeluaranRutin, deletePengeluaranRutin,
  seedDefaultPengeluaranRutin,
} from '../controllers/studioPengeluaranRutin.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, populateRoles } from '../middleware/checkRole.js'
import { uploadSkb }    from '../middleware/upload.js'

const router = Router()

const adminOnly       = checkRole(['ADVISOR', 'KEPALA_EKOSISTEM'])
const koordinator     = checkRole(['ADVISOR', 'KEPALA_EKOSISTEM', 'KOORDINATOR'])
const koordinatorPlus = checkRole(['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KOORDINATOR', 'PENDAMPING'])

router.get('/',                authenticate, populateRoles, getMasterdata)
router.get('/circles',         authenticate, getCircles)
router.post('/circles',        authenticate, adminOnly, createCircle)
router.put('/circles/:id',     authenticate, adminOnly, updateCircle)

router.get('/studios',         authenticate, populateRoles, getStudios)
router.post('/studios',        authenticate, adminOnly, createStudio)
router.put('/studios/:id',     authenticate, koordinatorPlus, updateStudio)
router.delete('/studios/:id',  authenticate, adminOnly, deleteStudio)

router.post('/studios/:id/skb',    authenticate, koordinatorPlus, uploadSkb.single('file'), uploadStudioSkb)
router.delete('/studios/:id/skb',  authenticate, koordinatorPlus, deleteStudioSkb)

router.get('/studios/:studioId/rekening',     authenticate, populateRoles, getRekening)
router.post('/studios/:studioId/rekening',    authenticate, koordinator, createRekening)
router.put('/studios/:studioId/rekening/:id', authenticate, koordinator, updateRekening)
router.delete('/studios/:studioId/rekening/:id', authenticate, koordinator, deleteRekening)

router.get('/studios/:studioId/roster',       authenticate, populateRoles, getStudioRoster)

router.get('/studios/:studioId/pemilik',      authenticate, populateRoles, getPemilik)
router.post('/studios/:studioId/pemilik',     authenticate, koordinatorPlus, createPemilik)
router.put('/studios/:studioId/pemilik/:id',  authenticate, koordinatorPlus, updatePemilik)
router.delete('/studios/:studioId/pemilik/:id', authenticate, koordinatorPlus, deletePemilik)

router.get('/studios/:studioId/pengeluaran-rutin',        authenticate, populateRoles, getPengeluaranRutin)
router.post('/studios/:studioId/pengeluaran-rutin',       authenticate, koordinatorPlus, createPengeluaranRutin)
router.put('/studios/:studioId/pengeluaran-rutin/:id',    authenticate, koordinatorPlus, updatePengeluaranRutin)
router.delete('/studios/:studioId/pengeluaran-rutin/:id', authenticate, koordinatorPlus, deletePengeluaranRutin)
router.post('/studios/:studioId/pengeluaran-rutin/seed-default', authenticate, koordinatorPlus, seedDefaultPengeluaranRutin)

router.get('/users',           authenticate, getKoordinators)

router.get('/rumah-usaha',         authenticate, getRumahUsahaList)
router.post('/rumah-usaha',        authenticate, adminOnly, createRumahUsaha)
router.put('/rumah-usaha/:id',     authenticate, adminOnly, updateRumahUsaha)
router.delete('/rumah-usaha/:id',  authenticate, adminOnly, deleteRumahUsaha)

export default router
