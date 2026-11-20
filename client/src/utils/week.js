// Helper minggu kalender (Senin-Minggu) + status kas -- dipakai bareng oleh WeeklyReport
// (Laporan Mingguan/Kas Studio/Rekap Bulanan) dan Finance (Kas Circle & Rumah Usaha), makanya
// ditaruh terpusat di sini alih-alih didefinisikan ulang di tiap halaman.

const pad = n => String(n).padStart(2, '0')
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Minggu kalender asli Senin–Minggu (selaras dengan getStartOfWeekWIB() di server) — geser
// tanggal manapun yang dipilih user mundur ke Senin terdekat, supaya minggu selalu blok 7 hari
// yang konsisten (bukan blok tetap 1-7/8-14/dst yang dulu suka meleset dari minggu kalender asli).
export function snapToMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return fmtDate(d)
}

// Akhir minggu = mulai + 6 hari. Kalau jatuhnya di bulan lain (mis. minggu terakhir Juli
// berakhir Rabu di Agustus), itu TIDAK memindahkan minggunya ke bulan lain — atribusi bulan
// laporan mingguan/bulanan selalu berdasarkan tanggal MULAI (periodeAwal), bukan tanggal akhir.
export function getWeekEnd(startStr) {
  const d = new Date(startStr + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return fmtDate(d)
}

// Minggu kalender (Senin-Minggu) saat ini
export function getWeekDates() {
  const start = snapToMonday(fmtDate(new Date()))
  return { start, end: getWeekEnd(start) }
}

// Periode laporan buat tanggal manapun -- minggu Senin-Minggu SEPERTI BIASA, TAPI dipotong di
// batas bulan biar satu periode gak pernah nyebrang 2 bulan sama sekali (beda dari sebelumnya,
// yang cuma snap ke Senin tanpa peduli batas bulan). Konsekuensinya: minggu pertama & terakhir
// tiap bulan bisa lebih pendek dari 7 hari, minggu di tengah bulan tetap Senin-Minggu normal.
// Sama persis logikanya kayak getReportingPeriod di server/src/utils/week.js. CUMA berlaku buat
// laporan BARU ke depan (mulai Juli 2026) -- laporan lama yang periodenya nyebrang bulan gak
// diubah/di-migrate ulang.
export function getReportingPeriod(dateStr) {
  const weekStart = snapToMonday(dateStr)
  const weekEnd   = getWeekEnd(weekStart)
  const d = new Date(dateStr + 'T00:00:00')
  const monthStart = fmtDate(new Date(d.getFullYear(), d.getMonth(), 1))
  const monthEnd   = fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  const periodeAwal  = weekStart > monthStart ? weekStart : monthStart
  const periodeAkhir = weekEnd   < monthEnd   ? weekEnd   : monthEnd
  return { periodeAwal, periodeAkhir }
}

export function getKasStatus(kas) {
  if (kas == null) return { label: 'Belum ada data', color: 'var(--text-muted)' }
  if (kas >= 5_000_000) return { label: 'Aman', color: 'var(--green)' }
  if (kas >= 1_000_000) return { label: 'Perhatian', color: '#f59e0b' }
  return { label: 'Kritis', color: 'var(--red)' }
}
