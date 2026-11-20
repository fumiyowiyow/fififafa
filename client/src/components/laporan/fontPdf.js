// FONT PDF — Fredoka 600/700 (judul Playground), Sora 600/700 (judul Kosmik /
// rumahpara.app) & Plus Jakarta Sans 400–800 (badan), versi TTF STATIS per
// ketebalan di src/assets/font-pdf/. Font web (public/fonts) adalah WOFF2 VARIABEL
// yang tidak bisa dipakai react-pdf (instans bawaan Fredoka = Light; subset font
// bervariasi rusak di fontkit 2.0.4); TTF-nya dibuat dari WOFF2 itu oleh
// _alat/font-pdf/buat-font-pdf.mjs. Helvetica/Times = font bawaan PDF (tanpa berkas).
// Emoji digambar sebagai jalur (pdf/ikonEmoji.js).
import { Font } from '@react-pdf/renderer'
import fredoka600 from '../../assets/font-pdf/fredoka-pge-600.ttf?url'
import fredoka700 from '../../assets/font-pdf/fredoka-pge-700.ttf?url'
import sora600 from '../../assets/font-pdf/sora-pge-600.ttf?url'
import sora700 from '../../assets/font-pdf/sora-pge-700.ttf?url'
import jakarta400 from '../../assets/font-pdf/jakarta-pge-400.ttf?url'
import jakarta600 from '../../assets/font-pdf/jakarta-pge-600.ttf?url'
import jakarta700 from '../../assets/font-pdf/jakarta-pge-700.ttf?url'
import jakarta800 from '../../assets/font-pdf/jakarta-pge-800.ttf?url'
import { HURUF } from './pdf/primitif'
import playfair400 from '../../assets/font-pdf/playfair-400.ttf?url'
import playfair700 from '../../assets/font-pdf/playfair-700.ttf?url'
import quattrocento400 from '../../assets/font-pdf/quattrocento-400.ttf?url'
import quattrocento700 from '../../assets/font-pdf/quattrocento-700.ttf?url'

let terdaftar = false

/** Daftarkan sekali per muatan halaman (Font.register bersifat global). Berkas
 *  font baru diunduh react-pdf saat sebuah teks benar-benar memakainya. */
export function daftarkanFontPdf() {
  if (terdaftar) return
  terdaftar = true
  Font.register({ family: HURUF.fredoka, fonts: [{ src: fredoka600, fontWeight: 600 }, { src: fredoka700, fontWeight: 700 }] })
  Font.register({ family: HURUF.sora, fonts: [{ src: sora600, fontWeight: 600 }, { src: sora700, fontWeight: 700 }] })
  Font.register({
    family: HURUF.jakarta,
    fonts: [
      { src: jakarta400, fontWeight: 400 },
      { src: jakarta600, fontWeight: 600 },
      { src: jakarta700, fontWeight: 700 },
      { src: jakarta800, fontWeight: 800 },
    ],
  })
}

// Raport siswa (13 Okt 2026): huruf raport Karir Anak — Playfair Display (judul) & Quattrocento
// (isi), TTF statis dari Google Fonts (OFL).

export const HURUF_RAPORT = { judul: 'Playfair Raport', isi: 'Quattrocento Raport' }
let raportTerdaftar = false
export function daftarkanFontRaport() {
  daftarkanFontPdf()
  if (raportTerdaftar) return
  raportTerdaftar = true
  // Pemenggalan bawaan react-pdf berbahasa Inggris ("Pro-gram") -- raport berbahasa Indonesia,
  // jadi kata tidak dipenggal (pindah baris utuh).
  Font.registerHyphenationCallback((kata) => [kata])
  Font.register({ family: HURUF_RAPORT.judul, fonts: [{ src: playfair400, fontWeight: 400 }, { src: playfair700, fontWeight: 700 }] })
  Font.register({ family: HURUF_RAPORT.isi, fonts: [{ src: quattrocento400, fontWeight: 400 }, { src: quattrocento700, fontWeight: 700 }] })
}
