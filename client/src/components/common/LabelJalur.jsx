import { ECOSYSTEM_NAME } from '../../config/ecosystem'
// Penanda jalur angka uang (1 Nov 2026) -- selama mode bayangan ada dua jalur pencatatan:
//   resmi    = masuk Laporan Omset / laporan Ekosistem (Pengeluaran, Kas rekening, Biaya rutin/CPM, Omzet laporan)
//   bayangan = uji coba web circle, BELUM masuk laporan (Biaya, Kas akhir buku besar, Item tetap, Omzet order)
// Kamus istilah lengkap: openspec.md § KAMUS ISTILAH UANG. Hanya dipakai di Ekosistem -- web circle tidak diubah.
const JALUR = {
  resmi:    { cls: 'success', teks: 'Resmi',    arti: `Masuk laporan ${ECOSYSTEM_NAME}` },
  bayangan: { cls: 'warning', teks: 'Bayangan', arti: `Uji coba web circle, belum masuk laporan ${ECOSYSTEM_NAME}` },
}

export default function LabelJalur({ jenis = 'resmi', style }) {
  const j = JALUR[jenis]
  return <span className={`badge ${j.cls}`} title={j.arti} style={{ fontSize: 10, verticalAlign: 'middle', ...style }}>{j.teks}</span>
}
