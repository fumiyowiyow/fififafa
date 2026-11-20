import { useState, useEffect } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { formatRp } from '../../utils/format'
import CircleModal from './CircleModal'
import RumahUsahaModal from './RumahUsahaModal'
import StudioModal from './StudioModal'
import StudioBioModal from './StudioBioModal'
import BadgeKolaborasi from '../../components/common/BadgeKolaborasi'
import StrukturTimTab from './StrukturTimTab'
import ItemRingkas from '../../components/common/ItemRingkas'
import { warnaTipe, LABEL_TIPE_UNIT, naunganNama } from '../../utils/tipeUnit'

export default function MasterData({ autoStudio, onNavigate }) {
  const { user } = useAuth()
  const [tab, setTab] = useState('studios')

  const { data: circles, refetch: refetchCircles }         = useApi('/api/masterdata/circles')
  const { data: rumahUsahaList, refetch: refetchRumahUsaha } = useApi('/api/masterdata/rumah-usaha')
  const { data: studios, refetch: refetchStudios }         = useApi('/api/masterdata/studios')
  const { data: users }                                     = useApi('/api/masterdata/users')
  const { data: anggota, refetch: refetchAnggota }         = useApi('/api/members?limit=200')

  const [circleModal, setCircleModal]         = useState(null)
  const [addCircle, setAddCircle]             = useState(false)
  const [rumahUsahaModal, setRumahUsahaModal] = useState(null)
  const [addRumahUsaha, setAddRumahUsaha]     = useState(false)
  const [bioModal,    setBioModal]      = useState(null)

  useEffect(() => {
    if (!autoStudio || !studios) return
    const s = studios.find(s => s.id === autoStudio)
    if (s) setBioModal(s)
  }, [autoStudio, studios])
  const [addStudio,   setAddStudio]     = useState(false)
  const [filterCircle, setFilterCircle] = useState('all')
  const [search, setSearch]             = useState('')

  // Cocok persis dengan 'adminOnly' di server/src/routes/masterdata.js — endpoint create/edit
  // Circle & Rumah Usaha memang cuma buat admin ekosistem, KOORDINATOR gak diizinkan server
  // (beda dengan edit Studio individual yang scope-nya lebih luas, lihat canEditStudioRow).
  const canEdit    = user?.roles?.some(r => ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType))
  const canDelete  = user?.roles?.some(r => ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType))
  const myStudioIds  = new Set((user?.roles ?? []).filter(r => r.studioId).map(r => r.studioId))
  const myCircleIds  = new Set((user?.roles ?? []).filter(r => r.circleId).map(r => r.circleId))
  const myRumahUsahaIds = new Set((user?.roles ?? []).filter(r => r.rumahUsahaId).map(r => r.rumahUsahaId))
  // Satu-satunya gate buat "bisa kelola studio ini" (dipakai baik buat tombol Edit di baris
  // tabel maupun bagian Info Dasar/SKB/Rekening/Anggota di dalam StudioBioModal) — samakan
  // persis dengan otorisasi server (canManageStudio di utils/roles.js, dipakai updateStudio,
  // uploadStudioSkb, dll): admin ekosistem bebas, Kepala Circle terbatas circle sendiri,
  // Kepala Rumah Usaha terbatas rumah usaha sendiri, Koordinator/Pendamping terbatas studio sendiri.
  const canEditStudioRow = (studio) => {
    if (user?.roles?.some(r => ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType))) return true
    if (user?.roles?.some(r => r.roleType === 'KEPALA_CIRCLE') && myCircleIds.has(studio.circleId)) return true
    if (user?.roles?.some(r => r.roleType === 'KEPALA_RUMAH_USAHA') && myRumahUsahaIds.has(studio.rumahUsahaId)) return true
    return myStudioIds.has(studio.id)
  }

  const filteredStudios = (studios ?? []).filter(s => {
    const matchCircle = filterCircle === 'all' || s.circleId === filterCircle
      || (filterCircle === 'korporasi' && (s.tipe === 'KORPORASI' || s.indukId))
    const matchSearch = s.nama.toLowerCase().includes(search.toLowerCase())
    return matchCircle && matchSearch
  })

  return (
    <>
      {/* Header */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Unit Usaha</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Kelola circle, rumah usaha, studio, dan project ekosistem {ECOSYSTEM_NAME}
          </p>
        </div>
        {tab === 'circles' && canEdit && (
          <button className="btn btn-primary" onClick={() => setAddCircle(true)}>
            + Tambah Circle
          </button>
        )}
        {tab === 'studios' && canEdit && (
          <button className="btn btn-primary" onClick={() => setAddStudio(true)}>
            + Tambah Studio
          </button>
        )}
        {tab === 'rumahUsaha' && canEdit && (
          <button className="btn btn-primary" onClick={() => setAddRumahUsaha(true)}>
            + Tambah Rumah Usaha
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[['circles',`Circle (${(circles ?? []).length})`], ['rumahUsaha',`Rumah Usaha (${(rumahUsahaList ?? []).length})`], ['studios','Studio & Project'], ['struktur','Struktur Tim']].map(([key, label]) => (
          <button key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: tab === key ? 'var(--bg-card)' : 'none',
              color: tab === key ? 'var(--text)' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer',
            }}>{label}</button>
        ))}
      </div>

      {/* ── TAB: CIRCLES ── */}
      {tab === 'circles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {(circles ?? []).map(c => {
            const kepala    = c.userRoles?.find(r => r.roleType === 'KEPALA_CIRCLE')?.user
            const pengurus  = c.userRoles?.filter(r => r.roleType === 'ADMIN_FUNGSIONAL').map(r => r.user) ?? []
            return (
              <div key={c.id} className="card" style={{ borderTop: `3px solid ${c.colorHex}` }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.colorHex, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{c.nama}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => setCircleModal(c)}>
                    Bio
                  </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.colorHex }}>{c._count?.studios ?? 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Studio</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{c._count?.userRoles ?? 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Anggota</div>
                  </div>
                </div>

                {/* People */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c.colorHex, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Kepala</span>
                    <span style={{ fontSize: 13, color: kepala ? 'var(--text)' : 'var(--text-muted)', fontWeight: kepala ? 600 : 400 }}>
                      {kepala?.nama ?? '—'}
                    </span>
                  </div>
                  {pengurus.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Pengurus</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {pengurus.map(p => p.nama).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: RUMAH USAHA ── */}
      {tab === 'rumahUsaha' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {(rumahUsahaList ?? []).map(ru => {
            const kepala = ru.userRoles?.find(r => r.roleType === 'KEPALA_RUMAH_USAHA')?.user
            const warna  = ru.colorHex || 'var(--cyan)'
            return (
              <div key={ru.id} className="card" style={{ borderTop: `3px solid ${warna}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: warna, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>🏠 {ru.nama}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => setRumahUsahaModal(ru)}>
                    Bio
                  </button>
                </div>

                {ru.deskripsi && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{ru.deskripsi}</div>
                )}

                <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: warna }}>{ru._count?.studios ?? 0}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Studio</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: warna, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Kepala</span>
                    <span style={{ fontSize: 13, color: kepala ? 'var(--text)' : 'var(--text-muted)', fontWeight: kepala ? 600 : 400 }}>
                      {kepala?.nama ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
          {(rumahUsahaList ?? []).length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Belum ada Rumah Usaha. Klik "+ Tambah Rumah Usaha" untuk menambahkan.
            </div>
          )}
        </div>
      )}

      {/* ── TAB: STUDIOS ── */}
      {tab === 'studios' && (
        <>
          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ width: 'min(220px, 100%)', padding: '7px 12px' }}
              placeholder="Cari studio…" value={search}
              onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{ width: 180, padding: '7px 12px' }}
              value={filterCircle} onChange={e => setFilterCircle(e.target.value)}>
              <option value="all">Semua Circle</option>
              {(circles ?? []).map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
              {(studios ?? []).some(s => s.tipe === 'KORPORASI') && <option value="korporasi">Korporasi</option>}
            </select>
            <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13, lineHeight: '34px' }}>
              {filteredStudios.length} unit usaha
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0 }}>
            {/* Desktop: tabel */}
            <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  {['Nama','Naungan','Tipe','Koordinator','CPM','Status',''].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11,
                      fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                      letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudios.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{s.nama} <BadgeKolaborasi studio={s} style={{ marginLeft: 6, fontWeight: 600 }} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: (s.circle ?? s.rumahUsaha)?.colorHex, flexShrink: 0 }} />
                        {naunganNama(s)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        ...warnaTipe(s.tipe),
                      }}>{LABEL_TIPE_UNIT[s.tipe] ?? s.tipe}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {users?.find(u => u.id === s.koordinatorId)?.nama ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: s.cpm > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {s.cpm > 0 ? formatRp(s.cpm) : <span style={{ fontStyle: 'italic' }}>belum diatur</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: s.statusAktif ? 'var(--green-subtle)' : 'var(--red-subtle)',
                        color: s.statusAktif ? 'var(--green)' : 'var(--red)',
                      }}>{s.statusAktif ? 'Aktif' : 'Nonaktif'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => setBioModal(s)}>
                          Bio
                        </button>
                        {canDelete && (
                          <button
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#7f1d1d', color: '#fca5a5', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', cursor: 'pointer', fontWeight: 600 }}
                            onClick={async () => {
                              if (!window.confirm(`Hapus permanen studio "${s.nama}"?\n\nSemua laporan omset, kanban, dan data studio akan ikut terhapus. Tindakan tidak bisa dibatalkan.`)) return
                              try {
                                await api.delete(`/api/masterdata/studios/${s.id}`)
                                refetchStudios()
                              } catch (e) {
                                alert(e.response?.data?.message || 'Gagal menghapus studio')
                              }
                            }}>
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudios.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Tidak ada studio ditemukan
              </div>
            )}
            </div>

            {/* Mobile: list ringkas, ketuk baris untuk detail, Bio & hapus */}
            <div className="responsive-cards list-ringkas" style={{ margin: 12, maxHeight: '70vh', overflowY: 'auto' }}>
              {filteredStudios.map(s => (
                <ItemRingkas key={s.id} redup={!s.statusAktif}
                  judul={<>{s.nama} <BadgeKolaborasi studio={s} style={{ marginLeft: 6 }} /></>}
                  warna={(s.circle ?? s.rumahUsaha)?.colorHex}
                  sub={`${naunganNama(s)} · ${LABEL_TIPE_UNIT[s.tipe] ?? s.tipe}${s.statusAktif ? '' : ' · Nonaktif'}`}
                  nilai={s.cpm > 0 ? formatRp(s.cpm) : <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', fontWeight: 400 }}>CPM belum diatur</span>}>
                  <div className="data-card-row">
                    <span className="data-card-label">Tipe</span>
                    <span className="data-card-value">
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        ...warnaTipe(s.tipe),
                      }}>{LABEL_TIPE_UNIT[s.tipe] ?? s.tipe}</span>
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Koordinator</span>
                    <span className="data-card-value">{users?.find(u => u.id === s.koordinatorId)?.nama ?? '—'}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">CPM</span>
                    <span className="data-card-value" style={{ color: s.cpm > 0 ? undefined : 'var(--text-muted)', fontStyle: s.cpm > 0 ? undefined : 'italic', whiteSpace: 'nowrap' }}>
                      {s.cpm > 0 ? formatRp(s.cpm) : 'belum diatur'}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Status</span>
                    <span className="data-card-value">
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: s.statusAktif ? 'var(--green-subtle)' : 'var(--red-subtle)',
                        color: s.statusAktif ? 'var(--green)' : 'var(--red)',
                      }}>{s.statusAktif ? 'Aktif' : 'Nonaktif'}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <span className="card-action" onClick={() => setBioModal(s)}>Bio</span>
                    {canDelete && (
                      <span className="card-action" style={{ color: 'var(--red)' }}
                        onClick={async () => {
                          if (!window.confirm(`Hapus permanen studio "${s.nama}"?\n\nSemua laporan omset, kanban, dan data studio akan ikut terhapus. Tindakan tidak bisa dibatalkan.`)) return
                          try {
                            await api.delete(`/api/masterdata/studios/${s.id}`)
                            refetchStudios()
                          } catch (e) {
                            alert(e.response?.data?.message || 'Gagal menghapus studio')
                          }
                        }}>
                        Hapus
                      </span>
                    )}
                  </div>
                </ItemRingkas>
              ))}
              {filteredStudios.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Tidak ada studio ditemukan
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── TAB: STRUKTUR TIM ── */}
      {tab === 'struktur' && <StrukturTimTab />}


      {/* Modals */}
      {bioModal && (
        <StudioBioModal
          studio={bioModal}
          canEdit={canEditStudioRow(bioModal)}
          onClose={() => setBioModal(null)}
          onNavigate={onNavigate}
          studios={studios}
          users={users}
          circles={circles}
          rumahUsahaList={rumahUsahaList}
          onSaved={refetchStudios}
        />
      )}
      {(circleModal || addCircle) && (
        <CircleModal
          circle={circleModal}
          anggota={anggota ?? []}
          canEdit={canEdit}
          onClose={() => { setCircleModal(null); setAddCircle(false) }}
          onSaved={() => { setCircleModal(null); setAddCircle(false); refetchCircles() }}
        />
      )}
      {(rumahUsahaModal || addRumahUsaha) && (
        <RumahUsahaModal
          rumahUsaha={rumahUsahaModal}
          anggota={anggota ?? []}
          canEdit={canEdit}
          onClose={() => { setRumahUsahaModal(null); setAddRumahUsaha(false) }}
          onSaved={() => { setRumahUsahaModal(null); setAddRumahUsaha(false); refetchRumahUsaha(); refetchStudios() }}
        />
      )}
      {addStudio && (
        <StudioModal
          circles={circles}
          rumahUsaha={rumahUsahaList}
          korporasiList={(studios ?? []).filter(s => s.tipe === 'KORPORASI')}
          users={users}
          onClose={() => setAddStudio(false)}
          onSaved={() => { setAddStudio(false); refetchStudios() }}
        />
      )}
    </>
  )
}
