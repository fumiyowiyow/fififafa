import { ECOSYSTEM_NAME } from '../../config/ecosystem'
// PILIHAN TAMPILAN dokumen (Progress Report & SKB) — dipakai DUA pihak: galeri
// di halaman Unduh Laporan (HTML) dan penggambar PDF (components/laporan/pdf/*).
// Berkas ini sengaja TANPA @react-pdf supaya halaman tidak ikut memuat pustaka
// PDF yang berat sebelum tombol unduh ditekan.
//
// Latar dipakai di SAMPUL, PEMBATAS BAGIAN, dan PENUTUP. Halaman isi selalu
// berlatar polos bertema — angka harus terbaca, bukan bersaing dengan hiasan.

export const GAYA_LATAR = [
  // `nama` = tema Terang (gambar gaya kertas, dibuat bersih), `kosmik` = tema Gelap.
  { id: 'kisi',     nama: 'Lingkaran',   kosmik: 'Orbit',        ikon: '📈', ket: 'Lingkaran warna circle. Rapi & tenang.' },
  { id: 'stiker',   nama: 'Stiker',      kosmik: 'Konstelasi',   ikon: '✨', ket: 'Stiker emoji bertebaran. Ceria.' },
  { id: 'stabilo',  nama: 'Sapuan',      kosmik: 'Aurora',       ikon: '🎨', ket: 'Sapuan warna lebar. Berani.' },
  { id: 'halftone', nama: 'Titik-titik', kosmik: 'Debu Bintang', ikon: '💡', ket: 'Pola titik di pojok. Seru.' },
  { id: 'kapur',    nama: 'Papan Gelap', kosmik: 'Nebula',       ikon: '🚀', ket: 'Latar gelap, huruf terang. Dramatis.' },
  { id: 'warna',    nama: 'Blok Warna',  kosmik: 'Gradasi',      ikon: '🎯', ket: 'Satu bidang warna penuh, kartu judul.' },
]

export const GAYA_BAWAAN = 'kisi'
/** Gaya khusus foto unggahan sendiri — bukan bagian galeri gaya. */
export const GAYA_FOTO = 'foto'

/** SAMPUL WEEKLY REPORT (arahan Owner 11 Okt 2026) — dibedakan dari Monthly: setiap gaya
 *  memajang FOTO PROFIL UNIT (Studio.logoUrl; logo otomatis ubin warna circle + inisial bila
 *  belum diunggah). Tanpa deret W1–W5 (Owner: "gausah pakai w1, w2"). `dasar` = gaya latar yang dipakai halaman
 *  penutup supaya tetap senada. */
export const GAYA_MINGGUAN = [
  { id: 'mg-profil',   nama: 'Kartu Profil', kosmik: 'Kartu Profil', ikon: '🪪', dasar: 'kisi',     ket: 'Foto profil besar di kartu kiri, judul di kanan.' },
  { id: 'mg-poster',   nama: 'Poster Pop',   kosmik: 'Poster Pop',   ikon: '💥', dasar: 'warna',    ket: 'Bidang warna penuh, bintang ledak & pita miring. Paling mencolok.' },
  { id: 'mg-komik',    nama: 'Komik',        kosmik: 'Komik',        ikon: '💬', dasar: 'halftone', ket: 'Titik halftone + balon kata dari foto profil.' },
  { id: 'mg-stiker',   nama: 'Stiker Ceria', kosmik: 'Stiker Ceria', ikon: '✨', dasar: 'stiker',   ket: 'Foto profil miring dikelilingi stiker emoji.' },
  { id: 'mg-kalender', nama: 'Kalender',     kosmik: 'Kalender',     ikon: '🗓', dasar: 'kisi',     ket: 'Kalender bulan itu, minggu berjalan disorot.' },
  { id: 'mg-lencana',  nama: 'Lencana',      kosmik: 'Lencana',      ikon: '🏅', dasar: 'stiker',   ket: 'Foto profil bulat di tengah, simetris & tenang.' },
  { id: 'mg-pita',     nama: 'Pita Minggu',  kosmik: 'Pita Minggu',  ikon: '🎀', dasar: 'stabilo',  ket: 'Pita warna circle, foto profil menindih tepinya.' },
]
export const GAYA_MINGGUAN_BAWAAN = 'mg-profil'
/** Gaya latar untuk penutup Weekly (gaya sampul Weekly → gaya latar umum). */
export const dasarMingguan = (gaya) => GAYA_MINGGUAN.find(g => g.id === gaya)?.dasar ?? gaya

/** Tata letak foto sendiri (sampul & penutup). */
export const TATA_FOTO = [
  { id: 'bingkai',  nama: 'Bingkai',       ket: 'Foto berbingkai, judul di stiker' },
  { id: 'gelap',    nama: 'Penuh Gelap',   ket: 'Foto penuh, ditiban hitam 50%' },
  { id: 'gradasi',  nama: 'Penuh Gradasi', ket: 'Foto penuh, gelap bertahap ke bawah' },
  { id: 'warna',    nama: 'Warna Circle',  ket: 'Foto penuh, ditiban warna circle' },
  { id: 'belah',    nama: 'Belah Dua',     ket: 'Judul di kiri, foto di kanan' },
  { id: 'polaroid', nama: 'Polaroid',      ket: 'Foto miring berbingkai putih' },
]
export const TATA_FOTO_BAWAAN = 'bingkai'

/** Tema dokumen (Ekosistem, 13 Okt 2026). Id internal tetap 'kosmik' / 'playground' (warisan modul
 *  asal di playgroundecos.app), namanya disesuaikan: tema gelap-ungu senada aplikasi Ekosistem jadi
 *  bawaan, tema kertas terang tetap ada sebagai pilihan. */
export const PILIHAN_TEMA = [
  { id: 'terang', nama: 'Terang', ket: 'Putih bersih, aksen toska — hemat tinta kalau dicetak' },
  { id: 'gelap',  nama: 'Gelap',  ket: 'Arang & toska — enak untuk presentasi di layar' },
]
export const TEMA_BAWAAN = 'terang'
export const NAMA_TEMA = { terang: `${ECOSYSTEM_NAME} Terang`, gelap: `${ECOSYSTEM_NAME} Gelap`, playground: 'Kertas', kosmik: 'Kosmik' }

/** Pilihan font (kunci = FONT_PDF di pdf/tema.js + "tema"). Keluarga "… PGE" =
 *  TTF yang sama dengan PDF, didaftarkan untuk pratinjau oleh fontPratinjau.js. */
export const PILIHAN_FONT = [
  { id: 'tema',      nama: 'Ikut Tema', css: null,                                          ket: 'Jakarta — bersih & tegas' },
  { id: 'fredoka',   nama: 'Fredoka',   css: "'Fredoka PGE', 'Fredoka', sans-serif",       ket: 'Bulat & ramah' },
  { id: 'sora',      nama: 'Sora',      css: "'Sora PGE', 'Sora', sans-serif",             ket: 'Geometris modern' },
  { id: 'jakarta',   nama: 'Jakarta',   css: "'Jakarta PGE', 'Plus Jakarta Sans', sans-serif", ket: 'Bersih & tegas' },
  { id: 'helvetica', nama: 'Klasik',    css: 'Helvetica, Arial, sans-serif',               ket: 'Netral seperti template Canva' },
  { id: 'times',     nama: 'Formal',    css: "'Times New Roman', Times, serif",            ket: 'Nuansa dokumen resmi' },
]
export const FONT_BAWAAN = 'tema'

/** Ukuran huruf seluruh dokumen (arahan Owner 9 Okt 2026) — skala; judul/angka yang sudah
 *  dipaskan ke lebar bidangnya tidak ikut (lihat prop `pas` di pdf/primitif.jsx). */
export const PILIHAN_UKURAN = [
  { id: 'ringkas', nama: 'Ringkas', skala: 0.94, ket: 'Lebih padat' },
  { id: 'normal',  nama: 'Normal',  skala: 1,    ket: 'Bawaan' },
  { id: 'besar',   nama: 'Besar',   skala: 1.07, ket: 'Lebih mudah dibaca' },
]
export const UKURAN_BAWAAN = 'normal'
export const skalaUkuran = (id) => PILIHAN_UKURAN.find(u => u.id === id)?.skala ?? 1

/** Warna huruf (tinta judul & teks isi) per tema; 'tema' = bawaan, 'kustom' = pilih sendiri. */
export const WARNA_HURUF = {
  terang: [
    { id: 'tema',   nama: 'Abu Tua', hex: null },
    { id: 'hitam',  nama: 'Hitam',   hex: '#1F2328' },
    { id: 'toska',  nama: 'Toska',   hex: '#087F7C' },
    { id: 'dongker',nama: 'Dongker', hex: '#1E3A8A' },
    { id: 'hutan',  nama: 'Hutan',   hex: '#14532D' },
    { id: 'bata',   nama: 'Bata',    hex: '#7C2D12' },
  ],
  gelap: [
    { id: 'tema',   nama: 'Putih',   hex: null },
    { id: 'toska',  nama: 'Toska',   hex: '#9FE9E6' },
    { id: 'krem',   nama: 'Krem',    hex: '#FDE68A' },
    { id: 'langit', nama: 'Langit',  hex: '#BAE6FD' },
    { id: 'mint',   nama: 'Mint',    hex: '#A7F3D0' },
    { id: 'pink',   nama: 'Pink',    hex: '#FBCFE8' },
  ],
  playground: [
    { id: 'tema',    nama: 'Tinta',   hex: null },
    { id: 'dongker', nama: 'Dongker', hex: '#1E3A8A' },
    { id: 'ungu',    nama: 'Ungu',    hex: '#4C1D95' },
    { id: 'hutan',   nama: 'Hutan',   hex: '#14532D' },
    { id: 'bata',    nama: 'Bata',    hex: '#7C2D12' },
    { id: 'arang',   nama: 'Arang',   hex: '#3F3F46' },
  ],
  kosmik: [
    { id: 'tema',     nama: 'Putih',    hex: null },
    { id: 'krem',     nama: 'Krem',     hex: '#FDE68A' },
    { id: 'lavender', nama: 'Lavender', hex: '#DDD6FE' },
    { id: 'mint',     nama: 'Mint',     hex: '#A7F3D0' },
    { id: 'langit',   nama: 'Langit',   hex: '#BAE6FD' },
    { id: 'pink',     nama: 'Pink',     hex: '#FBCFE8' },
  ],
}
export const WARNA_BAWAAN = 'tema'
// Kanvas tiap tema (cermin TEMA_PDF[..].kanvas di pdf/tema.js) untuk cek kontras — tidak diimpor
// dari sana supaya tidak melingkar (tema.js mengimpor temaDariSitus dari berkas ini).
const KANVAS_TEMA = { terang: '#F7F7F7', gelap: '#121416', playground: '#F4F4F1', kosmik: '#090B14' }
const HEX_SAH = /^#[0-9a-f]{6}$/i
/** Hex warna huruf efektif — null = ikut tema. */
export function warnaHurufHex(warna, temaId, warnaKustom) {
  if (warna === 'kustom') return HEX_SAH.test(warnaKustom ?? '') ? warnaKustom.toUpperCase() : null
  return (WARNA_HURUF[temaId] ?? WARNA_HURUF.terang).find(w => w.id === warna)?.hex ?? null
}
const luminansi = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Rasio kontras huruf terhadap kanvas tema (WCAG); < 3 = sulit dibaca. null bila hex tak sah. */
export function kontrasHuruf(hex, temaId) {
  if (!HEX_SAH.test(hex ?? '')) return null
  const a = luminansi(hex), b = luminansi(KANVAS_TEMA[temaId] ?? KANVAS_TEMA.terang)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
// Font "Ikut Tema" per tema (cermin TEMA_PDF[..].fontBawaan di pdf/tema.js).
const FONT_TEMA = { terang: 'jakarta', gelap: 'jakarta', playground: 'fredoka', kosmik: 'sora' }

/** Keluarga CSS untuk pratinjau sampul: pilihan font × tema efektif. */
export function cssFont(fontId, temaId) {
  const id = fontId === 'tema' || !fontId ? (FONT_TEMA[temaId] ?? 'fredoka') : fontId
  return PILIHAN_FONT.find(f => f.id === id)?.css ?? null
}

/** SKB untuk Studio, SKP untuk Project (arahan Owner 11 Okt 2026). */
export const studiKelayakan = (tipe) => (tipe === 'PROJECT'
  ? { singkat: 'SKP', panjang: 'Studi Kelayakan Project' }
  : { singkat: 'SKB', panjang: 'Studi Kelayakan Bisnis' })

/** Halaman Weekly Report yang bisa dimatikan (sampul & penutup selalu ada). */
export const ISI_MINGGUAN = [
  { id: 'forecasting', nama: 'Financial Forecasting', ikon: '🧾' },
  { id: 'overview', nama: 'Financial Overview', ikon: '🏦' },
  { id: 'omset', nama: 'Progres Omset', ikon: '📈' },
  { id: 'renstra', nama: 'Renstra / KPI', ikon: '🎯' },
  { id: 'potensi', nama: 'Potensi Pendapatan', ikon: '📋' },
  { id: 'tim', nama: 'Team per Orang', ikon: '👥' },
]
export const ISI_MINGGUAN_BAWAAN = Object.fromEntries(ISI_MINGGUAN.map(i => [i.id, true]))

/** Isi laporan yang bisa dinyalakan/dimatikan pemakai. */
export const ISI_LAPORAN = [
  { id: 'tokoh',    nama: 'Leader & Key Person', ikon: '👥' },
  { id: 'unit',     nama: 'Laporan per Unit',    ikon: '🎨' },
  { id: 'rincian',  nama: 'Rincian Pengeluaran', ikon: '🧾' },
]

/** Domain web circle → tema (cermin TEMA_WEB di pdf/tema.js, untuk pratinjau HTML). */
export function temaDariSitus(situs) {
  const host = String(situs ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return host === 'rumahpara.app' ? 'kosmik' : null
}

/** Tema efektif dari pilihan pengguna + situs lingkup. */
// Pilihan lama yang mungkin masih tersimpan di peramban (kosmik / playground / otomatis dari
// modul asal) dipetakan ke tema Ekosistem yang senada: gelap → Gelap, selain itu → Terang.
export const temaEfektif = (pilihan) => (pilihan === 'gelap' || pilihan === 'kosmik' ? 'gelap' : 'terang')
