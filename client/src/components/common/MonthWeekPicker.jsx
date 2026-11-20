import { formatTanggalPendek } from '../../utils/format'
import { getReportingPeriod, getWeekDates } from '../../utils/week'

// Input tanggal manual — user tinggal pilih tanggal mana saja dalam periode yang dimaksud, lalu
// di-snap otomatis ke awal periode itu (minggu Senin-Minggu SEPERTI BIASA, TAPI dipotong di
// batas bulan -- periode pertama/terakhir tiap bulan bisa lebih pendek dari 7 hari, lihat
// getReportingPeriod di utils/week.js).
export function MonthWeekPicker({ value, onChange }) {
  const thisWeek = getReportingPeriod(getWeekDates().start).periodeAwal
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input type="date" className="form-input" style={{ padding: '6px 10px', width: 150, fontSize: 12 }}
        value={value}
        onChange={e => e.target.value && onChange(getReportingPeriod(e.target.value).periodeAwal)} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        s/d {formatTanggalPendek(getReportingPeriod(value).periodeAkhir)}
      </span>
      {value !== thisWeek && (
        <button type="button" onClick={() => onChange(thisWeek)}
          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
          Minggu Ini
        </button>
      )}
    </div>
  )
}
