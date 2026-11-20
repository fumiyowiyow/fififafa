import { useState } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'

// Modal edit baris tunjangan SATU Penggajian -- tunjangan sekarang baris dinamis (bukan 5 kolom
// tetap lagi, lihat TunjanganPenggajian di schema), jadi diedit lewat endpoint terpisah per
// baris (PATCH/DELETE /api/payroll/tunjangan/:id), bukan dibundel ke PATCH /api/payroll/:id.
export default function TunjanganModal({ penggajian, onClose, onChanged }) {
  const [rows, setRows] = useState(penggajian.tunjangan ?? [])
  const [editValues, setEditValues] = useState(() => Object.fromEntries(rows.map(r => [r.id, String(r.jumlah)])))
  const [saving, setSaving] = useState(null)
  const [namaBaru, setNamaBaru] = useState('')
  const [jumlahBaru, setJumlahBaru] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [changed, setChanged] = useState(false)

  const saveJumlah = async (id) => {
    setSaving(id); setErr('')
    try {
      const res = await api.patch(`/api/payroll/tunjangan/${id}`, { jumlah: editValues[id] })
      setRows(rs => rs.map(r => r.id === id ? res.data.data : r))
      setChanged(true)
    } catch (e) {
      setErr(e.response?.data?.message || 'Gagal menyimpan')
    }
    setSaving(null)
  }

  const handleDelete = async (id) => {
    setErr('')
    try {
      await api.delete(`/api/payroll/tunjangan/${id}`)
      setRows(rs => rs.filter(r => r.id !== id))
      setChanged(true)
    } catch (e) {
      setErr(e.response?.data?.message || 'Gagal menghapus')
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true); setErr('')
    try {
      const res = await api.post(`/api/payroll/${penggajian.id}/tunjangan`, { nama: namaBaru, jumlah: jumlahBaru || 0 })
      setRows(rs => [...rs, res.data.data])
      setEditValues(v => ({ ...v, [res.data.data.id]: String(res.data.data.jumlah) }))
      setNamaBaru(''); setJumlahBaru('')
      setChanged(true)
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Gagal menambah')
    }
    setAdding(false)
  }

  const handleClose = () => { if (changed) onChanged?.(); onClose() }
  const total = rows.reduce((s, r) => s + r.jumlah, 0)

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Tunjangan — {penggajian.user?.nama}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Total: {formatRp(total)}</div>
          </div>
          <button className="modal-close" onClick={handleClose} aria-label="Tutup">✕</button>
        </div>

        {err && <div className="login-error" style={{ marginBottom: 12 }}>{err}</div>}

        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 18 }}>
            Belum ada baris tunjangan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {rows.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)' }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{r.nama}</div>
                <input type="number" min="0" className="form-input" style={{ width: 110, padding: '4px 8px', fontSize: 12 }}
                  value={editValues[r.id] ?? ''} onChange={e => setEditValues(v => ({ ...v, [r.id]: e.target.value }))} />
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }} disabled={saving === r.id} onClick={() => saveJumlah(r.id)}>Simpan</button>
                <button onClick={() => handleDelete(r.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14, padding: '2px 6px' }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Tambah Baris Tunjangan</div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ flex: 1, paddingLeft: 14 }} placeholder="Nama (mis. Kos)" required
              value={namaBaru} onChange={e => setNamaBaru(e.target.value)} />
            <input type="number" min="0" className="form-input" style={{ width: 120, paddingLeft: 14 }} placeholder="Jumlah"
              value={jumlahBaru} onChange={e => setJumlahBaru(e.target.value)} />
            <button type="submit" className="btn btn-primary" disabled={adding} style={{ minWidth: 90 }}>
              {adding ? <span className="spinner"/> : '+ Tambah'}
            </button>
          </form>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Tips: kelola jenis tunjangan tetap studio ini (Kos, Makan, dll) di bagian "Template Tunjangan" atas halaman -- otomatis muncul di sini tiap kali Generate Payroll.
          </div>
        </div>
      </div>
    </div>
  )
}
