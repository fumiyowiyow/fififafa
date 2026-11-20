import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { useAuth } from '../../context/AuthContext'
import { ROLE_UANG } from '../../utils/roles'
import BadgeKolaborasi from '../../components/common/BadgeKolaborasi'
import { warnaTipe } from '../../utils/tipeUnit'

const STATUS_CONFIG = {
  SEHAT:             { label: 'Sehat',           color: 'var(--green)', bg: 'var(--green-subtle)',  icon: '✅' },
  PERLU_PERHATIAN:   { label: 'Perlu Perhatian', color: 'var(--amber)', bg: 'var(--amber-subtle)',  icon: '⚠️' },
  KRITIS:            { label: 'Kritis',          color: 'var(--red)', bg: 'var(--red-subtle)',    icon: '🔴' },
}

function ScoreRing({ score, color, size = 80 }) {
  const r   = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const fill = circ * (score / 100)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="color-mix(in srgb, var(--text) 7%, transparent)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color }}>{score}</span>
      </div>
    </div>
  )
}

// Rincian 4 komponen skor -- omsetMinggu/omsetBulan sengaja null buat role di bawah KADER
// (server sensor angka omset mentah), jadi buat mereka rincian itu ditampilin "🔒 disembunyikan"
// (bukan dianggap "tidak terpenuhi") biar gak nyesatin.
function skorBreakdown(s) {
  const omsetVisible = s.omsetMinggu !== null && s.omsetBulan !== null
  return [
    { label: 'Lapor minggu ini',   poin: 40, ok: s.sudahLapor },
    { label: 'Ada omset minggu ini', poin: 30, ok: omsetVisible ? s.omsetMinggu > 0 : null },
    { label: 'Ada omset bulan ini',  poin: 20, ok: omsetVisible ? s.omsetBulan  > 0 : null },
    { label: 'Semangat ≥ 4',         poin: 10, ok: (s.semangat ?? 0) >= 4 },
  ]
}

function StudioRow({ s, onNavigate }) {
  const cfg = STATUS_CONFIG[s.status]
  return (
    <div
      onClick={() => onNavigate?.('MasterData', { autoStudio: s.id })}
      role={onNavigate ? 'button' : undefined} tabIndex={onNavigate ? 0 : undefined}
      onKeyDown={e => { if (onNavigate && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onNavigate('MasterData', { autoStudio: s.id }) } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 6px', margin: '0 -6px', borderRadius: 8, borderBottom: '1px solid var(--border)',
        cursor: onNavigate ? 'pointer' : 'default', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (onNavigate) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
    >
      <span style={{ fontSize: 14 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          {s.nama}
          {s.tipe && <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700,
            padding: '2px 5px', borderRadius: 4,
            ...warnaTipe(s.tipe),
          }}>{s.tipe}</span>}
          <BadgeKolaborasi studio={s} style={{ marginLeft: 6 }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          {s.sudahLapor ? `✓ Laporan masuk` : '✗ Belum lapor'}
          {s.omsetBulan > 0 && ` · $${s.omsetBulan.toFixed(0)} bulan ini`}
        </div>
        {/* Rincian asal angka skor -- biar gak nebak-nebak kenapa persennya segitu */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skorBreakdown(s).map(b => (
            <span key={b.label} title={b.ok === null ? `${b.label} -- cuma kelihatan buat Kader ke atas` : `${b.label} (${b.poin} poin)`}
              style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                color: b.ok === null ? 'var(--text-muted)' : b.ok ? 'var(--green)' : 'var(--red)',
                background: b.ok === null ? 'var(--bg-input)' : b.ok ? 'var(--green-subtle)' : 'var(--red-subtle)',
              }}>
              {b.ok === null ? '🔒' : b.ok ? '✓' : '✗'} {b.label} · {b.poin}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 5 }}><KondisiTim k={s.kondisiTim} kecil /></div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
        background: cfg.bg, color: cfg.color, alignSelf: 'flex-start',
      }}>{s.score}%</div>
    </div>
  )
}

// ── Kondisi Tim (13 Okt 2026) ─────────────────────────────
// Dari Penilaian Kader (SDM › Performa Kader) yang sudah rutin diisi mentor -- bukan isian baru.
// Baik = terbaru >= 3 (Sesuai Harapan) tanpa tren turun; Perhatian = < 3 atau menurun / rendah
// terus; Kritis = < 2; Belum dinilai = gak ada penilaian 3 bulan terakhir. Lihat
// server/src/utils/penilaianKader.js kondisiKader(). TIDAK ikut persen kepatuhan di atas.
const KONDISI = [
  { key: 'baik',          label: 'baik',          color: 'var(--green)', bg: 'var(--green-subtle)' },
  { key: 'perhatian',     label: 'perhatian',     color: 'var(--amber)', bg: 'var(--amber-subtle)' },
  { key: 'kritis',        label: 'kritis',        color: 'var(--red)',   bg: 'var(--red-subtle)' },
  { key: 'belum_dinilai', label: 'belum dinilai', color: 'var(--text-muted)', bg: 'var(--bg-input)' },
]

function KondisiTim({ k, kecil = false }) {
  if (!k || k.total === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}
      title="Kondisi Tim dari Penilaian Kader terbaru tiap anggota (SDM › Performa Kader)">
      <span style={{ fontSize: kecil ? 10 : 11, color: 'var(--text-muted)', marginRight: 2 }}>👥 Tim {k.total}:</span>
      {KONDISI.filter(c => k[c.key] > 0).map(c => (
        <span key={c.key} style={{ fontSize: kecil ? 9 : 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, color: c.color, background: c.bg }}>
          {k[c.key]} {c.label}
        </span>
      ))}
    </div>
  )
}

export default function Health({ onNavigate }) {
  const { user } = useAuth()
  // Menu ini disembunyikan untuk Karyawan/Magang; kalau alamatnya dibuka langsung, tampilkan arahan saja.
  const boleh = user?.roles?.some(r => ROLE_UANG.includes(r.roleType))
  const { data, loading, error } = useApi(boleh ? '/api/health/ecosystem' : null)
  const [filter, setFilter] = useState(null) // null | 'sudah' | 'belum'

  const overall = data ? STATUS_CONFIG[data.status] : null

  const toggleFilter = (key) => setFilter(f => f === key ? null : key)

  // Circle & Rumah Usaha unit organisasi sejajar -- digabung satu grid, bukan section terpisah
  // (dulu cuma data.circles yang dihitung/ditampilkan, skor Rumah Usaha gak pernah kelihatan).
  const filteredGroups = [...(data?.korporasi ?? []), ...(data?.circles ?? []), ...(data?.rumahUsaha ?? [])].map(c => ({
    ...c,
    studios: filter === 'sudah'
      ? c.studios.filter(s => s.sudahLapor)
      : filter === 'belum'
        ? c.studios.filter(s => !s.sudahLapor)
        : c.studios,
  })).filter(c => c.studios.length > 0)

  const STATS = data ? [
    { key: null,    label: 'Studio Aktif',     val: data.totalStudio },
    { key: 'sudah', label: 'Lapor Minggu Ini', val: data.sudahLaporMingguIni },
    { key: 'belum', label: 'Belum Lapor',      val: data.totalStudio - data.sudahLaporMingguIni },
  ] : []

  if (!boleh) {
    return (
      <>
        <div className="page-header">
          <h1>Kepatuhan Laporan</h1>
        </div>
        <section className="card">
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Halaman ini untuk pengelola studio. Cara absen dan mengirim laporan harianmu ada di halaman Mulai dari Sini.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onNavigate?.('Panduan')}>
            Buka Mulai dari Sini
          </button>
        </section>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1>Kepatuhan Laporan</h1>
        <p>Kepatuhan lapor mingguan &amp; aktivitas dasar studio di ekosistem {ECOSYSTEM_NAME} -- buat kesehatan finansial (target/tren omset), cek halaman Performa</p>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, lineHeight: 1.6 }}>
        💡 <strong>👥 Tim</strong> = kondisi anggota dari Penilaian Kader terbaru (baik ≥ 3 · perhatian &lt; 3 atau menurun · kritis &lt; 2), terpisah dari persen. Persen tiap studio = jumlah 4 poin ini: <strong>40</strong> lapor minggu ini + <strong>30</strong> ada omset minggu ini + <strong>20</strong> ada omset bulan ini + <strong>10</strong> semangat ≥4. Rincian mana yang kepenuhi ada di bawah nama tiap studio.
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
          Menghitung skor kesehatan...
        </div>
      ) : data && (
        <>
          {/* Overall Score */}
          <div className="card" style={{ marginBottom: 24 }}>
            {/* Baris 1: Ring + Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
              <ScoreRing score={data.overallScore} color={overall.color} size={90} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  Kepatuhan Laporan
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: overall.color, marginBottom: 4 }}>
                  {overall.icon} {overall.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {data.sudahLaporMingguIni} dari {data.totalStudio} studio sudah lapor minggu ini
                </div>
              </div>
            </div>
            {/* Baris 2: Stats — klikable */}
            <div style={{ display: 'flex', borderTop: '1px solid color-mix(in srgb, var(--text) 7%, transparent)', paddingTop: 16, gap: 0 }}>
              {STATS.map((s, i) => {
                const active = filter === s.key
                return (
                  <button key={s.label}
                    onClick={() => s.key !== null && toggleFilter(s.key)}
                    disabled={s.key === null}
                    style={{
                      flex: 1, textAlign: 'center',
                      borderLeft: i > 0 ? '1px solid color-mix(in srgb, var(--text) 7%, transparent)' : 'none',
                      cursor: s.key !== null ? 'pointer' : 'default',
                      borderRadius: 8, padding: '8px 0', transition: 'background 0.15s',
                      background: active ? 'color-mix(in srgb, var(--text) 6%, transparent)' : 'transparent',
                      border: 'none', minHeight: 44,
                    }}
                    onMouseEnter={e => { if (s.key) e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 5%, transparent)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = active ? 'color-mix(in srgb, var(--text) 6%, transparent)' : 'transparent' }}
                  >
                    <div style={{
                      fontSize: 26, fontWeight: 800,
                      color: active
                        ? (s.key === 'belum' ? 'var(--red)' : 'var(--green)')
                        : 'var(--text)',
                    }}>{s.val}</div>
                    <div style={{
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
                      color: active ? (s.key === 'belum' ? 'var(--red)' : 'var(--green)') : 'var(--text-muted)',
                      fontWeight: active ? 700 : 400,
                    }}>{s.label}</div>
                    {active && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>klik untuk reset</div>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Per Circle & Rumah Usaha */}
          <div className="grid-2">
            {filteredGroups.map(c => {
              const cfg = STATUS_CONFIG[c.status]
              return (
                <div key={c.id} className="card" style={{ borderTop: `3px solid ${c.colorHex}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <ScoreRing score={c.avgScore} color={c.colorHex} size={64} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{c.nama}</div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                        background: cfg.bg, color: cfg.color,
                      }}>{cfg.icon} {cfg.label}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
                        {c.sudahLapor}/{c.totalStudio}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>lapor</div>
                    </div>
                  </div>
                  {c.kondisiTim?.total > 0 && (
                    <div style={{ marginTop: -6, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                      <KondisiTim k={c.kondisiTim} />
                    </div>
                  )}
                  <div>
                    {c.studios.map(s => <StudioRow key={s.id} s={s} onNavigate={onNavigate} />)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Studio kolaborasi: laporannya tetap dipantau, tapi tidak masuk skor/rata-rata ekosistem di atas */}
          {data?.kolaborasi?.length > 0 && (
            <div className="card" style={{ marginTop: 20, borderLeft: '3px solid var(--cyan)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>🤝 Studio Kolaborasi</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Angkanya dihitung di circle mitra — tidak masuk skor dan total ekosistem. Laporannya tetap dipantau di sini.
              </div>
              {data.kolaborasi.map(s => <StudioRow key={s.id} s={s} onNavigate={onNavigate} />)}
            </div>
          )}
        </>
      )}
    </>
  )
}
