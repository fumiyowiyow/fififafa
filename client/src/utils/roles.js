// Cocok persis dengan enum RoleType di server/prisma/schema.prisma (13 nilai, CO_ADMIN dihapus
// 25 Juli 2026 -- redundan sama ADVISOR/Super Admin) -- kalau nambah
// RoleType baru, tambahin juga di sini + ROLE_LEVEL + ROLE_TIER + getRoleLabel supaya semua
// tempat yang pakai getHighestRole()/getRoleLabel() otomatis ke-update, gak perlu diulang manual
// di tiap halaman.
export const ROLE_TYPES = {
  ADVISOR:            'ADVISOR',
  KEPALA_EKOSISTEM:   'KEPALA_EKOSISTEM',
  KEPALA_CIRCLE:      'KEPALA_CIRCLE',
  KEPALA_RUMAH_USAHA: 'KEPALA_RUMAH_USAHA',
  ADMIN_FUNGSIONAL:   'ADMIN_FUNGSIONAL',
  PENDAMPING:         'PENDAMPING',
  KOORDINATOR:        'KOORDINATOR',
  KADER:              'KADER',
  KARYAWAN:           'KARYAWAN',
  MAGANG:             'MAGANG',
  PENGELOLA_DANA:     'PENGELOLA_DANA',
  DIGNITY:            'DIGNITY',
  PENASIHAT:          'PENASIHAT',
}

// Angka kecil = lebih senior. PENGELOLA_DANA taruh PALING BESAR (bukan dihilangkan dari map) --
// itu bukan jenjang organisasi, cuma tag tambahan siapa yang boleh akses modul Dana Pengembangan
// (lihat RoleType di schema.prisma). Kalau dihilangkan dari map ini, getHighestRole() yang pakai
// pola ROLE_LEVEL[x] ?? 99 masih aman (99 tetap paling akhir) -- tapi eksplisit lebih baik daripada
// diam-diam ketolong fallback, biar kelihatan jelas ini disengaja bukan kelupaan (kejadian nyata:
// PENGELOLA_DANA & ADVISOR sempat ketinggalan di priority array lokal Members.jsx/Reports.jsx,
// nyebabin badge tier salah tampil).
export const ROLE_LEVEL = {
  ADVISOR:            0,
  KEPALA_EKOSISTEM:   1,
  KEPALA_CIRCLE:      3,
  KEPALA_RUMAH_USAHA: 4,
  ADMIN_FUNGSIONAL:   5,
  PENDAMPING:         5,
  KOORDINATOR:        6,
  KADER:              7,
  KARYAWAN:           8,
  MAGANG:             9,
  PENGELOLA_DANA:     11,
  DIGNITY:            12, // bukan jenjang organisasi -- muncul dari "sejarah jasa" di studio, gak nentuin senioritas (pola sama kayak PENGELOLA_DANA)
  // Posisi STUDIO ("Advisor" studio) -- BEDA dari role ADVISOR di atas (admin ecosystem-wide,
  // ditampilkan "Super Admin" di UI sekarang). Posisi PALING SENIOR di jenjang studio -- di ATAS
  // Pendamping/Koordinator (bukan sejajar), makanya 4.5 (antara Kepala Rumah Usaha dan Pendamping).
  // Sengaja gak dapat bypass akses admin apa pun (lihat komentar sama di server/src/utils/roles.js).
  PENASIHAT:          4.5,
}

// Tier buat grouping/badge (dipakai Members.jsx, RingkasanPerforma.jsx, Dashboard) --
// 'tetap'/'karyawan'/'magang'. Ini KUNCI internal, BUKAN label yang ditampilkan ke user -- label
// aslinya "Pengurus Inti"/"Staf"/"Magang" (lihat TIER_BADGE di tiap file pemakai). Sengaja gak
// diganti jadi 'pengurusInti'/'staf' di sini karena kuncinya juga dipakai sebagai field response
// API (server/src/controllers/dashboard.js `data.tier.tetap/karyawan/magang`) -- ganti nama field
// API butuh koordinasi FE+BE lebih hati-hati, sementara ganti LABEL tampilan aman diubah sendiri.
export const ROLE_TIER = {
  ADVISOR:            'tetap',
  KEPALA_EKOSISTEM:   'tetap',
  KEPALA_CIRCLE:      'tetap',
  KEPALA_RUMAH_USAHA: 'tetap',
  ADMIN_FUNGSIONAL:   'tetap',
  PENDAMPING:         'tetap',
  KOORDINATOR:        'tetap',
  KADER:              'karyawan',
  KARYAWAN:           'karyawan',
  MAGANG:             'magang',
  PENGELOLA_DANA:     'tetap',
  DIGNITY:            'karyawan',
  PENASIHAT:          'tetap',
}

// Label + warna badge buat tiap tier -- SATU sumber, dipakai Members.jsx/RingkasanPerforma.jsx/
// Kader/index.jsx (sebelumnya masing-masing punya const lokal sendiri-sendiri, resiko drift kalau
// labelnya diganti lagi nanti kayak yang baru terjadi "Tetap"/"Karyawan" -> "Pengurus Inti"/"Staf").
export const TIER_BADGE = {
  tetap:    { label: '🟣 Pengurus Inti', cls: 'purple' },
  karyawan: { label: '🟠 Staf',          cls: 'warning' },
  magang:   { label: '🟢 Magang',        cls: 'success' },
}

// Label kategori keanggotaan (User.statusKeanggotaan) -- BUKAN hak akses (itu RoleType). Kalau
// null, tampilan jatuh balik ke TIER_BADGE turunan role seperti sebelumnya.
export const STATUS_KEANGGOTAAN = {
  KARYAWAN:     { label: '🟠 Karyawan',      cls: 'warning' },
  MENTOR:       { label: '🧭 Mentor',        cls: 'purple' },
  MAGANG:       { label: '🟢 Magang',        cls: 'success' },
  SISWA_VOKASI: { label: '🎓 Siswa Vokasi',  cls: 'info' },
  SISWA_KBU:    { label: '🌱 Siswa KBU',     cls: 'info' },
}
export const STATUS_PROGRAM_SISWA = ['SISWA_VOKASI', 'SISWA_KBU']

export function hasRole(user, role) {
  if (!user?.roles) return false
  if (Array.isArray(role)) return role.some(r => user.roles.some(ur => ur.roleType === r))
  return user.roles.some(ur => ur.roleType === role)
}

export function hasMinRole(user, minRole) {
  if (!user?.roles) return false
  const minLevel = ROLE_LEVEL[minRole] ?? 99
  return user.roles.some(ur => (ROLE_LEVEL[ur.roleType] ?? 99) <= minLevel)
}

export function canAccessCircle(user, circleId) {
  if (!user?.roles) return false
  if (hasMinRole(user, ROLE_TYPES.KEPALA_EKOSISTEM)) return true
  return user.roles.some(ur =>
    ur.circleId === circleId &&
    [ROLE_TYPES.KEPALA_CIRCLE, ROLE_TYPES.KOORDINATOR, ROLE_TYPES.KARYAWAN, ROLE_TYPES.MAGANG]
      .includes(ur.roleType)
  )
}

export function canAccessRumahUsaha(user, rumahUsahaId) {
  if (!user?.roles) return false
  if (hasMinRole(user, ROLE_TYPES.KEPALA_EKOSISTEM)) return true
  return user.roles.some(ur =>
    ur.rumahUsahaId === rumahUsahaId &&
    [ROLE_TYPES.KEPALA_RUMAH_USAHA, ROLE_TYPES.KOORDINATOR, ROLE_TYPES.KARYAWAN, ROLE_TYPES.MAGANG]
      .includes(ur.roleType)
  )
}

export function canAccessStudio(user, studioId) {
  if (!user?.roles) return false
  if (hasMinRole(user, ROLE_TYPES.KEPALA_EKOSISTEM)) return true
  return user.roles.some(ur => ur.studioId === studioId)
}

// Circle/rumah usaha keanggotaan SATU role: SELALU utamakan yang nempel LANGSUNG ke role itu
// (r.circle/r.rumahUsaha -- cuma keisi buat role circle-level asli, mis. KEPALA_CIRCLE), baru
// fallback ke circle/rumah usaha STUDIO-nya (r.studio.circle/r.studio.rumahUsaha) buat role
// studio-scoped (KOORDINATOR/PENDAMPING/KARYAWAN/dst). JANGAN baca r.circle doang buat role
// studio-scoped -- field itu gak diisi otomatis (server sengaja gak nyimpen circleId dobel di
// situ, biar gak basi kalau studionya dipindah circle belakangan), jadi bakal selalu null/kosong
// padahal circle-nya sebenarnya ada lewat studio.
export function getRoleCircle(r) {
  return r?.circle ?? r?.studio?.circle ?? null
}
export function getRoleRumahUsaha(r) {
  return r?.rumahUsaha ?? r?.studio?.rumahUsaha ?? null
}
// Circle ATAU rumah usaha (unit organisasi sejajar) -- dipakai di tempat yang gak perlu bedain.
export function getRoleOrgUnit(r) {
  return getRoleCircle(r) ?? getRoleRumahUsaha(r)
}

// Role tersenior dari sekumpulan UserRole -- SATU implementasi definitif, dipakai di Members.jsx,
// Reports.jsx, Kader.jsx, CommandPalette.jsx (sebelumnya masing-masing punya implementasi lokal
// sendiri-sendiri, ada yang pakai array.indexOf() -- roleType yang gak ada di array balik -1 dan
// -1 selalu ke-urut PALING DEPAN, jadi PENGELOLA_DANA & ADVISOR yang sempat ketinggalan malah
// dianggap paling senior. Fallback ?? 99 di sini aman dari itu -- roleType yang gak dikenal
// otomatis PALING TIDAK senior, bukan sebaliknya).
export function getHighestRole(roles) {
  if (!roles?.length) return null
  return roles.reduce((best, r) => {
    const level     = ROLE_LEVEL[r.roleType]    ?? 99
    const bestLevel = ROLE_LEVEL[best?.roleType] ?? 99
    return level < bestLevel ? r : best
  }, roles[0])
}

export function getRoleLabel(roleType) {
  const LABELS = {
    // ADVISOR (role admin ecosystem-wide, level paling senior) -- tampil "Super Admin" biar gak
    // ketuker sama PENASIHAT ("Advisor" posisi studio) di bawah. Enum key TIDAK diganti, cuma
    // labelnya -- semua permission logic yang pakai roleType 'ADVISOR' gak kepengaruh sama sekali.
    ADVISOR:          'Super Admin',
    KEPALA_EKOSISTEM: 'Kepala Ekosistem',
    KEPALA_CIRCLE:    'Kepala Circle',
    KEPALA_RUMAH_USAHA: 'Kepala Rumah Usaha',
    ADMIN_FUNGSIONAL: 'Admin Fungsional',
    PENDAMPING:       'Pendamping',
    KOORDINATOR:      'Koordinator',
    KADER:            'Kader',
    KARYAWAN:         'Karyawan',
    MAGANG:           'Magang',
    PENGELOLA_DANA:   'Pengelola Dana',
    DIGNITY:          'Dignity',
    PENASIHAT:        'Advisor',
  }
  return LABELS[roleType] ?? roleType
}

// Role yang boleh lihat angka omset/keuangan mentah (section Operasional di Sidebar, hub Keuangan)
// -- cermin gate server checkMinRole('KADER') di routes weeklyReport/performance/finance/reports.
export const ROLE_UANG = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','PENDAMPING','KOORDINATOR','KADER']
