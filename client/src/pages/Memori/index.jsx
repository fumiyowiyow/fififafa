import { useState, useMemo } from 'react'
import { useApi }  from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api         from '../../services/api'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { onActivate } from '../../utils/a11y'
import { alfa } from '../../utils/warna'

const TIPE_LIST = ['Keputusan Rapat','SOP & Prosedur','Sejarah','Lessons Learned','Catatan Penting','Lainnya']

const TIPE_COLOR = {
  'Keputusan Rapat': '#3b82f6', 'SOP & Prosedur': 'var(--green)',
  'Sejarah': 'var(--amber)', 'Lessons Learned': 'var(--accent)',
  'Catatan Penting': 'var(--red)', 'Lainnya': 'var(--text-muted)',
}

const TIPE_ICON = {
  'Keputusan Rapat':'⚖️','SOP & Prosedur':'📋','Sejarah':'📜',
  'Lessons Learned':'💡','Catatan Penting':'📌','Lainnya':'📝',
}

const ADMIN_ROLES = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL']

function canManage(user) { return user?.roles?.some(r => ADMIN_ROLES.includes(r.roleType)) }

function formatTgl(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })
}

const EMPTY_FORM = { judul:'', konten:'', tipe:'Keputusan Rapat', tanggal: new Date().toISOString().slice(0,10), tags:'' }

export default function Memori() {
  const { user } = useAuth()
  const isAdmin  = canManage(user)

  const { data: rawItems, loading, error, refetch } = useApi('/api/memori')
  const items = rawItems ?? []

  const [selected,   setSelected]   = useState(null)
  const [showForm,   setShowForm]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState('')
  const [filterTipe, setFilterTipe] = useState('')
  const [search,     setSearch]     = useState('')
  const [deleting,   setDeleting]   = useState(null)
  const [loadDetail, setLoadDetail] = useState(false)

  const filtered = useMemo(() => {
    let list = items
    if (filterTipe) list = list.filter(m => m.tipe === filterTipe)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.judul.toLowerCase().includes(q) || (m.tags||'').toLowerCase().includes(q))
    }
    return list
  }, [items, filterTipe, search])

  function openCreate() {
    setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true)
  }
  function openEdit(m) {
    setEditTarget(m)
    setForm({ judul: m.judul, konten: m.konten || '', tipe: m.tipe, tanggal: m.tanggal?.slice(0,10) || '', tags: m.tags || '' })
    setFormError(''); setShowForm(true); setSelected(null)
  }

  async function openDetail(m) {
    setLoadDetail(true)
    try {
      const res = await api.get(`/api/memori/${m.id}`)
      setSelected(res.data.data)
    } catch { setSelected(m) }
    finally { setLoadDetail(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault(); setFormError('')
    if (!form.judul.trim() || !form.konten.trim()) { setFormError('Judul dan konten wajib diisi'); return }
    setSubmitting(true)
    try {
      if (editTarget) await api.put(`/api/memori/${editTarget.id}`, form)
      else            await api.post('/api/memori', form)
      setShowForm(false); setEditTarget(null); await refetch()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(m) {
    if (!window.confirm(`Hapus "${m.judul}"?`)) return
    setDeleting(m.id)
    try { await api.delete(`/api/memori/${m.id}`); if (selected?.id===m.id) setSelected(null); await refetch() }
    catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
    finally { setDeleting(null) }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>🧠 Memori Institusional</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Keputusan, SOP, sejarah, dan catatan penting ekosistem {ECOSYSTEM_NAME}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ Tambah Catatan</button>}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Cari judul atau tag..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, maxWidth: 280, paddingLeft: 12 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['', ...TIPE_LIST].map(t => (
            <button key={t||'semua'} onClick={() => setFilterTipe(t)}
              style={{ padding: '5px 11px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filterTipe === t ? (TIPE_COLOR[t] || 'var(--accent)') : 'var(--bg-card)',
                color: filterTipe === t ? '#fff' : 'var(--text-secondary)' }}>
              {t ? `${TIPE_ICON[t]} ${t}` : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Memuat...</div>}
      {error   && <div style={{ color: 'var(--red)', padding: 16 }}>{error}</div>}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          {items.length === 0 ? (isAdmin ? 'Belum ada catatan. Klik "+ Tambah Catatan".' : 'Belum ada catatan tersedia.') : 'Tidak ada yang cocok.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(m => {
          const color = TIPE_COLOR[m.tipe] || 'var(--text-muted)'
          return (
            <div key={m.id} className="card" style={{ borderLeft: `4px solid ${color}`, cursor: 'pointer', padding: '14px 18px' }}
              onClick={() => openDetail(m)} role="button" tabIndex={0} onKeyDown={onActivate(() => openDetail(m))}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color, background: alfa(color, 9), borderRadius: 99, padding: '2px 8px' }}>
                      {TIPE_ICON[m.tipe]} {m.tipe}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTgl(m.tanggal)}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{m.judul}</div>
                  {m.tags && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {m.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <span key={t} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 4, padding: '1px 6px' }}>#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(m)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:14,padding:'2px 6px' }}>✏️</button>
                    <button onClick={() => handleDelete(m)} disabled={deleting===m.id} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:16,padding:'2px 4px' }}>×</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail drawer */}
      {(selected || loadDetail) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 200, padding: 16 }}
          onClick={() => setSelected(null)}>
          <div style={{ width: '100%', maxWidth: 600, maxHeight: 'calc(100vh - 32px)', background: 'var(--bg-card)', borderRadius: 16, overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {loadDetail ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</div>
            ) : selected && (() => {
              const color = TIPE_COLOR[selected.tipe] || 'var(--text-muted)'
              return (
                <>
                  <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, background: alfa(color, 9), borderRadius: 99, padding: '2px 8px' }}>
                          {TIPE_ICON[selected.tipe]} {selected.tipe}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTgl(selected.tanggal)}</span>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>{selected.judul}</div>
                      {selected.author && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Dicatat oleh {selected.author.nama}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {isAdmin && <button onClick={() => openEdit(selected)} style={{ background:'var(--bg)',border:'none',borderRadius:8,cursor:'pointer',color:'var(--text-secondary)',fontSize:13,padding:'6px 10px' }}>✏️ Edit</button>}
                      <button onClick={() => setSelected(null)} style={{ background:'var(--bg)',border:'none',borderRadius:8,cursor:'pointer',color:'var(--text-muted)',fontSize:18,padding:'4px 10px' }}>×</button>
                    </div>
                  </div>
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {selected.konten}
                    </div>
                    {selected.tags && (
                      <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                          <span key={t} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 6, padding: '2px 8px' }}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Form drawer */}
      {showForm && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',zIndex:300,padding:16 }}
          onClick={() => { setShowForm(false); setEditTarget(null) }}>
          <div style={{ width:'100%',maxWidth:520,maxHeight:'calc(100vh - 32px)',background:'var(--bg-card)',borderRadius:16,overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'20px 24px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div style={{ fontSize:16,fontWeight:800,color:'var(--text)' }}>{editTarget ? 'Edit Catatan' : 'Tambah Catatan'}</div>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:20 }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:14 }}>
              <div className="form-group">
                <label className="form-label">Judul *</label>
                <input className="form-input" style={{ paddingLeft:12 }} value={form.judul}
                  onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="Judul catatan" required />
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                <div className="form-group">
                  <label className="form-label">Tipe</label>
                  <select className="form-input" style={{ paddingLeft:10 }} value={form.tipe}
                    onChange={e => setForm(f => ({ ...f, tipe: e.target.value }))}>
                    {TIPE_LIST.map(t => <option key={t} value={t}>{TIPE_ICON[t]} {t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input type="date" className="form-input" style={{ paddingLeft:12 }} value={form.tanggal}
                    onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Konten *</label>
                <textarea className="form-input" rows={10} style={{ paddingLeft:12,paddingTop:10,resize:'vertical',fontFamily:'inherit',lineHeight:1.7 }}
                  value={form.konten} onChange={e => setForm(f => ({ ...f, konten: e.target.value }))}
                  placeholder="Tulis isi catatan di sini..." required />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (pisah dengan koma)</label>
                <input className="form-input" style={{ paddingLeft:12 }} value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="contoh: kebijakan, 2024, SDM" />
              </div>
              {formError && <div className="login-error">{formError}</div>}
              <div style={{ display:'flex',gap:8 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex:1 }}>
                  {submitting ? <><span className="spinner"/>Menyimpan...</> : editTarget ? 'Simpan Perubahan' : 'Tambah Catatan'}
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
