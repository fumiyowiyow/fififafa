import { lazy, Suspense } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_UANG } from '../../utils/roles'
import HubTabs from '../../components/common/HubTabs'
import LabelJalur from '../../components/common/LabelJalur'

const WeeklyReport = lazy(() => import('../WeeklyReport/index'))
const Forecasting  = lazy(() => import('./Forecasting'))
const Pengeluaran  = lazy(() => import('./Pengeluaran'))
const Koperasi     = lazy(() => import('../Koperasi/index'))
const DanaPos      = lazy(() => import('./index'))

/* ══ HUB KEUANGAN (13 Okt 2026, pola rumahpara.app / playgroundecos.app) ══════
   Satu pintu di sidebar untuk semua urusan uang -- dulu tersebar di menu Laporan Omset (3 tab),
   Keuangan, dan Koperasi. Halaman lamanya TIDAK ditulis ulang: tiap tab merender halaman yang
   sama, cuma judul & bar tab internalnya disembunyikan. Link lama (/laporan-omset, /koperasi,
   onNavigate('WeeklyReport'/'Koperasi')) dialihkan ke tab yang sesuai di App.jsx (HUB_ALIAS).
   Tab "Kas Studio" lama digantikan Financial Forecasting (Update Kas ada di tiap baris unit). */
export const HUB_TABS = [
  { id: 'omset',       label: '📋 Laporan Omset',          badge: 'WeeklyReport' },
  { id: 'pengeluaran', label: '🧾 Pengeluaran' },
  { id: 'forecasting', label: '📈 Financial Forecasting' },
  { id: 'bulanan',     label: '📊 Rekap Bulanan' },
  { id: 'koperasi',    label: '🤝 Koperasi',               badge: 'Koperasi' },
  { id: 'dana',        label: '🏦 Dana & Pos' },
]

const PELAPOR = ['KOORDINATOR', 'PENDAMPING']
const PENGAWAS = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL']

function Memuat() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>
}

export default function KeuanganHub({ tab, studioId, onNavigate, onBadgeRefresh, badges = {} }) {
  const { user } = useAuth()
  const roles = user?.roles ?? []
  // Tab bawaan: pelapor unit (koordinator/pendamping) paling sering ke sini buat lapor omset;
  // pengawas (kepala/admin) paling sering lihat gambaran besar.
  const pengawas = roles.some(r => PENGAWAS.includes(r.roleType))
  const bawaan = !pengawas && roles.some(r => PELAPOR.includes(r.roleType)) ? 'omset' : 'forecasting'
  // Role di luar ROLE_UANG (Karyawan/Magang/dll) cuma boleh tab Koperasi ("Simpanan koperasi
  // saya") -- tab lain nampilin angka omset/keuangan yang server-nya juga nolak buat mereka.
  const bolehUang = roles.some(r => ROLE_UANG.includes(r.roleType))
  const tabs = bolehUang ? HUB_TABS : HUB_TABS.filter(t => t.id === 'koperasi')
  const aktif = tabs.some(t => t.id === tab) ? tab : (bolehUang ? bawaan : 'koperasi')

  const pindah = (id) => onNavigate?.('Finance', { tab: id })
  // WeeklyReport memakai id tab internalnya sendiri ('mingguan' | 'bulanan').
  const pindahDariOmset = (internal) => pindah(internal === 'mingguan' ? 'omset' : internal)

  return (
    <>
      <HubTabs tabs={tabs} aktif={aktif} onPilih={pindah} badges={badges} label="Keuangan" />
      {bolehUang && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-12px 0 16px', lineHeight: 1.5 }}>
          <LabelJalur jenis="resmi" /> Semua angka di menu Keuangan masuk laporan {ECOSYSTEM_NAME}.
          Catatan uji coba di web circle (Biaya & Kas, Tutup bulan) <LabelJalur jenis="bayangan" /> belum dihitung di sini.
        </div>
      )}

      <div className="hub-tab-isi">
      <Suspense fallback={<Memuat />}>
        {aktif === 'omset'       && <WeeklyReport embedded hubTab="mingguan" onPindahTab={pindahDariOmset} />}
        {aktif === 'bulanan'     && <WeeklyReport embedded hubTab="bulanan"  onPindahTab={pindahDariOmset} onNavigate={onNavigate} />}
        {aktif === 'pengeluaran' && <Pengeluaran user={user} onNavigate={onNavigate} studioIdAwal={studioId} />}
        {aktif === 'forecasting' && <Forecasting user={user} onNavigate={onNavigate} />}
        {aktif === 'koperasi'    && <Koperasi onBadgeRefresh={onBadgeRefresh} />}
        {aktif === 'dana'        && <DanaPos />}
      </Suspense>
      </div>
    </>
  )
}
