// Unduh PDF raport siswa versi TERSIMPAN (13 Okt 2026) — dipakai kartu Raport Siswa di Unduh
// Laporan. Editor di SDM › Raport Siswa punya jalurnya sendiri karena ikut mencetak isian yang
// belum disimpan.
import api from '../../services/api'
import { unduhBlob } from './buatProgressReport'

export async function unduhRaportSiswa(userId, { tahun, kuartal }) {
  const q = `tahun=${tahun}&kuartal=${kuartal}`
  const [r, lamp, { buatRaportPdf }] = await Promise.all([
    api.get(`/api/raport/${userId}?${q}`),
    api.get(`/api/raport/${userId}/lampiran?${q}`),
    import('./RaportPDF'),
  ])
  const d = r.data.data
  if (!d.raport) throw new Error('Raport periode ini belum dibuat')
  const blob = await buatRaportPdf({ tahun, kuartal, identitas: d.identitas, foto: d.foto, raport: d.raport, lampiran: lamp.data.data ?? [] })
  const terbit = d.raport.status === 'TERBIT'
  const nama = (d.identitas?.nama ?? 'Siswa').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  unduhBlob(blob, `Raport-${nama}-${tahun}-T${kuartal}${terbit ? '' : '-DRAFT'}.pdf`)
}
