import { useState, lazy, Suspense } from 'react'
import api from '../../services/api'
import { getBulanLabel } from '../../utils/format'
import { downloadCsv } from '../../utils/csv'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { getRoleLabel, getHighestRole, getRoleCircle } from '../../utils/roles'
import { useAuth } from '../../context/AuthContext'

// Monthly Report baru (13 Okt 2026, diadaptasi dari playgroundecos.app): slide 16:9 per circle /
// rumah usaha / satu ekosistem, dengan pilihan tema, huruf, sampul & Pratinjau Langsung.
const PembuatProgressReport = lazy(() => import('./PembuatProgressReport'))
// Weekly Report per unit (13 Okt 2026, diadaptasi dari playgroundecos.app).
const PembuatLaporanMingguan = lazy(() => import('./PembuatLaporanMingguan'))
// Raport siswa Vokasi/KBU (13 Okt 2026) -- unduh PDF; mengisinya di SDM › Raport Siswa.
const KartuRaportSiswa = lazy(() => import('./KartuRaportSiswa'))

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const JALUR_LABEL = { LIVE_IN:'Live In', LANGSUNG:'Langsung', REFERRAL:'Referral' }

// ── Main Page ─────────────────────────────────────────────
export default function Reports({ onNavigate }) {
  const now = new Date()
  const { user } = useAuth()
  // Data lintas-wilayah (rekrutmen & koperasi seluruh ekosistem) hanya untuk peran di atas Koordinator;
  // Koordinator hanya mengunduh yang ada di wilayahnya (Anggota & Omset disaring server per wilayah).
  const bisaCsvEkosistem = user?.roles?.some(r => ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','PENDAMPING'].includes(r.roleType)) ?? false
  // Tiap kartu punya periode sendiri-sendiri — sebelumnya berbagi satu state, jadi ganti periode
  // di satu kartu diam-diam ikut mengubah periode kartu lain yang sudah di-set duluan.
  const [bulanOmset, setBulanOmset]       = useState(now.getMonth() + 1)
  const [tahunOmset, setTahunOmset]       = useState(now.getFullYear())
  const [bulanKoperasi, setBulanKoperasi] = useState(now.getMonth() + 1)
  const [tahunKoperasi, setTahunKoperasi] = useState(now.getFullYear())
  const [errorMsg, setErrorMsg] = useState(null)

  // ── Download CSV helpers ───────────────────────────────
  const [loadingCsvMembers,   setLoadingCsvMembers]   = useState(false)
  const [loadingCsvOmset,     setLoadingCsvOmset]     = useState(false)
  const [loadingCsvRekrutmen, setLoadingCsvRekrutmen] = useState(false)
  const [loadingCsvKoperasi,  setLoadingCsvKoperasi]  = useState(false)

  const downloadCsvMembers = async () => {
    setLoadingCsvMembers(true)
    try {
      const res = await api.get('/api/members?limit=500&lingkup=wilayah')
      const rows = (res.data.data ?? []).map(m => {
        const top = getHighestRole(m.roles)
        return {
          'Nama':             m.nama,
          'Email':            m.email ?? '',
          'No WA':            m.nomorWa ?? '',
          'Role':             getRoleLabel(top?.roleType) || '',
          'Circle':           m.roles?.map(getRoleCircle).find(Boolean)?.nama ?? '',
          'Studio':           m.roles?.find(r => r.studio)?.studio?.nama ?? '',
          'Live In':          m.isLiveIn ? 'Ya' : 'Tidak',
          'Anggota Koperasi': m.isAnggotaKoperasi ? 'Ya' : 'Tidak',
          'Tanggal Masuk':    m.tanggalMasuk ? m.tanggalMasuk.slice(0, 10) : '',
        }
      })
      downloadCsv(`${ECOSYSTEM_NAME}-Anggota-${new Date().toISOString().slice(0,10)}.csv`, rows)
    } catch { setErrorMsg('Gagal download CSV Anggota') }
    finally { setLoadingCsvMembers(false) }
  }

  const downloadCsvOmset = async () => {
    setLoadingCsvOmset(true)
    try {
      const res = await api.get(`/api/weekly-reports?limit=500&bulan=${bulanOmset}&tahun=${tahunOmset}`)
      // Angka unit di luar wilayah disamarkan server (null) → sel CSV dikosongkan, bukan 0.
      const n = (v) => (v == null ? '' : v)
      const rows = (res.data.data ?? []).map(r => ({
        'Studio':       r.studio?.nama ?? '',
        'Periode':      r.periodeAwal ? r.periodeAwal.slice(0, 10) : '',
        'Total USD':    n(r.totalUsd),
        'Fiverr':       n(r.omsetFiverr),
        'Etsy':         n(r.omsetEtsy),
        'Upwork':       n(r.omsetUpwork),
        'VGen':         n(r.omsetVgen),
        'Komunitas':    n(r.omsetKomunitas),
        'Lainnya':      n(r.omsetLainnya),
        'Kas rekening': n(r.kasSekarang),
        'Pengeluaran':  n(r.pengeluaran),
      }))
      downloadCsv(`${ECOSYSTEM_NAME}-Laporan-Omset-${getBulanLabel(bulanOmset, tahunOmset).replace(' ', '-')}.csv`, rows)
    } catch { setErrorMsg('Gagal download CSV Laporan Omset') }
    finally { setLoadingCsvOmset(false) }
  }

  const downloadCsvRekrutmen = async () => {
    setLoadingCsvRekrutmen(true)
    try {
      const res = await api.get('/api/rekrutmen')
      const rows = (res.data.data ?? []).map(r => ({
        'Nama Calon':    r.namaCalon,
        'Email':         r.email ?? '',
        'No WA':         r.nomorWa ?? '',
        'Jalur Masuk':   JALUR_LABEL[r.jalurMasuk] ?? r.jalurMasuk,
        'Referral Dari': r.referralDari ?? '',
        'Studio Tujuan': r.studioTujuan ?? '',
        'Status':        r.status,
        'Catatan':       r.catatan ?? '',
        'Tanggal Daftar': r.createdAt ? r.createdAt.slice(0, 10) : '',
      }))
      downloadCsv(`${ECOSYSTEM_NAME}-Rekrutmen-${new Date().toISOString().slice(0,10)}.csv`, rows)
    } catch { setErrorMsg('Gagal download CSV Rekrutmen') }
    finally { setLoadingCsvRekrutmen(false) }
  }

  const downloadCsvKoperasi = async () => {
    setLoadingCsvKoperasi(true)
    try {
      const res = await api.get(`/api/koperasi/nasabah?bulan=${bulanKoperasi}&tahun=${tahunKoperasi}`)
      const allRows = [...(res.data.data?.userRows ?? []), ...(res.data.data?.studioRows ?? [])]
      const STATUS = { LUNAS: 'Lunas', BELUM: 'Belum', NUNGGAK: 'Nunggak', MENUNGGU: 'Menunggu' }
      const rows = allRows.map(r => ({
        'Nama':              r.nama,
        'Tipe':              r.tipe === 'user' ? 'Perorangan' : 'Studio',
        'Status':            STATUS[r.bulanIni?.status] ?? 'Belum',
        'Simpanan Pokok':    r.bulanIni?.pokok    ?? 0,
        'Simpanan Wajib':    r.bulanIni?.wajib    ?? 0,
        'Simpanan Sukarela': r.bulanIni?.sukarela ?? 0,
        'THR':               r.bulanIni?.thr      ?? 0,
        'Total':             (r.bulanIni?.pokok ?? 0) + (r.bulanIni?.wajib ?? 0) + (r.bulanIni?.sukarela ?? 0) + (r.bulanIni?.thr ?? 0),
        'Periode':           getBulanLabel(bulanKoperasi, tahunKoperasi),
      }))
      downloadCsv(`${ECOSYSTEM_NAME}-Koperasi-${getBulanLabel(bulanKoperasi, tahunKoperasi).replace(' ', '-')}.csv`, rows)
    } catch { setErrorMsg('Gagal download CSV Koperasi') }
    finally { setLoadingCsvKoperasi(false) }
  }


  return (
    <>
      <div className="page-header">
        <h1>Unduh Laporan</h1>
        <p>Generate dan download semua dokumen laporan {ECOSYSTEM_NAME} dalam format PDF</p>
      </div>

      {errorMsg && (
        <div className="login-error" style={{ marginBottom: 20 }}>{errorMsg}</div>
      )}

      <div style={{ marginBottom: 20 }}>
        <Suspense fallback={<div className="card" style={{ padding: 28, textAlign: 'center' }}><span className="spinner" /></div>}>
          <PembuatProgressReport />
        </Suspense>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Suspense fallback={<div className="card" style={{ padding: 28, textAlign: 'center' }}><span className="spinner" /></div>}>
          <PembuatLaporanMingguan onNavigate={onNavigate} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <KartuRaportSiswa />
      </Suspense>

      {/* Info PDF */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--bg-surface)', borderRadius: 12, fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <span>
          PDF dibuat langsung di browser — tidak ada data yang dikirim ke server eksternal.
          Pastikan data laporan mingguan sudah diinput sebelum generate.
        </span>
      </div>

      {/* ── CSV Downloads ── */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Unduh CSV</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Export data mentah dalam format CSV — siap dibuka di Excel atau Google Sheets.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 16 }}>

          {/* CSV Anggota */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👥</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Data Anggota</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nama, email, WA, role, circle, studio, live in, koperasi</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={downloadCsvMembers} disabled={loadingCsvMembers}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              {loadingCsvMembers ? <><span className="spinner"/> Mengambil data...</> : '↓ Download CSV Anggota'}
            </button>
          </div>

          {/* CSV Laporan Omset */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📈</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Laporan Omset</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Per studio per minggu — Fiverr, Etsy, Upwork, VGen, dll</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Periode:</span>
              <select className="form-input" style={{ padding: '5px 8px', width: 90 }}
                value={bulanOmset} onChange={e => setBulanOmset(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <input type="number" className="form-input" style={{ padding: '5px 8px', width: 72 }}
                value={tahunOmset} onChange={e => setTahunOmset(Number(e.target.value))} />
            </div>
            <button className="btn btn-ghost" onClick={downloadCsvOmset} disabled={loadingCsvOmset}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              {loadingCsvOmset ? <><span className="spinner"/> Mengambil data...</> : `↓ Download CSV Omset ${getBulanLabel(bulanOmset, tahunOmset)}`}
            </button>
          </div>

          {/* CSV Rekrutmen */}
          {bisaCsvEkosistem && <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎯</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Data Rekrutmen</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Semua calon anggota, jalur masuk, status pipeline</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={downloadCsvRekrutmen} disabled={loadingCsvRekrutmen}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              {loadingCsvRekrutmen ? <><span className="spinner"/> Mengambil data...</> : '↓ Download CSV Rekrutmen'}
            </button>
          </div>}

          {/* CSV Koperasi */}
          {bisaCsvEkosistem && <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏦</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Data Koperasi</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Simpanan pokok, wajib, sukarela, THR per anggota</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Periode:</span>
              <select className="form-input" style={{ padding: '5px 8px', width: 90 }}
                value={bulanKoperasi} onChange={e => setBulanKoperasi(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <input type="number" className="form-input" style={{ padding: '5px 8px', width: 72 }}
                value={tahunKoperasi} onChange={e => setTahunKoperasi(Number(e.target.value))} />
            </div>
            <button className="btn btn-ghost" onClick={downloadCsvKoperasi} disabled={loadingCsvKoperasi}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              {loadingCsvKoperasi ? <><span className="spinner"/> Mengambil data...</> : `↓ Download CSV Koperasi ${getBulanLabel(bulanKoperasi, tahunKoperasi)}`}
            </button>
          </div>}

        </div>
      </div>
    </>
  )
}
