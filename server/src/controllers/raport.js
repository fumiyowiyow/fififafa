import prisma from '../prisma.js'
import { hasAnyRole, SUPER_ADMIN, STAFF_PLUS } from '../utils/roles.js'
import { SKOR_FIELDS } from '../utils/penilaianKader.js'

// ══ RAPORT SISWA VOKASI / KBU (13 Okt 2026) ══════════════════════════════════════════════════
// Per 3 bulan (Jan-Mar, Apr-Jun, Jul-Sep, Okt-Des), format raport Karir Anak yang sudah berjalan.
// Penulis = mentor yang ditunjuk per siswa (tabel MentorSiswa, bisa lebih dari satu); pengelola anggota itu (Koordinator/
// Pendamping unitnya, Kepala Circle/Rumah Usaha, Super Admin) juga boleh menulis & menunjuk mentor.
// Siswa menulis Kesan Belajar-nya sendiri dan hanya melihat raport TERBIT.
// Isinya menyangkut anak di bawah umur -- jangan pernah ikut endpoint daftar umum.

export const STATUS_PROGRAM = ['SISWA_VOKASI', 'SISWA_KBU']

// 12 aspek Perkembangan Personal -- tetap, sama untuk Vokasi & KBU (label di client/utils/raport.js).
export const KUNCI_PERSONAL = [
  'kedisiplinan', 'kejujuran', 'kolaborasi', 'tanggungJawab', 'inisiatif', 'analisisMasalah',
  'pemecahanMasalah', 'kebersihan', 'kerapian', 'kerajinan', 'ketelitian', 'kreativitas',
]
const MAKS_TEKNIS = 12
const MAKS_LAMPIRAN = 6

// Acuan dari Penilaian Kader (tidak tercetak di raport): kelompok skor -> aspek.
const ASPEK_ACUAN = [
  { kunci: 'kedisiplinan', label: 'Kehadiran & Kedisiplinan', skor: ['skorKehadiran', 'skorKetepatanWaktu'] },
  { kunci: 'adab',         label: 'Adab & Karakter',          skor: ['skorAdab', 'skorKejujuran', 'skorMenerimaMasukan'] },
  { kunci: 'kompetensi',   label: 'Kompetensi Teknis',        skor: ['skorKualitasKerja', 'skorPenguasaanSkill'] },
  { kunci: 'kolaborasi',   label: 'Kolaborasi & Inisiatif',   skor: ['skorInisiatif', 'skorKerjaSama'] },
]

const WIB_MS = 7 * 60 * 60 * 1000
const rata = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const bulat = (n) => (n == null ? null : Math.round(n * 100) / 100)
const fotoAman = (f) => (typeof f === 'string' && f.length <= 400_000 && /^data:image\/(jpeg|png|webp);base64,/.test(f) ? f : null)

// Rentang kuartal dalam UTC yang mewakili tengah malam WIB (sama dengan cara tanggalPenilaian disimpan).
export function rentangKuartal(tahun, kuartal) {
  const awal = new Date(Date.UTC(tahun, (kuartal - 1) * 3, 1) - WIB_MS)
  const akhir = new Date(Date.UTC(tahun, kuartal * 3, 1) - WIB_MS)
  return { awal, akhir }
}

function bacaPeriode(q) {
  const tahun = parseInt(q.tahun)
  const kuartal = parseInt(q.kuartal)
  if (!(tahun >= 2020 && tahun <= 2100) || !(kuartal >= 1 && kuartal <= 4)) return null
  return { tahun, kuartal }
}

// Rata-rata Penilaian Kader satu siswa dalam satu kuartal (skala 1-5) -- acuan mentor saja.
export async function ringkasNilai(userId, tahun, kuartal) {
  const { awal, akhir } = rentangKuartal(tahun, kuartal)
  const entri = await prisma.penilaianKader.findMany({
    where: { userId, tanggalPenilaian: { gte: awal, lt: akhir } },
    orderBy: { tanggalPenilaian: 'asc' },
  })
  return {
    jumlahPenilaian: entri.length,
    rataRata: bulat(rata(entri.map(e => rata(SKOR_FIELDS.map(k => e[k]))))),
    aspek: ASPEK_ACUAN.map(a => ({ kunci: a.kunci, label: a.label, skor: bulat(rata(entri.map(e => rata(a.skor.map(k => e[k]))))) })),
  }
}

const SISWA_SELECT = {
  id: true, nama: true, statusAktif: true, statusKeanggotaan: true,
  kelas: true, sekolah: true, tinggalDengan: true, tanggalMasuk: true, tanggalLahir: true, tempatLahir: true,
  fokusKompetensi: true, tanggalMulaiProgram: true,
  mentorSaya: { select: { mentor: { select: { id: true, nama: true } } }, orderBy: { createdAt: 'asc' } },
  roles: { select: { roleType: true, studioId: true, studio: { select: { id: true, nama: true, circleId: true, rumahUsahaId: true } } } },
}

// Sama dengan utils/roles.js canManageMember, tapi di memori (siswa sudah dimuat bersama
// studio-nya) supaya daftar puluhan siswa gak jadi puluhan query.
function bolehKelola(siswa, myRoles) {
  if (hasAnyRole(myRoles, SUPER_ADMIN)) return true
  const studio = new Set(myRoles.filter(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId).map(r => r.studioId))
  const circle = new Set(myRoles.filter(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId).map(r => r.circleId))
  const ru = new Set(myRoles.filter(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId).map(r => r.rumahUsahaId))
  return siswa.roles.some(r =>
    (r.studioId && studio.has(r.studioId)) ||
    (r.studio?.circleId && circle.has(r.studio.circleId)) ||
    (r.studio?.rumahUsahaId && ru.has(r.studio.rumahUsahaId)))
}

// 'kelola' = boleh tunjuk mentor & tulis; 'mentor' = boleh tulis; 'siswa' = Kesan Belajar + baca yang terbit.
function hakAtas(siswa, req) {
  const myRoles = req.userRoles ?? []
  // Siswa yang juga pengurus di unitnya sendiri (mis. Koordinator sekaligus Siswa KBU) tetap
  // cuma pembaca raportnya sendiri -- gak boleh menulis/menerbitkan nilai untuk diri sendiri.
  if (siswa.id === req.user.id && !hasAnyRole(myRoles, SUPER_ADMIN)) return 'siswa'
  if (bolehKelola(siswa, myRoles)) return 'kelola'
  if (siswa.mentorSaya.some(m => m.mentor.id === req.user.id)) return 'mentor'
  return null
}
const bisaTulis = (hak) => hak === 'kelola' || hak === 'mentor'

function unitSiswa(siswa) {
  const nama = [...new Set(siswa.roles.map(r => r.studio?.nama?.trim()).filter(Boolean))]
  return nama.join(', ') || null
}

const mentorDari = (siswa) => siswa.mentorSaya.map(m => m.mentor)

function bentukSiswa(siswa, hak) {
  const { roles, mentorSaya, ...sisa } = siswa
  return { ...sisa, mentor: mentorDari(siswa), unit: unitSiswa(siswa), hak }
}

async function muatSiswa(userId) {
  const s = await prisma.user.findUnique({ where: { id: userId }, select: SISWA_SELECT })
  return s && STATUS_PROGRAM.includes(s.statusKeanggotaan) ? s : null
}

// Muat siswa + hak, atau kirim galat. Kembalikan null kalau respons sudah dikirim.
async function siswaDenganHak(req, res, { tulis = false } = {}) {
  const siswa = await muatSiswa(req.params.userId)
  if (!siswa) { res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' }); return null }
  const hak = hakAtas(siswa, req)
  if (!hak || (tulis && !bisaTulis(hak))) { res.status(403).json({ success: false, message: 'Akses ditolak' }); return null }
  return { siswa, hak }
}

// GET /api/raport/siswa?tahun&kuartal -- daftar siswa yang boleh saya lihat + status raport periode itu.
export async function daftarSiswa(req, res) {
  try {
    const periode = bacaPeriode(req.query)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const semua = await prisma.user.findMany({
      where: { statusAktif: true, statusKeanggotaan: { in: STATUS_PROGRAM } },
      select: SISWA_SELECT,
      orderBy: { nama: 'asc' },
    })
    const terlihat = semua.map(s => [s, hakAtas(s, req)]).filter(([, hak]) => hak)
    const raport = await prisma.raportSiswa.findMany({
      where: { userId: { in: terlihat.map(([s]) => s.id) }, ...periode },
      select: { userId: true, status: true, updatedAt: true },
    })
    const perUser = Object.fromEntries(raport.map(r => [r.userId, r]))
    const data = terlihat.map(([s, hak]) => ({
      ...bentukSiswa(s, hak),
      raport: perUser[s.id] ? { status: perUser[s.id].status, updatedAt: perUser[s.id].updatedAt } : null,
    }))
    return res.json({ success: true, data })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar siswa' })
  }
}

// GET /api/raport/mentor-kandidat -- calon mentor: pengurus & kader aktif, plus yang berstatus Mentor.
export async function kandidatMentor(req, res) {
  try {
    // Cuma yang bisa menunjuk mentor (pengurus) -- jangan bocorkan daftar ini ke semua anggota.
    if (!hasAnyRole(req.userRoles ?? [], STAFF_PLUS)) return res.status(403).json({ success: false, message: 'Akses ditolak' })
    const data = await prisma.user.findMany({
      where: {
        statusAktif: true,
        OR: [
          { statusKeanggotaan: 'MENTOR' },
          { roles: { some: { roleType: { in: ['KOORDINATOR', 'PENDAMPING', 'KADER', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM', 'ADVISOR'] } } } },
        ],
      },
      select: { id: true, nama: true },
      orderBy: { nama: 'asc' },
    })
    return res.json({ success: true, data })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat calon mentor' })
  }
}

function tanggalDari(v) {
  if (!v) return null
  const t = new Date(String(v).slice(0, 10) + 'T00:00:00.000Z')
  return isNaN(t.getTime()) ? undefined : t
}

// PATCH /api/raport/siswa/:userId -- data program: mentor (pengelola saja), fokus, tanggal mulai,
// tempat & tanggal lahir (halaman Profil raport).
export async function ubahDataProgram(req, res) {
  try {
    const ok = await siswaDenganHak(req, res, { tulis: true })
    if (!ok) return
    const { siswa, hak } = ok
    const { mentorIds, fokusKompetensi, tanggalMulaiProgram, tempatLahir, tanggalLahir } = req.body
    const data = {}
    let mentorBaru = null
    if (mentorIds !== undefined) {
      if (hak !== 'kelola') return res.status(403).json({ success: false, message: 'Hanya pengelola unit yang bisa menunjuk mentor' })
      if (!Array.isArray(mentorIds) || mentorIds.length > 5) return res.status(422).json({ success: false, message: 'Maksimal 5 mentor per siswa' })
      mentorBaru = [...new Set(mentorIds.filter(Boolean).map(String))]
      if (mentorBaru.includes(siswa.id)) return res.status(422).json({ success: false, message: 'Siswa tidak bisa jadi mentor dirinya sendiri' })
      const ada = await prisma.user.count({ where: { id: { in: mentorBaru }, statusAktif: true } })
      if (ada !== mentorBaru.length) return res.status(422).json({ success: false, message: 'Mentor tidak ditemukan' })
    }
    if (fokusKompetensi !== undefined) data.fokusKompetensi = String(fokusKompetensi ?? '').trim().slice(0, 120) || null
    if (tempatLahir !== undefined) data.tempatLahir = String(tempatLahir ?? '').trim().slice(0, 80) || null
    for (const [kunci, nilai] of [['tanggalMulaiProgram', tanggalMulaiProgram], ['tanggalLahir', tanggalLahir]]) {
      if (nilai === undefined) continue
      const t = tanggalDari(nilai)
      if (t === undefined) return res.status(422).json({ success: false, message: 'Tanggal tidak valid' })
      data[kunci] = t
    }
    const baru = await prisma.$transaction(async (tx) => {
      if (mentorBaru) {
        await tx.mentorSiswa.deleteMany({ where: { siswaId: siswa.id, mentorId: { notIn: mentorBaru } } })
        await tx.mentorSiswa.createMany({ data: mentorBaru.map(mentorId => ({ siswaId: siswa.id, mentorId })), skipDuplicates: true })
      }
      return tx.user.update({ where: { id: siswa.id }, data, select: SISWA_SELECT })
    })
    return res.json({ success: true, data: bentukSiswa(baru, hak) })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan data program' })
  }
}

function identitasDari(siswa) {
  return {
    nama: siswa.nama, program: siswa.statusKeanggotaan, kelas: siswa.kelas, sekolah: siswa.sekolah,
    tinggalDengan: siswa.tinggalDengan, unit: unitSiswa(siswa), fokusKompetensi: siswa.fokusKompetensi,
    tempatLahir: siswa.tempatLahir, tanggalLahir: siswa.tanggalLahir,
    tanggalMulaiProgram: siswa.tanggalMulaiProgram ?? siswa.tanggalMasuk,
    mentor: mentorDari(siswa).map(m => m.nama),
  }
}

const LAMPIRAN_RINGKAS = { select: { id: true, keterangan: true, urutan: true }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] }

async function raportSebelumnya(userId, { tahun, kuartal }, select) {
  return prisma.raportSiswa.findFirst({
    where: { userId, OR: [{ tahun: { lt: tahun } }, { tahun, kuartal: { lt: kuartal } }] },
    orderBy: [{ tahun: 'desc' }, { kuartal: 'desc' }],
    select,
  })
}

// GET /api/raport/:userId?tahun&kuartal -- raport satu periode (atau kerangka kosong).
export async function ambilRaport(req, res) {
  try {
    const periode = bacaPeriode(req.query)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res)
    if (!ok) return
    const { siswa, hak } = ok

    const raport = await prisma.raportSiswa.findUnique({
      where: { userId_tahun_kuartal: { userId: siswa.id, ...periode } },
      include: { penulis: { select: { id: true, nama: true } }, lampiran: LAMPIRAN_RINGKAS },
    })
    const terbit = raport?.status === 'TERBIT'
    const fotoRow = await prisma.user.findUnique({ where: { id: siswa.id }, select: { fotoUrl: true } })
    const foto = fotoAman(fotoRow?.fotoUrl)

    // Siswa: sebelum terbit cuma Kesan Belajar-nya sendiri yang terlihat & bisa diisi.
    if (hak === 'siswa' && !terbit) {
      return res.json({ success: true, data: { siswa: bentukSiswa(siswa, hak), raport: null, kesanBelajar: raport?.kesanBelajar ?? '' } })
    }
    const identitas = terbit && raport.identitas ? raport.identitas : identitasDari(siswa)

    // Kerangka baru: Renstra Belajar = Renstra Selanjutnya raport sebelumnya; daftar kompetensi
    // teknis = punya raport sebelumnya (skor & deskripsi dikosongkan).
    let bawaan = null
    if (!raport && bisaTulis(hak)) {
      const lalu = await raportSebelumnya(siswa.id, periode, { renstraSelanjutnya: true, teknis: true })
      bawaan = {
        renstraBelajar: Array.isArray(lalu?.renstraSelanjutnya) ? lalu.renstraSelanjutnya : [],
        teknis: (Array.isArray(lalu?.teknis) ? lalu.teknis : []).map(k => ({ nama: k.nama, skor: null, deskripsi: '' })),
      }
    }
    const acuan = bisaTulis(hak) ? await ringkasNilai(siswa.id, periode.tahun, periode.kuartal) : null
    return res.json({ success: true, data: { siswa: bentukSiswa(siswa, hak), raport, identitas, foto, bawaan, acuan } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat raport' })
  }
}

const teks = (v, maks = 2000) => (v === undefined ? undefined : String(v ?? '').trim().slice(0, maks) || null)
const skorAman = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : undefined
}

function bersihkanRenstra(daftar) {
  if (!Array.isArray(daftar)) return null
  return [0, 1, 2].map(i => ({
    teknis: teks(daftar[i]?.teknis, 600) ?? '',
    nonTeknis: teks(daftar[i]?.nonTeknis, 600) ?? '',
    checklist: teks(daftar[i]?.checklist, 600) ?? '',
  }))
}

function bersihkanPersonal(daftar) {
  if (!Array.isArray(daftar)) return null
  const per = Object.fromEntries(daftar.map(p => [p?.kunci, p]))
  const hasil = []
  for (const kunci of KUNCI_PERSONAL) {
    const skor = skorAman(per[kunci]?.skor)
    if (skor === undefined) return null
    hasil.push({ kunci, skor, deskripsi: teks(per[kunci]?.deskripsi, 400) ?? '' })
  }
  return hasil
}

function bersihkanTeknis(daftar) {
  if (!Array.isArray(daftar)) return null
  const hasil = []
  for (const k of daftar.slice(0, MAKS_TEKNIS)) {
    const nama = String(k?.nama ?? '').trim().slice(0, 80)
    if (!nama) continue
    const skor = skorAman(k?.skor)
    if (skor === undefined) return null
    hasil.push({ nama, skor, deskripsi: teks(k?.deskripsi, 400) ?? '' })
  }
  return hasil
}

// PUT /api/raport/:userId -- simpan draft (mentor/pengelola).
export async function simpanRaport(req, res) {
  try {
    const periode = bacaPeriode(req.body)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res, { tulis: true })
    if (!ok) return
    const { siswa } = ok

    const kunci = { userId_tahun_kuartal: { userId: siswa.id, ...periode } }
    const lama = await prisma.raportSiswa.findUnique({ where: kunci, select: { status: true } })
    if (lama?.status === 'TERBIT') {
      return res.status(409).json({ success: false, message: 'Raport sudah terbit — tarik kembali dulu untuk mengubah' })
    }
    const b = req.body
    const isi = {}
    for (const [k, fn] of [['renstraBelajar', bersihkanRenstra], ['renstraSelanjutnya', bersihkanRenstra], ['personal', bersihkanPersonal], ['teknis', bersihkanTeknis]]) {
      if (b[k] === undefined) continue
      const v = fn(b[k])
      if (v === null) return res.status(422).json({ success: false, message: 'Skor harus angka 1–10' })
      isi[k] = v
    }
    for (const k of ['untukSiswa', 'untukOrangTua', 'kesanBelajar']) {
      const v = teks(b[k], 3000)
      if (v !== undefined) isi[k] = v
    }
    const raport = await prisma.raportSiswa.upsert({
      where: kunci,
      create: { userId: siswa.id, penulisId: req.user.id, ...periode, ...isi },
      update: { penulisId: req.user.id, ...isi },
      include: { penulis: { select: { id: true, nama: true } }, lampiran: LAMPIRAN_RINGKAS },
    })
    return res.json({ success: true, data: raport, message: 'Draft raport tersimpan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan raport' })
  }
}

// PUT /api/raport/:userId/kesan { tahun, kuartal, kesanBelajar } -- ditulis siswanya sendiri.
export async function simpanKesan(req, res) {
  try {
    const periode = bacaPeriode(req.body)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res)
    if (!ok) return
    if (ok.hak !== 'siswa') return res.status(403).json({ success: false, message: 'Kesan Belajar ditulis oleh siswanya sendiri' })
    const kunci = { userId_tahun_kuartal: { userId: ok.siswa.id, ...periode } }
    const lama = await prisma.raportSiswa.findUnique({ where: kunci, select: { status: true } })
    if (lama?.status === 'TERBIT') return res.status(409).json({ success: false, message: 'Raport sudah terbit' })
    const kesanBelajar = teks(req.body.kesanBelajar, 3000) ?? null
    await prisma.raportSiswa.upsert({
      where: kunci,
      create: { userId: ok.siswa.id, ...periode, kesanBelajar },
      update: { kesanBelajar },
    })
    return res.json({ success: true, data: { kesanBelajar }, message: 'Kesan Belajar tersimpan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan Kesan Belajar' })
  }
}

// POST /api/raport/:userId/terbit { tahun, kuartal } -- bekukan identitas, tampil ke siswa.
export async function terbitkanRaport(req, res) {
  try {
    const periode = bacaPeriode(req.body)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res, { tulis: true })
    if (!ok) return
    const { siswa } = ok

    const kunci = { userId_tahun_kuartal: { userId: siswa.id, ...periode } }
    const raport = await prisma.raportSiswa.findUnique({ where: kunci })
    if (!raport) return res.status(404).json({ success: false, message: 'Simpan draft raport dulu' })
    if (raport.status === 'TERBIT') return res.status(409).json({ success: false, message: 'Raport sudah terbit' })
    const kurang = []
    const personal = Array.isArray(raport.personal) ? raport.personal : []
    if (personal.length !== KUNCI_PERSONAL.length || personal.some(p => p.skor == null)) kurang.push('skor 12 aspek Perkembangan Personal')
    const teknis = Array.isArray(raport.teknis) ? raport.teknis : []
    if (teknis.length === 0 || teknis.some(k => k.skor == null)) kurang.push('Perkembangan Teknis (minimal 1 kompetensi, semua diberi skor)')
    const selanjutnya = Array.isArray(raport.renstraSelanjutnya) ? raport.renstraSelanjutnya : []
    if (!selanjutnya.some(r => r.teknis || r.nonTeknis)) kurang.push('Renstra Selanjutnya')
    if (!raport.untukSiswa || !raport.untukOrangTua) kurang.push('Input Mentor untuk siswa & orang tua')
    if (kurang.length) return res.status(422).json({ success: false, message: `Lengkapi dulu: ${kurang.join('; ')}` })

    const hasil = await prisma.raportSiswa.update({
      where: kunci,
      data: { status: 'TERBIT', terbitAt: new Date(), identitas: identitasDari(siswa) },
      include: { penulis: { select: { id: true, nama: true } }, lampiran: LAMPIRAN_RINGKAS },
    })
    return res.json({ success: true, data: hasil, message: 'Raport diterbitkan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menerbitkan raport' })
  }
}

// POST /api/raport/:userId/tarik { tahun, kuartal } -- kembali ke draft.
export async function tarikRaport(req, res) {
  try {
    const periode = bacaPeriode(req.body)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res, { tulis: true })
    if (!ok) return
    const kunci = { userId_tahun_kuartal: { userId: ok.siswa.id, ...periode } }
    const raport = await prisma.raportSiswa.findUnique({ where: kunci, select: { status: true } })
    if (raport?.status !== 'TERBIT') return res.status(409).json({ success: false, message: 'Raport belum terbit' })
    const hasil = await prisma.raportSiswa.update({
      where: kunci,
      data: { status: 'DRAFT', terbitAt: null },
      include: { penulis: { select: { id: true, nama: true } }, lampiran: LAMPIRAN_RINGKAS },
    })
    return res.json({ success: true, data: hasil, message: 'Raport ditarik kembali ke draft' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menarik raport' })
  }
}

// GET /api/raport/saya -- raport milik siswa yang login (status saja; isi lewat GET /:userId).
export async function raportSaya(req, res) {
  try {
    const data = await prisma.raportSiswa.findMany({
      where: { userId: req.user.id },
      select: { tahun: true, kuartal: true, status: true, terbitAt: true },
      orderBy: [{ tahun: 'desc' }, { kuartal: 'desc' }],
    })
    return res.json({ success: true, data })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat raport' })
  }
}

// ── Lampiran Karya ───────────────────────────────────────────────────────────────────────────
// GET /api/raport/:userId/lampiran?tahun&kuartal -- foto lengkap (berat, dimuat terpisah).
export async function daftarLampiran(req, res) {
  try {
    const periode = bacaPeriode(req.query)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res)
    if (!ok) return
    const raport = await prisma.raportSiswa.findUnique({
      where: { userId_tahun_kuartal: { userId: ok.siswa.id, ...periode } },
      select: { status: true, lampiran: { select: { id: true, dataUrl: true, keterangan: true, urutan: true }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] } },
    })
    if (ok.hak === 'siswa' && raport?.status !== 'TERBIT') return res.json({ success: true, data: [] })
    return res.json({ success: true, data: raport?.lampiran ?? [] })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memuat lampiran' })
  }
}

// POST /api/raport/:userId/lampiran { tahun, kuartal, dataUrl, keterangan }
export async function tambahLampiran(req, res) {
  try {
    const periode = bacaPeriode(req.body)
    if (!periode) return res.status(422).json({ success: false, message: 'Periode tidak valid' })
    const ok = await siswaDenganHak(req, res, { tulis: true })
    if (!ok) return
    const { dataUrl } = req.body
    if (typeof dataUrl !== 'string' || dataUrl.length > 1_200_000 || !/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) {
      return res.status(422).json({ success: false, message: 'Foto harus JPG/PNG/WebP dan tidak terlalu besar' })
    }
    const kunci = { userId_tahun_kuartal: { userId: ok.siswa.id, ...periode } }
    const raport = await prisma.raportSiswa.upsert({
      where: kunci, create: { userId: ok.siswa.id, penulisId: req.user.id, ...periode }, update: {},
      select: { id: true, status: true, _count: { select: { lampiran: true } } },
    })
    if (raport.status === 'TERBIT') return res.status(409).json({ success: false, message: 'Raport sudah terbit — tarik kembali dulu' })
    if (raport._count.lampiran >= MAKS_LAMPIRAN) return res.status(422).json({ success: false, message: `Maksimal ${MAKS_LAMPIRAN} foto karya per raport` })
    const lampiran = await prisma.raportLampiran.create({
      data: { raportId: raport.id, dataUrl, keterangan: teks(req.body.keterangan, 120) ?? null, urutan: raport._count.lampiran },
      select: { id: true, keterangan: true, urutan: true, dataUrl: true },
    })
    return res.json({ success: true, data: lampiran })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengunggah foto' })
  }
}

// DELETE /api/raport/lampiran/:id
export async function hapusLampiran(req, res) {
  try {
    const l = await prisma.raportLampiran.findUnique({
      where: { id: req.params.id }, select: { id: true, raport: { select: { userId: true, status: true } } },
    })
    if (!l) return res.status(404).json({ success: false, message: 'Foto tidak ditemukan' })
    req.params.userId = l.raport.userId
    const ok = await siswaDenganHak(req, res, { tulis: true })
    if (!ok) return
    if (l.raport.status === 'TERBIT') return res.status(409).json({ success: false, message: 'Raport sudah terbit — tarik kembali dulu' })
    await prisma.raportLampiran.delete({ where: { id: l.id } })
    return res.json({ success: true, message: 'Foto dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus foto' })
  }
}
