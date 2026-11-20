// Centralized role constants — import dari sini, jangan hardcode di controller
import prisma from '../prisma.js'

// CO_ADMIN dihapus 25 Juli 2026 -- redundan sama ADVISOR ("Super Admin" di UI), keduanya SELALU
// muncul bareng di setiap array di bawah (dan di seluruh codebase sebelum dihapus), gak pernah
// ada yang memperlakukan beda. Satu-satunya pemegang role ini (Mella Fitriansyah) dinaikkan ke
// ADVISOR lewat migration 20260725150000_remove_co_admin_role.
export const SUPER_ADMIN   = ['ADVISOR', 'KEPALA_EKOSISTEM']
export const FULL_ADMIN    = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA']
export const ADMIN_PLUS    = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']
export const STAFF_PLUS    = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL', 'KOORDINATOR', 'PENDAMPING']
export const KOPERASI_ADMIN = ['ADVISOR', 'KEPALA_EKOSISTEM', 'ADMIN_FUNGSIONAL']

export const ROLE_LEVEL = {
  ADVISOR:            0,
  KEPALA_EKOSISTEM:   1,
  KEPALA_CIRCLE:      3,
  KEPALA_RUMAH_USAHA: 4, // JRUWay Career Path tier 6 dari 8, antara Pendamping dan Kepala Circle
  ADMIN_FUNGSIONAL:   5,
  PENDAMPING:         5,
  KOORDINATOR:        6,
  KADER:              7,
  KARYAWAN:           8,
  MAGANG:             9,
  DIGNITY:            11, // bukan jenjang organisasi, muncul dari "sejarah jasa" studio -- pola sama kayak PENGELOLA_DANA di client/src/utils/roles.js
  // Posisi STUDIO ("Advisor" studio) -- BEDA dari role ADVISOR di atas (admin ecosystem-wide,
  // ditampilkan "Super Admin" di UI sekarang). Posisi PALING SENIOR di jenjang studio -- di
  // ATAS Pendamping/Koordinator (bukan sejajar), makanya 4.5 (antara Kepala Rumah Usaha dan
  // Pendamping, angka non-integer sengaja -- gak perlu geser nomor role lain). SENGAJA gak
  // dimasukin SUPER_ADMIN/FULL_ADMIN/dst -- gak dapat bypass akses admin ecosystem-wide.
  PENASIHAT:          4.5,
}

// ── Daftar peran yang DIPAKAI BERSAMA rute web & bot Telegram (14 Okt 2026) ─────────────────────
// Bot bukan jalan pintas: aturan akses bot = aturan web, jadi daftarnya satu tempat saja.
/** Boleh membuat/mengubah/menghapus Weekly Report (rute POST/PUT/DELETE /weekly-reports + /laporan di bot). */
export const ROLE_KIRIM_LAPORAN = ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']
/** Melihat Dashboard penuh (angka ekosistem). CERMIN `CAN_FULL_DASHBOARD` di client/src/pages/Dashboard/index.jsx. */
export const ROLE_DASHBOARD_PENUH = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','PENDAMPING','KOORDINATOR']

// Pengelola aset: boleh tambah/ubah/hapus aset DAN melihat nilai rupiahnya (routes/asset.js, controllers/asset.js).
export const ASSET_MANAGERS = ['ADVISOR', 'KOORDINATOR', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM', 'ADMIN_FUNGSIONAL']

export function hasAnyRole(roles = [], allowed = []) {
  return roles.some(r => allowed.includes(r.roleType))
}

// Override akses Superadmin KHUSUS modul Produksi/Payroll (8 Agustus 2026) -- buat orang
// tertentu yang butuh akses penuh 2 modul ini (mis. dashboard lintas-studio) TANPA jadi
// ADVISOR/KEPALA_EKOSISTEM beneran, yang bakal bawa privilege ekosistem-wide di modul LAIN juga
// (Finance, Koperasi, dll TIDAK boleh kepengaruh sama sekali -- jangan pernah pakai fungsi ini
// buat gate di luar Produksi/Payroll, tetap pakai hasAnyRole(roles, SUPER_ADMIN) biasa di sana).
// Lihat model ProduksiSuperOverride di schema.prisma.
//
// Dipakai juga di client (Sidebar.jsx, via flag user.isProduksiSuperUser dari login()/me() di
// auth.js) buat sembunyiin menu Marketing (8 Agustus 2026, menu-only restriction SEMENTARA
// pra-pilot -- lihat routes/marketing.js) walau ENDPOINT Marketing sendiri TIDAK manggil fungsi
// ini (tetap canManageStudio biasa). Jangan bingung "dipakai buat gate menu Marketing" dengan
// "dipakai buat gate endpoint Marketing" -- cuma yang pertama yang bener.
export async function isProduksiSuperUser(userId) {
  const [roles, override] = await Promise.all([
    prisma.userRole.findMany({ where: { userId } }),
    prisma.produksiSuperOverride.findUnique({ where: { userId } }),
  ])
  return hasAnyRole(roles, SUPER_ADMIN) || !!override
}

// Level otoritas TERTINGGI (angka terkecil = paling senior) dari sekumpulan role. Dipakai
// buat mencegah eskalasi privilege VERTIKAL: role non-super-admin yang boleh bikin/assign
// role ke orang lain (mis. KEPALA_CIRCLE lewat jadikanAnggota) tanpa cek ini bisa kasih role
// lebih senior dari role dia sendiri (mis. bikin akun ADVISOR baru).
export function bestLevel(roles = []) {
  return Math.min(99, ...roles.map(r => ROLE_LEVEL[r.roleType] ?? 99))
}

// ── Pembatasan akses masuk SEMENTARA (16 Okt 2026) ────────────────────────────────────────────
// Diatur lewat server/.env:  AKSES_DASHBOARD_MIN_ROLE=KOORDINATOR  → hanya peran sebaik itu (atau lebih
// tinggi) yang boleh login/memakai dashboard & bot. Kosongkan/hapus variabelnya lalu restart pm2 untuk
// membuka kembali semua akses. Nilai yang tidak dikenal DIABAIKAN (akses tetap terbuka) + diberi peringatan,
// supaya salah ketik tidak mengunci semua orang.
let peringatSudah = false
export function levelMinimumDashboard() {
  const nama = (process.env.AKSES_DASHBOARD_MIN_ROLE ?? '').trim()
  if (!nama) return null
  if (ROLE_LEVEL[nama] == null) {
    if (!peringatSudah) { peringatSudah = true; console.warn(`[akses] AKSES_DASHBOARD_MIN_ROLE="${nama}" tidak dikenal — pembatasan DIABAIKAN`) }
    return null
  }
  return ROLE_LEVEL[nama]
}
export function bolehMasukDashboard(roles = []) {
  const min = levelMinimumDashboard()
  return min == null || bestLevel(roles) <= min
}
export const PESAN_AKSES_DITUTUP = 'Akses dashboard untuk sementara hanya dibuka untuk Koordinator ke atas. Silakan hubungi koordinator unitmu.'

// canAssignScope() mencegah eskalasi HORIZONTAL — tanpa ini, role scoped (KEPALA_CIRCLE dkk)
// masih bebas assign role ke studio/circle/rumah usaha MANAPUN, bukan cuma wewenang sendiri.
export async function canAssignScope(roles, { studioId, circleId, rumahUsahaId }) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  // PENTING: kalau studioId+circleId (atau kombinasi lain) dikirim BARENGAN, SEMUA field yang
  // terisi harus lolos cek -- sebelumnya cuma studioId yang divalidasi (branch if pertama yang
  // match langsung return), circleId/rumahUsahaId yang menyertai sama sekali gak dicek, jadi
  // KEPALA_CIRCLE circle A bisa selipin circleId circle B (bukan wewenangnya) asal studioId-nya
  // studio circle A sendiri.
  if (!studioId && !circleId && !rumahUsahaId) return false
  if (studioId     && !(await canManageStudio(roles, studioId))) return false
  if (circleId     && !roles.some(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId === circleId)) return false
  if (rumahUsahaId && !roles.some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === rumahUsahaId)) return false
  return true
}

// Helper buat pemanggil canAssignScope() dari form yang ngirim circleId/rumahUsahaId cuma
// sebagai context tambahan (auto-terisi dari circle studio yang lagi dipilih), BUKAN syarat
// wewenang independen. Kalau studioId ada, itu aja yang dicek (canManageStudio di dalam
// canAssignScope sudah nyakup jalur KEPALA_CIRCLE/KEPALA_RUMAH_USAHA pemilik studio itu) --
// tanpa ini, KOORDINATOR/PENDAMPING (wewenangnya sah atas studio itu, tapi bukan KEPALA_CIRCLE
// circle induknya) ke-block salah gara-gara circleId ikut dicek independen di canAssignScope.
export function scopeArgs(studioId, circleId, rumahUsahaId) {
  return studioId ? { studioId } : { studioId, circleId, rumahUsahaId }
}

// Otorisasi terpusat buat aksi yang scoped ke satu studio: super admin (ADVISOR/
// KEPALA_EKOSISTEM) bebas semua studio; role level-circle (KEPALA_CIRCLE, + tambahan lewat
// extraCircleRoles kalau ada mis. ADMIN_FUNGSIONAL) HANYA studio di circle-nya sendiri (bukan
// bypass admin buat circle manapun — kesalahan yang sebelumnya ada di beberapa controller yang
// cuma cek roleType tanpa cocokkan circleId); studio di Rumah Usaha (unit organisasi sejajar
// Circle, bukan semua studio pasti punya circleId lagi) dicek pola sama pakai rumahUsahaId;
// role lain terbatas studio sendiri.
export async function canManageStudio(roles = [], studioId, extraCircleRoles = []) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { circleId: true, rumahUsahaId: true } })
  // PENTING: roleType DAN circleId/rumahUsahaId harus dicocokkan di SATU role record yang sama
  // (bukan dicek terpisah lewat hasAnyRole + roles.some) -- sebelumnya orang yang KEPALA_CIRCLE
  // di circle A tapi punya role APAPUN (mis. KADER) di circle B ke-anggap boleh kelola studio
  // manapun di circle B juga, karena dua kondisi independen itu sama-sama lolos walau gak dari
  // role yang sama.
  const circleRoleTypes = ['KEPALA_CIRCLE', ...extraCircleRoles]
  if (studio?.circleId && roles.some(r => circleRoleTypes.includes(r.roleType) && r.circleId === studio.circleId)) {
    return true
  }
  const rumahUsahaRoleTypes = ['KEPALA_RUMAH_USAHA', ...extraCircleRoles]
  if (studio?.rumahUsahaId && roles.some(r => rumahUsahaRoleTypes.includes(r.roleType) && r.rumahUsahaId === studio.rumahUsahaId)) {
    return true
  }
  return roles.some(r => r.studioId === studioId)
}

// Assign posisi level-studio (KOORDINATOR/PENDAMPING/KARYAWAN/MAGANG/KADER/DIGNITY) ke SATU
// studio: LEBIH KETAT dari canManageStudio (yang fallback terakhirnya mengizinkan siapa pun
// dengan studioId cocok, termasuk KARYAWAN/MAGANG -- longgar itu OK buat aksi non-organisasi
// kayak sosmed link studio, tapi BAHAYA kalau dipakai buat nge-assign role, karena berarti
// KARYAWAN bisa jadiin dirinya sendiri KOORDINATOR). Di sini cuma KOORDINATOR/PENDAMPING studio
// itu sendiri (atau KEPALA_CIRCLE/KEPALA_RUMAH_USAHA pemilik studio, atau SUPER_ADMIN) yang boleh.
// Dipakai buat carve-out "KOORDINATOR boleh assign PENDAMPING" -- keduanya level sejajar secara
// struktur studio (bukan atasan-bawahan) walau ROLE_LEVEL taruh PENDAMPING lebih senior secara
// angka (buat kebutuhan lain kayak wewenang lintas-studio/circle).
export async function canManageStudioRoles(roles = [], studioId) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  const studio = await prisma.studio.findUnique({ where: { id: studioId }, select: { circleId: true, rumahUsahaId: true } })
  if (studio?.circleId && roles.some(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId === studio.circleId)) return true
  if (studio?.rumahUsahaId && roles.some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === studio.rumahUsahaId)) return true
  return roles.some(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId === studioId)
}

// ── Wewenang PER UNIT (21 Okt 2026, keputusan user) ───────────────────────────────────────────
// Peran pengelola dan unitnya harus dari baris peran yang SAMA: Koordinator di unit A yang hanya Kader di
// unit B TIDAK mengelola B (sebelumnya "STAFF_PLUS di mana saja" + "peran apa pun di B" = lolos).
/** Koordinator/Pendamping unit ini, Kepala Circle/Rumah Usaha pemiliknya, atau Super Admin. */
export const kelolaStudio = (roles = [], studioId) => (studioId ? canManageStudioRoles(roles, studioId) : Promise.resolve(false))

/** "Kepala Circle ke atas" UNTUK unit ini: Super Admin, Kepala Circle circle-nya, atau Kepala Rumah Usaha rumah usahanya. */
export async function atasanStudio(roles = [], studioId) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  if (!studioId) return false
  const s = await prisma.studio.findUnique({ where: { id: studioId }, select: { circleId: true, rumahUsahaId: true } })
  return !!((s?.circleId && roles.some(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId === s.circleId))
    || (s?.rumahUsahaId && roles.some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === s.rumahUsahaId)))
}

/** "Kepala Circle ke atas" untuk SATU lingkup web circle ({ jenis: 'circle'|'rumah-usaha', id }). */
export function atasanLingkup(roles = [], lingkup) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  if (!lingkup) return false
  return lingkup.jenis === 'circle'
    ? roles.some(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId === lingkup.id)
    : roles.some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === lingkup.id)
}

// Otorisasi buat aksi terhadap SATU ANGGOTA (bukan studio): SUPER_ADMIN bebas semua anggota;
// KOORDINATOR/PENDAMPING cuma anggota di studio sendiri; KEPALA_CIRCLE cuma anggota yang
// studionya ada di circle sendiri (dicek lewat circleId studio si anggota, BUKAN blanket
// FULL_ADMIN — itu yang bikin KEPALA_CIRCLE bisa kelola anggota circle manapun sebelumnya);
// KEPALA_RUMAH_USAHA pola sama tapi lewat rumahUsahaId studio si anggota.
export async function canManageMember(targetUserId, roles = []) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  const myStudioIds = new Set(
    roles.filter(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId).map(r => r.studioId)
  )
  const myCircleIds = new Set(
    roles.filter(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId).map(r => r.circleId)
  )
  const myRumahUsahaIds = new Set(
    roles.filter(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId).map(r => r.rumahUsahaId)
  )
  if (myStudioIds.size === 0 && myCircleIds.size === 0 && myRumahUsahaIds.size === 0) return false
  const memberRoles = await prisma.userRole.findMany({
    where: { userId: targetUserId },
    select: { studioId: true, studio: { select: { circleId: true, rumahUsahaId: true } } },
  })
  return memberRoles.some(r =>
    (r.studioId && myStudioIds.has(r.studioId)) ||
    (r.studio?.circleId && myCircleIds.has(r.studio.circleId)) ||
    (r.studio?.rumahUsahaId && myRumahUsahaIds.has(r.studio.rumahUsahaId))
  )
}

// Otorisasi buat laporan dana Circle/Rumah Usaha (OrgFundReport): SUPER_ADMIN bebas semua;
// KEPALA_CIRCLE/ADMIN_FUNGSIONAL cuma circle sendiri; KEPALA_RUMAH_USAHA cuma rumah usaha
// sendiri -- persis pola otorisasi lama upsertCircleFund, diperluas ke Rumah Usaha.
export function canManageOrgUnit(roles = [], { circleId, rumahUsahaId }) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  if (circleId)     return roles.some(r => ['KEPALA_CIRCLE', 'ADMIN_FUNGSIONAL'].includes(r.roleType) && r.circleId === circleId)
  if (rumahUsahaId) return roles.some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === rumahUsahaId)
  return false
}

/** Clamp pagination params — prevents DoS via giant queries */
export function parsePagination(query, defaultLimit = 50) {
  const page  = Math.max(1, parseInt(query.page)  || 1)
  const limit = Math.min(Math.max(1, parseInt(query.limit) || defaultLimit), 200)
  return { page, limit, skip: (page - 1) * limit }
}
