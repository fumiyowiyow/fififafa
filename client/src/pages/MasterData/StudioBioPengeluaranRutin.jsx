import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'
import LabelJalur from '../../components/common/LabelJalur'

// ── StudioBioModal section: Pengeluaran Rutin Bulanan + CPM ──
// CPM ("Cost Per Month") bukan lagi diisi manual (dulu Studio.cpmTarget, satu angka USD) --
// sekarang = SUM(THP semua anggota, lihat section Anggota Studio) + SUM(item di sini)
// + SHU (lihat section Kepemilikan Saham). Kategori dibatasi 3 (Subscription/Support/Lainnya),
// item di dalamnya bebas ditambah/edit/hapus per studio. Template default ("Dana Forum",
// "Dana Gerakan", "Iuran JRUHub", dll) bisa diisi sekali klik -- nominalnya ke-3 item itu
// konsisten persis sama di beberapa contoh breakdown manual koordinator, kelihatannya emang
// iuran tetap se-ekosistem.

const KATEGORI_LIST  = ['SUPPORT', 'SUBSCRIPTION', 'LAINNYA']
const KATEGORI_LABEL = { SUPPORT: 'Support System', SUBSCRIPTION: 'Subscription/Langganan', LAINNYA: 'Lainnya' }

export default function StudioBioPengeluaranRutin({ studioId, canEdit }) {
  const [items, setItems]     = useState([])
  const [cpm, setCpm]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const [editingItem, setEditingItem] = useState(null) // null = gak ada form, 'new' = tambah, id = edit
  const [form, setForm]       = useState({ kategori: 'SUPPORT', nama: '', jumlah: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving]   = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/masterdata/studios/${studioId}/pengeluaran-rutin`)
      setItems(res.data.data.items ?? [])
      setCpm(res.data.data.cpm ?? null)
    } catch { /* silent — 403 kalau bukan admin studio/circle ini */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchData()
  }, [studioId])

  const openAdd = (kategori) => {
    setEditingItem('new')
    setForm({ kategori, nama: '', jumlah: '' })
    setFormError('')
  }

  const openEdit = (item) => {
    setEditingItem(item.id)
    setForm({ kategori: item.kategori, nama: item.nama, jumlah: String(item.jumlah) })
    setFormError('')
  }

  const saveItem = async () => {
    if (!form.nama.trim()) return setFormError('Nama wajib diisi')
    const jml = Number(form.jumlah)
    if (form.jumlah === '' || Number.isNaN(jml) || jml < 0) return setFormError('Jumlah wajib angka >= 0')
    setSaving(true); setFormError('')
    try {
      if (editingItem === 'new') {
        await api.post(`/api/masterdata/studios/${studioId}/pengeluaran-rutin`, {
          kategori: form.kategori, nama: form.nama.trim(), jumlah: jml,
        })
      } else {
        await api.put(`/api/masterdata/studios/${studioId}/pengeluaran-rutin/${editingItem}`, {
          kategori: form.kategori, nama: form.nama.trim(), jumlah: jml,
        })
      }
      setEditingItem(null)
      fetchData()
    } catch (e) {
      setFormError(e.response?.data?.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const hapusItem = async (item) => {
    if (!window.confirm(`Hapus "${item.nama}" (${formatRp(item.jumlah)}) dari pengeluaran rutin?`)) return
    try {
      await api.delete(`/api/masterdata/studios/${studioId}/pengeluaran-rutin/${item.id}`)
      fetchData()
    } catch { /* silent */ }
  }

  const seedDefault = async () => {
    setSeeding(true)
    try {
      await api.post(`/api/masterdata/studios/${studioId}/pengeluaran-rutin/seed-default`)
      fetchData()
    } catch { /* silent */ }
    finally { setSeeding(false) }
  }

  if (loading) {
    return (
      <div style={{ marginTop: 24, textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>
        <span className="spinner" style={{ display: 'inline-block', width: 16, height: 16 }} />
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Biaya rutin bulanan (CPM) <LabelJalur jenis="resmi" style={{ marginLeft: 4 }} /></div>
        {canEdit && items.length === 0 && (
          <span className="card-action" onClick={seedDefault} style={{ opacity: seeding ? 0.6 : 1 }}>
            {seeding ? 'Mengisi…' : '+ Isi Template Default'}
          </span>
        )}
      </div>

      {/* Ringkasan CPM -- THP + Pengeluaran Rutin + SHU, dihitung server-side (utils/cpm.js) */}
      {cpm && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8, margin: '8px 0 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>THP Anggota: <b style={{ color: 'var(--text)' }}>{formatRp(cpm.totalThp)}</b></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+ Biaya rutin: <b style={{ color: 'var(--text)' }}>{formatRp(cpm.totalPengeluaranRutin)}</b></div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+ SHU: <b style={{ color: 'var(--text)' }}>{formatRp(cpm.totalShu)}</b></div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-light)', marginLeft: 'auto' }}>
            Total CPM: {formatRp(cpm.totalCpm)}
          </div>
        </div>
      )}

      {KATEGORI_LIST.map(kategori => {
        const kategoriItems = items.filter(i => i.kategori === kategori)
        const subtotal = kategoriItems.reduce((a, i) => a + i.jumlah, 0)
        return (
          <div key={kategori} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {KATEGORI_LABEL[kategori]}
                {kategoriItems.length > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', marginLeft: 6 }}>
                    ({formatRp(subtotal)})
                  </span>
                )}
              </div>
              {canEdit && editingItem !== 'new' && (
                <span className="card-action" style={{ fontSize: 11 }} onClick={() => openAdd(kategori)}>+ Tambah</span>
              )}
            </div>

            {kategoriItems.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>Belum ada item</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kategoriItems.map(item => (
                  <div key={item.id}>
                    {editingItem === item.id ? (
                      <ItemForm form={form} setForm={setForm} formError={formError} saving={saving}
                        onSave={saveItem} onCancel={() => setEditingItem(null)} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'var(--bg-surface)', borderRadius: 8 }}>
                        <div style={{ flex: 1, fontSize: 13 }}>{item.nama}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{formatRp(item.jumlah)}</div>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <span className="card-action" style={{ fontSize: 11 }} onClick={() => openEdit(item)}>Edit</span>
                            <span className="card-action" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => hapusItem(item)}>Hapus</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editingItem === 'new' && form.kategori === kategori && (
              <div style={{ marginTop: 6 }}>
                <ItemForm form={form} setForm={setForm} formError={formError} saving={saving}
                  onSave={saveItem} onCancel={() => setEditingItem(null)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ItemForm({ form, setForm, formError, saving, onSave, onCancel }) {
  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8, flexWrap: 'wrap' }}>
      <input className="form-input" style={{ flex: 2, minWidth: 140, padding: '6px 10px', fontSize: 12 }}
        placeholder="Nama item" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
      <input type="number" min="0" className="form-input" style={{ flex: 1, minWidth: 110, padding: '6px 10px', fontSize: 12 }}
        placeholder="Jumlah (Rp)" value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} />
      <button className="btn btn-primary" disabled={saving} style={{ padding: '6px 12px', fontSize: 12 }} onClick={onSave}>
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
      <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onCancel}>Batal</button>
      {formError && <div style={{ fontSize: 11, color: 'var(--red)', width: '100%' }}>{formError}</div>}
    </div>
  )
}
