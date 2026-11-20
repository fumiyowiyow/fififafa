// ── KONFIGURASI EKOSISTEM UNTUK LAPORAN PDF (13 Okt 2026) ─────────────────
// Modul laporan (components/laporan/, pages/Reports/Pembuat*) diadaptasi dari
// playgroundecos.app, yang membaca identitas ekosistem dari berkas bernama sama.
// Di Ekosistem satu-satunya sumber nama tetap config/ecosystem.js — berkas ini cuma
// menerjemahkannya ke nama yang dipakai modul laporan.
import { ECOSYSTEM_NAME, ECOSYSTEM_NAME_FULL, APP_URL } from './ecosystem'

// Ekosistem = web tingkat ekosistem (semua circle). Web per circle belum ada.
export const TINGKAT = 'ekosistem'
export const SATU_CIRCLE = false

export const EKOSISTEM_NAMA         = ECOSYSTEM_NAME_FULL
export const EKOSISTEM_NAMA_PENDEK  = ECOSYSTEM_NAME
export const EKOSISTEM_NAMA_PANJANG = ECOSYSTEM_NAME_FULL
/** Slogan di halaman penutup PDF — kosong = tidak ditampilkan. */
export const EKOSISTEM_SLOGAN       = null
export const SEBUTAN_TINGKAT        = 'EKOSISTEM'
export const EKOSISTEM = { nama: ECOSYSTEM_NAME_FULL, namaPendek: ECOSYSTEM_NAME, web: APP_URL }

/** Warna identitas circle untuk tampilan layar. Ekosistem menyimpan warna circle sebagai hex
 *  (Circle.colorHex), bukan slot 1–9 seperti Playground — keduanya diterima. */
export function warnaCircle(warna) {
  if (typeof warna === 'string' && /^#[0-9a-f]{6}$/i.test(warna)) return warna
  return 'var(--text-muted)'
}

// ── Market ───────────────────────────────────────────────────────────────
// Normalkan ejaan kunci market apa pun (vgen / omsetVgen / VGen / others …).
const ALIAS_MARKET = {
  vgen: 'vgen', omsetvgen: 'vgen',
  fiverr: 'fiverr', omsetfiverr: 'fiverr',
  etsy: 'etsy', omsetetsy: 'etsy',
  ltk: 'ltk', omsetltk: 'ltk', liketoknowit: 'ltk',
  komunitas: 'komunitas', omsetkomunitas: 'komunitas', community: 'komunitas',
  upwork: 'upwork', omsetupwork: 'upwork',
  lainnya: 'lainnya', omsetlainnya: 'lainnya', others: 'lainnya', other: 'lainnya', omsetothers: 'lainnya',
}
export const URUTAN_MARKET = ['vgen', 'fiverr', 'komunitas', 'etsy', 'ltk', 'upwork', 'lainnya']
export function kunciMarket(key) {
  const k = String(key ?? '').toLowerCase().replace(/[^a-z]/g, '')
  return ALIAS_MARKET[k] ?? 'lainnya'
}
