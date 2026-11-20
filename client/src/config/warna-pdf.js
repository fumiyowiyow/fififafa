// ── WARNA UNTUK PDF (react-pdf) ──────────────────────────────────────────
// react-pdf TIDAK membaca CSS: var(--market-vgen) di dalam dokumen PDF tidak
// berarti apa-apa. Berkas ini adalah salinan HEX OPAK dari nilai TERANG
// palet tema Playground (asal modul laporan ini) — PDF selalu dicetak di kertas putih,
// jadi selalu versi terang, apa pun mode layar pemakainya.
//
// ATURAN: tidak ada nilai ber-alpha (react-pdf menggambar alpha di atas latar
// yang tidak kita kendalikan — lihat catatan KeuanganUnitPDF), dan kalau satu
// hex di token.css diubah, ubah juga di sini (satu-satunya salinan).
import { kunciMarket } from './ekosistem'

export const PDF_TINTA = '#141414'
export const PDF_TEKS = '#1F1F1F'
export const PDF_TEKS_REDUP = '#525252'
export const PDF_GARIS = '#D9D9D9'
export const PDF_KERTAS = '#FFFFFF'
export const PDF_SOROT = '#FFE45C'

/** Tiga rona vonis (teks & lampu) + ladang lapisnya. */
export const PDF_VONIS = {
  baik: '#17734F', baikLapis: '#E3F3EC',
  perhatian: '#9A5B00', perhatianLapis: '#FAEDD6',
  kritis: '#B3261E', kritisLapis: '#FBE6E4',
}

/** Market: isian (utuh) dan ladang stabilo — kunci sudah dinormalkan. */
export const PDF_MARKET = {
  vgen:      { utuh: '#2A78D6', stabilo: '#9BD1FF' },
  fiverr:    { utuh: '#5F8F10', stabilo: '#C5EE8E' },
  komunitas: { utuh: '#4A3AA7', stabilo: '#D6C4FF' },
  etsy:      { utuh: '#E06A1A', stabilo: '#FFC38A' },
  ltk:       { utuh: '#E0509B', stabilo: '#FFB3D1' },
  upwork:    { utuh: '#0E8C80', stabilo: '#A8EADF' },
  lainnya:   { utuh: '#8C8C87', stabilo: '#F0F0F0' },
}

/** Circle slot 1–9 (slot 1 = tinta). Sama dengan --circle-n terang. */
export const PDF_CIRCLE = {
  1: '#141414', 2: '#239ABC', 3: '#9A852B', 4: '#057688', 5: '#972159',
  6: '#5C0065', 7: '#9066A9', 8: '#424E08', 9: '#219992',
}

/** Hex market untuk PDF; menerima ejaan kunci apa pun (vgen/omsetVgen/VGen/others…). */
export function warnaMarketPdf(key, bentuk = 'utuh') {
  const m = PDF_MARKET[kunciMarket(key)] ?? PDF_MARKET.lainnya
  return bentuk === 'stabilo' ? m.stabilo : m.utuh
}

/** Hex circle untuk PDF. Ekosistem menyimpan warna circle sebagai hex (Circle.colorHex) — dipakai
 *  apa adanya; slot 1–9 (gaya Playground) tetap diterima; selain itu abu netral. */
export function warnaCirclePdf(warna) {
  if (typeof warna === 'string' && /^#[0-9a-f]{6}$/i.test(warna)) return warna.toUpperCase()
  return PDF_CIRCLE[Number(warna)] ?? '#8C8C87'
}
