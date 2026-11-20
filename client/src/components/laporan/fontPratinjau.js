// HURUF PRATINJAU — sampul HTML memakai berkas TTF yang SAMA dengan PDF
// (src/assets/font-pdf) supaya pratinjau = hasil cetak di kedua web: kulit
// rumahpara.app tidak memuat Fredoka, kulit PGE memuat Sora versi lain.
// FontFace tanpa .load() = diunduh peramban hanya saat hurufnya benar-benar tampil.
import fredoka600 from '../../assets/font-pdf/fredoka-pge-600.ttf?url'
import fredoka700 from '../../assets/font-pdf/fredoka-pge-700.ttf?url'
import sora600 from '../../assets/font-pdf/sora-pge-600.ttf?url'
import sora700 from '../../assets/font-pdf/sora-pge-700.ttf?url'
import jakarta700 from '../../assets/font-pdf/jakarta-pge-700.ttf?url'
import jakarta800 from '../../assets/font-pdf/jakarta-pge-800.ttf?url'

const DAFTAR = [
  ['Fredoka PGE', fredoka600, '600'], ['Fredoka PGE', fredoka700, '700'],
  ['Sora PGE', sora600, '600'], ['Sora PGE', sora700, '700'],
  ['Jakarta PGE', jakarta700, '700'], ['Jakarta PGE', jakarta800, '800'],
]
let terdaftar = false

export function daftarkanFontPratinjau() {
  if (terdaftar || typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return
  terdaftar = true
  for (const [keluarga, src, weight] of DAFTAR) {
    try { document.fonts.add(new FontFace(keluarga, `url("${src}")`, { weight, display: 'swap' })) } catch { /* pratinjau tetap jalan dengan huruf cadangan */ }
  }
}
