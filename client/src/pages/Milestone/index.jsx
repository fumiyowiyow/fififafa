import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggalPendek } from '../../utils/format'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { alfa } from '../../utils/warna'

const TIPE_OPTIONS = [
  '🏆 Pencapaian Omset',
  '🎉 Anggota Baru',
  '⭐ Promosi Jabatan',
  '🚀 Peluncuran Studio',
  '💰 First Order',
  '🔥 Streak Laporan',
  '🤝 Kerjasama Baru',
  '🏅 Penghargaan',
  'Lainnya',
]

const MILESTONE_COLORS = [
  'var(--amber)','var(--green)','var(--accent)','#0D9488','#EA580C','var(--cyan)','var(--pink)','var(--red)',
]

function getColor(tipe) {
  let h = 0
  for (const c of (tipe ?? '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return MILESTONE_COLORS[Math.abs(h) % MILESTONE_COLORS.length]
}

export default function Milestone() {
  const { user }  = useAuth()
  const { data, loading, error, refetch } = useApi('/api/milestones')
  const { data: studios } = useApi('/api/kanban/studios')
  const { data: members } = useApi('/api/members?limit=200')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipe: TIPE_OPTIONS[0], deskripsi: '',
    studioId: '', userId: '', shareAsPengumuman: true,
  })
  const [submitting, setSubmit] = useState(false)
  const [msg, setMsg] = useState(null)

  const canPost = user?.roles?.some(r =>
    ['ADVISOR','KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmit(true); setMsg(null)
    try {
      await api.post('/api/milestones', form)
      setMsg({ type: 'success', text: form.shareAsPengumuman
        ? 'Milestone disimpan & dibagikan ke Pengumuman! 🎉'
        : 'Milestone berhasil dicatat!' })
      setForm(f => ({ ...f, deskripsi: '', studioId: '', userId: '' }))
      setShowForm(false)
      refetch()
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menyimpan' })
    }
    setSubmit(false)
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Milestone & Celebration</h1>
            <p>Rayakan pencapaian tim ekosistem {ECOSYSTEM_NAME} 🎉</p>
          </div>
          {canPost && (
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
              🏆 {showForm ? 'Tutup' : 'Catat Milestone'}
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), color-mix(in srgb, var(--cyan) 5%, transparent))' }}>
          <div className="card-header"><span className="card-title">🏆 Milestone Baru</span></div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Tipe Pencapaian *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TIPE_OPTIONS.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, tipe: t }))}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${form.tipe === t ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.tipe === t ? 'var(--accent-subtle)' : 'transparent',
                      color: form.tipe === t ? 'var(--accent-light)' : 'var(--text-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>{t}</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi Pencapaian *</label>
              <textarea className="form-input"
                style={{ paddingLeft: 14, paddingTop: 10, minHeight: 90, resize: 'vertical' }}
                placeholder="Ceritakan pencapaian ini... misal: Keiko Studio mencapai omset $1,000 pertama kali!"
                value={form.deskripsi}
                onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Studio (opsional)</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.studioId} onChange={e => setForm(f => ({ ...f, studioId: e.target.value }))}>
                  <option value="">— Ekosistem —</option>
                  {studios?.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Anggota (opsional)</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
                  <option value="">— Semua —</option>
                  {members?.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.shareAsPengumuman}
                onChange={e => setForm(f => ({ ...f, shareAsPengumuman: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                📣 Bagikan ke Pengumuman (semua anggota dapat melihat)
              </span>
            </label>

            {msg && (
              <div className="login-error" style={{
                background: msg.type === 'success' ? 'var(--green-subtle)' : 'var(--red-subtle)',
                color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
                borderColor: msg.type === 'success' ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'color-mix(in srgb, var(--red) 20%, transparent)',
              }}>{msg.text}</div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 160 }}>
                {submitting ? <><span className="spinner"/>Menyimpan...</> : '🏆 Simpan Milestone'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Timeline */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      ) : !data?.length ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Belum ada milestone tercatat</div>
          <div style={{ fontSize: 13 }}>Rayakan pencapaian pertama tim kamu!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map(m => {
            const color = m.circleColor ?? getColor(m.tipe)
            return (
              <div key={m.id} className="card" style={{
                padding: 20,
                borderLeft: `4px solid ${color}`,
                background: `linear-gradient(135deg, ${color}08, transparent)`,
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: `${alfa(color, 13)}`, border: `2px solid ${alfa(color, 25)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>
                    {m.tipe.split(' ')[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                      <span className="badge" style={{ fontSize: 11, background: `${alfa(color, 13)}`, color, border: `1px solid ${alfa(color, 25)}` }}>
                        {m.tipe}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatTanggalPendek(m.tanggal)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 8, fontWeight: 500 }}>
                      {m.deskripsi}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {m.namaStudio && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          🎨 {m.namaStudio}
                        </span>
                      )}
                      {m.namaUser && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          👤 {m.namaUser}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
