import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { checkMinRole } from '../middleware/checkRole.js'
import {
  daftarSiswa, kandidatMentor, ubahDataProgram, ambilRaport, simpanRaport, simpanKesan,
  terbitkanRaport, tarikRaport, raportSaya, daftarLampiran, tambahLampiran, hapusLampiran,
} from '../controllers/raport.js'

// Raport siswa Vokasi/KBU (13 Okt 2026). Gerbang di sini longgar (semua role, termasuk Magang &
// Dignity -- siswa sendiri harus bisa baca raportnya); hak per siswa (pengelola / mentor / diri
// sendiri) dicek di controller.
const router = Router()
const masuk = [authenticate, checkMinRole('DIGNITY')]

router.get('/saya',              ...masuk, raportSaya)
router.get('/siswa',             ...masuk, daftarSiswa)
router.get('/mentor-kandidat',   ...masuk, kandidatMentor)
router.patch('/siswa/:userId',   ...masuk, ubahDataProgram)
router.delete('/lampiran/:id',   ...masuk, hapusLampiran)
router.get('/:userId',           ...masuk, ambilRaport)
router.put('/:userId',           ...masuk, simpanRaport)
router.post('/:userId/terbit',   ...masuk, terbitkanRaport)
router.post('/:userId/tarik',    ...masuk, tarikRaport)
router.put('/:userId/kesan',     ...masuk, simpanKesan)
router.get('/:userId/lampiran',  ...masuk, daftarLampiran)
router.post('/:userId/lampiran', ...masuk, tambahLampiran)

export default router
