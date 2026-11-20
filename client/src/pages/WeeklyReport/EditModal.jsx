import { useState } from 'react'
import api from '../../services/api'
import { formatTanggalPendek } from '../../utils/format'
import { getReportingPeriod } from '../../utils/week'
import OmsetForm from './OmsetForm'

// ── Modal edit laporan ───────────────────────────────────
export default function EditModal({ report, otherReports = [], onSwitch, onClose, onSaved }) {
  const [form, setForm] = useState({
    kurs:           report.kurs,
    kasSekarang:    report.kasSekarang,
    kendala:        report.kendala ?? '',
    skorSemangat:   report.skorSemangat ?? 3,
    omsetFiverr:    report.omsetFiverr,
    omsetEtsy:      report.omsetEtsy,
    omsetUpwork:    report.omsetUpwork,
    omsetVgen:      report.omsetVgen,
    omsetKomunitas: report.omsetKomunitas,
    omsetLainnya:   report.omsetLainnya,
  })
  const [periodeAwal, setPeriodeAwal] = useState(report.periodeAwal.slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const onChange = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const periodeBerubah = periodeAwal !== report.periodeAwal.slice(0, 10)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await api.put(`/api/weekly-reports/${report.id}`, { ...form, periodeAwal })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit Laporan</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {report.studio?.nama}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {otherReports.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Minggu lain studio ini — klik buat lihat/edit:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[report, ...otherReports]
                .sort((a, b) => b.periodeAwal.localeCompare(a.periodeAwal))
                .map(r => {
                  const isActive = r.id === report.id
                  return (
                    <button key={r.id} type="button" onClick={() => !isActive && onSwitch?.(r)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: isActive ? 'default' : 'pointer',
                        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                        background: isActive ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                        fontWeight: isActive ? 700 : 400,
                      }}>
                      {formatTanggalPendek(r.periodeAwal)}
                    </button>
                  )
                })}
            </div>
          </div>
        )}

        <form onSubmit={save}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Periode (salah minggu? ganti di sini)</label>
            <input type="date" className="form-input" style={{ paddingLeft: 14, width: 180 }}
              value={periodeAwal} onChange={e => e.target.value && setPeriodeAwal(getReportingPeriod(e.target.value).periodeAwal)} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {periodeBerubah
                ? `Dipindah ke periode ${formatTanggalPendek(periodeAwal)} – ${formatTanggalPendek(getReportingPeriod(periodeAwal).periodeAkhir)}`
                : `Periode ${formatTanggalPendek(periodeAwal)} – ${formatTanggalPendek(getReportingPeriod(periodeAwal).periodeAkhir)} (otomatis disesuaikan ke awal minggu -- dipotong kalau kena batas bulan)`}
            </div>
          </div>
          <OmsetForm form={form} onChange={onChange} myStudios={[]} statusData={[]} isEdit
            studioId={report.studioId}
            periode={{ awal: report.periodeAwal.slice(0, 10), akhir: report.periodeAkhir.slice(0, 10) }} />
          {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 130 }}>
              {saving ? <><span className="spinner"/> Menyimpan...</> : 'Simpan Perubahan'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  )
}
