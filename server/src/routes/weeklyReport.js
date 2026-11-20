import { Router } from 'express'
import { getAll, getStatusThisWeek, getMonthlyReport, create, update, remove } from '../controllers/weeklyReport.js'
import { authenticate } from '../middleware/auth.js'
import { checkRole, checkMinRole } from '../middleware/checkRole.js'
import { ROLE_KIRIM_LAPORAN, kelolaStudio } from '../utils/roles.js'
import { bayanganOmsetStudio } from '../utils/omsetBayangan.js'

const router = Router()

// Omzet BAYANGAN (21 Okt 2026): omzet dari order web circle vs Laporan Omset, per periode — BACA saja, tidak menulis laporan.
// Pengelola unit itu saja (Koordinator/Pendamping unit, Kepala Circle/Rumah Usaha pemiliknya, Super Admin).
router.get('/bayangan', authenticate, checkMinRole('KOORDINATOR'), async (req, res) => {
  try {
    const { studioId } = req.query, bulan = Number(req.query.bulan), tahun = Number(req.query.tahun)
    if (!studioId || !(bulan >= 1 && bulan <= 12) || !(tahun >= 2024 && tahun <= 2100)) return res.status(422).json({ success: false, message: 'studioId, bulan, tahun wajib' })
    if (!(await kelolaStudio(req.userRoles, studioId))) return res.status(403).json({ success: false, message: 'Hanya pengelola unit ini' })
    return res.json({ success: true, data: await bayanganOmsetStudio(studioId, bulan, tahun) })
  } catch { return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' }) }
})

router.get('/',              authenticate, checkMinRole('KADER'), getAll)
router.get('/status/week',   authenticate, checkMinRole('KADER'), getStatusThisWeek)
router.get('/monthly',       authenticate, checkMinRole('KADER'), getMonthlyReport)
router.post('/',             authenticate, checkRole(ROLE_KIRIM_LAPORAN), create)
router.put('/:id',           authenticate, checkRole(ROLE_KIRIM_LAPORAN), update)
router.delete('/:id',        authenticate, checkRole(ROLE_KIRIM_LAPORAN), remove)

export default router
