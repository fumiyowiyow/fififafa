import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'
import PengeluaranMinggu from './PengeluaranMinggu'
import LabelJalur from '../../components/common/LabelJalur'
import { bukaPengeluaran } from '../../utils/bukaPengeluaran'

// ── Modal update kas cepat ───────────────────────────────
// Kas = SUM(saldo) Rekening Bank (Bio Studio) -- satu sumber kebenaran (13 Okt 2026). Modal ini
// gak lagi punya isian "Kas Sekarang" terpisah: yang diubah langsung saldo tiap rekening, dan
// server ikut mencatat snapshot-nya ke laporan minggu berjalan (lihat server/src/utils/kas.js).
// Ubah saldo = role yang sama dengan route PUT rekening (Super Admin, Kepala Ekosistem,
// Koordinator); role lain yang boleh lapor (Pendamping, Kepala Circle) cuma lihat saldonya.
export default function KasModal({ studio, weekStart, weekEnd, existingReport, canEditRekening, onClose, onSaved }) {
  const [rekening, setRekening] = useState(null) // null = memuat
  const [saldoEdit, setSaldoEdit] = useState({}) // { [rekeningId]: string }
  const [form, setForm] = useState({
    kendala: existingReport?.kendala ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get(`/api/masterdata/studios/${studio.id}/rekening`).then(res => {
      if (cancelled) return
      const rows = res.data.data ?? []
      setRekening(rows)
      setSaldoEdit(Object.fromEntries(rows.map(r => [r.id, String(r.saldo ?? 0)])))
    }).catch(() => { if (!cancelled) setRekening([]) })
    return () => { cancelled = true }
  }, [studio.id])

  const totalSaldo = (rekening ?? []).reduce((a, r) => a + (Number(saldoEdit[r.id]) || 0), 0)

  const save = async (e) => {
    e.preventDefault()
    const berubah = (rekening ?? []).filter(r => Number(saldoEdit[r.id]) !== r.saldo)
    if (berubah.some(r => saldoEdit[r.id] === '' || Number(saldoEdit[r.id]) < 0)) {
      return setError('Saldo rekening wajib diisi dan tidak boleh negatif')
    }
    setSaving(true); setError(null)
    try {
      // Rekening dulu, baru laporan -- laporan baru mencatat snapshot saldo yang SUDAH diperbarui.
      for (const r of berubah) {
        await api.put(`/api/masterdata/studios/${studio.id}/rekening/${r.id}`, { saldo: Number(saldoEdit[r.id]) })
      }
      if (existingReport) {
        await api.put(`/api/weekly-reports/${existingReport.id}`, { kendala: form.kendala })
      } else {
        await api.post('/api/weekly-reports', {
          studioId:     studio.id,
          periodeAwal:  weekStart,
          periodeAkhir: weekEnd,
          kendala:      form.kendala,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Update Kas</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{studio.nama}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <form onSubmit={save}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Saldo Rekening Bank</label>
            {rekening === null ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}><span className="spinner" /> Memuat rekening…</div>
            ) : rekening.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)' }}>
                Studio ini belum punya rekening. Tambahkan dulu di Unit Usaha › Bio Studio › Rekening Bank — kas dihitung dari sana.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rekening.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.namaBank}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.atasNama}</div>
                    </div>
                    {canEditRekening ? (
                      <input type="number" min="0" className="form-input" style={{ paddingLeft: 14, width: 170 }}
                        value={saldoEdit[r.id] ?? ''}
                        onChange={e => setSaldoEdit(s => ({ ...s, [r.id]: e.target.value }))} />
                    ) : (
                      <strong style={{ fontSize: 13 }}>{formatRp(r.saldo)}</strong>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total kas</span>
                  <strong>{formatRp(totalSaldo)}</strong>
                </div>
                {!canEditRekening && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Saldo rekening hanya bisa diubah Koordinator, Kepala Ekosistem, atau Super Admin.
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Pengeluaran Minggu Ini <LabelJalur jenis="resmi" style={{ marginLeft: 4 }} /></label>

            {/* Item langsung tersimpan per baris (gak nunggu tombol Simpan Kas) -- total laporan
                dihitung server dari item, lihat PengeluaranMinggu.jsx. */}
            {/* Baca saja di sini (1 Nov 2026): mencatat/menghapus cuma di Keuangan › Pengeluaran. */}
            <PengeluaranMinggu studioId={studio.id} periodeAwal={weekStart} periodeAkhir={weekEnd} canEdit={false} />
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px', marginTop: 8 }}
              onClick={() => bukaPengeluaran(studio.id)}>🧾 Catat / ubah di tab Pengeluaran →</button>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Catatan (opsional)</label>
            <textarea className="form-input" style={{ paddingLeft: 14, resize: 'vertical', minHeight: 64, paddingTop: 10 }}
              placeholder="Kendala, catatan, dll..."
              value={form.kendala} onChange={e => setForm(f => ({ ...f, kendala: e.target.value }))} />
          </div>
          {existingReport && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-subtle)',
              color: 'var(--amber)', fontSize: 12 }}>
              Laporan minggu ini sudah ada — nilai omset tidak berubah, hanya saldo & catatan.
            </div>
          )}
          {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving || rekening === null} style={{ minWidth: 130 }}>
              {saving ? <><span className="spinner"/> Menyimpan...</> : 'Simpan Kas'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  )
}
