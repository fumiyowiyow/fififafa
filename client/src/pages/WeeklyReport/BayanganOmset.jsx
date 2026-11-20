import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatUSD } from '../../utils/format'
import LabelJalur from '../../components/common/LabelJalur'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tanda = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + formatUSD(n))
const warna = (s, acuan) => (s == null ? 'var(--text-muted)' : Math.abs(s) <= Math.max(1, Math.abs(acuan ?? 0) * 0.05) ? 'var(--green)' : 'var(--orange, #d97706)')

// OMZET BAYANGAN (21 Okt 2026): omzet dari ORDER web circle berdampingan dengan Laporan Omset resmi, per periode laporan.
// Hanya tampilan (tidak menulis laporan) — jembatan sebelum Laporan Omset diisi otomatis dari order. Server: GET /api/weekly-reports/bayangan.
export default function BayanganOmset({ studios = [], bulan, tahun }) {
  const [pilihan, setStudioId] = useState('')
  const studioId = pilihan || studios[0]?.id || '' // daftar unit bisa datang belakangan (status minggu dimuat async)
  const { data, loading, error } = useApi(studioId ? `/api/weekly-reports/bayangan?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}` : null, [studioId, bulan, tahun])
  if (!studios.length) return null
  const lbl = (b) => `${new Date(b.periodeAwal + 'T00:00:00Z').getUTCDate()}–${new Date(b.periodeAkhir + 'T00:00:00Z').getUTCDate()} ${MONTHS[bulan - 1]}`
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="card-title">Omzet order (web circle) · {MONTHS[bulan - 1]} {tahun} <LabelJalur jenis="bayangan" style={{ marginLeft: 6 }} /></span>
        <select className="form-input" style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }} value={studioId} onChange={e => setStudioId(e.target.value)}>
          {studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Tampilan bayangan — <b>tidak mengubah laporan</b>. Omzet dari order yang dicatat di web circle (tanggal masuk, tanpa order batal) dibandingkan dengan Laporan Omset per periode. Ditampilkan nilai kotor dan bersih (setelah fee akun jualan). Bila selisihnya kecil & konsisten, laporan bisa nanti diisi otomatis dari order.
        </div>
        {loading ? <div className="spinner" /> : error ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{error}</div> : data && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
              <div>Laporan Omset: <b>{formatUSD(data.total.laporanUsd)}</b> <span style={{ color: 'var(--text-muted)' }}>({data.total.periodeBerlaporan}/{data.total.jumlahPeriode} periode)</span></div>
              <div>Order kotor: <b>{formatUSD(data.total.orderKotorUsd)}</b> <span style={{ color: warna(data.total.selisihKotor, data.total.laporanUsd) }}>{tanda(data.total.selisihKotor)}</span></div>
              <div>Order bersih: <b>{formatUSD(data.total.orderBersihUsd)}</b> <span style={{ color: warna(data.total.selisihBersih, data.total.laporanUsd) }}>{tanda(data.total.selisihBersih)}</span></div>
              <div>{data.total.jumlahOrder} order{data.total.internal.jumlah ? ` (+${data.total.internal.jumlah} internal, tidak dibandingkan)` : ''}</div>
            </div>
            <div className="table-wrap responsive-table">
              <table>
                <thead><tr><th>Periode</th><th style={{ textAlign: 'right' }}>Laporan</th><th style={{ textAlign: 'right' }}>Order kotor</th><th style={{ textAlign: 'right' }}>Order bersih</th><th style={{ textAlign: 'right' }}>Selisih kotor / bersih</th></tr></thead>
                <tbody>
                  {data.periode.map(b => (
                    <tr key={b.periodeAwal}>
                      <td style={{ fontWeight: 600 }}>{lbl(b)}<div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{b.jumlahOrder} order · kurs {Math.round(b.kurs).toLocaleString('id-ID')}</div></td>
                      <td style={{ textAlign: 'right' }}>{b.adaLaporan ? formatUSD(b.laporanUsd) : <span style={{ color: 'var(--text-muted)' }}>belum lapor</span>}</td>
                      <td style={{ textAlign: 'right' }}>{formatUSD(b.orderKotorUsd)}</td>
                      <td style={{ textAlign: 'right' }}>{formatUSD(b.orderBersihUsd)}</td>
                      <td style={{ textAlign: 'right' }}>{b.adaLaporan ? <><span style={{ color: warna(b.selisihKotor, b.laporanUsd) }}>{tanda(b.selisihKotor)}</span> / <span style={{ color: warna(b.selisihBersih, b.laporanUsd) }}>{tanda(b.selisihBersih)}</span></> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Hijau = selisih ≤ 5%. Rincian per platform ada di web circle → Keuangan → Bayangan omzet.</div>
          </>
        )}
      </div>
    </div>
  )
}
