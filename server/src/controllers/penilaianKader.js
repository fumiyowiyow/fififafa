import prisma from '../prisma.js'
import { hasAnyRole, SUPER_ADMIN, canManageMember } from '../utils/roles.js'
import { SKOR_FIELDS, rataRataSkor, ringkasPenilaian } from '../utils/penilaianKader.js'

// Terpisah total dari jurnalTalent.js (JurnalTalent tetap murni naratif mingguan, gak disentuh).
// Skala 1-5 berjangkar (anchored) -- sama persis di semua 9 dimensi, biar mentor beda studio
// tetap nilai dari acuan yang sama: 1 Jauh di Bawah Harapan, 2 Di Bawah Harapan, 3 Sesuai
// Harapan, 4 Di Atas Harapan, 5 Istimewa.
const MENTOR_ROLES = ['KOORDINATOR', 'PENDAMPING', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM', 'ADVISOR']
// SKOR_FIELDS & rataRataSkor: utils/penilaianKader.js (satu sumber, dipakai juga Kondisi Tim).
const LABEL_SKOR = { 1: 'Jauh di Bawah Harapan', 2: 'Di Bawah Harapan', 3: 'Sesuai Harapan', 4: 'Di Atas Harapan', 5: 'Istimewa' }

function isMentor(roles) {
  return roles?.some(r => MENTOR_ROLES.includes(r.roleType))
}


// Math.floor, BUKAN Math.round -- skala ini berjangkar (anchored), labelnya berarti "udah nyampe
// level ini", bukan "paling deket ke level ini". Skor 2.8 secara harfiah BELUM nyampe 3 (Sesuai
// Harapan), masih di rentang 2 (Di Bawah Harapan) -- kalau dibulatkan ke atas, orang dengan rata-
// rata 2.5-2.99 keliatan "Sesuai Harapan" padahal belum, dan gak konsisten sama WARNA_SKOR di
// client (RingkasanPerforma.jsx) yang udah pakai ambang batas `n >= 3`, bukan pembulatan.
function labelSkor(rataRata) {
  return LABEL_SKOR[Math.min(5, Math.max(1, Math.floor(rataRata)))]
}

// Tier status sama persis ROLE_TIER di client (client/src/utils/roles.js) -- KOORDINATOR paling
// senior (tetap), KADER/KARYAWAN sama-sama karyawan, MAGANG paling bawah. Kalau kader punya lebih
// dari satu role operasional (mis. Koordinator di satu studio, Karyawan di studio lain), yang
// ditampilkan adalah tier PALING SENIOR-nya.
const TIER_RANK = { KOORDINATOR: 0, KADER: 1, KARYAWAN: 1, MAGANG: 2 }
const TIER_LABEL_BY_RANK = { 0: 'tetap', 1: 'karyawan', 2: 'magang' }
function statusTier(roles) {
  const relevant = roles.filter(r => r.roleType in TIER_RANK)
  if (!relevant.length) return null
  return TIER_LABEL_BY_RANK[Math.min(...relevant.map(r => TIER_RANK[r.roleType]))]
}

function withRingkasan(entry) {
  const rataRata = rataRataSkor(entry)
  return { ...entry, rataRata, label: labelSkor(rataRata) }
}

// Penulis entri sendiri boleh edit/hapus, atau canManageMember (mentor kader yang bersangkutan) --
// pola sama persis canEditEntry di jurnalTalent.js.
async function canEditEntry(penilaian, userRoles, userId) {
  if (penilaian.penilaiId === userId) return true
  return canManageMember(penilaian.userId, userRoles ?? [])
}

function validateSkor(fields, { partial = false } = {}) {
  for (const key of SKOR_FIELDS) {
    const v = fields[key]
    if (v === undefined) {
      if (partial) continue
      return `${key} wajib diisi`
    }
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > 5) return `${key} wajib angka bulat 1-5`
  }
  return null
}

export async function getByUser(req, res) {
  try {
    const { userId } = req.params
    // Kader SENGAJA tidak boleh lihat penilaian dirinya sendiri (keputusan user) -- mentor bebas
    // menilai jujur tanpa khawatir kadernya langsung baca. Wajib mentor DAN canManageMember (bukan
    // blanket isMentor) -- KOORDINATOR studio lain gak boleh intip kader studio yang bukan wewenangnya.
    if (!isMentor(req.userRoles) || !(await canManageMember(userId, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }
    const list = await prisma.penilaianKader.findMany({
      where: { userId },
      include: { penilai: { select: { id: true, nama: true } } },
      orderBy: { tanggalPenilaian: 'desc' },
    })
    res.json({ success: true, data: list.map(withRingkasan) })
  } catch {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export async function create(req, res) {
  try {
    if (!isMentor(req.userRoles)) return res.status(403).json({ success: false, message: 'Akses ditolak' })
    const { userId, tanggalPenilaian, catatan, perkembangan, pencapaian, kendala, targetMingguDepan, ...skorInput } = req.body
    if (!userId || !tanggalPenilaian) {
      return res.status(400).json({ success: false, message: 'userId dan tanggalPenilaian wajib diisi' })
    }
    if (!(await canManageMember(userId, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Bukan mentor kader ini' })
    }
    const skorError = validateSkor(skorInput)
    if (skorError) return res.status(422).json({ success: false, message: skorError })

    const penilaian = await prisma.penilaianKader.create({
      data: {
        userId,
        penilaiId: req.user.id,
        tanggalPenilaian: new Date(tanggalPenilaian),
        ...Object.fromEntries(SKOR_FIELDS.map(k => [k, Number(skorInput[k])])),
        catatan: catatan || null,
        perkembangan: perkembangan || null,
        pencapaian: pencapaian || null,
        kendala: kendala || null,
        targetMingguDepan: targetMingguDepan || null,
      },
      include: { penilai: { select: { id: true, nama: true } } },
    })
    res.json({ success: true, data: withRingkasan(penilaian) })
  } catch {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export async function update(req, res) {
  try {
    if (!isMentor(req.userRoles)) return res.status(403).json({ success: false, message: 'Akses ditolak' })
    const penilaian = await prisma.penilaianKader.findUnique({ where: { id: req.params.id } })
    if (!penilaian) return res.status(404).json({ success: false, message: 'Tidak ditemukan' })
    if (!(await canEditEntry(penilaian, req.userRoles, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Hanya penilai atau mentor kader yang bisa edit' })
    }
    const { tanggalPenilaian, catatan, perkembangan, pencapaian, kendala, targetMingguDepan, ...skorInput } = req.body
    const skorError = validateSkor(skorInput, { partial: true })
    if (skorError) return res.status(422).json({ success: false, message: skorError })

    const updated = await prisma.penilaianKader.update({
      where: { id: req.params.id },
      data: {
        ...(tanggalPenilaian !== undefined && { tanggalPenilaian: new Date(tanggalPenilaian) }),
        ...Object.fromEntries(SKOR_FIELDS.filter(k => skorInput[k] !== undefined).map(k => [k, Number(skorInput[k])])),
        ...(catatan           !== undefined && { catatan: catatan || null }),
        ...(perkembangan      !== undefined && { perkembangan: perkembangan || null }),
        ...(pencapaian        !== undefined && { pencapaian: pencapaian || null }),
        ...(kendala           !== undefined && { kendala: kendala || null }),
        ...(targetMingguDepan !== undefined && { targetMingguDepan: targetMingguDepan || null }),
      },
      include: { penilai: { select: { id: true, nama: true } } },
    })
    res.json({ success: true, data: withRingkasan(updated) })
  } catch {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export async function remove(req, res) {
  try {
    if (!isMentor(req.userRoles)) return res.status(403).json({ success: false, message: 'Akses ditolak' })
    const penilaian = await prisma.penilaianKader.findUnique({ where: { id: req.params.id } })
    if (!penilaian) return res.status(404).json({ success: false, message: 'Tidak ditemukan' })
    if (!(await canEditEntry(penilaian, req.userRoles, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Hanya penilai atau mentor kader yang bisa hapus' })
    }
    await prisma.penilaianKader.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Ringkasan buat tab "Ringkasan Performa" -- satu baris per kader dalam scope caller, pakai
// penilaian TERBARU (by tanggalPenilaian) tiap kader. Scope-nya pola sama persis dengan masking
// di members.js getAll: superadmin lihat semua, KOORDINATOR/PENDAMPING cuma anggota studio
// sendiri, KEPALA_CIRCLE/KEPALA_RUMAH_USAHA cuma anggota circle/rumah-usaha sendiri.
export async function getSkorRingkasan(req, res) {
  try {
    const roles = req.userRoles ?? []
    if (!isMentor(roles)) return res.status(403).json({ success: false, message: 'Akses ditolak' })
    const isSuperAdmin = hasAnyRole(roles, SUPER_ADMIN)

    const myStudioIds = new Set(roles.filter(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId).map(r => r.studioId))
    const myCircleIds = new Set(roles.filter(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId).map(r => r.circleId))
    const myRumahUsahaIds = new Set(roles.filter(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId).map(r => r.rumahUsahaId))

    const scopeOr = [
      ...(myStudioIds.size ? [{ studioId: { in: [...myStudioIds] } }] : []),
      ...(myCircleIds.size ? [{ studio: { circleId: { in: [...myCircleIds] } } }] : []),
      ...(myRumahUsahaIds.size ? [{ studio: { rumahUsahaId: { in: [...myRumahUsahaIds] } } }] : []),
    ]

    const users = await prisma.user.findMany({
      where: {
        statusAktif: true,
        // Ringkasan performa cuma buat KADER (staf operasional studio) -- Pendamping/Advisor/
        // Kepala Ekosistem/Kepala Circle/Kepala Rumah Usaha/Co-Admin/pemilik saham/Dignity-only
        // BUKAN kader, gak perlu dinilai (keputusan eksplisit user), meskipun mereka punya posisi
        // di suatu studio. Cuma posisi operasional beneran yang bikin relevan -- sama kriteria
        // persis kayak filteredMembers di client/src/pages/Kader/index.jsx. Dulu superAdmin gak
        // kena filter studio sama sekali (where cuma { statusAktif: true }), jadi entitas non-kader
        // ikut nongol di ringkasan.
        AND: [
          { roles: { some: { studioId: { not: null }, roleType: { in: ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG'] } } } },
          ...(isSuperAdmin ? [] : [{ roles: { some: { OR: scopeOr } } }]),
        ],
      },
      select: {
        id: true,
        nama: true,
        roles: { select: { studio: { select: { nama: true } }, roleType: true } },
        // Semua riwayat (bukan cuma terbaru) -- dipakai buat breakdown per bulan (riwayat3Bulan)
        // di bawah. Gak di-`take` karena butuh SEMUA entri dalam 3 bulan terakhir buat rata-rata
        // per bulan yang akurat (bisa lebih dari 1 penilaian per kader per bulan), sementara entri
        // di luar 3 bulan cuma dipakai buat nentuin `terbaru` kalau kadernya lama gak dinilai.
        penilaianSebagaiKader: { orderBy: { tanggalPenilaian: 'desc' } },
        _count: { select: { penilaianSebagaiKader: true } },
      },
      orderBy: { nama: 'asc' },
    })

    const data = users.map(u => {
      // Hitungan rata-rata, riwayat 3 bulan & flag khusus: utils/penilaianKader.js ringkasPenilaian
      // (dipakai juga Kondisi Tim per unit di Kepatuhan Laporan -- satu sumber).
      const { terbaru, sudahDinilaiBulanIni, riwayat3Bulan, flagKhusus } = ringkasPenilaian(u.penilaianSebagaiKader)
      return {
        userId: u.id,
        nama: u.nama,
        studio: u.roles.find(r => r.studio)?.studio?.nama ?? null,
        tier: statusTier(u.roles),
        rataRata: terbaru ? rataRataSkor(terbaru) : null,
        label: terbaru ? labelSkor(rataRataSkor(terbaru)) : null,
        tanggalTerakhir: terbaru?.tanggalPenilaian ?? null,
        sudahDinilaiBulanIni,
        jumlahPenilaian: u._count.penilaianSebagaiKader,
        riwayat3Bulan,
        flagKhusus,
      }
    })

    res.json({ success: true, data })
  } catch {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
