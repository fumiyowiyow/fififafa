// Satu-satunya tempat buat ganti branding ekosistem kalau app ini dipakai ulang buat
// ekosistem lain -- client adalah static build (di-build ulang tiap deploy), jadi cukup ganti
// 3 baris ini + `npm run build` ulang, gak perlu env var Vite.
export const ECOSYSTEM_NAME      = 'Ekosistem'
export const ECOSYSTEM_NAME_FULL = 'Ekosistem'
export const APP_URL             = 'app.domain-anda.com'
export const TELEGRAM_BOT        = 'nama_bot_anda'   // username bot Telegram (tanpa @)

// Modul yang bisa disembunyikan dari menu (kode & tabel tetap ada).
// 21 Okt 2026: modul Produksi & Marketing Ekosistem dihapus (kerja harian ada di web circle, database yang sama).
export const FITUR = { payroll: true }
