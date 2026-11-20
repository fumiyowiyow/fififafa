import { useState, useEffect } from 'react'
import api from '../../services/api'
import { formatRp, getBulanLabel } from '../../utils/format'
import ItemRingkas from '../../components/common/ItemRingkas'

// ── MonthlyReport section: Input CPM (read-only, dari Studio) & Dana di Luar Kas Bulanan ──
export default function MonthlyReportCpmTable({ studios, bulan, tahun, cpmData, prevCpmData, refetchCpm, isFullAdminCpm, canEditCpm }) {
  const [cpmInputs, setCpmInputs] = useState({})
  const [savingCpm, setSavingCpm] = useState({})
  const [savedCpm, setSavedCpm]   = useState({})

  useEffect(() => {
    setCpmInputs({})
    setSavedCpm({})
  }, [bulan, tahun])

  // CPM bukan lagi diinput di sini — sekarang dihitung otomatis (THP + pengeluaran rutin + SHU,
  // diisi di Bio Studio), nggak perlu diisi ulang tiap bulan. Yang tetap bulanan cuma
  // "Dana di Luar Kas" (ekuitas), karena itu wajar berubah tiap bulan.
  const getCpmInput = (studioId) => {
    if (cpmInputs[studioId] !== undefined) return cpmInputs[studioId]
    const existing = cpmData?.find(n => n.studioId === studioId)
    if (existing) return { ekuitas: existing.ekuitas ?? '' }
    const prev = prevCpmData?.find(n => n.studioId === studioId)
    return { ekuitas: prev?.ekuitas ?? '' }
  }

  const handleSaveCpm = async (studioId) => {
    const vals = getCpmInput(studioId)
    setSavingCpm(s => ({ ...s, [studioId]: true }))
    try {
      await api.post('/api/monthly-data/cpm', {
        studioId, bulan, tahun,
        ekuitas: Number(vals.ekuitas) || 0,
      })
      refetchCpm()
      setSavedCpm(s => ({ ...s, [studioId]: true }))
      setTimeout(() => setSavedCpm(s => ({ ...s, [studioId]: false })), 2000)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan')
    } finally {
      setSavingCpm(s => ({ ...s, [studioId]: false }))
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span className="card-title">Input Dana di Luar Kas Bulanan</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getBulanLabel(bulan, tahun)}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        CPM (biaya operasional per bulan) sekarang dihitung otomatis dari data di Bio Studio (THP anggota + pengeluaran rutin + SHU) — bukan diisi ulang tiap bulan di sini. Kalau pengeluaran aktual beda dari CPM, tidak masalah.
      </div>
      {/* Desktop: tabel */}
      <div className="table-wrap responsive-table" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <table>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: 'var(--bg-card)' }}>
              <th style={{ background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--border)', padding: '10px 12px' }}>Studio</th>
              <th style={{ textAlign: 'right', width: 140, background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--border)', padding: '10px 12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  CPM (Rp)
                  <span title="Cost Per Month — biaya operasional studio per bulan, dihitung otomatis dari Bio Studio (THP + pengeluaran rutin + SHU). Dipakai untuk estimasi ketahanan kas." style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid var(--text-muted)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>?</span>
                </span>
              </th>
              <th style={{ textAlign: 'right', width: 160, background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--border)', padding: '10px 12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Dana di Luar Kas (Rp)
                  <span title="Uang yang ada di luar kas fisik: saldo marketplace yang belum dicairkan, tabungan, deposit THR, dll. Bukan kas tunai." style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid var(--text-muted)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>?</span>
                </span>
              </th>
              <th style={{ textAlign: 'right', width: 150, background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--border)', padding: '10px 12px' }}>Kas rekening (Rp)</th>
              <th style={{ textAlign: 'center', width: 130, background: 'var(--bg-card)', color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--border)', padding: '10px 12px' }}>Estimasi Bertahan</th>
              <th style={{ width: 80, background: 'var(--bg-card)', borderBottom: '2px solid var(--border)' }} />
            </tr>
          </thead>
          <tbody>
            {studios.filter(st => isFullAdminCpm || canEditCpm(st.id)).map(st => {
              const vals    = getCpmInput(st.id)
              const isSaving  = savingCpm[st.id]
              const isSaved   = savedCpm[st.id]
              const canEdit   = canEditCpm(st.id)
              const kas     = st.kasAkhir ?? 0
              const cpm     = st.cpmRp ?? 0
              const bulanBertahan = cpm > 0 ? kas / cpm : null
              const runwayColor = bulanBertahan === null ? 'var(--text-muted)'
                : bulanBertahan >= 3 ? 'var(--green)'
                : bulanBertahan >= 1 ? 'var(--amber)'
                : 'var(--red)'
              const runwayLabel = bulanBertahan === null ? '—'
                : bulanBertahan >= 1 ? `${bulanBertahan.toFixed(1)} bln`
                : `${(bulanBertahan * 30).toFixed(0)} hari`
              return (
                <tr key={st.id}>
                  <td style={{ fontWeight: 600 }}>
                    {st.nama}
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>{st.tipe}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 12, padding: '8px 12px', color: cpm > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                    {cpm > 0 ? formatRp(cpm) : (
                      <span title="Belum diatur — isi THP/pengeluaran rutin di Bio Studio" style={{ fontStyle: 'italic' }}>belum diatur</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="number" min="0" className="form-input"
                      style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', opacity: canEdit ? 1 : 0.5 }}
                      placeholder="0"
                      disabled={!canEdit}
                      value={cpmInputs[st.id]?.ekuitas ?? (cpmData?.find(n => n.studioId === st.id)?.ekuitas ?? '')}
                      onChange={e => setCpmInputs(prev => ({
                        ...prev,
                        [st.id]: { ...getCpmInput(st.id), ekuitas: e.target.value }
                      }))}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 12, color: kas > 0 ? 'var(--text)' : 'var(--text-muted)', padding: '8px 12px' }}>
                    {kas > 0 ? formatRp(kas) : '—'}
                    {kas > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>laporan terakhir</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                    {bulanBertahan !== null ? (
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: runwayColor }}>{runwayLabel}</span>
                        <div style={{ fontSize: 10, marginTop: 3, padding: '2px 6px', borderRadius: 4, display: 'inline-block',
                          background: runwayColor === 'var(--green)' ? 'var(--green-subtle)'
                            : runwayColor === 'var(--red)' ? 'var(--red-subtle)' : 'var(--amber-subtle)',
                          color: runwayColor }}>
                          {bulanBertahan >= 3 ? 'Aman' : bulanBertahan >= 1 ? 'Perhatian' : 'Kritis'}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {kas === 0 && cpm === 0 ? '—' : cpm === 0 ? 'Isi Pengeluaran Rutin di Bio Studio' : 'Belum lapor'}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {canEdit ? (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: 11,
                          background: isSaved ? 'var(--green)' : undefined,
                          borderColor: isSaved ? 'var(--green)' : undefined,
                        }}
                        disabled={isSaving || isSaved}
                        onClick={() => handleSaveCpm(st.id)}
                      >
                        {isSaving ? '...' : isSaved ? '✓ Tersimpan' : 'Simpan'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: list ringkas, ketuk baris untuk CPM & isian dana */}
      <div className="responsive-cards list-ringkas">
        {studios.filter(st => isFullAdminCpm || canEditCpm(st.id)).map(st => {
          const isSaving  = savingCpm[st.id]
          const isSaved   = savedCpm[st.id]
          const canEdit   = canEditCpm(st.id)
          const kas     = st.kasAkhir ?? 0
          const cpm     = st.cpmRp ?? 0
          const bulanBertahan = cpm > 0 ? kas / cpm : null
          const runwayColor = bulanBertahan === null ? 'var(--text-muted)'
            : bulanBertahan >= 3 ? 'var(--green)'
            : bulanBertahan >= 1 ? 'var(--amber)'
            : 'var(--red)'
          const runwayLabel = bulanBertahan === null ? '—'
            : bulanBertahan >= 1 ? `${bulanBertahan.toFixed(1)} bln`
            : `${(bulanBertahan * 30).toFixed(0)} hari`
          return (
            <ItemRingkas key={st.id} judul={st.nama}
              sub={`${st.tipe} · Kas rekening ${kas > 0 ? formatRp(kas) : '—'}`}
              nilai={<span style={{ color: runwayColor }}>{runwayLabel}</span>}>
              <div className="data-card-row">
                <span className="data-card-label">CPM (Rp)</span>
                <span className="data-card-value" style={{ color: cpm > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                  {cpm > 0 ? formatRp(cpm) : <span style={{ fontStyle: 'italic' }}>belum diatur</span>}
                </span>
              </div>
              <div className="data-card-row">
                <span className="data-card-label">Dana di Luar Kas (Rp)</span>
                <span className="data-card-value">
                  <input
                    type="number" min="0" className="form-input"
                    style={{ padding: '4px 8px', fontSize: 12, textAlign: 'right', width: 120, opacity: canEdit ? 1 : 0.5 }}
                    placeholder="0"
                    disabled={!canEdit}
                    value={cpmInputs[st.id]?.ekuitas ?? (cpmData?.find(n => n.studioId === st.id)?.ekuitas ?? '')}
                    onChange={e => setCpmInputs(prev => ({
                      ...prev,
                      [st.id]: { ...getCpmInput(st.id), ekuitas: e.target.value }
                    }))}
                  />
                </span>
              </div>
              <div className="data-card-row">
                <span className="data-card-label">Kas rekening</span>
                <span className="data-card-value">{kas > 0 ? formatRp(kas) : '—'}</span>
              </div>
              <div className="data-card-row">
                <span className="data-card-label">Estimasi Bertahan</span>
                <span className="data-card-value">
                  {bulanBertahan !== null ? (
                    <span style={{ fontWeight: 700, color: runwayColor }}>{runwayLabel}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {kas === 0 && cpm === 0 ? '—' : cpm === 0 ? 'Isi Pengeluaran Rutin di Bio Studio' : 'Belum lapor'}
                    </span>
                  )}
                </span>
              </div>
              {canEdit && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8, fontSize: 12, padding: '7px 12px',
                    background: isSaved ? 'var(--green)' : undefined,
                    borderColor: isSaved ? 'var(--green)' : undefined,
                  }}
                  disabled={isSaving || isSaved}
                  onClick={() => handleSaveCpm(st.id)}
                >
                  {isSaving ? '...' : isSaved ? '✓ Tersimpan' : 'Simpan'}
                </button>
              )}
            </ItemRingkas>
          )
        })}
      </div>
    </div>
  )
}
