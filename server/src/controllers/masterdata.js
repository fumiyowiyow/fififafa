import { lingkupKeuangan } from '../utils/lingkup.js'
import prisma from '../prisma.js'
import { unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { canManageStudio, hasAnyRole, SUPER_ADMIN } from '../utils/roles.js'
import { getCpmMapForStudios } from '../utils/cpm.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))


// ── CIRCLES ──────────────────────────────────────────────

export const getCircles = async (req, res) => {
  try {
    const circles = await prisma.circle.findMany({
      include: {
        _count: { select: { studios: true, userRoles: true } },
        userRoles: {
          where: { studioId: null },
          include: { user: { select: { id: true, nama: true } } },
        },
      },
      orderBy: { nama: 'asc' },
    })
    return res.json({ success: true, data: circles })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createCircle = async (req, res) => {
  try {
    const { nama, colorHex, deskripsi, alamat, mapsUrl } = req.body
    if (!nama) return res.status(422).json({ success: false, message: 'nama wajib diisi' })
    // kepalId wajib di kolom (skema lama) tapi kepala sebenarnya dikelola lewat UserRole
    // (KEPALA_CIRCLE), sama seperti circle-circle yang sudah ada -- bukan lewat kolom ini.
    const circle = await prisma.circle.create({
      data: {
        nama, colorHex: colorHex || '#7C3AED', kepalId: '',
        deskripsi: deskripsi || null, alamat: alamat || null, mapsUrl: mapsUrl || null,
      },
    })
    return res.status(201).json({ success: true, data: circle })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateCircle = async (req, res) => {
  try {
    const { nama, colorHex, kepalId, deskripsi, alamat, mapsUrl } = req.body
    const isSuperAdmin = req.userRoles?.some(r =>
      ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType)
    )
    if (!isSuperAdmin) {
      const ownCircle = req.userRoles?.some(r => r.circleId === req.params.id)
      if (!ownCircle) return res.status(403).json({ success: false, message: 'Hanya bisa edit circle sendiri' })
    }
    const circle = await prisma.circle.update({
      where: { id: req.params.id },
      data: {
        ...(nama        && { nama }),
        ...(colorHex    && { colorHex }),
        ...(kepalId     && { kepalId }),
        ...(deskripsi   !== undefined && { deskripsi: deskripsi || null }),
        ...(alamat      !== undefined && { alamat: alamat || null }),
        ...(mapsUrl     !== undefined && { mapsUrl: mapsUrl || null }),
      },
    })
    return res.json({ success: true, data: circle })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── STUDIOS ──────────────────────────────────────────────

// Naungan unit (8 Nov 2026): Korporasi (PT) langsung di bawah ekosistem -- tanpa circle/rumah usaha;
// unit di bawah Korporasi memakai indukId (circle & rumah usaha kosong); unit lain tetap salah
// satu: Circle ATAU Rumah Usaha. Mengembalikan { data } (kolom naungan lengkap) atau { error }.
async function tentukanNaungan({ tipe, circleId, rumahUsahaId, indukId }, selfId = null) {
  if (tipe === 'KORPORASI') return { data: { circleId: null, rumahUsahaId: null, indukId: null } }
  if (indukId) {
    if (indukId === selfId) return { error: 'Unit tidak bisa menjadi induk dirinya sendiri' }
    const induk = await prisma.studio.findUnique({ where: { id: indukId }, select: { tipe: true } })
    if (induk?.tipe !== 'KORPORASI') return { error: 'Induk harus unit bertipe Korporasi' }
    return { data: { circleId: null, rumahUsahaId: null, indukId } }
  }
  if ((!circleId && !rumahUsahaId) || (circleId && rumahUsahaId)) {
    return { error: 'Pilih salah satu: Circle, Rumah Usaha, atau Korporasi' }
  }
  return { data: { circleId: circleId || null, rumahUsahaId: rumahUsahaId || null, indukId: null } }
}

export const getStudios = async (req, res) => {
  try {
    const studios = await prisma.studio.findMany({
      include: {
        circle:     { select: { id: true, nama: true, colorHex: true } },
        rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
        induk:      { select: { id: true, nama: true } },
        _count:  { select: { weeklyReports: true, userRoles: true } },
      },
      orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
    })
    const lingkup = await lingkupKeuangan(req.userRoles)
    const cpmMap = await getCpmMapForStudios(studios.map(s => s.id))
    // Daftar unit tetap utuh (dipakai dropdown di banyak halaman), tapi angka uang unit di luar wilayah dibuang.
    const withCpm = studios.map(s => lingkup.boleh(s.id)
      ? { ...s, cpm: cpmMap[s.id]?.totalCpm ?? 0 }
      : { ...s, cpm: null, totalShu: null })
    return res.json({ success: true, data: withCpm })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createStudio = async (req, res) => {
  try {
    const { nama, circleId, rumahUsahaId, indukId, tipe, niche, koordinatorId } = req.body
    if (!nama || !tipe) {
      return res.status(422).json({ success: false, message: 'nama, tipe wajib diisi' })
    }
    // Korporasi & unit di bawahnya mengubah penjumlahan ekosistem -- hanya Super Admin.
    if ((tipe === 'KORPORASI' || indukId) && !hasAnyRole(req.userRoles ?? [], SUPER_ADMIN)) {
      return res.status(403).json({ success: false, message: 'Hanya Super Admin yang bisa mengatur Korporasi' })
    }
    const naungan = await tentukanNaungan({ tipe, circleId, rumahUsahaId, indukId })
    if (naungan.error) return res.status(422).json({ success: false, message: naungan.error })
    const studio = await prisma.studio.create({
      data: {
        nama,
        ...naungan.data,
        tipe,
        niche:         niche         || null,
        koordinatorId: koordinatorId || null,
      },
      include: {
        circle:     { select: { id: true, nama: true, colorHex: true } },
        rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
        induk:      { select: { id: true, nama: true } },
      },
    })
    return res.status(201).json({ success: true, data: studio })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateStudio = async (req, res) => {
  try {
    const { nama, circleId, rumahUsahaId, indukId, tipe, niche, koordinatorId, statusAktif, statusShu, totalShu, hitungDiEkosistem, mitraKolaborasi } = req.body
    if (!(await canManageStudio(req.userRoles, req.params.id))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    // Studio kolaborasi (angkanya dihitung di circle mitra) mengubah SEMUA total ekosistem --
    // hanya Super Admin yang boleh menandai / melepas tandanya.
    if ((hitungDiEkosistem !== undefined || mitraKolaborasi !== undefined) && !hasAnyRole(req.userRoles ?? [], SUPER_ADMIN)) {
      return res.status(403).json({ success: false, message: 'Hanya Super Admin yang bisa mengubah status studio kolaborasi' })
    }
    if (totalShu !== undefined && (!Number.isFinite(Number(totalShu)) || Number(totalShu) < 0)) {
      return res.status(422).json({ success: false, message: 'totalShu wajib angka >= 0' })
    }
    // Naungan baru dihitung dari keadaan sekarang + yang dikirim (circleId / rumahUsahaId / indukId /
    // tipe KORPORASI saling meniadakan), lalu divalidasi lewat tentukanNaungan.
    let parentUpdate = {}
    const gantiNaungan = (circleId !== undefined && circleId) || (rumahUsahaId !== undefined && rumahUsahaId)
      || indukId !== undefined || tipe !== undefined
    if (gantiNaungan) {
      const lama = await prisma.studio.findUnique({ where: { id: req.params.id }, select: { tipe: true, circleId: true, rumahUsahaId: true, indukId: true } })
      if (!lama) return res.status(404).json({ success: false, message: 'Studio tidak ditemukan' })
      const akhir = { tipe: tipe ?? lama.tipe, circleId: lama.circleId, rumahUsahaId: lama.rumahUsahaId, indukId: lama.indukId }
      if (circleId) Object.assign(akhir, { circleId, rumahUsahaId: null, indukId: null })
      else if (rumahUsahaId) Object.assign(akhir, { circleId: null, rumahUsahaId, indukId: null })
      else if (indukId) Object.assign(akhir, { circleId: null, rumahUsahaId: null, indukId })
      const sentuhKorporasi = akhir.tipe === 'KORPORASI' || lama.tipe === 'KORPORASI' || (akhir.indukId ?? null) !== (lama.indukId ?? null)
      if (sentuhKorporasi && !hasAnyRole(req.userRoles ?? [], SUPER_ADMIN)) {
        return res.status(403).json({ success: false, message: 'Hanya Super Admin yang bisa mengatur Korporasi' })
      }
      if (lama.tipe === 'KORPORASI' && akhir.tipe !== 'KORPORASI' && await prisma.studio.count({ where: { indukId: req.params.id } })) {
        return res.status(422).json({ success: false, message: 'Pindahkan dulu unit di bawah Korporasi ini' })
      }
      const naungan = await tentukanNaungan(akhir, req.params.id)
      if (naungan.error) return res.status(422).json({ success: false, message: naungan.error })
      parentUpdate = naungan.data
    }
    const studio = await prisma.studio.update({
      where: { id: req.params.id },
      data: {
        ...(nama          !== undefined && { nama }),
        ...parentUpdate,
        ...(tipe          !== undefined && { tipe }),
        ...(niche         !== undefined && { niche: niche || null }),
        ...(koordinatorId !== undefined && { koordinatorId: koordinatorId || null }),
        ...(statusAktif   !== undefined && { statusAktif }),
        ...(statusShu     !== undefined && { statusShu: !!statusShu }),
        ...(totalShu      !== undefined && { totalShu: Number(totalShu) }),
        ...(hitungDiEkosistem !== undefined && { hitungDiEkosistem: !!hitungDiEkosistem }),
        // Mitra hanya bermakna untuk studio kolaborasi: dikosongkan otomatis saat tanda dilepas.
        ...(mitraKolaborasi !== undefined && { mitraKolaborasi: String(mitraKolaborasi ?? '').trim().slice(0, 80) || null }),
        ...(hitungDiEkosistem === true && mitraKolaborasi === undefined && { mitraKolaborasi: null }),
      },
      include: {
        circle:     { select: { id: true, nama: true, colorHex: true } },
        rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
        induk:      { select: { id: true, nama: true } },
      },
    })
    return res.json({ success: true, data: studio })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const deleteStudio = async (req, res) => {
  try {
    const { id } = req.params
    const studio = await prisma.studio.findUnique({ where: { id } })
    if (!studio) return res.status(404).json({ success: false, message: 'Studio tidak ditemukan' })

    await prisma.$transaction([
      prisma.weeklyReport.deleteMany({ where: { studioId: id } }),
      prisma.kanbanCard.deleteMany({ where: { studioId: id } }),
      prisma.kanbanColumn.deleteMany({ where: { studioId: id } }),
      prisma.goal.updateMany({ where: { studioId: id }, data: { studioId: null } }),
      prisma.milestone.updateMany({ where: { studioId: id }, data: { studioId: null } }),
      prisma.userRole.deleteMany({ where: { studioId: id } }),
      prisma.studio.delete({ where: { id } }),
    ])
    return res.json({ success: true, message: 'Studio berhasil dihapus permanen' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── RUMAH USAHA ──────────────────────────────────────────

export const getRumahUsahaList = async (req, res) => {
  try {
    const list = await prisma.rumahUsaha.findMany({
      where: { statusAktif: true },
      include: {
        _count: { select: { studios: true } },
        // Kepala Rumah Usaha derived dari UserRole (bukan kolom kepalId), sama pola kayak
        // getCircles -- kepalId di kolom cuma buat konsistensi skema, sumber kebenarannya role.
        userRoles: {
          where: { studioId: null, roleType: 'KEPALA_RUMAH_USAHA' },
          include: { user: { select: { id: true, nama: true } } },
        },
      },
      orderBy: { nama: 'asc' },
    })
    return res.json({ success: true, data: list })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const createRumahUsaha = async (req, res) => {
  try {
    const { nama, deskripsi, colorHex, alamat, mapsUrl } = req.body
    if (!nama) return res.status(422).json({ success: false, message: 'nama wajib diisi' })
    const item = await prisma.rumahUsaha.create({
      data: {
        nama, deskripsi: deskripsi || null, colorHex: colorHex || null,
        alamat: alamat || null, mapsUrl: mapsUrl || null,
      },
    })
    return res.status(201).json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const updateRumahUsaha = async (req, res) => {
  try {
    const { nama, deskripsi, colorHex, statusAktif, alamat, mapsUrl } = req.body
    const item = await prisma.rumahUsaha.update({
      where: { id: req.params.id },
      data: {
        ...(nama        !== undefined && { nama }),
        ...(deskripsi   !== undefined && { deskripsi: deskripsi || null }),
        ...(colorHex    !== undefined && { colorHex: colorHex || null }),
        ...(statusAktif !== undefined && { statusAktif }),
        ...(alamat      !== undefined && { alamat: alamat || null }),
        ...(mapsUrl     !== undefined && { mapsUrl: mapsUrl || null }),
      },
    })
    return res.json({ success: true, data: item })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const deleteRumahUsaha = async (req, res) => {
  try {
    await prisma.rumahUsaha.update({ where: { id: req.params.id }, data: { statusAktif: false } })
    return res.json({ success: true, message: 'Rumah Usaha dinonaktifkan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── COMBINED (untuk dropdown form) ───────────────────────

export const getMasterdata = async (req, res) => {
  try {
    const lingkup = await lingkupKeuangan(req.userRoles)
    const [circles, studios, rumahUsahaList] = await Promise.all([
      prisma.circle.findMany({ orderBy: { nama: 'asc' } }),
      prisma.studio.findMany({
        include: {
          circle:     { select: { id: true, nama: true, colorHex: true } },
          rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
        },
        orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
      }),
      prisma.rumahUsaha.findMany({ where: { statusAktif: true }, orderBy: { nama: 'asc' } }),
    ])
    return res.json({ success: true, data: { circles, studios: studios.map(s => lingkup.boleh(s.id) ? s : { ...s, totalShu: null }), rumahUsaha: rumahUsahaList } })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// ── SKB (Studi Kelayakan Bisnis) ─────────────────────────

async function deleteSkbFile(skbUrl) {
  if (!skbUrl) return
  const filename = skbUrl.split('/').pop()
  const filePath = path.join(__dirname, '../../uploads/skb', filename)
  try { await unlink(filePath) } catch { /* file sudah tidak ada, abaikan */ }
}

export const uploadStudioSkb = async (req, res) => {
  try {
    if (!req.file) return res.status(422).json({ success: false, message: 'File PDF wajib disertakan' })
    if (!(await canManageStudio(req.userRoles, req.params.id))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    const studio = await prisma.studio.findUnique({ where: { id: req.params.id }, select: { skbUrl: true } })
    if (!studio) return res.status(404).json({ success: false, message: 'Studio tidak ditemukan' })
    await deleteSkbFile(studio.skbUrl)
    const skbUrl = `/uploads/skb/${req.file.filename}`
    const updated = await prisma.studio.update({
      where: { id: req.params.id },
      data:  { skbUrl },
    })
    return res.json({ success: true, data: { skbUrl: updated.skbUrl } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal upload SKB' })
  }
}

export const deleteStudioSkb = async (req, res) => {
  try {
    if (!(await canManageStudio(req.userRoles, req.params.id))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke studio ini' })
    }
    const studio = await prisma.studio.findUnique({ where: { id: req.params.id }, select: { skbUrl: true } })
    if (!studio) return res.status(404).json({ success: false, message: 'Studio tidak ditemukan' })
    await deleteSkbFile(studio.skbUrl)
    await prisma.studio.update({ where: { id: req.params.id }, data: { skbUrl: null } })
    return res.json({ success: true, message: 'SKB berhasil dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus SKB' })
  }
}

// ── KOORDINATORS (untuk dropdown) ────────────────────────

export const getKoordinators = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { statusAktif: true },
      select: { id: true, nama: true },
      orderBy: { nama: 'asc' },
    })
    return res.json({ success: true, data: users })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
