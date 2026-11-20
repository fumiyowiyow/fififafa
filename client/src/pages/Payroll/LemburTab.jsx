import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp, formatTanggalPendek } from '../../utils/format'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const EMPTY_FORM = {
  userId: '', rateCardId: '', orderId: '', klien: '', briefName: '',
  tanggal: new Date().toISOString().slice(0, 10), progresAwal: '', progresAkhir: '',
}

// Tab "Catatan Lembur" -- ditaruh di halaman Payroll (bukan tombol per-order di Produksi) karena
// modul Payroll (route /api/payroll/*) sudah punya infrastruktur studio+bulan+tahun selector yang
// sama persis dibutuhkan di sini, dan CatatanLembur secara konsep adalah komponen Payroll (nanti
// diagregasi jadi field `lembur` di Penggajian lewat Generate) -- order cuma referensi OPSIONAL,
// bukan pemilik data. Akses endpoint-nya juga sama-sama STAFF_PLUS kayak endpoint payroll
// lain, beda dari halaman Produksi yang read-nya masih dibuka sampai KADER.

// Lembur dari PRESENSI web circle (menit setelah jam kerja). 21 Okt 2026: dihitung dengan ATURAN LEMBUR UNIT yang diatur koordinator di web circle
// (Kehadiran → Lembur unit) — per jam / bertingkat / per hari / tidak dibayar. Hanya lembur DISETUJUI milik unit ini yang masuk slip lewat "Generate".
const LABEL_MODE = { PER_JAM: 'per jam', BERTINGKAT: 'bertingkat', PER_HARI: 'per hari lembur', TIDAK_DIBAYAR: 'tidak dibayar' }
function LemburPresensi({ studioId, bulan, tahun }) {
  const { data, loading } = useApi(`/api/payroll/lembur-presensi?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}`, [studioId, bulan, tahun])
  const jam = (x) => `${x.jam} jam · ${x.hari} hari`
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><span className="card-title">Lembur dari presensi web circle</span></div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Menit kerja setelah jam resmi yang tercatat di presensi (otomatis dari jam pulang, atau dicatat manual). Berbeda dengan Catatan Lembur di bawah (progres × rate card), dan keduanya dijumlahkan di komponen Lembur slip.
        </div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          Aturan lembur unit: <b>{data?.mode ? LABEL_MODE[data.mode] ?? data.mode : 'belum diatur'}</b>{data?.mode === 'PER_JAM' && data?.tarifPerJam ? ` · Rp ${Number(data.tarifPerJam).toLocaleString('id-ID')}/jam` : ''}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> — diatur Koordinator unit di web circle (Kehadiran → Lembur unit), termasuk persetujuan lembur manual.</span>
        </div>
        {loading ? <div className="spinner" /> : !data?.orang?.length ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tidak ada lembur presensi pada periode ini.</div>
        ) : (
          <div className="table-wrap responsive-table">
            <table>
              <thead><tr><th>Nama</th><th>Total disetujui</th><th>Sudah masuk slip</th><th>Belum masuk slip</th><th>Menunggu persetujuan</th><th style={{ textAlign: 'right' }}>Estimasi belum masuk</th></tr></thead>
              <tbody>
                {data.orang.map(o => (
                  <tr key={o.userId}>
                    <td style={{ fontWeight: 600 }}>{o.nama}</td>
                    <td style={{ fontSize: 12 }}>{jam(o.total)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.sudahMasukSlip.menit ? jam(o.sudahMasukSlip) : '—'}</td>
                    <td style={{ fontSize: 12 }}>{o.belumMasukSlip.menit ? jam(o.belumMasukSlip) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.menungguPersetujuan ? `${o.menungguPersetujuan} catatan` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: data.otomatis ? 'var(--green)' : 'var(--text-muted)' }}>{data.otomatis ? formatRp(o.belumMasukSlip.uang) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.catatan && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{data.catatan}</div>}
      </div>
    </div>
  )
}

export default function LemburTab({ studioId, canManage, onGoToRateCard }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())

  const { data: lemburList, loading, error, refetch } = useApi(
    studioId ? `/api/payroll/lembur?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}` : null, [studioId, bulan, tahun]
  )
  const { data: members } = useApi(studioId ? `/api/members?studioId=${studioId}&limit=200` : null, [studioId])
  const { data: rateCardsRaw } = useApi(studioId ? `/api/payroll/rate-card?studioId=${studioId}` : null, [studioId])
  const { data: orders } = useApi(studioId ? `/api/payroll/order-opsi?studioId=${studioId}` : null, [studioId])

  // Penegakan UI-level di atas penegakan API yang udah ada (createLembur nolak 422 kalau rate
  // card nonaktif) -- combobox ini CUMA nampilin yang aktif=true, biar user gak sempat milih
  // opsi yang bakal ditolak server.
  const rateCardsAktif = (rateCardsRaw ?? []).filter(r => r.aktif)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true); setFormErr('')
    try {
      await api.post('/api/payroll/lembur', {
        ...form,
        orderId: form.orderId || undefined,
        klien: form.klien || undefined,
        briefName: form.briefName || undefined,
        // Form nampilin persen (0-100) ke user, API-nya minta pecahan 0-1.
        progresAwal: Number(form.progresAwal) / 100,
        progresAkhir: Number(form.progresAkhir) / 100,
      })
      setShowForm(false)
      setForm(EMPTY_FORM)
      refetch()
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Gagal mencatat lembur')
    }
    setSubmitting(false)
  }

  if (!studioId) {
    return <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Pilih studio dulu di atas</div>
  }

  return (
    <>
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ padding: '6px 10px', width: 100, fontSize: 13 }}
            value={bulan} onChange={e => setBulan(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="form-input" style={{ padding: '6px 10px', width: 90, fontSize: 13 }}
            value={tahun} onChange={e => setTahun(Number(e.target.value))} />
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)} disabled={!rateCardsAktif.length}>
            {showForm ? 'Tutup' : '+ Tambah Lembur'}
          </button>
        )}
      </div>

      {canManage && <LemburPresensi studioId={studioId} bulan={bulan} tahun={tahun} />}

      {/* Pesan selalu-terlihat (bukan cuma tooltip) -- pengganti title tooltip yang lama di tombol
          di atas, biar user gak perlu hover dulu buat tau kenapa tombolnya mati. */}
      {canManage && !rateCardsAktif.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'var(--amber-subtle)', border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)', color: 'var(--amber)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
          <span>⚠️ Studio ini belum punya rate card lembur aktif. Tambahkan dulu di tab</span>
          <button type="button" onClick={onGoToRateCard}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--amber)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
            Rate Card Lembur
          </button>
          <span>sebelum bisa mencatat lembur.</span>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Catatan Lembur Baru</span></div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Orang *</label>
                <select className="form-input" style={{ paddingLeft: 10 }} required
                  value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
                  <option value="">— Pilih —</option>
                  {members?.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rate Card *</label>
                <select className="form-input" style={{ paddingLeft: 10 }} required
                  value={form.rateCardId} onChange={e => setForm(f => ({ ...f, rateCardId: e.target.value }))}>
                  <option value="">— Pilih —</option>
                  {rateCardsAktif.map(r => <option key={r.id} value={r.id}>{r.level} · Rp {r.fee.toLocaleString('id-ID')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order Terkait</label>
                <select className="form-input" style={{ paddingLeft: 10 }}
                  value={form.orderId} onChange={e => setForm(f => ({ ...f, orderId: e.target.value }))}>
                  <option value="">— Tidak ada —</option>
                  {orders?.map(o => <option key={o.id} value={o.id}>{o.judul}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Klien</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="opsional"
                  value={form.klien} onChange={e => setForm(f => ({ ...f, klien: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Brief / Nama Tugas</label>
                <input className="form-input" style={{ paddingLeft: 14 }} placeholder="opsional"
                  value={form.briefName} onChange={e => setForm(f => ({ ...f, briefName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal *</label>
                <input type="date" className="form-input" style={{ paddingLeft: 14 }} required
                  value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Progres Awal (%) *</label>
                <input type="number" min="0" max="100" className="form-input" style={{ paddingLeft: 14 }} required
                  value={form.progresAwal} onChange={e => setForm(f => ({ ...f, progresAwal: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Progres Akhir (%) *</label>
                <input type="number" min="0" max="100" className="form-input" style={{ paddingLeft: 14 }} required
                  value={form.progresAkhir} onChange={e => setForm(f => ({ ...f, progresAkhir: e.target.value }))} />
                {form.rateCardId && form.progresAwal !== '' && form.progresAkhir !== '' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Estimasi fee: {formatRp((rateCardsAktif.find(r => r.id === form.rateCardId)?.fee ?? 0) * ((Number(form.progresAkhir) - Number(form.progresAwal)) / 100))}
                    {' '}(dihitung ulang server saat disimpan)
                  </div>
                )}
              </div>
            </div>
            {formErr && <div className="login-error" style={{ marginBottom: 12 }}>{formErr}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 130 }}>
                {submitting ? <><span className="spinner"/>Menyimpan...</> : 'Simpan Lembur'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setFormErr('') }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
        </div>
      ) : (lemburList ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕒</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada catatan lembur periode ini</div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap responsive-table" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th>Nama</th><th>Rate Card</th><th>Tanggal</th>
                  <th style={{ textAlign: 'center' }}>Progres</th>
                  <th style={{ textAlign: 'right' }}>Fee Akhir</th>
                  <th style={{ textAlign: 'center' }}>Status Payroll</th>
                </tr>
              </thead>
              <tbody>
                {lemburList.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.user?.nama}{(c.briefName || c.klien) && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.briefName || c.klien}</div>}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.rateCard?.level}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatTanggalPendek(c.tanggal)}</td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{Math.round(c.progresAwal * 100)}% → {Math.round(c.progresAkhir * 100)}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{formatRp(c.feeAkhir)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${c.penggajianId ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>
                        {c.penggajianId ? 'Sudah masuk payroll' : 'Belum masuk payroll'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
