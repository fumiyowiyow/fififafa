import { useState, useMemo } from 'react'
import { formatUSD, formatRp, formatTanggalPendek } from '../../utils/format'
import { getReportingPeriod } from '../../utils/week'
import { PLATFORMS } from './constants'
import ItemRingkas from '../../components/common/ItemRingkas'

const SEMANGAT_EMOJI = ['😞','😐','🙂','😄','🔥']
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// Daftar section minggu SATU BULAN, dihitung INDEPENDEN dari data yang ada (bukan union
// periodeAwal yang KEBETULAN ada laporannya) -- biar minggu yang beneran nol laporan dari SEMUA
// studio tetap punya section sendiri (bukan hilang total), sama logic persis getReportingPeriod
// di server (lihat comment di utils/week.js). Minggu yang periodeAwal-nya masih di MASA DEPAN
// (belum mulai sama sekali) SENGAJA gak dimasukin -- "Belum Laporan" buat minggu yang emang belum
// lewat itu bukan informasi, cuma noise (jelas belum ada yang lapor, minggunya aja belum jalan).
function getWeekSectionsOfMonth(bulan, tahun) {
  const pad = n => String(n).padStart(2, '0')
  const todayStr = fmtDate(new Date())
  const daysInMonth = new Date(tahun, bulan, 0).getDate()
  const seen = new Set()
  const sections = []
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${tahun}-${pad(bulan)}-${pad(day)}`
    const { periodeAwal, periodeAkhir } = getReportingPeriod(dateStr)
    if (!seen.has(periodeAwal) && periodeAwal <= todayStr) {
      seen.add(periodeAwal)
      sections.push({ periodeAwal, periodeAkhir })
    }
  }
  return sections
}
function fmtDate(d) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── Tab Mingguan: Riwayat Laporan — per bulan, per minggu (section), SEMUA studio aktif ──
// (studio yang belum lapor minggu itu tetap muncul barisnya, ditandai "Belum Laporan" -- bukan
// dihilangkan -- keputusan eksplisit user, biar langsung kelihatan siapa yang belum lapor tanpa
// buka tab lain). Sumber data: /api/weekly-reports/monthly, endpoint SAMA yang dipakai tab Rekap
// Bulanan (udah include semua studio aktif + field lengkap buat EditModal).
export default function RiwayatLaporan({ data, loading, bulan, tahun, setBulan, setTahun, canEditReport, setEditReport }) {
  const [riwayatSearch, setRiwayatSearch] = useState('')

  const studios = (data?.studios ?? []).filter(s =>
    !riwayatSearch || s.nama.toLowerCase().includes(riwayatSearch.toLowerCase())
  )

  const sections = useMemo(() => getWeekSectionsOfMonth(bulan, tahun), [bulan, tahun])

  const weekGroups = useMemo(() => sections.map(sec => ({
    ...sec,
    rows: studios.map(s => ({
      studio: s,
      laporan: s.mingguLaporan?.find(m => String(m.periodeAwal).slice(0, 10) === sec.periodeAwal) ?? null,
    })),
  })), [sections, studios])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Riwayat Laporan</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Cari studio..." value={riwayatSearch}
            onChange={e => setRiwayatSearch(e.target.value)}
            style={{ padding: '6px 10px', width: 160, fontSize: 13 }} />
          <select className="form-input" style={{ padding: '6px 10px', width: 100, fontSize: 13 }}
            value={bulan} onChange={e => setBulan(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="form-input" style={{ padding: '6px 10px', width: 80, fontSize: 13 }}
            value={tahun} onChange={e => setTahun(Number(e.target.value))} />
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat...</div>
      ) : studios.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {riwayatSearch ? 'Studio tidak ditemukan' : 'Belum ada studio aktif'}
        </div>
      ) : (
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {weekGroups.map((sec, i) => (
            <div key={sec.periodeAwal} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--text-muted)', padding: '6px 4px', position: 'sticky', top: 0,
                background: 'var(--bg-card)', zIndex: 1 }}>
                Minggu {i + 1}: {formatTanggalPendek(sec.periodeAwal)} – {formatTanggalPendek(sec.periodeAkhir)}
              </div>

              {/* Desktop: tabel */}
              <div className="table-wrap responsive-table">
                <table>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)' }}>
                      <th>Studio</th>
                      <th>Omset per Platform</th>
                      <th style={{ textAlign: 'right' }}>Total USD</th>
                      <th style={{ textAlign: 'right' }}>Est. IDR</th>
                      <th style={{ textAlign: 'right' }}>Kas rekening</th>
                      <th style={{ textAlign: 'right' }}>Pengeluaran</th>
                      <th style={{ textAlign: 'center' }}>Semangat</th>
                      {/* Sticky kanan -- tombol Edit sebelumnya kepotong kalau kolom "Omset per
                          Platform" lebar (banyak platform), harus geser tabel dulu buat lihat.
                          Dipin di kanan biar selalu kelihatan berapa pun lebar kolom lain. */}
                      <th style={{ position: 'sticky', right: 0, background: 'var(--bg-card)', width: 70, zIndex: 2 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map(({ studio, laporan: r }) => (
                      <tr key={studio.id} style={!r ? { opacity: 0.55 } : undefined}>
                        <td style={{ fontWeight: 700 }}>{studio.nama}</td>
                        {r ? (
                          <>
                            <td>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {PLATFORMS.filter(p => Number(r[p.key]) > 0).map(p => (
                                  <span key={p.key} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{p.label} </span>
                                    <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{formatUSD(r[p.key])}</span>
                                  </span>
                                ))}
                                {!(r.totalUsd > 0) && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-light)', whiteSpace: 'nowrap' }}>
                              {formatUSD(r.totalUsd)}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRp(r.totalUsd * r.kurs)}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRp(r.kasSekarang)}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: r.pengeluaran > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                              {r.pengeluaran > 0 ? formatRp(r.pengeluaran) : '—'}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: 16 }}>
                              {r.skorSemangat ? SEMANGAT_EMOJI[r.skorSemangat - 1] : '—'}
                            </td>
                            <td style={{
                              textAlign: 'right', whiteSpace: 'nowrap',
                              position: 'sticky', right: 0, background: 'var(--bg-card)',
                              boxShadow: '-4px 0 6px -4px rgba(0,0,0,0.4)',
                            }}>
                              {canEditReport(r) && (
                                <button onClick={() => setEditReport({ ...r, studio: { nama: studio.nama } })}
                                  style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                                  Edit
                                </button>
                              )}
                            </td>
                          </>
                        ) : (
                          <td colSpan={7} style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                            ✗ Belum Laporan
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: list ringkas 2 baris per laporan (bukan kartu 6-baris) */}
              <div className="responsive-cards list-ringkas" style={{ margin: '0 4px' }}>
                {sec.rows.map(({ studio, laporan: r }) => (
                  <ItemRingkas key={studio.id} judul={studio.nama} redup={!r}
                    sub={r
                      ? <>Kas rekening {formatRp(r.kasSekarang)}{r.pengeluaran > 0 && <span style={{ color: 'var(--red)' }}> · -{formatRp(r.pengeluaran)}</span>}</>
                      : <i>✗ Belum Laporan</i>}
                    nilai={r && <span style={{ color: 'var(--accent-light)' }}>{r.skorSemangat && <span style={{ marginRight: 6 }}>{SEMANGAT_EMOJI[r.skorSemangat - 1]}</span>}{formatUSD(r.totalUsd)}</span>}>
                    {r && canEditReport(r) && (
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
                        onClick={() => setEditReport({ ...r, studio: { nama: studio.nama } })}>
                        Edit
                      </button>
                    )}
                  </ItemRingkas>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
