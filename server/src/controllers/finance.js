import prisma from '../prisma.js'
import { getMonthAttributionRange, isReportInMonth } from '../utils/week.js'
import { canManageOrgUnit, hasAnyRole, SUPER_ADMIN } from '../utils/roles.js'
import { lingkupKeuangan, samarkan, FIELD_UANG_LAPORAN } from '../utils/lingkup.js'

// Semua pos tetap terlihat, tapi data rekening pos di luar wilayahnya disamarkan: pos level ekosistem hanya
// terbuka untuk Advisor/Kepala Ekosistem; pos circle / rumah usaha untuk pengelolanya (+ admin pos itu sendiri).
const posMilikku = (lingkup, userId, p) => lingkup.semua || p.adminId === userId
  || (p.circleId && lingkup.circleIds.has(p.circleId)) || (p.rumahUsahaId && lingkup.rumahUsahaIds.has(p.rumahUsahaId))
const samarkanPos = (lingkup, userId) => (p) => (posMilikku(lingkup, userId, p) ? p : samarkan(p, ['namaBank', 'noRekening', 'namaPemilik']))


export const getPosts = async (req, res) => {
  try {
    const lingkup = await lingkupKeuangan(req.userRoles)
    const posts = await prisma.financePost.findMany({
      orderBy: [{ tipe: 'asc' }, { nama: 'asc' }],
    })
    return res.json({ success: true, data: posts.map(samarkanPos(lingkup, req.user.id)) })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

// Belum pernah ada UI buat nambah/edit/hapus Pos Keuangan sama sekali sejak fitur ini dibuat --
// seluruh isi "Pos Internal"/"Dana Lainnya" murni dari data seed. Ditambah 20 Juli 2026 supaya
// Rumah Usaha baru (atau pos apa pun) gak perlu migration/seed manual lagi buat dicatat.
export const createPost = async (req, res) => {
  try {
    const { nama, adminId, tipe, circleId, rumahUsahaId, namaBank, noRekening, namaPemilik } = req.body
    if (!nama || !adminId || !tipe) {
      return res.status(422).json({ success: false, message: 'nama, adminId, dan tipe wajib diisi' })
    }
    if (!['INTERNAL', 'EKSTERNAL'].includes(tipe)) {
      return res.status(422).json({ success: false, message: 'tipe harus INTERNAL atau EKSTERNAL' })
    }
    if (circleId && rumahUsahaId) {
      return res.status(422).json({ success: false, message: 'Pilih salah satu: Circle atau Rumah Usaha (atau kosongkan buat pos level Ekosistem)' })
    }
    const post = await prisma.financePost.create({
      data: {
        nama, adminId, tipe,
        circleId: circleId || null,
        rumahUsahaId: rumahUsahaId || null,
        namaBank: namaBank || null,
        noRekening: noRekening || null,
        namaPemilik: namaPemilik || null,
      },
    })
    return res.status(201).json({ success: true, data: post })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menambah pos' })
  }
}

export const updatePost = async (req, res) => {
  try {
    const { id } = req.params
    const { nama, adminId, circleId, rumahUsahaId, namaBank, noRekening, namaPemilik } = req.body
    const existing = await prisma.financePost.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Pos tidak ditemukan' })

    const roles = req.userRoles ?? []
    const isSuperAdmin = hasAnyRole(roles, SUPER_ADMIN)
    // Kepala Circle/Kepala Rumah Usaha yang scope-nya cocok DENGAN POS INI (bukan superadmin),
    // atau si "Admin"/pengelola yang tercatat di pos itu sendiri, boleh update data rekening --
    // sebelumnya cuma superadmin yang bisa, jadi Kepala Circle/pengelola gak pernah bisa
    // input/edit rekening dana circle-nya sendiri.
    const isScopedManager = canManageOrgUnit(roles, { circleId: existing.circleId, rumahUsahaId: existing.rumahUsahaId })
    const isOwnPost = existing.adminId === req.user.id
    if (!isSuperAdmin && !isScopedManager && !isOwnPost) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses buat mengubah pos ini' })
    }

    if (circleId && rumahUsahaId) {
      return res.status(422).json({ success: false, message: 'Pilih salah satu: Circle atau Rumah Usaha (atau kosongkan buat pos level Ekosistem)' })
    }

    // Non-superadmin (scoped manager / pengelola pos sendiri) cuma boleh update nama & data
    // rekening -- TIDAK boleh pindahkan admin/cakupan pos ke circle/rumah-usaha/orang lain,
    // itu tetap superadmin-only supaya gak ada celah pos "dipindah" keluar dari scope wewenangnya.
    const post = await prisma.financePost.update({
      where: { id },
      data: {
        ...(nama        !== undefined && { nama }),
        ...(namaBank    !== undefined && { namaBank: namaBank || null }),
        ...(noRekening  !== undefined && { noRekening: noRekening || null }),
        ...(namaPemilik !== undefined && { namaPemilik: namaPemilik || null }),
        ...(isSuperAdmin && adminId     !== undefined && { adminId }),
        ...(isSuperAdmin && circleId     !== undefined && { circleId: circleId || null }),
        ...(isSuperAdmin && rumahUsahaId !== undefined && { rumahUsahaId: rumahUsahaId || null }),
      },
    })
    return res.json({ success: true, data: post })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pos' })
  }
}

export const deletePost = async (req, res) => {
  try {
    const existing = await prisma.financePost.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Pos tidak ditemukan' })
    await prisma.financePost.delete({ where: { id: req.params.id } })
    return res.json({ success: true, message: 'Pos dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pos' })
  }
}

// Nama "PaymentMatrix" dipertahankan (bukan di-rename) karena masih dipakai frontend tab
// "Pos Keuangan" buat ambil daftar posts+studios — cuma bagian matrix status setoran yang
// dihapus (fitur Matrix Status Setoran sudah dihapus, dinilai tidak efisien).
export const getPaymentMatrix = async (req, res) => {
  try {
    const bulan = parseInt(req.params.bulan) || new Date().getMonth() + 1
    const tahun = parseInt(req.params.tahun) || new Date().getFullYear()

    const lingkup = await lingkupKeuangan(req.userRoles)
    const [posts, studios, circles, rumahUsahaList] = await Promise.all([
      prisma.financePost.findMany({ orderBy: [{ tipe: 'asc' }, { nama: 'asc' }] }),
      prisma.studio.findMany({
        where: { statusAktif: true },
        select: {
          id: true, nama: true, tipe: true, circleId: true, rumahUsahaId: true,
          circle:     { select: { nama: true, colorHex: true } },
          rumahUsaha: { select: { nama: true, colorHex: true } },
        },
        orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
      }),
      // Diambil langsung (bukan diturunkan dari studios) supaya circle/rumah usaha yang belum
      // punya studio sama sekali (mis. Rumah Usaha baru dibuat) tetap bisa di-resolve namanya.
      prisma.circle.findMany({ select: { id: true, nama: true, colorHex: true }, orderBy: { nama: 'asc' } }),
      prisma.rumahUsaha.findMany({ where: { statusAktif: true }, select: { id: true, nama: true, colorHex: true }, orderBy: { nama: 'asc' } }),
    ])

    return res.json({
      success: true,
      data: { posts: posts.map(samarkanPos(lingkup, req.user.id)), studios, circles, rumahUsahaList, bulan, tahun },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}

export const getKasSummary = async (req, res) => {
  try {
    // Minggu yang nyebrang bulan diatribusikan ke bulan dengan hari terbanyak (lihat
    // getMonthAttributionRange) -- konsisten sama Rekap Bulanan, bukan cuma tanggal 1 kalender.
    const now = new Date()
    const bulanIni = now.getMonth() + 1
    const tahunIni = now.getFullYear()
    const { rangeStart: startOfMonth } = getMonthAttributionRange(bulanIni, tahunIni)

    const lingkup = await lingkupKeuangan(req.userRoles)
    const reports = (await prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: startOfMonth } },
      orderBy: [{ studioId: 'asc' }, { createdAt: 'desc' }],
      include: { studio: { select: { nama: true,
        circle:     { select: { nama: true, colorHex: true } },
        rumahUsaha: { select: { nama: true, colorHex: true } },
      } } },
    })).filter(r => isReportInMonth(r, bulanIni, tahunIni))

    // Latest report per studio
    const latestPerStudio = {}
    for (const r of reports) {
      if (!latestPerStudio[r.studioId]) latestPerStudio[r.studioId] = r
    }

    // Semua unit tetap tampil; uang unit di luar wilayah disamarkan.
    const result = Object.values(latestPerStudio)
      .sort((a, b) => a.studio.nama.localeCompare(b.studio.nama))
      .map(r => (lingkup.boleh(r.studioId) ? r : samarkan(r, FIELD_UANG_LAPORAN)))

    return res.json({ success: true, data: result })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan, coba lagi' })
  }
}
