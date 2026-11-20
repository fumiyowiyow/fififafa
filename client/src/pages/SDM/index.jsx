import { lazy, Suspense } from 'react'
import { useAuth } from '../../context/AuthContext'
import HubTabs from '../../components/common/HubTabs'
import { FITUR } from '../../config/ecosystem'

const Members   = lazy(() => import('../Members/index'))
const Kader     = lazy(() => import('../Kader/index'))
const Rekrutmen = lazy(() => import('../Rekrutmen/index'))
const Payroll   = lazy(() => import('../Payroll/index'))
const PindahKeTumbuh = lazy(() => import('../Raport/PindahKeTumbuh')) // raport pindah ke tumbuh.kariranak.com (22 Okt 2026)

/* ══ HUB SDM (13 Okt 2026, pola rumahpara.app / playgroundecos.app) ══════════
   Semua urusan orang dalam satu menu -- dulu 4 menu terpisah (Anggota, Performa Kader, Rekrutmen,
   Payroll). Halaman lama dirender apa adanya sebagai tab. Link lama (/anggota, /rekam-jejak,
   /rekrutmen, /payroll, onNavigate('Members', { openUserId }) dst) dialihkan di App.jsx.
   roles tiap tab = salinan persis gate menu lamanya di Sidebar (server tetap gate sendiri). */
const PENGURUS = ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']
export const SDM_TABS = [
  { id: 'anggota',   label: '👥 Anggota' },
  { id: 'kader',     label: '📈 Performa Kader', roles: PENGURUS },
  { id: 'rekrutmen', label: '🎯 Rekrutmen',      roles: PENGURUS, badge: 'Rekrutmen' },
  { id: 'payroll',   label: '💸 Payroll',        roles: ['ADVISOR', 'KEPALA_EKOSISTEM'], superOverride: true, fitur: 'payroll' },
  // Raport siswa (13 Okt 2026): pengurus, mentor yang ditunjuk, dan siswa Vokasi/KBU sendiri.
  { id: 'raport',    label: '🎓 Raport Siswa',   roles: PENGURUS,
    juga: (u) => (u?.jumlahSiswaBimbingan ?? 0) > 0 || ['SISWA_VOKASI', 'SISWA_KBU'].includes(u?.statusKeanggotaan) },
]

function Memuat() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>
}

export default function SDM({ tab, openUserId, onNavigate, badges = {} }) {
  const { user } = useAuth()
  const roles = user?.roles ?? []
  const tabs = SDM_TABS.filter(t => (!t.fitur || FITUR[t.fitur]) && (
    !t.roles || t.roles.some(r => roles.some(ur => ur.roleType === r)) || (t.superOverride && user?.isProduksiSuperUser) || t.juga?.(user)
  ))
  const aktif = tabs.some(t => t.id === tab) ? tab : 'anggota'
  const pindah = (id) => onNavigate?.('SDM', { tab: id })

  return (
    <>
      <HubTabs tabs={tabs} aktif={aktif} onPilih={pindah} badges={badges} label="SDM" />
      <div className="hub-tab-isi">
        <Suspense fallback={<Memuat />}>
          {aktif === 'anggota'   && <Members openUserId={openUserId} onNavigate={onNavigate} />}
          {aktif === 'kader'     && <Kader onNavigate={onNavigate} />}
          {aktif === 'rekrutmen' && <Rekrutmen onNavigate={onNavigate} />}
          {aktif === 'payroll'   && <Payroll onNavigate={onNavigate} />}
          {aktif === 'raport'    && <PindahKeTumbuh />}
        </Suspense>
      </div>
    </>
  )
}
