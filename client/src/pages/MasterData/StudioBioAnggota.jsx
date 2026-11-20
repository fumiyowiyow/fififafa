import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'
import { onActivate } from '../../utils/a11y'
import { ROLE_LABEL, ROLE_COLOR, studioInitials } from './constants'

// ── StudioBioModal section: Anggota Studio (tambah / THP / pindah studio) ──

export default function StudioBioAnggota({ studio, canEdit, studios, users, onNavigate, onClose }) {
  const [anggota, setAnggota]     = useState([])
  const [loadAnggota, setLoadAnggota] = useState(true)
  const [movingUserId, setMovingUserId] = useState(null)
  const [moveTarget, setMoveTarget]     = useState('')
  const [moveSaving, setMoveSaving]     = useState(false)
  const [moveError, setMoveError]       = useState('')
  const [thpEditingUserId, setThpEditingUserId] = useState(null)
  const [thpValue, setThpValue]         = useState('')
  const [thpSaving, setThpSaving]       = useState(false)
  const [thpError, setThpError]         = useState('')

  // Tambah Anggota — bisa pilih user yang sudah ada (mis. Kepala Ekosistem yang rolenya global,
  // gak nempel ke studio manapun sehingga gak pernah kelihatan di studio manapun juga) atau
  // bikin orang baru sekalian (opsional dikasih akun login, default shell/no-login).
  const [showTambahAnggota, setShowTambahAnggota] = useState(false)
  const [taForm, setTaForm] = useState({ mode: 'existing', existingUserId: '', nama: '', roleType: 'KARYAWAN', withLogin: false, email: '', password: '' })
  const [taError, setTaError]     = useState('')
  const [taSaving, setTaSaving]   = useState(false)

  const otherStudios = (studios ?? []).filter(s => s.statusAktif && s.id !== studio.id)
  // Kandidat "tambah anggota (yang sudah ada)" = semua user aktif yang BELUM punya posisi di
  // studio ini — termasuk orang dengan role global (mis. Kepala Ekosistem) yang gak nempel ke
  // studio manapun, jadi selama ini gak pernah kelihatan tercatat di studio manapun.
  const anggotaCandidates = (users ?? []).filter(u => !anggota.some(a => a.id === u.id))

  const openTambahAnggota = () => {
    setTaForm({ mode: 'existing', existingUserId: '', nama: '', roleType: 'KARYAWAN', withLogin: false, email: '', password: '' })
    setTaError('')
    setShowTambahAnggota(true)
  }

  const saveTambahAnggota = async () => {
    if (taForm.mode === 'existing' && !taForm.existingUserId) {
      return setTaError('Pilih orangnya dulu')
    }
    if (taForm.mode === 'baru' && !taForm.nama.trim()) {
      return setTaError('Nama wajib diisi')
    }
    if (taForm.mode === 'baru' && taForm.withLogin && (!taForm.email || !taForm.password)) {
      return setTaError('Email & password wajib diisi kalau mau dikasih akses login')
    }
    setTaSaving(true); setTaError('')
    try {
      if (taForm.mode === 'existing') {
        await api.post(`/api/members/${taForm.existingUserId}/roles`, {
          roleType: taForm.roleType,
          studioId: studio.id,
        })
      } else {
        await api.post('/api/members', {
          nama: taForm.nama.trim(),
          roleType: taForm.roleType,
          studioId: studio.id,
          ...(taForm.withLogin ? { email: taForm.email, passwordAwal: taForm.password } : {}),
        })
      }
      setShowTambahAnggota(false)
      fetchAnggota()
    } catch (e) {
      setTaError(e.response?.data?.message || 'Gagal menambah anggota')
    } finally {
      setTaSaving(false)
    }
  }

  const openMove = (u) => {
    setMovingUserId(u.id)
    setMoveTarget('')
    setMoveError('')
  }

  const doMove = async (u, roleId, roleType) => {
    if (!moveTarget) return setMoveError('Pilih studio tujuan dulu')
    setMoveSaving(true); setMoveError('')
    try {
      await api.patch(`/api/members/roles/${roleId}`, { roleType, studioId: moveTarget })
      setAnggota(list => list.filter(x => x.id !== u.id))
      setMovingUserId(null)
    } catch (e) {
      setMoveError(e.response?.data?.message || 'Gagal memindahkan anggota')
    } finally {
      setMoveSaving(false)
    }
  }

  const openThpEdit = (u, studioRole) => {
    setThpEditingUserId(u.id)
    setThpValue(studioRole?.takeHomePay != null ? String(studioRole.takeHomePay) : '')
    setThpError('')
  }

  const saveThp = async (u, roleId) => {
    setThpSaving(true); setThpError('')
    try {
      const res = await api.patch(`/api/members/roles/${roleId}/thp`, {
        takeHomePay: thpValue !== '' ? Number(thpValue) : null,
      })
      setAnggota(list => list.map(x => x.id !== u.id ? x : {
        ...x,
        roles: x.roles.map(r => r.id === roleId ? { ...r, takeHomePay: res.data.data.takeHomePay } : r),
      }))
      setThpEditingUserId(null)
    } catch (e) {
      setThpError(e.response?.data?.message || 'Gagal menyimpan THP')
    } finally {
      setThpSaving(false)
    }
  }

  const fetchAnggota = async () => {
    setLoadAnggota(true)
    try {
      const res = await api.get(`/api/masterdata/studios/${studio.id}/roster`)
      setAnggota(res.data.data ?? [])
    } catch { /* silent — 403 kalau bukan admin studio/circle ini */ }
    finally { setLoadAnggota(false) }
  }

  useEffect(() => {
    fetchAnggota()
  }, [])

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          Anggota Studio {!loadAnggota && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>({anggota.length} orang)</span>}
        </div>
        {canEdit && !showTambahAnggota && (
          <span className="card-action" onClick={openTambahAnggota}>+ Tambah Anggota</span>
        )}
      </div>

      {showTambahAnggota && (
        <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" className={taForm.mode === 'existing' ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setTaForm(f => ({ ...f, mode: 'existing' }))}>Orang yang sudah ada</button>
            <button type="button" className={taForm.mode === 'baru' ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setTaForm(f => ({ ...f, mode: 'baru' }))}>Orang baru</button>
          </div>

          {taForm.mode === 'existing' ? (
            <div className="form-group" style={{ margin: 0, marginBottom: 10 }}>
              <label className="form-label">Pilih Orang</label>
              <select className="form-input" value={taForm.existingUserId}
                onChange={e => setTaForm(f => ({ ...f, existingUserId: e.target.value }))}>
                <option value="">— Pilih —</option>
                {anggotaCandidates.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Termasuk orang yang sudah jadi anggota studio lain, atau punya role global (mis. Kepala Ekosistem) yang selama ini gak nempel ke studio manapun.</span>
            </div>
          ) : (
            <>
              <div className="form-group" style={{ margin: 0, marginBottom: 10 }}>
                <label className="form-label">Nama</label>
                <input className="form-input" value={taForm.nama} onChange={e => setTaForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input type="checkbox" id="taWithLogin" checked={taForm.withLogin}
                  onChange={e => setTaForm(f => ({ ...f, withLogin: e.target.checked }))} />
                <label htmlFor="taWithLogin" style={{ fontSize: 13 }}>Kasih akses login (kalau nggak dicentang, orang ini tercatat tapi nggak bisa login ke app)</label>
              </div>
              {taForm.withLogin && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={taForm.email} onChange={e => setTaForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Password Awal</label>
                    <input type="text" className="form-input" value={taForm.password} onChange={e => setTaForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="form-group" style={{ margin: 0, marginBottom: 10 }}>
            <label className="form-label">Posisi di Studio Ini</label>
            <select className="form-input" value={taForm.roleType} onChange={e => setTaForm(f => ({ ...f, roleType: e.target.value }))}>
              {['KOORDINATOR', 'PENDAMPING', 'KARYAWAN', 'MAGANG', 'KADER', 'DIGNITY', 'PENASIHAT'].map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
              ))}
            </select>
          </div>

          {taError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{taError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={taSaving} onClick={saveTambahAnggota}>
              {taSaving ? 'Menyimpan…' : 'Tambahkan'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowTambahAnggota(false)}>Batal</button>
          </div>
        </div>
      )}

      {loadAnggota ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ display: 'inline-block', width: 16, height: 16 }} />
        </div>
      ) : anggota.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada anggota terdaftar
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {anggota.map(u => {
            const studioRole = u.roles?.find(r => r.studioId === studio.id)
            const roleType   = studioRole?.roleType ?? u.roles?.[0]?.roleType
            const color      = ROLE_COLOR[roleType] ?? 'var(--text-muted)'
            const isMoving   = movingUserId === u.id
            const isEditingRow = thpEditingUserId === u.id || isMoving
            // Klik baris ini biasanya lompat ke profil lengkap di halaman Anggota -- tapi
            // kalau lagi buka form THP/Pindah buat orang ini, klik-navigasi dimatiin dulu.
            // Sebelumnya klik meleset dikit dari tombol THP/Pindah (yang areanya kecil)
            // langsung nutup modal & lompat halaman, edit yang lagi jalan ikut ilang.
            const navigate = () => !isEditingRow && onNavigate && (onClose(), onNavigate('Members', { openUserId: u.id }))
            return (
              <div key={u.id}>
                <div
                  onClick={navigate}
                  role="button" tabIndex={0}
                  onKeyDown={onActivate(navigate)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: 'var(--bg-surface)',
                    borderRadius: isMoving ? '8px 8px 0 0' : 8,
                    cursor: onNavigate && !isEditingRow ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (onNavigate && !isEditingRow) e.currentTarget.style.background = 'var(--bg-input)' }}
                  onMouseLeave={e => { if (onNavigate) e.currentTarget.style.background = 'var(--bg-surface)' }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff',
                  }}>
                    {studioInitials(u.nama)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nama}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {ROLE_LABEL[roleType] ?? roleType}
                      {studioRole?.takeHomePay != null && (
                        <span style={{ color: 'var(--green)' }}> · THP {formatRp(studioRole.takeHomePay)}</span>
                      )}
                    </div>
                  </div>
                  {u.nomorWa && (
                    <a href={`https://wa.me/${u.nomorWa.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, color: 'var(--accent-light)', textDecoration: 'none', flexShrink: 0 }}>
                      WA
                    </a>
                  )}
                  {canEdit && studioRole && (
                    <span
                      onClick={e => { e.stopPropagation(); thpEditingUserId === u.id ? setThpEditingUserId(null) : openThpEdit(u, studioRole) }}
                      style={{ fontSize: 11, color: thpEditingUserId === u.id ? 'var(--text)' : 'var(--green)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {thpEditingUserId === u.id ? 'Batal' : 'THP'}
                    </span>
                  )}
                  {canEdit && studioRole && (
                    <span
                      onClick={e => { e.stopPropagation(); isMoving ? setMovingUserId(null) : openMove(u) }}
                      style={{ fontSize: 11, color: isMoving ? 'var(--text)' : 'var(--cyan)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {isMoving ? 'Batal' : '⇄ Pindah'}
                    </span>
                  )}
                  {onNavigate && !isEditingRow && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  )}
                </div>

                {thpEditingUserId === u.id && (
                  <div onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: '0 0 8px 8px', flexWrap: 'wrap' }}>
                    <input type="number" min="0" className="form-input" style={{ flex: 1, minWidth: 140, padding: '6px 10px', fontSize: 12 }}
                      placeholder="THP (IDR)" value={thpValue} onChange={e => setThpValue(e.target.value)} />
                    <button className="btn btn-primary" disabled={thpSaving}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => saveThp(u, studioRole.id)}>
                      {thpSaving ? 'Menyimpan…' : 'Simpan'}
                    </button>
                    {thpError && <div style={{ fontSize: 11, color: 'var(--red)', width: '100%' }}>{thpError}</div>}
                  </div>
                )}

                {isMoving && (
                  <div onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: '0 0 8px 8px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ flex: 1, minWidth: 140, padding: '6px 10px', fontSize: 12 }}
                      value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                      <option value="">— Pindah ke studio —</option>
                      {otherStudios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                    </select>
                    <button className="btn btn-primary" disabled={moveSaving}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => doMove(u, studioRole.id, roleType)}>
                      {moveSaving ? 'Memindahkan…' : 'Pindahkan'}
                    </button>
                    {moveError && <div style={{ fontSize: 11, color: 'var(--red)', width: '100%' }}>{moveError}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
