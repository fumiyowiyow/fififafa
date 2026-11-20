// WARNA PROGRESS REPORT — dipakai PDF (pdf/primitif.jsx) DAN pratinjau sampul di
// halaman (SampulMini). Sengaja tanpa @react-pdf: halaman Unduh Laporan tidak
// boleh ikut memuat pustaka PDF sebelum tombol ditekan. PDF selalu dicetak terang,
// jadi pratinjaunya juga memakai hex terang (config/warna-pdf.js), bukan token layar.
import { PDF_TINTA, PDF_KERTAS, warnaCirclePdf } from '../../config/warna-pdf'

/** Kanvas halaman (--bg-primary terang). */
export const KANVAS = '#F4F4F1'

const keRgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) }
const keHex = (rgb) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

/** Campur dua hex: t = porsi warna b (0..1). */
export const campur = (a, b, t) => { const x = keRgb(a), y = keRgb(b); return keHex(x.map((v, i) => v + (y[i] - v) * t)) }

export function luminans(hex) {
  const [r, g, b] = keRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Teks di atas isian berwarna: kertas di atas warna gelap, tinta di atas warna terang. */
export const teksDi = (hex) => (luminans(hex) < 0.3 ? PDF_KERTAS : PDF_TINTA)

/** Palet satu lingkup: aksen = warna circle (slot 1 / ekosistem = tinta). */
export function paletLingkup(slotWarna) {
  const aksen = warnaCirclePdf(slotWarna ?? 1)
  return { aksen, lapis: campur(aksen, '#FFFFFF', 0.84), teksAksen: teksDi(aksen) }
}
