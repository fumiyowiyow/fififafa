// Mata uang order (audit OGS: transaksi USD + kurs + fee platform). Semua nilai tetap TERSIMPAN dalam Rupiah (nilaiKotor/nilaiBersih/item/termin);
// USD hanyalah asal nilai (mataUang='USD', nilaiUsd, kurs) supaya dashboard bisa menampilkan USD tanpa mengubah seluruh pipeline uang. MURNI.
export const KURS_BAWAAN = 16000
const r2 = (n) => Math.round(n * 100) / 100
export const MATA_UANG = ['IDR', 'USD']
/** Validasi masukan USD. Mengembalikan pesan galat atau null. */
export function validasiUsd({ mataUang, nilaiUsd, kurs }) {
  if (mataUang == null || mataUang === 'IDR') return null
  if (mataUang !== 'USD') return 'mataUang harus IDR atau USD'
  const u = Number(nilaiUsd), k = Number(kurs)
  if (!(Number.isFinite(u) && u > 0)) return 'Nilai USD harus lebih dari 0'
  if (!(Number.isFinite(k) && k >= 1000 && k <= 100000)) return 'Kurs tidak wajar (isi Rp per 1 USD, mis. 16000)'
  return null
}
export const rupiahDariUsd = (nilaiUsd, kurs) => Math.round(Number(nilaiUsd) * Number(kurs))
/** Nilai bersih dalam USD: order USD memakai kurs ordernya; order Rupiah memakai kurs bawaan (rata-rata kurs laporan bulan itu / default). */
export function bersihUsd(order, kursBawaan = KURS_BAWAAN) {
  const kurs = order.mataUang === 'USD' && order.kurs > 0 ? order.kurs : kursBawaan
  return r2((order.nilaiBersih ?? 0) / kurs)
}
export function kotorUsd(order, kursBawaan = KURS_BAWAAN) {
  const kurs = order.mataUang === 'USD' && order.kurs > 0 ? order.kurs : kursBawaan
  return r2((order.nilaiKotor ?? 0) / kurs)
}
/** Rata-rata kurs dari daftar laporan (kurs>0) atau bawaan. */
export function kursRata(daftarKurs) {
  const k = daftarKurs.filter(x => x > 0)
  return k.length ? r2(k.reduce((a, b) => a + b, 0) / k.length) : KURS_BAWAAN
}
