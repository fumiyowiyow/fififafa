import { useState, useRef, useEffect } from 'react'

const PAGE_TITLES = {
  Dashboard:    'Dashboard',
  WeeklyReport: 'Laporan Omset',
  Finance:      'Keuangan',
  SDM:          'SDM',
  Members:      'Anggota',
  Announcement: 'Pengumuman',
  Health:       'Kepatuhan Laporan',
  Koperasi:     'Koperasi',
  Payroll:      'Payroll',
  Kader:        'Performa Kader',
  Performance:  'Performa',
  WebCircle:    'Web Circle',
  Goals:        'Goals & Roadmap',
  Asset:        'Aset & Inventaris',
  Rekrutmen:    'Rekrutmen',
  Profile:      'Profil Saya',
  Milestone:    'Milestone',
  AI:           'AI Intelligence',
  MasterData:   'Unit Usaha',
  Calendar:     'Kalender Ekosistem',
  Reports:      'Unduh Laporan',
  Panduan:      'Panduan',
  Modul:        'Bank Modul',
  Sosmed:       'Direktori Sosmed',
  DanaPengembangan: 'Dana Pengembangan',
}

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function Topbar({ title, user, onLogout, onProfile, onMenuOpen, onNavigate, onOpenSearch, badges = {} }) {
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    if (!showNotif) return
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showNotif])

  const koperasiCount    = badges.Koperasi     ?? 0
  const weeklyCount      = badges.WeeklyReport ?? 0
  const rekrutmenCount   = badges.Rekrutmen    ?? 0
  const totalNotif       = koperasiCount + weeklyCount + rekrutmenCount

  const goTo = (page) => { setShowNotif(false); onNavigate?.(page) }

  return (
    <header className="topbar">
      <button className="hamburger-btn" onClick={onMenuOpen} aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="topbar-title">{PAGE_TITLES[title] ?? title}</div>

      <div className="topbar-right">
        <button className="icon-btn" title="Cari fitur (Ctrl+K)" onClick={onOpenSearch} style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button className="icon-btn" title="Notifikasi" onClick={() => setShowNotif(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {totalNotif > 0 && <span className="notif-dot"/>}
          </button>

          {showNotif && (
            <div style={{
              position: 'fixed', right: 12, top: 60,
              width: 'min(300px, calc(100vw - 24px))',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              zIndex: 1000, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
                Notifikasi
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {weeklyCount > 0 && (
                  <button onClick={() => goTo('WeeklyReport')}
                    style={{ width: '100%', padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.15s', background: 'none', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>📋</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {weeklyCount} studio belum lapor minggu ini
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 2 }}>
                        Buka Laporan Omset →
                      </div>
                    </div>
                  </button>
                )}
                {koperasiCount > 0 && (
                  <button onClick={() => goTo('Koperasi')}
                    style={{ width: '100%', padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.15s', background: 'none', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🏦</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {koperasiCount} setoran menunggu konfirmasi
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 2 }}>
                        Buka Koperasi →
                      </div>
                    </div>
                  </button>
                )}
                {rekrutmenCount > 0 && (
                  <button onClick={() => goTo('Rekrutmen')}
                    style={{ width: '100%', padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', transition: 'background 0.15s', background: 'none', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🧑‍💼</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {rekrutmenCount} calon baru menunggu proses
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 2 }}>
                        Buka Rekrutmen →
                      </div>
                    </div>
                  </button>
                )}
                {totalNotif === 0 && (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                    Semua sudah beres!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="topbar-user-name">{user.nama}</div>
              <div className="topbar-user-role">
                {user.roles?.[0]?.roleType?.replace(/_/g, ' ') ?? 'Member'}
              </div>
            </div>
            <button
              className="topbar-avatar"
              title="Profil saya"
              onClick={onProfile}
              style={{ flexShrink: 0 }}
            >
              {initials(user.nama)}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
