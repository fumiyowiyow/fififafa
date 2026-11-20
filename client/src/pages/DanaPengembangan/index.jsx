import { useState, useRef, useEffect } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp, formatUSD, formatTanggalPendek } from '../../utils/format'
import ItemRingkas from '../../components/common/ItemRingkas'

const TIPE_LABEL = {
  TRADER_MANUAL: 'Manual',
  BOT_CRYPTO:    'Bot Crypto',
  SAHAM:         'Saham',
  LAINNYA:       'Lainnya',
}

// Sabtu terakhir (atau hari ini kalau kebetulan Sabtu) — dipakai sebagai default periodeAwal
function getLastSaturday() {
  const d = new Date()
  const day = d.getDay() // 0=Minggu ... 6=Sabtu
  const diff = (day + 1) % 7
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function defaultPeriode() {
  const awal = getLastSaturday()
  return { periodeAwal: awal, periodeAkhir: addDays(awal, 6) }
}

// P/L standar: equity delta murni, disesuaikan modal masuk/keluar supaya tidak ketuker
// sama untung/rugi trading beneran. equityUsd default ke modalAwalUsd kalau belum ada laporan.
function equityUnit(u) {
  return u.laporanTerakhir?.equityUsd ?? u.modalAwalUsd
}
function plUnit(u) {
  return equityUnit(u) - u.modalAwalUsd + (u.totalWithdrawUsd ?? 0) - (u.totalDepositUsd ?? 0)
}

// Input Rupiah dengan pemisah ribuan (angka mentah saat fokus, format id-ID saat blur) — pola sama seperti Finance/index.jsx
function InputRp({ value, onChange, required }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>Rp</span>
      <input
        type="text" className="form-input" style={{ paddingLeft: 34 }} required={required} placeholder="0"
        value={editing ? raw : (value ? Number(value).toLocaleString('id-ID') : '')}
        onFocus={() => { setRaw(value ? String(value) : ''); setEditing(true) }}
        onBlur={() => setEditing(false)}
        onChange={(e) => { const clean = e.target.value.replace(/[^0-9]/g, ''); setRaw(clean); onChange(clean) }}
      />
    </div>
  )
}

// Chart garis ringan tanpa dependency eksternal — total equity ekosistem dari waktu ke waktu
function EquityChart({ points }) {
  if (!points || points.length < 2) {
    return (
      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Belum cukup data laporan mingguan untuk gambar grafik (minimal 2 titik tanggal berbeda)
      </div>
    )
  }

  const W = 800, H = 180, PAD = 24
  const values = points.map((p) => p.totalEquityUsd)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const xStep = (W - PAD * 2) / (points.length - 1)

  const coords = points.map((p, i) => {
    const x = PAD + i * xStep
    const y = H - PAD - ((p.totalEquityUsd - min) / range) * (H - PAD * 2)
    return { x, y, v: p.totalEquityUsd, tanggal: p.tanggal }
  })
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const areaPoints = `${PAD},${H - PAD} ${linePoints} ${W - PAD},${H - PAD}`
  const naik = values[values.length - 1] >= values[0]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, display: 'block' }} preserveAspectRatio="none">
        <polygon points={areaPoints} fill={naik ? 'var(--green)' : 'var(--red)'} opacity="0.12" />
        <polyline points={linePoints} fill="none" stroke={naik ? 'var(--green)' : 'var(--red)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill={naik ? 'var(--green)' : 'var(--red)'} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        <span>{formatTanggalPendek(points[0].tanggal)} — {formatUSD(points[0].totalEquityUsd)}</span>
        <span>{formatTanggalPendek(points[points.length - 1].tanggal)} — {formatUSD(points[points.length - 1].totalEquityUsd)}</span>
      </div>
    </div>
  )
}

export default function DanaPengembangan() {
  const { data: pool,  loading: poolLoading,  refetch: refetchPool  } = useApi('/api/dana-pengembangan/pool')
  const { data: units, loading: unitsLoading, refetch: refetchUnits } = useApi('/api/dana-pengembangan/units')
  const { data: pengelolaList } = useApi('/api/dana-pengembangan/pengelola')
  const { data: timeline } = useApi('/api/dana-pengembangan/timeline')

  const kurs = pool?.kurs ?? 17000
  const totalEquityUsd = (units ?? []).reduce((a, u) => a + equityUnit(u), 0)
  const totalPlUsd     = (units ?? []).reduce((a, u) => a + plUnit(u), 0)

  const [editPool, setEditPool]         = useState(false)
  const [poolForm, setPoolForm]         = useState({ totalPool: '', totalPoolUsd: '', kurs: '', catatan: '' })
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [unitForm, setUnitForm]         = useState({ nama: '', tipe: 'TRADER_MANUAL', pengelolaId: '', modalAwalUsd: '', keterangan: '' })
  const [editingUnitId, setEditingUnitId] = useState(null)
  const [editUnitForm, setEditUnitForm]   = useState({ nama: '', tipe: 'TRADER_MANUAL', pengelolaId: '', modalAwalUsd: '', keterangan: '' })
  const [selectedUnitId, setSelected]   = useState(null)
  const [error, setError]               = useState(null)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const detailRef = useRef(null)

  // Auto-scroll ke bagian Riwayat begitu unit dipilih — daftar unit bisa panjang, tanpa ini
  // detailnya render jauh di bawah tanpa indikasi apapun, bikin user bingung "kok gak kebuka".
  useEffect(() => {
    if (selectedUnitId) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedUnitId])

  const exportPdf = async () => {
    setPdfLoading(true)
    setError(null)
    try {
      const unitList = units ?? []
      const [laporanResults, transaksiResults] = await Promise.all([
        Promise.all(unitList.map((u) => api.get(`/api/dana-pengembangan/units/${u.id}/laporan`))),
        Promise.all(unitList.map((u) => api.get(`/api/dana-pengembangan/units/${u.id}/transaksi`))),
      ])
      const laporanByUnit = {}
      const transaksiByUnit = {}
      unitList.forEach((u, i) => {
        laporanByUnit[u.id] = laporanResults[i].data.data
        transaksiByUnit[u.id] = transaksiResults[i].data.data
      })

      const [{ pdf }, { default: DanaPengembanganPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../../components/DanaPengembanganPDF'),
      ])

      const generatedAt = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const blob = await pdf(
        <DanaPengembanganPDF pool={pool} units={unitList} laporanByUnit={laporanByUnit} transaksiByUnit={transaksiByUnit} generatedAt={generatedAt} />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Dana-Pengembangan-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Gagal generate PDF: ' + (err.message || 'Unknown error'))
    } finally {
      setPdfLoading(false)
    }
  }

  const submitPool = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.put('/api/dana-pengembangan/pool', poolForm)
      setEditPool(false)
      refetchPool()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan')
    }
  }

  const submitUnit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/api/dana-pengembangan/units', unitForm)
      setShowUnitForm(false)
      setUnitForm({ nama: '', tipe: 'TRADER_MANUAL', pengelolaId: '', modalAwalUsd: '', keterangan: '' })
      refetchUnits()
      refetchPool()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah unit')
    }
  }

  const toggleAktifUnit = async (unit) => {
    await api.put(`/api/dana-pengembangan/units/${unit.id}`, { statusAktif: !unit.statusAktif })
    refetchUnits()
    refetchPool()
  }

  const openEditUnit = (unit) => {
    setEditUnitForm({
      nama: unit.nama,
      tipe: unit.tipe,
      pengelolaId: unit.pengelolaId,
      modalAwalUsd: unit.modalAwalUsd,
      keterangan: unit.keterangan ?? '',
    })
    setEditingUnitId(unit.id)
  }

  const submitEditUnit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.put(`/api/dana-pengembangan/units/${editingUnitId}`, editUnitForm)
      setEditingUnitId(null)
      refetchUnits()
      refetchPool()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan unit')
    }
  }

  const hapusUnit = async (unit) => {
    if (!confirm(`Hapus unit "${unit.nama}"? Semua riwayat laporannya ikut terhapus.`)) return
    await api.delete(`/api/dana-pengembangan/units/${unit.id}`)
    if (selectedUnitId === unit.id) setSelected(null)
    refetchUnits()
    refetchPool()
  }

  return (
    <div className="dp-page">
      <div className="page-header page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1>Dana Pengembangan</h1>
          <p>Modul khusus — hanya untuk Pengelola Dana. Modal &amp; saldo dicatat dalam USD, dikonversi ke Rupiah pakai kurs di bawah.</p>
        </div>
        <button className="btn btn-ghost" onClick={exportPdf} disabled={pdfLoading || unitsLoading} style={{ whiteSpace: 'nowrap' }}>
          {pdfLoading ? 'Membuat PDF...' : '⬇ Export PDF'}
        </button>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Total Equity + chart pergerakan ────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Total Equity Ekosistem</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16, marginBottom: 18 }}>
          <Stat label="Equity Dana Pengembangan Saat Ini" value={formatUSD(totalEquityUsd)} color="var(--text)" />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'end', marginBottom: 3, minWidth: 0, overflowWrap: 'anywhere' }}>≈ {formatRp(totalEquityUsd * kurs)}</div>
          <Stat
            label="Total P/L (Lika-Liku)"
            value={`${totalPlUsd >= 0 ? '▲' : '▼'} ${formatUSD(Math.abs(totalPlUsd))}`}
            color={totalPlUsd >= 0 ? 'var(--green)' : 'var(--red)'}
          />
        </div>
        <EquityChart points={timeline} />
      </div>

      {/* ── Pool summary ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Dana Awal &amp; Kurs</span>
          <span
            className="card-action"
            onClick={() => { setPoolForm({ totalPool: pool?.totalPool ?? '', totalPoolUsd: pool?.totalPoolUsd ?? '', kurs: pool?.kurs ?? 17000, catatan: pool?.catatan ?? '' }); setEditPool((v) => !v) }}
          >
            {editPool ? 'Batal' : 'Edit'}
          </span>
        </div>

        {!poolLoading && !editPool && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16 }}>
              <Stat label="Dana Awal" value={formatUSD(pool?.totalPoolUsd)} color="var(--accent-light)" />
              <Stat label="Sudah Dialokasikan" value={formatUSD(pool?.totalAlokasiUsd)} color="var(--cyan)" />
              <Stat label="Belum Dialokasikan" value={formatUSD(pool?.sisaBelumDialokasikanUsd)} color="var(--green)" />
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
              Setara Rp {formatRp(pool?.totalPool)} saat pertama disisihkan · Kurs live saat ini: <strong style={{ color: 'var(--text)' }}>1 USD = {formatRp(kurs)}</strong> (≈ {formatRp(pool?.sisaBelumDialokasikan)} belum dialokasikan)
            </div>
          </>
        )}

        {editPool && (
          <form onSubmit={submitPool}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Dana Awal (USD) *</label>
                <input
                  type="number" min="0" step="0.01" className="form-input" required
                  value={poolForm.totalPoolUsd}
                  onChange={(e) => setPoolForm((f) => ({ ...f, totalPoolUsd: e.target.value }))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Angka utama — isi langsung, jangan dihitung dari kurs</span>
              </div>
              <div className="form-group">
                <label className="form-label">Setara Rp Saat Itu</label>
                <InputRp value={poolForm.totalPool} onChange={(v) => setPoolForm((f) => ({ ...f, totalPool: v }))} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cuma catatan historis, tidak dipakai untuk hitungan</span>
              </div>
              <div className="form-group">
                <label className="form-label">Kurs Live Saat Ini (1 USD = Rp) *</label>
                <input
                  type="number" min="1" className="form-input" required
                  value={poolForm.kurs}
                  onChange={(e) => setPoolForm((f) => ({ ...f, kurs: e.target.value }))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Buat konversi Rp tampilan equity terkini semua unit</span>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Catatan</label>
              <textarea
                className="form-input" style={{ minHeight: 60 }}
                placeholder="Opsional — mis. sumber dana, tanggal penarikan dari kas ekosistem, dll"
                value={poolForm.catatan}
                onChange={(e) => setPoolForm((f) => ({ ...f, catatan: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </form>
        )}
      </div>

      {/* ── Ringkasan Unit (tabel, urut Equity terbesar) ── */}
      {!unitsLoading && (units ?? []).length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Ringkasan Unit</span>
          </div>
          {/* Desktop: tabel */}
          <div className="table-wrap responsive-table">
            <table className="table-sticky-2" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th><th style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>Nama</th>
                  <th style={{ width: 90 }}>Tipe</th><th style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>Pengelola</th>
                  <th style={{ width: 100 }}>Modal Awal</th><th style={{ width: 100 }}>Equity (USD)</th>
                  <th style={{ width: 110 }}>Equity (IDR)</th><th style={{ width: 86 }}>P/L</th>
                </tr>
              </thead>
              <tbody>
                {[...(units ?? [])]
                  .map((u) => ({ ...u, _equity: equityUnit(u) }))
                  .sort((a, b) => b._equity - a._equity)
                  .map((u, i) => {
                    const pl = plUnit(u)
                    return (
                      <tr key={u.id} style={{ opacity: u.statusAktif ? 1 : 0.5, cursor: 'pointer' }} onClick={() => setSelected(u.id)}>
                        <td>{i + 1}</td>
                        <td>{u.nama}{!u.statusAktif && <span className="badge danger" style={{ marginLeft: 6 }}>Nonaktif</span>}</td>
                        <td><span className="badge purple">{TIPE_LABEL[u.tipe]}</span></td>
                        <td>{u.pengelola.nama}</td>
                        <td>{formatUSD(u.modalAwalUsd)}</td>
                        <td style={{ fontWeight: 700 }}>{formatUSD(u._equity)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatRp(u._equity * kurs)}</td>
                        <td style={{ color: pl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {pl >= 0 ? '▲' : '▼'} {formatUSD(Math.abs(pl))}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile: list ringkas, ketuk baris -> halaman detail unit */}
          <div className="responsive-cards list-ringkas">
            {[...(units ?? [])]
              .map((u) => ({ ...u, _equity: equityUnit(u) }))
              .sort((a, b) => b._equity - a._equity)
              .map((u) => {
                const pl = plUnit(u)
                return (
                  <ItemRingkas key={u.id} redup={!u.statusAktif} onPilih={() => setSelected(u.id)}
                    judul={<>{u.nama}{!u.statusAktif && <span className="badge danger" style={{ marginLeft: 6 }}>Nonaktif</span>}</>}
                    sub={`${TIPE_LABEL[u.tipe]} · ${u.pengelola.nama}`}
                    nilai={<>
                      {formatUSD(u._equity)}
                      <span style={{ display: 'block', fontSize: 11, color: pl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{pl >= 0 ? '▲' : '▼'} {formatUSD(Math.abs(pl))}</span>
                    </>} />
                )
              })}
          </div>
        </div>
      )}

      {/* ── Unit list ─────────────────────────────────── */}
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Unit</div>
        <button className="btn btn-primary" onClick={() => setShowUnitForm((v) => !v)}>
          {showUnitForm ? 'Tutup' : '+ Tambah Unit'}
        </button>
      </div>

      {showUnitForm && (
        <form className="card" style={{ marginBottom: 20 }} onSubmit={submitUnit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="form-label">Nama *</label>
              <input
                className="form-input" required placeholder="mis. Trader Budi / Bot Crypto A"
                value={unitForm.nama}
                onChange={(e) => setUnitForm((f) => ({ ...f, nama: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tipe *</label>
              <select
                className="form-input"
                value={unitForm.tipe}
                onChange={(e) => setUnitForm((f) => ({ ...f, tipe: e.target.value }))}
              >
                {Object.entries(TIPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Pengelola *</label>
              <select
                className="form-input" required
                value={unitForm.pengelolaId}
                onChange={(e) => setUnitForm((f) => ({ ...f, pengelolaId: e.target.value }))}
              >
                <option value="">— pilih —</option>
                {(pengelolaList ?? []).map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Modal Awal (USD) *</label>
              <input
                type="number" min="0" step="0.01" className="form-input" required
                value={unitForm.modalAwalUsd}
                onChange={(e) => setUnitForm((f) => ({ ...f, modalAwalUsd: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Keterangan</label>
            <textarea
              className="form-input" style={{ minHeight: 50 }}
              value={unitForm.keterangan}
              onChange={(e) => setUnitForm((f) => ({ ...f, keterangan: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn btn-primary">Simpan Unit</button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {!unitsLoading && (units ?? []).map((u) => {
          const equityUsd = equityUnit(u)
          const plTotalUsd = plUnit(u)
          if (editingUnitId === u.id) {
            return (
              <form key={u.id} className="card" onSubmit={submitEditUnit}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>Edit Unit</div>
                <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nama *</label>
                    <input className="form-input" required value={editUnitForm.nama}
                      onChange={(e) => setEditUnitForm((f) => ({ ...f, nama: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipe *</label>
                    <select className="form-input" value={editUnitForm.tipe}
                      onChange={(e) => setEditUnitForm((f) => ({ ...f, tipe: e.target.value }))}>
                      {Object.entries(TIPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pengelola *</label>
                    <select className="form-input" required value={editUnitForm.pengelolaId}
                      onChange={(e) => setEditUnitForm((f) => ({ ...f, pengelolaId: e.target.value }))}>
                      <option value="">— pilih —</option>
                      {(pengelolaList ?? []).map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Modal Awal (USD) *</label>
                    <input type="number" min="0" step="0.01" className="form-input" required value={editUnitForm.modalAwalUsd}
                      onChange={(e) => setEditUnitForm((f) => ({ ...f, modalAwalUsd: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Keterangan</label>
                    <textarea className="form-input" style={{ minHeight: 50 }} value={editUnitForm.keterangan}
                      onChange={(e) => setEditUnitForm((f) => ({ ...f, keterangan: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Simpan</button>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingUnitId(null)}>Batal</button>
                </div>
              </form>
            )
          }
          const isSelected = selectedUnitId === u.id
          return (
            <div key={u.id} className="card" style={isSelected ? { border: '1px solid var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{u.nama}</div>
                  <span className="badge purple">{TIPE_LABEL[u.tipe]}</span>
                </div>
                {!u.statusAktif && <span className="badge danger">Nonaktif</span>}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 14px' }}>Pengelola: {u.pengelola.nama}</div>

              <Stat label="Equity Terkini" value={formatUSD(equityUsd)} color="var(--text)" />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>≈ {formatRp(equityUsd * kurs)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: plTotalUsd >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 8 }}>
                P/L {plTotalUsd >= 0 ? '▲' : '▼'} {formatUSD(Math.abs(plTotalUsd))} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>dari modal awal {formatUSD(u.modalAwalUsd)}</span>
              </div>
              {(u.totalWithdrawUsd > 0 || u.totalDepositUsd > 0) && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  (sudah disesuaikan: {u.totalWithdrawUsd > 0 && `+${formatUSD(u.totalWithdrawUsd)} withdraw`}{u.totalWithdrawUsd > 0 && u.totalDepositUsd > 0 && ', '}{u.totalDepositUsd > 0 && `-${formatUSD(u.totalDepositUsd)} deposit`})
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Update terakhir: {u.laporanTerakhir ? formatTanggalPendek(u.laporanTerakhir.periodeAkhir) : 'Belum ada laporan'}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}
                  onClick={() => setSelected(isSelected ? null : u.id)}
                >
                  {isSelected ? '✓ Lapor & Riwayat' : '📝 Lapor & Riwayat'}
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => openEditUnit(u)}>
                  Edit
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => toggleAktifUnit(u)}>
                  {u.statusAktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={() => hapusUnit(u)}>Hapus</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Selected unit: laporan form + history table ── */}
      {selectedUnitId && (() => {
        const unit = (units ?? []).find((u) => u.id === selectedUnitId)
        return (
          <div ref={detailRef} style={{ scrollMarginTop: 16 }}>
            <UnitDetail
              unitId={selectedUnitId}
              unitNama={unit?.nama}
              modalAwalUsd={unit?.modalAwalUsd ?? 0}
              kurs={kurs}
              onClose={() => setSelected(null)}
              onChanged={() => { refetchUnits(); refetchPool() }}
            />
            <TransaksiSection unitId={selectedUnitId} kurs={kurs} />
          </div>
        )
      })()}
    </div>
  )
}

function Stat({ label, value, color, small }) {
  // min-width:0 wajib buat item grid/flex — tanpa ini, angka panjang (mis. "Rp405.000.000")
  // yang gabisa word-wrap (gaada spasi) bakal maksa track grid melebar, dan itu bikin
  // SELURUH halaman ikut ter-scroll horizontal, bukan cuma kotak Stat ini.
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: small ? 15 : 20, fontWeight: 800, color, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function UnitDetail({ unitId, unitNama, modalAwalUsd, kurs, onClose, onChanged }) {
  const { data: laporan, loading, refetch } = useApi(`/api/dana-pengembangan/units/${unitId}/laporan`)
  const { data: transaksiList } = useApi(`/api/dana-pengembangan/units/${unitId}/transaksi`)
  const [form, setForm] = useState({ ...defaultPeriode(), equityUsd: '', prosesnya: '' })
  const [error, setError] = useState(null)
  const [editingLaporanId, setEditingLaporanId] = useState(null)
  const [editLaporanForm, setEditLaporanForm] = useState({ periodeAkhir: '', equityUsd: '', prosesnya: '' })

  const openEditLaporan = (l) => {
    setEditLaporanForm({
      periodeAkhir: new Date(l.periodeAkhir).toISOString().slice(0, 10),
      equityUsd: l.equityUsd,
      prosesnya: l.prosesnya,
    })
    setEditingLaporanId(l.id)
  }

  const submitEditLaporan = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.put(`/api/dana-pengembangan/laporan/${editingLaporanId}`, editLaporanForm)
      setEditingLaporanId(null)
      refetch()
      onChanged()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan laporan')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post(`/api/dana-pengembangan/units/${unitId}/laporan`, form)
      setForm({ ...defaultPeriode(), equityUsd: '', prosesnya: '' })
      refetch()
      onChanged()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan laporan')
    }
  }

  const hapusLaporan = async (l) => {
    const periode = `${formatTanggalPendek(l.periodeAwal)} – ${formatTanggalPendek(l.periodeAkhir)}`
    if (!confirm(`Hapus laporan periode ${periode} (equity ${formatUSD(l.equityUsd)})?`)) return
    await api.delete(`/api/dana-pengembangan/laporan/${l.id}`)
    refetch()
    onChanged()
  }

  // list sudah urut terbaru->terlama (periodeAwal desc); baseline entri terlama = modalAwalUsd unit
  const rows = laporan ?? []

  // Dihitung sekali, dipakai ulang buat versi tabel (desktop) & versi kartu (mobile) —
  // supaya rumus P/L per periode nggak dobel-tulis di dua tempat.
  const rowsView = rows.map((l, i) => {
    const prevEquityUsd = rows[i + 1]?.equityUsd ?? modalAwalUsd
    const periodStart = rows[i + 1] ? new Date(rows[i + 1].periodeAkhir).getTime() : -Infinity
    const periodEnd = new Date(l.periodeAkhir).getTime()
    const txPeriode = (transaksiList ?? []).filter((t) => {
      const d = new Date(t.tanggal).getTime()
      return d > periodStart && d <= periodEnd
    })
    const withdrawPeriode = txPeriode.filter((t) => t.tipe === 'WITHDRAW').reduce((a, t) => a + t.jumlahUsd, 0)
    const depositPeriode = txPeriode.filter((t) => t.tipe === 'DEPOSIT').reduce((a, t) => a + t.jumlahUsd, 0)
    const plUsd = (l.equityUsd - prevEquityUsd) + withdrawPeriode - depositPeriode
    return { l, withdrawPeriode, depositPeriode, plUsd }
  })

  const EditLaporanForm = ({ l }) => (
    <form onSubmit={submitEditLaporan} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, padding: '8px 0' }}>
      <div className="form-group">
        <label className="form-label">Periode Akhir</label>
        <input type="date" className="form-input" required value={editLaporanForm.periodeAkhir}
          onChange={(e) => setEditLaporanForm((f) => ({ ...f, periodeAkhir: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Equity (USD)</label>
        <input type="number" min="0" step="0.01" className="form-input" required value={editLaporanForm.equityUsd}
          onChange={(e) => setEditLaporanForm((f) => ({ ...f, equityUsd: e.target.value }))} />
      </div>
      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
        <label className="form-label">Prosesnya</label>
        <textarea className="form-input" style={{ minHeight: 44 }} required value={editLaporanForm.prosesnya}
          onChange={(e) => setEditLaporanForm((f) => ({ ...f, prosesnya: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
        <button type="submit" className="btn btn-primary">Simpan</button>
        <button type="button" className="btn btn-ghost" onClick={() => setEditingLaporanId(null)}>Batal</button>
      </div>
    </form>
  )

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Riwayat &amp; P/L Mingguan{unitNama ? ` — ${unitNama}` : ''}</span>
        <span className="card-action" onClick={onClose}>Tutup</span>
      </div>

      {/* Form tambah laporan DITARUH DI ATAS tabel riwayat -- sebelumnya di paling bawah, bikin
          user bingung "laporan mingguan di mana" karena harus scroll ngelewatin seluruh riwayat
          dulu buat nemuinnya. Nambah laporan baru itu aksi utama tiap minggu, cek riwayat sekunder. */}
      <div className="form-panel" style={{ marginBottom: 20 }}>
        <div className="form-panel-title">+ Tambah Laporan Minggu Ini</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field-pair">
            <div className="form-group">
              <label className="form-label">Periode Awal *</label>
              <input type="date" className="form-input" required value={form.periodeAwal}
                onChange={(e) => setForm((f) => ({ ...f, periodeAwal: e.target.value }))} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Biasanya Sabtu</span>
            </div>
            <div className="form-group">
              <label className="form-label">Periode Akhir *</label>
              <input type="date" className="form-input" required value={form.periodeAkhir}
                onChange={(e) => setForm((f) => ({ ...f, periodeAkhir: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Equity Terkini (USD) *</label>
            <input type="number" min="0" step="0.01" className="form-input" required value={form.equityUsd}
              onChange={(e) => setForm((f) => ({ ...f, equityUsd: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Prosesnya (apa yang terjadi minggu ini) *</label>
            <textarea className="form-input" style={{ minHeight: 50 }} required value={form.prosesnya}
              onChange={(e) => setForm((f) => ({ ...f, prosesnya: e.target.value }))} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Simpan Laporan</button>
        </form>
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>
      <div className="divider" />

      {/* ── Desktop: tabel ── */}
      <div className="table-wrap responsive-table" style={{ marginBottom: 20 }}>
        <table>
          <thead><tr><th>Periode</th><th>Equity</th><th>P/L Mingguan</th><th>Prosesnya</th><th></th></tr></thead>
          <tbody>
            {!loading && rowsView.map(({ l, withdrawPeriode, depositPeriode, plUsd }) => {
              if (editingLaporanId === l.id) {
                return (
                  <tr key={l.id}>
                    <td colSpan={5}><EditLaporanForm l={l} /></td>
                  </tr>
                )
              }

              return (
                <tr key={l.id}>
                  <td>{formatTanggalPendek(l.periodeAwal)} – {formatTanggalPendek(l.periodeAkhir)}</td>
                  <td>{formatUSD(l.equityUsd)}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>≈ {formatRp(l.equityUsd * kurs)}</div></td>
                  <td style={{ color: plUsd >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {plUsd >= 0 ? '▲' : '▼'} {formatUSD(Math.abs(plUsd))}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>≈ {formatRp(Math.abs(plUsd) * kurs)}</div>
                    {(withdrawPeriode > 0 || depositPeriode > 0) && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                        (sudah disesuaikan{withdrawPeriode > 0 && `, +${formatUSD(withdrawPeriode)} WD`}{depositPeriode > 0 && `, -${formatUSD(depositPeriode)} deposit`})
                      </div>
                    )}
                  </td>
                  <td>{l.prosesnya}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="card-action" onClick={() => openEditLaporan(l)}>Edit</span>
                    {' · '}
                    <span className="card-action" style={{ color: 'var(--red)' }} onClick={() => hapusLaporan(l)}>Hapus</span>
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada laporan</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile: list ringkas, satu baris per laporan ── */}
      <div className="responsive-cards list-ringkas" style={{ marginBottom: 20 }}>
        {!loading && rowsView.map(({ l, withdrawPeriode, depositPeriode, plUsd }) => (
          <ItemRingkas key={l.id} selaluBuka={editingLaporanId === l.id}
            judul={`${formatTanggalPendek(l.periodeAwal)} – ${formatTanggalPendek(l.periodeAkhir)}`}
            sub={`Equity ${formatUSD(l.equityUsd)}`}
            nilai={<span style={{ color: plUsd >= 0 ? 'var(--green)' : 'var(--red)' }}>{plUsd >= 0 ? '▲' : '▼'} {formatUSD(Math.abs(plUsd))}</span>}>
            {editingLaporanId === l.id ? (
              <EditLaporanForm l={l} />
            ) : (
              <>
                <div className="data-card-row">
                  <span className="data-card-label">Equity</span>
                  <span className="data-card-value">
                    {formatUSD(l.equityUsd)}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>≈ {formatRp(l.equityUsd * kurs)}</div>
                  </span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">P/L Mingguan</span>
                  <span className="data-card-value" style={{ color: plUsd >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {plUsd >= 0 ? '▲' : '▼'} {formatUSD(Math.abs(plUsd))}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>≈ {formatRp(Math.abs(plUsd) * kurs)}</div>
                    {(withdrawPeriode > 0 || depositPeriode > 0) && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                        (disesuaikan{withdrawPeriode > 0 && `, +${formatUSD(withdrawPeriode)} WD`}{depositPeriode > 0 && `, -${formatUSD(depositPeriode)} deposit`})
                      </div>
                    )}
                  </span>
                </div>
                <div style={{ padding: '8px 0 4px' }}>
                  <div className="data-card-label" style={{ marginBottom: 4 }}>Prosesnya</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{l.prosesnya}</div>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <span className="card-action" onClick={() => openEditLaporan(l)}>Edit</span>
                  <span className="card-action" style={{ color: 'var(--red)' }} onClick={() => hapusLaporan(l)}>Hapus</span>
                </div>
              </>
            )}
          </ItemRingkas>
        ))}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Belum ada laporan</div>
        )}
      </div>
    </div>
  )
}

const TRANSAKSI_TIPE_LABEL = { DEPOSIT: 'Deposit (Tambah Modal)', WITHDRAW: 'Withdraw (Tarik Dana)' }

function TransaksiSection({ unitId, kurs }) {
  const { data: transaksi, loading, refetch } = useApi(`/api/dana-pengembangan/units/${unitId}/transaksi`)
  const [form, setForm] = useState({ tipe: 'WITHDRAW', tanggal: new Date().toISOString().slice(0, 10), jumlahUsd: '', kurs: String(kurs), keterangan: '' })
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post(`/api/dana-pengembangan/units/${unitId}/transaksi`, form)
      setForm({ tipe: 'WITHDRAW', tanggal: new Date().toISOString().slice(0, 10), jumlahUsd: '', kurs: String(kurs), keterangan: '' })
      refetch()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mencatat transaksi')
    }
  }

  const hapus = async (t) => {
    const label = `${t.tipe === 'DEPOSIT' ? 'Deposit' : 'Withdraw'} ${formatUSD(t.jumlahUsd)} tgl ${formatTanggalPendek(t.tanggal)}`
    if (!confirm(`Hapus transaksi "${label}"?`)) return
    await api.delete(`/api/dana-pengembangan/transaksi/${t.id}`)
    refetch()
  }

  const rows = transaksi ?? []
  const totalDepositUsd = rows.filter((t) => t.tipe === 'DEPOSIT').reduce((a, t) => a + t.jumlahUsd, 0)
  const totalWithdrawUsd = rows.filter((t) => t.tipe === 'WITHDRAW').reduce((a, t) => a + t.jumlahUsd, 0)

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <span className="card-title">Riwayat Deposit &amp; Withdraw</span>
        {rows.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Deposit: <strong style={{ color: 'var(--green)' }}>{formatUSD(totalDepositUsd)}</strong> · Withdraw: <strong style={{ color: 'var(--red)' }}>{formatUSD(totalWithdrawUsd)}</strong>
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        Tiap transaksi punya kurs sendiri (kurs saat itu terjadi, bisa beda dari kurs live di kartu Dana Awal). Catatan: transaksi di sini murni riwayat pergerakan modal — belum otomatis mengurangi/menambah P/L Mingguan di tabel Equity di atas.
      </div>

      <div className="table-wrap responsive-table" style={{ marginBottom: 20 }}>
        <table>
          <thead><tr><th>Tanggal</th><th>Tipe</th><th>Jumlah</th><th>Kurs Saat Itu</th><th>Keterangan</th><th></th></tr></thead>
          <tbody>
            {!loading && rows.map((t) => (
              <tr key={t.id}>
                <td>{formatTanggalPendek(t.tanggal)}</td>
                <td><span className={`badge ${t.tipe === 'DEPOSIT' ? 'success' : 'danger'}`}>{t.tipe === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}</span></td>
                <td>{formatUSD(t.jumlahUsd)}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>≈ {formatRp(t.jumlahUsd * t.kurs)}</div></td>
                <td style={{ color: 'var(--text-muted)' }}>1 USD = {formatRp(t.kurs)}</td>
                <td>{t.keterangan || '—'}</td>
                <td><span className="card-action" style={{ color: 'var(--red)' }} onClick={() => hapus(t)}>Hapus</span></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada transaksi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="responsive-cards list-ringkas" style={{ marginBottom: 20 }}>
        {!loading && rows.map((t) => (
          <ItemRingkas key={t.id} judul={formatTanggalPendek(t.tanggal)}
            sub={t.tipe === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
            nilai={<span style={{ color: t.tipe === 'DEPOSIT' ? 'var(--green)' : 'var(--red)' }}>{formatUSD(t.jumlahUsd)}</span>}>
            <div className="data-card-row">
              <span className="data-card-label">Jumlah (Rp)</span>
              <span className="data-card-value">≈ {formatRp(t.jumlahUsd * t.kurs)}</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Kurs Saat Itu</span>
              <span className="data-card-value" style={{ color: 'var(--text-muted)' }}>1 USD = {formatRp(t.kurs)}</span>
            </div>
            <div className="data-card-row">
              <span className="data-card-label">Keterangan</span>
              <span className="data-card-value">{t.keterangan || '—'}</span>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <span className="card-action" style={{ color: 'var(--red)' }} onClick={() => hapus(t)}>Hapus</span>
            </div>
          </ItemRingkas>
        ))}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Belum ada transaksi</div>
        )}
      </div>

      <div className="divider" />
      <div className="form-panel">
        <div className="form-panel-title">+ Catat Transaksi</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field-pair">
            <div className="form-group">
              <label className="form-label">Tipe *</label>
              <select className="form-input" value={form.tipe} onChange={(e) => setForm((f) => ({ ...f, tipe: e.target.value }))}>
                {Object.entries(TRANSAKSI_TIPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal *</label>
              <input type="date" className="form-input" required value={form.tanggal}
                onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} />
            </div>
          </div>
          <div className="form-field-pair">
            <div className="form-group">
              <label className="form-label">Jumlah (USD) *</label>
              <input type="number" min="0" step="0.01" className="form-input" required value={form.jumlahUsd}
                onChange={(e) => setForm((f) => ({ ...f, jumlahUsd: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Kurs Saat Ini Terjadi *</label>
              <input type="number" min="1" className="form-input" required value={form.kurs}
                onChange={(e) => setForm((f) => ({ ...f, kurs: e.target.value }))} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default dari kurs live, boleh diganti kalau beda</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan</label>
            <input className="form-input" placeholder="mis. profit-taking, tambah modal dari pool, kebutuhan operasional, dll"
              value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Simpan</button>
        </form>
      </div>
      {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  )
}
