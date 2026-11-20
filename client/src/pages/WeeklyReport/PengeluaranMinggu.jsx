import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { formatRp } from '../../utils/format'

// ── Pengeluaran per item dalam satu periode laporan ─────
// Satu sumber pengeluaran (13 Okt 2026): koordinator mencatat tiap item di sini, total mingguan
// di laporan dihitung server dari item-item ini (server/src/utils/pengeluaran.js) -- gak ada lagi
// isian "total pengeluaran" yang diketik di form Omset maupun modal Update Kas.
// Dipasang di dalam <form> lain, jadi semua tombol type="button" dan Enter gak boleh submit form luar.

// Mengikuti kode posting di Jurnal Keuangan unit (4 Nov 2026).
export const KATEGORI_PENGELUARAN = [
  { key: 'BIAYA_USAHA',         label: 'Biaya Usaha' },
  { key: 'BIAYA_ADM_BANK',      label: 'Biaya Adm Bank & Pajak Bunga' },
  { key: 'BIAYA_RUMAH_TANGGA',  label: 'Biaya Rumah Tangga' },
  { key: 'BIAYA_PULSA',         label: 'Biaya Pulsa Telepon' },
  { key: 'BIAYA_PERLENGKAPAN',  label: 'Biaya Perlengkapan & Peralatan' },
  { key: 'BIAYA_ENTERTAINMENT', label: 'Biaya Entertainment' },
  { key: 'BIAYA_OPERASIONAL',   label: 'Biaya Operational' },
  { key: 'LAIN_LAIN',           label: 'Pengeluaran Lain-lain' },
  { key: 'INFAQ',               label: 'Infaq' },
]
// Kategori lama: item yang sudah tercatat tetap tampil dengan label lama dan bisa diedit.
const KATEGORI_LAMA = [
  { key: 'BIAYA_GAJI',   label: 'Biaya Gaji & Uang Makan (lama)' },
  { key: 'SHU',          label: 'SHU (lama)' },
  { key: 'THR',          label: 'THR (lama)' },
  { key: 'OPERASIONAL',  label: 'Operasional (lama)' },
  { key: 'BEBAN_ORANG',  label: 'Beban Orang (lama)' },
  { key: 'SUBSCRIPTION', label: 'Subscription (lama)' },
  { key: 'SUPPORT',      label: 'Support System (lama)' },
  { key: 'LAINNYA',      label: 'Lainnya (lama)' },
]
export const LABEL_KATEGORI = Object.fromEntries([...KATEGORI_PENGELUARAN, ...KATEGORI_LAMA].map(k => [k.key, k.label]).concat([['DATA_LAMA', 'Data lama']]))
const LABEL = LABEL_KATEGORI

const fmtTgl = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function tanggalDefault(awal, akhir) {
  const d = new Date()
  const hariIni = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (hariIni < awal) return awal
  if (hariIni > akhir) return akhir
  return hariIni
}

export default function PengeluaranMinggu({ studioId, periodeAwal, periodeAkhir, canEdit = true, onTotalChange }) {
  const [items, setItems]   = useState(null) // null = memuat
  const [baru, setBaru]     = useState({ tanggal: tanggalDefault(periodeAwal, periodeAkhir), kategori: 'BIAYA_OPERASIONAL', nama: '', jumlah: '' })
  const [sibuk, setSibuk]   = useState(false)
  const [error, setError]   = useState(null)
  const [peringatan, setPeringatan] = useState(null)
  const [edit, setEdit]     = useState(null) // { id, tanggal, kategori, nama, jumlah } saat satu item sedang diubah

  const muat = useCallback(() => {
    if (!studioId || !periodeAwal || !periodeAkhir) { setItems([]); return }
    api.get('/api/pengeluaran', { params: { studioId, dari: periodeAwal, sampai: periodeAkhir } })
      .then(res => setItems(res.data.data ?? []))
      .catch(() => { setItems([]); setError('Gagal memuat pengeluaran') })
  }, [studioId, periodeAwal, periodeAkhir])

  useEffect(() => {
    setItems(null); setError(null)
    setBaru(b => ({ ...b, tanggal: tanggalDefault(periodeAwal, periodeAkhir) }))
    muat()
  }, [muat, periodeAwal, periodeAkhir])

  const total = (items ?? []).reduce((a, i) => a + i.jumlah, 0)
  useEffect(() => { if (items) onTotalChange?.(total) }, [items, total, onTotalChange])

  const tambah = async () => {
    if (!baru.nama.trim()) return setError('Nama pengeluaran wajib diisi')
    if (!(Number(baru.jumlah) > 0)) return setError('Jumlah wajib lebih dari 0')
    setSibuk(true); setError(null)
    try {
      const resp = await api.post('/api/pengeluaran', { studioId, ...baru, jumlah: Number(baru.jumlah) })
      setPeringatan(resp?.data?.peringatan ?? null)
      setBaru(b => ({ ...b, nama: '', jumlah: '' }))
      muat()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mencatat pengeluaran')
    } finally { setSibuk(false) }
  }

  const hapus = async (item) => {
    if (!window.confirm(`Hapus pengeluaran "${item.nama}" (${formatRp(item.jumlah)})?`)) return
    setSibuk(true); setError(null)
    try {
      await api.delete(`/api/pengeluaran/${item.id}`)
      muat()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus')
    } finally { setSibuk(false) }
  }

  const mulaiEdit = (i) => {
    setError(null)
    setEdit({ id: i.id, tanggal: String(i.tanggal).slice(0, 10), kategori: i.kategori, nama: i.nama, jumlah: String(i.jumlah) })
  }

  const simpanEdit = async () => {
    if (!edit.nama.trim()) return setError('Nama pengeluaran wajib diisi')
    if (!(Number(edit.jumlah) > 0)) return setError('Jumlah wajib lebih dari 0')
    setSibuk(true); setError(null)
    try {
      const { id, ...badan } = edit
      await api.put(`/api/pengeluaran/${id}`, { ...badan, jumlah: Number(badan.jumlah) })
      setEdit(null)
      muat()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan')
    } finally { setSibuk(false) }
  }

  // Hapus total lama tanpa rincian (baris baca-saja dari server, bukan item tersimpan).
  const hapusTotalLama = async (item) => {
    if (!window.confirm(`Hapus total lama ${formatRp(item.jumlah)} (tanpa rincian) di minggu ini? Pengeluaran minggu ini jadi Rp 0.`)) return
    setSibuk(true); setError(null)
    try {
      await api.delete('/api/pengeluaran/total-lama', { params: { studioId, periodeAwal: String(item.tanggal).slice(0, 10) } })
      muat()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus total lama')
    } finally { setSibuk(false) }
  }

  const enterTambah = (e) => { if (e.key === 'Enter') { e.preventDefault(); tambah() } }

  if (!studioId) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pilih studio dulu untuk mencatat pengeluaran.</div>
  }

  return (
    <div>
      {items === null ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}><span className="spinner" /> Memuat…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Belum ada pengeluaran tercatat di periode ini.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {items.map(i => (edit && edit.id === i.id ? (
            <div key={i.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: 'end', padding: 8, borderRadius: 8, background: 'var(--bg-surface)' }}>
              <input type="date" className="form-input" style={{ paddingLeft: 10 }} min={periodeAwal} max={periodeAkhir}
                value={edit.tanggal} onChange={e => setEdit(v => ({ ...v, tanggal: e.target.value }))} aria-label="Tanggal" />
              {i.kategori === 'DATA_LAMA'
                ? <input className="form-input" style={{ paddingLeft: 10 }} value="Data lama" disabled aria-label="Kategori" />
                : <select className="form-input" style={{ paddingLeft: 10 }} value={edit.kategori}
                    onChange={e => setEdit(v => ({ ...v, kategori: e.target.value }))} aria-label="Kategori">
                    {KATEGORI_LAMA.some(k => k.key === i.kategori) && <option value={i.kategori}>{LABEL[i.kategori]}</option>}
                    {KATEGORI_PENGELUARAN.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>}
              <input className="form-input" style={{ paddingLeft: 10 }} value={edit.nama}
                onChange={e => setEdit(v => ({ ...v, nama: e.target.value }))} aria-label="Nama pengeluaran" />
              <input type="number" min="0" className="form-input" style={{ paddingLeft: 10 }} value={edit.jumlah}
                onChange={e => setEdit(v => ({ ...v, jumlah: e.target.value }))} aria-label="Jumlah" />
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={simpanEdit} disabled={sibuk}>Simpan</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setEdit(null); setError(null) }} disabled={sibuk}>Batal</button>
              </div>
            </div>
          ) : (
            <div key={i.id ?? `tanpa-rincian-${i.tanggal}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-surface)' }}>
              <span style={{ width: 52, flexShrink: 0, color: 'var(--text-muted)', fontSize: 12 }}>{fmtTgl(i.tanggal)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text)' }}>{i.nama}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> · {LABEL[i.kategori] ?? i.kategori}</span>
                {i.tanpaRincian && (
                  <span style={{ display: 'block', color: 'var(--amber)', fontSize: 11 }}>
                    Total lama tanpa rincian. Tekan Hapus untuk menghapusnya, atau catat item di minggu ini dan angka ini otomatis jadi satu item "Data lama" yang bisa dikoreksi.
                  </span>
                )}
              </span>
              <strong style={{ whiteSpace: 'nowrap' }}>{formatRp(i.jumlah)}</strong>
              {canEdit && (
                <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!i.tanpaRincian && (
                    <button type="button" className="btn btn-ghost" onClick={() => mulaiEdit(i)} disabled={sibuk}
                      style={{ padding: '2px 8px', fontSize: 12 }} aria-label={`Edit ${i.nama}`}>Edit</button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => (i.tanpaRincian ? hapusTotalLama(i) : hapus(i))} disabled={sibuk}
                    style={{ padding: '2px 8px', fontSize: 12, color: 'var(--red)' }} aria-label={`Hapus ${i.nama}`}>Hapus</button>
                </span>
              )}
            </div>
          )))}
        </div>
      )}

      {canEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: 'end' }}>
          <input type="date" className="form-input" style={{ paddingLeft: 10 }} min={periodeAwal} max={periodeAkhir}
            value={baru.tanggal} onChange={e => setBaru(b => ({ ...b, tanggal: e.target.value }))} aria-label="Tanggal" />
          <select className="form-input" style={{ paddingLeft: 10 }} value={baru.kategori}
            onChange={e => setBaru(b => ({ ...b, kategori: e.target.value }))} aria-label="Kategori">
            {KATEGORI_PENGELUARAN.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <input className="form-input" style={{ paddingLeft: 10 }} placeholder="Nama, mis. Listrik"
            value={baru.nama} onChange={e => setBaru(b => ({ ...b, nama: e.target.value }))} onKeyDown={enterTambah} aria-label="Nama pengeluaran" />
          <input type="number" min="0" className="form-input" style={{ paddingLeft: 10 }} placeholder="Jumlah (Rp)"
            value={baru.jumlah} onChange={e => setBaru(b => ({ ...b, jumlah: e.target.value }))} onKeyDown={enterTambah} aria-label="Jumlah" />
          <button type="button" className="btn btn-ghost" onClick={tambah} disabled={sibuk}>+ Tambah</button>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{error}</div>}
      {peringatan && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>⚠️ {peringatan}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)' }}>Total pengeluaran periode ini</span>
        <strong>{formatRp(total)}</strong>
      </div>
    </div>
  )
}
