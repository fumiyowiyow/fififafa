import { useState } from 'react'
import api from '../../services/api'
import { CIRCLE_COLORS_DEFAULT } from './constants'

// ── Modal Edit / Tambah Rumah Usaha ──────────────────────

export default function RumahUsahaModal({ rumahUsaha, anggota = [], canEdit, onClose, onSaved }) {
  const isEdit = !!rumahUsaha
  const [editing, setEditing] = useState(!isEdit)
  const [form, setForm] = useState({
    nama:      rumahUsaha?.nama      ?? '',
    deskripsi: rumahUsaha?.deskripsi ?? '',
    colorHex:  rumahUsaha?.colorHex  ?? CIRCLE_COLORS_DEFAULT[0],
    alamat:    rumahUsaha?.alamat    ?? '',
    mapsUrl:   rumahUsaha?.mapsUrl   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const existingKepalaRole = rumahUsaha?.userRoles?.find(r => r.roleType === 'KEPALA_RUMAH_USAHA')
  const [kepalUserId, setKepalUserId] = useState(existingKepalaRole?.user?.id ?? '')

  const save = async () => {
    if (!form.nama.trim()) return setError('Nama Rumah Usaha wajib diisi')
    setSaving(true); setError('')
    try {
      const res = isEdit
        ? await api.put(`/api/masterdata/rumah-usaha/${rumahUsaha.id}`, form)
        : await api.post('/api/masterdata/rumah-usaha', form)
      const saved = res.data.data
      const oldKepalId = existingKepalaRole?.user?.id ?? ''
      if (kepalUserId !== oldKepalId) {
        if (existingKepalaRole) await api.delete(`/api/members/roles/${existingKepalaRole.id}`)
        if (kepalUserId) await api.post(`/api/members/${kepalUserId}/roles`, { roleType: 'KEPALA_RUMAH_USAHA', rumahUsahaId: saved.id })
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{!isEdit ? 'Tambah Rumah Usaha' : editing ? 'Edit Rumah Usaha' : rumahUsaha.nama}</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {!editing ? (
          <>
            {rumahUsaha.deskripsi && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Deskripsi</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rumahUsaha.deskripsi}</div>
              </div>
            )}
            {(rumahUsaha.alamat || rumahUsaha.mapsUrl) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Alamat</div>
                {rumahUsaha.alamat && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: rumahUsaha.mapsUrl ? 6 : 0 }}>{rumahUsaha.alamat}</div>}
                {rumahUsaha.mapsUrl && (
                  <a href={rumahUsaha.mapsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    📍 Buka di Google Maps
                  </a>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: rumahUsaha.colorHex || '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, width: 72 }}>Kepala</span>
                <span style={{ fontSize: 13, color: existingKepalaRole ? 'var(--text)' : 'var(--text-muted)', fontWeight: existingKepalaRole ? 600 : 400 }}>
                  {existingKepalaRole?.user?.nama ?? '—'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: rumahUsaha.colorHex || '#0EA5E9' }}>{rumahUsaha._count?.studios ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Studio</div>
              </div>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
              </div>
            )}
          </>
        ) : (
        <>
        <div className="form-group">
          <label className="form-label">Nama Rumah Usaha</label>
          <input className="form-input" value={form.nama}
            onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
            placeholder="contoh: Rumah Langit" />
        </div>

        <div className="form-group">
          <label className="form-label">Deskripsi (opsional)</label>
          <input className="form-input" value={form.deskripsi}
            onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label">Alamat (opsional)</label>
          <input className="form-input" value={form.alamat}
            onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} />
        </div>

        <div className="form-group">
          <label className="form-label">Link Google Maps (opsional)</label>
          <input className="form-input" value={form.mapsUrl}
            onChange={e => setForm(f => ({ ...f, mapsUrl: e.target.value }))}
            placeholder="https://maps.google.com/..." />
        </div>

        <div className="form-group">
          <label className="form-label">Warna</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {CIRCLE_COLORS_DEFAULT.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, colorHex: c }))}
                style={{
                  width: 32, height: 32, borderRadius: 8, background: c, border: 'none',
                  cursor: 'pointer', outline: form.colorHex === c ? '3px solid white' : 'none',
                  outlineOffset: 2,
                }} />
            ))}
          </div>
          <input className="form-input" value={form.colorHex}
            onChange={e => setForm(f => ({ ...f, colorHex: e.target.value }))}
            placeholder="#000000" maxLength={7} />
        </div>

        <div className="form-group">
          <label className="form-label">Kepala Rumah Usaha (PIC)</label>
          <select className="form-input" value={kepalUserId} onChange={e => setKepalUserId(e.target.value)}>
            <option value="">— Belum ditentukan —</option>
            {anggota.map(m => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => isEdit ? setEditing(false) : onClose()}>Batal</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.nama.trim()}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
