import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatRp } from '../../utils/format'
import { getWeekDates, getReportingPeriod } from '../../utils/week'
import KasModal from '../WeeklyReport/KasModal'
import ItemRingkas from '../../components/common/ItemRingkas'

// ── Financial Forecasting (hub Keuangan, 13 Okt 2026) ────
// Satu layar: kas, CPM, omset & target SEMUA unit, dikelompokkan per circle / rumah usaha --
// pola rumahpara.app/playgroundecos.app. Dulu angka-angka ini tersebar di tab Kas Studio, Rekap
// Bulanan, Performa & Dashboard. Gak ada rumus baru: semua dari /api/weekly-reports/monthly
// (kas = saldo Rekening Bank, CPM = utils/cpm.js, omset = laporan mingguan bulan itu).

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const FULL_ADMIN = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA']

// Target = omset bulan ini dibanding CPM (biaya sebulan). Label ikut rumahpara.app.
function infoTarget(omset, cpm) {
  if (!(cpm > 0)) return { persen: null, label: 'CPM belum diisi', warna: 'var(--text-muted)' }
  const persen = Math.round((omset / cpm) * 100)
  if (persen > 100)  return { persen, label: 'Nabung!',     warna: 'var(--accent-light)' }
  if (persen === 100) return { persen, label: 'Mantap!',     warna: 'var(--green)' }
  if (persen >= 50)  return { persen, label: 'Dikit lagi!', warna: 'var(--amber)' }
  return { persen, label: 'Semangat!', warna: 'var(--red)' }
}

function BarTarget({ omset, cpm }) {
  const t = infoTarget(omset, cpm)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{ width: 64, height: 6, borderRadius: 3, background: 'var(--bg-surface)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${Math.min(t.persen ?? 0, 100)}%`, height: '100%', background: t.warna }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: t.warna, whiteSpace: 'nowrap', minWidth: 96, textAlign: 'left' }}>
        {t.persen != null ? `${t.persen}% · ` : ''}{t.label}
      </span>
    </div>
  )
}

// Berapa bulan kas cukup menutup CPM.
const bertahan = (kas, cpm) => (cpm > 0 ? `${(kas / cpm).toLocaleString('id-ID', { maximumFractionDigits: 1 })} bln` : '—')

const omsetRp = (s) => (s.mingguLaporan ?? []).reduce((a, w) => a + w.totalUsd * w.kurs, 0)

export default function Forecasting({ user, onNavigate }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [terbuka, setTerbuka] = useState({}) // { [orgKey]: true }
  const [kasModal, setKasModal] = useState(null)

  const { data, loading, error, refetch } = useApi(`/api/weekly-reports/monthly?bulan=${bulan}&tahun=${tahun}`, [bulan, tahun])

  // Minggu berjalan -- buat tombol Update Kas (laporan minggu ini, kalau sudah ada).
  const weekStart = getReportingPeriod(getWeekDates().start).periodeAwal
  const weekEnd   = getReportingPeriod(weekStart).periodeAkhir
  const { data: statusMinggu, refetch: refetchStatus } = useApi(`/api/weekly-reports/status/week?weekStart=${weekStart}`, [weekStart])
  const { data: posCircle }     = useApi(`/api/org-fund-reports/status?type=circle&weekStart=${weekStart}`, [weekStart])
  const { data: posRumahUsaha } = useApi(`/api/org-fund-reports/status?type=rumahUsaha&weekStart=${weekStart}`, [weekStart])

  const roles = user?.roles ?? []
  const isFullAdmin = FULL_ADMIN.some(r => roles.some(ur => ur.roleType === r))
  const myStudioIds = new Set(roles.filter(r => r.studioId).map(r => r.studioId))
  const bisaUpdateKas = (studioId) => isFullAdmin || myStudioIds.has(studioId)
  const canEditRekening = ['ADVISOR','KEPALA_EKOSISTEM','KOORDINATOR'].some(r => roles.some(ur => ur.roleType === r))

  const organisasi = useMemo(() => {
    const map = {}
    const namaUnit = Object.fromEntries((data?.studios ?? []).map(s => [s.id, s.nama]))
    for (const s of data?.studios ?? []) {
      // Korporasi (8 Nov 2026) = kelompok sendiri: unit Korporasi + unit di bawahnya (indukId).
      const kid = s.tipe === 'KORPORASI' ? s.id : s.indukId
      const org = kid ? { id: kid, nama: namaUnit[kid] ?? 'Korporasi', colorHex: 'var(--amber)' } : s.circle ?? s.rumahUsaha
      const key = kid ? `k:${kid}` : s.circle ? `c:${org.id}` : s.rumahUsaha ? `r:${org.id}` : 'tanpa'
      if (!map[key]) {
        map[key] = {
          key, nama: org?.nama ?? 'Tanpa organisasi', jenis: kid ? 'Korporasi' : s.circle ? 'Circle' : s.rumahUsaha ? 'Rumah Usaha' : '',
          warna: org?.colorHex ?? 'var(--text-muted)', units: [], kas: 0, cpm: 0, omset: 0, lapor: 0,
        }
      }
      const o = map[key]
      const om = omsetRp(s)
      o.units.push({ ...s, omset: om })
      o.kas += s.kasAkhir ?? 0
      o.cpm += s.cpmRp ?? 0
      o.omset += om
      if (s.sudahLapor) o.lapor += 1
    }
    for (const o of Object.values(map)) if (o.jenis === 'Korporasi') o.units.sort((a, b) => Number(b.tipe === 'KORPORASI') - Number(a.tipe === 'KORPORASI'))
    // Korporasi paling atas, "tanpa organisasi" paling bawah, sisanya urut kas.
    const urut = (o) => (o.jenis === 'Korporasi' ? 0 : o.key === 'tanpa' ? 2 : 1)
    return Object.values(map).sort((a, b) => urut(a) - urut(b) || b.kas - a.kas)
  }, [data])

  const total = organisasi.reduce((a, o) => ({ kas: a.kas + o.kas, cpm: a.cpm + o.cpm, omset: a.omset + o.omset }), { kas: 0, cpm: 0, omset: 0 })
  const menabung = total.omset - total.cpm

  const posRumah = [
    ...(posCircle ?? []).map(e => ({ ...e, jenis: 'Circle' })),
    ...(posRumahUsaha ?? []).map(e => ({ ...e, jenis: 'Rumah Usaha' })),
  ].map(e => ({ ...e, dana: e.laporanTerakhir?.dana ?? e.danaSebelumnya ?? null }))

  const semuaTerbuka = organisasi.length > 0 && organisasi.every(o => terbuka[o.key])
  const toggleSemua = () => setTerbuka(semuaTerbuka ? {} : Object.fromEntries(organisasi.map(o => [o.key, true])))

  const bukaUpdateKas = (studio) => {
    const st = (statusMinggu ?? []).find(x => x.id === studio.id)
    setKasModal({ studio: { id: studio.id, nama: studio.nama }, existingReport: st?.sudahLapor ? st.laporanTerakhir : null })
  }

  const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

  return (
    <>
      {/* Periode */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Kas rekening = saldo rekening di Bio Studio · CPM = biaya sebulan (gaji + biaya rutin + SHU) · Target = omset {MONTHS[bulan - 1]} dibanding CPM
          {onNavigate && <>
            {' · '}
            <button type="button" className="card-action" style={{ background: 'none', border: 'none', padding: 0 }}
              onClick={() => onNavigate('MasterData')}>Rekening & biaya rutin diatur di Unit → Bio Studio</button>
          </>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-input" style={{ padding: '6px 10px', width: 120, fontSize: 13 }} value={bulan} onChange={e => setBulan(Number(e.target.value))} aria-label="Bulan">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="form-input" style={{ padding: '6px 10px', width: 80, fontSize: 13 }} value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun" />
        </div>
      </div>

      {/* Ringkasan */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Kas rekening',   val: formatRp(total.kas),   color: 'purple' },
          { label: 'Total CPM',   val: formatRp(total.cpm),   color: 'red' },
          { label: 'Omset Bulan Ini', val: formatRp(total.omset), color: 'green' },
          { label: menabung >= 0 ? 'Menabung' : 'Kurang dari CPM', val: formatRp(Math.abs(menabung)), color: menabung >= 0 ? 'green' : 'amber' },
        ].map(c => (
          <div key={c.label} className={`stat-card ${c.color}`}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: 17 }}>{loading ? '…' : c.val}</div>
          </div>
        ))}
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Unit usaha per organisasi */}
      <div className="card" style={{ padding: 0, marginBottom: 24 }}>
        <div className="card-header" style={{ padding: '14px 16px' }}>
          <span className="card-title">Unit Usaha per Organisasi</span>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={toggleSemua}>
            {semuaTerbuka ? 'Tutup semua' : 'Buka semua'}
          </button>
        </div>
        <div className="table-wrap responsive-table">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Unit Usaha</th>
                <th style={{ ...th, textAlign: 'right' }}>Kas rekening</th>
                <th style={{ ...th, textAlign: 'right' }}>CPM</th>
                <th style={{ ...th, textAlign: 'right' }}>Bertahan</th>
                <th style={{ ...th, textAlign: 'right' }}>Omset</th>
                <th style={{ ...th, textAlign: 'right' }}>Target</th>
                <th style={{ ...th, width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}><span className="spinner" /> Memuat…</td></tr>
              )}
              {!loading && organisasi.map(o => (
                <FragmentOrg key={o.key} o={o} buka={!!terbuka[o.key]} td={td}
                  onToggle={() => setTerbuka(t => ({ ...t, [o.key]: !t[o.key] }))}
                  bisaUpdateKas={bisaUpdateKas} onUpdateKas={bukaUpdateKas} />
              ))}
            </tbody>
          </table>
        </div>
        {/* Layar sempit: list ringkas per organisasi (tabel 6 kolom gak muat, kolomnya kepotong) */}
        <div className="responsive-cards list-ringkas" style={{ margin: '0 12px 12px' }}>
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}><span className="spinner" /> Memuat…</div>}
          {!loading && organisasi.map(o => (
            <KartuOrg key={o.key} o={o} bisaUpdateKas={bisaUpdateKas} onUpdateKas={bukaUpdateKas} />
          ))}
        </div>
      </div>

      {/* Pos Rumah: kas bersama tiap circle / rumah usaha (laporan dana mingguan di tab Dana & Pos) */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: '14px 16px' }}>
          <span className="card-title">🏠 Pos Rumah</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kas bersama tiap circle & rumah usaha · update di tab Dana & Pos</span>
        </div>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Organisasi</th>
                <th style={{ ...th, textAlign: 'right' }}>Dana Terakhir</th>
                <th style={{ ...th, textAlign: 'right' }}>Minggu Ini</th>
              </tr>
            </thead>
            <tbody>
              {posRumah.map(e => (
                <tr key={`${e.jenis}:${e.id}`}>
                  <td style={td}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: e.colorHex ?? 'var(--text-muted)', marginRight: 8 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>{e.jenis}</span>
                    <strong>{e.nama}</strong>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{e.dana != null ? formatRp(e.dana) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontSize: 12, color: e.sudahLapor ? 'var(--green)' : 'var(--text-muted)' }}>
                    {e.sudahLapor ? '✓ Sudah update' : 'Belum update'}
                  </td>
                </tr>
              ))}
              {posRumah.length === 0 && (
                <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {kasModal && (
        <KasModal
          studio={kasModal.studio}
          weekStart={weekStart}
          weekEnd={weekEnd}
          existingReport={kasModal.existingReport}
          canEditRekening={canEditRekening}
          onClose={() => setKasModal(null)}
          onSaved={() => { refetch(); refetchStatus() }}
        />
      )}
    </>
  )
}

function BarisAngka({ label, children }) {
  return (
    <div className="data-card-row">
      <span className="data-card-label">{label}</span>
      <span className="data-card-value">{children}</span>
    </div>
  )
}

// Baris list ringkas di HP: organisasi -> ketuk -> angka organisasi + daftar unit (tiap unit
// juga bisa diketuk untuk CPM, omset, target & Update Kas).
function KartuOrg({ o, bisaUpdateKas, onUpdateKas }) {
  return (
    <ItemRingkas judul={o.nama} warna={o.warna}
      sub={`${o.jenis ? o.jenis + ' · ' : ''}${o.units.length} unit · ${o.lapor}/${o.units.length} lapor`}
      nilai={formatRp(o.kas)}>
      <BarisAngka label="CPM"><span style={{ color: 'var(--red)' }}>{formatRp(o.cpm)}</span> <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>· {bertahan(o.kas, o.cpm)}</span></BarisAngka>
      <BarisAngka label="Omset"><span style={{ color: 'var(--green)' }}>{formatRp(o.omset)}</span></BarisAngka>
      <BarisAngka label="Target"><BarTarget omset={o.omset} cpm={o.cpm} /></BarisAngka>
      <div className="list-ringkas" style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        {o.units.map(s => (
          <ItemRingkas key={s.id} judul={s.nama} redup={!s.sudahLapor}
            sub={s.sudahLapor ? null : 'belum lapor'}
            nilai={formatRp(s.kasAkhir ?? 0)}>
            <BarisAngka label="CPM"><span style={{ color: 'var(--red)' }}>{formatRp(s.cpmRp ?? 0)}</span> <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>· {bertahan(s.kasAkhir ?? 0, s.cpmRp ?? 0)}</span></BarisAngka>
            <BarisAngka label="Omset"><span style={{ color: 'var(--green)' }}>{formatRp(s.omset)}</span></BarisAngka>
            <BarisAngka label="Target"><BarTarget omset={s.omset} cpm={s.cpmRp ?? 0} /></BarisAngka>
            {bisaUpdateKas(s.id) && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px', marginTop: 8 }} onClick={() => onUpdateKas(s)}>Update Kas</button>
            )}
          </ItemRingkas>
        ))}
      </div>
    </ItemRingkas>
  )
}

function FragmentOrg({ o, buka, onToggle, td, bisaUpdateKas, onUpdateKas }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer', background: 'var(--bg-surface)' }}
        role="button" tabIndex={0} aria-expanded={buka}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <td style={{ ...td, borderLeft: `3px solid ${o.warna}` }}>
          <span style={{ display: 'inline-block', width: 14, color: 'var(--text-muted)', fontSize: 10 }}>{buka ? '▼' : '▶'}</span>
          {o.jenis && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{o.jenis}</span>}
          <strong>{o.nama}</strong>
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>{o.units.length} unit · {o.lapor}/{o.units.length} lapor</span>
        </td>
        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{formatRp(o.kas)}</td>
        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{formatRp(o.cpm)}</td>
        <td style={{ ...td, textAlign: 'right', color: 'var(--text-secondary)' }}>{bertahan(o.kas, o.cpm)}</td>
        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{formatRp(o.omset)}</td>
        <td style={td}><BarTarget omset={o.omset} cpm={o.cpm} /></td>
        <td style={td} />
      </tr>
      {buka && o.units.map(s => (
        <tr key={s.id}>
          <td style={{ ...td, paddingLeft: 36 }}>
            {s.nama}
            {s.tipe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>{s.tipe}</span>}
            {!s.sudahLapor && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--amber)' }}>belum lapor</span>}
          </td>
          <td style={{ ...td, textAlign: 'right' }}>{formatRp(s.kasAkhir ?? 0)}</td>
          <td style={{ ...td, textAlign: 'right', color: 'var(--red)' }}>{formatRp(s.cpmRp ?? 0)}</td>
          <td style={{ ...td, textAlign: 'right', color: 'var(--text-secondary)' }}>{bertahan(s.kasAkhir ?? 0, s.cpmRp ?? 0)}</td>
          <td style={{ ...td, textAlign: 'right', color: 'var(--green)' }}>{formatRp(s.omset)}</td>
          <td style={td}><BarTarget omset={s.omset} cpm={s.cpmRp ?? 0} /></td>
          <td style={td}>
            {bisaUpdateKas(s.id) && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => onUpdateKas(s)}>Update Kas</button>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}
