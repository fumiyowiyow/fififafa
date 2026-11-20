import { useState, useMemo, Fragment } from 'react'
import { useApi } from '../../hooks/useApi'
import { formatTanggalPendek } from '../../utils/format'
import { TIER_BADGE } from '../../utils/roles'

const WARNA_SKOR = (n) => n >= 4 ? 'var(--green)' : n >= 3 ? 'var(--amber)' : 'var(--red)'
const BULAN_PENDEK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// Flag "perlu penanganan khusus" -- dihitung server (penilaianKader.js: getSkorRingkasan), pola
// prioritas sama: menurun (paling butuh tindakan) > rendah konsisten > belum dipantau.
const FLAG_BADGE = {
  menurun:           { label: '📉 Menurun',          cls: 'danger' },
  rendah_konsisten:  { label: '⚠️ Rendah Konsisten',  cls: 'warning' },
  belum_dipantau:    { label: '🚫 Belum Dipantau',    cls: 'info' },
}

// 3 titik kecil, satu per bulan (lama -> baru), warna ngikutin WARNA_SKOR atau abu-abu kalau
// bulan itu gak ada penilaian sama sekali -- sekilas pandang langsung kelihatan pola naik/turun.
function TrenMini({ riwayat3Bulan }) {
  if (!riwayat3Bulan?.length) return null
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
      {riwayat3Bulan.map(r => (
        <div key={`${r.tahun}-${r.bulan}`}
          title={`${BULAN_PENDEK[r.bulan - 1]} ${r.tahun}: ${r.rataRata != null ? r.rataRata.toFixed(1) : 'belum dinilai'}`}
          style={{
            width: 10, height: 10, borderRadius: 3,
            background: r.rataRata != null ? WARNA_SKOR(r.rataRata) : 'var(--border)',
            opacity: r.rataRata != null ? 1 : 0.5,
          }} />
      ))}
    </div>
  )
}

const SORT_OPTIONS = [
  ['nama', 'Nama (A-Z)'],
  ['skorAsc', 'Skor Terendah Dulu'],
  ['skorDesc', 'Skor Tertinggi Dulu'],
  ['terlama', 'Paling Lama Belum Dinilai'],
  ['terbaru', 'Baru Dinilai Duluan'],
]

// Ambang tier SAMA PERSIS dengan WARNA_SKOR (dan labelSkor server yang pakai Math.floor) --
// >=4 selalu "Di Atas Harapan"/"Istimewa", 3-3.99 selalu "Sesuai Harapan", <3 selalu "Di Bawah
// Harapan"/"Jauh di Bawah Harapan". Dengan ambang yang konsisten, kader gak pernah nyasar ke
// grup yang gak sesuai label anchor-nya sendiri.
const TIERS = [
  { key: 'istimewa',  label: '🏆 Istimewa & Di Atas Harapan', match: k => k.rataRata != null && k.rataRata >= 4,                    color: 'var(--green)' },
  { key: 'sesuai',    label: 'Sesuai Harapan',                match: k => k.rataRata != null && k.rataRata >= 3 && k.rataRata < 4,  color: 'var(--amber)' },
  { key: 'perhatian', label: '⚠️ Perlu Perhatian',            match: k => k.rataRata != null && k.rataRata < 3,                     color: 'var(--red)' },
  { key: 'belum',     label: 'Belum Dinilai',                 match: k => k.rataRata == null,                                       color: 'var(--text-muted)' },
]

// Tabel ringkasan performa semua kader dalam scope caller -- niru struktur StatusGrid.jsx (Status
// Laporan di halaman Laporan Omset): summary cards di atas + tabel desktop/kartu mobile, klik baris
// buka detail kader langsung ke tab Penilaian Kader, atau tombol "+ Nilai" langsung buka form.
export default function RingkasanPerforma({ onSelectKader, onQuickNilai }) {
  const { data, loading } = useApi('/api/penilaian-kader/skor-ringkasan')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua') // 'semua' | 'sudah' | 'belum'
  const [studioFilter, setStudioFilter] = useState('Semua')
  const [tierFilter, setTierFilter] = useState('semua') // 'semua' | 'tetap' | 'karyawan' | 'magang'
  const [flagFilter, setFlagFilter] = useState('semua') // 'semua' | 'khusus' | 'menurun' | 'rendah_konsisten' | 'belum_dipantau'
  const [sortBy, setSortBy] = useState('nama')
  const [viewMode, setViewMode] = useState('peringkat') // 'peringkat' | 'tabel'

  const allStudios = useMemo(() => {
    const names = [...new Set((data ?? []).map(k => k.studio).filter(Boolean))]
    return ['Semua', ...names.sort()]
  }, [data])

  const kaderTerfilter = useMemo(() => {
    const list = (data ?? []).filter(k =>
      (!search || k.nama.toLowerCase().includes(search.toLowerCase())) &&
      (statusFilter === 'semua' || (statusFilter === 'sudah' ? k.sudahDinilaiBulanIni : !k.sudahDinilaiBulanIni)) &&
      (studioFilter === 'Semua' || k.studio === studioFilter) &&
      (tierFilter === 'semua' || k.tier === tierFilter) &&
      (flagFilter === 'semua' || (flagFilter === 'khusus' ? k.flagKhusus != null : k.flagKhusus === flagFilter))
    )
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'skorAsc':  return (a.rataRata ?? -1) - (b.rataRata ?? -1)
        case 'skorDesc': return (b.rataRata ?? -1) - (a.rataRata ?? -1)
        case 'terlama':  return (a.tanggalTerakhir ? new Date(a.tanggalTerakhir) : new Date(0)) - (b.tanggalTerakhir ? new Date(b.tanggalTerakhir) : new Date(0))
        case 'terbaru':  return (b.tanggalTerakhir ? new Date(b.tanggalTerakhir) : new Date(0)) - (a.tanggalTerakhir ? new Date(a.tanggalTerakhir) : new Date(0))
        default: return a.nama.localeCompare(b.nama)
      }
    })
    return sorted
  }, [data, search, statusFilter, studioFilter, tierFilter, flagFilter, sortBy])

  // Peringkat GLOBAL (lintas tier) -- cuma kader yang sudah punya skor yang dapat nomor/medali,
  // biar #1 beneran berarti "skor tertinggi se-ekosistem dalam scope ini", bukan sekadar nomor
  // urut lokal per grup.
  const rankMap = useMemo(() => {
    const dinilai = kaderTerfilter.filter(k => k.rataRata != null).sort((a, b) => b.rataRata - a.rataRata)
    return new Map(dinilai.map((k, i) => [k.userId, i + 1]))
  }, [kaderTerfilter])

  const groups = useMemo(() => TIERS
    .map(t => ({
      ...t,
      items: kaderTerfilter.filter(t.match).sort((a, b) => (b.rataRata ?? 0) - (a.rataRata ?? 0) || a.nama.localeCompare(b.nama)),
    }))
    .filter(g => g.items.length > 0), [kaderTerfilter])

  const semua = data ?? []
  const dinilai = semua.filter(k => k.rataRata != null)
  const rataRataEkosistem = dinilai.length ? dinilai.reduce((a, k) => a + k.rataRata, 0) / dinilai.length : null
  const belumBulanIni = semua.filter(k => !k.sudahDinilaiBulanIni).length
  const perluPenangananKhusus = semua.filter(k => k.flagKhusus != null).length

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Rata-rata Ekosistem', val: rataRataEkosistem != null ? rataRataEkosistem.toFixed(1) : '—', color: 'purple' },
          { label: 'Belum Dinilai Bulan Ini', val: `${belumBulanIni}/${semua.length} orang`, color: belumBulanIni > 0 ? 'amber' : 'green' },
          { label: 'Perlu Penanganan Khusus (3 bulan)', val: perluPenangananKhusus > 0 ? `${perluPenangananKhusus} orang` : '—', color: perluPenangananKhusus > 0 ? 'red' : 'default' },
        ].map((c, i) => (
          <div key={c.label} className={`stat-card ${c.color}`}
            onClick={() => {
              // Klik salah satu kartu = aktifkan filter kartu itu, reset filter cepat lainnya --
              // kartu "Rata-rata Ekosistem" (i===0) jadi tombol reset semua filter cepat sekaligus.
              setStatusFilter(i === 1 ? 'belum' : 'semua')
              setFlagFilter(i === 2 ? 'khusus' : 'semua')
            }}
            style={{ cursor: 'pointer' }}
            title={
              i === 0 ? 'Klik untuk reset filter cepat (status/penanganan khusus)'
              : i === 1 ? 'Klik untuk filter yang belum dinilai bulan ini'
              : 'Klik untuk filter yang perlu ditangani: menurun, rendah konsisten, atau belum dipantau 3 bulan'
            }>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: 17 }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Cari anggota..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', width: 200 }} />
        <select className="form-input" style={{ padding: '7px 12px', width: 200 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="semua">Semua Status</option>
          <option value="sudah">✓ Sudah Dinilai Bulan Ini</option>
          <option value="belum">✗ Belum Dinilai Bulan Ini</option>
        </select>
        <select className="form-input" style={{ padding: '7px 12px', width: 180 }}
          value={studioFilter} onChange={e => setStudioFilter(e.target.value)}>
          {allStudios.map(s => <option key={s} value={s}>{s === 'Semua' ? 'Semua Studio' : s}</option>)}
        </select>
        <select className="form-input" style={{ padding: '7px 12px', width: 170 }}
          value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          <option value="semua">Semua Tier</option>
          {Object.entries(TIER_BADGE).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
        </select>
        <select className="form-input" style={{ padding: '7px 12px', width: 210 }}
          value={flagFilter} onChange={e => setFlagFilter(e.target.value)}>
          <option value="semua">Semua (Tren 3 Bulan)</option>
          <option value="khusus">⚡ Perlu Penanganan Khusus</option>
          {Object.entries(FLAG_BADGE).map(([key, f]) => <option key={key} value={key}>{f.label}</option>)}
        </select>
        {viewMode === 'tabel' && (
          <select className="form-input" style={{ padding: '7px 12px', width: 200 }}
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 8, padding: 3 }}>
          {[['peringkat', '🏆 Peringkat'], ['tabel', '☰ Tabel']].map(([key, label]) => (
            <button key={key} onClick={() => setViewMode(key)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: viewMode === key ? 'var(--accent)' : 'transparent',
                color: viewMode === key ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
          {kaderTerfilter.length} dari {semua.length} anggota
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      ) : viewMode === 'peringkat' ? (
        <div className="card">
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Tidak ada anggota ditemukan</div>
          ) : (
            // Satu tabel padat, dikelompokkan per tier lewat baris header (pola sama persis
            // dengan "Omset & Kas Studio" di Dashboard: GroupHeader + DataRows), BUKAN kartu
            // bertumpuk satu-satu -- lebih hemat halaman buat list ~100+ orang.
            <div className="table-wrap" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table className="table-sticky-2" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', minWidth: 820 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 44, overflow: 'hidden', textOverflow: 'ellipsis' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>Nama</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>Studio</th>
                    <th style={{ textAlign: 'center', padding: '6px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 95, overflow: 'hidden', textOverflow: 'ellipsis' }}>Tier</th>
                    <th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 78, overflow: 'hidden', textOverflow: 'ellipsis' }}>Skor</th>
                    <th style={{ textAlign: 'center', padding: '6px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>Tren 3 Bulan</th>
                    <th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 92, overflow: 'hidden', textOverflow: 'ellipsis' }}>Terakhir</th>
                    <th style={{ textAlign: 'right', padding: '6px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, width: 88, overflow: 'hidden', textOverflow: 'ellipsis' }}>Bln Ini</th>
                    <th style={{ width: 70 }} />
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <Fragment key={g.key}>
                      <tr>
                        <td colSpan={9} style={{
                          padding: '8px 8px 4px',
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: g.color, background: 'var(--bg-surface)', borderBottom: `2px solid ${g.color}`,
                        }}>{g.label} · {g.items.length} orang</td>
                      </tr>
                      {g.items.map(k => {
                        const rank = rankMap.get(k.userId)
                        return (
                          <tr key={k.userId} style={{ borderBottom: '1px solid var(--border-subtle, color-mix(in srgb, var(--text) 4%, transparent))' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontSize: 11 }}>{rank ?? '—'}</td>
                            <td onClick={() => onSelectKader?.(k.userId)} title={k.nama}
                              style={{ padding: '7px 8px', fontWeight: 600, cursor: onSelectKader ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.nama}</td>
                            <td onClick={() => onSelectKader?.(k.userId)} title={k.studio ?? ''}
                              style={{ padding: '7px 8px', fontSize: 12, color: 'var(--text-secondary)', cursor: onSelectKader ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.studio ?? '—'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                              {k.tier && <span className={`badge ${TIER_BADGE[k.tier].cls}`} style={{ fontSize: 10 }}>{TIER_BADGE[k.tier].label}</span>}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                              {k.rataRata != null ? (
                                <span style={{ fontWeight: 800, color: g.color }}>{k.rataRata.toFixed(1)}</span>
                              ) : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>belum dinilai</span>}
                            </td>
                            <td style={{ padding: '7px 8px' }}>
                              <TrenMini riwayat3Bulan={k.riwayat3Bulan} />
                              {k.flagKhusus && (
                                <div style={{ textAlign: 'center', marginTop: 3 }}>
                                  <span className={`badge ${FLAG_BADGE[k.flagKhusus].cls}`} style={{ fontSize: 9, padding: '1px 6px' }}>{FLAG_BADGE[k.flagKhusus].label}</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                              {k.tanggalTerakhir ? formatTanggalPendek(k.tanggalTerakhir) : '—'}
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                              {k.sudahDinilaiBulanIni
                                ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Sudah</span>
                                : <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>✗ Belum</span>
                              }
                            </td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {onQuickNilai && (
                                <button onClick={() => onQuickNilai(k.userId)}
                                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent)', color: 'var(--on-accent)', cursor: 'pointer', fontWeight: 600 }}>
                                  + Nilai
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          {/* Tabel -- sama di semua ukuran layar (scroll horizontal di layar sempit), gak
              switch ke kartu bertumpuk kayak halaman lain. Pola sama kayak Dashboard. */}
          <div className="table-wrap" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table style={{ tableLayout: 'fixed', minWidth: 800 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th style={{ width: 150, padding: '10px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>Nama</th>
                  <th style={{ width: 110, padding: '10px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>Studio</th>
                  <th style={{ width: 90, padding: '10px 6px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tier</th>
                  <th style={{ width: 78, padding: '10px 6px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>Skor</th>
                  <th style={{ width: 110, padding: '10px 6px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tren 3 Bulan</th>
                  <th style={{ width: 92, padding: '10px 6px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>Terakhir</th>
                  <th style={{ width: 88, padding: '10px 6px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>Bln Ini</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {kaderTerfilter.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Tidak ada anggota ditemukan</td></tr>
                )}
                {kaderTerfilter.map(k => (
                  <tr key={k.userId}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td onClick={() => onSelectKader?.(k.userId)} title={k.nama}
                      style={{ fontWeight: 600, cursor: onSelectKader ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.nama}</td>
                    <td onClick={() => onSelectKader?.(k.userId)} title={k.studio ?? ''}
                      style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: onSelectKader ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.studio ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {k.tier && <span className={`badge ${TIER_BADGE[k.tier].cls}`} style={{ fontSize: 10 }}>{TIER_BADGE[k.tier].label}</span>}
                    </td>
                    <td onClick={() => onSelectKader?.(k.userId)} style={{ textAlign: 'center', cursor: onSelectKader ? 'pointer' : 'default' }}>
                      {k.rataRata != null ? (
                        <span style={{ fontWeight: 800, color: WARNA_SKOR(k.rataRata) }}>{k.rataRata.toFixed(1)}</span>
                      ) : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>belum dinilai</span>}
                    </td>
                    <td>
                      <TrenMini riwayat3Bulan={k.riwayat3Bulan} />
                      {k.flagKhusus && (
                        <div style={{ textAlign: 'center', marginTop: 3 }}>
                          <span className={`badge ${FLAG_BADGE[k.flagKhusus].cls}`} style={{ fontSize: 9, padding: '1px 6px' }}>{FLAG_BADGE[k.flagKhusus].label}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {k.tanggalTerakhir ? formatTanggalPendek(k.tanggalTerakhir) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {k.sudahDinilaiBulanIni
                        ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Sudah</span>
                        : <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>✗ Belum</span>
                      }
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {onQuickNilai && (
                        <button onClick={() => onQuickNilai(k.userId)}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--accent)', color: 'var(--on-accent)', cursor: 'pointer', fontWeight: 600 }}>
                          + Nilai
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
