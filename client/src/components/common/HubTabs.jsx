// Bar tab untuk halaman hub (Keuangan, SDM) -- satu menu di sidebar, beberapa halaman lama jadi
// tab (13 Okt 2026, pola rumahpara.app/playgroundecos.app). tabs: [{ id, label, badge? }],
// badges: objek badge dari App.jsx (badge tab = badges[tab.badge]). Tab TURUN BARIS (wrap), bukan
// digeser ke samping -- di layar sempit tab yang tersembunyi di balik scroll gak ketemu user.
export default function HubTabs({ tabs, aktif, onPilih, badges = {}, label }) {
  if (tabs.length <= 1) return null
  return (
    <div role="tablist" aria-label={label}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, maxWidth: '100%', width: 'fit-content' }}>
      {tabs.map(t => {
        const on = aktif === t.id
        const jumlah = t.badge ? badges[t.badge] : null
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onPilih(t.id)}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: on ? 'var(--bg-card)' : 'none', color: on ? 'var(--text)' : 'var(--text-secondary)',
              boxShadow: on ? '0 1px 4px rgba(0,0,0,0.15)' : 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t.label}
            {jumlah ? <span className="nav-badge" style={{ marginLeft: 0 }}>{jumlah}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
