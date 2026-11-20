import { useState, useMemo } from 'react'
import { useApi }  from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api         from '../../services/api'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import ItemRingkas from '../../components/common/ItemRingkas'

const ADMIN_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']
const AKSES_OPTIONS = ['SEMUA', 'KOORDINATOR', 'KEPALA_CIRCLE']

function canManage(user) {
  return user?.roles?.some(r => ADMIN_ROLES.includes(r.roleType))
}

const EMPTY_FORM = { judul: '', deskripsi: '', linkDrive: '', kategori: '', aksesRole: 'SEMUA', urutan: 0 }

export default function Modul() {
  const { user } = useAuth()
  const isAdmin  = canManage(user)

  const { data: raw, loading, error, refetch } = useApi('/api/modul')
  const moduls = raw ?? []

  const [filterKat,  setFilterKat]  = useState('')
  const [search,     setSearch]     = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [deleteId,   setDeleteId]   = useState(null)

  const kategoriList = useMemo(() => [...new Set(moduls.map(m => m.kategori))].sort(), [moduls])

  const filtered = useMemo(() => {
    let list = moduls
    if (filterKat) list = list.filter(m => m.kategori === filterKat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.judul.toLowerCase().includes(q) ||
        (m.deskripsi || '').toLowerCase().includes(q) ||
        m.kategori.toLowerCase().includes(q)
      )
    }
    return list
  }, [moduls, filterKat, search])

  function openCreate() {
    setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true)
  }
  function openEdit(m) {
    setEditTarget(m)
    setForm({ judul: m.judul, deskripsi: m.deskripsi || '', linkDrive: m.linkDrive, kategori: m.kategori, aksesRole: m.aksesRole || 'SEMUA', urutan: m.urutan })
    setFormError(''); setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.judul.trim() || !form.linkDrive.trim() || !form.kategori.trim()) {
      setFormError('Judul, link, dan kategori wajib diisi'); return
    }
    setSaving(true)
    try {
      if (editTarget) await api.put(`/api/modul/${editTarget.id}`, form)
      else            await api.post('/api/modul', form)
      setShowForm(false); await refetch()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteId) return
    try { await api.delete(`/api/modul/${deleteId}`); setDeleteId(null); await refetch() }
    catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>📚 Bank Modul</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Kumpulan materi, SOP, dan panduan internal {ECOSYSTEM_NAME}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>+ Tambah Modul</button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Cari modul..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, maxWidth: 320, paddingLeft: 12 }} />
        <select className="form-input" style={{ paddingLeft: 10, minWidth: 180, maxWidth: 240 }}
          value={filterKat} onChange={e => setFilterKat(e.target.value)}>
          <option value="">Semua Kategori</option>
          {kategoriList.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        {filterKat && (
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => setFilterKat('')}>Reset</button>
        )}
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Memuat...</div>}
      {error   && <div style={{ color: 'var(--red)', padding: 16 }}>{error}</div>}

      {!loading && !error && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              {moduls.length === 0
                ? isAdmin ? 'Belum ada modul. Klik "+ Tambah Modul" untuk mulai.' : 'Belum ada materi tersedia.'
                : 'Tidak ada modul yang cocok.'}
            </div>
          ) : (
            <>
            {/* Desktop: tabel */}
            <div className="table-wrap responsive-table">
              <table className="table-sticky-2" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[['No','44px'],['Judul','230px'],['Kategori','140px'],['Akses','110px'],['Link','110px'],isAdmin&&['Aksi','90px']].filter(Boolean).map(([h, w]) => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap', width: w || undefined }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', minWidth: 200 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{m.judul}</div>
                        {m.deskripsi && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.deskripsi}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {m.kategori}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {m.aksesRole === 'SEMUA' ? (
                          <span style={{ fontSize: 11, color: 'var(--green)' }}>Semua</span>
                        ) : isAdmin ? (
                          // Server sudah menyaring daftar modul sesuai akses masing-masing user (canReadModul),
                          // jadi badge gembok cuma relevan buat admin yang mengelola — bukan tanda "kamu terkunci",
                          // karena modul yang muncul di sini pasti sudah bisa dibuka user yang melihatnya.
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 13%, transparent)', borderRadius: 99, padding: '2px 8px' }}>
                            🔒 {m.aksesRole}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Tersedia</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <a href={m.linkDrive} target="_blank" rel="noopener noreferrer"
                          className="btn btn-primary" style={{ fontSize: 12, padding: '5px 14px', textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                          Buka ↗
                        </a>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEdit(m)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 15, padding: '2px 4px' }}>✏️</button>
                            <button onClick={() => setDeleteId(m.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '2px 4px' }}>×</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: list ringkas, ketuk baris untuk detail */}
            <div className="responsive-cards list-ringkas" style={{ margin: 12 }}>
              {filtered.map((m, i) => (
                <ItemRingkas key={m.id} judul={`${i + 1}. ${m.judul}`} sub={m.kategori}
                  nilai={m.aksesRole === 'SEMUA' || !isAdmin ? null : <span style={{ fontSize: 10, color: 'var(--amber)' }}>🔒 {m.aksesRole}</span>}>
                  {m.deskripsi && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{m.deskripsi}</div>}
                  <div className="data-card-row">
                    <span className="data-card-label">Akses</span>
                    <span className="data-card-value">
                      {m.aksesRole === 'SEMUA' ? (
                        <span style={{ fontSize: 11, color: 'var(--green)' }}>Semua</span>
                      ) : isAdmin ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 13%, transparent)', borderRadius: 99, padding: '2px 8px' }}>
                          🔒 {m.aksesRole}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Tersedia</span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <a href={m.linkDrive} target="_blank" rel="noopener noreferrer"
                      className="btn btn-primary" style={{ flex: 1, fontSize: 12, padding: '6px 14px', textDecoration: 'none', textAlign: 'center' }}>
                      Buka ↗
                    </a>
                    {isAdmin && (
                      <>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openEdit(m)}>✏️ Ubah</button>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px', color: 'var(--red)' }} onClick={() => setDeleteId(m.id)}>Hapus</button>
                      </>
                    )}
                  </div>
                </ItemRingkas>
              ))}
            </div>
            </>
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 300, padding: 16 }}
          onClick={() => { setShowForm(false); setEditTarget(null) }}>
          <div style={{ width: '100%', maxWidth: 500, maxHeight: 'calc(100vh - 32px)', background: 'var(--bg-card)', borderRadius: 16, overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{editTarget ? 'Edit Modul' : 'Tambah Modul'}</div>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Judul *</label>
                <input className="form-input" style={{ paddingLeft: 12 }}
                  value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                  placeholder="Nama modul / dokumen" required />
              </div>

              <div className="form-group">
                <label className="form-label">Link Google Drive *</label>
                <input className="form-input" style={{ paddingLeft: 12 }}
                  value={form.linkDrive} onChange={e => setForm(f => ({ ...f, linkDrive: e.target.value }))}
                  placeholder="https://drive.google.com/..." required />
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi Singkat</label>
                <input className="form-input" style={{ paddingLeft: 12 }}
                  value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                  placeholder="Ringkasan isi (opsional)" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Kategori *</label>
                  <input list="kat-opts" className="form-input" style={{ paddingLeft: 12 }}
                    value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
                    placeholder="Ketik atau pilih" required />
                  <datalist id="kat-opts">
                    {kategoriList.map(k => <option key={k} value={k} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Urutan</label>
                  <input type="number" min="0" className="form-input" style={{ paddingLeft: 12 }}
                    value={form.urutan} onChange={e => setForm(f => ({ ...f, urutan: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Akses</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.aksesRole} onChange={e => setForm(f => ({ ...f, aksesRole: e.target.value }))}>
                  {AKSES_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {formError && <div className="login-error">{formError}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Modul'}
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setEditTarget(null) }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="card" style={{ maxWidth: 360, padding: 28, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Hapus modul ini?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Batal</button>
              <button className="btn btn-danger" onClick={handleDelete}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
