import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import PayrollTab from './PayrollTab'
import RateCardTab from './RateCardTab'
import LemburTab from './LemburTab'

const TABS = [
  { id: 'payroll', label: '💰 Payroll' },
  { id: 'rate-card', label: '📋 Rate Card Lembur' },
  { id: 'lembur', label: '🕒 Catatan Lembur' },
]

const MANAGER_ROLES = ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL', 'KOORDINATOR', 'PENDAMPING']

// Menu SDM (sejajar Koperasi) -- BUKAN bagian dari menu Produksi walau sama-sama modul
// "Produksi" secara backend/schema. Halaman ini tetap terbuka buat SEMUA role (bukan cuma
// manager) -- non-manager cuma lihat baris payroll miliknya sendiri, read-only (lihat
// PayrollTab.jsx canManage prop + server getPenggajianList yang udah nyaring dari sisi API).
export default function Payroll() {
  const { user } = useAuth()
  const { data: studios } = useApi('/api/kanban/studios')

  const isEkosistemAdmin = ['ADVISOR', 'KEPALA_EKOSISTEM'].some(r => user?.roles?.some(ur => ur.roleType === r))

  const myStudios = user?.roles
    ?.filter(r => MANAGER_ROLES.includes(r.roleType) && r.studio)
    ?.map(r => r.studio) ?? []

  const canManage = (studioId) => isEkosistemAdmin || myStudios.some(s => s.id === studioId)

  const selectableStudios = isEkosistemAdmin
    ? (studios ?? [])
    : (studios ?? []).filter(s => user?.roles?.some(r => r.studioId === s.id))

  const [activeTab, setActiveTab] = useState('payroll')
  const [studioId, setStudioId] = useState(selectableStudios[0]?.id ?? myStudios[0]?.id ?? '')

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Payroll</h1>
            <p>Penggajian &amp; THP per studio</p>
          </div>
          <select className="form-input" style={{ paddingLeft: 10, width: 220 }}
            value={studioId} onChange={e => setStudioId(e.target.value)}>
            <option value="">— Pilih Studio —</option>
            {selectableStudios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
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
      </div>

      {activeTab === 'payroll' && (
        <PayrollTab studioId={studioId} canManage={canManage(studioId)} currentUserId={user?.id} />
      )}
      {activeTab === 'rate-card' && (
        <RateCardTab studioId={studioId} canManage={canManage(studioId)} />
      )}
      {activeTab === 'lembur' && (
        <LemburTab studioId={studioId} canManage={canManage(studioId)} onGoToRateCard={() => setActiveTab('rate-card')} />
      )}
    </>
  )
}
