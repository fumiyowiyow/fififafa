import { useState } from 'react'
import api from '../../services/api'
import { TIPE_OPTIONS } from './constants'
import { LABEL_TIPE_UNIT, naunganNama } from '../../utils/tipeUnit'
import { useAuth } from '../../context/AuthContext'
import BadgeKolaborasi from '../../components/common/BadgeKolaborasi'

// ── StudioBioModal section: Info Dasar ───────────────────
// Digabung ke sini (bukan modal "Edit" terpisah lagi) biar gak bolak-balik buka-tutup dua modal
// buat ngedit satu studio yang sama. `info`/`setInfo` di-lift ke StudioBioModal (shell) supaya
// judul modal "Bio Studio — {nama}" ikut update live begitu disimpan, tanpa nunggu modal
// ditutup-buka lagi.

export default function StudioBioInfoDasar({ info, setInfo, canEdit, circles, rumahUsahaList, korporasiList, users, studioId, onSaved }) {
  const { user } = useAuth()
  // Menandai studio kolaborasi mengubah SEMUA total ekosistem → hanya Super Admin (server juga menolak yang lain).
  const bisaAturKolaborasi = (user?.roles ?? []).some(r => ['ADVISOR', 'KEPALA_EKOSISTEM'].includes(r.roleType))
  const [editingInfo, setEditingInfo]   = useState(false)
  const jenisNaungan = (i) => (i.induk ? 'korporasi' : i.rumahUsaha ? 'rumahUsaha' : 'circle')
  // Unit tidak bisa menjadi induk dirinya sendiri.
  const pilihanKorporasi = (korporasiList ?? []).filter(k => k.id !== studioId)
  const [infoIndukTipe, setInfoIndukTipe] = useState(jenisNaungan(info))
  const [infoForm, setInfoForm]         = useState(null)
  const [infoError, setInfoError]       = useState('')
  const [infoSaving, setInfoSaving]     = useState(false)

  const openEditInfo = () => {
    setInfoIndukTipe(jenisNaungan(info))
    setInfoForm({
      nama:          info.nama ?? '',
      circleId:      info.circle?.id     ?? (circles?.[0]?.id ?? ''),
      rumahUsahaId:  info.rumahUsaha?.id ?? (rumahUsahaList?.[0]?.id ?? ''),
      indukId:       info.induk?.id ?? (pilihanKorporasi[0]?.id ?? ''),
      tipe:          info.tipe ?? 'STUDIO',
      niche:         info.niche ?? '',
      koordinatorId: info.koordinatorId ?? '',
      statusAktif:   info.statusAktif ?? true,
      kolaborasi:    info.hitungDiEkosistem === false,
      mitraKolaborasi: info.mitraKolaborasi ?? '',
    })
    setInfoError('')
    setEditingInfo(true)
  }

  const saveInfo = async () => {
    if (!infoForm.nama.trim()) return setInfoError('Nama studio wajib diisi')
    if (infoIndukTipe === 'circle' && !infoForm.circleId) return setInfoError('Pilih Circle')
    if (infoIndukTipe === 'rumahUsaha' && !infoForm.rumahUsahaId) return setInfoError('Pilih Rumah Usaha')
    if (infoIndukTipe === 'korporasi' && !infoForm.indukId) return setInfoError('Pilih Korporasi')
    setInfoSaving(true); setInfoError('')
    const { kolaborasi, mitraKolaborasi, ...dasar } = infoForm
    const korporasi = infoForm.tipe === 'KORPORASI'
    const payload = {
      ...dasar,
      circleId:     !korporasi && infoIndukTipe === 'circle'     ? infoForm.circleId     : null,
      rumahUsahaId: !korporasi && infoIndukTipe === 'rumahUsaha' ? infoForm.rumahUsahaId : null,
      indukId:      !korporasi && infoIndukTipe === 'korporasi'  ? infoForm.indukId      : null,
      ...(bisaAturKolaborasi && { hitungDiEkosistem: !kolaborasi, mitraKolaborasi: kolaborasi ? mitraKolaborasi : '' }),
    }
    try {
      const res = await api.put(`/api/masterdata/studios/${studioId}`, payload)
      const updated = res.data.data
      setInfo({
        nama: updated.nama, circle: updated.circle ?? null, rumahUsaha: updated.rumahUsaha ?? null, induk: updated.induk ?? null,
        tipe: updated.tipe, niche: updated.niche, koordinatorId: updated.koordinatorId,
        statusAktif: updated.statusAktif,
        hitungDiEkosistem: updated.hitungDiEkosistem, mitraKolaborasi: updated.mitraKolaborasi,
      })
      setEditingInfo(false)
      onSaved?.()
    } catch (e) {
      setInfoError(e.response?.data?.message || 'Gagal menyimpan')
    } finally {
      setInfoSaving(false)
    }
  }

  return editingInfo ? (
    <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
          <label className="form-label">Nama Studio / Project *</label>
          <input className="form-input" value={infoForm.nama}
            onChange={e => setInfoForm(f => ({ ...f, nama: e.target.value }))} />
        </div>
        {infoForm.tipe === 'KORPORASI' ? (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-muted)' }}>
            Pilih tipe Korporasi HANYA untuk PT-nya sendiri — langsung di bawah ekosistem. Unit milik PT (mis. project milik PT) tetap bertipe Studio/Project, lalu pilih naungan Korporasi → nama PT-nya.
          </div>
        ) : <>
        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
          <label className="form-label">Di bawah naungan *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['circle', 'Circle'], ['rumahUsaha', 'Rumah Usaha'], ...(pilihanKorporasi.length ? [['korporasi', 'Korporasi']] : [])].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setInfoIndukTipe(key)}
                style={{
                  flex: 1, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${infoIndukTipe === key ? 'var(--accent)' : 'var(--border)'}`,
                  background: infoIndukTipe === key ? 'var(--accent-subtle)' : 'var(--bg-input)',
                  color: infoIndukTipe === key ? 'var(--accent-light)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}>{label}</button>
            ))}
          </div>
        </div>
        {infoIndukTipe === 'circle' ? (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Circle *</label>
            <select className="form-input" value={infoForm.circleId}
              onChange={e => setInfoForm(f => ({ ...f, circleId: e.target.value }))}>
              {circles?.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
            </select>
          </div>
        ) : infoIndukTipe === 'rumahUsaha' ? (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Rumah Usaha *</label>
            <select className="form-input" value={infoForm.rumahUsahaId}
              onChange={e => setInfoForm(f => ({ ...f, rumahUsahaId: e.target.value }))}>
              {rumahUsahaList?.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
            </select>
          </div>
        ) : (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Korporasi *</label>
            <select className="form-input" value={infoForm.indukId}
              onChange={e => setInfoForm(f => ({ ...f, indukId: e.target.value }))}>
              {pilihanKorporasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
        )}
        </>}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Tipe *</label>
          <select className="form-input" value={infoForm.tipe}
            onChange={e => setInfoForm(f => ({ ...f, tipe: e.target.value }))}>
            {TIPE_OPTIONS.map(t => <option key={t} value={t}>{LABEL_TIPE_UNIT[t]}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Koordinator</label>
          <select className="form-input" value={infoForm.koordinatorId}
            onChange={e => setInfoForm(f => ({ ...f, koordinatorId: e.target.value }))}>
            <option value="">— Pilih koordinator —</option>
            {users?.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
          <label className="form-label">Niche / Deskripsi</label>
          <input className="form-input" value={infoForm.niche ?? ''}
            onChange={e => setInfoForm(f => ({ ...f, niche: e.target.value }))} />
        </div>
        {bisaAturKolaborasi && (
          <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ marginTop: 3 }} checked={infoForm.kolaborasi}
                onChange={e => setInfoForm(f => ({ ...f, kolaborasi: e.target.checked }))} />
              <span>
                <span className="form-label" style={{ margin: 0 }}>Studio kolaborasi — angkanya dihitung di circle mitra</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 }}>
                  Tidak ikut total omset/kas/pengeluaran/anggota ekosistem maupun Monthly Report. Tetap aktif dan terpantau
                  (laporan mingguan, market, tim). Aman dimatikan lagi kapan saja.
                </span>
              </span>
            </label>
            {infoForm.kolaborasi && (
              <input className="form-input" style={{ marginTop: 8 }} placeholder="Nama mitra, mis. Auralist"
                value={infoForm.mitraKolaborasi} onChange={e => setInfoForm(f => ({ ...f, mitraKolaborasi: e.target.value }))} />
            )}
          </div>
        )}
        <div className="form-group" style={{ gridColumn: '1 / -1', margin: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={infoForm.statusAktif}
              onChange={e => setInfoForm(f => ({ ...f, statusAktif: e.target.checked }))} />
            <span className="form-label" style={{ margin: 0 }}>Studio aktif</span>
          </label>
        </div>
      </div>
      {infoError && <div className="login-error" style={{ marginTop: 8 }}>{infoError}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditingInfo(false)}>Batal</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={infoSaving} onClick={saveInfo}>
          {infoSaving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: (info.circle ?? info.rumahUsaha)?.colorHex ?? 'var(--text-muted)', marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{info.nama}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {naunganNama(info)} · {LABEL_TIPE_UNIT[info.tipe] ?? info.tipe}
          {info.niche && <span> · {info.niche}</span>}
          {info.koordinatorId && <span> · Koordinator: {users?.find(u => u.id === info.koordinatorId)?.nama ?? '—'}</span>}
          {!info.statusAktif && <span style={{ color: 'var(--red)' }}> · Nonaktif</span>}
        </div>
        <BadgeKolaborasi studio={info} style={{ marginTop: 6 }} />
      </div>
      {canEdit && (
        <span className="card-action" style={{ fontSize: 11, flexShrink: 0 }} onClick={openEditInfo}>Edit</span>
      )}
    </div>
  )
}
