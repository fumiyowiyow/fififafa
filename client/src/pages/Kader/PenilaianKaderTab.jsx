import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatTanggalPendek } from '../../utils/format'

// Skala berjangkar (anchored) -- SAMA di semua 9 dimensi, biar mentor beda studio nilai dari
// acuan yang sama (bukan angka 1-5 polos yang beda makna antar penilai).
const LABEL_SKOR = { 1: 'Jauh di Bawah Harapan', 2: 'Di Bawah Harapan', 3: 'Sesuai Harapan', 4: 'Di Atas Harapan', 5: 'Istimewa' }
const WARNA_SKOR = (n) => n >= 4 ? 'var(--green)' : n >= 3 ? 'var(--amber)' : 'var(--red)'

const KATEGORI = [
  { nama: 'Kehadiran & Kedisiplinan', fields: [
    { key: 'skorKehadiran', label: 'Kehadiran' },
    { key: 'skorKetepatanWaktu', label: 'Ketepatan Deadline' },
  ] },
  { nama: 'Adab & Karakter', fields: [
    { key: 'skorAdab', label: 'Adab' },
    { key: 'skorKejujuran', label: 'Kejujuran & Integritas' },
    { key: 'skorMenerimaMasukan', label: 'Menerima Masukan' },
  ] },
  { nama: 'Kompetensi Teknis', fields: [
    { key: 'skorKualitasKerja', label: 'Kualitas Hasil Kerja' },
    { key: 'skorPenguasaanSkill', label: 'Penguasaan Skill/Tools' },
  ] },
  { nama: 'Kolaborasi & Inisiatif', fields: [
    { key: 'skorInisiatif', label: 'Inisiatif' },
    { key: 'skorKerjaSama', label: 'Kerja Sama Tim' },
  ] },
]
const ALL_FIELDS = KATEGORI.flatMap(k => k.fields)

const EMPTY_FORM = {
  tanggalPenilaian: new Date().toISOString().split('T')[0],
  catatan: '',
  perkembangan: '',
  pencapaian: '',
  kendala: '',
  targetMingguDepan: '',
  ...Object.fromEntries(ALL_FIELDS.map(f => [f.key, 3])),
}

function SkorButtons({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: WARNA_SKOR(value) }}>{value} — {LABEL_SKOR[value]}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button type="button" key={n} onClick={() => onChange(n)}
            style={{
              flex: 1, height: 32, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: value === n ? WARNA_SKOR(n) : 'var(--bg-input)',
              color: value === n ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${value === n ? WARNA_SKOR(n) : 'var(--border)'}`,
            }}>{n}</button>
        ))}
      </div>
    </div>
  )
}

function rataRata(entry) {
  return ALL_FIELDS.reduce((s, f) => s + entry[f.key], 0) / ALL_FIELDS.length
}

export default function PenilaianKaderTab({ userId, autoOpenForm, onAutoOpened }) {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // isMentor (bukan cuma isFullAdmin) -- server (canEditEntry di controller) sebenarnya juga
  // ngizinin KOORDINATOR/PENDAMPING yang jadi mentor kader ini edit/hapus, bukan cuma admin
  // penuh. Client gak punya data scope studio/circle target buat cek persis kayak server, jadi
  // tombol ditampilin buat semua role mentor lalu server yang jadi otoritas akhir (403 kalau
  // ternyata di luar scope-nya, ditangani lewat error state yang sudah ada).
  const isMentor = user?.roles?.some(r => ['ADVISOR', 'KOORDINATOR', 'PENDAMPING', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'KEPALA_EKOSISTEM'].includes(r.roleType))
  const canManage = (p) => isMentor || p.penilaiId === user?.id

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/penilaian-kader/${userId}`)
      setList(res.data.data ?? [])
    } catch { setList([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  // Dipicu dari tombol "+ Nilai" di Ringkasan Performa -- langsung buka form tanpa perlu klik
  // "+ Penilaian Baru" lagi. onAutoOpened() WAJIB dipanggil segera setelah dipakai supaya parent
  // reset flag-nya ke false -- kalau enggak, form bisa kebuka lagi sendiri tiap kali tab ini
  // di-unmount/mount ulang (pindah tab lalu balik) atau pas ganti kader lewat panel kiri, padahal
  // flag itu cuma dimaksudkan buat sekali pakai dari tombol "+ Nilai".
  useEffect(() => {
    if (autoOpenForm) {
      openAdd()
      onAutoOpened?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, autoOpenForm])

  const openEdit = (p) => {
    setEditItem(p)
    setForm({
      tanggalPenilaian: p.tanggalPenilaian.split('T')[0],
      catatan: p.catatan ?? '',
      perkembangan: p.perkembangan ?? '',
      pencapaian: p.pencapaian ?? '',
      kendala: p.kendala ?? '',
      targetMingguDepan: p.targetMingguDepan ?? '',
      ...Object.fromEntries(ALL_FIELDS.map(f => [f.key, p[f.key]])),
    })
    setError('')
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { ...form, userId }
      if (editItem) {
        await api.patch(`/api/penilaian-kader/${editItem.id}`, payload)
      } else {
        await api.post('/api/penilaian-kader', payload)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Hapus penilaian ini? Data tidak bisa dikembalikan.')) return
    try {
      await api.delete(`/api/penilaian-kader/${id}`)
      load()
    } catch (err) { alert(err.response?.data?.message || 'Gagal menghapus') }
  }

  return (
    <div>
      {!showForm && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={openAdd}>+ Penilaian Baru</button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">{editItem ? 'Edit Penilaian' : 'Penilaian Baru'}</span>
          </div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="form-group" style={{ maxWidth: 220 }}>
              <label className="form-label">Tanggal Penilaian *</label>
              <input type="date" className="form-input" style={{ paddingLeft: 10 }}
                value={form.tanggalPenilaian}
                onChange={e => setForm(f => ({ ...f, tanggalPenilaian: e.target.value }))} required />
            </div>

            {KATEGORI.map(kat => (
              <div key={kat.nama} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {kat.nama}
                </div>
                {kat.fields.map(f => (
                  <SkorButtons key={f.key} label={f.label} value={form[f.key]}
                    onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} />
                ))}
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Naratif (opsional)
              </div>
              <div className="form-group">
                <label className="form-label">Perkembangan</label>
                <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 70, resize: 'vertical' }}
                  placeholder="Ceritakan perkembangan kader periode ini..."
                  value={form.perkembangan} onChange={e => setForm(f => ({ ...f, perkembangan: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Pencapaian</label>
                <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 60, resize: 'vertical' }}
                  placeholder="Apa yang sudah dicapai..."
                  value={form.pencapaian} onChange={e => setForm(f => ({ ...f, pencapaian: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Kendala</label>
                <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 60, resize: 'vertical' }}
                  placeholder="Hambatan atau tantangan yang dihadapi..."
                  value={form.kendala} onChange={e => setForm(f => ({ ...f, kendala: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Periode Depan</label>
                <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 60, resize: 'vertical' }}
                  placeholder="Apa yang ingin dicapai periode depan..."
                  value={form.targetMingguDepan} onChange={e => setForm(f => ({ ...f, targetMingguDepan: e.target.value }))} />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">Catatan lain-lain (opsional)</label>
              <textarea className="form-input" style={{ paddingLeft: 14, paddingTop: 10, minHeight: 60, resize: 'vertical' }}
                placeholder="Catatan tambahan di luar 9 skor & naratif di atas..."
                value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} />
            </div>

            {error && <div className="login-error">{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 120 }}>
                {saving ? <><span className="spinner" />Menyimpan...</> : 'Simpan'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>Memuat...</div>
      ) : list.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          Belum ada penilaian untuk anggota ini
        </div>
      ) : list.map(p => {
        const rata = rataRata(p)
        return (
          <div key={p.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatTanggalPendek(p.tanggalPenilaian)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Dinilai oleh: {p.penilai?.nama}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: WARNA_SKOR(rata) }}>
                  {rata.toFixed(1)} · {p.label}
                </span>
                {canManage(p) && (<>
                  <button onClick={() => openEdit(p)}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => remove(p.id)}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', background: 'var(--red-subtle)', color: 'var(--red)', cursor: 'pointer' }}>
                    Hapus
                  </button>
                </>)}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_FIELDS.map(f => (
                <span key={f.key} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 20,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{f.label} </span>
                  <span style={{ fontWeight: 700, color: WARNA_SKOR(p[f.key]) }}>{p[f.key]}</span>
                </span>
              ))}
            </div>
            {(p.perkembangan || p.pencapaian || p.kendala || p.targetMingguDepan) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {p.perkembangan && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Perkembangan</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{p.perkembangan}</div></div>}
                {p.pencapaian && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pencapaian</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{p.pencapaian}</div></div>}
                {p.kendala && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kendala</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{p.kendala}</div></div>}
                {p.targetMingguDepan && <div><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Periode Depan</span><div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{p.targetMingguDepan}</div></div>}
              </div>
            )}
            {p.catatan && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>{p.catatan}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
