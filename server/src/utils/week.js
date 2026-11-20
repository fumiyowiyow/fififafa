// Satu-satunya sumber kebenaran untuk "awal minggu ini" di seluruh server. Minggu kalender
// WIB, mulai Senin — konsisten dengan periodeAwal yang benar-benar dipakai WeeklyReport
// (form submit di client, MonthWeekPicker, dst). Jangan tulis ulang logika ini di file lain —
// sebelumnya ada 5 salinan berbeda (sebagian mulai Minggu bukan Senin, sebagian tidak sadar
// WIB sama sekali / pakai jam server mentah) yang bisa saling bertentangan sampai 1 minggu
// penuh di jam-jam tertentu (WIB 00:00-06:59, karena server jalan di UTC).
export function getStartOfWeekWIB(date = new Date()) {
  const WIB_MS = 7 * 60 * 60 * 1000
  const nowWIB = new Date(date.getTime() + WIB_MS)
  const dayWIB = nowWIB.getUTCDay() // 0=Min, 1=Sen, ..., 6=Sab
  const mondayWIB = new Date(nowWIB.getTime() - ((dayWIB + 6) % 7) * 24 * 60 * 60 * 1000)
  return new Date(Date.UTC(mondayWIB.getUTCFullYear(), mondayWIB.getUTCMonth(), mondayWIB.getUTCDate()))
}

// Rentang periodeAwal buat query "laporan bulan X" yang MENGATRIBUSIKAN minggu yang nyebrang 2
// bulan ke bulan dengan HARI TERBANYAK dalam minggu itu -- bukan selalu ke bulan tanggal mulai
// (periodeAwal) kayak sebelumnya (WeeklyReport cuma 1 angka gabungan per minggu, bukan per-hari,
// jadi gak bisa dibelah beneran; pilihan realistisnya cuma "milih bulan mana yang paling
// representasinya besar").
//
// Triknya: karena minggu SELALU 7 hari (ganjil, gak mungkin seri 3.5/3.5), bulan pemilik hari
// KE-4 (Kamis) dalam minggu itu SELALU sama dengan bulan yang harinya lebih banyak -- pola yang
// sama dipakai standar ISO 8601 buat penomoran minggu ("minggu yang berisi Kamis pertama tahun
// itu = minggu 1"). Jadi query `periodeAwal` buat bulan X cukup digeser mundur 3 hari dari
// awal/akhir bulan kalender biasa (mundurin Kamis balik ke Senin), otomatis nangkep minggu-minggu
// yang atribusinya jatuh ke bulan itu walau periodeAwal-nya sendiri di bulan sebelum/sesudahnya.
// PENTING: fungsi ini sekarang cuma ngasih rentang query yang AMAN (over-inclusive) buat FETCH
// kandidat baris yang MUNGKIN relevan buat bulan itu -- BUKAN keputusan atribusi final lagi.
// Dulu langsung dipakai sebagai batas SQL akhir lewat trik "geser 3 hari" (comment asli: bulan
// pemilik hari ke-4/Kamis dalam minggu 7-hari SELALU sama dengan bulan yang harinya lebih
// banyak) -- itu valid CUMA buat periode 7 hari penuh. Sejak getReportingPeriod() motong periode
// laporan pas di batas bulan (mulai Juli 2026, hasilnya periode PENDEK 1-6 hari di awal/akhir
// bulan), trik geser-3-hari itu salah nangkep: periode yang 100% harinya di bulan sebelumnya bisa
// ikut lolos batas geser dan ke-hitung ke bulan berikutnya walau 0% harinya beneran di sana.
// Keputusan atribusi PRESIS sekarang di isReportInMonth() di bawah, dipanggil SETELAH fetch pakai
// rentang lebar ini -- lihat semua call site (`.filter(r => isReportInMonth(r, bulan, tahun))`).
// Buffer 7 hari di kedua sisi = panjang maksimum satu periode laporan, jaminan gak pernah kelewat
// nangkep kandidat yang relevan.
export function getMonthAttributionRange(bulan, tahun) {
  const DAY_MS = 7 * 24 * 60 * 60 * 1000
  const monthStart = new Date(tahun, bulan - 1, 1)
  const monthEnd   = new Date(tahun, bulan, 0, 23, 59, 59, 999)
  const rangeStart = new Date(monthStart.getTime() - DAY_MS)
  const rangeEnd   = new Date(monthEnd.getTime() + DAY_MS)
  return { rangeStart, rangeEnd }
}

// Filter PRESIS per-laporan -- panggil ini SETELAH fetch pakai getMonthAttributionRange di atas,
// sebelum baris dipakai buat agregasi/tampilan manapun.
// - periodeAwal & periodeAkhir di bulan kalender yang SAMA -> otomatis 100% harinya di bulan itu
//   (ini SELALU kasusnya buat data baru pasca getReportingPeriod(), termasuk stub pendek) -- gak
//   ada ambiguitas, tinggal cocokin ke bulan target.
// - periodeAwal & periodeAkhir beda bulan kalender -> CUMA MUNGKIN baris gaya lama (periode baru
//   dari getReportingPeriod() secara konstruksi TIDAK PERNAH nyebrang bulan) -- pakai trik Kamis
//   yang sudah ada (periodeAwal + 3 hari), PERSIS logic lama, gak ada perubahan perilaku buat
//   baris-baris ini.
export function isReportInMonth(report, bulan, tahun) {
  const awal  = new Date(report.periodeAwal)
  const akhir = new Date(report.periodeAkhir)
  if (awal.getFullYear() === akhir.getFullYear() && awal.getMonth() === akhir.getMonth()) {
    return awal.getFullYear() === tahun && awal.getMonth() === bulan - 1
  }
  const thursday = new Date(awal.getTime() + 3 * 24 * 60 * 60 * 1000)
  return thursday.getFullYear() === tahun && thursday.getMonth() === bulan - 1
}

// Periode laporan buat tanggal manapun -- minggu kalender Senin-Minggu SEPERTI BIASA, TAPI
// dipotong (clip) di batas bulan supaya satu periode gak pernah nyebrang 2 bulan sama sekali
// (beda dari getMonthAttributionRange di atas, yang gak ubah definisi minggu, cuma
// ngatribusiin minggu yang nyebrang ke bulan yang lebih dominan buat REKAP). Konsekuensinya:
// minggu pertama & terakhir tiap bulan bisa lebih pendek dari 7 hari (nunggu Senin
// berikutnya buat mulai minggu penuh lagi -- BUKAN langsung geser 7 hari dari tanggal 1,
// itu balik ke sistem blok M1-M4 lama yang sengaja diganti sebelumnya karena gak match
// minggu kalender asli).
//
// CUMA berlaku buat laporan BARU ke depan (mulai Juli 2026) -- data lama yang periodeAwal/
// periodeAkhir-nya udah kesimpen nyebrang bulan TIDAK di-migrate ulang, tetap dihitung lewat
// getMonthAttributionRange di atas.
export function getReportingPeriod(date = new Date()) {
  const weekStart = getStartOfWeekWIB(date)
  const weekEnd   = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)

  const WIB_MS = 7 * 60 * 60 * 1000
  const dateWIB = new Date(date.getTime() + WIB_MS)
  const bulan = dateWIB.getUTCMonth() + 1
  const tahun = dateWIB.getUTCFullYear()
  const monthStart = new Date(Date.UTC(tahun, bulan - 1, 1))
  const monthEnd   = new Date(Date.UTC(tahun, bulan, 0))

  const periodeAwal  = weekStart > monthStart ? weekStart : monthStart
  const periodeAkhir = weekEnd   < monthEnd   ? weekEnd   : monthEnd
  return { periodeAwal, periodeAkhir }
}
