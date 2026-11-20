import { useState } from 'react'
import api from '../../services/api'

// ── StudioBioModal section: SKB (Studi Kelayakan Bisnis) ─

export default function StudioBioSkb({ studioId, skbUrl: initialSkbUrl, canEdit }) {
  const [skbUrl, setSkbUrl]             = useState(initialSkbUrl ?? null)
  const [skbUploading, setSkbUploading] = useState(false)
  const [skbError, setSkbError]         = useState('')

  const handleSkbUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSkbError('')
    setSkbUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post(`/api/masterdata/studios/${studioId}/skb`, fd)
      setSkbUrl(res.data.data.skbUrl)
    } catch (err) {
      setSkbError(err.response?.data?.message || 'Gagal mengunggah SKB')
    } finally {
      setSkbUploading(false)
      e.target.value = ''
    }
  }

  const handleSkbDelete = async () => {
    if (!window.confirm('Hapus file SKB ini?')) return
    setSkbError('')
    setSkbUploading(true)
    try {
      await api.delete(`/api/masterdata/studios/${studioId}/skb`)
      setSkbUrl(null)
    } catch (err) {
      setSkbError(err.response?.data?.message || 'Gagal menghapus SKB')
    } finally { setSkbUploading(false) }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Studi Kelayakan Bisnis (SKB)</div>
        {canEdit && (
          <label style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: skbUploading ? 'not-allowed' : 'pointer',
            background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600, opacity: skbUploading ? 0.6 : 1,
            position: 'relative', display: 'inline-block',
          }}>
            {skbUploading ? 'Mengunggah…' : skbUrl ? 'Ganti PDF' : '+ Upload PDF'}
            <input type="file" accept=".pdf" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }} disabled={skbUploading} onChange={handleSkbUpload} />
          </label>
        )}
      </div>
      {skbError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{skbError}</div>}
      {skbUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {skbUrl.split('/').pop()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dokumen PDF</div>
          </div>
          <a href={skbUrl} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
            Buka
          </a>
          {canEdit && (
            <button onClick={handleSkbDelete} disabled={skbUploading}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--red-subtle)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 20%, transparent)', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
              Hapus
            </button>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada dokumen SKB
        </div>
      )}
    </div>
  )
}
