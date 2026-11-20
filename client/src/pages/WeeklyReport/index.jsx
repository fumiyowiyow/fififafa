import { useState, useEffect, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggalPendek } from '../../utils/format'
import { downloadCsv } from '../../utils/csv'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { getWeekDates, getReportingPeriod } from '../../utils/week'
import { MonthWeekPicker } from '../../components/common/MonthWeekPicker'
import { PLATFORMS } from './constants'
import OmsetForm from './OmsetForm'
import EditModal from './EditModal'
import KasTab from './KasTab'
import StatusGrid from './StatusGrid'
import RiwayatLaporan from './RiwayatLaporan'
import MonthlyReport from './MonthlyReport'
import BayanganOmset from './BayanganOmset'

function autoCalcSkor(totalUsd, prevTotal) {
  if (prevTotal <= 0) return 3
  const r = totalUsd / prevTotal
  if (r >= 1.5) return 5
  if (r >= 1.1) return 4
  if (r >= 0.9) return 3
  if (r >= 0.7) return 2
  return 1
}

const EMPTY_FORM = {
  studioId: '', kurs: 17000,
  kendala: '', skorSemangat: 3,
  omsetFiverr: '', omsetEtsy: '', omsetUpwork: '',
  omsetVgen: '', omsetKomunitas: '', omsetLainnya: '',
  // Dana di Luar Kas -- SECARA KONSEP bulanan (StudioMonthlyNote, lihat MonthlyReportCpmTable.jsx
  // di tab Rekap Bulanan), BUKAN field WeeklyReport. Sengaja ditampung di sini juga (diminta tim,
  // 18 Agustus 2026) biar gak perlu pindah tab tiap minggu -- disimpan lewat request KEDUA
  // (POST /api/monthly-data/cpm) di handleSubmit, terpisah dari POST weekly-reports utama.
  danaLuarKas: '',
}

// ── Main page ────────────────────────────────────────────
// Dipakai dua cara: halaman sendiri (link lama), atau TERTANAM di hub Keuangan (13 Okt 2026) --
// hub yang pegang tab-nya (hubTab), judul halaman & bar tab internal disembunyikan (embedded).
export default function WeeklyReport({ hubTab, embedded = false, onPindahTab, onNavigate } = {}) {
  const { user } = useAuth()

  const canSubmit = ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']
    .some(r => user?.roles?.some(ur => ur.roleType === r))

  const isWeeklyFullAdmin = ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA']
    .some(r => user?.roles?.some(ur => ur.roleType === r))

  const myStudios = user?.roles
    ?.filter(r => ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType) && r.studio)
    ?.map(r => r.studio) ?? []
  const myStudioIds = new Set(myStudios.map(s => s.id))
  const canEditReport = (r) => isWeeklyFullAdmin || myStudioIds.has(r.studioId)

  const [viewWeek, setViewWeek] = useState(getReportingPeriod(getWeekDates().start).periodeAwal)

  const { data: statusData, loading: statusLoading, refetch } = useApi(
    `/api/weekly-reports/status/week?weekStart=${viewWeek}`
  )
  // Riwayat SCOPED ke studio sendiri buat KOORDINATOR/PENDAMPING (pola sama kayak canEditReport
  // di atas) -- sebelumnya SEMUA orang (termasuk koordinator satu studio) fetch top-50 laporan
  // TERBARU SE-EKOSISTEM tanpa filter studioId, baru difilter di client. Begitu ekosistem punya
  // banyak studio aktif lapor tiap minggu, laporan LAMA studio sendiri kesundul keluar dari
  // window top-50 global itu duluan sebelum sempat difilter -- baris/tombol Edit-nya jadi gak
  // pernah ke-render sama sekali (bukan didisable, memang gak ke-fetch). Cuma isWeeklyFullAdmin
  // (admin ekosistem beneran) yang masih perlu browse semua studio, jadi tetap fetch global.
  const riwayatUrl = isWeeklyFullAdmin
    ? '/api/weekly-reports?limit=50'
    : myStudioIds.size
      ? `/api/weekly-reports?studioId=${[...myStudioIds].join(',')}&limit=100`
      : null
  const { data: riwayatRaw, loading: riwayatLoading, refetch: refetchRiwayat } = useApi(riwayatUrl)

  // Riwayat Laporan (tab) sendiri dapat sumber data terpisah -- lihat riwayatBulan/riwayatTahun
  // di bawah, fetch /api/weekly-reports/monthly (endpoint yang sama dipakai Rekap Bulanan, udah
  // include SEMUA studio aktif termasuk yang belum lapor). riwayatRaw di atas TETAP dipertahankan
  // buat keperluan lain (prevTotalUsd form baru, quick-switch minggu lain di EditModal).
  const now = new Date()
  const [riwayatBulan, setRiwayatBulan] = useState(now.getMonth() + 1)
  const [riwayatTahun, setRiwayatTahun] = useState(now.getFullYear())
  const { data: riwayatBulanData, loading: riwayatBulanLoading } = useApi(
    `/api/weekly-reports/monthly?bulan=${riwayatBulan}&tahun=${riwayatTahun}`,
    [riwayatBulan, riwayatTahun]
  )

  const [activeTabSendiri, setActiveTabSendiri] = useState('mingguan')
  const activeTab = hubTab ?? activeTabSendiri
  const setActiveTab = (t) => (onPindahTab ? onPindahTab(t) : setActiveTabSendiri(t))
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmit]   = useState(false)
  const [submitMsg, setSubmitMsg] = useState(null)
  const [editReport, setEditReport] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [autoScore, setAutoScore] = useState(true)

  const [selectedWeek, setSelectedWeek] = useState(getReportingPeriod(getWeekDates().start).periodeAwal)

  // Default kurs form = kurs yang terakhir kali diinput siapa pun (laporan terbaru di riwayatRaw,
  // udah diurutkan createdAt desc dari server) -- bukan angka statis yang gampang basi. Cuma
  // update kalau form.kurs masih persis placeholder EMPTY_FORM (belum diubah manual sama user),
  // biar gak nimpa input yang lagi diketik.
  useEffect(() => {
    if (!riwayatRaw?.length) return
    setForm(f => f.kurs === EMPTY_FORM.kurs ? { ...f, kurs: riwayatRaw[0].kurs } : f)
  }, [riwayatRaw])

  // Kas laporan = snapshot saldo Rekening Bank yang dicatat server (gak diketik lagi sejak
  // 13 Okt 2026). Di sini cuma diambil buat DITAMPILKAN di form, biar koordinator lihat angkanya.
  const [kasLive, setKasLive] = useState(null)
  useEffect(() => {
    setKasLive(null)
    if (!form.studioId) return
    let cancelled = false
    api.get(`/api/masterdata/studios/${form.studioId}/rekening`).then(res => {
      if (cancelled) return
      setKasLive((res.data.data ?? []).reduce((a, r) => a + r.saldo, 0))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [form.studioId])

  // Prefill "Dana di Luar Kas" dari catatan bulan berjalan (bulan/tahun DERIVE dari selectedWeek,
  // bukan tanggal hari ini -- report yang lagi diisi bisa buat minggu di bulan lalu). Pola sama
  // kayak prefill kurs di atas: cuma isi kalau field masih kosong (belum diketik manual).
  useEffect(() => {
    if (!form.studioId || !selectedWeek) return
    const bulan = new Date(selectedWeek).getMonth() + 1
    const tahun = new Date(selectedWeek).getFullYear()
    let cancelled = false
    api.get(`/api/monthly-data/cpm?bulan=${bulan}&tahun=${tahun}`).then(res => {
      if (cancelled) return
      const note = (res.data.data ?? []).find(n => n.studioId === form.studioId)
      if (note == null) return
      setForm(f => (f.studioId === form.studioId && f.danaLuarKas === '') ? { ...f, danaLuarKas: String(note.ekuitas) } : f)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [form.studioId, selectedWeek])

  const prevTotalUsd = useMemo(() => {
    if (!form.studioId || !riwayatRaw) return 0
    const prev = riwayatRaw
      .filter(r => r.studioId === form.studioId && r.periodeAwal < selectedWeek)
      .sort((a, b) => b.periodeAwal.localeCompare(a.periodeAwal))[0]
    if (!prev) return 0
    return PLATFORMS.reduce((s, p) => s + (Number(prev[p.key]) || 0), 0)
  }, [form.studioId, riwayatRaw, selectedWeek])

  const OMSET_KEYS = new Set(PLATFORMS.map(p => p.key))

  const handleInput = (k, v) => {
    if (k === 'studioId') setAutoScore(true)
    setForm(f => {
      const next = { ...f, [k]: v }
      if (OMSET_KEYS.has(k) && autoScore) {
        const newTotal = PLATFORMS.reduce((s, p) => s + (Number(p.key === k ? v : f[p.key]) || 0), 0)
        next.skorSemangat = autoCalcSkor(newTotal, prevTotalUsd)
      }
      return next
    })
  }

  const handleScoreManual = (n) => {
    setAutoScore(false)
    setForm(f => ({ ...f, skorSemangat: n }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.studioId) return setSubmitMsg({ type: 'error', text: 'Pilih studio terlebih dahulu' })
    setSubmit(true); setSubmitMsg(null)
    try {
      await api.post('/api/weekly-reports', {
        ...form,
        periodeAwal: selectedWeek,
        // periodeAkhir gak dikirim -- server yang derive sendiri lewat getReportingPeriod
        // (dipotong di batas bulan), bukan dipercaya mentah dari client.
      })

      // Dana di Luar Kas -- request KEDUA terpisah (endpoint beda, model beda: StudioMonthlyNote
      // bulanan, bukan WeeklyReport). Cuma dikirim kalau field diisi -- dibiarkan kosong artinya
      // "gak diubah", BUKAN "set ke 0" (jangan sampai nimpa catatan bulan ini yang udah bener
      // cuma karena koordinator kelewat/gak isi ulang tiap minggu). Gagalnya TIDAK membatalkan
      // laporan omset yang udah kesimpan duluan -- cuma ditambahin ke pesan sukses.
      let danaLuarKasWarning = ''
      if (form.danaLuarKas !== '') {
        try {
          const bulan = new Date(selectedWeek).getMonth() + 1
          const tahun = new Date(selectedWeek).getFullYear()
          await api.post('/api/monthly-data/cpm', { studioId: form.studioId, bulan, tahun, ekuitas: Number(form.danaLuarKas) })
        } catch {
          danaLuarKasWarning = ' (Dana di Luar Kas gagal disimpan, coba isi lagi lewat tab Rekap Bulanan)'
        }
      }

      setSubmitMsg({ type: 'success', text: `Laporan berhasil disimpan! 🎉${danaLuarKasWarning}` })
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      setAutoScore(true)
      refetch()
      refetchRiwayat()
    } catch (err) {
      setSubmitMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menyimpan laporan' })
    } finally {
      setSubmit(false)
    }
  }


  // riwayat udah di-scope server-side lewat riwayatUrl (lihat atas) -- filter di sini cuma jaring
  // pengaman tambahan (harmless no-op buat isWeeklyFullAdmin, dan buat non-admin datanya emang
  // udah cuma studio sendiri dari server).
  const riwayat = (riwayatRaw ?? []).filter(r => isWeeklyFullAdmin || myStudioIds.has(r.studioId))

  const handleDownloadCsv = () => {
    const rows = riwayat.map(r => ({
      'Studio':      r.studio?.nama ?? '',
      'Periode':     r.periodeAwal ? r.periodeAwal.slice(0, 10) : '',
      'Total USD':   r.totalUsd ?? 0,
      'Fiverr':      r.omsetFiverr    ?? 0,
      'Etsy':        r.omsetEtsy      ?? 0,
      'Upwork':      r.omsetUpwork    ?? 0,
      'VGen':        r.omsetVgen      ?? 0,
      'Komunitas':   r.omsetKomunitas ?? 0,
      'Lainnya':     r.omsetLainnya   ?? 0,
      'Kas rekening': r.kasSekarang   ?? 0,
      'Pengeluaran': r.pengeluaran    ?? 0,
      'Skor Semangat': r.skorSemangat ?? '',
    }))
    downloadCsv(`${ECOSYSTEM_NAME}-Laporan-Omset-${new Date().toISOString().slice(0,10)}.csv`, rows)
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {!embedded && <h1>Laporan Omset</h1>}
            <p>Periode ini: {formatTanggalPendek(getReportingPeriod(getWeekDates().start).periodeAwal)} – {formatTanggalPendek(getReportingPeriod(getWeekDates().start).periodeAkhir)}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={handleDownloadCsv}
              disabled={!riwayat?.length} title="Download CSV riwayat laporan omset">
              ↓ CSV
            </button>
            {canSubmit && activeTab === 'mingguan' && (
              <button className="btn btn-primary" onClick={() => { setShowForm(v => !v); setSubmitMsg(null) }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {showForm ? 'Tutup Form' : 'Input Laporan'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs (disembunyikan kalau tertanam di hub Keuangan -- hub punya bar tab sendiri) */}
      {!embedded && <div style={{ display: 'flex', gap: 4, marginBottom: 8, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { id: 'mingguan', label: '📋 Laporan Mingguan' },
          { id: 'kas',      label: '💰 Kas Studio' },
          { id: 'bulanan',  label: '📊 Rekap Bulanan' },
        ].map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === t.id ? 'var(--bg-card)' : 'none',
              color: activeTab === t.id ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>}

      {/* Hint alur data */}
      <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {activeTab === 'mingguan' ? (
          <>💡 Data yang diinput di sini otomatis masuk ke <strong style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveTab('bulanan')}>Rekap Bulanan →</strong></>
        ) : activeTab === 'kas' ? (
          <>💡 Update saldo kas studio dengan cepat tanpa mengisi form omset lengkap. Perubahan langsung terlihat di Rekap Bulanan.</>
        ) : (
          <>💡 Rekap omset dihitung otomatis. Scroll ke bawah untuk input <strong style={{ color: 'var(--text-secondary)' }}>CPM & Dana di Luar Kas</strong> per studio.</>
        )}
      </div>

      {/* ── Tab: Laporan Mingguan ── */}
      {activeTab === 'mingguan' && (
        <>
          {/* Form Input */}
          {showForm && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <span className="card-title">Form Laporan Mingguan</span>
                <MonthWeekPicker value={selectedWeek} onChange={setSelectedWeek} />
              </div>
              <form onSubmit={handleSubmit}>
                <OmsetForm form={form} onChange={handleInput} myStudios={myStudios} statusData={statusData} isEdit={false}
                  onManualScore={handleScoreManual} isAutoScore={autoScore && prevTotalUsd > 0} kasLive={kasLive}
                  periode={{ awal: selectedWeek, akhir: getReportingPeriod(selectedWeek).periodeAkhir }} />
                {submitMsg && (
                  <div className="login-error" style={{
                    marginBottom: 16,
                    background: submitMsg.type === 'success' ? 'var(--green-subtle)' : 'var(--red-subtle)',
                    color: submitMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
                    borderColor: submitMsg.type === 'success' ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'color-mix(in srgb, var(--red) 20%, transparent)',
                  }}>
                    {submitMsg.text}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 140 }}>
                    {submitting ? <><span className="spinner"/> Menyimpan...</> : 'Simpan Laporan'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
                </div>
              </form>
            </div>
          )}

          {/* Status Grid — pilih periode minggu */}
          <StatusGrid
            statusData={statusData} statusLoading={statusLoading}
            viewWeek={viewWeek} setViewWeek={setViewWeek}
            canEditReport={canEditReport} setEditReport={setEditReport}
          />

          {/* Riwayat Laporan — dikelompokkan per minggu, satu tampilan list yang sama di semua ukuran layar */}
          {canSubmit && (
            <RiwayatLaporan
              data={riwayatBulanData} loading={riwayatBulanLoading}
              bulan={riwayatBulan} tahun={riwayatTahun}
              setBulan={setRiwayatBulan} setTahun={setRiwayatTahun}
              canEditReport={canEditReport} setEditReport={setEditReport}
            />
          )}

          {/* Bayangan omzet: order web circle vs Laporan Omset (tampilan saja). Server menolak unit yang bukan wewenangnya. */}
          {canSubmit && (
            <BayanganOmset
              studios={isWeeklyFullAdmin ? (statusData ?? []).map(s => ({ id: s.id, nama: s.nama })) : myStudios.map(s => ({ id: s.id, nama: s.nama }))}
              bulan={riwayatBulan} tahun={riwayatTahun}
            />
          )}
        </>
      )}

      {/* ── Tab: Kas Studio ── */}
      {activeTab === 'kas' && <KasTab user={user} />}

      {/* ── Tab: Monthly Report ── */}
      {activeTab === 'bulanan' && <MonthlyReport canEditReport={canEditReport} setEditReport={setEditReport} onNavigate={onNavigate} />}

      {editReport && (
        <EditModal
          key={editReport.id}
          report={editReport}
          otherReports={riwayat.filter(r => r.studioId === editReport.studioId && r.id !== editReport.id)}
          onSwitch={setEditReport}
          onClose={() => setEditReport(null)}
          onSaved={() => { refetch(); refetchRiwayat() }}
        />
      )}
    </>
  )
}
