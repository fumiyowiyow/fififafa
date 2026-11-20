import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { formatUSD, formatRp, formatRpShort, getBulanLabel } from '../../utils/format'
import { ECOSYSTEM_NAME, APP_URL } from '../../config/ecosystem'
import { ROLE_UANG } from '../../utils/roles'
import MonthlyReportBreakdown from './MonthlyReportBreakdown'
import MonthlyReportCpmTable from './MonthlyReportCpmTable'

// Kelompok per circle / rumah usaha; Korporasi (8 Nov 2026) jadi kelompok sendiri di paling atas,
// berisi unit Korporasi itu + unit di bawahnya (indukId).
function kelompokPerNaungan(studios) {
  const korporasi = {}, lain = {}
  const namaUnit = Object.fromEntries(studios.map(st => [st.id, st.nama]))
  for (const st of studios) {
    const kid = st.tipe === 'KORPORASI' ? st.id : st.indukId
    if (kid) {
      if (!korporasi[kid]) korporasi[kid] = { circle: { id: kid, nama: namaUnit[kid] ?? 'Korporasi', colorHex: 'var(--amber)' }, studios: [] }
      korporasi[kid].studios.push(st)
      continue
    }
    const induk = st.circle ?? st.rumahUsaha
    const cid = induk?.id ?? 'none'
    if (!lain[cid]) lain[cid] = { circle: induk, studios: [] }
    lain[cid].studios.push(st)
  }
  // Korporasinya sendiri di baris pertama kelompoknya.
  for (const k of Object.values(korporasi)) k.studios.sort((a, b) => Number(b.tipe === 'KORPORASI') - Number(a.tipe === 'KORPORASI'))
  return { ...korporasi, ...lain }
}

function generateTelegramText(data, bulan, tahun) {
  if (!data) return ''
  const { summary: s, studios } = data
  const lines = []
  lines.push(`📊 *Rekap Omset ${ECOSYSTEM_NAME} — ${getBulanLabel(bulan, tahun)}*`)
  lines.push('')
  lines.push(`✅ Sudah Lapor: ${s.sudahLapor}/${s.totalStudio} studio`)
  lines.push(`💰 Total Omset: ${formatUSD(s.grandTotalUsd)} (~${formatRpShort(s.grandTotalIdr)})`)
  lines.push(`💵 Total Kas rekening: ${formatRpShort(s.grandTotalKas)}`)
  if (s.grandTotalPengeluaran > 0)
    lines.push(`🔴 Total Pengeluaran: ${formatRpShort(s.grandTotalPengeluaran)}`)

  const byCircle = kelompokPerNaungan(studios)

  for (const { circle, studios: cs } of Object.values(byCircle)) {
    lines.push('')
    lines.push(`*${circle?.nama ?? 'Tanpa Circle'}*`)
    for (const st of cs) {
      const kas = st.kasAkhir != null ? ` | Kas rekening: ${formatRpShort(st.kasAkhir)}` : ''
      if (st.sudahLapor) {
        lines.push(`• ${st.nama}: ${formatUSD(st.totalUsd)}${kas} ✅`)
      } else {
        lines.push(`• ${st.nama}: Belum lapor ❌`)
      }
    }
  }

  if (s.belumLapor > 0) {
    lines.push('')
    lines.push(`⚠️ *Belum Lapor (${s.belumLapor}):*`)
    studios.filter(st => !st.sudahLapor).forEach(st => lines.push(`  - ${st.nama}`))
  }

  lines.push('')
  lines.push(`_Generated dari ${APP_URL}_`)
  return lines.join('\n')
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// ── Tab Monthly Report ───────────────────────────────────
export default function MonthlyReport({ canEditReport, setEditReport, onNavigate }) {
  const { user } = useAuth()
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [copied, setCopied]           = useState(false)

  const { data, loading, error } = useApi(
    `/api/weekly-reports/monthly?bulan=${bulan}&tahun=${tahun}`,
    [bulan, tahun]
  )

  const { data: cpmData, refetch: refetchCpm } = useApi(
    `/api/monthly-data/cpm?bulan=${bulan}&tahun=${tahun}`,
    [bulan, tahun]
  )

  const prevBulan = bulan === 1 ? 12 : bulan - 1
  const prevTahun = bulan === 1 ? tahun - 1 : tahun
  const { data: prevCpmData } = useApi(
    `/api/monthly-data/cpm?bulan=${prevBulan}&tahun=${prevTahun}`,
    [bulan, tahun]
  )

  const canInputCpm = ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR']
    .some(r => user?.roles?.some(ur => ur.roleType === r))

  // isFullAdminCpm: boleh edit CPM semua studio
  const isFullAdminCpm = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA']
    .some(r => user?.roles?.some(ur => ur.roleType === r))
  const cpmStudioIds = new Set((user?.roles ?? []).filter(r => r.studioId).map(r => r.studioId))
  const canEditCpm = (studioId) => isFullAdminCpm || cpmStudioIds.has(studioId)

  const s = data?.summary
  const studios = data?.studios ?? []

  const byCircle = kelompokPerNaungan(studios)

  return (
    <>
      {/* Selector bulan/tahun */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Rekap Bulan:</span>
        <select className="form-input" style={{ padding: '7px 12px', width: 110 }}
          value={bulan} onChange={e => setBulan(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <input type="number" className="form-input" style={{ padding: '7px 10px', width: 80 }}
          value={tahun} onChange={e => setTahun(Number(e.target.value))} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{getBulanLabel(bulan, tahun)}</span>

        <button
          onClick={() => {
            const text = generateTelegramText(data, bulan, tahun)
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2500)
            })
          }}
          disabled={!data || loading}
          className="btn btn-ghost"
          style={{ padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            color: copied ? 'var(--green)' : undefined,
            borderColor: copied ? 'var(--green)' : undefined,
          }}
        >
          {copied ? '✓ Tersalin!' : '📋 Copy Telegram'}
        </button>

        {/* PDF bulanan sekarang satu pintu: Unduh Laporan › Monthly Report (format lama dihapus 13 Okt 2026). */}
        {onNavigate && ROLE_UANG.some(r => user?.roles?.some(ur => ur.roleType === r)) && (
          <button
            onClick={() => onNavigate('Reports')}
            className="btn btn-primary"
            style={{ padding: '7px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Monthly Report (PDF)
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      )}

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {s && (
        <>
          {/* Summary cards */}
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Sudah Lapor',       val: `${s.sudahLapor}/${s.totalStudio} studio`, color: 'green' },
              { label: 'Total Omset',        val: formatUSD(s.grandTotalUsd),               color: 'purple' },
              { label: 'Total Kas rekening', val: formatRp(s.grandTotalKas),                color: 'amber' },
              { label: 'Total Pengeluaran',  val: formatRp(s.grandTotalPengeluaran ?? 0),   color: 'default' },
            ].map(c => (
              <div key={c.label} className={`stat-card ${c.color}`}>
                <div className="stat-label">{c.label}</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* Breakdown per circle */}
          <MonthlyReportBreakdown byCircle={byCircle} canEditReport={canEditReport} setEditReport={setEditReport} />

          {/* Input CPM & Ekuitas per Studio */}
          {canInputCpm && (
            <MonthlyReportCpmTable
              studios={studios} bulan={bulan} tahun={tahun}
              cpmData={cpmData} prevCpmData={prevCpmData} refetchCpm={refetchCpm}
              isFullAdminCpm={isFullAdminCpm} canEditCpm={canEditCpm}
            />
          )}

          {/* Studio belum lapor */}
          {s.belumLapor > 0 && (
            <div className="card" style={{ borderTop: '3px solid var(--red)' }}>
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--red)' }}>⚠ Belum Lapor ({s.belumLapor} Studio)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 0 4px' }}>
                {studios.filter(st => !st.sudahLapor).map(st => (
                  <span key={st.id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6,
                    background: 'var(--red-subtle)', color: 'var(--red)', fontWeight: 600 }}>
                    {st.nama}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
