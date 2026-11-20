import prisma from '../prisma.js'
import { canManageStudio } from '../utils/roles.js'


// Helper: cek apakah user adalah admin koperasi (boleh lihat nominal simpanan siapapun)
function isAdmin(roles) {
  return roles?.some(r => ['ADVISOR','ADMIN_FUNGSIONAL','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA'].includes(r.roleType)) ?? false
}

// Semua nasabah + aggregate total + status bulan ini
export const getNasabah = async (req, res) => {
  try {
    const bulan = parseInt(req.query.bulan) || new Date().getMonth() + 1
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear()

    const [users, studios, aggSimpanan, bulanIni] = await Promise.all([
      prisma.user.findMany({
        where: { statusAktif: true, isAnggotaKoperasi: true },
        select: {
          id: true, nama: true,
          roles: {
            select: { roleType: true,
              circle:     { select: { nama: true, colorHex: true } },
              rumahUsaha: { select: { nama: true, colorHex: true } },
            },
            orderBy: { id: 'asc' }, take: 1,
          },
        },
        orderBy: { nama: 'asc' },
      }),
      prisma.studio.findMany({
        where: { statusAktif: true },
        select: {
          id: true, nama: true, tipe: true,
          circle:     { select: { nama: true, colorHex: true } },
          rumahUsaha: { select: { nama: true, colorHex: true } },
        },
        orderBy: [{ circleId: 'asc' }, { nama: 'asc' }],
      }),
      // groupBy menggantikan findMany semua record — jauh lebih efisien
      prisma.koperasiSimpanan.groupBy({
        by: ['userId', 'studioId'],
        _sum: { pokok: true, wajib: true, sukarela: true, thr: true, subtotal: true },
      }),
      prisma.koperasiSimpanan.findMany({
        where: { bulan, tahun },
        select: { userId: true, studioId: true, status: true, subtotal: true, buktiBayar: true },
      }),
    ])

    const totals = {}
    const statusMap = {}

    for (const s of aggSimpanan) {
      const key = s.userId ? `u_${s.userId}` : `s_${s.studioId}`
      totals[key] = {
        pokok:    s._sum.pokok    ?? 0,
        wajib:    s._sum.wajib    ?? 0,
        sukarela: s._sum.sukarela ?? 0,
        thr:      s._sum.thr      ?? 0,
        grand:    s._sum.subtotal ?? 0,
      }
    }

    for (const s of bulanIni) {
      const key = s.userId ? `u_${s.userId}` : `s_${s.studioId}`
      statusMap[key] = { status: s.status, subtotal: s.subtotal, buktiBayar: s.buktiBayar }
    }

    // Nominal simpanan & bukti transfer itu data finansial pribadi — non-admin cuma boleh lihat
    // nominal miliknya sendiri (atau studio sendiri), selain itu status LUNAS/BELUM saja yang
    // tetap kelihatan (transparansi wajar) tapi angka & link buktinya disamarkan.
    const admin = isAdmin(req.userRoles)
    const myStudioIds = new Set((req.userRoles ?? []).filter(r => r.studioId).map(r => r.studioId))
    const maskFinansial = (row, isMine) => {
      if (admin || isMine) return row
      return {
        ...row,
        totals: null,
        bulanIni: row.bulanIni ? { status: row.bulanIni.status, subtotal: null, buktiBayar: null } : null,
      }
    }

    const userRows = users.map(u => maskFinansial({
      id: u.id, tipe: 'USER', nama: u.nama,
      circle: u.roles?.[0]?.circle ?? u.roles?.[0]?.rumahUsaha ?? null,
      role:   u.roles?.[0]?.roleType ?? null,
      totals:  totals[`u_${u.id}`]   ?? { pokok: 0, wajib: 0, sukarela: 0, thr: 0, grand: 0 },
      bulanIni: statusMap[`u_${u.id}`] ?? null,
    }, u.id === req.user.id))

    const studioRows = studios.map(s => maskFinansial({
      id: s.id, tipe: 'STUDIO', nama: s.nama,
      circle: s.circle ?? s.rumahUsaha, role: s.tipe,
      totals:  totals[`s_${s.id}`]   ?? { pokok: 0, wajib: 0, sukarela: 0, thr: 0, grand: 0 },
      bulanIni: statusMap[`s_${s.id}`] ?? null,
    }, myStudioIds.has(s.id)))

    // Total gabungan seluruh nasabah cuma buat admin -- non-admin udah dibatasi lihat nominal
    // sendiri doang di userRows/studioRows lewat maskFinansial, grandTotal jangan bocorin
    // agregat semua orang lewat jalur belakang.
    const grandTotal = admin ? Object.values(totals).reduce(
      (acc, t) => ({ pokok: acc.pokok+t.pokok, wajib: acc.wajib+t.wajib, sukarela: acc.sukarela+t.sukarela, thr: acc.thr+t.thr, grand: acc.grand+t.grand }),
      { pokok: 0, wajib: 0, sukarela: 0, thr: 0, grand: 0 }
    ) : null

    // Count MENUNGGU untuk badge admin
    const menungguCount = bulanIni.filter(s => s.status === 'MENUNGGU').length

    return res.json({ success: true, data: { userRows, studioRows, grandTotal, bulan, tahun, menungguCount } })
  } catch {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan, coba lagi" })
  }
}

// Riwayat per nasabah
export const getRiwayat = async (req, res) => {
  try {
    const { id, tipe } = req.params
    const isMine = tipe === 'STUDIO'
      ? req.userRoles?.some(r => r.studioId === id)
      : id === req.user.id
    if (!isAdmin(req.userRoles) && !isMine) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke riwayat ini' })
    }
    const where = tipe === 'STUDIO' ? { studioId: id } : { userId: id }
    const records = await prisma.koperasiSimpanan.findMany({
      where,
      orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
    })
    return res.json({ success: true, data: records })
  } catch {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan, coba lagi" })
  }
}

// Self-report: anggota lapor setoran sendiri (status → MENUNGGU)
export const laporSimpanan = async (req, res) => {
  try {
    const { nasabahId, nasabahTipe = 'USER', bulan, tahun, pokok = 0, wajib = 0, sukarela = 0, thr = 0, buktiBayar } = req.body

    if (!nasabahId || !bulan || !tahun) {
      return res.status(422).json({ success: false, message: 'nasabahId, bulan, tahun wajib' })
    }
    if (!buktiBayar?.trim()) {
      return res.status(422).json({ success: false, message: 'Link bukti transfer wajib diisi' })
    }

    const isStudioTarget = nasabahTipe === 'STUDIO'

    // User biasa hanya bisa lapor untuk dirinya sendiri. Koordinator (atau lebih tinggi) boleh
    // lapor untuk anggota mana saja (status tetap MENUNGGU, admin tetap konfirmasi). PENDAMPING
    // SENGAJA gak ikut -- keputusan eksplisit user, posisi ini gak selalu relevan buat urusan
    // koperasi tim (samain sama isKoordinator di client/src/pages/Koperasi/index.jsx).
    if (!isStudioTarget && nasabahId !== req.user.id) {
      const boleh = (req.userRoles ?? []).some(r =>
        ['KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','KEPALA_EKOSISTEM','ADVISOR'].includes(r.roleType)
      )
      if (!boleh) {
        return res.status(403).json({ success: false, message: 'Tidak bisa lapor untuk anggota lain' })
      }
    }

    // Laporan atas nama STUDIO wajib dibatasi ke studio yang benar-benar dikelola pelapor —
    // sebelumnya cabang ini TIDAK ADA pengecekan sama sekali (celah: siapa pun yang login bisa
    // upsert laporan koperasi studio manapun, termasuk menimpa status LUNAS balik ke MENUNGGU).
    if (isStudioTarget && !(await canManageStudio(req.userRoles ?? [], nasabahId))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa lapor untuk studio ini' })
    }

    if ([pokok, wajib, sukarela, thr].some(v => isNaN(Number(v)) || Number(v) < 0)) {
      return res.status(422).json({ success: false, message: 'Nominal simpanan tidak boleh negatif' })
    }
    const subtotal = Number(pokok) + Number(wajib) + Number(sukarela) + Number(thr)
    if (subtotal <= 0) {
      return res.status(422).json({ success: false, message: 'Total setoran harus lebih dari 0' })
    }

    const payload = {
      userId:   isStudioTarget ? null : nasabahId,
      studioId: isStudioTarget ? nasabahId : null,
      bulan: Number(bulan), tahun: Number(tahun),
      pokok: Number(pokok), wajib: Number(wajib),
      sukarela: Number(sukarela), thr: Number(thr),
      subtotal,
      status: 'MENUNGGU',
      buktiBayar: buktiBayar.trim(),
      dilaporkanOleh: req.user.id,
      dikonfirmasiOleh: null,
      catatanAdmin: null,
    }

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.koperasiSimpanan.findFirst({
        where: isStudioTarget
          ? { studioId: nasabahId, bulan: Number(bulan), tahun: Number(tahun) }
          : { userId:   nasabahId, bulan: Number(bulan), tahun: Number(tahun) },
      })
      return existing
        ? tx.koperasiSimpanan.update({ where: { id: existing.id }, data: payload })
        : tx.koperasiSimpanan.create({ data: payload })
    })

    return res.json({ success: true, data: record, message: 'Laporan setoran terkirim, menunggu konfirmasi admin' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan laporan setoran' })
  }
}

// Admin: upsert langsung (tanpa perlu bukti)
export const upsertSimpanan = async (req, res) => {
  try {
    const { nasabahId, nasabahTipe = 'USER', bulan, tahun, pokok = 0, wajib = 0, sukarela = 0, thr = 0, status = 'BELUM', buktiBayar, catatanAdmin } = req.body

    if (!nasabahId || !bulan || !tahun) {
      return res.status(422).json({ success: false, message: 'nasabahId, bulan, tahun wajib' })
    }
    if (!['USER','STUDIO'].includes(nasabahTipe)) {
      return res.status(422).json({ success: false, message: 'nasabahTipe harus USER atau STUDIO' })
    }
    if ([pokok, wajib, sukarela, thr].some(v => isNaN(Number(v)) || Number(v) < 0)) {
      return res.status(422).json({ success: false, message: 'Nominal simpanan tidak boleh negatif' })
    }

    const subtotal = Number(pokok) + Number(wajib) + Number(sukarela) + Number(thr)
    const isStudio = nasabahTipe === 'STUDIO'

    const payload = {
      userId:   isStudio ? null : nasabahId,
      studioId: isStudio ? nasabahId : null,
      bulan: Number(bulan), tahun: Number(tahun),
      pokok: Number(pokok), wajib: Number(wajib),
      sukarela: Number(sukarela), thr: Number(thr),
      subtotal, status,
      ...(buktiBayar    !== undefined && { buktiBayar }),
      ...(catatanAdmin  !== undefined && { catatanAdmin }),
      ...(status === 'LUNAS' && { dikonfirmasiOleh: req.user.id }),
    }

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.koperasiSimpanan.findFirst({
        where: isStudio
          ? { studioId: nasabahId, bulan: Number(bulan), tahun: Number(tahun) }
          : { userId:   nasabahId, bulan: Number(bulan), tahun: Number(tahun) },
      })
      return existing
        ? tx.koperasiSimpanan.update({ where: { id: existing.id }, data: payload })
        : tx.koperasiSimpanan.create({ data: payload })
    })

    return res.json({ success: true, data: record })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan data simpanan' })
  }
}

// Admin: konfirmasi atau tolak laporan MENUNGGU
export const konfirmasiSimpanan = async (req, res) => {
  try {
    const { id } = req.params
    const { status, catatanAdmin } = req.body

    if (!['LUNAS','NUNGGAK','BELUM'].includes(status)) {
      return res.status(422).json({ success: false, message: 'Status harus LUNAS, NUNGGAK, atau BELUM' })
    }

    const existing = await prisma.koperasiSimpanan.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Catatan setoran tidak ditemukan' })
    // Membatalkan status LUNAS yang sudah dikonfirmasi wajib disertai alasan — jejak audit
    // supaya tidak ada pembatalan diam-diam tanpa penjelasan.
    if (existing.status === 'LUNAS' && status !== 'LUNAS' && !catatanAdmin?.trim()) {
      return res.status(422).json({ success: false, message: 'Wajib isi catatan kalau membatalkan status LUNAS yang sudah dikonfirmasi' })
    }

    const record = await prisma.koperasiSimpanan.update({
      where: { id },
      data: {
        status,
        catatanAdmin:     catatanAdmin || null,
        dikonfirmasiOleh: req.user.id,
      },
    })

    return res.json({ success: true, data: record })
  } catch {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan, coba lagi" })
  }
}

// Rekap total per bulan (LUNAS only — untuk rekonsiliasi rekening)
export const getMonthlySummary = async (req, res) => {
  try {
    const rows = await prisma.koperasiSimpanan.groupBy({
      by: ['bulan', 'tahun'],
      where: { status: 'LUNAS' },
      _sum: { pokok: true, wajib: true, sukarela: true, thr: true, subtotal: true },
      _count: { id: true },
      orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
    })
    return res.json({ success: true, data: rows })
  } catch {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan' })
  }
}

// Badge count: jumlah MENUNGGU (ringan, hanya count)
export const getBadgeCount = async (req, res) => {
  try {
    const menunggu = await prisma.koperasiSimpanan.count({ where: { status: 'MENUNGGU' } })
    return res.json({ success: true, data: { menunggu } })
  } catch {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan, coba lagi" })
  }
}

// Daftar semua yang MENUNGGU konfirmasi (admin)
export const getMenunggu = async (req, res) => {
  try {
    const records = await prisma.koperasiSimpanan.findMany({
      where: { status: 'MENUNGGU' },
      orderBy: [{ tahun: 'desc' }, { bulan: 'desc' }],
    })

    // Enrich dengan nama nasabah
    const userIds   = records.filter(r => r.userId).map(r => r.userId)
    const studioIds = records.filter(r => r.studioId).map(r => r.studioId)

    const [users, studios] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nama: true },
      }),
      prisma.studio.findMany({
        where: { id: { in: studioIds } },
        select: { id: true, nama: true,
          circle:     { select: { nama: true, colorHex: true } },
          rumahUsaha: { select: { nama: true, colorHex: true } },
        },
      }),
    ])

    const userMap   = Object.fromEntries(users.map(u => [u.id, u]))
    const studioMap = Object.fromEntries(studios.map(s => [s.id, s]))

    const enriched = records.map(r => ({
      ...r,
      nasabah: r.userId ? { ...userMap[r.userId], tipe: 'USER' } : { ...studioMap[r.studioId], tipe: 'STUDIO' },
    }))

    return res.json({ success: true, data: enriched })
  } catch {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan, coba lagi" })
  }
}
