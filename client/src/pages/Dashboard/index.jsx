import { useState, useEffect, Fragment } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatUSD, formatRp, formatRpShort, formatTanggal, getBulanLabel } from '../../utils/format'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { onActivate } from '../../utils/a11y'
import { getRoleOrgUnit, hasMinRole } from '../../utils/roles'
import { dihitungDiEkosistem } from '../../components/common/BadgeKolaborasi'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function today() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const AVATAR_COLORS = ['var(--accent)','#0D9488','#EA580C','#1D4ED8','var(--pink)','var(--green)']
function avatarColor(nama) {
  let h = 0
  for (const c of (nama ?? '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// ── Tabel Omset & Kas per Studio ─────────────────────────
// ── Studio Kolaborasi (13 Okt 2026) ─────────────────────────────────────────
// Studio yang angkanya dihitung di circle mitra (mis. Souldear = Auralist): TIDAK masuk total
// ekosistem di dashboard ini maupun Monthly Report, tapi tetap dipantau di sini.
function KartuKolaborasi({ list, onNavigate }) {
  if (!list?.length) return null
  return (
    <div className="card" style={{ marginBottom: 24, borderLeft: '3px solid var(--cyan)' }}>
      <div className="card-header">
        <span className="card-title">🤝 Studio Kolaborasi</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>tidak termasuk total ekosistem di atas</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(k => (
          <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{k.nama}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {k.circle ?? '—'}{k.mitra ? ` · dihitung di ${k.mitra}` : ''}
              </div>
            </div>
            {k.omsetBulanIni != null && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Omset bulan ini <strong style={{ color: 'var(--text)' }}>{formatUSD(k.omsetBulanIni)}</strong>
              </div>
            )}
            {k.kas != null && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Kas <strong style={{ color: 'var(--text)' }}>{formatRp(k.kas)}</strong>
              </div>
            )}
            <span className={`badge ${k.sudahLapor ? 'success' : 'warning'}`}>{k.sudahLapor ? 'Sudah lapor' : 'Belum lapor'}</span>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onNavigate?.('WeeklyReport')}>Laporan →</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function OmsetKasTable({ onNavigate }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())

  const { data: monthlyData, loading } = useApi(
    `/api/weekly-reports/monthly?bulan=${bulan}&tahun=${tahun}`
  )

  // Korporasi tetap tampil (walau belum melapor) bila ada unit di bawahnya yang melapor.
  const indukMelapor = new Set((monthlyData?.studios ?? []).filter(s => s.indukId && s.jumlahLaporan > 0).map(s => s.indukId))
  const all = (monthlyData?.studios ?? [])
    .filter(s => s.jumlahLaporan > 0 || indukMelapor.has(s.id))
    // urutan juara dari server (angka bisa disamarkan); cadangan: omset bila server lama
    .sort((a, b) => (a.peringkat != null && b.peringkat != null) ? a.peringkat - b.peringkat : (b.totalUsd ?? 0) - (a.totalUsd ?? 0))

  // Unit di bawah Korporasi (indukId) tampil menjorok di bawah Korporasinya, bukan di kelompok tipenya.
  const studioList  = all.filter(s => s.tipe === 'STUDIO' && !s.indukId)
  const projectList = all.filter(s => s.tipe === 'PROJECT' && !s.indukId)
  const korporasiList = all.filter(s => s.tipe === 'KORPORASI' || s.indukId)
    .map(s => ({ ...s, kunciInduk: s.indukId ?? s.id }))
  // Urutkan kelompok Korporasi per induk (urutan induk = urutan peringkat pertama kemunculannya).
  const urutInduk = [...new Set(korporasiList.map(s => s.kunciInduk))]
  korporasiList.sort((a, b) => urutInduk.indexOf(a.kunciInduk) - urutInduk.indexOf(b.kunciInduk) || Number(!!a.indukId) - Number(!!b.indukId))
  const kelompokTabel = [
    { label: 'Korporasi', color: 'var(--amber)', list: korporasiList },
    { label: 'Studio', color: 'var(--cyan)', list: studioList },
    { label: 'Project', color: 'var(--accent-light)', list: projectList },
  ].filter(k => k.list.length > 0)

  const avgKurs = all.length
    ? all.reduce((s, r) => s + (r.avgKurs ?? 17000), 0) / all.length
    : 17000
  const totalUsd = all.reduce((s, r) => s + (r.totalUsd ?? 0), 0)
  const totalKas = all.reduce((s, r) => s + (r.kasAkhir ?? 0), 0)
  // Angka milik unit lain disamarkan server (null) -- tampil "—", bukan 0.
  const usdTeks = (v) => (v == null ? '—' : `$${v.toLocaleString('id-ID')}`)
  // Rupiah per unit dari server (tiap laporan x kursnya sendiri); cadangan bila server lama.
  const idrUnit = (r, k) => (r.totalUsd == null ? null : (r.totalIdr ?? r.totalUsd * (r.avgKurs ?? k)))

  const thStyle = { textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }
  const tdNum   = (extra) => ({ padding: '7px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', ...extra })

  const GroupHeader = ({ label, color }) => (
    <tr>
      <td colSpan={5} style={{
        padding: '8px 8px 4px',
        fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
        color, background: 'var(--bg-surface)', borderBottom: `2px solid ${color}`,
      }}>{label}</td>
    </tr>
  )

  const SubtotalRow = ({ list, kurs }) => {
    const usd = list.reduce((s, r) => s + (r.totalUsd ?? 0), 0)
    const kas = list.reduce((s, r) => s + (r.kasAkhir ?? 0), 0)
    return (
      <tr style={{ background: 'color-mix(in srgb, var(--text) 3%, transparent)', borderTop: '1px solid var(--border)' }}>
        <td style={{ padding: '6px 8px' }} />
        <td style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Subtotal</td>
        <td style={tdNum({ color: 'var(--green)', fontSize: 12 })}>${usd.toLocaleString('id-ID')}</td>
        <td style={tdNum({ color: 'var(--text-muted)', fontSize: 12 })}>{formatRp(Math.round(list.reduce((a, r) => a + (idrUnit(r, kurs) ?? 0), 0)))}</td>
        <td style={tdNum({ fontSize: 12 })}>{formatRp(kas)}</td>
      </tr>
    )
  }

  const DataRows = ({ list, startIdx, kurs }) => list.map((s, i) => (
    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle, color-mix(in srgb, var(--text) 4%, transparent))' }}>
      <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontSize: 11 }}>{startIdx + i + 1}</td>
      <td
        style={{ padding: '7px 8px', color: 'var(--text-secondary)', fontWeight: 500, cursor: onNavigate ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis' }}
        onClick={() => onNavigate?.('MasterData', { autoStudio: s.id })}
        onMouseEnter={e => onNavigate && (e.currentTarget.style.color = 'var(--accent-light)', e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)', e.currentTarget.style.textDecoration = 'none')}
      >{s.indukId ? <span style={{ paddingLeft: 12, color: 'var(--text-muted)' }}>↳ </span> : null}{s.nama}</td>
      <td style={tdNum({ color: 'var(--green)' })}>{usdTeks(s.totalUsd)}</td>
      <td style={tdNum({ color: 'var(--text-muted)' })}>{idrUnit(s, kurs) == null ? '—' : formatRp(Math.round(idrUnit(s, kurs)))}</td>
      <td style={tdNum({ color: (s.kasAkhir ?? 0) < 1_000_000 ? 'var(--red)' : 'var(--text)' })}>
        {s.kasAkhir != null ? formatRp(s.kasAkhir) : '—'}
      </td>
    </tr>
  ))

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span className="card-title">Omset & Kas Studio</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ padding: '4px 8px', fontSize: 13, width: 80 }}
            value={bulan} onChange={e => setBulan(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="form-input"
            style={{ padding: '4px 6px', fontSize: 13, width: 68 }}
            value={tahun} onChange={e => setTahun(Number(e.target.value))} />
          <span role="button" tabIndex={0} style={{ fontSize: 12, color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => onNavigate?.('WeeklyReport')}
            onKeyDown={onActivate(() => onNavigate?.('WeeklyReport'))}>
            Detail →
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Memuat…</div>
      ) : all.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada laporan bulan ini
        </div>
      ) : (
        <div className="table-wrap">
          {/* tableLayout:'fixed' WAJIB di sini -- tanpa ini browser pakai automatic table layout,
              yang cuma menganggap `width` di <th> sebagai HINT (bisa diabaikan/digeser sesuai
              konten), padahal posisi sticky kolom ke-2 (.table-sticky-2 di index.css) di-hardcode
              `left: 44px` pas asumsi kolom pertama beneran 44px. Kalau layout-nya auto, lebar
              kolom pertama bisa mleset dari 44px sungguhan, bikin header/isi kolom sesudahnya
              "nembus"/tumpang tindih pas tabel digeser horizontal di mobile (dilaporkan user,
              kelihatan pas discroll: teks "Omset (USD)" bocor di belakang kolom Nama). Semua
              kolom dikasih width eksplisit juga -- table-layout:fixed butuh itu buat render benar. */}
          <table className="table-sticky-2" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 44 }}>#</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>Nama</th>
                <th style={{ ...thStyle, width: 90 }}>Omset (USD)</th>
                <th style={{ ...thStyle, width: 110 }}>Omset (IDR)</th>
                <th style={{ ...thStyle, width: 120 }}>Kas (IDR)</th>
              </tr>
            </thead>
            <tbody>
              {kelompokTabel.map((k, i) => (
                <Fragment key={k.label}>
                  <GroupHeader label={k.label} color={k.color} />
                  <DataRows list={k.list} startIdx={kelompokTabel.slice(0, i).reduce((a, x) => a + x.list.length, 0)} kurs={avgKurs} />
                  {kelompokTabel.length > 1 && <SubtotalRow list={k.list} kurs={avgKurs} />}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-surface)' }}>
                <td style={{ padding: '8px 8px' }} />
                <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>TOTAL</td>
                <td style={tdNum({ color: 'var(--green)', fontWeight: 800 })}>${totalUsd.toLocaleString('id-ID')}</td>
                <td style={tdNum({ color: 'var(--text-muted)', fontWeight: 700 })}>{formatRp(Math.round(all.reduce((a, r) => a + (idrUnit(r, avgKurs) ?? 0), 0)))}</td>
                <td style={tdNum({ fontWeight: 800 })}>{formatRp(totalKas)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Financial Summary Section ─────────────────────────────
function FinancialSummary({ onNavigate }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const { user } = useAuth()

  const { data, loading } = useApi(`/api/monthly-data/summary?bulan=${bulan}&tahun=${tahun}`)

  // Dana Pengembangan sengaja di luar pembukuan resmi ekosistem — card total-nya cuma
  // ditambahkan untuk role PENGELOLA_DANA sendiri, tidak pernah untuk role lain (termasuk
  // ADVISOR/KEPALA_EKOSISTEM), supaya isolasinya tetap terjaga.
  const isPengelolaDana = user?.roles?.some(r => r.roleType === 'PENGELOLA_DANA') ?? false
  const { data: dpPool }  = useApi(isPengelolaDana ? '/api/dana-pengembangan/pool' : null)
  const { data: dpUnits } = useApi(isPengelolaDana ? '/api/dana-pengembangan/units' : null)
  const dpEquityUsd = (dpUnits ?? []).reduce((a, u) => a + (u.laporanTerakhir?.equityUsd ?? u.modalAwalUsd), 0)
  const dpKurs = dpPool?.kurs ?? 17000
  const dpEquityRp = dpEquityUsd * dpKurs

  const stats = data ? [
    { label: 'Kas Usaha',            value: formatRp(data.totalKas),           bg: '#EA580C', sub: 'kas seluruh studio', ke: ['Finance', { tab: 'forecasting' }] },
    { label: 'Dana di Luar Kas',      value: formatRp(data.totalEkuitas),        bg: 'var(--accent)', sub: 'dana di luar kas per studio', ke: ['Finance', { tab: 'bulanan' }] },
    { label: 'Total Dana Usaha',     value: formatRp(data.totalEkuitasUsaha),   bg: 'var(--green)', sub: 'kas + dana di luar kas', ke: ['Finance', { tab: 'forecasting' }] },
    { label: 'Total CPM',            value: formatRp(data.totalCpm),            bg: 'var(--pink)', sub: 'CPM seluruh studio', ke: ['Finance', { tab: 'forecasting' }] },
    { label: 'Dana PE',          value: formatRp(data.danaPE),         bg: '#0D9488', sub: 'dana Private Equity', ke: ['Finance', { tab: 'dana' }] },
    { label: 'Total Dana + PE', value: formatRp(data.totalEkuitasPE), bg: '#1D4ED8', sub: 'dana usaha + dana PE', ke: ['Finance', { tab: 'dana' }] },
    ...(isPengelolaDana && dpUnits ? [
      { label: 'Total Ekosistem + Dana Pengembangan', value: formatRp(data.totalEkuitasPE + dpEquityRp), bg: '#4C1D95', sub: `Termasuk Dana Pengembangan senilai ≈ ${formatRp(dpEquityRp)}. Informasi ini hanya ditampilkan kepada Pengelola Dana.`, ke: ['DanaPengembangan'] },
    ] : []),
  ] : []

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <span className="card-title">Ringkasan Finansial Ekosistem</span>
        {/* Month selector */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ padding: '4px 8px', fontSize: 13, width: 80 }}
            value={bulan}
            onChange={e => setBulan(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input
            type="number"
            className="form-input"
            style={{ padding: '4px 6px', fontSize: 13, width: 68 }}
            value={tahun}
            onChange={e => setTahun(Number(e.target.value))}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {getBulanLabel(bulan, tahun)}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ height: 80, borderRadius: 10, background: 'var(--bg-surface)', opacity: 0.4 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 10 }}>
          {stats.map(s => (
            // Gaya clean (13 Okt 2026): kotak netral + garis warna di kiri sebagai penanda jenis
            // dana -- dulu kotak berwarna penuh bertulisan putih (ramai, toska/putih susah dibaca).
            <div key={s.label}
              role={s.ke && onNavigate ? 'button' : undefined}
              tabIndex={s.ke && onNavigate ? 0 : undefined}
              title={s.ke && onNavigate ? 'Klik untuk melihat rinciannya' : undefined}
              onClick={s.ke && onNavigate ? () => onNavigate(...s.ke) : undefined}
              onKeyDown={s.ke && onNavigate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(...s.ke) } } : undefined}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 10,
                padding: '12px 14px',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${s.bg}`,
                minWidth: 0,
                cursor: s.ke && onNavigate ? 'pointer' : 'default',
              }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4, textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Circle Drill-Down Modal ───────────────────────────────
function CircleDrillModal({ circle, filterKey = 'circleId', onClose, onNavigate }) {
  const [studios, setStudios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/masterdata/studios')
      .then(r => setStudios((r.data.data ?? []).filter(s => s[filterKey] === circle.id && s.statusAktif)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [circle.id, filterKey])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: circle.colorHex, flexShrink: 0 }} />
            <span className="modal-title">{circle.nama}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Klik studio untuk melihat bio & anggota
        </p>

        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat…</div>
        ) : studios.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Belum ada studio aktif</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
            {studios.map(s => (
              <div key={s.id}
                role="button" tabIndex={0}
                onClick={() => { onClose(); onNavigate?.('MasterData', { autoStudio: s.id }) }}
                onKeyDown={onActivate(() => { onClose(); onNavigate?.('MasterData', { autoStudio: s.id }) })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = circle.colorHex}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: circle.colorHex,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: '#fff',
                }}>
                  {initials(s.nama)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.nama}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {s.tipe} · {s._count?.userRoles ?? 0} anggota
                  </div>
                  {s.niche && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.niche}
                    </div>
                  )}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>›</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  )
}

// Ringkasan kesehatan finansial studio (tren omset + cakupan biaya operasional) -- beda dari
// widget kepatuhan lapor, ini berbasis performa omset ASLI. Detail lengkap + per-studio ada di
// halaman Performa (`/api/performance/studios`, gated checkMinRole('KADER') server-side).
// Self-contained (useAuth+useApi sendiri, pola sama FinancialSummary di file ini) supaya aman
// dipasang di 2 tempat (Dashboard penuh & SimpleDashboard) tanpa prop-drilling.
function FinancialHealthWidget({ onNavigate }) {
  const { user } = useAuth()
  const canView = hasMinRole(user, 'KADER')
  const now = new Date()
  const { data, loading } = useApi(
    canView ? `/api/performance/studios?bulan=${now.getMonth() + 1}&tahun=${now.getFullYear()}` : null
  )
  if (!canView) return null

  const fh = data?.financialHealth
  const sehatPct = fh?.total ? Math.round((fh.sehat / fh.total) * 100) : 0

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">Kesehatan Finansial Studio</span>
        <span role="button" tabIndex={0} style={{ fontSize: 12, color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => onNavigate?.('Performance')}
          onKeyDown={onActivate(() => onNavigate?.('Performance'))}>
          Detail →
        </span>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>Memuat...</div>
      ) : !fh || fh.total === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>Belum ada laporan bulan ini</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            <svg width={56} height={56} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={28} cy={28} r={20} fill="none" stroke="color-mix(in srgb, var(--text) 7%, transparent)" strokeWidth="5" />
              <circle cx={28} cy={28} r={20} fill="none" stroke="var(--green)" strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 20 * (sehatPct / 100)} ${2 * Math.PI * 20}`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>
              {sehatPct}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{fh.sehat}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>✅ Sehat</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber)' }}>{fh.perluPerhatian}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>⚠️ Perhatian</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>{fh.kritis}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔴 Kritis</div></div>
          </div>
        </div>
      )}
    </div>
  )
}

const CAN_FULL_DASHBOARD = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','PENDAMPING','KOORDINATOR']

// ── Dashboard sederhana untuk KARYAWAN / KADER / MAGANG ──────
function SimpleDashboard({ onNavigate }) {
  const { user }               = useAuth()
  const { data: announcements, error: announcementError } = useApi('/api/announcements?limit=5')

  const myRole  = user?.roles?.[0]
  const studio  = myRole?.studio
  // getRoleOrgUnit, bukan myRole?.circle langsung -- role studio-scoped (mayoritas KARYAWAN/
  // KADER/MAGANG yang lihat dashboard ini) gak punya circleId di UserRole-nya sendiri, circle-nya
  // cuma bisa didapat lewat studio.circle (lihat auth.js). Baca r.circle langsung selalu undefined.
  const circle  = getRoleOrgUnit(myRole)
  const color   = circle?.colorHex ?? 'var(--accent)'

  return (
    <>
      {/* Greeting */}
      <div className="greeting-banner">
        <div className="greeting-text">
          <h2>{greeting()}, {user?.nama?.split(' ')[0]}! 👋</h2>
          <p>{today()}</p>
        </div>
        <div className="greeting-visual">✨</div>
      </div>

      {/* Info studio */}
      {studio && (
        <div className="card" style={{ marginBottom: 20, borderTop: `3px solid ${color}` }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {initials(studio.nama)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{studio.nama}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {circle?.nama} · {myRole?.roleType?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shortcut cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { icon: '📢', label: 'Pengumuman', sub: 'Info terbaru ekosistem', page: 'Announcement', color: '#0D9488' },
          { icon: '👤', label: 'Profil Saya', sub: 'Data & rekam jejak', page: 'Profile', color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} className="stat-card"
            onClick={() => onNavigate?.(s.page)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <FinancialHealthWidget onNavigate={onNavigate} />

      {/* Pengumuman terbaru */}
      {announcementError && (
        <div className="card" style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          Gagal memuat pengumuman.
        </div>
      )}
      {!announcementError && announcements?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pengumuman Terbaru</span>
            <span className="card-action" onClick={() => onNavigate?.('Announcement')} style={{ cursor: 'pointer' }}>Lihat semua →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {announcements.map((a, i) => (
              <button key={a.id} onClick={() => onNavigate?.('Announcement')}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                  padding: '12px 0', cursor: 'pointer', background: 'none', border: 'none',
                  borderBottom: i < announcements.length - 1 ? '1px solid var(--border)' : 'none',
                  minHeight: 44,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = ''}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: avatarColor(a.namaPembuat),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {initials(a.namaPembuat)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{a.judul}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {a.namaPembuat} · {formatTanggal(a.createdAt)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {a.konten}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Dashboard({ onNavigate }) {
  const { user }                = useAuth()
  const { data, loading, error } = useApi('/api/dashboard/overview')
  const { data: weekStatus }     = useApi('/api/weekly-reports/status/week')
  const { data: announcements, error: announcementError } = useApi('/api/announcements?limit=3')
  const weekHitung = weekStatus?.filter(dihitungDiEkosistem)
  const [drillCircle, setDrillCircle] = useState(null)
  const [drillRumahUsaha, setDrillRumahUsaha] = useState(null)

  const canFullDashboard = user?.roles?.some(r => CAN_FULL_DASHBOARD.includes(r.roleType))

  if (!canFullDashboard) return <SimpleDashboard onNavigate={onNavigate} />

  // Peran di bawah Kepala Ekosistem hanya menerima angka dana dari unit dalam wilayahnya (server menyaring).
  const terbatas = data?.lingkup?.semua === false
  const stats = data ? [
    { label: 'Total Anggota',   value: data.totalUsers,   trend: `${data.tier.tetap + data.tier.karyawan} inti · ${data.tier.magang} magang`,    color: 'purple', page: 'Members'     },
    { label: 'Unit Usaha',      value: data.totalStudios, trend: `${data.totalCircles} circle`,  color: 'cyan',   page: 'MasterData' },
    { label: 'Omset Minggu Ini',value: formatUSD(data.omset?.mingguIni ?? 0), trend: `${data.weeklyReportsThisWeek} laporan`, color: 'green', page: 'WeeklyReport' },
    { label: 'Omset Bulan Ini', value: formatUSD(data.omset?.bulanIni ?? 0),  trend: terbatas ? `${data.lingkup.jumlahUnit} unit wilayahmu` : 'seluruh ekosistem', color: 'amber', page: 'WeeklyReport' },
  ] : []

  return (
    <>
      {/* Greeting */}
      <div className="greeting-banner">
        <div className="greeting-text">
          <h2>{greeting()}, {user?.nama?.split(' ')[0]}! 👋</h2>
          <p>{today()} — Berikut ringkasan ekosistem {ECOSYSTEM_NAME} hari ini.</p>
        </div>
        <div className="greeting-visual">🚀</div>
      </div>

      {/* Stat Cards */}
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
      {terbatas && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.5 }}>
          🔒 Semua unit tetap terlihat, tapi angka uangnya (omset, kas, dana) hanya terbuka untuk <strong>{data.lingkup.jumlahUnit} unit dalam wilayah perananmu</strong>; selebihnya tampil "—". Total seluruh ekosistem hanya untuk Advisor dan Kepala Ekosistem.
        </div>
      )}

      <div className="stat-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card" style={{ opacity: 0.3, height: 120 }} />
            ))
          : stats.map(s => (
              <div key={s.label} className={`stat-card ${s.color}`}
                onClick={() => onNavigate?.(s.page)}
                style={{ cursor: 'pointer' }}>
                <div className={`stat-icon ${s.color}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-trend trend-up" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.trend}</div>
              </div>
            ))
        }
      </div>

      <KartuKolaborasi list={data?.kolaborasi} onNavigate={onNavigate} />

      {/* Financial Summary */}
      <FinancialSummary onNavigate={onNavigate} />

      <FinancialHealthWidget onNavigate={onNavigate} />

      {/* Tabel Omset & Kas per Studio */}
      <OmsetKasTable onNavigate={onNavigate} />

      {/* Peringkat performa gabungan per circle (omset bulan ini) */}
      {[{ judul: 'Circle', list: data?.circles }, { judul: 'Rumah Usaha', list: data?.rumahUsaha }].map(({ judul, list }) => !loading && list?.some(c => c.performa) && (() => {
        const ranked = list.filter(c => c.performa)
          .sort((a, b) => (a.performa.peringkat ?? 0) - (b.performa.peringkat ?? 0))
        const maxOmset = Math.max(...ranked.map(c => c.performa.omsetBulanIni ?? 0), 1)
        return (
          <div key={judul} className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">🏆 Performa {judul} — {getBulanLabel(new Date().getMonth() + 1, new Date().getFullYear())}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>diurutkan dari omset tertinggi</span>
            </div>
            {ranked.map((c, i) => {
              const p = c.performa
              return (
                <div key={c.id} className="progress-wrap">
                  <div className="progress-head">
                    <div className="progress-label">{i + 1}. {c.nama}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatUSD(p.omsetPerStudio)}/studio · lapor {p.sudahLapor}/{p.studioAktif}
                      </span>
                      {p.growthPct !== null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: p.growthPct >= 0 ? 'var(--color-success, #16A34A)' : 'var(--color-danger, #DC2626)' }}>
                          {p.growthPct >= 0 ? '▲' : '▼'} {Math.abs(p.growthPct)}%
                        </span>
                      )}
                      <span className="progress-val">{formatUSD(p.omsetBulanIni)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 4px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>Omset {formatRp(p.omsetRp)}</span>
                    <span>Kas {formatRp(p.kas)}</span>
                    <span>Di luar kas {formatRp(p.danaDiLuarKas)}</span>
                    <strong style={{ color: 'var(--text)' }}>Total Dana Usaha {formatRp(p.totalDanaUsaha)}</strong>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${(p.omsetBulanIni / maxOmset) * 100}%`, height: '100%', background: c.colorHex }} />
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              ▲▼ = perubahan omset dibanding bulan lalu. "Lapor" = studio aktif yang sudah lapor minggu ini. Total Dana Usaha = Kas (Rekening Bank) + Dana di Luar Kas.
            </div>
          </div>
        )
      })())}

      {/* Circle Cards */}
      {!loading && data?.circles && (
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {data.circles.map(c => (
            <div key={c.id} className="card" onClick={() => setDrillCircle(c)}
              role="button" tabIndex={0} onKeyDown={onActivate(() => setDrillCircle(c))}
              style={{ borderTop: `3px solid ${c.colorHex}`, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.colorHex, flexShrink: 0 }} />
                  <span className="card-title">{c.nama}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px 24px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: c.colorHex }}>{c.totalStudio}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unit Usaha</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{c.totalAnggota}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Roles</div>
                </div>
                {c.performa && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', lineHeight: '34px' }}>{formatUSD(c.performa.omsetBulanIni)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Omset Bulan Ini</div>
                  </div>
                )}
                {c.performa && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', lineHeight: '34px' }}>{formatRp(c.performa.totalDanaUsaha)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Dana Usaha</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rumah Usaha Cards */}
      {!loading && data?.rumahUsaha?.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {data.rumahUsaha.map(ru => (
            <div key={ru.id} className="card" onClick={() => setDrillRumahUsaha(ru)}
              role="button" tabIndex={0} onKeyDown={onActivate(() => setDrillRumahUsaha(ru))}
              style={{ borderTop: `3px solid ${ru.colorHex}`, cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: ru.colorHex, flexShrink: 0 }} />
                  <span className="card-title">🏠 {ru.nama}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px 24px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: ru.colorHex }}>{ru.totalStudio}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unit Usaha</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{ru.totalAnggota}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Roles</div>
                </div>
                {ru.performa && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', lineHeight: '34px' }}>{formatUSD(ru.performa.omsetBulanIni)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Omset Bulan Ini</div>
                  </div>
                )}
                {ru.performa && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', lineHeight: '34px' }}>{formatRp(ru.performa.totalDanaUsaha)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Dana Usaha</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tier breakdown + Status laporan minggu ini */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {!loading && data && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Distribusi Tier Anggota</span>
              <span className="card-action" onClick={() => onNavigate?.('Members')} style={{ cursor: 'pointer' }}>Total {data.totalUsers} anggota →</span>
            </div>
            {[
              { label: '🟣 Koordinator',     val: data.tier.tetap,    color: 'var(--accent)' },
              { label: '🟠 Staf',          val: data.tier.karyawan, color: '#EA580C' },
              { label: '🟢 Magang',        val: data.tier.magang,   color: '#84CC16' },
            ].map(t => {
              const pct = data.totalUsers ? Math.round((t.val / data.totalUsers) * 100) : 0
              return (
                <div key={t.label} className="progress-wrap">
                  <div className="progress-head">
                    <div className="progress-label">{t.label}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.val} anggota</span>
                      <span className="progress-val">{pct}%</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: t.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Status laporan minggu ini */}
        {weekHitung && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Laporan Minggu Ini</span>
              <span className="card-action" style={{ color: 'var(--accent-light)', fontWeight: 700 }}>
                {weekHitung.filter(s => s.sudahLapor).length}/{weekHitung.length} studio
              </span>
            </div>

            {/* Progress bar keseluruhan */}
            <div style={{ marginBottom: 16 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${Math.round(weekHitung.filter(s => s.sudahLapor).length / weekHitung.length * 100)}%`,
                  background: 'var(--green)',
                }} />
              </div>
            </div>

            {/* List studio — max 8 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekHitung.slice(0, 8).map(s => (
                <div key={s.id} onClick={() => onNavigate?.('WeeklyReport')}
                  role="button" tabIndex={0} onKeyDown={onActivate(() => onNavigate?.('WeeklyReport'))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', borderRadius: 6, padding: '2px 4px', margin: '0 -4px', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 4%, transparent)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: s.sudahLapor ? 'var(--green)' : 'var(--red)',
                  }} />
                  <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{s.nama}</span>
                  {s.sudahLapor
                    ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span>
                    : <span style={{ color: 'var(--red)', fontWeight: 600 }}>–</span>
                  }
                </div>
              ))}
              {weekHitung.length > 8 && (
                <div onClick={() => onNavigate?.('WeeklyReport')}
                  role="button" tabIndex={0} onKeyDown={onActivate(() => onNavigate?.('WeeklyReport'))}
                  style={{ fontSize: 11, color: 'var(--accent-light)', paddingTop: 4, cursor: 'pointer' }}>
                  +{weekHitung.length - 8} studio lainnya →
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pengumuman terbaru */}
      {announcementError && (
        <div className="card" style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
          Gagal memuat pengumuman.
        </div>
      )}
      {!announcementError && announcements?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Pengumuman Terbaru</span>
            <span className="card-action" onClick={() => onNavigate?.('Announcement')} style={{ cursor: 'pointer' }}>Lihat semua →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {announcements.map((a, i) => (
              <button key={a.id} onClick={() => onNavigate?.('Announcement')}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                  padding: '12px 0', cursor: 'pointer', background: 'none', border: 'none',
                  borderBottom: i < announcements.length - 1 ? '1px solid var(--border)' : 'none',
                  minHeight: 44,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = ''}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: avatarColor(a.namaPembuat),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {initials(a.namaPembuat)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{a.judul}</span>
                    <span className={`badge ${a.targetTipe === 'ALL' ? 'success' : 'info'}`} style={{ flexShrink: 0 }}>
                      {a.targetTipe === 'ALL' ? 'Semua' : a.targetTipe}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {a.namaPembuat} · {formatTanggal(a.createdAt)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {a.konten}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {drillCircle && (
        <CircleDrillModal
          circle={drillCircle}
          onClose={() => setDrillCircle(null)}
          onNavigate={onNavigate}
        />
      )}
      {drillRumahUsaha && (
        <CircleDrillModal
          circle={drillRumahUsaha}
          filterKey="rumahUsahaId"
          onClose={() => setDrillRumahUsaha(null)}
          onNavigate={onNavigate}
        />
      )}
    </>
  )
}
