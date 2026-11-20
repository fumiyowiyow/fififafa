import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggalPendek } from '../../utils/format'
import { getRoleLabel, getHighestRole, getRoleOrgUnit, TIER_BADGE } from '../../utils/roles'
import { useIsMobile } from '../../hooks/useIsMobile'
import PenilaianKaderTab from './PenilaianKaderTab'
import RingkasanPerforma from './RingkasanPerforma'

// Tier dari role OPERASIONAL kader (bukan getHighestRole keseluruhan -- orang bisa punya role
// senior di studio lain, tapi yang relevan buat tier di sini cuma posisi Koordinator/Kader/
// Karyawan/Magang-nya). Sama persis statusTier() di server/src/controllers/penilaianKader.js.
const TIER_RANK = { KOORDINATOR: 0, KADER: 1, KARYAWAN: 1, MAGANG: 2 }
const TIER_BY_RANK = { 0: 'tetap', 1: 'karyawan', 2: 'magang' }
function kaderTier(roles) {
  const relevant = roles.filter(r => r.roleType in TIER_RANK && r.studio)
  if (!relevant.length) return null
  return TIER_BY_RANK[Math.min(...relevant.map(r => TIER_RANK[r.roleType]))]
}

const EVENT_TYPES = [
  'Bergabung', 'Promosi', 'Pindah Studio', 'Pindah Circle',
  'Pindah Pendampingan', 'Mulai Project', 'SKB (Jadi Studio)',
  'Punya Rumah Usaha', 'Punya Circle',
  'Penghargaan', 'Goal Tercapai', 'Peringatan', 'Resign', 'Lainnya',
]

const EVENT_ICONS = {
  'Bergabung':            '🎉',
  'Promosi':              '⬆️',
  'Pindah Studio':        '🔄',
  'Pindah Circle':        '🔄',
  'Pindah Pendampingan':  '🤝',
  'Mulai Project':        '🚀',
  'SKB (Jadi Studio)':    '🏢',
  'Punya Rumah Usaha':    '🏠',
  'Punya Circle':         '⭕',
  'Penghargaan':          '🏆',
  'Goal Tercapai':        '🏆',
  'Peringatan':           '⚠️',
  'Resign':               '👋',
  'Lainnya':              '📝',
}

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function Kader() {
  const { user }  = useAuth()
  const isMobile  = useIsMobile()
  const { data: allEvents, loading, refetch } = useApi('/api/kader?limit=50')
  const [pageView, setPageView] = useState('ringkasan') // 'detail' | 'ringkasan'
  const [autoOpenPenilaian, setAutoOpenPenilaian] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [timelineData, setTimeline]     = useState(null)
  const [loadingTimeline, setLoadingTL] = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm] = useState({ userId: '', tipeEvent: 'Bergabung', deskripsi: '', tanggal: new Date().toISOString().split('T')[0] })
  const [submitting, setSubmit]         = useState(false)
  const [searchUser, setSearchUser]     = useState('')
  const [studioFilter, setStudioFilter] = useState('Semua')
  const [tierFilter, setTierFilter]     = useState('semua') // 'semua' | 'tetap' | 'karyawan' | 'magang'
  const [editEvent, setEditEvent]       = useState(null)
  const [editForm, setEditForm]         = useState({})
  const [savingEdit, setSavingEdit]     = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState('timeline')
  // Laporan Perkembangan Kader (JurnalTalent) jadi ARSIP READ-ONLY sejak 30 Juli 2026 -- 4 field
  // naratifnya digabung ke Penilaian Kader (PenilaianKaderTab.jsx), gak ada entri baru dibuat lagi
  // di sini, cuma dipertahankan buat riwayat lama tetap bisa dilihat. Makanya cuma butuh
  // jurnalList/loadingJurnal (baca), gak ada state form/save/edit lagi.
  const [jurnalList, setJurnalList]     = useState([])
  const [loadingJurnal, setLoadingJurnal] = useState(false)

  const { data: members } = useApi('/api/members?limit=200')

  const canAdd = user?.roles?.some(r =>
    ['ADVISOR','KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  const canViewJurnal = user?.roles?.some(r =>
    ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  const isFullAdmin = user?.roles?.some(r =>
    ['ADVISOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  const canEditEvent = (ev) => {
    if (isFullAdmin) return true
    if (ev.dicatatOleh === user?.id) return true
    // KOORDINATOR/PENDAMPING of the kader's studio can also edit
    const kaderStudioIds = new Set(
      (members?.find(m => m.id === selectedUser)?.roles ?? []).map(r => r.studioId).filter(Boolean)
    )
    return kaderStudioIds.size > 0 && (user?.roles ?? []).some(r =>
      ['KOORDINATOR','PENDAMPING'].includes(r.roleType) && kaderStudioIds.has(r.studioId)
    )
  }

  const loadTimeline = async (userId) => {
    setSelectedUser(userId)
    setLoadingTL(true)
    setActiveDetailTab('timeline')
    try {
      const r = await api.get(`/api/kader/${userId}`)
      setTimeline(r.data.data)
    } catch {}
    setLoadingTL(false)
  }

  // Klik baris di Ringkasan Performa -> balik ke view detail, langsung ke tab Penilaian Kader.
  const selectFromRingkasan = async (userId) => {
    setAutoOpenPenilaian(false)
    setPageView('detail')
    await loadTimeline(userId)
    setActiveDetailTab('penilaian')
  }

  // Tombol "+ Nilai" di Ringkasan Performa -> sama kayak selectFromRingkasan, tapi form penilaian
  // langsung kebuka juga (gak perlu klik "+ Penilaian Baru" lagi).
  const quickNilaiFromRingkasan = async (userId) => {
    setAutoOpenPenilaian(true)
    setPageView('detail')
    await loadTimeline(userId)
    setActiveDetailTab('penilaian')
  }

  const loadJurnal = async (userId) => {
    setLoadingJurnal(true)
    try {
      const r = await api.get(`/api/jurnal-talent/${userId}`)
      setJurnalList(r.data.data ?? [])
    } catch {}
    setLoadingJurnal(false)
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmit(true)
    try {
      await api.post('/api/kader', form)
      setShowForm(false)
      setForm(f => ({ ...f, deskripsi: '' }))
      refetch()
      if (form.userId === selectedUser) loadTimeline(selectedUser)
    } catch {}
    setSubmit(false)
  }

  const openEdit = (ev) => {
    setEditEvent(ev)
    setEditForm({
      tipeEvent: ev.tipeEvent,
      deskripsi: ev.deskripsi,
      tanggal:   ev.tanggal?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault(); setSavingEdit(true)
    try {
      await api.put(`/api/kader/${editEvent.id}`, editForm)
      setEditEvent(null)
      if (selectedUser) loadTimeline(selectedUser)
    } catch {} finally { setSavingEdit(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus riwayat ini? Data tidak bisa dikembalikan.')) return
    try {
      await api.delete(`/api/kader/${id}`)
      if (selectedUser) loadTimeline(selectedUser)
      refetch()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
  }

  const allStudios = useMemo(() => {
    if (!members) return []
    const names = [...new Set(members.flatMap(m => m.roles.map(r => r.studio?.nama).filter(Boolean)))]
    return ['Semua', ...names.sort()]
  }, [members])

  const filteredMembers = useMemo(() => {
    if (!members) return []
    return members.filter(m => {
      // Halaman ini buat pantau performa KADER (staf operasional studio) -- Pendamping/Advisor/
      // Kepala Ekosistem/Kepala Circle/Kepala Rumah Usaha/Co-Admin/pemilik saham/Dignity-only
      // BUKAN kader, gak perlu dinilai di sini (keputusan eksplisit user), meskipun mereka punya
      // posisi di suatu studio. Cuma posisi operasional beneran (Koordinator/Kader/Karyawan/
      // Magang) yang bikin orang itu relevan buat dievaluasi.
      const adaPosisiKader = m.roles.some(r => r.studio && ['KOORDINATOR','KADER','KARYAWAN','MAGANG'].includes(r.roleType))
      const matchSearch = m.nama.toLowerCase().includes(searchUser.toLowerCase())
      const matchStudio = studioFilter === 'Semua' || m.roles.some(r => r.studio?.nama === studioFilter)
      const matchTier = tierFilter === 'semua' || kaderTier(m.roles) === tierFilter
      return adaPosisiKader && matchSearch && matchStudio && matchTier
    })
  }, [members, searchUser, studioFilter, tierFilter])

  const groupedByStudio = useMemo(() => {
    const map = new Map()
    // filteredMembers udah dijamin semuanya punya minimal 1 role studio (lihat filter adaStudio
    // di atas) -- gak perlu lagi cabang "Tanpa Studio".
    filteredMembers.forEach(m => {
      m.roles.filter(r => r.studio).forEach(r => {
        const key = r.studio.nama
        // getRoleOrgUnit, bukan r.circle/r.rumahUsaha langsung -- role studio-scoped gak punya
        // circleId/rumahUsahaId di UserRole-nya sendiri, warnanya cuma bisa didapat lewat
        // studio.circle/studio.rumahUsaha (sama fix kayak groupedByStudio di Members.jsx).
        if (!map.has(key)) map.set(key, { colorHex: getRoleOrgUnit(r)?.colorHex ?? 'var(--text-muted)', members: [] })
        if (!map.get(key).members.find(mem => mem.id === m.id)) map.get(key).members.push(m)
      })
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filteredMembers])

  return (
    <>
      {/* Tab level-halaman */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[['ringkasan', '📊 Ringkasan Performa'], ['detail', '👤 Detail Kader']].map(([key, label]) => (
          <button key={key} onClick={() => setPageView(key)}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: pageView === key ? 'var(--bg-card)' : 'none',
              color: pageView === key ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow: pageView === key ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {pageView === 'ringkasan' ? (
        <RingkasanPerforma onSelectKader={selectFromRingkasan} onQuickNilai={quickNilaiFromRingkasan} />
      ) : (
    <div className="two-col-layout">
      {/* Left — Member List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Rekam Jejak Kader</div>
          <div className="search-bar" style={{ marginBottom: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="Cari anggota..." value={searchUser} onChange={e => setSearchUser(e.target.value)} />
          </div>
          <select className="form-input" style={{ marginBottom: 8, fontSize: 12, padding: '6px 10px' }}
            value={studioFilter} onChange={e => setStudioFilter(e.target.value)}>
            {allStudios.map(s => <option key={s} value={s}>{s === 'Semua' ? 'Semua Studio' : s}</option>)}
          </select>
          <select className="form-input" style={{ marginBottom: 12, fontSize: 12, padding: '6px 10px' }}
            value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="semua">Semua Tier</option>
            {Object.entries(TIER_BADGE).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
          </select>
          <div style={{ overflowY: 'auto', maxHeight: isMobile ? '65vh' : 'calc(100vh - 360px)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groupedByStudio.map(([studioNama, { colorHex, members: studioMembers }]) => (
              <div key={studioNama}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--text-muted)', padding: '10px 4px 4px',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: colorHex, flexShrink: 0 }} />
                  {studioNama}
                  <span style={{ fontWeight: 400, opacity: 0.7 }}>({studioMembers.length})</span>
                </div>
                {studioMembers.map(m => (
                  <button key={m.id}
                    onClick={() => loadTimeline(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                      borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                      background: selectedUser === m.id ? 'var(--accent-subtle)' : 'transparent',
                      transition: 'background 0.15s',
                    }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: colorHex, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff',
                    }}>{initials(m.nama)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: selectedUser === m.id ? 'var(--accent-light)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.nama}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getRoleLabel(getHighestRole(m.roles)?.roleType)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Timeline (modal on mobile) */}
      {isMobile && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
          onClick={() => setSelectedUser(null)}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderRadius: '16px 16px 0 0', maxHeight: '85vh', overflowY: 'auto', padding: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        </div>
        </div>
      )}
      <div style={{ overflowY: 'auto', ...(isMobile && selectedUser ? { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderRadius: '16px 16px 0 0', maxHeight: '85vh', zIndex: 201, padding: '0 16px 24px' } : {}) }}>
        {isMobile && selectedUser && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 8px' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2 }} />
            <button onClick={() => setSelectedUser(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>✕</button>
          </div>
        )}
        {!selectedUser ? (
          isMobile ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Pilih anggota</div>
            <div style={{ fontSize: 13 }}>Klik nama di panel kiri</div>
          </div>
          )
        ) : loadingTimeline ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
          </div>
        ) : timelineData && (
          <div>
            {/* Profile */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: canAdd ? 12 : 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--on-accent)', flexShrink: 0 }}>
                  {initials(timelineData.user.nama)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{timelineData.user.nama}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {timelineData.user.roles.map(r => (
                      <span key={r.id} className="badge info" style={{ fontSize: 10 }}>
                        {getRoleLabel(r.roleType)}{r.studio ? ` · ${r.studio.nama}` : (r.circle ?? r.rumahUsaha) ? ` · ${(r.circle ?? r.rumahUsaha).nama}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {canAdd && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }}
                    onClick={() => { setShowForm(v => !v); setForm(f => ({ ...f, userId: selectedUser })) }}>
                    + Catat Riwayat
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: '100%', border: '1px solid var(--border)' }}>
              {[
                { id: 'timeline', label: '📋 Timeline' },
                ...(canViewJurnal ? [{ id: 'jurnal', label: '📓 Laporan Perkembangan (Arsip)' }] : []),
                ...(canViewJurnal ? [{ id: 'penilaian', label: '📈 Penilaian Kader' }] : []),
              ].map(t => (
                <button key={t.id} onClick={() => { setActiveDetailTab(t.id); if (t.id === 'jurnal') loadJurnal(selectedUser) }}
                  style={{ flex: 1, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: activeDetailTab === t.id ? 'var(--accent)' : 'none',
                    color: activeDetailTab === t.id ? '#fff' : 'var(--text-secondary)',
                    boxShadow: activeDetailTab === t.id ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                    transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Timeline ── */}
            {activeDetailTab === 'timeline' && <>

            {/* Add Form */}
            {showForm && (
              <div className="card" style={{ marginBottom: 16 }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Tipe Riwayat</label>
                      <select className="form-input" style={{ paddingLeft: 10 }}
                        value={form.tipeEvent} onChange={e => setForm(f => ({ ...f, tipeEvent: e.target.value }))}>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tanggal</label>
                      <input type="date" className="form-input" style={{ paddingLeft: 10 }}
                        value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deskripsi *</label>
                    <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 80, resize: 'vertical' }}
                      placeholder="Ceritakan apa yang terjadi..."
                      value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} required />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 120 }}>
                      {submitting ? <><span className="spinner"/>Menyimpan...</> : 'Simpan'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
                  </div>
                </form>
              </div>
            )}

            {/* Timeline */}
            {timelineData.events.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                Belum ada catatan untuk anggota ini
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'var(--border)', borderRadius: 2 }} />
                {timelineData.events.map((ev, i) => (
                  <div key={ev.id} style={{ position: 'relative', marginBottom: 20 }}>
                    <div style={{
                      position: 'absolute', left: -23, top: 4,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--bg-card)', border: '2px solid var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9,
                    }}>
                      {EVENT_ICONS[ev.tipeEvent] ?? '📝'}
                    </div>
                    <div className="card" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span className="badge purple" style={{ fontSize: 10 }}>{ev.tipeEvent}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTanggalPendek(ev.tanggal)}</span>
                          {canEditEvent(ev) && (
                            <>
                              <button onClick={() => openEdit(ev)}
                                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                Edit
                              </button>
                              <button onClick={() => handleDelete(ev.id)}
                                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', background: 'var(--red-subtle)', color: 'var(--red)', cursor: 'pointer' }}>
                                Hapus
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ev.deskripsi}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </> }

            {/* ── Tab: Report Kader (ARSIP READ-ONLY sejak 30 Juli 2026, lihat komentar di atas) ── */}
            {activeDetailTab === 'jurnal' && (
              <div>
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  📦 Arsip riwayat lama — laporan naratif sekarang jadi bagian dari tab "Penilaian Kader". Entri di bawah gak bisa diedit/dihapus lagi.
                </div>

                {loadingJurnal ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Memuat...</div>
                ) : jurnalList.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Belum ada laporan untuk kader ini
                  </div>
                ) : jurnalList.map(j => (
                  <div key={j.id} className="card" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          {formatTanggalPendek(j.periodeAwal)}{j.periodeAkhir && j.periodeAkhir !== j.periodeAwal ? ` – ${formatTanggalPendek(j.periodeAkhir)}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Ditulis oleh: {j.penulis?.nama}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Perkembangan</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{j.perkembangan}</div></div>
                      {j.pencapaian && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pencapaian</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{j.pencapaian}</div></div>}
                      {j.kendala && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kendala</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{j.kendala}</div></div>}
                      {j.targetMingguDepan && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Minggu Depan</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{j.targetMingguDepan}</div></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab: Penilaian Kader ── */}
            {activeDetailTab === 'penilaian' && (
              <PenilaianKaderTab userId={selectedUser} autoOpenForm={autoOpenPenilaian} onAutoOpened={() => setAutoOpenPenilaian(false)} />
            )}
          </div>
        )}
      </div>

      {/* Edit Event Modal */}
      {editEvent && (
        <div className="modal-overlay" onClick={() => setEditEvent(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
            <div className="modal-header" style={{ flexShrink: 0, padding: '16px 20px' }}>
              <div className="modal-title">Edit Riwayat</div>
              <button className="modal-close" onClick={() => setEditEvent(null)} aria-label="Tutup">✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 20px' }}>
            <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tipe Riwayat</label>
                  <select className="form-input" style={{ paddingLeft: 10 }}
                    value={editForm.tipeEvent} onChange={e => setEditForm(f => ({ ...f, tipeEvent: e.target.value }))}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input type="date" className="form-input" style={{ paddingLeft: 10 }}
                    value={editForm.tanggal} onChange={e => setEditForm(f => ({ ...f, tanggal: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Deskripsi *</label>
                <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 80, resize: 'vertical' }}
                  value={editForm.deskripsi} onChange={e => setEditForm(f => ({ ...f, deskripsi: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={savingEdit} style={{ minWidth: 120 }}>
                  {savingEdit ? <><span className="spinner"/>Menyimpan...</> : 'Simpan Perubahan'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditEvent(null)}>Batal</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
      )}
    </>
  )
}
