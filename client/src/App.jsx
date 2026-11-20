import { useState, useEffect, useCallback, lazy, Suspense, Component } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import api from './services/api'
import LoginPage from './pages/Auth/LoginPage'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import CommandPalette from './components/common/CommandPalette'

const Dashboard        = lazy(() => import('./pages/Dashboard/index'))
const WeeklyReport     = lazy(() => import('./pages/WeeklyReport/index'))
const Finance          = lazy(() => import('./pages/Finance/Hub'))
const Members          = lazy(() => import('./pages/Members/index'))
const Announcement     = lazy(() => import('./pages/Announcement/index'))
const Health           = lazy(() => import('./pages/Health/index'))
const Koperasi         = lazy(() => import('./pages/Koperasi/index'))
const Kader            = lazy(() => import('./pages/Kader/index'))
const Performance      = lazy(() => import('./pages/Performance/index'))
const Goals            = lazy(() => import('./pages/Goals/index'))
const Asset            = lazy(() => import('./pages/Asset/index'))
const Rekrutmen        = lazy(() => import('./pages/Rekrutmen/index'))
const Profile          = lazy(() => import('./pages/Profile/index'))
const Milestone        = lazy(() => import('./pages/Milestone/index'))
const AI               = lazy(() => import('./pages/AI/index'))
const MasterData       = lazy(() => import('./pages/MasterData/index'))
const Calendar         = lazy(() => import('./pages/Calendar/index'))
const Reports          = lazy(() => import('./pages/Reports/index'))
const Panduan          = lazy(() => import('./pages/Panduan/index'))
const Modul            = lazy(() => import('./pages/Modul/index'))
const Sosmed           = lazy(() => import('./pages/Sosmed/index'))
const DanaPengembangan = lazy(() => import('./pages/DanaPengembangan/index'))
const Payroll          = lazy(() => import('./pages/Payroll/index'))
const SDM              = lazy(() => import('./pages/SDM/index'))
const WebCircle        = lazy(() => import('./pages/WebCircle/index'))

const PAGES = { Dashboard, WeeklyReport, Finance, Members, Announcement, Health, Koperasi, Kader, Performance, Goals, Asset, Rekrutmen, Profile, Milestone, AI, MasterData, Calendar, Reports, Panduan, Modul, Sosmed, DanaPengembangan, Payroll, SDM, WebCircle }

// Slug URL Indonesia — cuma dipakai pas baca/tulis window.location (readLocation/navigate di
// bawah). Id internal (dipakai NAV/PAGES/badge/onNavigate di semua tempat lain) TIDAK berubah.
const ID_TO_SLUG = {
  Dashboard: 'dashboard', WeeklyReport: 'laporan-omset', Finance: 'keuangan',
  Members: 'anggota', Announcement: 'pengumuman', Health: 'kepatuhan-laporan',
  Koperasi: 'koperasi', Kader: 'rekam-jejak', Performance: 'performa',
  Goals: 'goals', Asset: 'aset-inventaris', Rekrutmen: 'rekrutmen',
  Profile: 'profil',
  Milestone: 'milestone', AI: 'ai', MasterData: 'unit-usaha',
  Calendar: 'kalender', Reports: 'unduh-laporan',
  Panduan: 'panduan', Modul: 'bank-modul', Sosmed: 'direktori-sosmed',
  DanaPengembangan: 'dana-pengembangan',
  Payroll: 'payroll',
  SDM: 'sdm',
  WebCircle: 'web-circle',
}
const SLUG_TO_ID = {
  ...Object.fromEntries(Object.entries(ID_TO_SLUG).map(([id, slug]) => [slug, id])),
  // Slug lama sebelum Health di-rename dari "Kesehatan Ekosistem" -> "Kepatuhan Laporan" (skornya
  // sebenarnya cuma ngukur kepatuhan lapor + ada/nggaknya omset, bukan kesehatan finansial beneran)
  // -- dipertahankan biar bookmark/link lama yang masih beredar tetap jalan.
  'kesehatan-ekosistem': 'Health',
}

// Halaman yang sudah dilebur ke hub (13 Okt 2026) -- id & slug lamanya tetap diterima (link di
// Dashboard/Pengumuman/lonceng/bookmark), tapi dialihkan ke tab yang sesuai di hubnya.
const HUB_ALIAS = {
  WeeklyReport: { id: 'Finance', params: { tab: 'omset' } },
  Koperasi:     { id: 'Finance', params: { tab: 'koperasi' } },
  Members:      { id: 'SDM',     params: { tab: 'anggota' } },
  Kader:        { id: 'SDM',     params: { tab: 'kader' } },
  Rekrutmen:    { id: 'SDM',     params: { tab: 'rekrutmen' } },
  Payroll:      { id: 'SDM',     params: { tab: 'payroll' } },
}
function resolveAlias(id, params) {
  const alias = HUB_ALIAS[id]
  return alias ? { id: alias.id, params: { ...alias.params, ...(params ?? {}) } } : { id, params: params ?? {} }
}

// Baca halaman + params aktif dari URL saat ini — dipakai sebagai state awal (refresh/deep-link)
// dan tiap ada event popstate (tombol Back/Forward browser). Slug baru dicek dulu, fallback ke
// id lama (backward-compat buat bookmark/link lama yang masih beredar).
function readLocation() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '') || 'dashboard'
  const active = SLUG_TO_ID[path] ?? (PAGES[path] ? path : null) ?? 'Dashboard'
  const params = Object.fromEntries(new URLSearchParams(window.location.search))
  const r = resolveAlias(active, params)
  if (r.id !== active) {
    // URL lama (mis. /laporan-omset) -> tulis ulang ke alamat hub tanpa menambah entri history.
    window.history.replaceState(null, '', `/${ID_TO_SLUG[r.id] ?? r.id}${paramsToSearch(r.params)}`)
  }
  return { active: r.id, navParams: r.params }
}

// Cuma nilai primitif (string/number/boolean) yang aman & masuk akal disimpan di URL —
// navParams di app ini nyaris selalu {} kecuali kasus sederhana seperti { autoStudio: id }.
function paramsToSearch(params) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      qs.set(k, String(v))
    }
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

const ADMIN_KOPERASI  = ['ADVISOR', 'ADMIN_FUNGSIONAL', 'KEPALA_EKOSISTEM']
const CAN_REPORT      = ['ADVISOR', 'KOORDINATOR', 'PENDAMPING', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM']
const CAN_REKRUTMEN   = ['ADVISOR', 'KOORDINATOR', 'PENDAMPING', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM']
const IS_ADMIN        = ['ADVISOR', 'KEPALA_EKOSISTEM']

function useBadges(user) {
  const [badges, setBadges] = useState({})

  const isAdminKoperasi = user?.roles?.some(r => ADMIN_KOPERASI.includes(r.roleType))
  const canReport       = user?.roles?.some(r => CAN_REPORT.includes(r.roleType))
  const canRekrutmen    = user?.roles?.some(r => CAN_REKRUTMEN.includes(r.roleType))
  const isAdmin         = user?.roles?.some(r => IS_ADMIN.includes(r.roleType))

  const fetchBadges = useCallback(async () => {
    if (!user) return
    const updates = {}

    // Koperasi: setoran menunggu konfirmasi (admin only)
    if (isAdminKoperasi) {
      try {
        const res = await api.get('/api/koperasi/badge')
        updates.Koperasi = res.data.data.menunggu || null
      } catch {}
    }

    // Weekly report: studio belum lapor minggu ini
    if (canReport) {
      try {
        const res  = await api.get('/api/weekly-reports/status/week')
        const list = res.data.data ?? []
        if (isAdmin) {
          const belum = list.filter(s => !s.sudahLapor).length
          updates.WeeklyReport = belum || null
        } else {
          const myStudioIds = new Set(
            user.roles
              .filter(r => CAN_REPORT.includes(r.roleType) && r.studioId)
              .map(r => r.studioId)
          )
          const belum = list.filter(s => myStudioIds.has(s.id) && !s.sudahLapor).length
          updates.WeeklyReport = belum || null
        }
      } catch {}
    }

    // Rekrutmen: calon baru status PENDAFTARAN menunggu proses
    if (canRekrutmen) {
      try {
        const res = await api.get('/api/rekrutmen/badge')
        updates.Rekrutmen = res.data.data.pendaftaran || null
      } catch {}
    }

    setBadges(prev => {
      const next = { ...prev, ...updates }
      // Laporan Omset & Koperasi sekarang tab di hub Keuangan -- badge menu Keuangan = gabungan.
      next.Finance = ((next.WeeklyReport ?? 0) + (next.Koperasi ?? 0)) || null
      next.SDM = next.Rekrutmen ?? null
      return next
    })
  }, [user, isAdminKoperasi, canReport, canRekrutmen, isAdmin])

  useEffect(() => {
    fetchBadges()
    const interval = setInterval(fetchBadges, 60_000)
    return () => clearInterval(interval)
  }, [fetchBadges])

  return { badges, refreshBadges: fetchBadges }
}

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 200 }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  )
}

// Chunk halaman (React.lazy) gagal di-fetch -- paling sering karena browser masih buka tab LAMA
// pas server baru aja di-deploy ulang (nama file chunk berubah hash, file lama udah gak ada).
// Tanpa boundary ini, error React.lazy nge-throw pas render (Suspense sendiri gak nangkep error,
// cuma nangkep "masih loading") dan gak ke-catch sama apa pun -- React unmount SELURUH tree
// (termasuk Sidebar/Topbar di luar Suspense), halaman jadi blank total tanpa pesan apa pun.
const CHUNK_ERROR_RE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk/i

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error) {
    // Reload OTOMATIS sekali doang (flag session cegah infinite-reload kalau errornya menetap/
    // beda sebab) -- kalau beneran cuma chunk basi, reload narik index.html + hash chunk terbaru
    // dan user gak sadar sempat error sama sekali.
    if (CHUNK_ERROR_RE.test(error?.message ?? '') && !sessionStorage.getItem('chunk-reload-attempted')) {
      sessionStorage.setItem('chunk-reload-attempted', '1')
      window.location.reload()
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12, height: '100%', minHeight: 300, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Halaman gagal dimuat</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
            Mungkin ada update baru di aplikasi. Coba muat ulang halaman.
          </div>
          <button className="btn btn-primary"
            onClick={() => { sessionStorage.removeItem('chunk-reload-attempted'); window.location.reload() }}>
            Muat Ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppShell() {
  const { user, loading, logout } = useAuth()
  const [{ active, navParams }, setLocation] = useState(readLocation)
  const [sidebarOpen, setSidebar] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { badges, refreshBadges } = useBadges(user)

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // App berhasil render -- hapus flag "udah pernah auto-reload gara-gara chunk basi" biar insiden
  // deploy BERIKUTNYA (kalau kejadian lagi) tetap dapet satu kali auto-reload gratis juga.
  useEffect(() => {
    sessionStorage.removeItem('chunk-reload-attempted')
  }, [])

  // Tombol Back/Forward browser — baca ulang halaman dari URL, jangan push entry baru
  useEffect(() => {
    const onPopState = () => setLocation(readLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (loading) return <div className="login-page"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
  if (!user)   return <LoginPage />

  const Page = PAGES[active] ?? Dashboard
  const navigate = (idAsal, paramsAsal) => {
    const { id, params } = resolveAlias(idAsal, paramsAsal)
    const slug = ID_TO_SLUG[id] ?? id
    const url = `/${slug}${paramsToSearch(params)}`
    if (url !== window.location.pathname + window.location.search) {
      window.history.pushState(null, '', url)
    }
    setLocation({ active: id, navParams: params ?? {} })
    setSidebar(false)
  }
  const goProfile = () => navigate('Profile')

  return (
    <div className="app">
      <Sidebar active={active} onNavigate={navigate} user={user} badges={badges} isOpen={sidebarOpen} onClose={() => setSidebar(false)} />
      <div className="main-area">
        <Topbar title={active} user={user} onLogout={logout} onProfile={goProfile} onMenuOpen={() => setSidebar(true)} onNavigate={navigate} badges={badges} onOpenSearch={() => setSearchOpen(true)} />
        <div className="page-content">
          <PageErrorBoundary key={active}>
            <Suspense fallback={<PageFallback />}>
              <Page
                onBadgeRefresh={active === 'Finance' ? refreshBadges : undefined}
                badges={active === 'Finance' || active === 'SDM' ? badges : undefined}
                onNavigate={navigate}
                {...navParams}
              />
            </Suspense>
          </PageErrorBoundary>
        </div>
      </div>
      {searchOpen && (
        <CommandPalette
          user={user}
          onNavigate={navigate}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
