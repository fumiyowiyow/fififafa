import { ECOSYSTEM_NAME, ECOSYSTEM_NAME_FULL, FITUR } from '../../config/ecosystem'
import { onActivate } from '../../utils/a11y'
import { ROLE_UANG } from '../../utils/roles'
import { useTema } from '../../utils/tema'

// Saklar Mode gelap / terang (13 Okt 2026) -- pola playgroundecos.app, di atas kartu pengguna.
function SaklarTema() {
  const [tema, aturTema] = useTema()
  const gelap = tema === 'dark'
  return (
    <button type="button" className="saklar-tema" role="switch" aria-checked={gelap}
      onClick={() => aturTema(gelap ? 'light' : 'dark')}>
      <span className={`saklar-tema-jalur${gelap ? ' nyala' : ''}`} aria-hidden><span className="saklar-tema-bulat" /></span>
      <span>Mode gelap</span>
    </button>
  )
}

export const NAV = [
  {
    section: 'Khusus',
    roles: ['PENGELOLA_DANA'],
    items: [
      { id: 'DanaPengembangan', label: 'Dana Pengembangan' },
    ],
  },
  {
    section: 'Ringkasan',
    items: [
      { id: 'Panduan',      label: 'Mulai dari Sini' },
      { id: 'Dashboard',    label: 'Dashboard'     },
      // Ringkasan web circle semua unit (14 Nov 2026): Koordinator ke atas, isi per wilayah — samain checkMinRole('KOORDINATOR') di routes/ringkasanCircle.js
      { id: 'WebCircle',    label: 'Web Circle', roles: ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL', 'PENDAMPING', 'KOORDINATOR'] },
      { id: 'Calendar',     label: 'Kalender'      },
      // Kepatuhan lapor omset per STUDIO/circle -- bukan untuk Karyawan/Magang (temuan trial 22 Okt 2026:
      // anak magang melihat data circle). Samain checkMinRole('KADER') di routes/health.js.
      { id: 'Health',       label: 'Kepatuhan Laporan', roles: ROLE_UANG },
      { id: 'Announcement', label: 'Pengumuman'    },
    ],
  },
  {
    // Menu ringkas (13 Okt 2026, pola playgroundecos.app): Keuangan & SDM adalah HUB -- halaman
    // lama (Laporan Omset, Koperasi, Anggota, Performa Kader, Rekrutmen, Payroll) jadi tab di
    // dalamnya (pages/Finance/Hub.jsx, pages/SDM/index.jsx), link lamanya dialihkan di App.jsx.
    // Gate role pindah ke item/tab: Keuangan terbuka untuk semua karena hub-nya sendiri cuma
    // nampilin tab Koperasi buat role di luar ROLE_UANG (Karyawan/Magang: "Simpanan koperasi saya").
    section: 'Operasional',
    items: [
      { id: 'Finance',      label: 'Keuangan' },
      { id: 'SDM',          label: 'SDM' },
    ],
  },
  {
    section: 'Unit Usaha',
    items: [
      // Unit Usaha (Bio Studio) bukan buat KADER/KARYAWAN/MAGANG -- gate lama section 'Admin'.
      { id: 'MasterData',  label: 'Unit', roles: ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL', 'PENDAMPING', 'KOORDINATOR'] },
      // Angka omset/keuangan mentah -- KADER ke atas, samain checkMinRole('KADER') di server.
      { id: 'Performance', label: 'Performa',      roles: ROLE_UANG },
      { id: 'Reports',     label: 'Unduh Laporan', roles: ROLE_UANG },
    ],
  },
  {
    section: 'Strategi',
    items: [
      { id: 'Goals',      label: 'Goals & Roadmap'   },
      { id: 'Milestone',  label: 'Milestone'          },
      { id: 'Modul',      label: 'Bank Modul'         },
      { id: 'Sosmed',     label: 'Direktori Sosmed'   },
      // Dibatasi per-item (bukan section, item lain di atas tetap kebuka semua role) -- KARYAWAN
      // gak perlu tahu daftar aset & inventaris studio, samain threshold sama halaman finansial.
      { id: 'Asset',      label: 'Aset & Inventaris', roles: ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL','PENDAMPING','KOORDINATOR'] },
    ],
  },
]

export const ICONS = {
  get SDM() { return this.Members },
  Panduan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  Health: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Announcement: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  ),
  WeeklyReport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Finance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>
    </svg>
  ),
  Rekrutmen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  Goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Milestone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  ),
  Modul: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  Sosmed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Memori: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      <line x1="6" y1="8" x2="6" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/>
    </svg>
  ),
  Asset: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  WebCircle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>
    </svg>
  ),
  Performance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Kader: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  Koperasi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  Payroll: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <line x1="7" y1="9" x2="17" y2="9"/>
      <line x1="7" y1="13" x2="13" y2="13"/>
      <line x1="7" y1="17" x2="11" y2="17"/>
    </svg>
  ),
  Members: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  MasterData: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  DanaPengembangan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="16" r="1.5"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  AI: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      <circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="14" r="1.5"/>
    </svg>
  ),
  Reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
}

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'K'
}

function daysToSaturday() {
  const day = new Date().getDay() // 0=Min, 6=Sab
  return day === 6 ? 0 : (6 - day)
}

function WeeklyWidget({ onNavigate, badges, user }) {
  const roles   = user?.roles ?? []
  const days    = daysToSaturday()

  const isAdmin = roles.some(r => ['ADVISOR','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA'].includes(r.roleType))
  const isKoor  = !isAdmin && roles.some(r => ['KOORDINATOR','PENDAMPING'].includes(r.roleType))
  const isDasar = !isAdmin && !isKoor && roles.some(r => ['KARYAWAN','KADER','MAGANG'].includes(r.roleType))

  if (!isAdmin && !isKoor && !isDasar) return null

  const omsetDone   = !badges.WeeklyReport
  const koperDone   = !badges.Koperasi

  const items = isAdmin ? [
    { page: 'WeeklyReport', label: 'Pantau Laporan Omset',
      done: omsetDone, note: badges.WeeklyReport ? `${badges.WeeklyReport} belum` : 'Semua lapor' },
    { page: 'Koperasi',     label: 'Konfirmasi Koperasi',
      done: koperDone, note: badges.Koperasi ? `${badges.Koperasi} menunggu` : 'Beres' },
    { page: 'Finance',      label: 'Keuangan bulan ini',    done: false, note: 'Bulanan' },
  ] : isKoor ? [
    { page: 'WeeklyReport', label: 'Laporan Omset',
      done: omsetDone, note: omsetDone ? 'Sudah' : days === 0 ? '⚡ Hari ini!' : `Sabtu ${days}h lagi` },
    { page: 'Kader',        label: 'Laporan Kader',         done: false, note: 'Mingguan' },
    { page: 'Koperasi',     label: 'Koperasi',              done: false, note: 'Bulanan'  },
  ] : [
    { page: 'Koperasi',     label: 'Koperasi',              done: false, note: 'Bulanan'   },
  ]

  return (
    <div style={{ margin: '8px 0', padding: '12px', borderRadius: 10,
      background: 'color-mix(in srgb, var(--accent) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>Minggu Ini</span>
        {isKoor && (
          <span style={{ color: days === 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
            {days === 0 ? '⚡ Deadline!' : `Sabtu ${days}h lagi`}
          </span>
        )}
      </div>

      {items.map(item => (
        <button key={item.page}
          onClick={() => onNavigate(item.page)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 4px', background: 'none', border: 'none', cursor: 'pointer',
            borderRadius: 6, transition: 'background 0.15s', textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 5%, transparent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1 }}>
            {item.done ? '✅' : '○'}
          </span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500,
            color: item.done ? 'var(--text-muted)' : 'var(--text)',
            textDecoration: item.done ? 'line-through' : 'none' }}>
            {item.label}
          </span>
          <span style={{ fontSize: 10, color: item.done ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}>
            {item.note}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function Sidebar({ active, onNavigate, user, badges = {}, isOpen, onClose }) {

  return (
    <>
      {isOpen && <div className="sidebar-mobile-overlay" onClick={onClose} />}
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-mark">{ECOSYSTEM_NAME[0]}</div>
        <div className="logo-text-group">
          <div className="logo-name">{ECOSYSTEM_NAME}</div>
          <div className="logo-sub">Ecosystem</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV
          .filter(group => !group.roles || group.roles.some(r => user?.roles?.some(ur => ur.roleType === r)))
          .map(group => ({
            ...group,
            // item.superOverride: item ini juga kebuka kalau user.isProduksiSuperUser true (role
            // asli SUPER_ADMIN ATAU ada baris ProduksiSuperOverride, dihitung server-side di
            // login()/me()) -- KHUSUS Produksi & Payroll, item roles-restricted lain (mis. Kader,
            // Rekrutmen, Asset) TIDAK ikut kebuka cuma karena flag ini.
            items: group.items.filter(item =>
              (!item.fitur || FITUR[item.fitur]) && (
              !item.roles ||
              item.roles.some(r => user?.roles?.some(ur => ur.roleType === r)) ||
              (item.superOverride && user?.isProduksiSuperUser))
            ),
          }))
          .filter(group => group.items.length > 0)
          .map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(item => (
              <button key={item.id}
                className={`nav-item ${active === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-icon">{ICONS[item.id]}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badges[item.id] ? (
                  <span className="nav-badge" title={item.id === 'Finance' ? `${badges[item.id]} perlu ditindaklanjuti (laporan omset belum masuk / setoran koperasi menunggu)` : item.id === 'SDM' ? `${badges[item.id]} calon rekrutmen menunggu diproses` : `${badges[item.id]} menunggu`}>{badges[item.id]}</span>
                ) : null}
              </button>
            ))}
          </div>
        ))}

        <WeeklyWidget onNavigate={onNavigate} badges={badges} user={user} />
      </nav>

      <div className="sidebar-footer">
        <SaklarTema />
        <div className="user-card" onClick={() => onNavigate('Profile')}
          role="button" tabIndex={0} onKeyDown={onActivate(() => onNavigate('Profile'))}
          style={{ cursor: 'pointer' }}>
          <div className="user-avatar">{initials(user?.nama)}</div>
          <div className="user-info">
            <div className="user-name">{user?.nama ?? ECOSYSTEM_NAME_FULL}</div>
            <div className="user-role">
              {user?.roles?.[0]?.roleType?.replace(/_/g, ' ') ?? 'v1.0 · Fase 1B'}
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  )
}
