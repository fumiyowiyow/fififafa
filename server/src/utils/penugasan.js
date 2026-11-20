// PENUGASAN (acuan OGS AutoAssignService, ReassignmentSuggestionService). MURNI — tanpa database.
export const RANK_KESULITAN = { MUDAH: 1, SEDANG: 2, SULIT: 3 }
export const KESULITAN = Object.keys(RANK_KESULITAN)
// SATU-SATUNYA definisi "antrean talent" (10 Nov 2026, permintaan tim 3D): tahap yang dikerjakan orang yang ditugaskan —
// Produksi (KERJA), Revisi (internal & klien) dan Finalisasi. Inbox, QC, Klien, Delivery, Hold & Done = bukan antrean talent.
// Dipakai Tugas saya, Antrean/penugasan tahap, Analitik (WIP), pengingat & penugasan otomatis.
export const JENIS_KERJA = ['KERJA', 'REVISI_INTERNAL', 'REVISI_KLIEN', 'FINALISASI']
export const JENIS_ANTREAN_TALENT = JENIS_KERJA

const kompeten = (maks, perlu) => (RANK_KESULITAN[maks] ?? 0) >= perlu

/**
 * Pilih kandidat otomatis (OGS: keahlian cukup untuk kesulitan, lalu antrean aktif paling sedikit).
 * keahlianTahap: [{userId, tahapId, akunId|null, maksKesulitan}], keahlianGenre: [{userId, genre, maksKesulitan}]
 * beban: Map userId → jumlah penugasan aktif. Mengembalikan userId atau null (tidak ada yang cocok → dibiarkan belum ditugaskan).
 * Keahlian TAHAP dipakai bila ada yang terdaftar untuk tahap itu (sesuai akun atau semua akun); jika tidak, keahlian GENRE.
 */
export function pilihKandidat({ kesulitan, genre, tahapId, akunId, keahlianTahap = [], keahlianGenre = [], beban = new Map(), nama = new Map() }) {
  const perlu = RANK_KESULITAN[kesulitan]
  if (!perlu) return null
  let ids = keahlianTahap.filter(k => k.tahapId === tahapId && (k.akunId == null || k.akunId === akunId) && kompeten(k.maksKesulitan, perlu)).map(k => k.userId)
  if (!keahlianTahap.some(k => k.tahapId === tahapId) && genre) ids = keahlianGenre.filter(k => k.genre.toLowerCase() === genre.toLowerCase() && kompeten(k.maksKesulitan, perlu)).map(k => k.userId)
  ids = [...new Set(ids)]
  if (!ids.length) return null
  return ids.sort((a, b) => (beban.get(a) ?? 0) - (beban.get(b) ?? 0) || (nama.get(a) ?? a).localeCompare(nama.get(b) ?? b, 'id'))[0]
}

/**
 * Saran penugasan ulang (OGS ReassignmentSuggestionService::suggest): yang kompeten untuk tahap/kesulitan, penugasan tahap sebelumnya,
 * lalu yang antreannya paling ringan — digabung, unik, diurutkan abjad, ambil `batas`.
 * Mengembalikan daftar userId.
 */
export function sarankan({ kompetenIds = [], sebelumnyaId = null, beban = new Map(), nama = new Map(), batas = 2 }) {
  const ringan = [...beban.entries()].sort((a, b) => a[1] - b[1] || (nama.get(a[0]) ?? '').localeCompare(nama.get(b[0]) ?? '', 'id')).map(([id]) => id).slice(0, batas * 3)
  const semua = [...kompetenIds, ...(sebelumnyaId ? [sebelumnyaId] : []), ...ringan].filter(Boolean)
  return [...new Set(semua)].sort((a, b) => (nama.get(a) ?? '').localeCompare(nama.get(b) ?? '', 'id')).slice(0, batas)
}

/** Nomor antrean per orang: yang MENDESAK selalu paling atas (OGS queue_priority=0), lalu override koordinator (urutan kecil), sisanya FIFO menurut ditugaskanPada. */
export function urutkanAntrean(baris) {
  return [...baris].sort((a, b) => Number(!!b.mendesak) - Number(!!a.mendesak) || (a.urutanAntrean ?? 1e9) - (b.urutanAntrean ?? 1e9) || new Date(a.ditugaskanPada) - new Date(b.ditugaskanPada)).map((b, i) => ({ ...b, nomor: i + 1 }))
}
