import prisma from '../prisma.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { SUPER_ADMIN, hasAnyRole, bolehMasukDashboard, PESAN_AKSES_DITUTUP } from '../utils/roles.js'
import { resolveWeb, izinMasukLingkup, PESAN_BUKAN_LINGKUP } from '../utils/web.js'

// Kedua secret WAJIB diset — dicek saat startup di app.js
const signAccess  = (payload) => jwt.sign(payload, process.env.JWT_SECRET,          { expiresIn: '15m' })
const signRefresh = (payload) => jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d'  })

// Hash dummy buat jaga waktu respons konsisten pas email tidak terdaftar — tanpa ini,
// !user short-circuit bikin respons "email salah" jauh lebih cepat daripada "password salah"
// (bcrypt.compare tidak pernah kepanggil), celah timing buat enumerasi email terdaftar.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', 10)

export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(422).json({ success: false, message: 'Email dan password wajib diisi' })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      // studio.circle/studio.rumahUsaha di-nest juga -- lihat komentar di me() bawah, alasan
      // sama persis (satu-satunya dua sumber user.roles buat AuthContext: login & /me).
      include: {
        roles: { include: { circle: true, rumahUsaha: true, studio: { include: { circle: true, rumahUsaha: true } } } },
        // Cuma buat hitung flag isProduksiSuperUser di bawah -- relasi mentahnya TIDAK
        // diteruskan ke response (lihat komentar produksiSuperOverride di me()).
        produksiSuperOverride: { select: { id: true } },
        _count: { select: { siswaBimbingan: true } },
      },
    })

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !passwordMatches) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' })
    }

    if (!user.statusAktif) {
      return res.status(403).json({ success: false, message: 'Akun tidak aktif' })
    }
    // Setelah password terverifikasi (bukan sebelumnya) supaya pesan ini tak membocorkan email terdaftar.
    // Jalur masuk: Management Dashboard (pembatas peran minimum berlaku) atau web circle (pembatas = harus
    // punya peran kerja di circle itu; peran minimum Ekosistem TIDAK berlaku — pekerja memang memakai web ini).
    const web = await resolveWeb(req)
    if (web.galat) return res.status(404).json({ success: false, message: web.galat })
    if (web.aud === 'app') {
      if (!bolehMasukDashboard(user.roles)) {
        return res.status(403).json({ success: false, message: PESAN_AKSES_DITUTUP })
      }
    } else if (!(await izinMasukLingkup(user.id, user.roles, web.lingkup))) { // + pemilik unit (lihat saja)
      return res.status(403).json({ success: false, message: PESAN_BUKAN_LINGKUP(web.lingkup.nama) })
    }
    const klaimWeb = web.aud === 'circle' ? { aud: 'circle', cs: web.lingkup.slug } : {}
    // Riwayat login (audit OGS #12): dicatat tanpa menunggu & tanpa menggagalkan login bila gagal.
    prisma.logLogin.create({ data: { userId: user.id, web: web.aud === 'circle' ? web.lingkup.slug : 'app', ip: (req.ip ?? '').slice(0, 64) || null, perangkat: String(req.headers['user-agent'] ?? '').slice(0, 200) || null } }).catch(() => {})

    const payload = { id: user.id, email: user.email, tv: user.refreshTokenVersion, ...klaimWeb }
    const accessToken  = signAccess({ id: user.id, email: user.email, ...klaimWeb })
    const refreshToken = signRefresh(payload)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id:    user.id,
          nama:  user.nama,
          email: user.email,
          fotoUrl: user.fotoUrl,
          roles: user.roles,
          // Raport siswa (13 Okt 2026): penentu tampilnya tab Raport untuk siswa & mentornya.
          statusKeanggotaan: user.statusKeanggotaan,
          jumlahSiswaBimbingan: user._count.siswaBimbingan,
          // Override akses Superadmin KHUSUS modul Produksi/Payroll -- TIDAK ngasih privilege
          // ekosistem-wide apa pun di modul lain (lihat isProduksiSuperUser di utils/roles.js).
          isProduksiSuperUser: hasAnyRole(user.roles, SUPER_ADMIN) || !!user.produksiSuperOverride,
        },
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal login, coba lagi' })
  }
}

export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token tidak ditemukan' })
    }

    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)

    // Cek token version — jika user sudah logout, version di DB lebih tinggi
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, refreshTokenVersion: true, statusAktif: true },
    })

    if (!user || !user.statusAktif) {
      return res.status(401).json({ success: false, message: 'Akun tidak aktif' })
    }

    if ((payload.tv ?? 0) !== user.refreshTokenVersion) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' })
    }

    // Sesi yang masih hidup ikut berakhir: refresh ditolak → paling lama 15 menit (umur access token).
    const perans = await prisma.userRole.findMany({ where: { userId: user.id }, include: { studio: { select: { circleId: true, rumahUsahaId: true } } } })
    let klaimWeb = {}
    if (payload.aud === 'circle') {
      // sesi circle hanya boleh diperbarui lewat alamat circle yang sama, dan izinnya diperiksa ulang
      const web = await resolveWeb(req)
      if (web.aud !== 'circle' || web.lingkup.slug !== payload.cs || !(await izinMasukLingkup(user.id, perans, web.lingkup))) {
        return res.status(401).json({ success: false, message: 'Sesi tidak berlaku di alamat ini' })
      }
      klaimWeb = { aud: 'circle', cs: payload.cs }
    } else if (!bolehMasukDashboard(perans)) {
      return res.status(401).json({ success: false, message: PESAN_AKSES_DITUTUP })
    }

    const accessToken = signAccess({ id: user.id, email: user.email, ...klaimWeb })
    return res.json({ success: true, data: { accessToken } })
  } catch {
    return res.status(401).json({ success: false, message: 'Refresh token tidak valid' })
  }
}

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken
    if (token) {
      const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)
      // Increment version → semua refresh token lama langsung invalid
      await prisma.user.update({
        where: { id: payload.id },
        data:  { refreshTokenVersion: { increment: 1 } },
      })
    }
  } catch {
    // Refresh token sudah invalid/expired — tetap lanjut clear cookie
  }
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  return res.json({ success: true, message: 'Berhasil logout' })
}

export const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, nama: true, email: true, fotoUrl: true,
        telegramId: true, tanggalMasuk: true, statusAktif: true,
        // studio.circle/studio.rumahUsaha di-nest juga -- role studio-scoped (KOORDINATOR/
        // PENDAMPING/KARYAWAN/MAGANG/KADER, mayoritas anggota) gak punya circleId/rumahUsahaId
        // LANGSUNG di UserRole (sengaja, lihat komentar di members.js onboard/updateRole/
        // addUserRole) -- circle-nya cuma bisa didapat lewat studio.circle. Tanpa ini, user.roles
        // dari /login & /me (satu-satunya sumber AuthContext) selalu punya studio.circle undefined,
        // bikin komponen yang baca r.circle langsung (bukan lewat getRoleCircle/getRoleOrgUnit
        // helper) salah nampilin warna/nama circle buat mayoritas anggota studio-scoped.
        roles: { include: { circle: true, rumahUsaha: true, studio: { include: { circle: true, rumahUsaha: true } } } },
        // Cuma buat hitung flag isProduksiSuperUser di bawah -- relasi mentahnya TIDAK
        // diteruskan ke response (dibuang, diganti boolean, biar konsisten sama shape login()).
        produksiSuperOverride: { select: { id: true } },
        statusKeanggotaan: true,
        _count: { select: { siswaBimbingan: true } },
      },
    })

    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' })
    if (req.user.aud === 'circle') {
      const web = await resolveWeb(req)
      if (web.aud !== 'circle' || web.lingkup.slug !== req.user.cs || !(await izinMasukLingkup(user.id, user.roles, web.lingkup))) {
        return res.status(403).json({ success: false, message: 'Sesi tidak berlaku di alamat ini' })
      }
    } else if (!bolehMasukDashboard(user.roles)) return res.status(403).json({ success: false, message: PESAN_AKSES_DITUTUP })
    const { produksiSuperOverride, _count, ...userClean } = user
    return res.json({
      success: true,
      data: {
        ...userClean,
        jumlahSiswaBimbingan: _count.siswaBimbingan,
        // Override akses Superadmin KHUSUS modul Produksi/Payroll -- TIDAK ngasih privilege
        // ekosistem-wide apa pun di modul lain (lihat isProduksiSuperUser di utils/roles.js).
        isProduksiSuperUser: hasAnyRole(user.roles, SUPER_ADMIN) || !!produksiSuperOverride,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data profil' })
  }
}
