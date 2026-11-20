import { useState } from 'react'
import api from '../../services/api'
import { CIRCLE_COLORS_DEFAULT } from './constants'

// ── Modal Edit Circle ────────────────────────────────────

export default function CircleModal({ circle, anggota = [], canEdit, onClose, onSaved }) {
  const isEdit = !!circle
  // Buka Bio (lihat detail) itu terbuka buat semua orang; form edit cuma buat yang canEdit --
  // digabung jadi satu modal (dulu Bio & Edit dua modal terpisah), defaultnya tampilan lihat-
  // lihat aja, klik "Edit" buat masuk mode form. Bikin circle baru langsung ke form (gak ada
  // apa-apa buat dilihat).
  const [editing, setEditing] = useState(!isEdit)
  const [form, setForm] = useState({
    nama:      circle?.nama      ?? '',
    colorHex:  circle?.colorHex  ?? CIRCLE_COLORS_DEFAULT[0],
    deskripsi: circle?.deskripsi ?? '',
    alamat:    circle?.alamat    ?? '',
    mapsUrl:   circle?.mapsUrl   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const existingKepalaRole = circle?.userRoles?.find(r => r.roleType === 'KEPALA_CIRCLE')
  const [kepalUserId, setKepalUserId] = useState(existingKepalaRole?.user?.id ?? '')
  const [pengurusRoles, setPengurusRoles] = useState(
    circle?.userRoles?.filter(r => r.roleType === 'ADMIN_FUNGSIONAL') ?? []
  )
  const [newPengurusId, setNewPengurusId] = useState('')

  const pengurusIds    = new Set(pengurusRoles.map(r => r.user?.id))
  const pengurusOptions = anggota.filter(m => !pengurusIds.has(m.id))

  const save = async () => {
    if (!form.nama.trim()) return setError('Nama Circle wajib diisi')
    setSaving(true); setError('')
    try {
      const res = isEdit
        ? await api.put(`/api/masterdata/circles/${circle.id}`, form)
        : await api.post('/api/masterdata/circles', form)
      const saved = res.data.data
      const oldKepalId = existingKepalaRole?.user?.id ?? ''
      if (kepalUserId !== oldKepalId) {
        if (existingKepalaRole) await api.delete(`/api/members/roles/${existingKepalaRole.id}`)
        if (kepalUserId) await api.post(`/api/members/${kepalUserId}/roles`, { roleType: 'KEPALA_CIRCLE', circleId: saved.id })
      }
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const removePengurus = async (role) => {
    try {
      await api.delete(`/api/members/roles/${role.id}`)
      setPengurusRoles(prev => prev.filter(r => r.id !== role.id))
    } catch (e) { setError(e.response?.data?.message || 'Gagal menghapus') }
  }

  const addPengurus = async () => {
    if (!newPengurusId) return
    try {
      const res = await api.post(`/api/members/${newPengurusId}/roles`, { roleType: 'ADMIN_FUNGSIONAL', circleId: circle.id })
      const member = anggota.find(m => m.id === newPengurusId)
      setPengurusRoles(prev => [...prev, { id: res.data.data.id, roleType: 'ADMIN_FUNGSIONAL', user: { id: member.id, nama: member.nama } }])
      setNewPengurusId('')
    } catch (e) { setError(e.response?.data?.message || 'Gagal menambah pengurus') }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{!isEdit ? 'Tambah Circle' : editing ? 'Edit Circle' : circle.nama}</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {!editing ? (
          <>
            {circle.deskripsi && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Deskripsi</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{circle.deskripsi}</div>
              </div>
            )}
            {(circle.alamat || circle.mapsUrl) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Alamat</div>
                {circle.alamat && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: circle.mapsUrl ? 6 : 0 }}>{circle.alamat}</div>}
                {circle.mapsUrl && (
                  <a href={circle.mapsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    📍 Buka di Google Maps
                  </a>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: circle.colorHex, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, width: 72 }}>Kepala</span>
                <span style={{ fontSize: 13, color: existingKepalaRole ? 'var(--text)' : 'var(--text-muted)', fontWeight: existingKepalaRole ? 600 : 400 }}>
                  {existingKepalaRole?.user?.nama ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, width: 72 }}>Pengurus</span>
                <span style={{ fontSize: 13, color: pengurusRoles.length ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                  {pengurusRoles.length ? pengurusRoles.map(r => r.user?.nama).join(', ') : '—'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: circle.colorHex }}>{circle._count?.studios ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Studio</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{circle._count?.userRoles ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Anggota</div>
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
          <label className="form-label">Nama Circle</label>
          <input className="form-input" value={form.nama}
            onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
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
          <label className="form-label">Kepala Circle (PIC)</label>
          <select className="form-input" value={kepalUserId} onChange={e => setKepalUserId(e.target.value)}>
            <option value="">— Belum ditentukan —</option>
            {anggota.map(m => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Deskripsi (opsional)</label>
          <input className="form-input" value={form.deskripsi}
            onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
            placeholder="Keterangan singkat tentang circle ini" />
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

        {isEdit && (
        <div className="form-group">
          <label className="form-label">Pengurus (Admin Fungsional)</label>
          {pengurusRoles.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {pengurusRoles.map(role => (
                <span key={role.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 13,
                }}>
                  {role.user?.nama}
                  <button onClick={() => removePengurus(role)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 2px',
                  }}>✕</button>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Belum ada pengurus</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-input" value={newPengurusId} onChange={e => setNewPengurusId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Tambah pengurus…</option>
              {pengurusOptions.map(m => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
            <button className="btn btn-ghost" onClick={addPengurus} disabled={!newPengurusId} style={{ flexShrink: 0 }}>
              + Tambah
            </button>
          </div>
        </div>
        )}

        {error && <div className="login-error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => isEdit ? setEditing(false) : onClose()}>Batal</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.nama.trim()}>
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Tambah Circle'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
