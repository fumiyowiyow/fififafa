import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'

// ── StudioBioModal section: Kepemilikan Saham + SHU ──────
// SHU — SATU angka tetap per studio ("fix ditentukan", bukan riwayat/dihitung dari kas).
// Jumlah tiap pemilik = totalShu * persenSaham/100, dihitung langsung, tidak disimpan sendiri.

export default function StudioBioKepemilikanShu({ studio, canEdit, users, onSaved }) {
  const [pemilik, setPemilik]           = useState([])
  const [loadingPemilik, setLoadingPemilik] = useState(true)
  const [showPemilikForm, setShowPemilikForm] = useState(false)
  const [editPemilikItem, setEditPemilikItem] = useState(null)
  const [pemilikForm, setPemilikForm]   = useState({ mode: 'existing', userId: '', namaBaru: '', persenSaham: '', keterangan: '' })
  const [pemilikError, setPemilikError] = useState('')
  const [pemilikSaving, setPemilikSaving] = useState(false)

  const [editingShu, setEditingShu]     = useState(false)
  const [shuForm, setShuForm]           = useState({ statusShu: studio.statusShu ?? false, totalShu: studio.totalShu != null ? String(studio.totalShu) : '0' })
  const [shuError, setShuError]         = useState('')
  const [shuSaving, setShuSaving]       = useState(false)
  const [statusShu, setStatusShu]       = useState(studio.statusShu ?? false)
  const [totalShu, setTotalShu]         = useState(studio.totalShu ?? 0)

  const totalPersenTerisi = pemilik.reduce((a, p) => a + p.persenSaham, 0)
  const sahamKosong = Math.max(0, 100 - totalPersenTerisi)
  // Kandidat pemilik = SEMUA user aktif (bukan cuma anggota studio ini — bisa investor murni
  // yang gak kerja di studio itu sama sekali), exclude yang sudah jadi pemilik (kecuali lagi
  // di-edit, biar user yang sedang diedit tetap muncul terpilih di dropdown).
  const pemilikCandidates = (users ?? []).filter(u =>
    u.id === editPemilikItem?.userId || !pemilik.some(p => p.userId === u.id)
  )

  const fetchPemilik = async () => {
    setLoadingPemilik(true)
    try {
      const res = await api.get(`/api/masterdata/studios/${studio.id}/pemilik`)
      setPemilik(res.data.data ?? [])
    } catch { /* silent */ }
    finally { setLoadingPemilik(false) }
  }

  useEffect(() => {
    fetchPemilik()
  }, [])

  const openAddPemilik = () => {
    setEditPemilikItem(null)
    setPemilikForm({ mode: 'existing', userId: '', namaBaru: '', persenSaham: '', keterangan: '' })
    setPemilikError('')
    setShowPemilikForm(true)
  }

  const openEditPemilik = (p) => {
    setEditPemilikItem(p)
    setPemilikForm({ mode: 'existing', userId: p.userId, namaBaru: '', persenSaham: String(p.persenSaham), keterangan: p.keterangan ?? '' })
    setPemilikError('')
    setShowPemilikForm(true)
  }

  const savePemilik = async () => {
    if (!editPemilikItem && pemilikForm.mode === 'existing' && !pemilikForm.userId) {
      return setPemilikError('Pilih orangnya dulu')
    }
    if (!editPemilikItem && pemilikForm.mode === 'baru' && !pemilikForm.namaBaru.trim()) {
      return setPemilikError('Nama wajib diisi')
    }
    if (pemilikForm.persenSaham === '' || Number.isNaN(Number(pemilikForm.persenSaham))) {
      return setPemilikError('Persentase saham wajib diisi angka')
    }
    setPemilikSaving(true); setPemilikError('')
    try {
      if (editPemilikItem) {
        await api.put(`/api/masterdata/studios/${studio.id}/pemilik/${editPemilikItem.id}`, {
          persenSaham: Number(pemilikForm.persenSaham),
          keterangan: pemilikForm.keterangan || null,
        })
      } else {
        // Orang baru buat kepemilikan saja (bukan staf) -- bikin akun shell dulu (tanpa role,
        // tanpa login) via onboard, baru nempelin StudioPemilik ke user id hasilnya.
        let userId = pemilikForm.userId
        if (pemilikForm.mode === 'baru') {
          const res = await api.post('/api/members', { nama: pemilikForm.namaBaru.trim() })
          userId = res.data.data.id
        }
        await api.post(`/api/masterdata/studios/${studio.id}/pemilik`, {
          userId,
          persenSaham: Number(pemilikForm.persenSaham),
          keterangan: pemilikForm.keterangan || null,
        })
      }
      setShowPemilikForm(false)
      fetchPemilik()
    } catch (e) {
      setPemilikError(e.response?.data?.message || 'Gagal menyimpan kepemilikan')
    } finally {
      setPemilikSaving(false)
    }
  }

  const hapusPemilik = async (p) => {
    if (!window.confirm(`Hapus kepemilikan ${p.user.nama} (${p.persenSaham}%) di studio ini?`)) return
    try {
      await api.delete(`/api/masterdata/studios/${studio.id}/pemilik/${p.id}`)
      fetchPemilik()
    } catch { /* silent */ }
  }

  const openEditShu = () => {
    setShuForm({ statusShu, totalShu: String(totalShu) })
    setShuError('')
    setEditingShu(true)
  }

  const saveShu = async () => {
    if (shuForm.totalShu === '' || Number.isNaN(Number(shuForm.totalShu)) || Number(shuForm.totalShu) < 0) {
      return setShuError('Total SHU wajib angka >= 0')
    }
    setShuSaving(true); setShuError('')
    try {
      await api.put(`/api/masterdata/studios/${studio.id}`, {
        statusShu: shuForm.statusShu,
        totalShu: Number(shuForm.totalShu),
      })
      setStatusShu(shuForm.statusShu)
      setTotalShu(Number(shuForm.totalShu))
      setEditingShu(false)
      // Studio list di halaman utama (MasterData) gak auto-refresh tanpa ini -- kalau modal
      // ditutup-buka lagi tanpa reload halaman, bisa balik nampilin data lama walau di database
      // sudah tersimpan (beda dari Info Dasar yang sudah benar panggil onSaved).
      onSaved?.()
    } catch (e) {
      setShuError(e.response?.data?.message || 'Gagal menyimpan SHU')
    } finally {
      setShuSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Kepemilikan Saham</div>
          {!loadingPemilik && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {totalPersenTerisi}% terisi
              {sahamKosong > 0 && <span> · <span style={{ color: 'var(--amber)' }}>{sahamKosong}% saham kosong</span></span>}
            </div>
          )}
        </div>
        {canEdit && (
          <span className="card-action" onClick={openAddPemilik}>+ Tambah Pemilik</span>
        )}
      </div>

      {/* SHU — satu angka tetap buat studio ini, dibagi ke tiap pemilik sesuai persentase */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          SHU: {statusShu ? (
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{formatRp(totalShu)}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>belum ada</span>
          )}
        </div>
        {canEdit && !editingShu && (
          <span className="card-action" onClick={openEditShu}>Edit SHU</span>
        )}
      </div>

      {editingShu && (
        <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input type="checkbox" id="statusShu" checked={shuForm.statusShu}
              onChange={e => setShuForm(f => ({ ...f, statusShu: e.target.checked }))} />
            <label htmlFor="statusShu" style={{ fontSize: 13 }}>Studio ini mengeluarkan SHU</label>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Total SHU (IDR)</label>
            <input type="number" min="0" className="form-input"
              value={shuForm.totalShu} onChange={e => setShuForm(f => ({ ...f, totalShu: e.target.value }))} placeholder="0" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Satu angka tetap, dibagi otomatis ke tiap pemilik sesuai persentase saham</span>
          </div>
          {shuError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{shuError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={shuSaving} onClick={saveShu}>
              {shuSaving ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditingShu(false)}>Batal</button>
          </div>
        </div>
      )}

      {showPemilikForm && (
        <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, marginBottom: 10 }}>
          {!editPemilikItem && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" className={pemilikForm.mode === 'existing' ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ fontSize: 12, padding: '5px 10px' }}
                onClick={() => setPemilikForm(f => ({ ...f, mode: 'existing' }))}>Orang yang sudah ada</button>
              <button type="button" className={pemilikForm.mode === 'baru' ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ fontSize: 12, padding: '5px 10px' }}
                onClick={() => setPemilikForm(f => ({ ...f, mode: 'baru' }))}>Orang baru (bukan staf)</button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {editPemilikItem || pemilikForm.mode === 'existing' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Orang</label>
                <select className="form-input" value={pemilikForm.userId} disabled={!!editPemilikItem}
                  onChange={e => setPemilikForm(f => ({ ...f, userId: e.target.value }))}>
                  <option value="">— Pilih —</option>
                  {pemilikCandidates.map(u => (
                    <option key={u.id} value={u.id}>{u.nama}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama</label>
                <input className="form-input" value={pemilikForm.namaBaru}
                  onChange={e => setPemilikForm(f => ({ ...f, namaBaru: e.target.value }))}
                  placeholder="Nama pemilik (investor murni, dibikinkan akun tanpa login)" />
              </div>
            )}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Persentase Saham (%)</label>
              <input type="number" min="0" max="100" step="0.5" className="form-input"
                value={pemilikForm.persenSaham} onChange={e => setPemilikForm(f => ({ ...f, persenSaham: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Keterangan (opsional)</label>
              <textarea className="form-input" style={{ minHeight: 44 }}
                value={pemilikForm.keterangan} onChange={e => setPemilikForm(f => ({ ...f, keterangan: e.target.value }))}
                placeholder="mis. Kader - Bisnis Rintisan" />
            </div>
          </div>
          {pemilikError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{pemilikError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={pemilikSaving} onClick={savePemilik}>
              {pemilikSaving ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowPemilikForm(false)}>Batal</button>
          </div>
        </div>
      )}

      {loadingPemilik ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ display: 'inline-block', width: 16, height: 16 }} />
        </div>
      ) : pemilik.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada pemilik tercatat
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pemilik.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.user.nama}</div>
                {p.keterangan && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.keterangan}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-light)' }}>{p.persenSaham}%</div>
                {statusShu && totalShu > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>{formatRp((totalShu * p.persenSaham) / 100)}</div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <span className="card-action" onClick={() => openEditPemilik(p)}>Edit</span>
                  <span className="card-action" style={{ color: 'var(--red)' }} onClick={() => hapusPemilik(p)}>Hapus</span>
                </div>
              )}
            </div>
          ))}
          {sahamKosong > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px dashed var(--border)' }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Saham Kosong</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-muted)' }}>{sahamKosong}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
