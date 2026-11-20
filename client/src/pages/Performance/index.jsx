import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatUSD, formatRp, getBulanLabel } from '../../utils/format'
import { alfa } from '../../utils/warna'
import BadgeKolaborasi from '../../components/common/BadgeKolaborasi'
import ItemRingkas from '../../components/common/ItemRingkas'

const NOW    = new Date()
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const MEDAL = ['🥇','🥈','🥉']

const MARKETS = [
  { key: 'omsetFiverr',    label: 'Fiverr',     color: '#1dbf73' },
  { key: 'omsetEtsy',      label: 'Etsy',        color: '#f1641e' },
  { key: 'omsetUpwork',    label: 'Upwork',      color: '#6fda44' },
  { key: 'omsetVgen',      label: 'Vgen',        color: 'var(--accent-light)' },
  { key: 'omsetKomunitas', label: 'Komunitas',   color: 'var(--accent-light)' },
  { key: 'omsetLainnya',   label: 'Lainnya',     color: 'var(--text-secondary)' },
]

// Kesehatan finansial BERBASIS OMSET ASLI (tren + cakupan biaya operasional) -- beda dari skor
// kepatuhan lapor di halaman "Kepatuhan Laporan" (dulu namanya "Kesehatan Ekosistem", direname
// karena cuma ngukur ada/nggaknya laporan, bukan performa finansial beneran).
const FIN_STATUS_CONFIG = {
  SEHAT:             { label: 'Sehat',           color: 'var(--green)', bg: 'var(--green-subtle)', icon: '✅' },
  PERLU_PERHATIAN:   { label: 'Perlu Perhatian', color: 'var(--amber)', bg: 'var(--amber-subtle)', icon: '⚠️' },
  KRITIS:            { label: 'Kritis',          color: 'var(--red)', bg: 'var(--red-subtle)',   icon: '🔴' },
}
const COVERAGE_CONFIG = {
  nutup_biaya:        { label: 'Nutup Biaya',        icon: '🟢', color: 'var(--green)' },
  belum_nutup_penuh:  { label: 'Belum Nutup Penuh',  icon: '🟡', color: 'var(--amber)' },
  jauh_dari_nutup:     { label: 'Jauh dari Nutup',    icon: '🔴', color: 'var(--red)' },
  belum_ada_target:   { label: 'Belum Ada Target',   icon: '⚪', color: 'var(--text-muted)' },
}
const TREND_CONFIG = {
  naik:        { label: 'Naik',   icon: '📈', color: 'var(--green)' },
  turun:       { label: 'Turun',  icon: '📉', color: 'var(--red)' },
  stabil:      { label: 'Stabil', icon: '➖', color: 'var(--text-muted)' },
  data_kurang: { label: 'Data Kurang', icon: '·', color: 'var(--text-muted)' },
}

// SVG donut/gauge -- copy dari Health/index.jsx (halaman itu gak nge-export komponennya, dan
// belum ada file component bersama buat visual sekecil ini -- duplikat ~20 baris lebih murah
// daripada bikin abstraksi baru buat 2 pemakai).
function ScoreRing({ score, color, size = 80 }) {
  const r    = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const fill = circ * (Math.max(0, Math.min(100, score)) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="color-mix(in srgb, var(--text) 7%, transparent)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color }}>{score}</span>
      </div>
    </div>
  )
}

// Versi kecil dari pola bar-chart "Tren Omset Ekosistem" di bawah -- tanpa label tanggal, warna
// bar ngikutin arah tren studio itu sendiri (bukan aksen flat), biar sekilas pandang kebaca.
function MiniSparkline({ minggu, trend }) {
  if (!minggu?.length) return <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>belum ada laporan</div>
  const max = Math.max(...minggu.map(m => Math.max(0, m.totalUsd)), 1)
  const barColor = TREND_CONFIG[trend]?.color ?? 'var(--accent)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
      {minggu.map((m, i) => {
        const pct = (Math.max(0, m.totalUsd) / max) * 100
        const isLast = i === minggu.length - 1
        return (
          <div key={m.periodeAwal} title={`${new Date(m.periodeAwal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}: ${formatUSD(m.totalUsd)}`}
            style={{
              width: 6, borderRadius: '2px 2px 0 0', minHeight: 3,
              height: `${pct}%`, background: barColor,
              opacity: isLast ? 1 : 0.35 + (i / minggu.length) * 0.4,
            }} />
        )
      })}
    </div>
  )
}

export default function Performance() {
  const [bulan, setBulan] = useState(NOW.getMonth() + 1)
  const [tahun, setTahun] = useState(NOW.getFullYear())
  const [activeMarket, setActiveMarket] = useState('omsetFiverr')
  const [finFilter, setFinFilter] = useState(null) // null | 'SEHAT' | 'PERLU_PERHATIAN' | 'KRITIS'

  const { data, loading, error } = useApi(
    `/api/performance/studios?bulan=${bulan}&tahun=${tahun}`,
    [bulan, tahun]
  )
  // Kurs rata-rata bulan ini — pakai sumber yang sama dengan Rekap Bulanan di Laporan Omset,
  // supaya "Est. IDR" di sini tidak beda angka cuma karena beda halaman (bukan hardcode 17000).
  const { data: monthly } = useApi(`/api/weekly-reports/monthly?bulan=${bulan}&tahun=${tahun}`, [bulan, tahun])
  const kurs = monthly?.summary?.grandTotalUsd > 0
    ? monthly.summary.grandTotalIdr / monthly.summary.grandTotalUsd
    : 17000

  const [rentang, setRentang] = useState(3)
  const { data: monthlyTrend, loading: loadingMonthly } = useApi(
    `/api/performance/monthly?bulan=${bulan}&tahun=${tahun}&jumlah=${rentang}`,
    [bulan, tahun, rentang]
  )
  const bulanan    = monthlyTrend?.months ?? []
  const maxBulanan = Math.max(...bulanan.map(m => m.totalUsd), 1)

  const ranking  = data?.ranking  ?? []
  const trend    = data?.trendData ?? []
  const maxOmset = Math.max(...ranking.map(r => r.totalUsd), 1)
  const maxTrend = Math.max(...trend.map(t => t.totalUsd), 1)

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Performa</h1>
            <p>Ranking omset studio & tren ekosistem</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-input" style={{ paddingLeft: 10, width: 110 }}
              value={bulan} onChange={e => setBulan(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <select className="form-input" style={{ paddingLeft: 10, width: 90 }}
              value={tahun} onChange={e => setTahun(Number(e.target.value))}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Ranking */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ranking Studio — {getBulanLabel(bulan, tahun)}</span>
            <span className="card-action">{ranking.length} studio</span>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>Memuat...</div>
          ) : ranking.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              Belum ada laporan bulan ini
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ranking.map((s, i) => {
                const pct = (s.totalUsd / maxOmset) * 100
                return (
                  <div key={s.studio.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 24, textAlign: 'center', fontSize: 16 }}>
                      {i < 3 ? MEDAL[i] : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>#{i+1}</span>}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.studio.nama}</span> <BadgeKolaborasi studio={s.studio} style={{ marginLeft: 6 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                            {(s.studio.circle ?? s.studio.rumahUsaha)?.nama}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)' }}>
                          {formatUSD(s.totalUsd)}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'color-mix(in srgb, var(--text) 6%, transparent)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${pct}%`,
                          background: i === 0 ? 'var(--amber)' : i === 1 ? 'var(--text-secondary)' : i === 2 ? '#cd7f32' : 'var(--accent)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>{s.jumlahLaporan}x laporan</span>
                        {s.avgSemangat && <span>semangat {s.avgSemangat}/5</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Trend Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tren Omset Ekosistem (8 Minggu)</span>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>Memuat...</div>
          ) : trend.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
              Belum ada data tren
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingBottom: 4 }}>
                {trend.map((t, i) => {
                  const pct = (t.totalUsd / maxTrend) * 100
                  const isLast = i === trend.length - 1
                  return (
                    <div key={t.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{
                          width: '100%', borderRadius: '4px 4px 0 0', minHeight: 4,
                          height: `${pct}%`,
                          background: isLast ? 'linear-gradient(180deg, var(--accent-light), var(--accent))' : 'var(--accent)',
                          opacity: isLast ? 1 : 0.4 + (i / trend.length) * 0.5,
                          boxShadow: isLast ? '0 0 12px var(--accent-glow)' : 'none',
                          transition: 'height 0.4s ease',
                        }} title={`${t.week}: ${formatUSD(t.totalUsd)}`} />
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
                        {new Date(t.week).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>Total 8 minggu: <strong style={{ color: 'var(--accent-light)' }}>{formatUSD(trend.reduce((a, t) => a + t.totalUsd, 0))}</strong></span>
                <span>Est. IDR: <strong style={{ color: 'var(--green)' }}>{formatRp(trend.reduce((a, t) => a + t.totalUsd, 0) * kurs)}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Performa Bulanan -- omset ekosistem per bulan, berakhir di bulan terpilih */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">Performa Bulanan Ekosistem</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[3, 6, 12].map(n => (
              <button key={n} className={rentang === n ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={() => setRentang(n)} style={{ padding: '4px 10px', fontSize: 12 }}>{n} bulan</button>
            ))}
          </div>
        </div>
        {loadingMonthly && bulanan.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>Memuat...</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200 }}>
              {bulanan.map((m, i) => {
                const pct = (m.totalUsd / maxBulanan) * 100
                const isLast = i === bulanan.length - 1
                const up = m.perubahanPct != null && m.perubahanPct >= 0
                return (
                  <div key={`${m.tahun}-${m.bulan}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatUSD(m.totalUsd)}</div>
                    {m.perubahanPct != null && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>
                        {up ? '▲' : '▼'} {Math.abs(m.perubahanPct).toFixed(1)}%
                      </div>
                    )}
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0', minHeight: 4, height: `${pct}%`,
                        background: isLast ? 'linear-gradient(180deg, var(--accent-light), var(--accent))' : 'var(--accent)',
                        opacity: isLast ? 1 : 0.4 + (i / bulanan.length) * 0.5,
                        transition: 'height 0.4s ease',
                      }} title={`${getBulanLabel(m.bulan, m.tahun)}: ${formatUSD(m.totalUsd)} · ${m.jumlahLaporan} laporan · ${m.studioAktif} studio`} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {getBulanLabel(m.bulan, m.tahun)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Total {rentang} bulan: <strong style={{ color: 'var(--accent-light)' }}>{formatUSD(bulanan.reduce((a, m) => a + m.totalUsd, 0))}</strong></span>
              <span>Est. IDR: <strong style={{ color: 'var(--green)' }}>{formatRp(bulanan.reduce((a, m) => a + m.totalUsd, 0) * kurs)}</strong></span>
            </div>
          </>
        )}
      </div>

      {/* Kesehatan Finansial Studio -- berbasis omset ASLI (tren + cakupan biaya operasional),
          beda dari skor kepatuhan lapor di halaman Kepatuhan Laporan. */}
      {ranking.length > 0 && (() => {
        const fh = data?.financialHealth ?? { sehat: 0, perluPerhatian: 0, kritis: 0, total: ranking.length }
        const sehatPct = fh.total ? Math.round((fh.sehat / fh.total) * 100) : 0
        const finFiltered = finFilter ? ranking.filter(s => s.financialHealth.status === finFilter) : ranking
        const TILES = [
          { key: 'SEHAT',           label: 'Sehat',           val: fh.sehat },
          { key: 'PERLU_PERHATIAN', label: 'Perlu Perhatian', val: fh.perluPerhatian },
          { key: 'KRITIS',          label: 'Kritis',          val: fh.kritis },
        ]
        return (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">💚 Kesehatan Finansial Studio — {getBulanLabel(bulan, tahun)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, lineHeight: 1.6 }}>
              💡 Status ditentukan dari 2 sinyal: <strong>tren omset mingguan</strong> (naik/turun) dan <strong>cakupan biaya operasional</strong> (omset bulan ini vs CPM Target studio). Studio tanpa CPM Target ditandai ⚪, ditentukan cuma dari tren.
            </div>

            {/* Ringkasan + tile klikable */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
              <ScoreRing score={sehatPct} color="var(--green)" size={80} />
              <div style={{ display: 'flex', gap: 0, flex: 1, minWidth: 240, borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                {TILES.map((t, i) => {
                  const active = finFilter === t.key
                  const cfg = FIN_STATUS_CONFIG[t.key]
                  return (
                    <button key={t.key} onClick={() => setFinFilter(f => f === t.key ? null : t.key)}
                      style={{
                        flex: 1, textAlign: 'center', cursor: 'pointer', borderRadius: 8, padding: '8px 4px',
                        border: 'none', minHeight: 44, transition: 'background 0.15s',
                        borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                        background: active ? cfg.bg : 'transparent',
                      }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: active ? cfg.color : 'var(--text)' }}>{t.val}</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2, color: active ? cfg.color : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>
                        {cfg.icon} {t.label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* List per studio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {finFiltered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada studio di status ini</div>
              ) : finFiltered.map(s => {
                const { trend, coverage, coverageRatio, status } = s.financialHealth
                const statusCfg = FIN_STATUS_CONFIG[status]
                const covCfg = COVERAGE_CONFIG[coverage]
                const trendCfg = TREND_CONFIG[trend]
                return (
                  <div key={s.studio.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }} title={statusCfg.label}>{statusCfg.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.studio.nama}</span> <BadgeKolaborasi studio={s.studio} style={{ marginLeft: 6 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: covCfg.color }}>
                          {covCfg.icon} {covCfg.label}{coverageRatio != null && ` · ${Math.round(coverageRatio * 100)}%`}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: trendCfg.color }}>{trendCfg.icon} {trendCfg.label}</span>
                      </div>
                      <MiniSparkline minggu={s.minggu} trend={trend} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Ranking per Market */}
      {ranking.length > 0 && (() => {
        const market = MARKETS.find(m => m.key === activeMarket)
        const sorted = [...ranking]
          .filter(s => s[activeMarket] > 0)
          .sort((a, b) => b[activeMarket] - a[activeMarket])
        const maxVal = sorted[0]?.[activeMarket] ?? 1
        return (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Ranking per Market</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MARKETS.map(m => (
                  <button key={m.key} onClick={() => setActiveMarket(m.key)}
                    style={{
                      padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: activeMarket === m.key ? `2px solid ${m.color}` : '2px solid transparent',
                      background: activeMarket === m.key ? `${alfa(m.color, 13)}` : 'color-mix(in srgb, var(--text) 5%, transparent)',
                      color: activeMarket === m.key ? m.color : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {sorted.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Tidak ada omset {market.label} bulan ini
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sorted.map((s, i) => {
                  const pct = (s[activeMarket] / maxVal) * 100
                  return (
                    <div key={s.studio.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 24, textAlign: 'center', fontSize: 16 }}>
                        {i < 3 ? MEDAL[i] : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>#{i+1}</span>}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.studio.nama}</span> <BadgeKolaborasi studio={s.studio} style={{ marginLeft: 6 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{(s.studio.circle ?? s.studio.rumahUsaha)?.nama}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: market.color }}>{formatUSD(s[activeMarket])}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                              {s.totalUsd > 0 ? `${((s[activeMarket] / s.totalUsd) * 100).toFixed(0)}%` : ''}
                            </span>
                          </div>
                        </div>
                        <div style={{ height: 6, background: 'color-mix(in srgb, var(--text) 6%, transparent)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99, width: `${pct}%`,
                            background: market.color,
                            opacity: 0.7 + (i === 0 ? 0.3 : 0),
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Studio Detail Table */}
      {ranking.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Detail per Studio</span>
          </div>
          {/* Desktop: tabel */}
          <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table className="table-sticky-2" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 720 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th style={{ width: 44 }}>#</th>
                  <th style={{ width: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>Studio</th>
                  <th style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>Circle</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Total USD</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Est. IDR</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Laporan</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Semangat</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((s, i) => (
                  <tr key={s.studio.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i < 3 ? MEDAL[i] : `#${i+1}`}</td>
                    <td style={{ fontWeight: 600 }}>{s.studio.nama} <BadgeKolaborasi studio={s.studio} style={{ marginLeft: 6 }} /></td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: (s.studio.circle ?? s.studio.rumahUsaha)?.colorHex ?? "var(--text-muted)", flexShrink: 0 }} />
                        {(s.studio.circle ?? s.studio.rumahUsaha)?.nama ?? "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-light)' }}>{formatUSD(s.totalUsd)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)' }}>{formatRp(s.totalUsd * kurs)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge info">{s.jumlahLaporan}x</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {s.avgSemangat
                        ? <span style={{ fontSize: 16 }}>{'⭐'.repeat(Math.round(s.avgSemangat))}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: list ringkas peringkat, ketuk baris untuk detail */}
          <div className="responsive-cards list-ringkas" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {ranking.map((s, i) => (
              <ItemRingkas key={s.studio.id}
                judul={<><span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: 6 }}>{i < 3 ? MEDAL[i] : `#${i+1}`}</span>{s.studio.nama} <BadgeKolaborasi studio={s.studio} style={{ marginLeft: 6 }} /></>}
                warna={(s.studio.circle ?? s.studio.rumahUsaha)?.colorHex ?? 'var(--text-muted)'}
                sub={(s.studio.circle ?? s.studio.rumahUsaha)?.nama ?? '—'}
                nilai={<span style={{ color: 'var(--accent-light)' }}>{formatUSD(s.totalUsd)}</span>}>
                <div className="data-card-row">
                  <span className="data-card-label">Est. IDR</span>
                  <span className="data-card-value" style={{ color: 'var(--green)' }}>{formatRp(s.totalUsd * kurs)}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Laporan</span>
                  <span className="data-card-value"><span className="badge info">{s.jumlahLaporan}x</span></span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Semangat</span>
                  <span className="data-card-value">
                    {s.avgSemangat
                      ? <span style={{ fontSize: 16 }}>{'⭐'.repeat(Math.round(s.avgSemangat))}</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    }
                  </span>
                </div>
              </ItemRingkas>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
