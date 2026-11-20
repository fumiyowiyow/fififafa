import { useState, useMemo } from 'react'
import { useApi }  from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api         from '../../services/api'
import { hasMinRole } from '../../utils/roles'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { alfa } from '../../utils/warna'

const PLATFORMS = ['Fiverr','Etsy','Upwork','VGen','Instagram','TikTok','YouTube','LinkedIn','Website','Lainnya']

const PLATFORM_COLOR = {
  Fiverr: '#1dbf73', Etsy: '#f1641e', Upwork: '#14a800', VGen: 'var(--accent)',
  Instagram: '#e1306c', TikTok: 'var(--text)', YouTube: '#ff0000',
  LinkedIn: '#0077b5', Website: 'var(--text-muted)', Lainnya: '#9ca3af',
}

const PLATFORM_ICON = {
  Fiverr:'🟢', Etsy:'🟠', Upwork:'🔵', VGen:'🟣',
  Instagram:'📸', TikTok:'🎵', YouTube:'▶️', LinkedIn:'💼',
  Website:'🌐', Lainnya:'🔗',
}

const ADMIN_ROLES = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL']

function canManage(user) {
  return user?.roles?.some(r => ADMIN_ROLES.includes(r.roleType))
}

function initials(nama) {
  return nama?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?'
}

function SosmedChip({ l, canManage, onEdit, onDelete, deleting }) {
  const color = PLATFORM_COLOR[l.platform] || 'var(--text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: alfa(color, 9), border: `1px solid ${alfa(color, 27)}`, borderRadius: 8, padding: '6px 10px' }}>
      <span style={{ fontSize: 14 }}>{PLATFORM_ICON[l.platform]}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color }}>{l.platform}</div>
        {l.username && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{l.username}</div>}
      </div>
      <a href={l.url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 11, color, fontWeight: 600, marginLeft: 2 }}
        onClick={e => e.stopPropagation()}>Buka ↗</a>
      {canManage && (
        <button onClick={onEdit} aria-label={`Edit ${l.platform}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '0 2px' }}>✏️</button>
      )}
      {canManage && (
        <button onClick={onDelete} disabled={deleting} aria-label={`Hapus ${l.platform}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: '0 2px' }}>×</button>
      )}
    </div>
  )
}

const EMPTY_FORM = { platform: 'Fiverr', url: '', username: '', ownerType: 'personal', studioId: '' }

export default function Sosmed() {
  const { user } = useAuth()
  const isAdmin  = canManage(user)
  const isKoordinatorPlus = hasMinRole(user, 'KOORDINATOR')

  const { data: rawLinks, loading, error, refetch } = useApi('/api/sosmed')
  const links = rawLinks ?? []
  const { data: studiosRaw } = useApi(isKoordinatorPlus ? '/api/masterdata/studios' : null)
  const studios = studiosRaw ?? []

  const [filterPlatform, setFilterPlatform] = useState('')
  const [search,         setSearch]         = useState('')
  const [showForm,       setShowForm]       = useState(false)
  const [editTarget,     setEditTarget]     = useState(null)
  const [form,           setForm]           = useState(EMPTY_FORM)
  const [submitting,     setSubmitting]     = useState(false)
  const [formError,      setFormError]      = useState('')
  const [deleting,       setDeleting]       = useState(null)

  const filteredLinks = useMemo(() => {
    let list = links
    if (filterPlatform) list = list.filter(l => l.platform === filterPlatform)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        (l.user?.nama || '').toLowerCase().includes(q) ||
        (l.studio?.nama || '').toLowerCase().includes(q) ||
        (l.username  || '').toLowerCase().includes(q) ||
        l.platform.toLowerCase().includes(q)
      )
    }
    return list
  }, [links, filterPlatform, search])

  // Grup per studio (aset kerja studio) dan per orang (sosmed pribadi) -- dipisah biar jelas
  // mana akun kerja studio, mana sosmed pribadi anggota.
  const groupedStudio = useMemo(() => {
    const map = {}
    for (const l of filteredLinks) {
      if (!l.studioId) continue
      if (!map[l.studioId]) map[l.studioId] = { studio: l.studio, links: [] }
      map[l.studioId].links.push(l)
    }
    return Object.values(map).sort((a,b) => (a.studio?.nama||'').localeCompare(b.studio?.nama||''))
  }, [filteredLinks])

  const groupedPersonal = useMemo(() => {
    const map = {}
    for (const l of filteredLinks) {
      if (l.studioId) continue
      const uid = l.userId
      if (!map[uid]) map[uid] = { user: l.user, links: [] }
      map[uid].links.push(l)
    }
    return Object.values(map).sort((a,b) => (a.user?.nama||'').localeCompare(b.user?.nama||''))
  }, [filteredLinks])

  const usedPlatforms = useMemo(() => [...new Set(links.map(l => l.platform))].sort(), [links])

  function openCreate() {
    setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true)
  }
  function openEdit(l) {
    setEditTarget(l)
    setForm({
      platform: l.platform, url: l.url, username: l.username || '',
      ownerType: l.studioId ? 'studio' : 'personal', studioId: l.studioId || '',
    })
    setFormError(''); setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setFormError('')
    if (!form.url.trim()) { setFormError('URL wajib diisi'); return }
    if (form.ownerType === 'studio' && !form.studioId) { setFormError('Pilih studio pemilik akun ini'); return }
    setSubmitting(true)
    try {
      const payload = {
        platform: form.platform, url: form.url, username: form.username,
        ...(form.ownerType === 'studio' && !editTarget ? { studioId: form.studioId } : {}),
      }
      if (editTarget) await api.put(`/api/sosmed/${editTarget.id}`, payload)
      else            await api.post('/api/sosmed', payload)
      setShowForm(false); setEditTarget(null); await refetch()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(l) {
    if (!window.confirm(`Hapus link ${l.platform} ini?`)) return
    setDeleting(l.id)
    try { await api.delete(`/api/sosmed/${l.id}`); await refetch() }
    catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
    finally { setDeleting(null) }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>🔗 Direktori Sosmed & Marketplace</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Akun platform dan media sosial seluruh anggota {ECOSYSTEM_NAME}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Tambah Akun</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Cari nama atau username..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, maxWidth: 280, paddingLeft: 12 }} />
        <select className="form-input" style={{ paddingLeft: 10, minWidth: 160 }}
          value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="">Semua Platform</option>
          {usedPlatforms.map(p => <option key={p} value={p}>{PLATFORM_ICON[p]} {p}</option>)}
        </select>
        {filterPlatform && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFilterPlatform('')}>Reset</button>}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Memuat...</div>}
      {error   && <div style={{ color: 'var(--red)', padding: 16 }}>{error}</div>}
      {!loading && groupedStudio.length === 0 && groupedPersonal.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Belum ada akun terdaftar. Klik "+ Tambah Akun" untuk mulai.
        </div>
      )}

      {groupedStudio.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏢 Aset Studio
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {groupedStudio.map(({ studio: s, links: sLinks }) => {
              const warna = s?.circle?.colorHex ?? s?.rumahUsaha?.colorHex ?? 'var(--text-muted)'
              const canManageThisStudio = isAdmin || user?.roles?.some(r => r.studioId === s?.id)
              return (
                <div key={s?.id || 'unknown'} className="card" style={{ padding: '16px 20px', borderTop: `3px solid ${warna}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: warna, flexShrink: 0 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{s?.nama || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sLinks.map(l => (
                      <SosmedChip key={l.id} l={l} canManage={canManageThisStudio}
                        onEdit={() => openEdit(l)} onDelete={() => handleDelete(l)} deleting={deleting === l.id} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        👤 Sosmed Pribadi
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groupedPersonal.map(({ user: u, links: uLinks }) => (
          <div key={u?.id || 'unknown'} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {u?.fotoUrl
                ? <img src={u.fotoUrl} alt={u.nama} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials(u?.nama)}</div>
              }
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{u?.nama || '—'}</div>
                {u?.posisi && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.posisi}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {uLinks.map(l => {
                const isOwn = l.userId === user?.id
                return (
                  <SosmedChip key={l.id} l={l} canManage={isAdmin || isOwn}
                    onEdit={() => openEdit(l)} onDelete={() => handleDelete(l)} deleting={deleting === l.id} />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Form drawer */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 300, padding: 16 }}
          onClick={() => { setShowForm(false); setEditTarget(null) }}>
          <div style={{ width: '100%', maxWidth: 420, maxHeight: 'calc(100vh - 32px)', background: 'var(--bg-card)', borderRadius: 16, overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{editTarget ? 'Edit Akun' : 'Tambah Akun'}</div>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Platform *</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICON[p]} {p}</option>)}
                </select>
              </div>

              {isKoordinatorPlus && !editTarget && (
                <div className="form-group">
                  <label className="form-label">Milik</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['personal','Pribadi'],['studio','Studio']].map(([key,label]) => (
                      <button key={key} type="button" onClick={() => setForm(f => ({ ...f, ownerType: key }))}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          border: `1px solid ${form.ownerType === key ? 'var(--accent)' : 'var(--border)'}`,
                          background: form.ownerType === key ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                          color: form.ownerType === key ? 'var(--accent-light)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}>{label}</button>
                    ))}
                  </div>
                </div>
              )}

              {isKoordinatorPlus && !editTarget && form.ownerType === 'studio' && (
                <div className="form-group">
                  <label className="form-label">Studio *</label>
                  <select className="form-input" style={{ paddingLeft: 10 }}
                    value={form.studioId} onChange={e => setForm(f => ({ ...f, studioId: e.target.value }))}>
                    <option value="">— Pilih studio —</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                  </select>
                </div>
              )}

              {editTarget?.studioId && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6 }}>
                  Akun studio: <strong>{editTarget.studio?.nama}</strong> — kepemilikan tidak bisa diubah lewat form ini
                </div>
              )}

              <div className="form-group">
                <label className="form-label">URL Profil *</label>
                <input className="form-input" style={{ paddingLeft: 12 }} type="url"
                  value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://www.fiverr.com/username" required />
              </div>
              <div className="form-group">
                <label className="form-label">Username (opsional)</label>
                <input className="form-input" style={{ paddingLeft: 12 }}
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="@username" />
              </div>
              {formError && <div className="login-error">{formError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? <><span className="spinner"/>Menyimpan...</> : editTarget ? 'Simpan' : 'Tambah'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditTarget(null) }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
