// Kartu Raport Siswa di Unduh Laporan (13 Okt 2026). Sejak 22 Okt 2026 raport pindah ke Jalur Tumbuh
// (tumbuh.kariranak.com): kartu ini hanya pemberitahuan + tautan, tampil untuk pemakai yang mengelola/membimbing siswa.
import { useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { kuartalSekarang } from '../../utils/raport'
import PindahKeTumbuh from '../Raport/PindahKeTumbuh'

export default function KartuRaportSiswa() {
  const periode = kuartalSekarang()
  const { data, loading } = useApi(`/api/raport/siswa?tahun=${periode.tahun}&kuartal=${periode.kuartal}`, [periode.tahun, periode.kuartal])
  const daftar = useMemo(() => (data ?? []).filter(x => x.hak !== 'siswa'), [data])

  // Pemakai yang tidak mengelola/membimbing siswa mana pun tidak perlu kartu ini.
  if (loading || !daftar.length) return null

  // Raport pindah ke Jalur Tumbuh (22 Okt 2026): kartu ini tinggal pemberitahuan + tautan, hanya untuk yang dulu melihatnya.
  return <PindahKeTumbuh ringkas />
}
