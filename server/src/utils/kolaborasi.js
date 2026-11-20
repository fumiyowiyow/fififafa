import prisma from '../prisma.js'

// ══ STUDIO KOLABORASI (13 Okt 2026) ═══════════════════════════════════════════════════════════
// Studio dengan hitungDiEkosistem=false (mis. Souldear, angkanya dihitung di Auralist) tetap aktif &
// terpantau, tapi TIDAK ikut penjumlahan "kekayaan" ekosistem: total omset/kas/pengeluaran,
// jumlah unit & anggota, kesehatan ekosistem, insight AI, Monthly Report. Semua titik penjumlahan
// memakai fragmen di bawah supaya aturannya satu sumber.

/** Fragmen `where` untuk Studio. */
export const STUDIO_DIHITUNG = { hitungDiEkosistem: true }

/** Fragmen `where` untuk model yang punya relasi `studio` (WeeklyReport, dst). */
export const LAPORAN_DIHITUNG = { studio: { hitungDiEkosistem: true } }

/** Fragmen `where` untuk UserRole: peran di luar studio kolaborasi (peran tanpa studio = level circle/ekosistem). */
export const PERAN_DIHITUNG = { OR: [{ studioId: null }, { studio: { hitungDiEkosistem: true } }] }

/** Fragmen `where` untuk User: punya minimal satu peran (selain yang dikecualikan) di luar studio kolaborasi. */
export const userDihitung = (roleTypeNotIn = []) => ({
  roles: { some: { ...(roleTypeNotIn.length ? { roleType: { notIn: roleTypeNotIn } } : {}), ...PERAN_DIHITUNG } },
})

/** Studio kolaborasi yang aktif (untuk kartu "Studio Kolaborasi" & penandaan di daftar). */
export function studioKolaborasi(select = { id: true, nama: true, mitraKolaborasi: true }) {
  return prisma.studio.findMany({ where: { statusAktif: true, hitungDiEkosistem: false }, select, orderBy: { nama: 'asc' } })
}

/** Fragmen `where` untuk User: BUKAN anggota yang seluruh perannya ada di studio kolaborasi (yang tanpa peran sama sekali tetap lolos). */
export const USER_BUKAN_KOLABORASI_SAJA = { NOT: { roles: { some: {}, every: { studio: { hitungDiEkosistem: false } } } } }
