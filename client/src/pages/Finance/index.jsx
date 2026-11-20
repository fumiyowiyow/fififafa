import { useState, useEffect, useRef } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatRp } from '../../utils/format'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { getWeekDates, getKasStatus, getReportingPeriod } from '../../utils/week'
import { MonthWeekPicker } from '../../components/common/MonthWeekPicker'
import ItemRingkas from '../../components/common/ItemRingkas'

const NOW  = new Date()
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function InputRp({ label, value, onChange, disabled, pos, getUserNama }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw]         = useState('')

  const handleFocus = () => {
    setRaw(value ? String(value) : '')
    setEditing(true)
  }
  const handleBlur = () => { setEditing(false) }
  const handleChange = (e) => {
    const clean = e.target.value.replace(/[^0-9]/g, '')
    setRaw(clean)
    onChange(Number(clean) || 0)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</label>
        {pos && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {getUserNama(pos.adminId)}{pos.noRekening ? ` · ${pos.namaBank} ${pos.noRekening}` : ''}
          </span>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none', userSelect: 'none' }}>Rp</span>
        <input
          type="text"
          className="form-input"
          style={{ width: '100%', padding: '8px 12px 8px 36px' }}
          value={editing ? raw : (value ? Number(value).toLocaleString('id-ID') : '')}
          placeholder="0"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

const SUPER_ADMIN = ['ADVISOR', 'KEPALA_EKOSISTEM']

// Isi halaman Keuangan lama -- sejak 13 Okt 2026 jadi tab "Dana & Pos" di hub Keuangan (Hub.jsx).
export default function DanaPos() {
  const { user } = useAuth()
  const [bulan, setBulan] = useState(NOW.getMonth() + 1)
  const [tahun, setTahun] = useState(NOW.getFullYear())
  const [posModal, setPosModal] = useState(null)

  const { data, loading, error, refetch } = useApi(`/api/finance/payments/${bulan}/${tahun}`, [bulan, tahun])
  const { data: users } = useApi('/api/masterdata/users')

  const isSuperAdmin = user?.roles?.some(r => SUPER_ADMIN.includes(r.roleType))
  // Kepala Circle/Kepala Rumah Usaha (scope cocok dengan pos) dan si "Admin"/pengelola yang
  // tercatat di pos itu sendiri juga boleh edit -- sebelumnya cuma isSuperAdmin, jadi Kepala
  // Circle/pengelola gak pernah bisa input/edit rekening dana circle-nya sendiri. Samakan
  // dengan canManageOrgUnit (server/src/utils/roles.js) yang dipakai endpoint PUT-nya.
  const myCircleIds = new Set((user?.roles ?? []).filter(r => ['KEPALA_CIRCLE','ADMIN_FUNGSIONAL'].includes(r.roleType) && r.circleId).map(r => r.circleId))
  const myRumahUsahaIds = new Set((user?.roles ?? []).filter(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId).map(r => r.rumahUsahaId))
  const canEditPost = (p) => isSuperAdmin || p.adminId === user?.id
    || (p.circleId && myCircleIds.has(p.circleId))
    || (p.rumahUsahaId && myRumahUsahaIds.has(p.rumahUsahaId))

  const allInternalPosts = data?.posts?.filter(p => p.tipe === 'INTERNAL') ?? []
  const externalPosts    = data?.posts?.filter(p => p.tipe === 'EKSTERNAL') ?? []

  const getUserNama = (id) => users?.find(u => u.id === id)?.nama ?? id
  const getScopeNama = (p) => p.circleId
    ? (data?.circles?.find(c => c.id === p.circleId)?.nama ?? p.circleId)
    : p.rumahUsahaId
      ? (data?.rumahUsahaList?.find(r => r.id === p.rumahUsahaId)?.nama ?? p.rumahUsahaId)
      : null

  // Dana Forum & Dana Berkah Ekosistem itu SATU pos yang sama dengan field danaForum/danaBerkah di
  // Dana Ekosistem (bukan cuma mirip nama) -- gak ada FK di skema (cuma kesamaan nama antar dua
  // model beda), jadi dicocokkan manual di sini lalu ditampilkan SEKALI SAJA (nempel di input
  // Dana Ekosistem, bukan diulang lagi sebagai baris terpisah di tabel Pos Internal). Dana PE
  // gak punya Pos Keuangan sama sekali (gak ada admin/rekening tercatat untuk itu).
  const posForumBerkah = {
    danaPE:     null,
    danaForum:  allInternalPosts.find(p => p.nama.includes('Forum'))  ?? null,
    danaBerkah: allInternalPosts.find(p => p.nama.includes('Berkah')) ?? null,
  }
  const internalPosts = allInternalPosts.filter(p =>
    p.id !== posForumBerkah.danaForum?.id && p.id !== posForumBerkah.danaBerkah?.id
  )
  const anyEditableInternal = internalPosts.some(canEditPost)
  const anyEditableExternal = externalPosts.some(canEditPost)

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Dana & Pos</h2>
            <p>{MONTHS[bulan - 1]} {tahun} · Pos keuangan, dana ekosistem & kas circle / rumah usaha</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-input" style={{ padding: '6px 10px', width: 90, fontSize: 13 }}
              value={bulan} onChange={e => setBulan(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" className="form-input" style={{ padding: '6px 10px', width: 76, fontSize: 13 }}
              value={tahun} onChange={e => setTahun(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {!loading && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Internal */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pos Internal ({internalPosts.length})</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge success">Dikelola tim {ECOSYSTEM_NAME}</span>
                {isSuperAdmin && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
                    onClick={() => setPosModal({ tipe: 'INTERNAL' })}>+ Tambah Pos</button>
                )}
              </div>
            </div>
            {/* Desktop: tabel */}
            <div className="table-wrap responsive-table">
              <table>
                <thead>
                  <tr><th>Nama Pos</th><th>Admin</th><th>Cakupan</th><th>No. Rekening</th>{anyEditableInternal && <th />}</tr>
                </thead>
                <tbody>
                  {internalPosts.map(p => {
                    const scopeNama = getScopeNama(p)
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.nama}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{getUserNama(p.adminId)}</td>
                        <td>{scopeNama
                          ? <span className="badge info">● {scopeNama}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ekosistem</span>
                        }</td>
                        <td>
                          {p.noRekening ? (
                            <div style={{ lineHeight: 1.4 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4, fontWeight: 400 }}>{p.namaBank}</span>
                                {p.noRekening}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.namaPemilik}</div>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                        </td>
                        {canEditPost(p) && (
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => setPosModal({ tipe: 'INTERNAL', editing: p })} aria-label={`Edit ${p.nama}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '2px 6px' }}>✏️</button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: list ringkas, ketuk baris untuk rekening & edit */}
            <div className="responsive-cards list-ringkas" style={{ margin: 12 }}>
              {internalPosts.map(p => {
                const scopeNama = getScopeNama(p)
                return (
                  <ItemRingkas key={p.id} judul={p.nama} sub={`${scopeNama ?? 'Ekosistem'} · ${getUserNama(p.adminId)}`}
                    nilai={p.namaBank ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{p.namaBank}</span> : null}>
                    <div className="data-card-row">
                      <span className="data-card-label">Admin</span>
                      <span className="data-card-value">{getUserNama(p.adminId)}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Cakupan</span>
                      <span className="data-card-value">{scopeNama
                        ? <span className="badge info">● {scopeNama}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Ekosistem</span>
                      }</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">No. Rekening</span>
                      <span className="data-card-value">
                        {p.noRekening ? (
                          <div style={{ lineHeight: 1.4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4, fontWeight: 400 }}>{p.namaBank}</span>
                              {p.noRekening}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.namaPemilik}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                      </span>
                    </div>
                    {canEditPost(p) && (
                      <button onClick={() => setPosModal({ tipe: 'INTERNAL', editing: p })}
                        style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, width: '100%', marginTop: 10,
                          border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        ✏️ Edit
                      </button>
                    )}
                  </ItemRingkas>
                )
              })}
            </div>
          </div>

          {/* Dana Ekosistem */}
          <DanaEkosistemTab bulan={bulan} tahun={tahun} user={user} posMap={posForumBerkah} getUserNama={getUserNama} />

          {/* Kas Circle & Rumah Usaha -- dulu tab terpisah di halaman Laporan Omset, dipindah
              ke sini 20 Juli 2026 (levelnya mingguan, beda dari Dana Ekosistem yang bulanan) */}
          <OrgKasTab user={user} />

          {/* Dana Lainnya */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Dana Lainnya ({externalPosts.length})</span>
              {isSuperAdmin && (
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
                  onClick={() => setPosModal({ tipe: 'EKSTERNAL' })}>+ Tambah Pos</button>
              )}
            </div>
            {/* Desktop: tabel */}
            <div className="table-wrap responsive-table">
              <table>
                <thead>
                  <tr><th>Nama Pos</th><th>Admin</th><th>No. Rekening</th>{anyEditableExternal && <th />}</tr>
                </thead>
                <tbody>
                  {externalPosts.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nama}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{getUserNama(p.adminId)}</td>
                      <td>
                        {p.noRekening ? (
                          <div style={{ lineHeight: 1.4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4, fontWeight: 400 }}>{p.namaBank}</span>
                              {p.noRekening}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.namaPemilik}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                      </td>
                      {canEditPost(p) && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => setPosModal({ tipe: 'EKSTERNAL', editing: p })} aria-label={`Edit ${p.nama}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: '2px 6px' }}>✏️</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: list ringkas, ketuk baris untuk rekening & edit */}
            <div className="responsive-cards list-ringkas" style={{ margin: 12 }}>
              {externalPosts.map(p => (
                <ItemRingkas key={p.id} judul={p.nama} sub={getUserNama(p.adminId)}
                  nilai={p.namaBank ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{p.namaBank}</span> : null}>
                  <div className="data-card-row">
                    <span className="data-card-label">Admin</span>
                    <span className="data-card-value">{getUserNama(p.adminId)}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">No. Rekening</span>
                    <span className="data-card-value">
                      {p.noRekening ? (
                        <div style={{ lineHeight: 1.4 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4, fontWeight: 400 }}>{p.namaBank}</span>
                            {p.noRekening}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.namaPemilik}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                    </span>
                  </div>
                  {canEditPost(p) && (
                    <button onClick={() => setPosModal({ tipe: 'EKSTERNAL', editing: p })}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, width: '100%', marginTop: 10,
                        border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                  )}
                </ItemRingkas>
              ))}
            </div>
          </div>
        </div>
      )}

      {posModal && (
        <PosModal
          tipe={posModal.tipe}
          editing={posModal.editing}
          users={users}
          circles={data?.circles ?? []}
          rumahUsahaList={data?.rumahUsahaList ?? []}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setPosModal(null)}
          onSaved={refetch}
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
          Memuat data keuangan...
        </div>
      )}
    </>
  )
}

// ── Section Dana Ekosistem ─────────────────────────────────
// Dulu tab terpisah dari "Pos Keuangan" -- digabung 20 Juli 2026 karena Dana Forum & Dana
// Berkah Ekosistem itu SATU pos yang sama dengan field danaForum/danaBerkah di sini (nama beda
// model doang, bukan konsep beda), jadi gak masuk akal dipisah tab. posMap (dari Finance())
// nyocokin FinancePost yang namanya match, ditampilkan sebagai caption admin+rekening di
// InputRp -- Dana PE gak punya posMap karena memang gak ada Pos Keuangan buat itu.
// Dana per Circle/Rumah Usaha ("dana rumah tangga") TIDAK di sini -- itu levelnya mingguan,
// sudah pindah ke laporan mingguan di halaman Laporan Omset (tab "Kas Circle & Rumah Usaha").
function DanaEkosistemTab({ bulan, tahun, user, posMap, getUserNama }) {
  const isFullAdmin   = user?.roles?.some(r => ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType))
  const isAdminFung   = user?.roles?.some(r => r.roleType === 'ADMIN_FUNGSIONAL')
  const canEditEco    = isFullAdmin || isAdminFung
  const { data: ecoRaw, loading: ecoLoading } = useApi(`/api/monthly-data/ecosystem?bulan=${bulan}&tahun=${tahun}`)

  const [eco, setEco]           = useState({ danaPE: 0, danaForum: 0, danaBerkah: 0, rumahUsaha: 5 })
  const [savedEco, setSavedEco] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState(null)
  const msgTimer = useRef(null)
  useEffect(() => () => clearTimeout(msgTimer.current), [])

  useEffect(() => {
    setEco({ danaPE: 0, danaForum: 0, danaBerkah: 0, rumahUsaha: 5 })
    setSavedEco(null)
  }, [bulan, tahun])

  // Data bulan yang dipilih belum ada -> server memberi data bulan sebelumnya. Jangan terlihat seperti
  // sudah tersimpan: beri keterangan dan biarkan tombol Simpan aktif untuk mengisi bulan ini.
  const dariBulanLain = !!ecoRaw && ecoRaw.bulan != null && (Number(ecoRaw.bulan) !== bulan || Number(ecoRaw.tahun) !== tahun)

  useEffect(() => {
    if (ecoRaw) {
      const v = {
        danaPE:     ecoRaw.danaPE     ?? 0,
        danaForum:  ecoRaw.danaForum  ?? 0,
        danaBerkah: ecoRaw.danaBerkah ?? 0,
        rumahUsaha: ecoRaw.rumahUsaha ?? 5,
      }
      setEco(v)
      setSavedEco(dariBulanLain ? null : v)
    }
  }, [ecoRaw, dariBulanLain])

  const isEcoDirty = savedEco === null
    ? (eco.danaPE !== 0 || eco.danaForum !== 0 || eco.danaBerkah !== 0)
    : JSON.stringify(eco) !== JSON.stringify(savedEco)

  const showMsg = (ok, text) => {
    setMsg({ ok, text })
    clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(null), 2500)
  }

  const saveEco = async () => {
    setSaving(true); setMsg(null)
    try {
      await api.post('/api/monthly-data/ecosystem', { bulan, tahun, ...eco })
      setSavedEco({ ...eco })
      showMsg(true, 'Dana ekosistem tersimpan')
    } catch { showMsg(false, 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <div className="card">
        <div className="card-header" style={{ marginBottom: 16 }}>
          <span className="card-title">Dana Ekosistem</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{MONTHS[bulan-1]} {tahun}</span>
        </div>
        {ecoLoading ? <div className="spinner" /> : (
          <>
            {dariBulanLain && (
              <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 12, lineHeight: 1.5 }}>
                ⚠️ {MONTHS[bulan - 1]} {tahun} belum diisi. Angka di bawah dari {MONTHS[Number(ecoRaw.bulan) - 1]} {ecoRaw.tahun}.
                Periksa lalu tekan Simpan untuk mengisi {MONTHS[bulan - 1]} {tahun}.
              </div>
            )}
            <InputRp label="Dana PE"     value={eco.danaPE}     onChange={v => setEco(p => ({ ...p, danaPE: v }))}     disabled={!canEditEco}
              pos={posMap?.danaPE} getUserNama={getUserNama} />
            <InputRp label="Dana Forum"  value={eco.danaForum}  onChange={v => setEco(p => ({ ...p, danaForum: v }))}  disabled={!canEditEco}
              pos={posMap?.danaForum} getUserNama={getUserNama} />
            <InputRp label="Dana Berkah" value={eco.danaBerkah} onChange={v => setEco(p => ({ ...p, danaBerkah: v }))} disabled={!canEditEco}
              pos={posMap?.danaBerkah} getUserNama={getUserNama} />
            {canEditEco && isEcoDirty && (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
                onClick={saveEco} disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan Dana Ekosistem'}
              </button>
            )}
          </>
        )}
      </div>

      {msg && (
        <div style={{
          marginTop: 12, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: msg.ok ? 'color-mix(in srgb, var(--green) 12%, transparent)' : 'color-mix(in srgb, var(--red) 12%, transparent)',
          color: msg.ok ? 'var(--green)' : 'var(--red)',
          border: `1px solid ${msg.ok ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'color-mix(in srgb, var(--red) 20%, transparent)'}`,
        }}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </div>
      )}
    </div>
  )
}

// ── Section Kas Circle & Rumah Usaha ───────────────────────
// Dulu tab tersendiri di halaman Laporan Omset -- dipindah ke sini 20 Juli 2026 karena ini
// konsepnya kas/keuangan (bukan laporan omset studio), jadi lebih pas satu tempat dengan sisa
// halaman Keuangan. Levelnya MINGGUAN (beda dari Dana Ekosistem di atas yang bulanan) --
// sengaja TIDAK dipaksa gabung jadi satu tabel, cukup satu halaman yang sama.
const ORG_TYPE_LABEL = { circle: 'Circle', rumahUsaha: 'Rumah Usaha' }

function OrgKasModal({ entity, entityType, weekStart, weekEnd, existingReport, prevDana, onClose, onSaved }) {
  const [form, setForm] = useState({
    dana:        existingReport?.dana ?? (prevDana != null ? String(prevDana) : ''),
    pengeluaran: existingReport?.pengeluaran ?? 0,
    catatan:     existingReport?.catatan     ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const save = async (e) => {
    e.preventDefault()
    if (form.dana === '') return setError('Dana wajib diisi')
    setSaving(true); setError(null)
    try {
      if (existingReport) {
        await api.put(`/api/org-fund-reports/${existingReport.id}`, {
          dana:        Number(form.dana),
          pengeluaran: Number(form.pengeluaran),
          catatan:     form.catatan,
        })
      } else {
        await api.post('/api/org-fund-reports', {
          [entityType === 'circle' ? 'circleId' : 'rumahUsahaId']: entity.id,
          periodeAwal: weekStart,
          // periodeAkhir gak dikirim -- server derive sendiri lewat getReportingPeriod.
          dana:        Number(form.dana),
          pengeluaran: Number(form.pengeluaran),
          catatan:     form.catatan,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Update Dana</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{entity.nama}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Dana Sekarang (IDR) *</label>
              <input type="number" min="0" className="form-input" style={{ paddingLeft: 14 }}
                placeholder="0" value={form.dana}
                onChange={e => setForm(f => ({ ...f, dana: e.target.value }))} autoFocus />
              {!existingReport && prevDana != null && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Dilanjutkan dari laporan sebelumnya · {formatRp(prevDana)}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Pengeluaran (IDR)</label>
              <input type="number" min="0" className="form-input" style={{ paddingLeft: 14 }}
                placeholder="0" value={form.pengeluaran}
                onChange={e => setForm(f => ({ ...f, pengeluaran: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Catatan (opsional)</label>
            <textarea className="form-input" style={{ paddingLeft: 14, resize: 'vertical', minHeight: 64, paddingTop: 10 }}
              placeholder="Catatan..."
              value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} />
          </div>
          {existingReport && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-subtle)',
              color: 'var(--amber)', fontSize: 12 }}>
              Laporan minggu ini sudah ada — nilai sebelumnya akan diperbarui.
            </div>
          )}
          {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 130 }}>
              {saving ? <><span className="spinner"/> Menyimpan...</> : 'Simpan Dana'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OrgKasTab({ user }) {
  const [entityType, setEntityType] = useState('circle')
  const [weekStart, setWeekStart] = useState(getReportingPeriod(getWeekDates().start).periodeAwal)
  const [orgKasModal, setOrgKasModal] = useState(null)
  const [filter, setFilter] = useState('')

  const weekEnd = getReportingPeriod(weekStart).periodeAkhir

  const { data: statusData, loading, refetch } = useApi(
    `/api/org-fund-reports/status?type=${entityType}&weekStart=${weekStart}`,
    [entityType, weekStart]
  )

  const isSuperAdmin = ['ADVISOR','KEPALA_EKOSISTEM'].some(r => user?.roles?.some(ur => ur.roleType === r))
  const myCircleIds = new Set((user?.roles ?? []).filter(r => ['KEPALA_CIRCLE','ADMIN_FUNGSIONAL'].includes(r.roleType) && r.circleId).map(r => r.circleId))
  const myRumahUsahaIds = new Set((user?.roles ?? []).filter(r => r.roleType === 'KEPALA_RUMAH_USAHA' && r.rumahUsahaId).map(r => r.rumahUsahaId))
  const canUpdate = (entityId) => isSuperAdmin || (entityType === 'circle' ? myCircleIds.has(entityId) : myRumahUsahaIds.has(entityId))

  const entities = (statusData ?? []).filter(e => !filter || e.nama.toLowerCase().includes(filter.toLowerCase()))

  const totalDana  = entities.reduce((a, e) => a + (e.laporanTerakhir?.dana ?? 0), 0)
  const sudahUpdate = entities.filter(e => e.sudahLapor).length

  const openModal = (entity) => {
    const report = entity.sudahLapor ? entity.laporanTerakhir : null
    setOrgKasModal({ entity, existingReport: report, prevDana: entity.danaSebelumnya ?? null })
  }

  const handleSaved = () => refetch()

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Kas Circle & Rumah Usaha</span>
      </div>

      {/* Toggle tipe entitas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {Object.entries(ORG_TYPE_LABEL).map(([key, label]) => (
          <button key={key} onClick={() => setEntityType(key)}
            style={{ padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: entityType === key ? 'var(--bg-card)' : 'none',
              color: entityType === key ? 'var(--text)' : 'var(--text-secondary)',
            }}>{label}</button>
        ))}
      </div>

      {/* Summary bar */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: `Total Dana ${ORG_TYPE_LABEL[entityType]}`, val: formatRp(totalDana), color: 'purple' },
          { label: 'Sudah Update',        val: `${sudahUpdate}/${entities.length}`, color: 'green' },
        ].map(c => (
          <div key={c.label} className={`stat-card ${c.color}`}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: 17 }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filter + week picker */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder={`Cari ${ORG_TYPE_LABEL[entityType].toLowerCase()}...`} value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '7px 12px', width: 200 }} />
        <div style={{ marginLeft: 'auto' }}>
          <MonthWeekPicker value={weekStart} onChange={setWeekStart} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      ) : (
        <>
          {/* Desktop: tabel */}
          <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th>{ORG_TYPE_LABEL[entityType]}</th>
                  <th style={{ textAlign: 'right' }}>Dana Sekarang</th>
                  <th style={{ textAlign: 'right' }}>Pengeluaran Minggu Ini</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Update Minggu Ini</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entities.map(e => {
                  const lap    = e.laporanTerakhir
                  const dana   = lap?.dana ?? null
                  const status = getKasStatus(dana)
                  const bisa   = canUpdate(e.id)
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                          {e.nama}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: dana != null ? 'var(--text)' : 'var(--text-muted)', fontSize: 14 }}>
                        {dana != null ? formatRp(dana) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: (lap?.pengeluaran ?? 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {(lap?.pengeluaran ?? 0) > 0 ? formatRp(lap.pengeluaran) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {dana != null ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: status.color,
                            padding: '2px 8px', borderRadius: 5,
                            background: status.color === 'var(--green)' ? 'var(--green-subtle)'
                              : status.color === 'var(--red)' ? 'var(--red-subtle)' : 'var(--amber-subtle)',
                          }}>
                            {status.label}
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {e.sudahLapor
                          ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Sudah</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {bisa ? (
                          <button onClick={() => openModal(e)}
                            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: e.sudahLapor ? 'var(--bg-surface)' : 'var(--accent)',
                              color: e.sudahLapor ? 'var(--text-secondary)' : '#fff',
                              cursor: 'pointer', fontWeight: 600 }}>
                            {e.sudahLapor ? 'Update' : '+ Input Dana'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {entities.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Belum ada {ORG_TYPE_LABEL[entityType]} terdaftar.
              </div>
            )}
          </div>

          {/* Mobile: list ringkas, ketuk baris untuk detail & tombol update */}
          <div className="responsive-cards list-ringkas" style={{ margin: 12, maxHeight: '70vh', overflowY: 'auto' }}>
            {entities.map(e => {
              const lap    = e.laporanTerakhir
              const dana   = lap?.dana ?? null
              const status = getKasStatus(dana)
              const bisa   = canUpdate(e.id)
              return (
                <ItemRingkas key={e.id} judul={e.nama} warna={e.colorHex ?? 'var(--text-muted)'}
                  sub={e.sudahLapor ? <span style={{ color: 'var(--green)' }}>✓ Sudah update</span> : 'Belum update minggu ini'}
                  nilai={dana != null ? <span style={{ color: status.color }}>{formatRp(dana)}</span> : '—'}>
                  <div className="data-card-row">
                    <span className="data-card-label">Dana Sekarang</span>
                    <span className="data-card-value" style={{ fontWeight: 700, color: dana != null ? 'var(--text)' : 'var(--text-muted)' }}>
                      {dana != null ? formatRp(dana) : '—'}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Pengeluaran Minggu Ini</span>
                    <span className="data-card-value" style={{ color: (lap?.pengeluaran ?? 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {(lap?.pengeluaran ?? 0) > 0 ? formatRp(lap.pengeluaran) : '—'}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Status</span>
                    <span className="data-card-value">
                      {dana != null ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: status.color,
                          padding: '2px 8px', borderRadius: 5,
                          background: status.color === 'var(--green)' ? 'var(--green-subtle)'
                            : status.color === 'var(--red)' ? 'var(--red-subtle)' : 'var(--amber-subtle)',
                        }}>
                          {status.label}
                        </span>
                      ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada</span>}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Update Minggu Ini</span>
                    <span className="data-card-value">
                      {e.sudahLapor
                        ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Sudah</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum</span>
                      }
                    </span>
                  </div>
                  {bisa && (
                    <button onClick={() => openModal(e)}
                      style={{ fontSize: 12, padding: '7px 14px', borderRadius: 6, width: '100%', marginTop: 10,
                        border: '1px solid var(--border)',
                        background: e.sudahLapor ? 'var(--bg-surface)' : 'var(--accent)',
                        color: e.sudahLapor ? 'var(--text-secondary)' : '#fff',
                        cursor: 'pointer', fontWeight: 600 }}>
                      {e.sudahLapor ? 'Update' : '+ Input Dana'}
                    </button>
                  )}
                </ItemRingkas>
              )
            })}
            {entities.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Belum ada {ORG_TYPE_LABEL[entityType]} terdaftar.
              </div>
            )}
          </div>
        </>
      )}

      {orgKasModal && (
        <OrgKasModal
          entity={orgKasModal.entity}
          entityType={entityType}
          weekStart={weekStart}
          weekEnd={weekEnd}
          existingReport={orgKasModal.existingReport}
          prevDana={orgKasModal.prevDana}
          onClose={() => setOrgKasModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ── Modal Tambah/Edit Pos Keuangan ─────────────────────────
// Belum pernah ada sebelum 20 Juli 2026 -- dulu seluruh isi Pos Internal/Dana Lainnya murni
// dari data seed, gak ada cara nambah pos baru (mis. buat Rumah Usaha baru) tanpa migration manual.
// "Cakupan" (Ekosistem/Circle/Rumah Usaha) digabung jadi satu dropdown karena cuma salah satu
// dari circleId/rumahUsahaId yang boleh terisi (atau dua-duanya kosong buat level Ekosistem).
function PosModal({ tipe, editing, users, circles, rumahUsahaList, isSuperAdmin, onClose, onSaved }) {
  const initialCakupan = editing?.circleId ? `circle:${editing.circleId}`
    : editing?.rumahUsahaId ? `rumahUsaha:${editing.rumahUsahaId}`
    : 'ekosistem'
  const [form, setForm] = useState({
    nama:        editing?.nama        ?? '',
    adminId:     editing?.adminId     ?? '',
    cakupan:     initialCakupan,
    namaBank:    editing?.namaBank    ?? '',
    noRekening:  editing?.noRekening  ?? '',
    namaPemilik: editing?.namaPemilik ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    if (!form.nama.trim() || !form.adminId) return setError('Nama dan admin wajib diisi')
    setSaving(true); setError(null)
    const [scope, scopeId] = form.cakupan.split(':')
    const payload = {
      nama:         form.nama.trim(),
      adminId:      form.adminId,
      circleId:     scope === 'circle'     ? scopeId : null,
      rumahUsahaId: scope === 'rumahUsaha' ? scopeId : null,
      namaBank:     form.namaBank.trim()    || null,
      noRekening:   form.noRekening.trim()  || null,
      namaPemilik:  form.namaPemilik.trim() || null,
    }
    try {
      if (editing) {
        await api.put(`/api/finance/posts/${editing.id}`, payload)
      } else {
        await api.post('/api/finance/posts', { ...payload, tipe })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirm(`Hapus pos "${editing.nama}"?`)) return
    setDeleting(true)
    try {
      await api.delete(`/api/finance/posts/${editing.id}`)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus')
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{editing ? 'Edit Pos' : 'Tambah Pos'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {tipe === 'INTERNAL' ? 'Pos Internal' : 'Dana Lainnya'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <form onSubmit={save}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Nama Pos *</label>
            <input className="form-input" style={{ paddingLeft: 14 }} value={form.nama}
              onChange={e => set('nama', e.target.value)} placeholder="mis. Dana Rumah Usaha X" autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Admin *</label>
            <select className="form-input" style={{ paddingLeft: 10 }} value={form.adminId} disabled={!isSuperAdmin}
              onChange={e => set('adminId', e.target.value)}>
              <option value="">— Pilih admin —</option>
              {(users ?? []).slice().sort((a, b) => a.nama.localeCompare(b.nama)).map(u => (
                <option key={u.id} value={u.id}>{u.nama}</option>
              ))}
            </select>
            {!isSuperAdmin && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cuma superadmin yang bisa pindahkan admin pos ini</span>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Cakupan</label>
            <select className="form-input" style={{ paddingLeft: 10 }} value={form.cakupan} disabled={!isSuperAdmin}
              onChange={e => set('cakupan', e.target.value)}>
              <option value="ekosistem">Ekosistem (gak terikat circle/rumah usaha tertentu)</option>
              {circles.length > 0 && (
                <optgroup label="Circle">
                  {circles.map(c => <option key={c.id} value={`circle:${c.id}`}>{c.nama}</option>)}
                </optgroup>
              )}
              {rumahUsahaList.length > 0 && (
                <optgroup label="Rumah Usaha">
                  {rumahUsahaList.map(r => <option key={r.id} value={`rumahUsaha:${r.id}`}>{r.nama}</option>)}
                </optgroup>
              )}
            </select>
            {!isSuperAdmin && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cuma superadmin yang bisa pindahkan cakupan pos ini</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Nama Bank</label>
              <input className="form-input" style={{ paddingLeft: 14 }} value={form.namaBank}
                onChange={e => set('namaBank', e.target.value)} placeholder="BCA, SMBC, dll" />
            </div>
            <div className="form-group">
              <label className="form-label">No. Rekening</label>
              <input className="form-input" style={{ paddingLeft: 14 }} value={form.noRekening}
                onChange={e => set('noRekening', e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Nama Pemilik Rekening</label>
            <input className="form-input" style={{ paddingLeft: 14 }} value={form.namaPemilik}
              onChange={e => set('namaPemilik', e.target.value)} />
          </div>
          {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 110 }}>
                {saving ? <><span className="spinner"/> Menyimpan...</> : 'Simpan'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            </div>
            {editing && isSuperAdmin && (
              <button type="button" onClick={remove} disabled={deleting}
                style={{ fontSize: 13, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {deleting ? 'Menghapus...' : 'Hapus Pos'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
