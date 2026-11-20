import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggalPendek } from '../../utils/format'
import { downloadCsv } from '../../utils/csv'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { onActivate } from '../../utils/a11y'
import { alfa } from '../../utils/warna'

const PIPELINE = [
  { status: 'PENDAFTARAN', label: 'Pendaftaran', color: 'var(--text-muted)', icon: '📋' },
  { status: 'SELEKSI',     label: 'Seleksi',     color: 'var(--amber)', icon: '🔍' },
  { status: 'DITERIMA',    label: 'Diterima',    color: 'var(--green)', icon: '✅' },
  { status: 'DITOLAK',     label: 'Ditolak',     color: 'var(--red)', icon: '❌' },
]

const JALUR = ['LIVE_IN','LANGSUNG','REFERRAL']
const JALUR_LABEL = {
  LIVE_IN:      '🏠 Live In',
  LANGSUNG:     '👤 Langsung',
  REFERRAL:     '🤝 Referral',
}

const ROLES_ONBOARD = [
  'MAGANG','KARYAWAN','KADER','KOORDINATOR','ADMIN_FUNGSIONAL','PENDAMPING',
  'KEPALA_CIRCLE','KEPALA_RUMAH_USAHA',
]

const EMPTY_FORM = {
  namaCalon: '', jalurMasuk: 'LANGSUNG', referralDari: '', studioTujuan: '', catatan: '',
  email: '', nomorWa: '', telegramId: '', tanggalLahir: '', jenisKelamin: '', posisi: '',
}

function JadikanAnggotaModal({ calon, circles, studios, onClose, onDone }) {
  const [form, setForm] = useState({
    nama:        calon.namaCalon,
    email:       calon.email       || '',
    nomorWa:     calon.nomorWa     || '',
    telegramId:  calon.telegramId  || '',
    tanggalLahir: calon.tanggalLahir ? calon.tanggalLahir.slice(0, 10) : '',
    jenisKelamin: calon.jenisKelamin || '',
    posisi:       calon.posisi       || '',
    passwordAwal: '',
    roleType:    'MAGANG',
    circleId:    '',
    studioId:    '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg]         = useState('')
  const [showPass, setShowPass]     = useState(false)

  const sf = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const filteredStudios = (studios ?? []).filter(s =>
    !form.circleId || s.circle?.id === form.circleId
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErrMsg('')
    try {
      await api.post(`/api/rekrutmen/${calon.id}/jadikan-anggota`, form)
      onDone()
    } catch (err) {
      setErrMsg(err.response?.data?.message || 'Gagal membuat akun')
    }
    setSubmitting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '16px 20px' }}>
          <div>
            <div className="modal-title">Terima sebagai Anggota</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Lengkapi data lalu buat akun untuk <strong>{calon.namaCalon}</strong>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* DATA DIRI */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Data Diri
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Nama Lengkap *</label>
              <input className="form-input" value={form.nama} onChange={sf('nama')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" placeholder="email@domain.com"
                value={form.email} onChange={sf('email')} required />
            </div>
            <div className="form-group">
              <label className="form-label">No. WhatsApp</label>
              <input className="form-input" placeholder="08xxxxxxxxxx"
                value={form.nomorWa} onChange={sf('nomorWa')} />
            </div>
            <div className="form-group">
              <label className="form-label">Telegram ID</label>
              <input className="form-input" placeholder="@username atau nomor"
                value={form.telegramId} onChange={sf('telegramId')} />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Lahir</label>
              <input className="form-input" type="date"
                value={form.tanggalLahir} onChange={sf('tanggalLahir')} />
            </div>
            <div className="form-group">
              <label className="form-label">Jenis Kelamin</label>
              <select className="form-input" value={form.jenisKelamin} onChange={sf('jenisKelamin')}>
                <option value="">— Tidak disebutkan —</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Posisi / Bidang</label>
              <input className="form-input" placeholder="3D Artist, Admin, Ilustrator, dll"
                value={form.posisi} onChange={sf('posisi')} />
            </div>
          </div>

          {/* AKUN & PERAN */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Akun &amp; Peran
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Password Awal *</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={showPass ? 'text' : 'password'}
                  placeholder="Min. 8 karakter"
                  value={form.passwordAwal} onChange={sf('passwordAwal')}
                  required minLength={8}
                  style={{ paddingRight: 44 }} />
                <button type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-input" value={form.roleType} onChange={sf('roleType')} required>
                {ROLES_ONBOARD.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Circle</label>
              <select className="form-input" value={form.circleId}
                onChange={e => setForm(f => ({ ...f, circleId: e.target.value, studioId: '' }))}>
                <option value="">— Belum ditentukan —</option>
                {(circles ?? []).map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Studio</label>
              <select className="form-input" value={form.studioId} onChange={sf('studioId')}>
                <option value="">— Belum ditentukan —</option>
                {filteredStudios.map(s => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
            </div>
          </div>

          {errMsg && (
            <div className="login-error">{errMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 180 }}>
              {submitting ? <><span className="spinner" />Menyimpan...</> : '✅ Buat Akun Anggota'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

function DetailModal({ calon, canMove, canJadikan, circles, studios, onClose, onMove, onJadikan }) {
  const col = PIPELINE.find(p => p.status === calon.status) ?? PIPELINE[0]
  const [moving, setMoving] = useState(false)
  const [showJadikan, setShowJadikan] = useState(false)

  const doMove = async (status) => {
    setMoving(true)
    await onMove(calon.id, status)
    setMoving(false)
    onClose()
  }

  if (showJadikan) {
    return (
      <JadikanAnggotaModal
        calon={calon}
        circles={circles}
        studios={studios}
        onClose={() => setShowJadikan(false)}
        onDone={() => { setShowJadikan(false); onJadikan(); onClose() }}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '16px 20px' }}>
          <div>
            <div className="modal-title">{calon.namaCalon}</div>
            <div style={{ fontSize: 12, color: col.color, fontWeight: 700, marginTop: 2 }}>
              {col.icon} {col.label}
              {calon.sudahJadiAnggota && (
                <span style={{ marginLeft: 8, color: 'var(--green)', fontSize: 11 }}>· Sudah jadi anggota ✓</span>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Jalur Masuk</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{JALUR_LABEL[calon.jalurMasuk]}</div>
            </div>
            {calon.studioTujuan && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Studio Tujuan</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{calon.studioTujuan}</div>
              </div>
            )}
            {calon.referralDari && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Direkrut / Direferral oleh</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>👤 {calon.referralDari}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Tanggal Daftar</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatTanggalPendek(calon.createdAt)}</div>
            </div>
          </div>

          {/* Data diri jika ada */}
          {(calon.email || calon.nomorWa || calon.telegramId || calon.posisi || calon.jenisKelamin) && (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {calon.email && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Email</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{calon.email}</div>
                </div>
              )}
              {calon.nomorWa && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>WhatsApp</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{calon.nomorWa}</div>
                </div>
              )}
              {calon.telegramId && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Telegram</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{calon.telegramId}</div>
                </div>
              )}
              {calon.posisi && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Posisi</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{calon.posisi}</div>
                </div>
              )}
              {calon.jenisKelamin && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Jenis Kelamin</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{calon.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
                </div>
              )}
            </div>
          )}

          {calon.catatan && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Catatan</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 12px' }}>
                {calon.catatan}
              </div>
            </div>
          )}

          {/* Jadikan anggota */}
          {calon.status === 'DITERIMA' && !calon.sudahJadiAnggota && (
            canJadikan ? (
              <button className="btn btn-primary" onClick={() => setShowJadikan(true)}
                style={{ width: '100%', justifyContent: 'center' }}>
                👤 Jadikan Anggota — Buat Akun
              </button>
            ) : (
              <button className="btn btn-primary" disabled title="Perlu role Kepala Circle ke atas"
                style={{ width: '100%', justifyContent: 'center', opacity: 0.5, cursor: 'not-allowed' }}>
                👤 Jadikan Anggota — Perlu Kepala Circle ke atas
              </button>
            )
          )}

          {canMove && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Pindahkan ke</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PIPELINE.filter(p => p.status !== calon.status).map(p => (
                  <button key={p.status} disabled={moving}
                    onClick={() => doMove(p.status)}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: `1px solid ${p.color}`, background: `${alfa(p.color, 9)}`, color: p.color, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

export default function Rekrutmen() {
  const { user } = useAuth()
  const { data: rekrutmen, loading, error, refetch } = useApi('/api/rekrutmen')
  const { data: studios }  = useApi('/api/kanban/studios')
  const { data: members }  = useApi('/api/masterdata/users')
  const { data: circles }  = useApi('/api/masterdata/circles')

  const [showForm, setShowForm]         = useState(false)
  const [showExtra, setShowExtra]       = useState(false)
  const [selected, setSelected]         = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [submitting, setSubmit]         = useState(false)
  const [formErr, setFormErr]           = useState('')
  const [filterJalur, setFilterJalur]   = useState('all')
  const [dragOver, setDragOver]         = useState(null)
  const [showChain, setShowChain]       = useState(false)

  const chainTree = useMemo(() => {
    const all = rekrutmen ?? []
    const groups = {}
    all.forEach(r => {
      const key = r.referralDari?.trim() || '__tanpa_referral__'
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return groups
  }, [rekrutmen])

  const canManage = user?.roles?.some(r =>
    ['ADVISOR','KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  const canMove = user?.roles?.some(r =>
    ['KOORDINATOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  const canJadikan = user?.roles?.some(r =>
    ['ADVISOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  // Cocok persis dengan DELETE /:id di routes/rekrutmen.js — KOORDINATOR sengaja gak termasuk
  // (beda dari canMove) karena hapus data kandidat permanen dibatasi ke circle/rumah usaha ke atas.
  const canDelete = user?.roles?.some(r =>
    ['ADVISOR','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )

  const sf = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = (rekrutmen ?? []).filter(r =>
    filterJalur === 'all' || r.jalurMasuk === filterJalur
  )

  const handleDownloadCsv = () => {
    const rows = (rekrutmen ?? []).map(r => ({
      'Nama Calon':    r.namaCalon,
      'Email':         r.email ?? '',
      'No WA':         r.nomorWa ?? '',
      'Telegram':      r.telegramId ?? '',
      'Jenis Kelamin': r.jenisKelamin ?? '',
      'Jalur Masuk':   JALUR_LABEL[r.jalurMasuk] ?? r.jalurMasuk,
      'Referral Dari': r.referralDari ?? '',
      'Studio Tujuan': r.studioTujuan ?? '',
      'Posisi':        r.posisi ?? '',
      'Status':        r.status,
      'Catatan':       r.catatan ?? '',
      'Tanggal Daftar': r.createdAt ? r.createdAt.slice(0, 10) : '',
    }))
    downloadCsv(`${ECOSYSTEM_NAME}-Rekrutmen-${new Date().toISOString().slice(0,10)}.csv`, rows)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmit(true); setFormErr('')
    try {
      await api.post('/api/rekrutmen', form)
      setShowForm(false)
      setShowExtra(false)
      setForm(EMPTY_FORM)
      refetch()
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Gagal mendaftarkan calon, coba lagi')
    }
    setSubmit(false)
  }

  const handleMove = async (id, status) => {
    try { await api.patch(`/api/rekrutmen/${id}/status`, { status }); await refetch() } catch (e) {
      alert(e.response?.data?.message || 'Gagal memindahkan status')
    }
  }

  const handleDelete = async (id, nama) => {
    if (!window.confirm(`Hapus data "${nama}" dari pipeline rekrutmen?`)) return
    try { await api.delete(`/api/rekrutmen/${id}`); await refetch() } catch (e) {
      alert(e.response?.data?.message || 'Gagal menghapus data')
    }
  }

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('rekrutmenId')
    const fromStatus = e.dataTransfer.getData('fromStatus')
    if (!id || fromStatus === targetStatus) return
    await handleMove(id, targetStatus)
  }

  const byStatus = (status) => filtered.filter(r => r.status === status)
  const counts = PIPELINE.reduce((acc, p) => ({ ...acc, [p.status]: byStatus(p.status).length }), {})

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Rekrutmen</h1>
            <p>Pipeline calon anggota ekosistem {ECOSYSTEM_NAME}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${showChain ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowChain(v => !v)}>
              🌳 Pohon Rekrutmen
            </button>
            <button className="btn btn-ghost" onClick={handleDownloadCsv}
              disabled={!rekrutmen?.length} title="Download CSV semua calon">
              ↓ CSV
            </button>
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {showForm ? 'Tutup' : 'Daftarkan Calon'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Calon Anggota Baru</span></div>
          <form onSubmit={handleCreate}>
            {/* Baris 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Nama Calon *</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="Nama lengkap"
                  value={form.namaCalon} onChange={sf('namaCalon')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Jalur Masuk *</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.jalurMasuk} onChange={sf('jalurMasuk')}>
                  {JALUR.map(j => <option key={j} value={j}>{JALUR_LABEL[j]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Studio Tujuan</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.studioTujuan} onChange={sf('studioTujuan')}>
                  <option value="">— Belum ditentukan —</option>
                  {(studios ?? []).map(s => <option key={s.id} value={s.nama}>{s.nama}</option>)}
                </select>
              </div>
            </div>

            {/* Baris 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Direkrut / Direferral oleh</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.referralDari} onChange={sf('referralDari')}>
                  <option value="">— Tidak ada / Tidak tahu —</option>
                  {(members ?? []).map(m => (
                    <option key={m.id} value={m.nama}>{m.nama}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="Info tambahan..."
                  value={form.catatan} onChange={sf('catatan')} />
              </div>
            </div>

            {/* Toggle data diri */}
            <button type="button"
              onClick={() => setShowExtra(v => !v)}
              style={{ fontSize: 12, background: 'none', border: '1px dashed var(--border)', borderRadius: 8,
                padding: '6px 14px', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: showExtra ? 14 : 16 }}>
              {showExtra ? '▲ Sembunyikan' : '▼ + Data Diri Calon (Opsional)'}
            </button>

            {showExtra && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16,
                padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: 10 }}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="email@domain.com"
                    value={form.email} onChange={sf('email')} />
                </div>
                <div className="form-group">
                  <label className="form-label">No. WhatsApp</label>
                  <input className="form-input" placeholder="08xxxxxxxxxx"
                    value={form.nomorWa} onChange={sf('nomorWa')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telegram ID</label>
                  <input className="form-input" placeholder="@username"
                    value={form.telegramId} onChange={sf('telegramId')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Lahir</label>
                  <input className="form-input" type="date"
                    value={form.tanggalLahir} onChange={sf('tanggalLahir')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jenis Kelamin</label>
                  <select className="form-input" value={form.jenisKelamin} onChange={sf('jenisKelamin')}>
                    <option value="">— Tidak disebutkan —</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Posisi / Bidang</label>
                  <input className="form-input" placeholder="3D Artist, Ilustrator, dll"
                    value={form.posisi} onChange={sf('posisi')} />
                </div>
              </div>
            )}

            {formErr && (
              <div className="login-error" style={{ marginBottom: 12 }}>{formErr}</div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 150 }}>
                {submitting ? <><span className="spinner"/>Menyimpan...</> : 'Daftarkan'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setShowExtra(false); setFormErr('') }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter jalur */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`btn ${filterJalur === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12, padding: '7px 12px' }}
          onClick={() => setFilterJalur('all')}>Semua Jalur</button>
        {JALUR.map(j => (
          <button key={j} className={`btn ${filterJalur === j ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12, padding: '7px 12px' }}
            onClick={() => setFilterJalur(filterJalur === j ? 'all' : j)}>{JALUR_LABEL[j]}</button>
        ))}
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Pohon Rekrutmen */}
      {showChain && (
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--text)' }}>
            🌳 Pohon Rekrutmen — siapa merekrut siapa
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(chainTree)
              .sort(([a], [b]) => {
                if (a === '__tanpa_referral__') return 1
                if (b === '__tanpa_referral__') return -1
                return a.localeCompare(b)
              })
              .map(([recruiter, recruits]) => {
                const col = PIPELINE.find(p => p.status === recruits[0]?.status) ?? PIPELINE[0]
                return (
                  <div key={recruiter}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', flexShrink: 0 }}>
                        {recruiter === '__tanpa_referral__' ? '—' : recruiter.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                        {recruiter === '__tanpa_referral__' ? 'Tanpa Referral / Tidak Diketahui' : recruiter}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                        {recruits.length} orang
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 36 }}>
                      {recruits.map(r => {
                        const pCol = PIPELINE.find(p => p.status === r.status) ?? PIPELINE[0]
                        return (
                          <div key={r.id}
                            onClick={() => setSelected(r)}
                            role="button" tabIndex={0} onKeyDown={onActivate(() => setSelected(r))}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                              borderRadius: 8, background: 'var(--bg-surface)', cursor: 'pointer',
                              borderLeft: `3px solid ${pCol.color}`, transition: 'box-shadow 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                            <span style={{ fontSize: 14 }}>└</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.namaCalon}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {JALUR_LABEL[r.jalurMasuk]} {r.studioTujuan ? `· ${r.studioTujuan}` : ''}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pCol.color,
                              background: `${alfa(pCol.color, 13)}`, padding: '2px 8px', borderRadius: 99 }}>
                              {pCol.icon} {pCol.label}
                            </span>
                            {r.sudahJadiAnggota && (
                              <span className="badge success" style={{ fontSize: 10 }}>✓ Anggota</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Pipeline Board */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      ) : (
        <div className="pipeline-board">
          {PIPELINE.map(col => (
            <div key={col.status}
              onDragOver={canMove ? (e) => { e.preventDefault(); setDragOver(col.status) } : undefined}
              onDragLeave={canMove ? () => setDragOver(null) : undefined}
              onDrop={canMove ? (e) => handleDrop(e, col.status) : undefined}
              style={{ transition: 'background 0.15s', borderRadius: 'var(--radius-sm)' }}>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '8px 12px', background: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                borderTop: `3px solid ${col.color}`,
              }}>
                <span style={{ fontSize: 16 }}>{col.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{col.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: `${alfa(col.color, 13)}`, padding: '2px 8px', borderRadius: 99 }}>
                  {counts[col.status] ?? 0}
                </span>
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                minHeight: 80, borderRadius: 'var(--radius-sm)', padding: 4,
                background: dragOver === col.status ? `${alfa(col.color, 7)}` : 'transparent',
                border: dragOver === col.status ? `2px dashed ${col.color}` : '2px dashed transparent',
                transition: 'all 0.15s',
              }}>
                {byStatus(col.status).map(r => (
                  <div key={r.id} className="card"
                    draggable={canMove}
                    onDragStart={canMove ? (e) => {
                      e.dataTransfer.setData('rekrutmenId', r.id)
                      e.dataTransfer.setData('fromStatus', r.status)
                      e.dataTransfer.effectAllowed = 'move'
                    } : undefined}
                    onClick={() => setSelected(r)}
                    role="button" tabIndex={0} onKeyDown={onActivate(() => setSelected(r))}
                    style={{
                      padding: 14, borderLeft: `3px solid ${col.color}`,
                      cursor: canMove ? 'grab' : 'pointer',
                      transition: 'box-shadow 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.namaCalon}</div>
                      {canDelete && (
                        <button onClick={e => { e.stopPropagation(); handleDelete(r.id, r.namaCalon) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                            fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                          title="Hapus">✕</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span className="badge info" style={{ fontSize: 10 }}>{JALUR_LABEL[r.jalurMasuk]}</span>
                      {r.studioTujuan && <span className="badge purple" style={{ fontSize: 10 }}>{r.studioTujuan}</span>}
                      {r.sudahJadiAnggota && <span className="badge success" style={{ fontSize: 10 }}>✓ Anggota</span>}
                    </div>
                    {r.catatan && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.4 }}>{r.catatan}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatTanggalPendek(r.createdAt)}
                      {r.referralDari && ` · ref: ${r.referralDari}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {canMove ? '⠿ Drag untuk pindah · Klik untuk detail' : 'Klik untuk detail →'}
                    </div>
                  </div>
                ))}
                {byStatus(col.status).length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '24px 0',
                    color: dragOver === col.status ? col.color : 'var(--text-muted)',
                    fontSize: 13, borderRadius: 'var(--radius-sm)',
                  }}>
                    {dragOver === col.status ? `Drop di sini → ${col.label}` : 'Kosong'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <DetailModal
          calon={selected}
          canMove={canMove}
          canJadikan={canJadikan}
          circles={circles}
          studios={studios}
          onClose={() => setSelected(null)}
          onMove={async (id, status) => {
            await handleMove(id, status)
            setSelected(null)
          }}
          onJadikan={() => refetch()}
        />
      )}
    </>
  )
}
