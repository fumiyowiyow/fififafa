// PENYUSUN DOKUMEN PDF di peramban — satu pintu untuk Progress Report (halaman
// Unduh Laporan & Rekap Bulanan) dan SKB: ambil data → muat react-pdf + dokumen
// (impor dinamis, pustakanya berat) → render → Blob + nama berkas.
import api from '../../services/api'
import { ambilPreferensi, ambilFotoSampul, ambilFotoTerpilih } from './fotoSampul'
import {
  GAYA_LATAR, GAYA_BAWAAN, GAYA_FOTO, TATA_FOTO, TATA_FOTO_BAWAAN, PILIHAN_TEMA, TEMA_BAWAAN,
  PILIHAN_FONT, FONT_BAWAAN, temaEfektif, ISI_MINGGUAN_BAWAAN,
  PILIHAN_UKURAN, UKURAN_BAWAAN, WARNA_BAWAAN, skalaUkuran, warnaHurufHex, studiKelayakan,
  GAYA_MINGGUAN, GAYA_MINGGUAN_BAWAAN,
} from './gayaLatar'

// Halaman Rincian Pengeluaran dimatikan dulu (arahan 1 Nov 2026); tetap tersedia sebagai pilihan "Isi laporan".
export const ISI_BAWAAN = { tokoh: true, unit: true, rincian: false }
// Naikkan angka ini bila bawaan ISI_BAWAAN diubah dan pilihan lama di peramban harus ikut diganti.
export const ISI_VERSI = 2

/** Panaskan pustaka PDF lebih awal (saat pengguna mulai memilih) supaya unduhan terasa cepat. */
// Ekosistem (13 Okt 2026): Progress Report & Weekly Report dipindah dari playgroundecos.app; SKB
// (SkbPDF) belum -- fungsi penyusunnya sengaja belum ada di berkas ini.
export function panaskanPdf(dok = 'laporan') {
  import('@react-pdf/renderer').catch(() => {})
  if (dok === 'mingguan') import('./LaporanMingguanPDF').catch(() => {})
  else import('./ProgressReportPDF').catch(() => {})
}

// Nilai dari localStorage bisa usang/rusak → hanya id yang masih dikenal yang dipakai.
const sah = (daftar, v, bawaan) => (daftar.some(x => x.id === v) ? v : bawaan)

/** Tampilan terakhir yang dipakai di peramban ini (Rekap Bulanan & tombol SKB di Bio
 *  Unit ikut memakainya). Foto sendiri ikut terpakai bila `kunciFoto` punya foto
 *  tersimpan. SKB menyimpan pilihannya sendiri (p.skb), awalnya mewarisi Progress Report. */
export function pilihanTerakhir(kunciFoto = null, dok = 'laporan') {
  const semua = ambilPreferensi() ?? {}
  // SKB & Weekly Report menyimpan pilihannya sendiri (p.skb / p.mingguan), awalnya mewarisi Progress Report.
  const p = dok === 'skb' || dok === 'mingguan' ? { ...semua, ...(semua[dok] ?? {}) } : semua
  // Weekly Report punya gaya sampul sendiri (berfoto profil unit, Owner 11 Okt 2026).
  const gayaLatar = dok === 'mingguan'
    ? sah(GAYA_MINGGUAN, semua.mingguan?.gayaLatar, GAYA_MINGGUAN_BAWAAN)
    : sah(GAYA_LATAR, p.gayaLatar ?? p.gaya, GAYA_BAWAAN)
  const pakaiFoto = p.pakaiFoto ?? p.gaya === GAYA_FOTO
  const foto = pakaiFoto && kunciFoto ? ambilFotoSampul(kunciFoto) : null
  return {
    gaya: foto ? GAYA_FOTO : gayaLatar,
    gayaLatar, pakaiFoto, foto,
    tema: sah(PILIHAN_TEMA, p.tema, TEMA_BAWAAN),
    font: sah(PILIHAN_FONT, p.font, FONT_BAWAAN),
    tataFoto: sah(TATA_FOTO, p.tataFoto, TATA_FOTO_BAWAAN),
    ukuran: sah(PILIHAN_UKURAN, p.ukuran, UKURAN_BAWAAN),
    warna: typeof p.warna === 'string' && p.warna ? p.warna : WARNA_BAWAAN,
    warnaKustom: /^#[0-9a-f]{6}$/i.test(p.warnaKustom ?? '') ? p.warnaKustom : null,
    isi: dok === 'mingguan' ? { ...ISI_MINGGUAN_BAWAAN, ...(semua.mingguan?.isi ?? {}) }
      // Pilihan tersimpan versi lama: "rincian" lama diabaikan (bawaan baru = mati); pilihan lain tetap.
      : { ...ISI_BAWAAN, ...(p.isiVersi === ISI_VERSI ? (p.isi ?? {}) : (({ rincian, ...lain }) => lain)(p.isi ?? {})) },
  }
}

/** Sama dengan pilihanTerakhir, tetapi foto terpilih diambil dari galeri server bila peramban
 *  ini belum menyimpan salinannya (mis. diunggah dari perangkat lain) — untuk tombol Bio Unit. */
export async function pilihanTerakhirLengkap(kunciFoto = null, dok = 'laporan') {
  const p = pilihanTerakhir(kunciFoto, dok)
  if (p.pakaiFoto && kunciFoto && !p.foto) {
    const foto = await ambilFotoTerpilih(kunciFoto)
    if (foto) { p.foto = foto; p.gaya = GAYA_FOTO }
  }
  return p
}

const bersih = (s) => String(s ?? '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')

export function namaBerkasLaporan(data) {
  return `${bersih(data.lingkup.nama)}-Progress-Report-${bersih(data.labelBulan)}.pdf`
}

/**
 * @param lingkup 'ekosistem' | 'circle:<id>' | 'rumah-usaha:<id>'
 * @param tema    'playground' | 'otomatis'  (otomatis → ikut Circle.situs)
 * @param font    'tema' | fredoka | sora | jakarta | helvetica | times
 * @param gaya    id gaya latar (gayaLatar.js) atau 'foto' (+ tataFoto, foto = data URL JPEG)
 * @param isi     { tokoh, unit, rincian }
 * -> { blob, namaFile, data }
 */
export async function ambilDataProgres({ lingkup, bulan, tahun, rinci = true }) {
  const q = new URLSearchParams({ bulan: String(bulan), tahun: String(tahun), lingkup, rinci: rinci ? '1' : '0' })
  const res = await api.get(`/api/reports/progres?${q}`)
  return res.data.data
}

/** `data` (opsional) = hasil ambilDataProgres yang sudah dipegang — Pratinjau Langsung menyusun
 *  ulang tanpa ambil ulang ke server setiap kali tampilan berubah. */
export async function buatProgressReport({ lingkup, bulan, tahun, tema = TEMA_BAWAAN, font = FONT_BAWAAN, ukuran = UKURAN_BAWAAN, warna = WARNA_BAWAAN, warnaKustom = null, gaya = GAYA_BAWAAN, tataFoto = TATA_FOTO_BAWAAN, foto = null, isi = ISI_BAWAAN, data: dataSiap = null }) {
  const [data, { pdf }, { default: ProgressReportPDF }] = await Promise.all([
    dataSiap ?? ambilDataProgres({ lingkup, bulan, tahun, rinci: isi.rincian }),
    import('@react-pdf/renderer'),
    import('./ProgressReportPDF'),
  ])
  const blob = await pdf(
    <ProgressReportPDF data={data} tema={temaEfektif(tema, data.lingkup.situs)} font={font} skala={skalaUkuran(ukuran)} warnaHuruf={warnaHurufHex(warna, temaEfektif(tema, data.lingkup.situs), warnaKustom)}
      gaya={gaya === GAYA_FOTO && !foto ? GAYA_BAWAAN : gaya} tataFoto={tataFoto} foto={foto} isi={isi} />
  ).toBlob()
  return { blob, namaFile: namaBerkasLaporan(data), data }
}

/** Data Weekly Report satu unit satu bulan (controllers/laporanMingguan.js). */
export async function ambilDataMingguan({ studioId, bulan, tahun, rinciGaji = false, ringkas = false }) {
  const q = new URLSearchParams({ studioId, bulan: String(bulan), tahun: String(tahun) })
  if (rinciGaji) q.set('gaji', '1')
  if (ringkas) q.set('ringkas', '1')
  const res = await api.get(`/api/reports/mingguan?${q}`)
  return res.data.data
}

/**
 * Weekly Report satu unit (arahan Owner 8 Okt 2026, acuan Weekly Report Zanshin/Vahcyn).
 * @param renstra   { produksi, marketing, finance, sdm } teks per kategori (satu baris = satu butir)
 * @param rinciGaji true = dokumen INTERNAL: gaji per orang dirinci (server memeriksa hak pengurus)
 * -> { blob, namaFile, data }
 */
export async function buatLaporanMingguan({ studioId, bulan, tahun, tema = TEMA_BAWAAN, font = FONT_BAWAAN, ukuran = UKURAN_BAWAAN, warna = WARNA_BAWAAN, warnaKustom = null, gaya = GAYA_MINGGUAN_BAWAAN, tataFoto = TATA_FOTO_BAWAAN, foto = null, renstra = {}, isi = null, kustom = {}, rinciGaji = false, data: dataSiap = null }) {
  const [data, { pdf }, { default: LaporanMingguanPDF }] = await Promise.all([
    dataSiap ?? ambilDataMingguan({ studioId, bulan, tahun, rinciGaji }),
    import('@react-pdf/renderer'),
    import('./LaporanMingguanPDF'),
  ])
  const blob = await pdf(
    <LaporanMingguanPDF data={data} tema={temaEfektif(tema, data.lingkup?.situs)} font={font} skala={skalaUkuran(ukuran)} warnaHuruf={warnaHurufHex(warna, temaEfektif(tema, data.lingkup?.situs), warnaKustom)}
      gaya={gaya === GAYA_FOTO && !foto ? GAYA_MINGGUAN_BAWAAN : gaya} tataFoto={tataFoto} foto={foto}
      renstra={renstra} isi={isi ?? undefined} kustom={kustom} />
  ).toBlob()
  return { blob, namaFile: `${bersih(data.unit.nama)}-Weekly-Report-${bersih(data.labelBulan)}.pdf`, data }
}

export function unduhBlob(blob, namaFile) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
