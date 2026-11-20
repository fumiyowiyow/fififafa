import { useState } from 'react'
import { formatUSD } from '../../utils/format'
import { onActivate } from '../../utils/a11y'
import BadgeKolaborasi from '../../components/common/BadgeKolaborasi'
import ItemRingkas from '../../components/common/ItemRingkas'
import { getWeekDates, getReportingPeriod } from '../../utils/week'
import { MonthWeekPicker } from '../../components/common/MonthWeekPicker'
import { PLATFORMS } from './constants'
import { kelasBadgeTipe } from '../../utils/tipeUnit'

const STATUS_DOT = { true: { color: 'var(--green)', label: '✓ Sudah' }, false: { color: 'var(--red)', label: '✗ Belum' } }

// ── Tab Mingguan: Status Laporan — pilih periode minggu, expand detail platform ──
export default function StatusGrid({ statusData, statusLoading, viewWeek, setViewWeek, canEditReport, setEditReport }) {
  const [statusSearch, setStatusSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">Status Laporan</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {statusData ? `${statusData.filter(s => s.sudahLapor).length}/${statusData.length} studio` : '…'}
            {statusData?.some(s => s.sudahLapor) && <span style={{ marginLeft: 6, opacity: 0.6 }}>· klik baris untuk detail</span>}
          </span>
          <input className="form-input" placeholder="Cari studio..." value={statusSearch}
            onChange={e => setStatusSearch(e.target.value)}
            style={{ padding: '6px 10px', width: 160, fontSize: 13 }} />
          <MonthWeekPicker value={viewWeek} onChange={setViewWeek} />
          {viewWeek !== getReportingPeriod(getWeekDates().start).periodeAwal && (
            <button onClick={() => setViewWeek(getReportingPeriod(getWeekDates().start).periodeAwal)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Minggu ini
            </button>
          )}
        </div>
      </div>
      {statusLoading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</div>
      ) : (() => {
        const filteredStatusData = (statusData ?? []).filter(s =>
          !statusSearch ||
          s.nama.toLowerCase().includes(statusSearch.toLowerCase()) ||
          (s.circle ?? s.rumahUsaha)?.nama?.toLowerCase().includes(statusSearch.toLowerCase())
        )
        return (
        <>
        {/* Desktop: tabel */}
        <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'var(--bg-card)' }}>
                <th>Studio / Project</th>
                <th>Circle</th>
                <th>Tipe</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Total USD</th>
              </tr>
            </thead>
            <tbody>
              {filteredStatusData.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Studio tidak ditemukan</td></tr>
              )}
              {filteredStatusData.map(s => {
                const lap = s.laporanTerakhir
                const isExpanded = expandedId === s.id
                const platforms = lap ? PLATFORMS.filter(p => lap[p.key] > 0) : []
                return (
                  <>
                    <tr key={s.id}
                      onClick={() => s.sudahLapor && setExpandedId(isExpanded ? null : s.id)}
                      {...(s.sudahLapor ? { tabIndex: 0, onKeyDown: onActivate(() => setExpandedId(isExpanded ? null : s.id)) } : {})}
                      style={{ cursor: s.sudahLapor ? 'pointer' : 'default', transition: 'background 0.15s' }}
                      onMouseEnter={e => s.sudahLapor && (e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 3%, transparent)')}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {s.sudahLapor && <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : '' }}>▶</span>}
                          {s.nama}
                          <BadgeKolaborasi studio={s} />
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: (s.circle ?? s.rumahUsaha)?.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                          {(s.circle ?? s.rumahUsaha)?.nama ?? '—'}
                        </span>
                      </td>
                      <td><span className={`badge ${kelasBadgeTipe(s.tipe)}`}>{s.tipe}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: STATUS_DOT[s.sudahLapor].color, fontWeight: 700, fontSize: 13 }}>
                          {STATUS_DOT[s.sudahLapor].label}
                        </span>
                        {s.laporLewat && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>lewat {s.laporLewat}</div>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {lap ? formatUSD(lap.totalUsd) : '—'}
                      </td>
                    </tr>
                    {isExpanded && lap && (
                      <tr key={`${s.id}-detail`} style={{ background: 'color-mix(in srgb, var(--text) 2%, transparent)' }}>
                        <td colSpan={5} style={{ padding: '8px 16px 12px 32px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            {platforms.length === 0 ? (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada detail platform</span>
                            ) : platforms.map(p => (
                              <div key={p.key} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '4px 10px', borderRadius: 20,
                                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                fontSize: 12,
                              }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{p.label}</span>
                                <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{formatUSD(lap[p.key])}</span>
                              </div>
                            ))}
                            {canEditReport({ studioId: s.id }) && (
                              <button onClick={e => { e.stopPropagation(); setEditReport({ ...lap, studioId: s.id, studio: { nama: s.nama } }) }}
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: list ringkas, ketuk baris untuk rincian platform */}
        <div className="responsive-cards list-ringkas" style={{ margin: 12, maxHeight: '70vh', overflowY: 'auto' }}>
          {filteredStatusData.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Studio tidak ditemukan</div>
          )}
          {filteredStatusData.map(s => {
            const lap = s.laporanTerakhir
            const platforms = lap ? PLATFORMS.filter(p => lap[p.key] > 0) : []
            return (
              <ItemRingkas key={s.id} judul={<>{s.nama} <BadgeKolaborasi studio={s} /></>}
                warna={(s.circle ?? s.rumahUsaha)?.colorHex ?? 'var(--text-muted)'}
                sub={<>{(s.circle ?? s.rumahUsaha)?.nama ?? '—'} · <span style={{ color: STATUS_DOT[s.sudahLapor].color }}>{STATUS_DOT[s.sudahLapor].label}</span>{s.laporLewat && ` (lewat ${s.laporLewat})`}</>}
                nilai={lap ? formatUSD(lap.totalUsd) : '—'}>
                {lap && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {platforms.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tidak ada detail platform</span>
                      ) : platforms.map(p => (
                        <div key={p.key} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', borderRadius: 20,
                          background: 'var(--bg-surface)', border: '1px solid var(--border)',
                          fontSize: 12,
                        }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{p.label}</span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{formatUSD(lap[p.key])}</span>
                        </div>
                      ))}
                    </div>
                    {canEditReport({ studioId: s.id }) && (
                      <button onClick={() => setEditReport({ ...lap, studioId: s.id, studio: { nama: s.nama } })}
                        style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, width: '100%', marginTop: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                        Edit
                      </button>
                    )}
                  </>
                )}
              </ItemRingkas>
            )
          })}
        </div>
        </>
        )
      })()}
    </div>
  )
}
