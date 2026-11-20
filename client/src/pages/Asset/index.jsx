import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatTanggalPendek, formatRp } from '../../utils/format'
import ItemRingkas from '../../components/common/ItemRingkas'

const TIPE_CONFIG = {
  PERALATAN:        { label: 'Peralatan',        icon: '🔧', cls: 'info'    },
  SOFTWARE:         { label: 'Software',          icon: '💻', cls: 'purple'  },
  // Akun Marketplace (Fiverr/Etsy/dst) sekarang dicatat di Direktori Sosmed (bisa ada URL,
  // otorisasi Koordinator+, dll) -- tipe ini gak bisa dipilih lagi pas tambah aset baru, cuma
  // dipertahankan di sini biar baris lama yang belum sempat dipindah manual tetap tampil benar.
  AKUN_MARKETPLACE: { label: 'Akun Marketplace',  icon: '🛒', cls: 'success' },
}

const TIPE_OPTIONS_CREATE = ['PERALATAN', 'SOFTWARE']

const STATUS_CONFIG = {
  aktif:    { label: 'Aktif',   color: 'var(--green)' },
  nonaktif: { label: 'Nonaktif', color: 'var(--red)' },
  dipinjam: { label: 'Dipinjam', color: 'var(--amber)' },
}

export default function Asset() {
  const { data: studios }           = useApi('/api/kanban/studios')
  const { data: assets, loading, error, refetch } = useApi('/api/assets')
  const [filterTipe, setFilterTipe] = useState('all')
  const [filterStudio, setFilterStudio] = useState('all')
  const [showForm, setShowForm]     = useState(false)
  const FORM_KOSONG = { studioId: '', nama: '', tipe: 'SOFTWARE', keterangan: '', masaAktif: '', tanggalBeli: '', nilaiBeli: '' }
  const [form, setForm] = useState(FORM_KOSONG)
  const [editId, setEditId]         = useState(null)
  const [submitting, setSubmit]     = useState(false)
  const [formErr, setFormErr]       = useState('')
  const [actionErr, setActionErr]   = useState('')

  const filtered = (assets ?? []).filter(a => {
    const matchTipe   = filterTipe   === 'all' || a.tipe   === filterTipe
    const matchStudio = filterStudio === 'all' || a.studioId === filterStudio
    return matchTipe && matchStudio
  })

  // Group by studio
  const byStudio = filtered.reduce((acc, a) => {
    const key = a.studioId
    if (!acc[key]) acc[key] = { studio: a.studio, items: [] }
    acc[key].items.push(a)
    return acc
  }, {})

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmit(true); setFormErr('')
    try {
      if (editId) await api.patch(`/api/assets/${editId}`, form)
      else await api.post('/api/assets', form)
      tutupForm()
      refetch()
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Gagal menyimpan aset, coba lagi')
    }
    setSubmit(false)
  }

  // Nilai rupiah hanya dikirim server ke pengelola aset -- peran lain tak punya field-nya.
  const lihatNilai = (assets ?? []).some(a => 'nilaiBeli' in a)
  const jumlah = (daftar, k) => daftar.reduce((t, a) => t + (a[k] ?? 0), 0)
  // Di bawah Nilai Saat Ini: "70% dari harga beli", atau petunjuk apa yang kurang kalau belum bisa dihitung.
  const keteranganNilai = (a) => {
    if (a.persenNilai != null) return { teks: `${a.persenNilai}% dari harga beli`, merah: false }
    if (a.nilaiBeli != null && !a.tanggalBeli) return { teks: 'isi Tanggal Beli', merah: true }
    return null
  }

  // Ringkasan nilai (hanya pengelola aset): total keseluruhan, jumlah yang belum diisi, dan per circle.
  const belumBeli    = filtered.filter(a => a.nilaiBeli == null).length
  const belumSaatIni = filtered.filter(a => a.nilaiTerkini == null).length
  const perCircle = Object.values(filtered.reduce((acc, a) => {
    const org = a.studio?.circle ?? a.studio?.rumahUsaha ?? null
    const kunci = org?.nama ?? 'Tanpa Circle'
    const g = (acc[kunci] ??= { nama: kunci, warna: org?.colorHex ?? null, jumlah: 0, beli: 0, saatIni: 0 })
    g.jumlah += 1; g.beli += a.nilaiBeli ?? 0; g.saatIni += a.nilaiTerkini ?? 0
    return acc
  }, {})).sort((x, y) => y.saatIni - x.saatIni || y.beli - x.beli || x.nama.localeCompare(y.nama, 'id'))

  // Umur barang dari tanggal beli: "2 th 3 bln", "5 bln", atau "< 1 bln".
  const umurBarang = (tgl) => {
    if (!tgl) return null
    const d = new Date(tgl), n = new Date()
    let bln = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth())
    if (n.getDate() < d.getDate()) bln -= 1
    if (bln < 0) return null
    if (bln < 1) return '< 1 bln'
    const th = Math.floor(bln / 12), sisa = bln % 12
    return [th ? `${th} th` : null, sisa ? `${sisa} bln` : null].filter(Boolean).join(' ')
  }

  const tutupForm = () => { setShowForm(false); setEditId(null); setForm(FORM_KOSONG); setFormErr('') }

  const mulaiEdit = (a) => {
    setEditId(a.id)
    setForm({ studioId: a.studioId, nama: a.nama, tipe: a.tipe, keterangan: a.keterangan ?? '', masaAktif: a.masaAktif ? String(a.masaAktif).slice(0, 10) : '', tanggalBeli: a.tanggalBeli ? String(a.tanggalBeli).slice(0, 10) : '', nilaiBeli: a.nilaiBeli ?? '' })
    setFormErr(''); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleStatus = async (id, status) => {
    setActionErr('')
    try {
      await api.patch(`/api/assets/${id}`, { status })
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal mengubah status, coba lagi')
      refetch()
    }
  }

  const handleDelete = async (id, nama) => {
    if (!confirm(`Hapus aset "${nama}"?`)) return
    setActionErr('')
    try {
      await api.delete(`/api/assets/${id}`)
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal menghapus aset, coba lagi')
    }
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Aset & Inventaris</h1>
            <p>Peralatan dan software per studio</p>
          </div>
          <button className="btn btn-primary" onClick={() => (showForm ? tutupForm() : setShowForm(true))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {showForm ? 'Tutup' : 'Tambah Aset'}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">{editId ? 'Ubah Aset' : 'Aset Baru'}</span></div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Studio *</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.studioId} onChange={e => setForm(f => ({ ...f, studioId: e.target.value }))} required>
                  <option value="">— Pilih Studio —</option>
                  {studios?.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nama Aset *</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="misal: Adobe CC, MacBook Pro..."
                  value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Tipe *</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.tipe} onChange={e => setForm(f => ({ ...f, tipe: e.target.value }))}>
                  {(TIPE_OPTIONS_CREATE.includes(form.tipe) ? TIPE_OPTIONS_CREATE : [...TIPE_OPTIONS_CREATE, form.tipe]).map(k => <option key={k} value={k}>{TIPE_CONFIG[k].icon} {TIPE_CONFIG[k].label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Akun platform kerja (Fiverr/Etsy/dst) sekarang dicatat di Direktori Sosmed
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Keterangan</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="Username, versi, nomor seri, dll..."
                  value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal Beli</label>
                <input type="date" className="form-input" style={{ paddingLeft: 14 }} max={new Date().toISOString().slice(0, 10)}
                  value={form.tanggalBeli} onChange={e => setForm(f => ({ ...f, tanggalBeli: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Berlaku Sampai (garansi / langganan)</label>
                <input type="date" className="form-input" style={{ paddingLeft: 14 }}
                  value={form.masaAktif} onChange={e => setForm(f => ({ ...f, masaAktif: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Nilai Beli (Rp)</label>
                <input type="number" min="0" step="1" inputMode="numeric" className="form-input" style={{ paddingLeft: 14 }} placeholder="harga saat dibeli"
                  value={form.nilaiBeli} onChange={e => setForm(f => ({ ...f, nilaiBeli: e.target.value }))} />
              </div>
              <div className="form-group" style={{ alignSelf: 'end', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Nilai Saat Ini dihitung otomatis dari Nilai Beli dan Tanggal Beli: <strong>70%</strong> jika umur di bawah 1 tahun, <strong>50%</strong> jika sudah 1 tahun atau lebih.
              </div>
            </div>
            {formErr && <div className="login-error" style={{ marginBottom: 12 }}>{formErr}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 130 }}>
                {submitting ? <><span className="spinner"/>Menyimpan...</> : (editId ? 'Simpan Perubahan' : 'Tambah Aset')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={tutupForm}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {actionErr && <div className="login-error" style={{ marginBottom: 16 }}>{actionErr}</div>}

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {Object.entries(TIPE_CONFIG).map(([tipe, cfg]) => {
          const count = (assets ?? []).filter(a => a.tipe === tipe).length
          return (
            <div key={tipe} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>{cfg.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</div>
              </div>
            </div>
          )
        })}
        <div className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>📦</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{(assets ?? []).length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Aset</div>
          </div>
        </div>
        {lihatNilai && (
          <>
            <div className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>🧾</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{formatRp(jumlah(filtered, 'nilaiBeli'))}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Nilai Beli</div>
              </div>
            </div>
            <div className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>💰</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{formatRp(jumlah(filtered, 'nilaiTerkini'))}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Nilai Saat Ini</div>
              </div>
            </div>
          </>
        )}
      </div>

      {lihatNilai && filtered.length > 0 && (belumBeli > 0 || belumSaatIni > 0) && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 12.5, lineHeight: 1.5 }}>
          ⚠️ Total di atas baru menjumlahkan aset yang datanya lengkap:{' '}
          <strong>{belumBeli} dari {filtered.length}</strong> aset belum diisi Nilai Beli, dan{' '}
          <strong>{belumSaatIni} dari {filtered.length}</strong> belum bisa dihitung Nilai Saat Ini-nya (perlu Nilai Beli dan Tanggal Beli).
        </div>
      )}

      {lihatNilai && perCircle.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Nilai Aset per Circle</span></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Circle</th><th style={{ textAlign: 'right' }}>Aset</th><th style={{ textAlign: 'right' }}>Nilai Beli</th><th style={{ textAlign: 'right' }}>Nilai Saat Ini</th></tr>
              </thead>
              <tbody>
                {perCircle.map(g => (
                  <tr key={g.nama}>
                    <td style={{ fontWeight: 600 }}>
                      {g.warna && <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: g.warna, marginRight: 8 }} />}
                      {g.nama}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{g.jumlah}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>{formatRp(g.beli)}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap', fontWeight: 700 }}>{formatRp(g.saatIni)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 800 }}>{filtered.length}</td>
                  <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{formatRp(jumlah(filtered, 'nilaiBeli'))}</td>
                  <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{formatRp(jumlah(filtered, 'nilaiTerkini'))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`btn ${filterTipe === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => setFilterTipe('all')}>Semua Tipe</button>
        {Object.entries(TIPE_CONFIG).map(([k, v]) => (
          <button key={k} className={`btn ${filterTipe === k ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => setFilterTipe(k)}>{v.icon} {v.label}</button>
        ))}
        <div style={{ borderLeft: '1px solid var(--border)', margin: '0 4px' }} />
        <select className="form-input" style={{ paddingLeft: 10, fontSize: 12, height: 36, width: 180 }}
          value={filterStudio} onChange={e => setFilterStudio(e.target.value)}>
          <option value="all">Semua Studio</option>
          {studios?.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </div>

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* List grouped by studio */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
        </div>
      ) : Object.keys(byStudio).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada aset tercatat</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.values(byStudio).map(({ studio, items }) => (
            <div key={studio?.id ?? 'unknown'} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(studio?.circle ?? studio?.rumahUsaha) && (
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: (studio.circle ?? studio.rumahUsaha).colorHex, flexShrink: 0 }} />
                  )}
                  <span className="card-title">{studio?.nama ?? 'Unknown Studio'}</span>
                  <span className="badge info" style={{ fontSize: 10 }}>{items.length} aset</span>
                  {lihatNilai && <span className="badge success" style={{ fontSize: 10 }}>Nilai saat ini {formatRp(jumlah(items, 'nilaiTerkini'))}</span>}
                </div>
              </div>
              {/* Desktop: tabel */}
              <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <table>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr style={{ background: 'var(--bg-card)' }}>
                      <th>Nama</th>
                      <th>Tipe</th>
                      <th>Keterangan</th>
                      <th>Tanggal Beli</th>
                      <th>Berlaku Sampai</th>
                      {lihatNilai && <th style={{ textAlign: 'right' }}>Nilai Beli</th>}
                      {lihatNilai && <th style={{ textAlign: 'right' }}>Nilai Saat Ini</th>}
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(a => {
                      const tipeCfg   = TIPE_CONFIG[a.tipe]
                      const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.aktif
                      const isExpired = a.masaAktif && new Date(a.masaAktif) < new Date()
                      return (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600 }}>{a.nama}</td>
                          <td>
                            <span className={`badge ${tipeCfg.cls}`} style={{ fontSize: 10 }}>
                              {tipeCfg.icon} {tipeCfg.label}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.keterangan ?? '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {a.tanggalBeli ? formatTanggalPendek(a.tanggalBeli) : '—'}
                            {umurBarang(a.tanggalBeli) && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{umurBarang(a.tanggalBeli)}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: isExpired ? 'var(--red)' : 'var(--text-secondary)' }}>
                            {a.masaAktif ? `${isExpired ? '⚠️ ' : ''}${formatTanggalPendek(a.masaAktif)}` : '—'}
                          </td>
                          {lihatNilai && <td style={{ textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>{a.nilaiBeli != null ? formatRp(a.nilaiBeli) : '—'}</td>}
                          {lihatNilai && (
                            <td style={{ textAlign: 'right', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {a.nilaiTerkini != null ? formatRp(a.nilaiTerkini) : '—'}
                              {keteranganNilai(a) && <div style={{ fontSize: 10, color: keteranganNilai(a).merah ? 'var(--amber)' : 'var(--text-muted)' }}>{keteranganNilai(a).teks}</div>}
                            </td>
                          )}
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color }}>{statusCfg.label}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <select value={a.status}
                                onChange={e => handleStatus(a.id, e.target.value)}
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: 'var(--text)', fontSize: 11 }}>
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                              <button onClick={() => mulaiEdit(a)} title="Ubah aset" aria-label={`Ubah ${a.nama}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '2px 6px' }}>✏️</button>
                              <button onClick={() => handleDelete(a.id, a.nama)} title="Hapus aset" aria-label={`Hapus ${a.nama}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14, padding: '2px 6px' }}>×</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: list ringkas, ketuk baris untuk detail */}
              <div className="responsive-cards list-ringkas" style={{ margin: 12, maxHeight: '70vh', overflowY: 'auto' }}>
                {items.map(a => {
                  const tipeCfg   = TIPE_CONFIG[a.tipe]
                  const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.aktif
                  const isExpired = a.masaAktif && new Date(a.masaAktif) < new Date()
                  return (
                    <ItemRingkas key={a.id} judul={a.nama}
                      sub={`${tipeCfg.icon} ${tipeCfg.label}${isExpired ? ' · ⚠️ lewat masa berlaku' : ''}`}
                      nilai={lihatNilai && a.nilaiTerkini != null
                        ? formatRp(a.nilaiTerkini)
                        : <span style={{ fontSize: 11, color: statusCfg.color }}>{statusCfg.label}</span>}>
                      <div className="data-card-row">
                        <span className="data-card-label">Tipe</span>
                        <span className="data-card-value">
                          <span className={`badge ${tipeCfg.cls}`} style={{ fontSize: 10 }}>{tipeCfg.icon} {tipeCfg.label}</span>
                        </span>
                      </div>
                      <div className="data-card-row">
                        <span className="data-card-label">Keterangan</span>
                        <span className="data-card-value">{a.keterangan ?? '—'}</span>
                      </div>
                      <div className="data-card-row">
                        <span className="data-card-label">Tanggal Beli</span>
                        <span className="data-card-value">
                          {a.tanggalBeli ? formatTanggalPendek(a.tanggalBeli) : '—'}
                          {umurBarang(a.tanggalBeli) && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{umurBarang(a.tanggalBeli)}</span>}
                        </span>
                      </div>
                      <div className="data-card-row">
                        <span className="data-card-label">Berlaku Sampai</span>
                        <span className="data-card-value" style={{ color: isExpired ? 'var(--red)' : 'var(--text)' }}>
                          {a.masaAktif ? `${isExpired ? '⚠️ ' : ''}${formatTanggalPendek(a.masaAktif)}` : '—'}
                        </span>
                      </div>
                      {lihatNilai && (
                        <>
                          <div className="data-card-row">
                            <span className="data-card-label">Nilai Beli</span>
                            <span className="data-card-value">{a.nilaiBeli != null ? formatRp(a.nilaiBeli) : '—'}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Nilai Saat Ini</span>
                            <span className="data-card-value">
                              {a.nilaiTerkini != null ? formatRp(a.nilaiTerkini) : '—'}
                              {keteranganNilai(a) && <span style={{ display: 'block', fontSize: 11, color: keteranganNilai(a).merah ? 'var(--amber)' : 'var(--text-muted)' }}>{keteranganNilai(a).teks}</span>}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="data-card-row">
                        <span className="data-card-label">Status</span>
                        <span className="data-card-value">
                          <select value={a.status}
                            onChange={e => handleStatus(a.id, e.target.value)}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: statusCfg.color, fontSize: 11, fontWeight: 700 }}>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => mulaiEdit(a)}>✏️ Ubah</button>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px', color: 'var(--red)' }} onClick={() => handleDelete(a.id, a.nama)}>Hapus</button>
                      </div>
                    </ItemRingkas>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
