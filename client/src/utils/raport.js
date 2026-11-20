// Raport siswa Vokasi/KBU (13 Okt 2026) — label bersama halaman SDM › Raport & PDF-nya.
// Format mengikuti raport Karir Anak yang sudah berjalan (contoh: raport Vokasi Dhea & KBU Nanda,
// periode Juni–Agustus 2026). Semua skor 1–10.

export const LABEL_PROGRAM = { SISWA_VOKASI: 'Siswa Vokasi', SISWA_KBU: 'Siswa KBU' }

export const JUDUL_PROGRAM = {
  SISWA_VOKASI: 'Perkembangan Peserta Program Vokasi',
  SISWA_KBU: 'Peserta Program Kelompok Belajar Usaha',
}

export const PENDAHULUAN = {
  SISWA_VOKASI: [
    'Karir Anak merupakan program pengembangan kompetensi bagi peserta didik Paket C yang dirancang untuk menjawab kebutuhan dunia industri digital yang terus berkembang. Program ini hadir sebagai upaya mengurangi kesenjangan antara lulusan pendidikan kesetaraan dengan kebutuhan dunia kerja melalui pembelajaran berbasis praktik, proyek, kreativitas, dan pengalaman industri.',
    'Program ini bertujuan menciptakan lulusan yang mandiri, kompeten, kreatif, dan berdaya saing, dengan memiliki kompetensi dan portofolio yang relevan dengan standar industri digital sehingga mampu bekerja, berkarya, maupun menciptakan peluang secara mandiri.',
  ],
  SISWA_KBU: [
    'Program KBU dirancang sebagai wadah bagi peserta didik untuk memperoleh pengalaman nyata dalam menjalankan sebuah usaha. Melalui fasilitas yang disediakan dan pendampingan langsung dari praktisi, peserta didik tidak hanya mempelajari teori kewirausahaan, tetapi juga terlibat langsung dalam proses menjalankan usaha.',
    'Program ini bertujuan membangun kemandirian, kompetensi, kreativitas, dan jiwa kewirausahaan, sehingga peserta didik memiliki pengalaman dan kemampuan untuk menciptakan serta mengembangkan peluang usaha secara berkelanjutan.',
  ],
}

// 12 aspek Perkembangan Personal — urutan = urutan cetak (kolom kiri 6, kanan 6).
export const PERSONAL = [
  { kunci: 'kedisiplinan', label: 'Kedisiplinan' },
  { kunci: 'kejujuran', label: 'Kejujuran' },
  { kunci: 'kolaborasi', label: 'Kolaborasi' },
  { kunci: 'tanggungJawab', label: 'Tanggung Jawab' },
  { kunci: 'inisiatif', label: 'Inisiatif' },
  { kunci: 'analisisMasalah', label: 'Analisis Masalah' },
  { kunci: 'pemecahanMasalah', label: 'Pemecahan Masalah' },
  { kunci: 'kebersihan', label: 'Kebersihan' },
  { kunci: 'kerapian', label: 'Kerapian' },
  { kunci: 'kerajinan', label: 'Kerajinan' },
  { kunci: 'ketelitian', label: 'Ketelitian' },
  { kunci: 'kreativitas', label: 'Kreativitas' },
]
export const LABEL_PERSONAL = Object.fromEntries(PERSONAL.map(p => [p.kunci, p.label]))

// Template daftar kompetensi Perkembangan Teknis (dari contoh raport) — mentor bisa ubah bebas.
export const TEMPLATE_TEKNIS = {
  '3D / Animasi': ['Literasi Visual', 'Pemahaman Tools', 'Modeling', 'Texture', 'Sculpting', 'Rigging', 'Kecepatan Eksekusi', 'Attention to Detail', 'Kreativitas', 'Kualitas Hasil Karya'],
  'Ilustrasi': ['Literasi Visual', 'Pemahaman Tools', 'Anatomi & Gestur', 'Komposisi', 'Pewarnaan', 'Rendering', 'Kecepatan Eksekusi', 'Attention to Detail', 'Kreativitas', 'Kualitas Hasil Karya'],
  'Market / Usaha': ['Pemahaman Market', 'Product Knowledge', 'Content', 'Customer Service', 'Maintenance Akun', 'Follow Up', 'Riset Market', 'Analisis Market', 'Strategi Market', 'Komunikasi Market'],
}

export const CATATAN_LAMPIRAN = 'Mohon untuk tidak mempublikasikan karya karena art yang digunakan adalah sepenuhnya aset milik studio pengampu siswa'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const namaBulan = (b) => BULAN[b - 1]
const ROMAWI = ['I', 'II', 'III', 'IV']

/** "Triwulan III 2026" */
export const labelTriwulan = (tahun, kuartal) => `Triwulan ${ROMAWI[kuartal - 1]} ${tahun}`
/** "Juli – September 2026" */
export const rentangTriwulan = (tahun, kuartal) => `${BULAN[(kuartal - 1) * 3]} – ${BULAN[kuartal * 3 - 1]} ${tahun}`
/** Nama 3 bulan periode itu: ['Juli', 'Agustus', 'September'] */
export const bulanTriwulan = (kuartal) => [0, 1, 2].map(i => BULAN[(kuartal - 1) * 3 + i])
/** Periode berikutnya (untuk Renstra Selanjutnya). */
export const bulanTriwulanBerikut = (kuartal) => bulanTriwulan((kuartal % 4) + 1)

export function kuartalSekarang(d = new Date()) {
  return { tahun: d.getFullYear(), kuartal: Math.floor(d.getMonth() / 3) + 1 }
}

export function geserKuartal({ tahun, kuartal }, langkah) {
  const n = tahun * 4 + (kuartal - 1) + langkah
  return { tahun: Math.floor(n / 4), kuartal: (n % 4) + 1 }
}

export function tanggalPanjang(d) {
  if (!d) return null
  const t = new Date(d)
  return `${t.getUTCDate()} ${BULAN[t.getUTCMonth()]} ${t.getUTCFullYear()}`
}

/** Kecilkan foto di peramban sebelum diunggah (pola FotoSampul) → data URL JPEG. */
export function kecilkanFoto(file, maks = 1600, mutu = 0.82) {
  return new Promise((selesai, gagal) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const skala = Math.min(1, maks / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * skala); c.height = Math.round(img.height * skala)
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      selesai(c.toDataURL('image/jpeg', mutu))
    }
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Berkas bukan gambar')) }
    img.src = url
  })
}

/** Nama mentor raport sebagai daftar — identitas lama (sebelum mentor ganda) menyimpan satu nama. */
export const daftarMentor = (m) => (Array.isArray(m) ? m : m ? [m] : []).map(x => (typeof x === 'string' ? x : x?.nama)).filter(Boolean)
