import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggalPendek } from '../../utils/format'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function daysLeft(deadline) {
  const diff = new Date(deadline) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function deadlineColor(days) {
  if (days < 0)   return 'var(--red)'
  if (days < 14)  return 'var(--amber)'
  return 'var(--green)'
}

export default function Goals() {
  const { user }  = useAuth()
  const { data: circles } = useApi('/api/dashboard/overview')
  const { data: goals, loading, error, refetch } = useApi('/api/goals')

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [form, setForm] = useState({
    nama: '', targetValue: '', satuan: '', deadline: '', cakupan: '',
  })
  const [submitting, setSubmit] = useState(false)
  const [formError, setFormError] = useState(null)
  const [filterCircle, setFilter] = useState('all')

  const [editGoalId, setEditGoalId] = useState(null)
  const [editGoalForm, setEditGoalForm] = useState({
    nama: '', targetValue: '', satuan: '', deadline: '', cakupan: '',
  })
  const [editGoalSubmitting, setEditGoalSubmit] = useState(false)
  const [editGoalError, setEditGoalError] = useState(null)

  const canCreate = user?.roles?.some(r =>
    ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'].includes(r.roleType)
  )

  const canEditGoal = (goal) => {
    const roles = user?.roles ?? []
    if (roles.some(r => ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType))) return true
    if (goal.circle && roles.some(r => r.roleType === 'KEPALA_CIRCLE' && r.circleId === goal.circle.id)) return true
    if (goal.rumahUsaha && roles.some(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId === goal.rumahUsaha.id)) return true
    if (goal.studio && roles.some(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType) && r.studioId === goal.studio.id)) return true
    if (!goal.studio && goal.myStudioInCircle && roles.some(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType))) return true
    if (!goal.studio && goal.myStudioInRumahUsaha && roles.some(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType))) return true
    return false
  }

  const studioList = useMemo(() => {
    const seen = new Set()
    return (goals ?? []).filter(g => g.studio && !seen.has(g.studio.id) && seen.add(g.studio.id)).map(g => g.studio)
  }, [goals])

  const filtered = (goals ?? []).filter(g => {
    if (filterCircle === 'all') return true
    if (filterCircle === 'global') return !g.circleId && !g.rumahUsahaId && !g.studioId
    if (filterCircle.startsWith('studio:')) return g.studioId === filterCircle.slice(7)
    if (filterCircle.startsWith('rumah:'))  return g.rumahUsahaId === filterCircle.slice(6)
    return g.circleId === filterCircle
  })

  // "Cakupan" gabung circleId/rumahUsahaId jadi satu dropdown (cuma salah satu yang boleh
  // terisi, atau dua-duanya kosong buat goal level Ekosistem) -- dipecah lagi pas dikirim ke API.
  const cakupanToIds = (cakupan) => {
    const [scope, id] = (cakupan || '').split(':')
    return { circleId: scope === 'circle' ? id : null, rumahUsahaId: scope === 'rumah' ? id : null }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmit(true)
    setFormError(null)
    try {
      const { cakupan, ...rest } = form
      await api.post('/api/goals', { ...rest, ...cakupanToIds(cakupan) })
      setShowForm(false)
      setForm({ nama: '', targetValue: '', satuan: '', deadline: '', cakupan: '' })
      refetch()
    } catch (err) {
      setFormError(err.response?.data?.message || 'Gagal menyimpan goal')
    } finally {
      setSubmit(false)
    }
  }

  const handleUpdateProgress = async (id) => {
    try {
      await api.patch(`/api/goals/${id}`, { currentValue: Number(editVal) })
      setEditId(null)
      await refetch()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal update progress')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus goal ini?')) return
    try {
      await api.delete(`/api/goals/${id}`)
      await refetch()
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus goal')
    }
  }

  const openEditGoal = (g) => {
    setEditGoalId(g.id)
    setEditGoalForm({
      nama: g.nama,
      targetValue: String(g.targetValue),
      satuan: g.satuan,
      deadline: g.deadline?.slice(0, 10) ?? '',
      cakupan: g.circleId ? `circle:${g.circleId}` : g.rumahUsahaId ? `rumah:${g.rumahUsahaId}` : '',
    })
    setEditGoalError(null)
  }

  const handleUpdateGoal = async (e, id) => {
    e.preventDefault()
    setEditGoalSubmit(true)
    setEditGoalError(null)
    try {
      const { cakupan, ...rest } = editGoalForm
      await api.patch(`/api/goals/${id}`, { ...rest, ...cakupanToIds(cakupan) })
      setEditGoalId(null)
      await refetch()
    } catch (err) {
      setEditGoalError(err.response?.data?.message || 'Gagal mengubah goal')
    } finally {
      setEditGoalSubmit(false)
    }
  }

  const circleList     = circles?.circles ?? []
  const rumahUsahaList = circles?.rumahUsaha ?? []

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Goals & Roadmap</h1>
            <p>Target dan capaian ekosistem {ECOSYSTEM_NAME}</p>
          </div>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {showForm ? 'Tutup' : 'Tambah Goal'}
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><span className="card-title">Goal Baru</span></div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Nama Goal *</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="contoh: Omset $10K/bulan"
                  value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Target *</label>
                <input type="number" min="0" className="form-input" style={{ paddingLeft: 14 }} placeholder="10000"
                  value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Satuan *</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="USD / anggota / karya"
                  value={form.satuan} onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Deadline *</label>
                <input type="date" className="form-input" style={{ paddingLeft: 14 }}
                  value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Cakupan (opsional)</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.cakupan} onChange={e => setForm(f => ({ ...f, cakupan: e.target.value }))}>
                  <option value="">Ekosistem (global)</option>
                  {circleList.length > 0 && (
                    <optgroup label="Circle">
                      {circleList.map(c => <option key={c.id} value={`circle:${c.id}`}>{c.nama}</option>)}
                    </optgroup>
                  )}
                  {rumahUsahaList.length > 0 && (
                    <optgroup label="Rumah Usaha">
                      {rumahUsahaList.map(r => <option key={r.id} value={`rumah:${r.id}`}>{r.nama}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
            {formError && <div className="login-error" style={{ marginBottom: 12 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 130 }}>
                {submitting ? <><span className="spinner"/>Menyimpan...</> : 'Simpan Goal'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setFormError(null) }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ id: 'all', nama: 'Semua', colorHex: 'var(--text-muted)' }, { id: 'global', nama: 'Global', colorHex: 'var(--text-muted)' }, ...circleList].map(c => (
          <button key={c.id}
            className={`btn ${filterCircle === c.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={() => setFilter(c.id)}>
            {c.id !== 'all' && c.id !== 'global' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.colorHex, display: 'inline-block', marginRight: 6 }} />}
            {c.nama}
          </button>
        ))}
        {rumahUsahaList.map(r => (
          <button key={r.id}
            className={`btn ${filterCircle === `rumah:${r.id}` ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={() => setFilter(`rumah:${r.id}`)}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.colorHex, display: 'inline-block', marginRight: 6 }} />
            {r.nama}
          </button>
        ))}
        {studioList.length > 0 && (
          <>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 4px' }}>|</span>
            {studioList.map(s => (
              <button key={s.id}
                className={`btn ${filterCircle === `studio:${s.id}` ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '7px 14px', fontSize: 12 }}
                onClick={() => setFilter(`studio:${s.id}`)}>
                <span style={{ fontSize: 10, marginRight: 4, opacity: 0.7 }}>Studio</span>
                {s.nama}
              </button>
            ))}
          </>
        )}
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada goal</div>
          {canCreate && <div style={{ fontSize: 13, marginTop: 6 }}>Klik "Tambah Goal" untuk mulai</div>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(g => {
            const pct  = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
            const days = daysLeft(g.deadline)
            const dColor = deadlineColor(days)
            const circColor = (g.circle ?? g.rumahUsaha)?.colorHex ?? 'var(--text-muted)'

            if (editGoalId === g.id) {
              return (
                <div key={g.id} className="card" style={{ borderTop: `3px solid ${circColor}` }}>
                  <form onSubmit={e => handleUpdateGoal(e, g.id)}>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">Nama Goal *</label>
                      <input className="form-input" style={{ paddingLeft: 14 }}
                        value={editGoalForm.nama} onChange={e => setEditGoalForm(f => ({ ...f, nama: e.target.value }))} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div className="form-group">
                        <label className="form-label">Target *</label>
                        <input type="number" min="0" className="form-input" style={{ paddingLeft: 14 }}
                          value={editGoalForm.targetValue} onChange={e => setEditGoalForm(f => ({ ...f, targetValue: e.target.value }))} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Satuan *</label>
                        <input className="form-input" style={{ paddingLeft: 14 }}
                          value={editGoalForm.satuan} onChange={e => setEditGoalForm(f => ({ ...f, satuan: e.target.value }))} required />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Deadline *</label>
                        <input type="date" className="form-input" style={{ paddingLeft: 14 }}
                          value={editGoalForm.deadline} onChange={e => setEditGoalForm(f => ({ ...f, deadline: e.target.value }))} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Cakupan</label>
                        <select className="form-input" style={{ paddingLeft: 10 }}
                          value={editGoalForm.cakupan} onChange={e => setEditGoalForm(f => ({ ...f, cakupan: e.target.value }))}>
                          <option value="">Ekosistem (global)</option>
                          {circleList.length > 0 && (
                            <optgroup label="Circle">
                              {circleList.map(c => <option key={c.id} value={`circle:${c.id}`}>{c.nama}</option>)}
                            </optgroup>
                          )}
                          {rumahUsahaList.length > 0 && (
                            <optgroup label="Rumah Usaha">
                              {rumahUsahaList.map(r => <option key={r.id} value={`rumah:${r.id}`}>{r.nama}</option>)}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </div>
                    {editGoalError && <div className="login-error" style={{ marginBottom: 12 }}>{editGoalError}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" className="btn btn-primary" disabled={editGoalSubmitting} style={{ flex: 1 }}>
                        {editGoalSubmitting ? <><span className="spinner"/>Menyimpan...</> : 'Simpan'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditGoalId(null)}>Batal</button>
                    </div>
                  </form>
                </div>
              )
            }

            return (
              <div key={g.id} className="card" style={{ borderTop: `3px solid ${circColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {g.nama}
                      {g.tercapai && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--green)', color: '#fff', borderRadius: 99, padding: '2px 8px' }}>
                          🏆 Tercapai
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {(g.circle ?? g.rumahUsaha) && (
                        <span style={{ fontSize: 11, color: circColor, fontWeight: 600 }}>
                          {(g.circle ?? g.rumahUsaha).nama}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: dColor, fontWeight: 600 }}>
                        {days < 0 ? `${Math.abs(days)}h lewat` : `${days}h lagi`}
                      </span>
                    </div>
                  </div>
                  {canEditGoal(g) && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => openEditGoal(g)} title="Edit goal"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '2px 6px' }}>✏️</button>
                      <button onClick={() => handleDelete(g.id)} title="Hapus goal"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '2px 6px' }}>×</button>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: circColor }}>
                      {g.currentValue.toLocaleString('id-ID')}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{g.satuan}</span>
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      dari {g.targetValue.toLocaleString('id-ID')} {g.satuan}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'color-mix(in srgb, var(--text) 6%, transparent)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${pct}%`,
                      background: pct >= 100 ? 'var(--green)' : circColor,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Deadline: {formatTanggalPendek(g.deadline)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? 'var(--green)' : circColor }}>
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Update Progress */}
                {canEditGoal(g) && (
                  editId === g.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" min="0"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        placeholder={`Current value (${g.satuan})`}
                        className="form-input" style={{ paddingLeft: 10, fontSize: 13, flex: 1 }} />
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => handleUpdateProgress(g.id)}>Update</button>
                      <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => setEditId(null)}>×</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12, padding: '7px 0' }}
                      onClick={() => { setEditId(g.id); setEditVal(String(g.currentValue)) }}>
                      ✏️ Update Progress
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
