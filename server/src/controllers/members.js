import { lingkupKeuangan } from '../utils/lingkup.js'
import prisma from '../prisma.js'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { parsePagination, SUPER_ADMIN, hasAnyRole, ROLE_LEVEL, canManageMember, canManageStudio, canManageStudioRoles, bestLevel, canAssignScope, scopeArgs } from '../utils/roles.js'
import { computeTotalKompensasi } from '../utils/compensation.js'

// Posisi level-studio (bukan hierarki organisasi lintas-studio) -- KOORDINATOR & PENDAMPING
// dianggap SEJAJAR di studio yang sama-sama mereka kelola, walau ROLE_LEVEL taruh PENDAMPING
// lebih senior secara angka. Dipakai buat carve-out aturan anti-eskalasi di onboard/updateRole/
// addUserRole: kalau caller punya wewenang KOORDINATOR/PENDAMPING (atau lebih senior) ATAS
// studio target (lihat canManageStudioRoles), dia boleh assign posisi-posisi ini walau nomor
// ROLE_LEVEL-nya "lebih senior" dari role caller sendiri.
const STUDIO_ROLES = ['KOORDINATOR', 'PENDAMPING', 'KARYAWAN', 'MAGANG', 'KADER', 'DIGNITY', 'PENASIHAT']


export const getAll = async (req, res) => {
  try {
    const { search = '', circleId, studioId, roleType } = req.query
    const { page, limit, skip } = parsePagination(req.query)

    const where = {
      statusAktif: true,
      ...(search   && { nama: { contains: search, mode: 'insensitive' } }),
      ...(circleId && { roles: { some: { circleId } } }),
      ...(studioId && { roles: { some: { studioId } } }),
      ...(roleType && { roles: { some: { roleType } } }),
    }

    // ?lingkup=wilayah dipakai halaman Unduh Laporan: hanya anggota yang berperan di UNIT/CIRCLE/RUMAH USAHA
    // dalam wilayah peran pengunduh (Advisor/Kepala Ekosistem = semua). Halaman Anggota biasa tak memakainya.
    if (req.query.lingkup === 'wilayah') {
      const lingkup = await lingkupKeuangan(req.userRoles)
      if (!lingkup.semua) {
        const or = [{ studioId: { in: [...lingkup.studioIds] } }]
        if (lingkup.circleIds.size) or.push({ circleId: { in: [...lingkup.circleIds] } })
        if (lingkup.rumahUsahaIds.size) or.push({ rumahUsahaId: { in: [...lingkup.rumahUsahaIds] } })
        where.AND = [{ roles: { some: { OR: or } } }]
      }
    }

    // PENTING: ini harus SUPER_ADMIN murni (ADVISOR/KEPALA_EKOSISTEM), BUKAN FULL_ADMIN
    // -- FULL_ADMIN ikut mencakup KEPALA_CIRCLE/KEPALA_RUMAH_USAHA yang scope-nya cuma circle/
    // rumah usaha sendiri, sebelumnya dianggap "admin penuh" di sini sehingga masking di bawah
    // (if canFetchSensitive && !isAdmin) gak pernah jalan buat mereka -- KEPALA_CIRCLE bisa lihat
    // NIK/rekening/BPJS SELURUH ekosistem, bukan cuma circle-nya.
    const isSuperAdmin = hasAnyRole(req.userRoles ?? [], SUPER_ADMIN)
    // KOORDINATOR/PENDAMPING/KEPALA_CIRCLE/KEPALA_RUMAH_USAHA boleh EDIT rekening/NIK/BPJS
    // anggota di scope sendiri (canManageMember di updateProfile mengizinkan), tapi field ini
    // sebelumnya cuma di-select kalau isAdmin (FULL_ADMIN) -- akibatnya field itu selalu kosong
    // pas di-fetch balik buat KOORDINATOR/PENDAMPING, walau baru aja berhasil disimpan. Sekarang
    // di-select juga buat semua role scoped ini, lalu di-mask per-baris di bawah biar tetap gak
    // bocor ke anggota di luar studio/circle/rumah usaha mereka masing-masing.
    const canFetchSensitive = isSuperAdmin || hasAnyRole(req.userRoles ?? [], ['KOORDINATOR', 'PENDAMPING', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA'])

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nama: 'asc' },
        select: {
          id: true,
          nama: true,
          email: true,
          fotoUrl: true,
          tanggalMasuk: true,
          isLiveIn: true,
          isAnggotaKoperasi: true,
          statusKeanggotaan: true,
          statusAktif: true,
          posisi: true,
          nomorWa: true,
          telegramUsername: true,
          tanggalLahir: true,
          jenisKelamin: true,
          alamat: true,
          // Data sensitif — di-select kalau caller punya wewenang kelola SIAPA PUN (admin, atau
          // koordinator/pendamping buat studio sendiri); dimask per-baris di bawah kalau bukan admin.
          ...(canFetchSensitive && {
            noRekening: true,
            atasNamaRekening: true,
            nik: true,
            nomorBpjs: true,
          }),
          // select eksplisit (bukan include) — biar takeHomePay per-posisi (baru ditambahkan di
          // UserRole) TIDAK ikut kebocor ke direktori umum ini. Breakdown/total THP sengaja cuma
          // dibuka lewat getById (self/admin) atau roster Bio Studio (admin studio itu sendiri).
          roles: {
            select: {
              id: true, roleType: true, circleId: true, rumahUsahaId: true, studioId: true,
              circle:     { select: { id: true, nama: true, colorHex: true } },
              rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
              // circle/rumahUsaha di sini di-select JUGA (bukan cuma circleId/rumahUsahaId studio)
              // biar client bisa nurunkan circle keanggotaan dari studio.circle YANG SEKARANG,
              // bukan dari UserRole.circleId yang bisa basi kalau studionya dipindah circle
              // belakangan (lihat getRoleCircle/getRoleRumahUsaha di client/src/utils/roles.js).
              studio: { select: {
                id: true, nama: true, tipe: true, circleId: true, rumahUsahaId: true,
                circle:     { select: { id: true, nama: true, colorHex: true } },
                rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
              } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    // KOORDINATOR/PENDAMPING/KEPALA_CIRCLE/KEPALA_RUMAH_USAHA (bukan superadmin) cuma boleh
    // LIHAT rekening/NIK/BPJS anggota di scope sendiri, bukan seluruh direktori -- fieldnya udah
    // di-select buat mereka (canFetchSensitive di atas), tapi harus di-mask per-baris di sini
    // sebelum dikirim. Logika sama persis dengan canManageMember di utils/roles.js, cuma sinkron
    // karena data role+studio.circleId/rumahUsahaId udah kebawa sekalian dari query di atas
    // (gak perlu query tambahan per-anggota).
    if (canFetchSensitive && !isSuperAdmin) {
      const myStudioIds = new Set(
        (req.userRoles ?? []).filter(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId).map(r => r.studioId)
      )
      const myCircleIds = new Set(
        (req.userRoles ?? []).filter(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId).map(r => r.circleId)
      )
      const myRumahUsahaIds = new Set(
        (req.userRoles ?? []).filter(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId).map(r => r.rumahUsahaId)
      )
      for (const u of users) {
        const canSee = u.roles.some(r =>
          (r.studioId && myStudioIds.has(r.studioId)) ||
          (r.studio?.circleId && myCircleIds.has(r.studio.circleId)) ||
          (r.studio?.rumahUsahaId && myRumahUsahaIds.has(r.studio.rumahUsahaId))
        )
        if (!canSee) {
          delete u.noRekening
          delete u.atasNamaRekening
          delete u.nik
          delete u.nomorBpjs
        }
      }
    }

    return res.json({
      success: true,
      data: users,
      pagination: { page, limit, total },
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data anggota' })
  }
}

export const getById = async (req, res) => {
  try {
    const { id } = req.params
    const isOwner = id === req.user.id
    // PENTING: pakai canManageMember (scoped), BUKAN blanket FULL_ADMIN -- FULL_ADMIN mencakup
    // KEPALA_CIRCLE/KEPALA_RUMAH_USAHA yang sebelumnya dianggap "admin penuh" di sini, jadi bisa
    // buka detail LENGKAP (termasuk NIK/rekening/BPJS/THP via computeTotalKompensasi) siapa pun
    // di seluruh ekosistem, bukan cuma anggota circle/rumah-usaha mereka sendiri.
    if (!isOwner && !(await canManageMember(id, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            circle: true,
            rumahUsaha: true,
            studio: { include: { circle: true, rumahUsaha: true } },
          },
        },
        studioPemilik: {
          select: { id: true, persenSaham: true, studio: { select: { id: true, nama: true, statusShu: true, totalShu: true } } },
        },
      },
    })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    return res.json({ success: true, data: { ...user, ...computeTotalKompensasi(user.roles, user.studioPemilik) } })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data anggota' })
  }
}

// email/passwordAwal opsional — kalau dikosongkan, dibuatkan akun "shell" (placeholder,
// nggak pernah dipakai login) untuk orang yang perlu tercatat di sistem (anggota atau pemilik
// saham) tapi nggak butuh akses login sama sekali (mis. investor murni, anggota yang cuma
// buat pencatatan). roleType juga opsional — kalau dikosongkan, User dibuat TANPA UserRole
// sama sekali (dipakai dari alur "Tambah Pemilik" di Kepemilikan Saham, yang nempelin
// StudioPemilik terpisah setelah User-nya dibuat).
export const onboard = async (req, res) => {
  try {
    const { nama, email, passwordAwal, roleType, circleId, studioId } = req.body

    if (!nama) {
      return res.status(422).json({ success: false, message: 'nama wajib diisi' })
    }
    if (roleType && ROLE_LEVEL[roleType] === undefined) {
      return res.status(422).json({ success: false, message: 'roleType tidak valid' })
    }
    if (roleType && ROLE_LEVEL[roleType] < bestLevel(req.userRoles)) {
      const lateralStudioOk = STUDIO_ROLES.includes(roleType) && studioId && (await canManageStudioRoles(req.userRoles, studioId))
      if (!lateralStudioOk) {
        return res.status(403).json({ success: false, message: 'Tidak bisa membuat akun dengan role lebih senior dari role sendiri' })
      }
    }
    // Scope tetap dicek walau roleType kosong (mis. pemilik-only) -- studioId/circleId di sini
    // dipakai buat wewenang, bukan berarti bakal ada UserRole untuk itu.
    if ((studioId || circleId) && !(await canAssignScope(req.userRoles ?? [], scopeArgs(studioId, circleId)))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa membuat akun untuk studio/circle di luar wewenangmu' })
    }

    let finalEmail = email?.toLowerCase()
    let finalPasswordHash
    if (finalEmail) {
      if (!passwordAwal) {
        return res.status(422).json({ success: false, message: 'passwordAwal wajib diisi kalau email diisi' })
      }
      const existing = await prisma.user.findUnique({ where: { email: finalEmail } })
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email sudah terdaftar' })
      }
      finalPasswordHash = await bcrypt.hash(passwordAwal, 10)
    } else {
      // Shell account -- email & password placeholder, akun ini nggak dimaksudkan buat login.
      finalEmail = `noaccount-${crypto.randomBytes(8).toString('hex')}@akun.internal`
      finalPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10)
    }

    const user = await prisma.user.create({
      data: {
        nama,
        email: finalEmail,
        passwordHash: finalPasswordHash,
        ...(roleType && {
          roles: {
            create: {
              roleType,
              // circleId gak dipakai kalau studioId keisi -- circle keanggotaan studio-scoped
              // role diturunkan live dari studio.circleId (lihat getRoleCircle di client), bukan
              // disimpan ganda di sini. Nyimpen dua-duanya bikin data basi kalau studionya
              // dipindah circle belakangan (studioId tetap bener, circleId nyangkut di circle lama).
              circleId: studioId ? null : (circleId || null),
              studioId: studioId || null,
            },
          },
        }),
      },
      include: {
        roles: {
          include: {
            circle:     { select: { id: true, nama: true, colorHex: true } },
            rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
            studio:     { select: { id: true, nama: true, tipe: true } },
          },
        },
      },
    })

    return res.status(201).json({ success: true, data: user, message: `${nama} berhasil ditambahkan` })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal membuat akun' })
  }
}

export const nonaktifkan = async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id }, include: { roles: true } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Tidak bisa menonaktifkan akun sendiri' })
    }
    // SUPER_ADMIN (Advisor/Kepala Ekosistem) saling bisa kelola sesama -- keduanya udah
    // setara-dipercaya (lolos canManageMember/scope check di bawah tanpa syarat), jadi gak masuk
    // akal cek seniority ekstra INI yang malah ngeblok satu sama lain (dulu ke-block total kalau
    // target punya role Advisor di ANTARA banyak role lain, walau Advisor cuma salah satu tag,
    // bukan jabatan utamanya).
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && bestLevel(user.roles) < bestLevel(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak bisa menonaktifkan akun dengan role lebih senior' })
    }
    // Cek seniority di atas doang GAK CUKUP -- dua orang di level yang SAMA (mis. dua KARYAWAN
    // beda studio) lolos cek itu (8 < 8 = false), padahal gak ada hubungan wewenang sama sekali.
    // Wajib juga scope check yang sama kayak aksi kelola-anggota lain (canManageMember).
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && !(await canManageMember(id, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Tidak punya wewenang menonaktifkan akun ini' })
    }

    await prisma.user.update({
      where: { id },
      data:  { statusAktif: false },
    })

    return res.json({ success: true, message: `Akun ${user.nama} telah dinonaktifkan` })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menonaktifkan akun' })
  }
}

export const toggleLiveIn = async (req, res) => {
  try {
    const { id } = req.params
    const user = await prisma.user.findUnique({ where: { id }, select: { isLiveIn: true, nama: true } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    if (!(await canManageMember(id, req.userRoles))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke anggota ini' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isLiveIn: !user.isLiveIn },
      select: { id: true, isLiveIn: true },
    })
    return res.json({
      success: true,
      data: updated,
      message: `${user.nama} ${updated.isLiveIn ? 'ditandai sebagai Live In' : 'diubah ke Non Live In'}`,
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal update status live in' })
  }
}

export const toggleKoperasi = async (req, res) => {
  try {
    const { id } = req.params
    const user = await prisma.user.findUnique({ where: { id }, select: { isAnggotaKoperasi: true, nama: true } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    if (!(await canManageMember(id, req.userRoles))) {
      return res.status(403).json({ success: false, message: 'Tidak punya akses ke anggota ini' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isAnggotaKoperasi: !user.isAnggotaKoperasi },
      select: { id: true, isAnggotaKoperasi: true },
    })
    return res.json({
      success: true,
      data: updated,
      message: `${user.nama} ${updated.isAnggotaKoperasi ? 'didaftarkan ke koperasi' : 'dikeluarkan dari koperasi'}`,
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal update status koperasi' })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 8) {
      return res.status(422).json({ success: false, message: 'Password baru minimal 8 karakter' })
    }
    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Gunakan menu Profil untuk ubah password sendiri' })
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, nama: true, roles: true } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    // SUPER_ADMIN saling bisa kelola sesama -- lihat komentar sama di nonaktifkan() di atas.
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && bestLevel(user.roles) < bestLevel(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak bisa reset password akun dengan role lebih senior' })
    }
    // Cek seniority di atas doang GAK CUKUP -- dua orang di level yang SAMA (mis. dua KOORDINATOR
    // beda studio) lolos cek itu, padahal gak ada hubungan wewenang sama sekali (bug sama persis
    // yang sebelumnya dibenerin di nonaktifkan()).
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && !(await canManageMember(id, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Tidak punya wewenang reset password akun ini' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    // Increment refreshTokenVersion agar sesi lama user yang direset ikut invalid
    await prisma.user.update({
      where: { id },
      data: { passwordHash, refreshTokenVersion: { increment: 1 } },
    })

    return res.json({ success: true, message: `Password ${user.nama} berhasil direset` })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mereset password' })
  }
}

// Aktifkan akses login buat akun "shell" (dibuat tanpa email/password lewat onboard, cuma buat
// pencatatan -- lihat komentar di onboard()). Sengaja dibatasi HANYA buat akun shell (email masih
// pola noaccount-*@akun.internal) -- kalau mau ganti email akun yang udah bisa login, itu beda
// aksi (belum ada endpoint-nya, sengaja gak digabung ke sini biar gak jadi celah ganti-email
// sembarang akun).
export const grantAccess = async (req, res) => {
  try {
    const { id } = req.params
    const { email, newPassword } = req.body

    if (!email?.trim() || !newPassword) {
      return res.status(422).json({ success: false, message: 'Email dan password wajib diisi' })
    }
    if (newPassword.length < 8) {
      return res.status(422).json({ success: false, message: 'Password minimal 8 karakter' })
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, nama: true, email: true, roles: true } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })
    if (!/^noaccount-.+@[a-z0-9-]+\.internal$/.test(user.email)) {
      return res.status(400).json({ success: false, message: 'Akun ini sudah punya akses login -- pakai Reset Password kalau cuma mau ganti password' })
    }
    // SUPER_ADMIN saling bisa kelola sesama -- lihat komentar sama di nonaktifkan() di atas.
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && bestLevel(user.roles) < bestLevel(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak bisa aktifkan akses akun dengan role lebih senior' })
    }
    // Sama kayak resetPassword/nonaktifkan -- cek seniority doang gak cukup, wajib scope check
    // juga (dua orang level sama beda studio/circle tetap lolos cek di atas tanpa ini). Cuma
    // ditegakkan kalau targetnya BENERAN punya posisi (UserRole) -- akun shell pemilik-saham-
    // murni (nol UserRole, dari alur Tambah Pemilik) gak punya studio/circle buat di-scope-in,
    // dan begitu login-nya aktif pun dia gak dapet wewenang apa-apa (checkRole/checkMinRole
    // butuh UserRole beneran) -- risikonya jauh lebih rendah, jadi cukup gate adminOnly di route.
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && user.roles.length > 0 && !(await canManageMember(id, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Tidak punya wewenang aktifkan akses akun ini' })
    }

    const finalEmail = email.trim().toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email: finalEmail } })
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email sudah dipakai akun lain' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id },
      data: { email: finalEmail, passwordHash, refreshTokenVersion: { increment: 1 } },
    })

    return res.json({ success: true, message: `Akses login ${user.nama} berhasil diaktifkan` })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal mengaktifkan akses login' })
  }
}

const STATUS_KEANGGOTAAN = ['KARYAWAN', 'MENTOR', 'MAGANG', 'SISWA_VOKASI', 'SISWA_KBU']

export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params
    const { nama, nomorWa, telegramUsername, tanggalLahir, tanggalMasuk,
            jenisKelamin, posisi, alamat, noRekening, atasNamaRekening,
            nik, nomorBpjs,
            statusKeanggotaan, kelas, sekolah, tinggalDengan, rekamJejak } = req.body

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })

    const isAdmin = hasAnyRole(req.userRoles ?? [], ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KOORDINATOR','PENDAMPING'])
    // Dulu blok ini nulis ulang scoping KOORDINATOR/PENDAMPING(studio)+KEPALA_CIRCLE(circle) secara
    // lokal — padahal itu byte-for-byte sama dengan canManageMember yang sudah dipakai
    // toggleLiveIn/toggleKoperasi. Pola "celah ditulis ulang, bukan ditutup" — dirapikan ke satu sumber.
    const canEditSensitive = await canManageMember(id, req.userRoles ?? [])

    // Sebelumnya field sensitif ini di-skip diam-diam kalau canEditSensitive false, tapi
    // response tetap {success:true} — dari sisi user kelihatan kayak "kesimpen" padahal
    // nggak. Sekarang tolak eksplisit kalau field ini beneran diminta tapi gak punya wewenang.
    const sensitiveFieldsRequested = [noRekening, atasNamaRekening, nik, nomorBpjs]
      .some(v => v !== undefined)
    if (sensitiveFieldsRequested && !canEditSensitive) {
      return res.status(403).json({
        success: false,
        message: 'Kamu tidak punya wewenang mengubah data sensitif (rekening/NIK/BPJS) anggota ini — hanya untuk admin studio/circle anggota tsb',
      })
    }

    // Status keanggotaan + data program siswa: sama kayak data sensitif -- cuma pengelola anggota
    // itu (canManageMember) yang boleh ubah. '' = kosongkan status (balik ke tier turunan role).
    if (statusKeanggotaan !== undefined && statusKeanggotaan !== '' && statusKeanggotaan !== null
        && !STATUS_KEANGGOTAAN.includes(statusKeanggotaan)) {
      return res.status(422).json({ success: false, message: 'Status keanggotaan tidak valid' })
    }
    const programFieldsRequested = [statusKeanggotaan, kelas, sekolah, tinggalDengan, rekamJejak]
      .some(v => v !== undefined)
    if (programFieldsRequested && !canEditSensitive) {
      return res.status(403).json({
        success: false,
        message: 'Kamu tidak punya wewenang mengubah status/data program anggota ini',
      })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(statusKeanggotaan !== undefined && { statusKeanggotaan: statusKeanggotaan || null }),
        ...(kelas            !== undefined && { kelas: kelas || null }),
        ...(sekolah          !== undefined && { sekolah: sekolah || null }),
        ...(tinggalDengan    !== undefined && { tinggalDengan: tinggalDengan || null }),
        ...(rekamJejak       !== undefined && { rekamJejak: rekamJejak || null }),
        ...(nama             != null && { nama }),
        ...(nomorWa          != null && { nomorWa }),
        ...(telegramUsername != null && { telegramUsername }),
        ...(tanggalLahir     != null && { tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null }),
        ...(tanggalMasuk     && isAdmin             && { tanggalMasuk: new Date(tanggalMasuk) }),
        ...(jenisKelamin     != null && { jenisKelamin }),
        ...(posisi           != null && { posisi }),
        ...(alamat           != null && { alamat }),
        ...(noRekening       != null && canEditSensitive && { noRekening }),
        ...(atasNamaRekening != null && canEditSensitive && { atasNamaRekening }),
        ...(nik              != null && canEditSensitive && { nik }),
        ...(nomorBpjs        != null && canEditSensitive && { nomorBpjs }),
      },
      select: {
        id: true, nama: true, email: true, nomorWa: true, telegramUsername: true,
        tanggalLahir: true, tanggalMasuk: true, jenisKelamin: true, posisi: true,
        alamat: true, noRekening: true, atasNamaRekening: true,
        nik: true, nomorBpjs: true,
        statusKeanggotaan: true, kelas: true, sekolah: true, tinggalDengan: true, rekamJejak: true,
      },
    })

    return res.json({ success: true, data: updated, message: 'Data anggota diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui data anggota' })
  }
}

// PENGELOLA_DANA ditambahkan 25 Juli 2026 -- sebelumnya sengaja/tidak sengaja ketinggalan dari
// daftar ini, jadi role isolated ini cuma pernah bisa di-grant manual lewat SQL di VPS, gak
// pernah lewat endpoint ini sama sekali walau valid di enum Prisma. Tetap ter-gate ketat oleh
// canAssignScope() di bawah (scope kosong = HANYA SUPER_ADMIN yang boleh assign, lihat komentar
// di utils/roles.js) -- menambahkannya ke sini tidak membuka celah privilege escalation baru.
const VALID_ROLES = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','PENDAMPING','KOORDINATOR','KADER','KARYAWAN','MAGANG','DIGNITY','PENASIHAT','PENGELOLA_DANA']
const ROLE_INCLUDE = {
  circle:     { select: { id: true, nama: true, colorHex: true } },
  rumahUsaha: { select: { id: true, nama: true, colorHex: true } },
  studio:     { select: { id: true, nama: true, tipe: true } },
}

export const updateRole = async (req, res) => {
  try {
    const { roleId } = req.params
    const { roleType, studioId, circleId, rumahUsahaId } = req.body

    if (!roleType || !VALID_ROLES.includes(roleType)) {
      return res.status(422).json({ success: false, message: 'roleType tidak valid' })
    }

    const existing = await prisma.userRole.findUnique({ where: { id: roleId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Role tidak ditemukan' })

    const callerLevel = bestLevel(req.userRoles)
    const targetUser = await prisma.user.findUnique({ where: { id: existing.userId }, select: { roles: true } })
    // SUPER_ADMIN saling bisa kelola sesama -- lihat komentar sama di nonaktifkan() di atas.
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && bestLevel(targetUser?.roles) < callerLevel) {
      return res.status(403).json({ success: false, message: 'Tidak bisa mengubah posisi milik akun dengan role lebih senior' })
    }
    const newStudioId     = studioId     !== undefined ? studioId     : existing.studioId
    const newCircleId     = circleId     !== undefined ? circleId     : existing.circleId
    const newRumahUsahaId = rumahUsahaId !== undefined ? rumahUsahaId : existing.rumahUsahaId
    if (ROLE_LEVEL[roleType] < callerLevel) {
      const lateralStudioOk = STUDIO_ROLES.includes(roleType) && newStudioId && (await canManageStudioRoles(req.userRoles, newStudioId))
      if (!lateralStudioOk) {
        return res.status(403).json({ success: false, message: 'Tidak bisa memberi role lebih senior dari role sendiri' })
      }
    }
    // Cek scope lama (role yang sedang diedit) DAN scope baru (kalau studioId/circleId/
    // rumahUsahaId diganti) — dua-duanya harus dalam wewenang pemanggil, bukan cuma levelnya
    // yang tidak lebih senior.
    if (!(await canAssignScope(req.userRoles ?? [], scopeArgs(existing.studioId, existing.circleId, existing.rumahUsahaId)))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa mengubah posisi di studio/circle/rumah usaha di luar wewenangmu' })
    }
    // Khusus KOORDINATOR/PENDAMPING mindahin posisi (cuma studioId berubah, roleType/circleId/
    // rumahUsahaId tetap) -- boleh ke studio MANAPUN, gak wajib ngatur studio tujuannya juga
    // (permintaan eksplisit user, beda dari canAssignScope biasa yang wajib dua-duanya). Guard
    // senioritas di atas (ROLE_LEVEL/bestLevel) TETAP berlaku penuh, jadi mereka tetap gak bisa
    // naikin siapa pun ke role lebih senior dari diri sendiri lewat celah ini. KEPALA_CIRCLE/
    // KEPALA_RUMAH_USAHA/admin tetap pakai canAssignScope biasa (gak diperluas).
    // roleType WAJIB dicek tetap sama dengan role yang sedang diedit -- sebelumnya cuma dicek
    // circleId/rumahUsahaId gak dikirim, TIDAK pernah dicek roleType-nya berubah atau tidak.
    // Tanpa ini, KOORDINATOR/PENDAMPING bisa sekaligus GANTI tipe role (mis. ke KADER) target
    // ke studio manapun di seluruh sistem lewat celah "pure studio move" ini -- bukan cuma
    // "pindah posisi" seperti niat aslinya, tapi bypass scope penuh.
    const isPureStudioMoveByKoordinator =
      hasAnyRole(req.userRoles ?? [], ['KOORDINATOR', 'PENDAMPING']) &&
      roleType === existing.roleType &&
      studioId !== undefined && circleId === undefined && rumahUsahaId === undefined
    if (!isPureStudioMoveByKoordinator) {
      if (!(await canAssignScope(req.userRoles ?? [], scopeArgs(newStudioId, newCircleId, newRumahUsahaId)))) {
        return res.status(403).json({ success: false, message: 'Tidak bisa memindahkan posisi ke studio/circle/rumah usaha di luar wewenangmu' })
      }
    }

    // Pindah studio (studioId beda dari sebelumnya) -> reset THP ke kosong. THP itu spesifik
    // per-studio (lihat updateRoleThp di bawah); kalau ikut kebawa ke studio baru, angkanya
    // nyasar dan bisa keliatan kayak THP resmi padahal cuma sisa dari studio lama.
    const studioChanged = studioId !== undefined && studioId !== existing.studioId

    const updated = await prisma.userRole.update({
      where: { id: roleId },
      data: {
        roleType,
        ...(studioId !== undefined && { studioId: studioId || null }),
        // circleId/rumahUsahaId dipaksa null kalau posisi ini SEKARANG punya studioId -- circle/
        // rumah usaha keanggotaannya diturunkan live dari studio.circleId (lihat getRoleCircle di
        // client), bukan disimpan ganda. Cegah data basi lagi (sama pola kayak fix di onboard()).
        ...(newStudioId
          ? { circleId: null, rumahUsahaId: null }
          : {
              ...(circleId     !== undefined && { circleId: circleId || null }),
              ...(rumahUsahaId !== undefined && { rumahUsahaId: rumahUsahaId || null }),
            }),
        ...(studioChanged && { takeHomePay: null }),
      },
      include: ROLE_INCLUDE,
    })

    return res.json({ success: true, data: updated, message: 'Posisi diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui posisi' })
  }
}

// THP melekat ke POSISI (UserRole) di studio tertentu, bukan ke User secara flat — satu orang
// bisa beda THP di tiap studio yang dia ikuti. Otorisasi pakai canManageMember (sama dengan
// updateProfile's canEditSensitive) — ini soal wewenang lihat/edit data sensitif anggota,
// BUKAN soal re-assignment role (itu domain bestLevel/canAssignScope di updateRole).
export const updateRoleThp = async (req, res) => {
  try {
    const { roleId } = req.params
    const { takeHomePay } = req.body

    const existing = await prisma.userRole.findUnique({ where: { id: roleId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Posisi tidak ditemukan' })
    if (!existing.studioId) {
      return res.status(422).json({ success: false, message: 'THP hanya berlaku untuk posisi yang terikat studio' })
    }
    if (!(await canManageMember(existing.userId, req.userRoles ?? []))) {
      return res.status(403).json({ success: false, message: 'Tidak punya wewenang mengubah THP anggota ini' })
    }

    let thp = null
    if (takeHomePay !== '' && takeHomePay != null) {
      thp = Number(takeHomePay)
      if (!Number.isFinite(thp) || thp < 0) {
        return res.status(422).json({ success: false, message: 'THP wajib angka >= 0' })
      }
    }

    const updated = await prisma.userRole.update({
      where: { id: roleId },
      data: { takeHomePay: thp },
      select: { id: true, studioId: true, takeHomePay: true },
    })
    return res.json({ success: true, data: updated, message: 'THP posisi diperbarui' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui THP' })
  }
}

export const addUserRole = async (req, res) => {
  try {
    const { id: userId } = req.params
    const { roleType, studioId, circleId, rumahUsahaId } = req.body

    if (!roleType || !VALID_ROLES.includes(roleType)) {
      return res.status(422).json({ success: false, message: 'roleType tidak valid' })
    }

    const NEEDS_STUDIO      = ['KOORDINATOR','PENDAMPING','KARYAWAN','MAGANG','DIGNITY','PENASIHAT']
    const NEEDS_CIRCLE      = ['KEPALA_CIRCLE','ADMIN_FUNGSIONAL','KADER']
    const NEEDS_RUMAH_USAHA = ['KEPALA_RUMAH_USAHA']
    if (NEEDS_STUDIO.includes(roleType) && !studioId) {
      return res.status(422).json({ success: false, message: `Role ${roleType} wajib menyertakan studioId` })
    }
    if (NEEDS_CIRCLE.includes(roleType) && !circleId && !studioId) {
      return res.status(422).json({ success: false, message: `Role ${roleType} wajib menyertakan circleId atau studioId` })
    }
    if (NEEDS_RUMAH_USAHA.includes(roleType) && !rumahUsahaId && !studioId) {
      return res.status(422).json({ success: false, message: `Role ${roleType} wajib menyertakan rumahUsahaId atau studioId` })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: true } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })

    const callerLevel = bestLevel(req.userRoles)
    // Nambah posisi BARU (bukan ubah/hapus yang existing) buat orang yang udah punya role lebih
    // senior dari role yang ditambahkan TIDAK menaikkan wewenang dia sama sekali -- bestLevel
    // (MIN semua role dia) tetap sama, jadi ini bukan eskalasi. Cuma diblokir kalau role yang
    // ditambahkan BENERAN lebih senior dari yang dia punya sekarang DAN lebih senior dari caller
    // (mis. koordinator gak boleh nambahin siapa pun jadi ADVISOR, termasuk Kepala Ekosistem
    // sendiri -- itu baru eskalasi beneran). Contoh yang HARUS diizinkan: koordinator nyatet
    // Kepala Ekosistem sebagai Pendamping operasional di studio dia (buat keperluan THP/payroll).
    if (ROLE_LEVEL[roleType] < callerLevel && bestLevel(user.roles) > ROLE_LEVEL[roleType]) {
      const lateralStudioOk = STUDIO_ROLES.includes(roleType) && studioId && (await canManageStudioRoles(req.userRoles, studioId))
      if (!lateralStudioOk) {
        return res.status(403).json({ success: false, message: 'Tidak bisa memberi role lebih senior dari role sendiri' })
      }
    }
    if (!(await canAssignScope(req.userRoles ?? [], scopeArgs(studioId, circleId, rumahUsahaId)))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa menambah posisi untuk studio/circle/rumah usaha di luar wewenangmu' })
    }

    const newRole = await prisma.userRole.create({
      // circleId/rumahUsahaId dipaksa null kalau studioId keisi -- sama alasan kayak onboard()/
      // updateRole(), circle/rumah usaha keanggotaan studio-scoped role diturunkan live dari
      // studio.circleId, bukan disimpan ganda.
      data: {
        userId, roleType,
        studioId:     studioId || null,
        circleId:     studioId ? null : (circleId || null),
        rumahUsahaId: studioId ? null : (rumahUsahaId || null),
      },
      include: ROLE_INCLUDE,
    })

    return res.json({ success: true, data: newRole, message: 'Posisi baru ditambahkan' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menambah posisi' })
  }
}

export const removeUserRole = async (req, res) => {
  try {
    const { roleId } = req.params

    const existing = await prisma.userRole.findUnique({ where: { id: roleId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Role tidak ditemukan' })

    const targetUser = await prisma.user.findUnique({ where: { id: existing.userId }, select: { roles: true } })
    // SUPER_ADMIN saling bisa kelola sesama -- lihat komentar sama di nonaktifkan() di atas.
    if (!hasAnyRole(req.userRoles, SUPER_ADMIN) && bestLevel(targetUser?.roles) < bestLevel(req.userRoles)) {
      return res.status(403).json({ success: false, message: 'Tidak bisa menghapus posisi milik akun dengan role lebih senior' })
    }
    if (!(await canAssignScope(req.userRoles ?? [], scopeArgs(existing.studioId, existing.circleId)))) {
      return res.status(403).json({ success: false, message: 'Tidak bisa menghapus posisi di studio/circle di luar wewenangmu' })
    }

    const count = await prisma.userRole.count({ where: { userId: existing.userId } })
    if (count <= 1) {
      return res.status(422).json({ success: false, message: 'Tidak bisa menghapus satu-satunya posisi anggota' })
    }

    await prisma.userRole.delete({ where: { id: roleId } })
    return res.json({ success: true, message: 'Posisi dihapus' })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus posisi' })
  }
}

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri' })
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' })

    // Hapus semua data terkait dalam satu transaksi
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId: id } }),
      prisma.jurnalTalent.deleteMany({ where: { OR: [{ userId: id }, { penulisId: id }] } }),
      prisma.studioPemilik.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ])

    return res.json({ success: true, message: `${user.nama} berhasil dihapus` })
  } catch {
    return res.status(500).json({ success: false, message: 'Gagal menghapus anggota' })
  }
}
