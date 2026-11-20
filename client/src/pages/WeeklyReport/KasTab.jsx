import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp } from '../../utils/format'
import { getWeekDates, getKasStatus, getReportingPeriod } from '../../utils/week'
import { MonthWeekPicker } from '../../components/common/MonthWeekPicker'
import { TipeBadge } from './shared'
import BadgeKolaborasi, { dihitungDiEkosistem } from '../../components/common/BadgeKolaborasi'
import KasModal from './KasModal'

// ── Tab Kas Studio ───────────────────────────────────────
export default function KasTab({ user }) {
  const [weekStart, setWeekStart] = useState(getReportingPeriod(getWeekDates().start).periodeAwal)
  const [kasModal, setKasModal] = useState(null) // { studio, existingReport }
  const [filter, setFilter]     = useState('')
  const [filterMode, setFilterMode] = useState('semua') // 'semua' | 'kritis' | 'belum' -- dari klik stat card

  const weekEnd = getReportingPeriod(weekStart).periodeAkhir

  const { data: statusData, loading, refetch } = useApi(
    `/api/weekly-reports/status/week?weekStart=${weekStart}`,
    [weekStart]
  )

  const isFullAdmin = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA']
    .some(r => user?.roles?.some(ur => ur.roleType === r))
  const myStudioIds = new Set(
    (user?.roles ?? []).filter(r => r.studioId).map(r => r.studioId)
  )
  const canUpdateKas = (studioId) => isFullAdmin || myStudioIds.has(studioId)
  // Cermin role route PUT /studios/:id/rekening (server/src/routes/masterdata.js) -- saldo rekening
  // = sumber kas, jadi cuma role ini yang bisa ngubah saldo dari modal Update Kas.
  const canEditRekening = ['ADVISOR','KEPALA_EKOSISTEM','KOORDINATOR']
    .some(r => user?.roles?.some(ur => ur.roleType === r))

  const studiosSearched = (statusData ?? []).filter(s =>
    !filter || s.nama.toLowerCase().includes(filter.toLowerCase()) ||
    (s.circle ?? s.rumahUsaha)?.nama?.toLowerCase().includes(filter.toLowerCase())
  )

  // "Kas Sekarang" sekarang live dari SUM(saldo) Rekening Bank (Bio Studio), bukan lagi
  // kasSekarang laporan mingguan terakhir -- diputuskan 31 Juli 2026, lihat server/src/utils/kas.js.
  const isKritis = (s) => s.kasLive < 1_000_000

  // filterMode nyaring lebih lanjut dari hasil pencarian -- angka di stat card tetap dihitung
  // dari studiosSearched (gak ikut menyusut pas filterMode aktif), biar kartu tetap nunjukin
  // total sebenarnya sebagai acuan, bukan ikut ke-filter oleh dirinya sendiri.
  const studios = studiosSearched.filter(s => {
    if (filterMode === 'kritis') return isKritis(s)
    if (filterMode === 'belum') return !s.sudahLapor
    return true
  })

  // Total Kas = kas ekosistem: studio kolaborasi (dihitung di circle mitra) tetap tampil di daftar tapi tidak dijumlah.
  const totalKas    = studiosSearched.filter(dihitungDiEkosistem).reduce((a, s) => a + s.kasLive, 0)
  const sudahUpdate = studiosSearched.filter(s => s.sudahLapor).length
  const kritis      = studiosSearched.filter(isKritis).length

  const openModal = (studio) => {
    const report = studio.sudahLapor ? studio.laporanTerakhir : null
    setKasModal({ studio, existingReport: report })
  }

  const handleSaved = () => refetch()

  return (
    <>
      {/* Summary bar */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Kas Ekosistem', val: formatRp(totalKas), color: 'purple', mode: null },
          { label: 'Sudah Update',        val: `${sudahUpdate}/${studiosSearched.length} studio`, color: 'green', mode: 'belum',
            hint: 'Klik untuk filter studio yang BELUM update kas minggu ini' },
          { label: 'Studio Kritis (< 1jt)', val: kritis > 0 ? `${kritis} studio` : '—', color: kritis > 0 ? 'red' : 'default', mode: 'kritis',
            hint: 'Klik untuk filter studio dengan kas di bawah 1jt' },
        ].map(c => (
          <div key={c.label} className={`stat-card ${c.color}`}
            onClick={c.mode ? () => setFilterMode(m => m === c.mode ? 'semua' : c.mode) : undefined}
            style={{ cursor: c.mode ? 'pointer' : 'default', outline: filterMode === c.mode ? '2px solid var(--accent)' : 'none' }}
            title={c.hint}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: 17 }}>{c.val}</div>
          </div>
        ))}
      </div>
      {filterMode !== 'semua' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -12, marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          Filter aktif: <strong>{filterMode === 'kritis' ? 'Studio Kritis (< 1jt)' : 'Belum Update Minggu Ini'}</strong>
          <span className="card-action" onClick={() => setFilterMode('semua')}>✕ Hapus filter</span>
        </div>
      )}

      {/* Filter + week picker */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Cari studio..." value={filter}
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
        <div className="card">
          {/* Desktop: tabel */}
          <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th>Studio / Project</th>
                  <th>Circle</th>
                  <th style={{ textAlign: 'right' }}>Kas Sekarang</th>
                  <th style={{ textAlign: 'right' }}>Pengeluaran Minggu Ini</th>
                  <th style={{ textAlign: 'center' }}>Status Kas</th>
                  <th style={{ textAlign: 'center' }}>Update Minggu Ini</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {studios.map(s => {
                  const lap    = s.laporanTerakhir
                  const kas    = s.kasLive
                  const status = getKasStatus(kas)
                  const bisa   = canUpdateKas(s.id)
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>
                        {s.nama}
                        <TipeBadge tipe={s.tipe} />
                        <BadgeKolaborasi studio={s} style={{ marginLeft: 6 }} />
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: (s.circle ?? s.rumahUsaha)?.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                          {(s.circle ?? s.rumahUsaha)?.nama ?? '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: kas != null ? 'var(--text)' : 'var(--text-muted)', fontSize: 14 }}>
                        {kas != null ? formatRp(kas) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: (lap?.pengeluaran ?? 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {(lap?.pengeluaran ?? 0) > 0 ? formatRp(lap.pengeluaran) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {kas != null ? (
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
                        {s.sudahLapor
                          ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Sudah</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {bisa ? (
                          <button onClick={() => openModal(s)}
                            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: s.sudahLapor ? 'var(--bg-surface)' : 'var(--accent)',
                              color: s.sudahLapor ? 'var(--text-secondary)' : '#fff',
                              cursor: 'pointer', fontWeight: 600 }}>
                            {s.sudahLapor ? 'Update' : '+ Input Kas'}
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
          </div>

          {/* Mobile: kartu bertumpuk */}
          <div className="responsive-cards" style={{ padding: 12, maxHeight: '70vh', overflowY: 'auto' }}>
            {studios.map(s => {
              const lap    = s.laporanTerakhir
              const kas    = s.kasLive
              const status = getKasStatus(kas)
              const bisa   = canUpdateKas(s.id)
              return (
                <div key={s.id} className="data-card">
                  <div className="data-card-row">
                    <span className="data-card-label">Studio / Project</span>
                    <span className="data-card-value" style={{ fontWeight: 700 }}>{s.nama}<TipeBadge tipe={s.tipe} /><BadgeKolaborasi studio={s} style={{ marginLeft: 6 }} /></span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Circle</span>
                    <span className="data-card-value" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: (s.circle ?? s.rumahUsaha)?.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                      {(s.circle ?? s.rumahUsaha)?.nama ?? '—'}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Kas Sekarang</span>
                    <span className="data-card-value" style={{ fontWeight: 700, color: kas != null ? 'var(--text)' : 'var(--text-muted)' }}>
                      {kas != null ? formatRp(kas) : '—'}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Pengeluaran Minggu Ini</span>
                    <span className="data-card-value" style={{ color: (lap?.pengeluaran ?? 0) > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {(lap?.pengeluaran ?? 0) > 0 ? formatRp(lap.pengeluaran) : '—'}
                    </span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Status Kas</span>
                    <span className="data-card-value">
                      {kas != null ? (
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
                      {s.sudahLapor
                        ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Sudah</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum</span>
                      }
                    </span>
                  </div>
                  {bisa && (
                    <button onClick={() => openModal(s)}
                      style={{ fontSize: 12, padding: '7px 14px', borderRadius: 6, width: '100%', marginTop: 10,
                        border: '1px solid var(--border)',
                        background: s.sudahLapor ? 'var(--bg-surface)' : 'var(--accent)',
                        color: s.sudahLapor ? 'var(--text-secondary)' : '#fff',
                        cursor: 'pointer', fontWeight: 600 }}>
                      {s.sudahLapor ? 'Update' : '+ Input Kas'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {kasModal && (
        <KasModal
          studio={kasModal.studio}
          weekStart={weekStart}
          weekEnd={weekEnd}
          existingReport={kasModal.existingReport}
          canEditRekening={canEditRekening}
          onClose={() => setKasModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
