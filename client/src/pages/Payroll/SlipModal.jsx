import { useApi } from '../../hooks/useApi'
import { formatRp, getBulanLabel } from '../../utils/format'

const DEBET_LABELS = { gajiPokok: 'Gaji Pokok', bonus: 'Bonus', komisi: 'Komisi', lembur: 'Lembur', shu: 'SHU' }
// Kredit (tunjangan) sekarang baris DINAMIS per studio (lihat data.kredit array dari
// GET /api/payroll/:id/slip), bukan 5 label tetap lagi.

// Preview slip gaji -- JSON dari GET /api/payroll/:id/slip. Render doang di sini (Debet/Kredit/
// THP), generate PDF-nya belum di-scope (menyusul kalau datanya udah oke, lihat instruksi).
export default function SlipModal({ penggajianId, onClose }) {
  const { data, loading, error } = useApi(`/api/payroll/${penggajianId}/slip`)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-title">Slip Gaji</div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}><div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} /></div>
        )}
        {error && <div className="login-error">{error}</div>}

        {data && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{data.penggajian.user?.nama}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {data.penggajian.studio?.nama} · {getBulanLabel(data.penggajian.bulan, data.penggajian.tahun)}
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Debet</div>
            {Object.entries(DEBET_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{label}</span><span>{formatRp(data.debet[key])}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <span>Total Debet</span><span>{formatRp(data.totalDebet)}</span>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 6px' }}>Kredit (Tunjangan)</div>
            {data.kredit.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada tunjangan</div>
            ) : data.kredit.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{t.nama}</span><span>{formatRp(t.jumlah)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 700, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <span>Total Kredit</span><span>{formatRp(data.totalKredit)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--red)', marginTop: 12 }}>
              <span>Potongan</span><span>− {formatRp(data.potongan)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 16, fontWeight: 800, borderTop: '2px solid var(--border)', marginTop: 8, color: 'var(--green)' }}>
              <span>Total THP</span><span>{formatRp(data.thp)}</span>
            </div>

            {data.penggajian.catatanLembur?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Rincian Lembur ({data.penggajian.catatanLembur.length})
                </div>
                {data.penggajian.catatanLembur.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>{c.briefName || c.klien || c.rateCard?.level || '—'}</span>
                    <span>{formatRp(c.feeAkhir)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button type="button" className="btn btn-primary" onClick={onClose}>Tutup</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
