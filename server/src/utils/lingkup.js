import prisma from '../prisma.js'
import { SUPER_ADMIN, hasAnyRole } from './roles.js'

// ── Lingkup wilayah untuk angka keuangan (16 Okt 2026) ─────────────────────────────────────────
// Keputusan user: jumlah dana ekosistem tidak boleh terbuka untuk semua. Aturannya SAMA dengan
// canManageStudio (utils/roles.js), tapi dihitung sekali untuk BANYAK studio:
//   • Advisor / Kepala Ekosistem          → semua unit (semua = true)
//   • Kepala Circle (+ Admin Fungsional)  → unit di circle-nya
//   • Kepala Rumah Usaha (+ Admin Fung.)  → unit di rumah usahanya
//   • peran lain (Koordinator, Pendamping, Penasihat, …) → unit tempat dia punya peran
//     (+ unit di bawahnya bila unit itu Korporasi, 8 Nov 2026)
//   • KECUALI talent (Kader/Karyawan/Magang) & Dignity: peran itu TIDAK membuka angka uang unitnya (21 Okt 2026, Aturan Keras 2 —
//     talent tidak melihat omset/kas; baris tetap tampil, angkanya disamarkan seperti unit di luar wilayah)
// Setiap endpoint yang menampilkan angka uang HARUS menyaring lewat ini — jangan menjumlah semua studio.
const PERAN_TAMBAHAN = ['ADMIN_FUNGSIONAL']
const PERAN_TANPA_UANG = ['KADER', 'KARYAWAN', 'MAGANG', 'DIGNITY']

export async function lingkupKeuangan(roles = []) {
  if (hasAnyRole(roles, SUPER_ADMIN)) {
    return { semua: true, studioIds: null, circleIds: null, rumahUsahaIds: null, boleh: () => true }
  }
  const circleTypes = ['KEPALA_CIRCLE', ...PERAN_TAMBAHAN]
  const ruTypes = ['KEPALA_RUMAH_USAHA', ...PERAN_TAMBAHAN]
  const circleIds = new Set(roles.filter(r => circleTypes.includes(r.roleType) && r.circleId).map(r => r.circleId))
  const rumahUsahaIds = new Set(roles.filter(r => ruTypes.includes(r.roleType) && r.rumahUsahaId).map(r => r.rumahUsahaId))
  const studioPeran = roles.filter(r => r.studioId && !PERAN_TANPA_UANG.includes(r.roleType)).map(r => r.studioId)
  // Peran di unit Korporasi ikut membuka unit di bawahnya (angkanya dijumlah ke Korporasi).
  const or = [{ id: { in: studioPeran } }, { indukId: { in: studioPeran } }]
  if (circleIds.size) or.push({ circleId: { in: [...circleIds] } })
  if (rumahUsahaIds.size) or.push({ rumahUsahaId: { in: [...rumahUsahaIds] } })
  const studios = await prisma.studio.findMany({ where: { OR: or }, select: { id: true } })
  const studioIds = new Set(studios.map(s => s.id))
  return { semua: false, studioIds, circleIds, rumahUsahaIds, boleh: (id) => studioIds.has(id) }
}

/** Fragmen `where` Prisma untuk kolom studioId: undefined bila lingkup = semua. */
export const filterStudioId = (lingkup, kolom = 'studioId') =>
  lingkup.semua ? {} : { [kolom]: { in: [...lingkup.studioIds] } }

/** Ringkasan kecil yang dikirim ke klien supaya tampilan bisa memberi label "data wilayahmu". */
export const infoLingkup = (lingkup) => ({ semua: lingkup.semua, jumlahUnit: lingkup.semua ? null : lingkup.studioIds.size })

// ── PENYAMARAN (bukan pembuangan baris) — keputusan user 19 Okt 2026 ───────────────────────────
// Semua baris/unit tetap tampil seperti dulu (peringkat, status lapor, daftar unit); yang disamarkan
// HANYA angka uang unit di luar wilayah → null (klien menampilkannya sebagai "—").
// Urutan/peringkat tetap dihitung dari angka asli di server SEBELUM disamarkan.
export const FIELD_UANG_LAPORAN = [
  'totalUsd', 'omsetFiverr', 'omsetEtsy', 'omsetUpwork', 'omsetVgen', 'omsetKomunitas', 'omsetLainnya',
  'kasSekarang', 'pengeluaran',
]

/** Salinan objek dengan field uang di-null-kan (field yang tak ada dibiarkan). */
export function samarkan(obj, fields) {
  if (!obj) return obj
  const o = { ...obj }
  for (const f of fields) if (f in o) o[f] = null
  return o
}

/** true bila SEMUA unit di daftar berada dalam wilayah (dipakai agar total circle/rumah usaha tak bocor sebagian). */
export const semuaDalamLingkup = (lingkup, studioIds = []) => lingkup.semua || (studioIds.length > 0 && studioIds.every(id => lingkup.boleh(id)))
