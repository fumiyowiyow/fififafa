import { useState, useMemo } from 'react'
import { useApi } from '../../hooks/useApi'
import { useIsMobile } from '../../hooks/useIsMobile'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'

const MONTHS  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAYS    = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

const TIPE_CONFIG = {
  ULANG_TAHUN:       { label: 'Ulang Tahun',        icon: '🎂', bg: 'color-mix(in srgb, var(--pink) 15%, transparent)',  color: 'var(--pink)' },
  DEADLINE_PRODUKSI: { label: 'Deadline Produksi',  icon: '📦', bg: 'color-mix(in srgb, var(--cyan) 15%, transparent)',   color: 'var(--cyan)' },
  DEADLINE_GOAL:     { label: 'Deadline Goal',       icon: '🎯', bg: 'color-mix(in srgb, var(--accent) 15%, transparent)',  color: 'var(--accent)' },
  REKRUTMEN:         { label: 'Rekrutmen',           icon: '👤', bg: 'rgba(234,88,12,0.15)',   color: '#EA580C' },
  EVENT_KADER:       { label: 'Event Kader',         icon: '📝', bg: 'color-mix(in srgb, var(--cyan) 15%, transparent)',   color: 'var(--cyan)' },
}

function getDaysInMonth(bulan, tahun) {
  return new Date(tahun, bulan, 0).getDate()
}

function DayDetailHeader({ selected, bulan, tahun, count, onClose }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>
          {selected} {MONTHS[bulan-1]} {tahun}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {count} event
        </div>
      </div>
      <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
    </div>
  )
}

function DayDetailList({ evts }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
      {evts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Tidak ada event hari ini
        </div>
      ) : evts.map(ev => {
        const cfg = TIPE_CONFIG[ev.tipe]
        return (
          <div key={ev.id} style={{
            padding: '10px 12px', borderRadius: 10,
            background: cfg?.bg ?? 'var(--bg-surface)',
            borderLeft: `3px solid ${cfg?.color ?? 'var(--text-muted)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{cfg?.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg?.color ?? 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg?.label}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
              {ev.judul}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.detail}</div>
          </div>
        )
      })}
    </div>
  )
}

function getFirstDayOfMonth(bulan, tahun) {
  const d = new Date(tahun, bulan - 1, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

export default function Calendar() {
  const now = new Date()
  const isMobile = useIsMobile()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())
  const [selected, setSelected] = useState(null)
  const [filterTipe, setFilterTipe] = useState('all')

  const { data: events, loading } = useApi(
    `/api/calendar?bulan=${bulan}&tahun=${tahun}`,
    [bulan, tahun]
  )

  const filtered = useMemo(() => {
    if (!events) return []
    return filterTipe === 'all' ? events : events.filter(e => e.tipe === filterTipe)
  }, [events, filterTipe])

  // Group events by date string
  const byDate = useMemo(() => {
    const map = {}
    for (const ev of filtered) {
      const d = new Date(ev.tanggal)
      const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [filtered])

  const daysInMonth  = getDaysInMonth(bulan, tahun)
  const firstDay     = getFirstDayOfMonth(bulan, tahun)
  const today        = now.getDate()
  const isThisMonth  = now.getMonth() + 1 === bulan && now.getFullYear() === tahun

  const selectedKey  = selected ? `${tahun}-${bulan}-${selected}` : null
  const selectedEvts = selectedKey ? (byDate[selectedKey] ?? []) : []

  const prev = () => { if (bulan === 1) { setBulan(12); setTahun(t => t-1) } else setBulan(b => b-1); setSelected(null) }
  const next = () => { if (bulan === 12) { setBulan(1); setTahun(t => t+1) } else setBulan(b => b+1); setSelected(null) }

  // Total per tipe untuk summary
  const tipeCount = useMemo(() => {
    const c = {}
    for (const ev of (events ?? [])) c[ev.tipe] = (c[ev.tipe] ?? 0) + 1
    return c
  }, [events])

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
        gap: isMobile ? 12 : 0, marginBottom: 20,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Kalender Ekosistem</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Deadline, laporan, event, dan milestone {ECOSYSTEM_NAME}
          </p>
        </div>

        {/* Nav bulan */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          justifyContent: isMobile ? 'space-between' : 'flex-start',
        }}>
          <button onClick={prev} className="btn btn-ghost" aria-label="Bulan sebelumnya" style={{ padding: '8px 12px' }}>←</button>
          <div style={{ textAlign: 'center', minWidth: isMobile ? 0 : 160, flex: isMobile ? 1 : 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{MONTHS[bulan-1]}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tahun}</div>
          </div>
          <button onClick={next} className="btn btn-ghost" aria-label="Bulan berikutnya" style={{ padding: '8px 12px' }}>→</button>
          {!isMobile && (
            <button onClick={() => { setBulan(now.getMonth()+1); setTahun(now.getFullYear()); setSelected(null) }}
              className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }}>
              Hari Ini
            </button>
          )}
        </div>
        {isMobile && (
          <button onClick={() => { setBulan(now.getMonth()+1); setTahun(now.getFullYear()); setSelected(null) }}
            className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 12px' }}>
            Hari Ini
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilterTipe('all')}
          style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filterTipe === 'all' ? 'var(--accent-subtle)' : 'var(--bg-surface)',
            color: filterTipe === 'all' ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
          Semua ({(events ?? []).length})
        </button>
        {Object.entries(TIPE_CONFIG).map(([key, cfg]) => {
          const count = tipeCount[key] ?? 0
          if (!count) return null
          return (
            <button key={key} onClick={() => setFilterTipe(filterTipe === key ? 'all' : key)}
              style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filterTipe === key ? cfg.bg : 'var(--bg-surface)',
                color: filterTipe === key ? cfg.color : 'var(--text-secondary)' }}>
              {cfg.icon} {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="two-col-layout-auto">
        {/* Grid Kalender */}
        <div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
            {/* Empty cells */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} style={{ minHeight: 80 }} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const key   = `${tahun}-${bulan}-${day}`
              const evts  = byDate[key] ?? []
              const isToday = isThisMonth && day === today
              const isSel   = selected === day

              return (
                <div key={day}
                  onClick={() => setSelected(isSel ? null : day)}
                  style={{
                    minHeight: 80, borderRadius: 10, padding: 8, cursor: 'pointer',
                    border: `1px solid ${isSel ? 'var(--accent)' : isToday ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)'}`,
                    background: isSel ? 'var(--accent-subtle)' : isToday ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'var(--bg-card)',
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isToday ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'var(--bg-card)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 13, fontWeight: isToday ? 800 : 500,
                      color: isToday ? 'var(--accent-light)' : 'var(--text)',
                      width: 22, height: 22, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: isToday ? 'var(--accent-subtle)' : 'transparent',
                    }}>{day}</span>
                    {evts.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                        {evts.length}
                      </span>
                    )}
                  </div>

                  {/* Event dots */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {evts.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{
                        fontSize: 10, padding: '2px 5px', borderRadius: 4,
                        background: TIPE_CONFIG[ev.tipe]?.bg ?? 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
                        color: TIPE_CONFIG[ev.tipe]?.color ?? 'var(--text-muted)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontWeight: 600,
                      }}>
                        {TIPE_CONFIG[ev.tipe]?.icon} {ev.judul}
                      </div>
                    ))}
                    {evts.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 4 }}>
                        +{evts.length - 3} lagi
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel detail hari (desktop — nempel di samping grid) */}
        {selected && !isMobile && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <DayDetailHeader selected={selected} bulan={bulan} tahun={tahun} count={selectedEvts.length} onClose={() => setSelected(null)} />
            <DayDetailList evts={selectedEvts} />
          </div>
        )}
      </div>

      {/* Popup detail hari (mobile — muncul langsung kayak Google Calendar, gak perlu scroll) */}
      {selected && isMobile && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" style={{ padding: 0, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <DayDetailHeader selected={selected} bulan={bulan} tahun={tahun} count={selectedEvts.length} onClose={() => setSelected(null)} />
            <DayDetailList evts={selectedEvts} />
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-muted)',
          boxShadow: 'var(--shadow-sm)' }}>
          <div className="spinner" style={{ width: 16, height: 16 }} />
          Memuat kalender…
        </div>
      )}
    </>
  )
}
