import { useState } from 'react'
import { formatUSD, formatRp, formatTanggalPendek } from '../../utils/format'
import ItemRingkas from '../../components/common/ItemRingkas'
import { PLATFORMS } from './constants'

// ── MonthlyReport section: breakdown per-circle + expand detail mingguan/platform ──
export default function MonthlyReportBreakdown({ byCircle, canEditReport, setEditReport }) {
  const [expanded, setExpanded] = useState({})
  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  // Buka EditModal yang sama kayak tab Riwayat Laporan, langsung dari baris "Minggu N" di sini --
  // sebelumnya harus balik ke tab Riwayat Laporan buat cari minggu yang sama & edit, padahal
  // salah input sering ke-notice justru pas lihat rekap bulanan (mis. pengeluaran ke-double-input).
  const openEditMinggu = (st, w) => setEditReport?.({ ...w, studio: { nama: st.nama } })

  return (
    <>
      {Object.values(byCircle).map(({ circle, studios: cStudios }) => {
        const circleTotalUsd = cStudios.reduce((a, s) => a + s.totalUsd, 0)
        return (
          <div key={circle?.id ?? 'none'} className="card" style={{ marginBottom: 16, borderTop: `3px solid ${circle?.colorHex ?? 'var(--text-muted)'}` }}>
            <div className="card-header" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: circle?.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                <span className="card-title">{circle?.nama ?? 'Tanpa Circle'}</span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--accent-light)', fontSize: 15 }}>
                {formatUSD(circleTotalUsd)}
              </span>
            </div>

            {/* Desktop: tabel */}
            <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--bg-card)' }}>
                    <th style={{ width: 24 }} />
                    <th>Studio</th>
                    <th style={{ textAlign: 'center' }}>Laporan</th>
                    <th style={{ textAlign: 'right' }}>Total USD</th>
                    <th style={{ textAlign: 'right' }}>Est. IDR</th>
                    <th style={{ textAlign: 'right' }}>Kas rekening</th>
                    <th style={{ textAlign: 'right' }}>Pengeluaran</th>
                    <th style={{ textAlign: 'center' }}>Semangat</th>
                  </tr>
                </thead>
                <tbody>
                  {cStudios.map(st => (
                    <>
                      <tr key={st.id}
                        onClick={() => st.jumlahLaporan > 0 && toggleExpand(st.id)}
                        style={{ cursor: st.jumlahLaporan > 0 ? 'pointer' : 'default' }}>
                        <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                          {st.jumlahLaporan > 0 ? (expanded[st.id] ? '▼' : '▶') : ''}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {st.nama}
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>{st.tipe}</span>
                          {st.totalUsd > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                              {PLATFORMS.filter(p => st.platformTotals[p.key] > 0).map(p => (
                                <span key={p.key} style={{ fontSize: 10 }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{p.label} </span>
                                  <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{formatUSD(st.platformTotals[p.key])}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {st.sudahLapor
                            ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ {st.jumlahLaporan}x</span>
                            : <span style={{ color: 'var(--red)', fontWeight: 700 }}>✗ Belum</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: st.totalUsd > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                          {st.totalUsd > 0 ? formatUSD(st.totalUsd) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {st.totalUsd > 0 ? formatRp(st.totalUsd * st.avgKurs) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>
                          {st.kasAkhir != null ? formatRp(st.kasAkhir) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 12, color: st.totalPengeluaran > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                          {st.totalPengeluaran > 0 ? formatRp(st.totalPengeluaran) : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 13 }}>
                          {st.avgSemangat ? `${['😞','😐','🙂','😄','🔥'][Math.round(st.avgSemangat)-1]} ${st.avgSemangat}` : '—'}
                        </td>
                      </tr>

                      {/* Detail mingguan */}
                      {expanded[st.id] && st.mingguLaporan.map((w, i) => (
                        <tr key={i} style={{ background: 'var(--bg-surface)', fontSize: 12, color: 'var(--text-secondary)' }}>
                          <td />
                          <td style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 11 }}>
                            Minggu {i+1}: {formatTanggalPendek(w.periodeAwal)}
                            {canEditReport?.(w) && (
                              <span onClick={e => { e.stopPropagation(); openEditMinggu(st, w) }}
                                style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--accent-light)', cursor: 'pointer' }}>
                                Edit
                              </span>
                            )}
                          </td>
                          <td />
                          <td style={{ textAlign: 'right', color: 'var(--accent-light)' }}>{formatUSD(w.totalUsd)}</td>
                          <td />
                          <td style={{ textAlign: 'right' }}>{formatRp(w.kasSekarang)}</td>
                          <td style={{ textAlign: 'right', color: w.pengeluaran > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                            {w.pengeluaran > 0 ? formatRp(w.pengeluaran) : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {w.skorSemangat ? ['😞','😐','🙂','😄','🔥'][w.skorSemangat-1] : '—'}
                          </td>
                        </tr>
                      ))}

                      {/* Breakdown platform saat expanded */}
                      {expanded[st.id] && st.totalUsd > 0 && (
                        <tr style={{ background: 'var(--accent-subtle)', fontSize: 12 }}>
                          <td />
                          <td style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 11 }}>Platform</td>
                          <td colSpan={6} style={{ paddingLeft: 12 }}>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '6px 0' }}>
                              {PLATFORMS.filter(p => st.platformTotals[p.key] > 0).map(p => (
                                <span key={p.key} style={{ color: 'var(--accent-light)' }}>
                                  <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{p.label}</span>
                                  {formatUSD(st.platformTotals[p.key])}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Kendala (jika ada) */}
                      {expanded[st.id] && st.mingguLaporan.some(w => w.kendala) && (
                        <tr style={{ background: 'var(--bg-surface)' }}>
                          <td />
                          <td colSpan={7} style={{ paddingLeft: 24, paddingBottom: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Kendala / Catatan:</div>
                            {st.mingguLaporan.filter(w => w.kendala).map((w, i) => (
                              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Minggu {st.mingguLaporan.indexOf(w)+1}:</span>
                                {w.kendala}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: list ringkas, ketuk baris untuk rincian mingguan */}
            <div className="responsive-cards list-ringkas">
              {cStudios.map(st => (
                <ItemRingkas key={st.id} judul={st.nama}
                  sub={<>{st.tipe} · {st.sudahLapor
                    ? <span style={{ color: 'var(--green)' }}>✓ {st.jumlahLaporan}x lapor</span>
                    : <span style={{ color: 'var(--red)' }}>✗ Belum lapor</span>}</>}
                  nilai={<span style={{ color: st.totalUsd > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>{st.totalUsd > 0 ? formatUSD(st.totalUsd) : '—'}</span>}>
                <div className="data-card-row">
                  <span className="data-card-label">Est. IDR</span>
                  <span className="data-card-value">{st.totalUsd > 0 ? formatRp(st.totalUsd * st.avgKurs) : '—'}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Kas rekening</span>
                  <span className="data-card-value">{st.kasAkhir != null ? formatRp(st.kasAkhir) : '—'}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Pengeluaran</span>
                  <span className="data-card-value" style={{ color: st.totalPengeluaran > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {st.totalPengeluaran > 0 ? formatRp(st.totalPengeluaran) : '—'}
                  </span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Semangat</span>
                  <span className="data-card-value">
                    {st.avgSemangat ? `${['😞','😐','🙂','😄','🔥'][Math.round(st.avgSemangat)-1]} ${st.avgSemangat}` : '—'}
                  </span>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  {st.mingguLaporan.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          Minggu {i+1}: {formatTanggalPendek(w.periodeAwal)}
                        </span>
                        {canEditReport?.(w) && (
                          <span onClick={e => { e.stopPropagation(); openEditMinggu(st, w) }}
                            style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-light)', cursor: 'pointer' }}>
                            Edit
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-light)' }}>{formatUSD(w.totalUsd)}</span>
                        <span>Kas {formatRp(w.kasSekarang)}</span>
                        {w.pengeluaran > 0 && <span style={{ color: 'var(--red)' }}>-{formatRp(w.pengeluaran)}</span>}
                        {w.skorSemangat && <span>{['😞','😐','🙂','😄','🔥'][w.skorSemangat-1]}</span>}
                      </div>
                    </div>
                  ))}

                  {st.totalUsd > 0 && (
                    <div style={{ marginTop: 6, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Platform</div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {PLATFORMS.filter(p => st.platformTotals[p.key] > 0).map(p => (
                          <span key={p.key} style={{ color: 'var(--accent-light)', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{p.label}</span>
                            {formatUSD(st.platformTotals[p.key])}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {st.mingguLaporan.some(w => w.kendala) && (
                    <div style={{ marginTop: 6, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Kendala / Catatan:</div>
                      {st.mingguLaporan.filter(w => w.kendala).map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>Minggu {st.mingguLaporan.indexOf(w)+1}:</span>
                          {w.kendala}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </ItemRingkas>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}
