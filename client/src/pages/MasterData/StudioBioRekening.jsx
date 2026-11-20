import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'

// ── StudioBioModal section: Rekening Bank ────────────────

export default function StudioBioRekening({ studioId, canEdit }) {
  const [rekening, setRekening]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [form, setForm]           = useState({ namaBank: '', nomorRekening: '', atasNama: '', saldo: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const fetchRekening = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/masterdata/studios/${studioId}/rekening`)
      setRekening(res.data.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchRekening()
  }, [])

  const openAdd = () => {
    setEditItem(null)
    setForm({ namaBank: '', nomorRekening: '', atasNama: '', saldo: '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({ namaBank: item.namaBank, nomorRekening: item.nomorRekening, atasNama: item.atasNama, saldo: String(item.saldo) })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.namaBank.trim() || !form.nomorRekening.trim() || !form.atasNama.trim()) {
      return setError('Nama bank, nomor rekening, dan atas nama wajib diisi')
    }
    setSaving(true); setError('')
    try {
      const payload = { ...form, saldo: Number(form.saldo) || 0 }
      if (editItem) {
        await api.put(`/api/masterdata/studios/${studioId}/rekening/${editItem.id}`, payload)
      } else {
        await api.post(`/api/masterdata/studios/${studioId}/rekening`, payload)
      }
      setShowForm(false)
      fetchRekening()
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const hapus = async (id) => {
    if (!window.confirm('Hapus rekening ini?')) return
    try {
      await api.delete(`/api/masterdata/studios/${studioId}/rekening/${id}`)
      fetchRekening()
    } catch { /* silent */ }
  }

  const totalSaldo = rekening.reduce((a, r) => a + r.saldo, 0)

  return (
    <>
      {/* Rekening Bank */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Rekening Bank</div>
          {rekening.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Total saldo: <span style={{ color: 'var(--green)', fontWeight: 700 }}>{formatRp(totalSaldo)}</span>
            </div>
          )}
        </div>
        {canEdit && !showForm && (
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={openAdd}>
            + Tambah Rekening
          </button>
        )}
      </div>

      {/* Form tambah / edit */}
      {showForm && (
        <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>
            {editItem ? 'Edit Rekening' : 'Tambah Rekening Baru'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nama Bank *</label>
              <input className="form-input" value={form.namaBank}
                onChange={e => setForm(f => ({ ...f, namaBank: e.target.value }))}
                placeholder="BCA, Mandiri, BRI…" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nomor Rekening *</label>
              <input className="form-input" value={form.nomorRekening}
                onChange={e => setForm(f => ({ ...f, nomorRekening: e.target.value }))}
                placeholder="1234567890" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Atas Nama *</label>
              <input className="form-input" value={form.atasNama}
                onChange={e => setForm(f => ({ ...f, atasNama: e.target.value }))}
                placeholder="Nama pemegang rekening" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Saldo (IDR)</label>
              <input className="form-input" type="number" min="0" value={form.saldo}
                onChange={e => setForm(f => ({ ...f, saldo: e.target.value }))}
                placeholder="0" />
            </div>
          </div>
          {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowForm(false)}>Batal</button>
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={save} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}

      {/* List rekening */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ display: 'inline-block', width: 18, height: 18 }} />
        </div>
      ) : rekening.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada rekening bank terdaftar
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rekening.map(r => (
            <div key={r.id} style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{r.namaBank}</span>
                  <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={r.nomorRekening}>
                    {r.nomorRekening}
                  </code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`a.n. ${r.atasNama}`}>a.n. {r.atasNama}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>{formatRp(r.saldo)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>saldo</div>
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => openEdit(r)}>Edit</button>
                  <button onClick={() => hapus(r.id)}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'var(--red-subtle)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', cursor: 'pointer', fontWeight: 600 }}>
                    Hapus
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
