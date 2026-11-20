import { useState } from 'react'
import api from '../../services/api'
import { TIPE_OPTIONS } from './constants'
import { LABEL_TIPE_UNIT } from '../../utils/tipeUnit'

// ── Modal Edit / Tambah Studio ───────────────────────────

// Cuma buat BIKIN studio baru sekarang -- edit studio existing digabung ke dalam StudioBioModal
// (bagian "Info Dasar") biar gak perlu bolak-balik dua modal buat data yang sama.
export default function StudioModal({ circles, rumahUsaha, korporasiList, users, onClose, onSaved }) {
  const [indukTipe, setIndukTipe] = useState('circle')
  const [form, setForm] = useState({
    nama:          '',
    circleId:      circles?.[0]?.id ?? '',
    rumahUsahaId:  rumahUsaha?.[0]?.id ?? '',
    indukId:       korporasiList?.[0]?.id ?? '',
    tipe:          'STUDIO',
    niche:         '',
    koordinatorId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const save = async () => {
    if (!form.nama.trim()) return setError('Nama studio wajib diisi')
    if (indukTipe === 'circle' && !form.circleId) return setError('Pilih Circle')
    if (indukTipe === 'rumahUsaha' && !form.rumahUsahaId) return setError('Pilih Rumah Usaha')
    if (indukTipe === 'korporasi' && !form.indukId) return setError('Pilih Korporasi')
    setSaving(true); setError('')
    // Korporasi langsung di bawah ekosistem -- tanpa naungan.
    const korporasi = form.tipe === 'KORPORASI'
    const payload = {
      ...form,
      circleId:     !korporasi && indukTipe === 'circle'     ? form.circleId     : null,
      rumahUsahaId: !korporasi && indukTipe === 'rumahUsaha' ? form.rumahUsahaId : null,
      indukId:      !korporasi && indukTipe === 'korporasi'  ? form.indukId      : null,
    }
    try {
      await api.post('/api/masterdata/studios', payload)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">Tambah Studio / Project</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nama Studio / Project *</label>
            <input className="form-input" value={form.nama}
              onChange={e => set('nama', e.target.value)} placeholder="contoh: Keiko Studio" />
          </div>

          {form.tipe === 'KORPORASI' ? (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-muted)' }}>
              Pilih tipe Korporasi HANYA untuk PT-nya sendiri — langsung di bawah ekosistem. Unit milik PT (mis. project milik PT) tetap bertipe Studio/Project, lalu pilih naungan Korporasi → nama PT-nya.
            </div>
          ) : <>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Di bawah naungan *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['circle', 'Circle'], ['rumahUsaha', 'Rumah Usaha'], ...(korporasiList?.length ? [['korporasi', 'Korporasi']] : [])].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setIndukTipe(key)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${indukTipe === key ? 'var(--accent)' : 'var(--border)'}`,
                    background: indukTipe === key ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    color: indukTipe === key ? 'var(--accent-light)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}>{label}</button>
              ))}
            </div>
          </div>

          {indukTipe === 'circle' ? (
            <div className="form-group">
              <label className="form-label">Circle *</label>
              <select className="form-input" value={form.circleId} onChange={e => set('circleId', e.target.value)}>
                {circles?.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
              </select>
            </div>
          ) : indukTipe === 'rumahUsaha' ? (
            <div className="form-group">
              <label className="form-label">Rumah Usaha *</label>
              <select className="form-input" value={form.rumahUsahaId} onChange={e => set('rumahUsahaId', e.target.value)}>
                {rumahUsaha?.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Korporasi *</label>
              <select className="form-input" value={form.indukId} onChange={e => set('indukId', e.target.value)}>
                {korporasiList?.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
          )}
          </>}

          <div className="form-group">
            <label className="form-label">Tipe *</label>
            <select className="form-input" value={form.tipe} onChange={e => set('tipe', e.target.value)}>
              {TIPE_OPTIONS.map(t => <option key={t} value={t}>{LABEL_TIPE_UNIT[t]}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Koordinator</label>
            <select className="form-input" value={form.koordinatorId} onChange={e => set('koordinatorId', e.target.value)}>
              <option value="">— Pilih koordinator —</option>
              {users?.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Niche / Deskripsi</label>
            <input className="form-input" value={form.niche}
              onChange={e => set('niche', e.target.value)} placeholder="contoh: Ilustrasi digital, rigging" />
          </div>

        </div>

        {error && <div className="login-error" style={{ marginTop: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Tambah Studio'}
          </button>
        </div>
      </div>
    </div>
  )
}
