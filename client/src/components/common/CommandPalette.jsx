import { useState, useEffect, useRef } from 'react'
import { NAV, ICONS } from '../layout/Sidebar'
import api from '../../services/api'
import { getRoleLabel, getHighestRole, getRoleOrgUnit, ROLE_UANG } from '../../utils/roles'
import { alfa } from '../../utils/warna'

const EXTRA = [
  { id: 'Profile', label: 'Profil Saya', section: 'Lainnya' },
  // Sudah jadi tab hub Keuangan (13 Okt 2026), gak ada lagi di NAV -- tetap bisa dicari;
  // onNavigate('WeeklyReport'/'Koperasi') dialihkan ke tab-nya di App.jsx. roles = siapa yang
  // boleh lihat tab itu (Koperasi terbuka untuk semua).
  { id: 'WeeklyReport', label: 'Laporan Omset', section: 'Keuangan', roles: ROLE_UANG },
  { id: 'Koperasi',     label: 'Koperasi',      section: 'Keuangan' },
  // Sudah jadi tab hub SDM -- dialihkan di App.jsx.
  { id: 'Members',   label: 'Anggota',        section: 'SDM' },
  { id: 'Kader',     label: 'Performa Kader', section: 'SDM', roles: ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'] },
  { id: 'Rekrutmen', label: 'Rekrutmen',      section: 'SDM', roles: ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'] },
  { id: 'Payroll',   label: 'Payroll',        section: 'SDM', roles: ['ADVISOR','KEPALA_EKOSISTEM'] },
]

// Kata kunci tambahan per halaman — ketik frasa ini untuk menemukan halamannya
const KEYWORDS = {
  SDM:          'sdm anggota orang tim performa kader rekrutmen payroll gaji',
  Dashboard:    'ringkasan finansial total kas dana pe cpm ekuitas overview',
  Finance:      'financial forecasting forecast kas cpm omset target menabung pos rumah rekap bulanan dana pe dana ekosistem dana forum dana berkah dana rumah tangga dana circle setoran pos internal pos eksternal keuangan cpm bulanan ekuitas studio iuran finance',
  WeeklyReport: 'laporan omset omset mingguan kas fiverr etsy upwork vgen komunitas pengeluaran kurs laporan studio',
  Performance:  'performa studio cpm target ekuitas studio pencapaian omset',
  Reports:      'unduh laporan rekap export download rekap bulanan rekap mingguan',
  Members:      'anggota profil anggota thp take home pay nik bpjs rekening bio daftar anggota kontak',
  Kader:        'rekam jejak jurnal talent penilaian kpi timeline magang perkembangan laporan kader',
  Koperasi:     'simpanan koperasi iuran pokok wajib sukarela thr bayar koperasi konfirmasi',
  Rekrutmen:    'rekrut calon anggota seleksi live-in pendaftaran referral',
  Goals:        'target milestone goal pencapaian roadmap progress',
  Milestone:    'pencapaian penting moment bersejarah highlight',
  Modul:        'modul materi belajar bank modul pembelajaran kurikulum',
  Sosmed:       'sosial media link fiverr etsy instagram tiktok youtube linkedin website direktori sosmed',
  Asset:        'aset inventaris peralatan software akun marketplace lisensi',
  MasterData:   'data master studio circle skb koordinator pendamping bio onboard tambah anggota direktori tim kontak daftar kontak nomor wa telegram struktur tim',
  Health:       'kesehatan ekosistem semangat mood weekly health',
  Announcement: 'pengumuman info berita notifikasi siaran',
  Calendar:     'kalender jadwal event tanggal agenda',
  Panduan:      'panduan cara pakai tutorial mulai bot telegram howto',
  Profile:      'profil saya akun password ubah password foto profil',
}

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export default function CommandPalette({ user, onNavigate, onClose }) {
  const [query, setQuery]           = useState('')
  const [selected, setSelected]     = useState(0)
  const [memberHits, setMemberHits] = useState([])
  const [loadingM, setLoadingM]     = useState(false)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const hasRole = (roles) => !roles || roles.some(r => user?.roles?.some(ur => ur.roleType === r))
  const allowedGroups = NAV.filter(group => hasRole(group.roles))
  const allFeatures = [
    ...allowedGroups.flatMap(group =>
      group.items.filter(item => hasRole(item.roles)).map(item => ({ ...item, section: group.section, type: 'feature' }))
    ),
    ...EXTRA.filter(e => hasRole(e.roles) && !allowedGroups.some(g => g.items.some(i => i.id === e.id)))
      .map(e => ({ ...e, type: 'feature' })),
  ]

  const q = query.trim().toLowerCase()

  const featureResults = q === ''
    ? allFeatures
    : allFeatures.filter(item => {
        const kw = KEYWORDS[item.id] ?? ''
        return (
          item.label.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          kw.includes(q)
        )
      })

  const memberItems = memberHits.map(m => ({ ...m, type: 'member' }))
  const combined    = [...featureResults, ...memberItems]

  // Cari anggota berdasarkan nama (hanya jika query ≥ 3 huruf)
  useEffect(() => {
    if (q.length < 3) { setMemberHits([]); return }
    const t = setTimeout(async () => {
      setLoadingM(true)
      try {
        const r = await api.get(`/api/members?search=${encodeURIComponent(q)}&limit=5`)
        setMemberHits(r.data.data ?? [])
      } catch { setMemberHits([]) }
      finally { setLoadingM(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setSelected(0) }, [query])
  useEffect(() => {
    const el = listRef.current?.children[selected]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const go = (item) => {
    if (item.type === 'member') onNavigate('Members', { openUserId: item.id })
    else onNavigate(item.id)
    onClose()
  }

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, combined.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { if (combined[selected]) go(combined[selected]) }
    else if (e.key === 'Escape') { onClose() }
  }

  const SectionLabel = ({ label }) => (
    <div style={{ padding: '8px 16px 3px', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)',
      pointerEvents: 'none', userSelect: 'none' }}>
      {label}
    </div>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: 'max(80px, 15vh) 16px 16px' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)',
          borderRadius: 16, border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari fitur, menu, atau kata kunci…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)', caretColor: 'var(--accent)' }}
          />
          {loadingM && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>…</span>}
          <kbd style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5,
            background: 'var(--bg-surface)', color: 'var(--text-muted)',
            border: '1px solid var(--border)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 440, overflowY: 'auto' }}>
          {combined.length === 0 && !loadingM ? (
            <div style={{ padding: '32px 16px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 13 }}>
              Tidak ditemukan
            </div>
          ) : (
            <>
              {/* Features */}
              {featureResults.length > 0 && (
                <>
                  {memberItems.length > 0 && <SectionLabel label="Fitur" />}
                  {featureResults.map((item, i) => (
                    <button key={item.id}
                      onClick={() => go(item)}
                      onMouseEnter={() => setSelected(i)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: i === selected ? 'var(--accent)' : 'none',
                        transition: 'background 0.08s',
                      }}
                    >
                      <span style={{ width: 20, height: 20, flexShrink: 0, display: 'flex',
                        color: i === selected ? 'color-mix(in srgb, var(--text) 85%, transparent)' : 'var(--text-muted)' }}>
                        {ICONS[item.id] ?? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        )}
                      </span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500,
                        color: i === selected ? '#fff' : 'var(--text)' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 11,
                        color: i === selected ? 'color-mix(in srgb, var(--text) 55%, transparent)' : 'var(--text-muted)' }}>
                        {item.section}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Members (hanya jika query ≥ 3 huruf) */}
              {memberItems.length > 0 && (
                <>
                  <SectionLabel label="Anggota" />
                  {memberItems.map((member, mi) => {
                    const idx     = featureResults.length + mi
                    const topRole = getHighestRole(member.roles ?? [])
                    const hex     = getRoleOrgUnit(topRole)?.colorHex ?? 'var(--accent)'
                    const studio  = member.roles?.find(r => r.studio)?.studio
                    const isSel   = idx === selected
                    return (
                      <button key={member.id}
                        onClick={() => go(member)}
                        onMouseEnter={() => setSelected(idx)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '9px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                          background: isSel ? 'var(--accent)' : 'none',
                          transition: 'background 0.08s',
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: member.fotoUrl ? 'none' : alfa(hex, 13),
                          border: `2px solid ${alfa(hex, 33)}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: hex, overflow: 'hidden',
                        }}>
                          {member.fotoUrl
                            ? <img src={member.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : initials(member.nama)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600,
                            color: isSel ? '#fff' : 'var(--text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.nama}
                          </div>
                          <div style={{ fontSize: 11,
                            color: isSel ? 'color-mix(in srgb, var(--text) 65%, transparent)' : 'var(--text-muted)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {topRole ? getRoleLabel(topRole.roleType) : ''}
                            {studio ? ` · ${studio.nama}` : ''}
                          </div>
                        </div>
                        {member.nomorWa && (
                          <span style={{ fontSize: 11, flexShrink: 0,
                            color: isSel ? 'color-mix(in srgb, var(--text) 55%, transparent)' : 'var(--text-muted)',
                            fontVariantNumeric: 'tabular-nums' }}>
                            {member.nomorWa}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>↑↓ navigasi</span>
          <span>↵ buka</span>
          <span>Esc tutup</span>
        </div>
      </div>
    </div>
  )
}
