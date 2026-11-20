// REFLEKSI MINGGUAN (adaptasi OGS SdmReflection). MURNI — tanpa database. Minggu = Senin–Minggu WIB.
export const KATEGORI = ['Prioritas & waktu', 'Skill / teknis', 'Komunikasi tim', 'Brief / arahan kurang jelas', 'Alat atau akses', 'Beban kerja', 'Motivasi / energi', 'Lainnya']
const HARI = 86400000
/** 'YYYY-MM-DD' → Senin pekan itu ('YYYY-MM-DD'). */
export function seninDari(tgl) {
  const d = new Date(tgl + 'T00:00:00Z'), dow = (d.getUTCDay() + 6) % 7
  return new Date(d.getTime() - dow * HARI).toISOString().slice(0, 10)
}
export const mingguAkhir = (senin) => new Date(new Date(senin + 'T00:00:00Z').getTime() + 6 * HARI).toISOString().slice(0, 10)
/** Boleh diubah selama hari ini ≤ Minggu pekan itu (OGS: sampai akhir hari Minggu). */
export const masihBisaDiubah = (senin, hariIni) => hariIni <= mingguAkhir(senin)
export function validasi(b) {
  if (!KATEGORI.includes(b?.kategori)) return 'Pilih kategori hambatan.'
  if (!(Number.isInteger(b.tingkat) && b.tingkat >= 1 && b.tingkat <= 5)) return 'Tingkat hambatan harus 1–5.'
  const h = String(b.hambatan ?? '').trim(); if (!h) return 'Ceritakan hambatannya.'; if (h.length > 2000) return 'Hambatan maksimal 2000 huruf.'
  if (b.komitmen != null && String(b.komitmen).length > 2000) return 'Komitmen maksimal 2000 huruf.'
  return null
}
export const perluDukungan = (tingkat) => tingkat >= 4
/** Rekap tim: kategori terbanyak (hanya refleksi yang masuk) + berapa yang perlu dukungan. */
export function rekapKategori(refleksi) {
  const m = new Map()
  for (const r of refleksi) { const e = m.get(r.kategori) ?? { kategori: r.kategori, jumlah: 0, totalTingkat: 0 }; e.jumlah++; e.totalTingkat += r.tingkat; m.set(r.kategori, e) }
  return [...m.values()].map(e => ({ kategori: e.kategori, jumlah: e.jumlah, rataTingkat: Math.round((e.totalTingkat / e.jumlah) * 10) / 10 })).sort((a, b) => b.jumlah - a.jumlah || b.rataTingkat - a.rataTingkat)
}
