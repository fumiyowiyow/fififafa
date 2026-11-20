import { useState } from 'react'
import { formatUSD, formatRp } from '../../utils/format'
import { PLATFORMS } from './constants'
import PengeluaranMinggu from './PengeluaranMinggu'
import LabelJalur from '../../components/common/LabelJalur'
import { bukaPengeluaran } from '../../utils/bukaPengeluaran'

const PLATFORM_HINTS = [
  { label: 'Fiverr',     desc: 'Pesanan dari buyer di Fiverr. Hitung yang sudah Completed/diterima, bukan yang masih In Progress.' },
  { label: 'Etsy',       desc: 'Penjualan dari toko Etsy. Hitung order yang sudah diproses dan dana sudah masuk.' },
  { label: 'Upwork',     desc: 'Kontrak dari Upwork yang sudah dibayar. Termasuk hourly yang sudah di-approve.' },
  { label: 'VGen',       desc: 'Komisi dari platform VGen. Hitung yang sudah selesai dan dana tersedia.' },
  { label: 'Komunitas',  desc: 'Penghasilan dari klien komunitas, kenalan, atau referral langsung (di luar marketplace).' },
  { label: 'Lainnya',    desc: 'Platform lain (Tokopedia, Instagram, dll) atau pendapatan lain yang belum masuk kategori di atas.' },
]

// ── Komponen form omset (dipakai input baru & edit) ──────
export default function OmsetForm({ form, onChange, myStudios, statusData, isEdit, onManualScore, isAutoScore, kasLive, studioId, periode }) {
  const [showHint, setShowHint] = useState(false)
  const totalUsd = PLATFORMS.reduce((s, p) => s + (Number(form[p.key]) || 0), 0)
  const totalRp  = totalUsd * form.kurs

  return (
    <>
      {!isEdit && (
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Studio / Project</label>
          <select className="form-input" style={{ paddingLeft: 14 }}
            value={form.studioId} onChange={e => onChange('studioId', e.target.value)} required>
            <option value="">-- Pilih Studio --</option>
            {myStudios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            {myStudios.length === 0 && statusData?.map(s => (
              <option key={s.id} value={s.id}>{s.nama} ({(s.circle ?? s.rumahUsaha)?.nama})</option>
            ))}
          </select>
          {form.studioId && statusData?.find(s => s.id === form.studioId)?.sudahLapor && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--amber-subtle)', color: 'var(--amber)', fontSize: 12, fontWeight: 600 }}>
              ⚠️ Studio ini sudah punya laporan minggu ini. Jika kamu submit lagi akan ditolak — gunakan tombol Edit di daftar laporan.
            </div>
          )}
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>Omset per Platform (USD)</label>
          <button type="button" onClick={() => setShowHint(h => !h)}
            style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--border)',
              background: showHint ? 'var(--accent)' : 'var(--bg-input)', color: showHint ? 'var(--on-accent)' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ?
          </button>
        </div>
        {showHint && (
          <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--accent-subtle)',
            borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-light)', marginBottom: 8 }}>
              Apa yang dihitung sebagai omset?
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6 }}>
              Masukkan pendapatan yang <strong>sudah diterima/selesai</strong> minggu ini. Pesanan yang masih proses atau pending tidak dihitung dulu.
            </div>
            {PLATFORM_HINTS.map(h => (
              <div key={h.label} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: 72, flexShrink: 0 }}>{h.label}</span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{h.desc}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Isi <strong>0</strong> untuk platform yang tidak ada pemasukan minggu ini. Jangan kosongkan.
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          {PLATFORMS.map(p => (
            <div key={p.key}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{p.label}</div>
              <input type="number" min="0" step="0.01" className="form-input" style={{ paddingLeft: 14 }}
                placeholder="0.00" value={form[p.key] ?? ''}
                onChange={e => onChange(p.key, e.target.value)} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Total USD</div>
            <strong style={{ color: 'var(--accent-light)', fontSize: 15 }}>{formatUSD(totalUsd)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Kurs (Rp/USD)</div>
            <input type="number" value={form.kurs}
              onChange={e => onChange('kurs', Number(e.target.value))}
              style={{ width: 110, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontWeight: 600, fontSize: 14 }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Estimasi IDR</div>
            <strong style={{ color: 'var(--green)', fontSize: 15 }}>{formatRp(totalRp)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Kas gak diketik lagi (13 Okt 2026) -- server yang mencatat snapshot saldo Rekening
            Bank (Bio Studio) saat laporan dikirim, dan ikut menyelaraskan laporan minggu berjalan
            tiap saldo diubah. Satu sumber kas, lihat server/src/utils/kas.js. */}
        <div className="form-group">
          <label className="form-label">{isEdit ? 'Kas rekening (tercatat minggu ini)' : 'Kas rekening (saldo di Bio Studio)'}</label>
          <div className="form-input" style={{ paddingLeft: 14, display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', fontWeight: 600 }}>
            {isEdit
              ? formatRp(form.kasSekarang ?? 0)
              : (kasLive != null ? formatRp(kasLive) : (form.studioId ? 'Memuat…' : '— pilih studio dulu'))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Otomatis dari Bio Studio › Rekening Bank. Saldo berubah? Update di sana.
          </div>
        </div>
        {/* Cuma di form laporan BARU -- "Dana di Luar Kas" itu catatan bulanan terpisah
            (StudioMonthlyNote, disimpan lewat request kedua di handleSubmit index.jsx), EditModal
            gak punya wiring buat itu (form-nya sendiri, submit ke PUT weekly-reports doang) dan
            gak butuh -- pengeditan angka lama gak perlu ngubek data bulanan yang gak terkait. */}
        {!isEdit && (
          <div className="form-group">
            <label className="form-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Dana di Luar Kas (IDR)
              <span title="Uang di luar kas fisik: saldo marketplace yang belum dicairkan, tabungan, deposit THR, dll. Opsional -- dibiarkan kosong = gak diubah, bukan di-set ke 0. Ini catatan BULANAN (per studio per bulan), bukan per minggu -- ngisi beberapa kali dalam 1 bulan cuma nimpa nilai yang sama."
                style={{ width: 15, height: 15, borderRadius: '50%', border: '1.5px solid var(--text-muted)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>?</span>
            </label>
            <input type="number" min="0" className="form-input" style={{ paddingLeft: 14 }}
              placeholder="Opsional, kosongkan kalau gak berubah" value={form.danaLuarKas}
              onChange={e => onChange('danaLuarKas', e.target.value)} />
          </div>
        )}
      </div>

      {/* Pengeluaran per item -- total mingguan dihitung server dari daftar ini (13 Okt 2026). */}
      <div className="form-group" style={{ marginBottom: 20 }}>
        <label className="form-label">Pengeluaran Minggu Ini <LabelJalur jenis="resmi" style={{ marginLeft: 4 }} /></label>
        {/* Baca saja di sini (1 Nov 2026): mencatat/menghapus cuma di Keuangan › Pengeluaran, satu tempat. */}
        <PengeluaranMinggu studioId={studioId ?? form.studioId} periodeAwal={periode?.awal} periodeAkhir={periode?.akhir} canEdit={false} />
        {(studioId ?? form.studioId) && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px', marginTop: 8 }}
            onClick={() => bukaPengeluaran(studioId ?? form.studioId)}>🧾 Catat / ubah di tab Pengeluaran →</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="form-group">
          <label className="form-label">Kendala / Catatan</label>
          <textarea className="form-input" style={{ paddingLeft: 14, resize: 'vertical', minHeight: 80, paddingTop: 10 }}
            placeholder="Opsional — ceritakan hambatan minggu ini..."
            value={form.kendala} onChange={e => onChange('kendala', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">
            Skor Semangat (1–5)
            {isAutoScore && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>🤖 otomatis</span>}
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[1,2,3,4,5].map(n => (
              <button type="button" key={n}
                onClick={() => onManualScore ? onManualScore(n) : onChange('skorSemangat', n)}
                style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 18,
                  background: form.skorSemangat === n ? 'var(--accent)' : 'var(--bg-input)',
                  border: `1px solid ${form.skorSemangat === n ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.18s',
                }}>
                {['😞','😐','🙂','😄','🔥'][n-1]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
