import { Router }          from 'express'
import { getLingkupLaporan, getLaporanProgres } from '../controllers/laporanProgres.js'
import { daftarFotoSampul, ambilFotoSampul, simpanFotoSampul, hapusFotoSampul } from '../controllers/fotoSampul.js'
import { bacaLogo, simpanLogo, hapusLogo } from '../controllers/logoLaporan.js'
import { getUnitMingguan, getLaporanMingguan } from '../controllers/laporanMingguan.js'
import { authenticate }   from '../middleware/auth.js'
import { checkMinRole }   from '../middleware/checkRole.js'

const router = Router()

// Monthly / Progress Report baru (13 Okt 2026, diadaptasi dari playgroundecos.app): per circle /
// rumah usaha / satu ekosistem. Hak per lingkup dicek di controller (Kepala Circle ke atas).
router.get('/progres/lingkup', authenticate, checkMinRole('KADER'), getLingkupLaporan)
router.get('/progres',         authenticate, checkMinRole('KADER'), getLaporanProgres)

// Weekly Report per unit (13 Okt 2026): hak per unit dicek di controller (pengurus unit & kepalanya).
router.get('/mingguan/unit', authenticate, checkMinRole('KADER'), getUnitMingguan)
router.get('/mingguan',      authenticate, checkMinRole('KADER'), getLaporanMingguan)

// Galeri foto sampul & logo untuk laporan — baca KADER+, tulis = pengurus sasarannya (controller).
router.get('/foto-sampul',         authenticate, checkMinRole('KADER'), daftarFotoSampul)
router.get('/foto-sampul/:fid',    authenticate, checkMinRole('KADER'), ambilFotoSampul)
router.post('/foto-sampul',        authenticate, checkMinRole('KADER'), simpanFotoSampul)
router.delete('/foto-sampul/:fid', authenticate, checkMinRole('KADER'), hapusFotoSampul)
router.get('/logo',    authenticate, checkMinRole('KADER'), bacaLogo)
router.put('/logo',    authenticate, checkMinRole('KADER'), simpanLogo)
router.delete('/logo', authenticate, checkMinRole('KADER'), hapusLogo)

export default router
