import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'

// Toggle aktif/nonaktif dipilih di atas HARD DELETE -- CatatanLembur lama yang udah pakai rate
// card ini tetap butuh referensinya valid (relasi rateCardId gak boleh yatim), jadi rate card
// gak pernah beneran dihapus, cuma dinonaktifkan (gak bisa dipakai buat entri BARU lagi, lihat
// createLembur di controller).
export default function RateCardTab({ studioId, canManage }) {
  const { data: rateCards, loading, error, refetch } = useApi(
    studioId ? `/api/payroll/rate-card?studioId=${studioId}` : null, [studioId]
  )

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ level: '', keterangan: '', fee: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [actionErr, setActionErr] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true); setFormErr('')
    try {
      await api.post('/api/payroll/rate-card', { ...form, studioId })
      setShowForm(false)
      setForm({ level: '', keterangan: '', fee: '' })
      refetch()
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Gagal menambah rate card')
    }
    setSubmitting(false)
  }

  const startEdit = (r) => {
    setEditingId(r.id)
    setEditForm({ level: r.level, keterangan: r.keterangan ?? '', fee: String(r.fee) })
  }
  const cancelEdit = () => { setEditingId(null); setEditForm({}) }

  const saveEdit = async (id) => {
    setSaving(true); setActionErr('')
    try {
      await api.patch(`/api/payroll/rate-card/${id}`, editForm)
      setEditingId(null); setEditForm({})
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal menyimpan perubahan')
    }
    setSaving(false)
  }

  const toggleAktif = async (r) => {
    setActionErr('')
    try {
      await api.patch(`/api/payroll/rate-card/${r.id}`, { aktif: !r.aktif })
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal mengubah status')
    }
  }

  if (!studioId) {
    return <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Pilih studio dulu di atas</div>
  }

  return (
    <>
      {canManage && (
        <div className="page-header-row" style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Tutup' : '+ Tambah Rate Card'}
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Rate Card Baru</span></div>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Level *</label>
              <input className="form-input" style={{ paddingLeft: 14 }} placeholder="mis. Senior 3D" required
                value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Keterangan</label>
              <input className="form-input" style={{ paddingLeft: 14 }} placeholder="opsional"
                value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Fee per Progress 100% (IDR) *</label>
              <input className="form-input" type="number" min="0" style={{ paddingLeft: 14 }} required
                value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 100 }}>
                {submitting ? <><span className="spinner"/>Menyimpan...</> : 'Simpan'}
              </button>
            </div>
          </form>
          {formErr && <div className="login-error">{formErr}</div>}
        </div>
      )}

      {actionErr && <div className="login-error" style={{ marginBottom: 16 }}>{actionErr}</div>}
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
        </div>
      ) : (rateCards ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada rate card lembur</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Level</th><th>Keterangan</th><th style={{ textAlign: 'right' }}>Fee (100% progress)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  {canManage && <th style={{ textAlign: 'center' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {rateCards.map(r => {
                  const isEditing = editingId === r.id
                  return (
                    <tr key={r.id}>
                      {isEditing ? (
                        <>
                          <td>
                            <input className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 120 }}
                              value={editForm.level} onChange={e => setEditForm(v => ({ ...v, level: e.target.value }))} />
                          </td>
                          <td>
                            <input className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                              value={editForm.keterangan} onChange={e => setEditForm(v => ({ ...v, keterangan: e.target.value }))} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input type="number" min="0" className="form-input" style={{ padding: '4px 8px', fontSize: 12, width: 110 }}
                              value={editForm.fee} onChange={e => setEditForm(v => ({ ...v, fee: e.target.value }))} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.aktif ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>{r.aktif ? 'Aktif' : 'Nonaktif'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }} disabled={saving} onClick={() => saveEdit(r.id)}>Simpan</button>
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={cancelEdit}>Batal</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 600 }}>{r.level}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.keterangan ?? '—'}</td>
                          <td style={{ textAlign: 'right' }}>Rp {r.fee.toLocaleString('id-ID')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${r.aktif ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>{r.aktif ? 'Aktif' : 'Nonaktif'}</span>
                          </td>
                          {canManage && (
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => startEdit(r)}>Edit</button>
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => toggleAktif(r)}>
                                  {r.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
