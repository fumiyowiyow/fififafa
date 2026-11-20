import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { onActivate } from '../../utils/a11y'
import { ROLE_LABEL, studioInitials } from './constants'
import { alfa } from '../../utils/warna'

// ── Tab Struktur Tim (org-chart Circle/Rumah Usaha → Studio → Anggota) ──
// Dulu halaman "Direktori Tim" sendiri -- dipindah ke sini karena nol data sendiri, cuma
// nampilin ulang Circle/RumahUsaha/Studio/UserRole yang sudah dikelola di tab-tab lain halaman
// ini juga.

function StrukturAvatar({ user, size = 32 }) {
  if (user?.fotoUrl) return (
    <img src={user.fotoUrl} alt={user.nama}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {studioInitials(user?.nama)}
    </div>
  )
}

function StrukturMemberChip({ role }) {
  const u = role.user
  if (!u?.statusAktif) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', borderRadius: 8, padding: '6px 10px', border: '1px solid var(--border)' }}>
      <StrukturAvatar user={u} size={28} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{u.nama}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ROLE_LABEL[role.roleType] || role.roleType}</div>
      </div>
    </div>
  )
}

function StrukturStudioCard({ studio, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const memberRoles = studio.userRoles?.filter(r => r.user?.statusAktif) ?? []

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: 'var(--bg-card)' }}
        role="button" tabIndex={0} onKeyDown={onActivate(() => setOpen(o => !o))}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 4, padding: '1px 6px' }}>
            {studio.tipe}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{studio.nama}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({memberRoles.length} anggota)</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '10px 14px', background: 'var(--bg)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {memberRoles.length === 0
            ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada anggota</span>
            : memberRoles.map(r => <StrukturMemberChip key={r.id} role={r} />)
          }
        </div>
      )}
    </div>
  )
}

function StrukturOrgCard({ nama, colorHex, studios, isRumahUsaha }) {
  const [open, setOpen] = useState(true)
  const warna = colorHex || (isRumahUsaha ? 'var(--cyan)' : 'var(--accent)')
  const studioCount = studios?.length ?? 0
  const memberCount = studios?.reduce((s, st) => s + (st.userRoles?.filter(r => r.user?.statusAktif).length ?? 0), 0) ?? 0

  return (
    <div style={{ border: `2px solid ${alfa(warna, 27)}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: alfa(warna, 9) }}
        role="button" tabIndex={0} onKeyDown={onActivate(() => setOpen(o => !o))}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: warna, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{isRumahUsaha && '🏠 '}{nama}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{studioCount} studio · {memberCount} anggota</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 16px' }}>
          {studioCount === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Belum ada studio</div>
            : studios.map((st, i) => <StrukturStudioCard key={st.id} studio={st} defaultOpen={i === 0} />)
          }
        </div>
      )}
    </div>
  )
}

export default function StrukturTimTab() {
  const { data, loading, error } = useApi('/api/direktori-tim')

  const circles    = data?.circles    ?? []
  const rumahUsaha = data?.rumahUsaha ?? []
  const ekoRoles   = data?.ekoRoles   ?? []

  const totalStudios = circles.reduce((s, c) => s + (c.studios?.length ?? 0), 0)
    + rumahUsaha.reduce((s, r) => s + (r.studios?.length ?? 0), 0)
  const countMembers = (list) => list.reduce((s, o) =>
    s + o.studios.reduce((ss, st) => ss + (st.userRoles?.filter(r => r.user?.statusAktif).length ?? 0), 0), 0)
  const totalMembers = countMembers(circles) + countMembers(rumahUsaha)

  return (
    <div style={{ maxWidth: 900 }}>
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Circle', value: circles.length, icon: '⭕' },
            { label: 'Rumah Usaha', value: rumahUsaha.length, icon: '🏠' },
            { label: 'Studio', value: totalStudios, icon: '🏢' },
            { label: 'Anggota Aktif', value: totalMembers, icon: '👥' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Memuat struktur tim...</div>}
      {error   && <div style={{ color: 'var(--red)', padding: 16 }}>{error}</div>}

      {!loading && ekoRoles.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Level Ekosistem
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ekoRoles.map(r => r.user?.statusAktif && <StrukturMemberChip key={r.id} role={r} />)}
          </div>
        </div>
      )}

      {!loading && circles.map(c => (
        <StrukturOrgCard key={c.id} nama={c.nama} colorHex={c.colorHex} studios={c.studios} />
      ))}
      {!loading && rumahUsaha.map(r => (
        <StrukturOrgCard key={r.id} nama={r.nama} colorHex={r.colorHex} studios={r.studios} isRumahUsaha />
      ))}
    </div>
  )
}
