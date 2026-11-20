// ─────────────────────────────────────────────────────────────────────────
// TEMA & FONT dokumen PDF (Progress Report, SKB) — 2 Okt 2026.
//
// PLAYGROUND = kertas kartun PGE (tinta 2pt, bayang cap, stabilo kuning).
// KOSMIK     = kulit rumahpara.app (latar luar angkasa #090b14, kaca #161929,
//              aksen ungu→magenta, Sora). Dipakai otomatis untuk circle yang
//              punya web sendiri (Circle.situs) bila pengguna memilih "Otomatis".
// Komponen membaca tema lewat context (useTema) — satu dokumen, satu tema.
// Hex di sini salinan nilai TERANG/kosmik dari token CSS kedua web (react-pdf
// tidak membaca CSS). Sengaja tanpa alpha: react-pdf menggambar alpha di atas
// latar yang tidak kita kendalikan.
// ─────────────────────────────────────────────────────────────────────────
import { createContext, useContext } from 'react'
import { warnaCirclePdf } from '../../../config/warna-pdf'
import { campur, teksDi } from '../warnaLaporan'
import { ECOSYSTEM_NAME } from '../../../config/ecosystem'

export const SUDUT_GAMBAR = { borderTopLeftRadius: 18, borderTopRightRadius: 14, borderBottomRightRadius: 19, borderBottomLeftRadius: 15 }
export const SUDUT_GAMBAR_KECIL = { borderTopLeftRadius: 11, borderTopRightRadius: 9, borderBottomRightRadius: 12, borderBottomLeftRadius: 9 }

// Properti hiasan bawaan (nilai lama yang dulu ditulis langsung di pdf/latar.jsx, primitif.jsx,
// komponen.jsx) -- dipasang rakitTema() di bawah tema yang tidak menyetelnya, jadi tema lama
// (playground/kosmik) tetap persis seperti sebelumnya. `bersih` (Ekosistem, 13 Okt 2026) mematikan
// garis tinta tebal, bayang cap, bintang & pola kisi.
const HIASAN_BAWAAN = {
  bersih: false,
  hias: '#7C3AED',        // aksen hiasan (pil judul, garis pemisah, cakram)
  teksDiHias: '#FFFFFF',  // teks di atas `hias`
  hiasMuda: '#C4B5FD',    // garis orbit / putus-putus / bingkai muda
  hiasKedua: '#06B6D4',   // titik bulan & aksen kedua
  hiasKilau: '#F9A8D4',   // kilau kecil ✨
  teksLembut: '#E9D5FF',  // teks lembut di permukaan gelap
  sorotGelap: '#33266B',  // isian sorot di tema gelap
  kartuAksen: '#211C40',  // baris kelompok di tema gelap
  nomorBesar: '#171B30',  // angka bagian raksasa di pembatas gelap
  garisKuat: '#4C4F7A',   // bingkai ubin/logo di tema gelap
  warnaRincian: null,     // palet komposisi pengeluaran (null = bawaan komponen)
}

export const TEMA_PDF = {
  // ── Ekosistem (13 Okt 2026): gaya clean ala kariranak.com, aksen toska. Hex = token
  //    client/src/styles/index.css (react-pdf tidak membaca CSS). ──────────────────────────
  terang: {
    id: 'terang', nama: `${ECOSYSTEM_NAME} Terang`, gelap: false, bersih: true,
    kanvas: '#F7F7F7', kartu: '#FFFFFF', kartuSelang: '#FAFAFA', kaki: '#F1F2F3',
    tinta: '#3C3C3C', teks: '#3C3C3C', redup: '#6B7280', garisTipis: '#E5E7EA',
    garis: '#E5E7EA', tebalGaris: 1, bayang: null,
    sorot: '#0FC1BD', teksSorot: '#08302F',
    isiTinta: '#0FC1BD', teksDiTinta: '#08302F', teksDiTintaRedup: '#0B4D4B',
    kepalaTabel: '#F1F2F3', teksKepalaTabel: '#3C3C3C',
    lencana: '#E3F7F6', lencanaGaris: '#9FE3E0', ikon: '#087F7C',
    bilah: '#0FC1BD', bilahKini: '#087F7C', bilahKiniGaris: '#087F7C',
    pola: 'polos',
    vonis: { baik: '#0E8A5F', baikLapis: '#E3F4EC', perhatian: '#B45F06', perhatianLapis: '#FBEEDC', kritis: '#D23A3A', kritisLapis: '#FBE7E7' },
    logo: { ubin: '#0FC1BD', isi: '#08302F' },
    sudut: { borderRadius: 14 }, sudutKecil: { borderRadius: 9 },
    gradien: ['#0FC1BD', '#087F7C'],
    fontBawaan: 'jakarta',
    hias: '#0FC1BD', teksDiHias: '#08302F', hiasMuda: '#9FE3E0', hiasKedua: '#F5B841', hiasKilau: '#F5B841',
    teksLembut: '#3C3C3C', sorotGelap: '#E3F7F6', kartuAksen: '#F1F2F3', nomorBesar: '#ECEEF0', garisKuat: '#CDD1D6',
    warnaRincian: { THP: '#0FC1BD', SUPPORT: '#087F7C', SUBSCRIPTION: '#7FD9D6', LAINNYA: '#B8BEC6', SHU: '#F5B841', TAMBAHAN: '#E9887B' },
  },
  gelap: {
    id: 'gelap', nama: `${ECOSYSTEM_NAME} Gelap`, gelap: true, bersih: true,
    kanvas: '#121416', kartu: '#1E2124', kartuSelang: '#24282C', kaki: '#181A1D',
    tinta: '#E8EAED', teks: '#E8EAED', redup: '#A9B0B9', garisTipis: '#2C3136',
    garis: '#33393F', tebalGaris: 1, bayang: null,
    sorot: '#0FC1BD', teksSorot: '#08302F',
    isiTinta: '#0FC1BD', teksDiTinta: '#08302F', teksDiTintaRedup: '#0B4D4B',
    kepalaTabel: '#24282C', teksKepalaTabel: '#E8EAED',
    lencana: '#16373A', lencanaGaris: '#0FC1BD', ikon: '#3DD6D2',
    bilah: '#0FC1BD', bilahKini: '#3DD6D2', bilahKiniGaris: '#3DD6D2',
    pola: 'polos',
    vonis: { baik: '#34D399', baikLapis: '#0F2A22', perhatian: '#FBBF24', perhatianLapis: '#2B230F', kritis: '#F87171', kritisLapis: '#2C1618' },
    logo: { ubin: '#0FC1BD', isi: '#08302F' },
    sudut: { borderRadius: 14 }, sudutKecil: { borderRadius: 9 },
    gradien: ['#0FC1BD', '#087F7C'],
    fontBawaan: 'jakarta',
    hias: '#0FC1BD', teksDiHias: '#08302F', hiasMuda: '#3DD6D2', hiasKedua: '#F5B841', hiasKilau: '#F5B841',
    teksLembut: '#CFF5F3', sorotGelap: '#16373A', kartuAksen: '#1A2D2F', nomorBesar: '#1B1F22', garisKuat: '#3A4147',
    warnaRincian: { THP: '#0FC1BD', SUPPORT: '#3DD6D2', SUBSCRIPTION: '#7FD9D6', LAINNYA: '#6B7280', SHU: '#F5B841', TAMBAHAN: '#E9887B' },
  },
  playground: {
    id: 'playground', nama: 'Playground', gelap: false,
    kanvas: '#F4F4F1', kartu: '#FFFFFF', kartuSelang: '#FAFAF8', kaki: '#F1F1EC',
    tinta: '#141414', teks: '#1F1F1F', redup: '#525252', garisTipis: '#DCDCD7',
    garis: '#141414', tebalGaris: 2, bayang: '#141414',
    sorot: '#FFE45C', teksSorot: '#141414',
    isiTinta: '#141414', teksDiTinta: '#FFFFFF', teksDiTintaRedup: '#CFCFCB',
    kepalaTabel: '#141414', teksKepalaTabel: '#FFFFFF',
    lencana: '#FFE45C', lencanaGaris: '#141414', ikon: '#141414',
    bilah: '#141414', bilahKini: '#FFE45C', bilahKiniGaris: '#141414',
    pola: 'kisi',
    vonis: { baik: '#17734F', baikLapis: '#E3F3EC', perhatian: '#9A5B00', perhatianLapis: '#FAEDD6', kritis: '#B3261E', kritisLapis: '#FBE6E4' },
    logo: { ubin: '#141414', isi: '#F7F5F0' },
    sudut: SUDUT_GAMBAR, sudutKecil: SUDUT_GAMBAR_KECIL,
    gradien: null,
    fontBawaan: 'fredoka',
  },
  kosmik: {
    id: 'kosmik', nama: 'Kosmik', gelap: true,
    kanvas: '#090B14', kartu: '#161929', kartuSelang: '#1A1E31', kaki: '#1E2238',
    tinta: '#E2E8F4', teks: '#E2E8F4', redup: '#8A9BB8', garisTipis: '#262B44',
    garis: '#343B5E', tebalGaris: 1.2, bayang: null,
    sorot: '#7C3AED', teksSorot: '#FFFFFF',
    isiTinta: '#6D28D9', teksDiTinta: '#FFFFFF', teksDiTintaRedup: '#DDD6FE',
    kepalaTabel: '#2A2352', teksKepalaTabel: '#E2E8F4',
    lencana: '#2A2352', lencanaGaris: '#6D5BD0', ikon: '#E2E8F4',
    bilah: '#7C3AED', bilahKini: '#EC4899', bilahKiniGaris: '#F9A8D4',
    pola: 'bintang',
    vonis: { baik: '#34D399', baikLapis: '#0E2A22', perhatian: '#FBBF24', perhatianLapis: '#2B230F', kritis: '#F87171', kritisLapis: '#2C1418' },
    logo: { ubin: '#E2E8F4', isi: '#090B14' },
    sudut: { borderRadius: 16 }, sudutKecil: { borderRadius: 10 },
    // --gradien-para rumahpara.app: hsl(262 78% 60%) → hsl(342 72% 50%)
    gradien: ['#8B5CF6', '#DB2777'],
    fontBawaan: 'sora',
  },
}

/** Domain web circle → tema PDF-nya (pilihan "Otomatis") — satu sumber di gayaLatar.js. */
export { temaDariSitus as temaUntukSitus } from '../gayaLatar'

/**
 * Pilihan font. `m600`/`m700` = kunci metrik judul (pdf/metrikHuruf.js), `angka`
 * = metrik angka besar. Font bawaan PDF (Helvetica/Times) tidak memuat berkas.
 */
export const FONT_PDF = {
  fredoka:   { id: 'fredoka',   nama: 'Fredoka', ket: 'Bulat & ramah — bawaan Playground', judul: 'Fredoka PGE', badan: 'Jakarta PGE', m600: 'fredoka-600', m700: 'fredoka-700', angka: 'jakarta-800' },
  sora:      { id: 'sora',      nama: 'Sora',    ket: 'Geometris modern — huruf rumahpara.app', judul: 'Sora PGE', badan: 'Jakarta PGE', m600: 'sora-600', m700: 'sora-700', angka: 'jakarta-800' },
  jakarta:   { id: 'jakarta',   nama: 'Jakarta', ket: 'Bersih & tegas', judul: 'Jakarta PGE', badan: 'Jakarta PGE', m600: 'jakarta-700', m700: 'jakarta-800', angka: 'jakarta-800', naikkanJudul: true },
  helvetica: { id: 'helvetica', nama: 'Klasik',  ket: 'Helvetica — mirip template Canva', judul: 'Helvetica', badan: 'Helvetica', m600: 'helvetica-700', m700: 'helvetica-700', angka: 'helvetica-700', standar: true },
  times:     { id: 'times',     nama: 'Formal',  ket: 'Times — nuansa dokumen resmi', judul: 'Times-Roman', badan: 'Times-Roman', m600: 'times-700', m700: 'times-700', angka: 'times-700', standar: true },
}

/** Palet satu circle di sebuah tema: aksen = warna circle (slot 1 = tinta → di tema gelap jadi ungu). */
export function paletTema(tema, slotWarna) {
  let aksen = warnaCirclePdf(slotWarna ?? 1)
  // Lingkup tanpa warna circle (ekosistem, slot 1 = tinta) → aksen hiasan tema (ungu Kosmik, toska Ekosistem).
  if ((tema.gelap || tema.bersih) && aksen.toUpperCase() === '#141414') aksen = tema.hias ?? '#7C3AED'
  const lapis = tema.gelap ? campur(aksen, tema.kanvas, 0.7) : campur(aksen, '#FFFFFF', 0.84)
  return { aksen, lapis, teksAksen: teksDi(aksen) }
}

/**
 * Rakit tema siap pakai.
 * @param temaId  'playground' | 'kosmik'
 * @param fontId  'tema' | kunci FONT_PDF
 * @param slotWarna slot warna circle lingkup (1 = tinta / ekosistem)
 * @param skala     pengali ukuran huruf (PILIHAN_UKURAN di gayaLatar.js); teks `pas` tidak ikut
 * @param warnaHuruf hex warna huruf pilihan pemakai — mengganti TINTA & TEKS (judul, angka, isi);
 *                   garis, cap, dan bidang isian tinta tetap milik tema supaya kontrasnya terjaga
 * @param identitas { logoCircle, nama, logoUnit, namaUnit } — logo circle (atau otomatis dari nama) di kop,
 *                  kepala halaman, penutup; logo unit di blok judul sampul (9 Okt 2026)
 */
export function rakitTema({ temaId = 'playground', fontId = 'tema', slotWarna = 1, skala = 1, warnaHuruf = null, identitas = null } = {}) {
  const tema = { ...HIASAN_BAWAAN, ...(TEMA_PDF[temaId] ?? TEMA_PDF.terang) }
  const font = FONT_PDF[fontId] ?? FONT_PDF[tema.fontBawaan] ?? FONT_PDF.fredoka
  const huruf = /^#[0-9A-Fa-f]{6}$/.test(warnaHuruf ?? '') ? warnaHuruf.toUpperCase() : null
  return {
    ...tema, font, palet: paletTema(tema, slotWarna),
    skala: Number(skala) > 0 ? Number(skala) : 1,
    identitas: { logoCircle: null, nama: null, logoUnit: null, namaUnit: null, ...(identitas ?? {}) },
    ...(huruf ? { tinta: huruf, teks: huruf, redup: campur(huruf, tema.kanvas, 0.42) } : {}),
  }
}

export const TemaPdf = createContext(rakitTema())
export const useTema = () => useContext(TemaPdf)

/**
 * Font bawaan PDF (WinAnsi) tidak punya beberapa tanda yang dipakai teks
 * laporan — ganti dengan padanan yang ada supaya tidak keluar huruf acak.
 */
export function rapikanTeks(teks, font) {
  if (!font?.standar || typeof teks !== 'string') return teks
  return teks.replace(/−/g, '–').replace(/[→⇒]/g, '»')
}
