import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import api from '../../services/api'
import { formatRp } from '../../utils/format'
import SlipModal from './SlipModal'
import TunjanganModal from './TunjanganModal'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const STATUS_CONFIG = {
  DRAFT:   { label: 'Draft',   color: '#3b82f6' },
  FINAL:   { label: 'Final',   color: 'var(--amber)' },
  DIBAYAR: { label: 'Dibayar', color: 'var(--green)' },
}
// tunjangan* SENGAJA gak ada di sini lagi -- itu baris dinamis (lihat TunjanganModal.jsx),
// diedit terpisah dari field-field tetap ini.
const EDITABLE_FIELDS = ['gajiPokok', 'bonus', 'komisi', 'shu', 'potongan']

// Daftar standar jenis tunjangan -- quick-pick di form Tambah Jenis, BUKAN daftar tertutup
// (koordinator tetap bisa nulis nama lain lewat opsi "Lainnya" kalau studionya butuh jenis di
// luar ini).
const STANDAR_TUNJANGAN = ['Makan Siang', 'Transportasi', 'BPJS', 'Beras', 'Kost', 'Laundry']
const LAINNYA = '__lainnya__'

const totalTunjangan = (p) => (p.tunjangan ?? []).reduce((s, t) => s + t.jumlah, 0)

export default function PayrollTab({ studioId, canManage, currentUserId }) {
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth() + 1)
  const [tahun, setTahun] = useState(now.getFullYear())

  const { data: rows, loading, error, refetch } = useApi(
    studioId ? `/api/payroll?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}` : null, [studioId, bulan, tahun]
  )

  // Template tunjangan studio -- dikelola di sini (mirip pola "Akun Produksi" di OrderTab.jsx),
  // biar generate payroll otomatis bikin baris tunjangan yang sesuai jenis studio ini.
  const { data: templates, refetch: refetchTemplates } = useApi(
    studioId ? `/api/payroll/tunjangan-template?studioId=${studioId}` : null, [studioId]
  )
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [templatePilihan, setTemplatePilihan] = useState('')
  const [templateNamaCustom, setTemplateNamaCustom] = useState('')
  const [templateErr, setTemplateErr] = useState('')

  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState(null)
  const [actionErr, setActionErr] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [slipId, setSlipId] = useState(null)
  const [tunjanganRow, setTunjanganRow] = useState(null)

  const handleAddTemplate = async (e) => {
    e.preventDefault()
    setTemplateErr('')
    const nama = templatePilihan === LAINNYA ? templateNamaCustom.trim() : templatePilihan
    if (!nama) { setTemplateErr('Pilih atau tulis nama jenis tunjangan dulu'); return }
    try {
      await api.post('/api/payroll/tunjangan-template', { studioId, nama })
      setTemplatePilihan(''); setTemplateNamaCustom(''); setShowTemplateForm(false)
      refetchTemplates()
    } catch (err) {
      setTemplateErr(err.response?.data?.message || 'Gagal menambah jenis tunjangan')
    }
  }

  const toggleTemplateAktif = async (t) => {
    try {
      await api.patch(`/api/payroll/tunjangan-template/${t.id}`, { aktif: !t.aktif })
      refetchTemplates()
    } catch (err) {
      setTemplateErr(err.response?.data?.message || 'Gagal mengubah status')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true); setGenerateMsg(null); setActionErr('')
    try {
      const res = await api.post(`/api/payroll/generate?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}`)
      const d = res.data.data
      setGenerateMsg(`✅ ${d.dibuat} baris dibuat, ${d.diupdate} baris di-refresh, ${d.diskip} baris di-skip (sudah final/dibayar).`)
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal generate payroll')
    }
    setGenerating(false)
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    const form = {}
    EDITABLE_FIELDS.forEach(f => { form[f] = String(row[f]) })
    setEditForm(form)
  }

  const cancelEdit = () => { setEditingId(null); setEditForm({}) }

  const saveEdit = async (id) => {
    setSaving(true); setActionErr('')
    try {
      await api.patch(`/api/payroll/${id}`, editForm)
      setEditingId(null); setEditForm({})
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal menyimpan perubahan')
    }
    setSaving(false)
  }

  const handleFinalize = async (id) => {
    if (!confirm('Finalize payroll ini? Setelah final, komponen gaji tidak bisa diedit lagi.')) return
    setActionErr('')
    try {
      await api.post(`/api/payroll/${id}/finalize`)
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal finalize')
    }
  }

  const handleTandaiDibayar = async (id) => {
    const buktiBayar = prompt('Link/keterangan bukti bayar (opsional, boleh kosong):') ?? undefined
    setActionErr('')
    try {
      await api.post(`/api/payroll/${id}/tandai-dibayar`, buktiBayar ? { buktiBayar } : {})
      refetch()
    } catch (err) {
      setActionErr(err.response?.data?.message || 'Gagal menandai dibayar')
    }
  }

  if (!studioId) {
    return <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Pilih studio dulu di atas</div>
  }

  return (
    <>
      {/* Template Tunjangan -- prasyarat biar Generate otomatis bikin baris tunjangan yang sesuai */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Template Tunjangan ({templates?.length ?? 0})</span>
          {canManage && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTemplateForm(v => !v)}>
              {showTemplateForm ? 'Tutup' : '+ Tambah Jenis'}
            </button>
          )}
        </div>
        {showTemplateForm && (
          <form onSubmit={handleAddTemplate} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <select className="form-input" style={{ paddingLeft: 10, width: 200 }}
              value={templatePilihan} onChange={e => setTemplatePilihan(e.target.value)}>
              <option value="">— Pilih Jenis —</option>
              {STANDAR_TUNJANGAN.map(n => <option key={n} value={n}>{n}</option>)}
              <option value={LAINNYA}>Lainnya (tulis sendiri)</option>
            </select>
            {templatePilihan === LAINNYA && (
              <input className="form-input" placeholder="Nama jenis tunjangan" required
                value={templateNamaCustom} onChange={e => setTemplateNamaCustom(e.target.value)} />
            )}
            <button type="submit" className="btn btn-primary" style={{ fontSize: 12, minWidth: 90 }}>Simpan</button>
          </form>
        )}
        {templateErr && <div className="login-error" style={{ marginBottom: 10 }}>{templateErr}</div>}
        {templates?.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada jenis tunjangan -- tiap studio bisa beda-beda (mis. BPJS vs Beras), tambah dulu sebelum Generate Payroll.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {templates?.map(t => (
              <span key={t.id} className={`badge ${t.aktif ? 'success' : 'danger'}`} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.nama}
                {canManage && (
                  <button onClick={() => toggleTemplateAktif(t)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 10, padding: 0, textDecoration: 'underline' }}>
                    {t.aktif ? 'nonaktifkan' : 'aktifkan'}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

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
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? <><span className="spinner"/>Generate...</> : '⚙ Generate Payroll'}
          </button>
        )}
      </div>

      {generateMsg && <div className="card" style={{ padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>{generateMsg}</div>}
      {actionErr && <div className="login-error" style={{ marginBottom: 16 }}>{actionErr}</div>}
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
        </div>
      ) : (rows ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada payroll periode ini</div>
          {canManage && <div style={{ fontSize: 12, marginTop: 4 }}>Klik "Generate Payroll" buat mulai</div>}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: 'var(--bg-card)' }}>
                  <th>Nama</th>
                  <th style={{ textAlign: 'right' }}>Gaji Pokok</th>
                  <th style={{ textAlign: 'right' }}>Bonus</th>
                  <th style={{ textAlign: 'right' }}>Komisi</th>
                  <th style={{ textAlign: 'right' }}>Lembur</th>
                  <th style={{ textAlign: 'right' }}>SHU</th>
                  <th style={{ textAlign: 'right' }}>Tunjangan</th>
                  <th style={{ textAlign: 'right' }}>Potongan</th>
                  <th style={{ textAlign: 'right' }}>THP</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isEditing = editingId === row.id
                  const isOwn = row.userId === currentUserId
                  return (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 600 }}>{row.user?.nama}{isOwn && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> (saya)</span>}</td>
                      {isEditing ? (
                        <>
                          {['gajiPokok', 'bonus', 'komisi'].map(f => (
                            <td key={f}>
                              <input type="number" min="0" className="form-input" style={{ width: 90, padding: '4px 6px', fontSize: 12 }}
                                value={editForm[f]} onChange={e => setEditForm(v => ({ ...v, [f]: e.target.value }))} />
                            </td>
                          ))}
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }} title="Lembur cuma dihitung otomatis lewat Generate">{formatRp(row.lembur)}</td>
                          <td>
                            <input type="number" min="0" className="form-input" style={{ width: 90, padding: '4px 6px', fontSize: 12 }}
                              value={editForm.shu} onChange={e => setEditForm(v => ({ ...v, shu: e.target.value }))} />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 6px' }} onClick={() => setTunjanganRow(row)}>
                              {formatRp(totalTunjangan(row))} ✎
                            </button>
                          </td>
                          <td>
                            <input type="number" min="0" className="form-input" style={{ width: 90, padding: '4px 6px', fontSize: 12 }}
                              value={editForm.potongan} onChange={e => setEditForm(v => ({ ...v, potongan: e.target.value }))} />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{formatRp(row.thp)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_CONFIG[row.status].color }}>{STATUS_CONFIG[row.status].label}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }} disabled={saving} onClick={() => saveEdit(row.id)}>Simpan</button>
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={cancelEdit}>Batal</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.gajiPokok)}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.bonus)}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.komisi)}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.lembur)}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>{formatRp(row.shu)}</td>
                          <td style={{ textAlign: 'right', fontSize: 13 }}>
                            {canManage && row.status === 'DRAFT' ? (
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 6px' }} onClick={() => setTunjanganRow(row)}>
                                {formatRp(totalTunjangan(row))} ✎
                              </button>
                            ) : formatRp(totalTunjangan(row))}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--red)' }}>{formatRp(row.potongan)}</td>
                          <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatRp(row.thp)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_CONFIG[row.status].color }}>{STATUS_CONFIG[row.status].label}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setSlipId(row.id)}>Slip</button>
                              {canManage && row.status === 'DRAFT' && (
                                <>
                                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => startEdit(row)}>Edit</button>
                                  <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleFinalize(row.id)}>Finalize</button>
                                </>
                              )}
                              {canManage && row.status === 'FINAL' && (
                                <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleTandaiDibayar(row.id)}>Tandai Dibayar</button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {slipId && <SlipModal penggajianId={slipId} onClose={() => setSlipId(null)} />}
      {tunjanganRow && (
        <TunjanganModal penggajian={tunjanganRow} onClose={() => setTunjanganRow(null)} onChanged={refetch} />
      )}
    </>
  )
}
