import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatRp, getBulanLabel } from '../../utils/format'
import { downloadCsv } from '../../utils/csv'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { onActivate } from '../../utils/a11y'
import { alfa } from '../../utils/warna'
import ItemRingkas from '../../components/common/ItemRingkas'
import { warnaTipe } from '../../utils/tipeUnit'

const NOW    = new Date()
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const STATUS_CFG = {
  LUNAS:    { label: 'Lunas',    color: 'var(--green)', bg: 'var(--green-subtle)'  },
  BELUM:    { label: 'Belum',    color: 'var(--amber)', bg: 'var(--amber-subtle)'  },
  NUNGGAK:  { label: 'Nunggak', color: 'var(--red)', bg: 'var(--red-subtle)'    },
  MENUNGGU: { label: 'Menunggu',color: 'var(--cyan)', bg: 'var(--cyan-subtle)'   },
}

// ── Modal: Lapor Setoran (self-report anggota) ───────────
function LaporModal({ nasabah, bulan, tahun, existing, onClose, onSaved }) {
  const [form, setForm] = useState({
    pokok:    existing?.pokok    ?? 0,
    wajib:    existing?.wajib    ?? 0,
    sukarela: existing?.sukarela ?? 0,
    thr:      existing?.thr      ?? 0,
    buktiBayar: existing?.buktiBayar ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const subtotal = ['pokok','wajib','sukarela','thr'].reduce((a, k) => a + Number(form[k]||0), 0)

  const save = async () => {
    if (!form.buktiBayar.trim()) return setError('Link bukti transfer wajib diisi')
    setSaving(true); setError('')
    try {
      await api.post('/api/koperasi/lapor', {
        nasabahId: nasabah.id, nasabahTipe: nasabah.tipe,
        bulan, tahun, ...form,
      })
      onSaved()
    } catch (e) { setError(e.response?.data?.message || 'Gagal mengirim') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '16px 20px' }}>
          <div>
            <div className="modal-title">Lapor Setoran</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {nasabah.nama} · {getBulanLabel(bulan, tahun)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['pokok','Simpanan Pokok'],['wajib','Simpanan Wajib'],['sukarela','Simpanan Sukarela'],['thr','THR']].map(([k, label]) => (
            <div key={k} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" type="number" min="0" step="1000"
                value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0" />
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total setoran</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-light)' }}>{formatRp(subtotal)}</span>
        </div>

        <div className="form-group">
          <label className="form-label">Link Bukti Transfer (Google Drive) *</label>
          <input className="form-input" type="url"
            value={form.buktiBayar} onChange={e => set('buktiBayar', e.target.value)}
            placeholder="https://drive.google.com/..." />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Upload screenshot transfer ke Google Drive, salin linknya di sini
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || subtotal === 0}>
            {saving ? 'Mengirim…' : 'Kirim Laporan'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Admin input / edit langsung ───────────────────
function AdminModal({ nasabah, bulan, tahun, existing, onClose, onSaved }) {
  const [form, setForm] = useState({
    pokok:    existing?.pokok    ?? 0,
    wajib:    existing?.wajib    ?? 0,
    sukarela: existing?.sukarela ?? 0,
    thr:      existing?.thr      ?? 0,
    status:   existing?.status   ?? 'LUNAS',
    catatanAdmin: existing?.catatanAdmin ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const subtotal = ['pokok','wajib','sukarela','thr'].reduce((a,k) => a + Number(form[k]||0), 0)

  const save = async () => {
    setSaving(true); setError('')
    try {
      await api.post('/api/koperasi/simpanan', { nasabahId: nasabah.id, nasabahTipe: nasabah.tipe, bulan, tahun, ...form })
      onSaved()
    } catch (e) { setError(e.response?.data?.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '16px 20px' }}>
          <div>
            <div className="modal-title">Input Simpanan</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {nasabah.nama} · {getBulanLabel(bulan, tahun)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['pokok','Simpanan Pokok'],['wajib','Simpanan Wajib'],['sukarela','Simpanan Sukarela'],['thr','THR']].map(([k, label]) => (
            <div key={k} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" type="number" min="0" step="1000"
                value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0" />
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-light)' }}>{formatRp(subtotal)}</span>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['LUNAS','BELUM','NUNGGAK'].map(s => {
              const cfg = STATUS_CFG[s]
              return (
                <button key={s} onClick={() => set('status', s)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                    background: form.status === s ? cfg.bg : 'var(--bg-surface)',
                    color: form.status === s ? cfg.color : 'var(--text-muted)',
                    outline: form.status === s ? `1.5px solid ${cfg.color}` : 'none',
                  }}>{cfg.label}</button>
              )
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Catatan (opsional)</label>
          <input className="form-input" value={form.catatanAdmin}
            onChange={e => set('catatanAdmin', e.target.value)} placeholder="Misal: transfer terlambat, cicilan, dll" />
        </div>

        {error && <div className="login-error">{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

// ── Panel MENUNGGU konfirmasi (admin) ────────────────────
function MenungguPanel({ bulan, tahun, onRefresh }) {
  const { data: list, loading, refetch } = useApi('/api/koperasi/menunggu')
  const [konfirmId, setKonfirmId] = useState(null)
  const [catatan, setCatatan]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [konfirmErr, setKonfirmErr] = useState('')

  const konfirm = async (id, status) => {
    setSaving(true); setKonfirmErr('')
    try {
      await api.patch(`/api/koperasi/konfirmasi/${id}`, { status, catatanAdmin: catatan })
      setCatatan(''); setKonfirmId(null)
      refetch(); onRefresh()
    } catch (err) {
      setKonfirmErr(err.response?.data?.message || 'Gagal konfirmasi, coba lagi')
    }
    finally { setSaving(false) }
  }

  if (!list?.length && !loading) return null

  return (
    <div className="card" style={{ marginBottom: 20, borderTop: '3px solid var(--cyan)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Menunggu Konfirmasi</span>
        <span style={{ background: 'var(--cyan-subtle)', color: 'var(--cyan)', fontSize: 11,
          fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{list?.length ?? 0}</span>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Memuat…</div>}

      {list?.map(r => {
        const isOpen = konfirmId === r.id
        return (
          <div key={r.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nasabah?.nama ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {MONTHS[r.bulan-1]} {r.tahun} · {formatRp(r.subtotal)}
                  {(r.nasabah?.circle ?? r.nasabah?.rumahUsaha) && <span> · <span style={{ color: 'var(--text-secondary)' }}>{(r.nasabah.circle ?? r.nasabah.rumahUsaha).nama}</span></span>}
                </div>
                {r.buktiBayar && (
                  <a href={r.buktiBayar} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                    onClick={e => e.stopPropagation()}>
                    🔗 Lihat Bukti Transfer
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setKonfirmId(isOpen ? null : r.id)}
                  className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                  {isOpen ? 'Batal' : 'Review'}
                </button>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                    placeholder="Catatan (opsional)" value={catatan}
                    onChange={e => setCatatan(e.target.value)} />
                  <button onClick={() => konfirm(r.id, 'LUNAS')} disabled={saving}
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--green-subtle)', color: 'var(--green)', fontWeight: 700, fontSize: 12 }}>
                    {saving ? '…' : '✅ Konfirmasi'}
                  </button>
                  <button onClick={() => konfirm(r.id, 'NUNGGAK')} disabled={saving}
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--red-subtle)', color: 'var(--red)', fontWeight: 700, fontSize: 12 }}>
                    {saving ? '…' : '❌ Tolak'}
                  </button>
                </div>
                {konfirmErr && <div className="login-error" style={{ marginTop: 8, fontSize: 12 }}>{konfirmErr}</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Baris nasabah ────────────────────────────────────────
function NasabahRow({ row, bulan, tahun, isAdmin, isKoordinator, isSelf, onLapor, onAdminInput, onAdminInputHistory }) {
  const [expanded, setExpanded] = useState(false)
  const { data: riwayat, loading } = useApi(
    expanded ? `/api/koperasi/riwayat/${row.tipe}/${row.id}` : null
  )

  const st  = row.bulanIni?.status ?? null
  const cfg = st ? STATUS_CFG[st] : null

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = ''}>

        <td style={{ padding: '11px 8px 11px 16px', width: 24 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'inline-block',
            transition: 'transform .2s', transform: expanded ? 'rotate(90deg)' : '' }}>▶</span>
        </td>

        <td style={{ padding: '11px 12px', minWidth: 160 }}>
          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isSelf && <span style={{ fontSize: 10, background: 'var(--accent-subtle)', color: 'var(--accent-light)',
              padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Saya</span>}
            {row.nama}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {row.circle && <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.circle.colorHex, flexShrink: 0 }} />}
            {row.circle?.nama ?? '—'}
          </div>
        </td>

        <td style={{ padding: '11px 12px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
            ...(row.tipe === 'STUDIO' ? warnaTipe(row.role) : warnaTipe('PROJECT')) }}>
            {row.tipe === 'STUDIO' ? (row.role ?? 'STUDIO') : 'PERORANGAN'}
          </span>
        </td>

        {['pokok','wajib','sukarela','thr'].map(k => (
          <td key={k} style={{ padding: '11px 12px', textAlign: 'right', fontSize: 12,
            color: row.totals?.[k] > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
            {row.totals?.[k] > 0 ? formatRp(row.totals[k]) : '—'}
          </td>
        ))}

        <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700,
          color: row.totals?.grand > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
          {row.totals?.grand > 0 ? formatRp(row.totals.grand) : '—'}
        </td>

        <td style={{ padding: '11px 12px', textAlign: 'center' }}>
          {cfg
            ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
          }
          {row.bulanIni?.buktiBayar && (
            <a href={row.bulanIni.buktiBayar} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ display: 'block', fontSize: 10, color: 'var(--cyan)', marginTop: 2 }}>
              🔗 Bukti
            </a>
          )}
        </td>

        <td style={{ padding: '11px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
          {isAdmin && !isKoordinator && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => onAdminInput(row)}>
              {row.bulanIni ? '✎ Edit' : 'Input'}
            </button>
          )}
          {(isKoordinator || (!isAdmin && isSelf)) && (
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px', ...(st === 'NUNGGAK' ? { background: 'var(--red)' } : {}) }}
              onClick={() => onLapor(row)}>
              {st === 'MENUNGGU' ? 'Edit Laporan' : st === 'LUNAS' ? '✓ Sudah' : st === 'NUNGGAK' ? '⚠ Lapor Tunggakan' : 'Lapor Setoran'}
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0, background: 'var(--bg-surface)' }}>
            <div style={{ padding: '12px 52px' }}>
              {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Memuat riwayat…</div>}
              {riwayat?.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Belum ada riwayat simpanan.</div>}
              {riwayat?.length > 0 && (
                <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      {['Periode','Pokok','Wajib','Sukarela','THR','Total','Status','Bukti'].map(h => (
                        <th key={h} style={{ padding: '4px 10px', textAlign: ['Periode','Status','Bukti'].includes(h) ? 'left' : 'right',
                          fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                      {isAdmin && !isKoordinator && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {riwayat.map(r => {
                      const rcfg = STATUS_CFG[r.status]
                      return (
                        <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{MONTHS[r.bulan-1]} {r.tahun}</td>
                          {['pokok','wajib','sukarela','thr','subtotal'].map(k => (
                            <td key={k} style={{ padding: '6px 10px', textAlign: 'right',
                              color: r[k] > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                              {r[k] > 0 ? formatRp(r[k]) : '—'}
                            </td>
                          ))}
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontWeight: 700, color: rcfg?.color }}>{rcfg?.label ?? r.status}</span>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            {r.buktiBayar
                              ? <a href={r.buktiBayar} target="_blank" rel="noopener noreferrer"
                                  style={{ color: 'var(--cyan)', fontSize: 11 }}>🔗 Lihat</a>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          {isAdmin && !isKoordinator && (
                            <td style={{ padding: '6px 10px' }} onClick={e => e.stopPropagation()}>
                              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }}
                                onClick={() => onAdminInputHistory?.(row, r)}>
                                ✎ Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Kartu nasabah (mobile) ────────────────────────────────
function NasabahCard({ row, isAdmin, isKoordinator, isSelf, onLapor, onAdminInput, onAdminInputHistory }) {
  const [expanded, setExpanded] = useState(false)
  const { data: riwayat, loading } = useApi(
    expanded ? `/api/koperasi/riwayat/${row.tipe}/${row.id}` : null
  )

  const st  = row.bulanIni?.status ?? null
  const cfg = st ? STATUS_CFG[st] : null

  const tipeLabel = row.tipe === 'STUDIO' ? (row.role ?? 'STUDIO') : 'PERORANGAN'

  return (
    <ItemRingkas buka={expanded} onToggle={() => setExpanded(e => !e)}
      judul={<>{isSelf && <span style={{ fontSize: 10, background: 'var(--accent-subtle)', color: 'var(--accent-light)',
        padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginRight: 6 }}>Saya</span>}{row.nama}</>}
      warna={row.circle?.colorHex}
      sub={<>{row.circle?.nama ?? '—'} · {tipeLabel}{cfg && <> · <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span></>}</>}
      nilai={row.totals?.grand > 0 ? <span style={{ color: 'var(--accent-light)' }}>{formatRp(row.totals.grand)}</span> : '—'}>
      <div style={{ marginTop: 10 }}>
        {['pokok','wajib','sukarela','thr'].map(k => (
          <div key={k} className="data-card-row">
            <span className="data-card-label">{{ pokok: 'Pokok', wajib: 'Wajib', sukarela: 'Sukarela', thr: 'THR' }[k]}</span>
            <span className="data-card-value" style={{ color: row.totals?.[k] > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
              {row.totals?.[k] > 0 ? formatRp(row.totals[k]) : '—'}
            </span>
          </div>
        ))}
        <div className="data-card-row">
          <span className="data-card-label">Grand Total</span>
          <span className="data-card-value" style={{ fontWeight: 700, color: row.totals?.grand > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
            {row.totals?.grand > 0 ? formatRp(row.totals.grand) : '—'}
          </span>
        </div>
        <div className="data-card-row">
          <span className="data-card-label">Status</span>
          <span className="data-card-value">
            {cfg
              ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
            }
            {row.bulanIni?.buktiBayar && (
              <a href={row.bulanIni.buktiBayar} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', fontSize: 10, color: 'var(--cyan)', marginTop: 2 }}>
                🔗 Lihat Bukti
              </a>
            )}
          </span>
        </div>
      </div>

      {(isAdmin || isKoordinator || isSelf) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {isAdmin && !isKoordinator && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}
              onClick={() => onAdminInput(row)}>
              {row.bulanIni ? '✎ Edit' : 'Input'}
            </button>
          )}
          {(isKoordinator || (!isAdmin && isSelf)) && (
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px', ...(st === 'NUNGGAK' ? { background: 'var(--red)' } : {}) }}
              onClick={() => onLapor(row)}>
              {st === 'MENUNGGU' ? 'Edit Laporan' : st === 'LUNAS' ? '✓ Sudah' : st === 'NUNGGAK' ? '⚠ Lapor Tunggakan' : 'Lapor Setoran'}
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Memuat riwayat…</div>}
          {riwayat?.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Belum ada riwayat simpanan.</div>}
          {riwayat?.map(r => {
            const rcfg = STATUS_CFG[r.status]
            return (
              <div key={r.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  <span>{MONTHS[r.bulan-1]} {r.tahun}</span>
                  <span style={{ color: rcfg?.color, fontWeight: 700 }}>{rcfg?.label ?? r.status}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Total {formatRp(r.subtotal)}
                  {r.buktiBayar && <> · <a href={r.buktiBayar} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>🔗 Bukti</a></>}
                </div>
                {isAdmin && !isKoordinator && (
                  <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px', marginTop: 4 }}
                    onClick={() => onAdminInputHistory?.(row, r)}>
                    ✎ Edit
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ItemRingkas>
  )
}

// ── Panel onboarding cara lapor simpanan ─────────────────
const SIMPANAN_PERORANGAN = [
  { label: 'Simpanan Pokok',    tag: null,       desc: 'Dibayar sekali saat pertama kali bergabung koperasi. Tidak perlu dibayar lagi bulan berikutnya.' },
  { label: 'Simpanan Wajib',    tag: 'Wajib/bln', desc: 'Dibayar setiap bulan tanpa terkecuali. Besaran ditentukan pengurus koperasi.' },
  { label: 'Simpanan Sukarela', tag: 'Opsional',  desc: 'Bisa disetor kapan saja sesuai kemampuan. Bisa ditarik kembali.' },
  { label: 'THR',               tag: 'Opsional',  desc: 'Simpanan khusus menjelang Lebaran. Biasanya dikumpulkan bulan Ramadan.' },
]

const SIMPANAN_STUDIO = [
  { label: 'Simpanan Pokok',    tag: null,       desc: 'Dibayar sekali saat studio pertama kali bergabung koperasi.' },
  { label: 'Simpanan Sukarela', tag: 'Opsional',  desc: 'Kontribusi sukarela studio. Bisa disetor kapan saja.' },
  { label: 'THR',               tag: 'Opsional',  desc: 'Kontribusi studio menjelang Lebaran.' },
]

function DaftarAnggotaModal({ existingIds, onClose, onSaved }) {
  const { data: allMembers } = useApi('/api/members?limit=500')
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const available = (allMembers ?? []).filter(m =>
    !existingIds.has(m.id) &&
    m.nama.toLowerCase().includes(search.toLowerCase())
  )

  const handleDaftar = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      await api.patch(`/api/members/${selected.id}/koperasi`)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mendaftarkan anggota')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div className="modal-title">Daftarkan Anggota Koperasi</div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="form-input" placeholder="Cari nama anggota..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {available.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                {search ? 'Tidak ditemukan' : 'Semua anggota sudah terdaftar'}
              </div>
            )}
            {available.map(m => (
              <div key={m.id} onClick={() => setSelected(m)}
                role="button" tabIndex={0} onKeyDown={onActivate(() => setSelected(m))}
                style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selected?.id === m.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected?.id === m.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-surface)',
                  transition: 'all 0.15s' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.nama}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {m.roles?.[0]?.roleType ?? '—'} {m.roles?.[0]?.studio?.nama ? `· ${m.roles[0].studio.nama}` : ''}
                </div>
              </div>
            ))}
          </div>
          {error && <div className="login-error">{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" disabled={!selected || saving}
              onClick={handleDaftar} style={{ flex: 1 }}>
              {saving ? <><span className="spinner"/>Menyimpan...</> : '🏦 Daftarkan ke Koperasi'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OnboardingPanel({ tab }) {
  const [open, setOpen] = useState(false)
  const isStudio = tab === 'studio'
  const simpananList = isStudio ? SIMPANAN_STUDIO : SIMPANAN_PERORANGAN

  return (
    <div style={{ marginBottom: 20, borderRadius: 10, border: '1px solid var(--border)',
      background: open ? 'var(--bg-card)' : 'var(--bg-surface)', overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Cara Lapor Simpanan Koperasi</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>— klik untuk {open ? 'tutup' : 'lihat panduan'}</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: open ? 'rotate(180deg)' : '', transition: 'transform .2s' }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>

          {/* Jenis simpanan */}
          <div style={{ marginTop: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Jenis Simpanan
              </span>
              <span style={{ fontSize: 11, background: isStudio ? 'var(--cyan-subtle)' : 'var(--accent-subtle)',
                color: isStudio ? 'var(--cyan)' : 'var(--accent-light)',
                padding: '1px 8px', borderRadius: 20, fontWeight: 700 }}>
                {isStudio ? 'Studio' : 'Perorangan'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {simpananList.map(s => (
                <div key={s.label} style={{ background: 'var(--bg-surface)', borderRadius: 8,
                  padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{s.label}</span>
                    {s.tag && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: s.tag === 'Wajib/bln' ? 'var(--red-subtle)' : 'var(--bg-card)',
                        color: s.tag === 'Wajib/bln' ? 'var(--red)' : 'var(--text-muted)' }}>
                        {s.tag}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Langkah lapor */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.07em', marginBottom: 10 }}>Langkah Lapor Setoran</div>
            {[
              { n: 1, title: 'Transfer ke rekening koperasi',  body: 'Hubungi admin untuk mendapatkan nomor rekening tujuan transfer.' },
              { n: 2, title: 'Screenshot bukti transfer',       body: 'Ambil screenshot bukti transfer dari aplikasi bank / m-banking kamu.' },
              { n: 3, title: 'Upload ke Google Drive',          body: 'Upload screenshot tadi ke Google Drive, lalu klik kanan → "Bagikan" → salin link.' },
              { n: 4, title: 'Klik tombol "Lapor Setoran"',     body: 'Di baris namamu, klik Lapor Setoran. Isi nominal per jenis simpanan dan tempel link bukti transfer.' },
              { n: 5, title: 'Tunggu konfirmasi admin',         body: 'Status akan berubah jadi "Menunggu" lalu "Lunas" setelah admin mengonfirmasi.' },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
                  color: 'var(--on-accent)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 2 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>

          {!isStudio && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-subtle)',
              borderRadius: 8, fontSize: 12, color: '#b45309', lineHeight: 1.6 }}>
              ⚠️ <strong>Simpanan Wajib harus disetor setiap bulan.</strong> Jika melewati deadline, status berubah menjadi <strong>Nunggak</strong>.
              Hubungi admin jika ada kendala pembayaran.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────
export default function Koperasi({ onBadgeRefresh }) {
  const { user } = useAuth()
  const [bulan, setBulan] = useState(NOW.getMonth() + 1)
  const [tahun, setTahun] = useState(NOW.getFullYear())
  const [tab, setTab]     = useState('perorangan')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [modal, setModal]       = useState(null) // { tipe: 'lapor'|'admin', nasabah, existing }
  const [showDaftar, setShowDaftar] = useState(false)

  const { data, loading, error, refetch } = useApi(
    `/api/koperasi/nasabah?bulan=${bulan}&tahun=${tahun}`,
    [bulan, tahun]
  )
  const { data: monthlySummary } = useApi('/api/koperasi/monthly-summary', [])

  // isFullAdmin: bisa input langsung + konfirmasi (endpoint /simpanan)
  const isFullAdmin = user?.roles?.some(r =>
    ['ADMIN_FUNGSIONAL','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADVISOR'].includes(r.roleType)
  )
  // isKoordinator: bisa lapor untuk anggota studionya, tapi lewat flow lapor (bukan admin).
  // PENDAMPING SENGAJA gak dimasukkan (beda dari pola isKoordinator di halaman lain) -- posisi
  // ini gak selalu relevan buat urusan koperasi tim (keputusan eksplisit user), jadi treatment-nya
  // di sini sama kayak anggota biasa (self-view doang), bukan setara KOORDINATOR.
  const isKoordinator = !isFullAdmin && user?.roles?.some(r =>
    ['KOORDINATOR'].includes(r.roleType)
  )
  const isAdmin = isFullAdmin || isKoordinator

  const allRows  = tab === 'perorangan' ? (data?.userRows ?? []) : (data?.studioRows ?? [])
  // KOORDINATOR lihat semua (untuk bisa lapor anggota tim), tapi pakai LaporModal bukan AdminModal
  const visibleRows = isAdmin ? allRows : allRows.filter(r => r.id === user?.id)
  const matchesStatus = (r, key) => key === 'BELUM'
    ? (!r.bulanIni || r.bulanIni.status === 'BELUM')
    : r.bulanIni?.status === key
  const filtered = visibleRows
    .filter(r => r.nama.toLowerCase().includes(search.toLowerCase()))
    .filter(r => !statusFilter || matchesStatus(r, statusFilter))

  const gt      = data?.grandTotal ?? { pokok: 0, wajib: 0, sukarela: 0, thr: 0, grand: 0 }
  const sudah   = allRows.filter(r => r.bulanIni?.status === 'LUNAS').length
  const menunggu = allRows.filter(r => r.bulanIni?.status === 'MENUNGGU').length
  const belum   = allRows.filter(r => !r.bulanIni || r.bulanIni.status === 'BELUM').length
  const nunggak = allRows.filter(r => r.bulanIni?.status === 'NUNGGAK').length

  const handleDownloadCsv = () => {
    const rows = allRows.map(r => ({
      'Nama':              r.nama,
      'Tipe':              r.tipe === 'user' ? 'Perorangan' : 'Studio',
      'Status':            STATUS_CFG[r.bulanIni?.status]?.label ?? 'Belum',
      'Simpanan Pokok':    r.bulanIni?.pokok    ?? 0,
      'Simpanan Wajib':    r.bulanIni?.wajib    ?? 0,
      'Simpanan Sukarela': r.bulanIni?.sukarela ?? 0,
      'THR':               r.bulanIni?.thr      ?? 0,
      'Total':             (r.bulanIni?.pokok ?? 0) + (r.bulanIni?.wajib ?? 0) + (r.bulanIni?.sukarela ?? 0) + (r.bulanIni?.thr ?? 0),
      'Periode':           getBulanLabel(bulan, tahun),
    }))
    downloadCsv(`${ECOSYSTEM_NAME}-Koperasi-${getBulanLabel(bulan, tahun).replace(' ', '-')}.csv`, rows)
  }

  return (
    <>
      {/* Header */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Koperasi {ECOSYSTEM_NAME}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {isAdmin ? 'Rekap simpanan perorangan & studio' : 'Simpanan koperasi saya'} · {getBulanLabel(bulan, tahun)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isFullAdmin && (
            <button className="btn btn-primary" style={{ fontSize: 13, padding: '7px 14px', whiteSpace: 'nowrap' }}
              onClick={() => setShowDaftar(true)}>
              + Daftarkan Anggota
            </button>
          )}
          {isFullAdmin && (
            <button className="btn btn-ghost" style={{ fontSize: 13, padding: '7px 14px', whiteSpace: 'nowrap' }}
              onClick={handleDownloadCsv} disabled={!allRows.length} title="Download CSV simpanan bulan ini">
              ↓ CSV
            </button>
          )}
          <select className="form-input" style={{ padding: '6px 10px', width: 100 }}
            value={bulan} onChange={e => setBulan(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <input className="form-input" type="number" style={{ padding: '6px 10px', width: 80 }}
            value={tahun} onChange={e => setTahun(Number(e.target.value))} />
        </div>
      </div>

      {/* Onboarding panduan lapor */}
      <OnboardingPanel tab={tab} />

      {/* Panel MENUNGGU konfirmasi (full admin only) */}
      {isFullAdmin && <MenungguPanel bulan={bulan} tahun={tahun} onRefresh={() => { refetch(); onBadgeRefresh?.() }} />}

      {/* Summary cards (full admin only) */}
      {isFullAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Pokok',    value: gt.pokok,    color: 'var(--accent-light)' },
            { label: 'Total Wajib',    value: gt.wajib,    color: 'var(--cyan)'         },
            { label: 'Total Sukarela', value: gt.sukarela, color: 'var(--green)'        },
            { label: 'Total THR',      value: gt.thr,      color: 'var(--amber)'        },
            { label: 'Grand Total',    value: gt.grand,    color: 'var(--text)'         },
          ].map(c => (
            <div key={c.label} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{formatRp(c.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Status bulan ini */}
      {isFullAdmin && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { key: 'LUNAS',    label: 'Sudah setor',     val: sudah,    color: 'var(--green)' },
            { key: 'MENUNGGU', label: 'Menunggu konfirm',val: menunggu, color: 'var(--cyan)' },
            { key: 'BELUM',    label: 'Belum setor',     val: belum,    color: 'var(--amber)' },
            { key: 'NUNGGAK',  label: 'Nunggak',         val: nunggak,  color: 'var(--red)' },
          ].map(s => {
            const active = statusFilter === s.key
            return (
              <button key={s.label}
                onClick={() => setStatusFilter(active ? null : s.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8,
                  background: active ? `${alfa(s.color, 13)}` : 'var(--bg-card)',
                  border: `1px solid ${active ? s.color : 'var(--border)'}`,
                  borderRadius: 10, padding: '7px 14px', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.val}</span>
                <span style={{ color: active ? 'var(--text)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400 }}>{s.label}</span>
              </button>
            )
          })}
          {statusFilter && (
            <button onClick={() => setStatusFilter(null)}
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', padding: '7px 4px' }}>
              Hapus filter
            </button>
          )}
          <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12, lineHeight: '36px' }}>
            dari {allRows.length} nasabah
          </div>
        </div>
      )}

      {/* Tabs + search (admin only tabs) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', borderRadius: 10, padding: 4 }}>
            {[['perorangan',`👤 Perorangan (${data?.userRows?.length ?? 0})`],
              ['studio',`🏢 Studio & Project (${data?.studioRows?.length ?? 0})`],
              ['rekap','📅 Rekap Bulanan']].map(([k, label]) => (
              <button key={k} onClick={() => { setTab(k); setSearch(''); setStatusFilter(null) }}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: tab === k ? 'var(--bg-card)' : 'none',
                  color: tab === k ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</button>
            ))}
          </div>
        )}
        {isAdmin && (
          <input className="form-input" style={{ width: 'min(220px, 100%)', padding: '7px 12px' }}
            placeholder="Cari nama…" value={search} onChange={e => setSearch(e.target.value)} />
        )}
      </div>

      {/* Rekap Bulanan */}
      {tab === 'rekap' && isFullAdmin && (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px' }}>
            <span className="card-title">Rekap Total per Bulan</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hanya setoran LUNAS (sudah dikonfirmasi)</span>
          </div>
          <div className="table-wrap responsive-table">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  {['Periode','Jml Lunas','Total Wajib','Total Sukarela','Total THR','Total Masuk'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                      textAlign: h === 'Periode' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(monthlySummary ?? []).length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Belum ada data setoran LUNAS.
                  </td></tr>
                )}
                {(monthlySummary ?? []).map(r => (
                  <tr key={`${r.tahun}-${r.bulan}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 700 }}>{MONTHS[r.bulan - 1]} {r.tahun}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{r._count.id} anggota</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>{r._sum.wajib > 0 ? formatRp(r._sum.wajib) : '—'}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>{r._sum.sukarela > 0 ? formatRp(r._sum.sukarela) : '—'}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: r._sum.thr > 0 ? 'var(--amber)' : 'var(--text-muted)', fontWeight: r._sum.thr > 0 ? 700 : 400 }}>
                      {r._sum.thr > 0 ? formatRp(r._sum.thr) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent-light)' }}>
                      {formatRp(r._sum.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {(monthlySummary ?? []).length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-surface)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: 12 }}>Total Keseluruhan</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                      {(monthlySummary ?? []).reduce((a, r) => a + r._count.id, 0)} transaksi
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                      {formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.wajib ?? 0), 0))}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                      {formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.sukarela ?? 0), 0))}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--amber)' }}>
                      {formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.thr ?? 0), 0))}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: 'var(--accent-light)' }}>
                      {formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.subtotal ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile: list ringkas per bulan, ketuk baris untuk rincian */}
          <div className="responsive-cards list-ringkas" style={{ margin: 12 }}>
            {(monthlySummary ?? []).length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Belum ada data setoran LUNAS.
              </div>
            )}
            {(monthlySummary ?? []).map(r => (
              <ItemRingkas key={`${r.tahun}-${r.bulan}`} judul={`${MONTHS[r.bulan - 1]} ${r.tahun}`}
                sub={`${r._count.id} anggota lunas`}
                nilai={<span style={{ color: 'var(--accent-light)' }}>{formatRp(r._sum.subtotal)}</span>}>
                <div className="data-card-row">
                  <span className="data-card-label">Total Wajib</span>
                  <span className="data-card-value">{r._sum.wajib > 0 ? formatRp(r._sum.wajib) : '—'}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Total Sukarela</span>
                  <span className="data-card-value">{r._sum.sukarela > 0 ? formatRp(r._sum.sukarela) : '—'}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Total THR</span>
                  <span className="data-card-value" style={{ color: r._sum.thr > 0 ? 'var(--amber)' : 'var(--text-muted)', fontWeight: r._sum.thr > 0 ? 700 : 400 }}>
                    {r._sum.thr > 0 ? formatRp(r._sum.thr) : '—'}
                  </span>
                </div>
              </ItemRingkas>
            ))}
            {(monthlySummary ?? []).length > 1 && (
              <ItemRingkas judul="Total Keseluruhan"
                sub={`${(monthlySummary ?? []).reduce((a, r) => a + r._count.id, 0)} transaksi`}
                nilai={<span style={{ color: 'var(--accent-light)' }}>{formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.subtotal ?? 0), 0))}</span>}>
                <div className="data-card-row">
                  <span className="data-card-label">Total Wajib</span>
                  <span className="data-card-value" style={{ fontWeight: 700 }}>{formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.wajib ?? 0), 0))}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Total Sukarela</span>
                  <span className="data-card-value" style={{ fontWeight: 700 }}>{formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.sukarela ?? 0), 0))}</span>
                </div>
                <div className="data-card-row">
                  <span className="data-card-label">Total THR</span>
                  <span className="data-card-value" style={{ fontWeight: 700, color: 'var(--amber)' }}>{formatRp((monthlySummary ?? []).reduce((a, r) => a + (r._sum.thr ?? 0), 0))}</span>
                </div>
              </ItemRingkas>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {tab !== 'rekap' && error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
      {tab !== 'rekap' && <div className="card" style={{ padding: 0 }}>
        {/* Desktop: tabel */}
        <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* --sticky-col1: 24px -- kolom pertama di sini cuma chevron expand/collapse, sengaja
            lebih sempit dari default 44px (lihat index.css .table-sticky-2). Custom property ini
            yang bikin posisi sticky kolom kedua (left) ikut nyesuain, bukan dipaksa 44px kayak
            tabel lain -- kalau dipaksa 44px bakal buang-buang ruang buat ikon doang. */}
        <table className="table-sticky-2" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 760, '--sticky-col1': '24px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <th style={{ width: 24 }} />
              {['Nama','Tipe','Total Pokok','Total Wajib','Total Sukarela','Total THR','Grand Total',getBulanLabel(bulan,tahun),''].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 12px',
                  width: [140, 90, 90, 90, 96, 84, 100, 110, 60][i],
                  textAlign: ['Total Pokok','Total Wajib','Total Sukarela','Total THR','Grand Total'].includes(h) ? 'right' : 'left',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data…</td></tr>
            )}
            {!loading && filtered.map(row => (
              <NasabahRow
                key={`${row.tipe}_${row.id}`}
                row={row} bulan={bulan} tahun={tahun}
                isAdmin={isAdmin}
                isKoordinator={isKoordinator}
                isSelf={row.id === user?.id && row.tipe === 'USER'}
                onLapor={r => setModal({ tipe: 'lapor', nasabah: r, existing: r.bulanIni })}
                onAdminInput={r => setModal({ tipe: 'admin', nasabah: r, existing: r.bulanIni })}
                onAdminInputHistory={(r, rec) => setModal({ tipe: 'admin', nasabah: r, existing: rec, editBulan: rec.bulan, editTahun: rec.tahun })}
              />
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                {isAdmin ? 'Tidak ada data' : 'Data simpananmu belum tersedia'}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Mobile: list ringkas, ketuk baris untuk rincian & riwayat */}
        <div className="responsive-cards list-ringkas" style={{ margin: 12, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data…</div>}
          {!loading && filtered.map(row => (
            <NasabahCard
              key={`${row.tipe}_${row.id}`}
              row={row}
              isAdmin={isAdmin}
              isKoordinator={isKoordinator}
              isSelf={row.id === user?.id && row.tipe === 'USER'}
              onLapor={r => setModal({ tipe: 'lapor', nasabah: r, existing: r.bulanIni })}
              onAdminInput={r => setModal({ tipe: 'admin', nasabah: r, existing: r.bulanIni })}
              onAdminInputHistory={(r, rec) => setModal({ tipe: 'admin', nasabah: r, existing: rec, editBulan: rec.bulan, editTahun: rec.tahun })}
            />
          ))}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              {isAdmin ? 'Tidak ada data' : 'Data simpananmu belum tersedia'}
            </div>
          )}
        </div>
      </div>}

      {/* Modals */}
      {modal?.tipe === 'lapor' && (
        <LaporModal nasabah={modal.nasabah} bulan={bulan} tahun={tahun} existing={modal.existing}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch() }} />
      )}
      {modal?.tipe === 'admin' && (
        <AdminModal nasabah={modal.nasabah} bulan={modal.editBulan ?? bulan} tahun={modal.editTahun ?? tahun} existing={modal.existing}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch() }} />
      )}
      {showDaftar && (
        <DaftarAnggotaModal
          existingIds={new Set((data?.userRows ?? []).map(r => r.id))}
          onClose={() => setShowDaftar(false)}
          onSaved={() => { setShowDaftar(false); refetch() }}
        />
      )}
    </>
  )
}
