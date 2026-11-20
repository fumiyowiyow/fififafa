import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggal } from '../../utils/format'
import { ECOSYSTEM_NAME, APP_URL } from '../../config/ecosystem'
import { alfa } from '../../utils/warna'

const CHECKLIST_KOORDINATOR = [
  {
    icon: '👤',
    judul: 'Lengkapi Profil',
    desc: 'Foto, nomor WA, Telegram, tanggal lahir, posisi/bidang',
    page: 'Profile',
    warna: 'var(--accent)',
  },
  {
    icon: '👥',
    judul: 'Data Anggota Studio',
    desc: 'Pastikan semua anggota sudah terdaftar dan datanya lengkap',
    page: 'Members',
    warna: '#0D9488',
  },
  {
    icon: '📊',
    judul: 'Laporan Omset Mingguan',
    desc: 'Isi omset per platform (Fiverr, Etsy, Upwork, Vgen, dll) setiap minggu',
    page: 'WeeklyReport',
    warna: '#1D4ED8',
  },
  {
    icon: '💰',
    judul: 'Update Saldo Rekening',
    desc: 'Perbarui saldo Rekening Bank studio kalau berubah — kas di laporan & dashboard ikut otomatis',
    page: 'Finance', params: { tab: 'forecasting' },
    warna: '#EA580C',
  },
  {
    icon: '🎯',
    judul: 'Isi Goals Studio',
    desc: 'Tentukan target dan tujuan studio untuk periode ini',
    page: 'Goals',
    warna: 'var(--pink)',
  },
  {
    icon: '🧑‍🤝‍🧑',
    judul: 'Daftarkan Calon Anggota',
    desc: 'Input calon baru ke pipeline rekrutmen jika ada',
    page: 'Rekrutmen',
    warna: 'var(--green)',
  },
  {
    icon: '🏦',
    judul: 'Setoran Koperasi',
    desc: 'Catat simpanan wajib & sukarela anggota studio setiap bulan',
    page: 'Koperasi',
    warna: 'var(--amber)',
  },
  {
    icon: '⭐',
    judul: 'Penilaian Kader',
    desc: 'Isi Penilaian Kader anggota minimal sebulan sekali — jadi Kondisi Tim di Kepatuhan Laporan',
    page: 'SDM', params: { tab: 'kader' },
    warna: 'var(--accent)',
  },
  {
    icon: '🏆',
    judul: 'Milestone Studio',
    desc: 'Catat pencapaian penting dan target yang sudah terpenuhi',
    page: 'Milestone',
    warna: 'var(--cyan)',
  },
  {
    icon: '📈',
    judul: 'Rekam Jejak Kader',
    desc: 'Pantau dan catat perkembangan anggota sebagai kader',
    page: 'Kader',
    warna: '#84cc16',
  },
  {
    icon: '📅',
    judul: 'Kalender Kegiatan',
    desc: 'Tambahkan jadwal kegiatan, rapat, dan deadline studio',
    page: 'Calendar',
    warna: '#f43f5e',
  },
]

// Diperbarui 13 Okt 2026: kas otomatis dari saldo Rekening Bank, pengeluaran dicatat per item,
// Laporan Perkembangan Kader sudah diganti Penilaian Kader (Jurnal Talent diarsipkan).
const CHECKLIST_MINGGUAN = [
  {
    icon: '📊',
    judul: 'Laporan Omset Mingguan',
    desc: 'Keuangan › Laporan Omset: isi omset per platform (Fiverr, Etsy, Upwork, VGen, dll) untuk studio kamu minggu ini',
    page: 'Finance', params: { tab: 'omset' },
    warna: '#1D4ED8',
  },
  {
    icon: '🧾',
    judul: 'Catat Pengeluaran per Item',
    desc: 'Catat tiap pengeluaran minggu ini di luar biaya rutin (THP/langganan/support sudah masuk CPM) — totalnya dihitung otomatis',
    page: 'Finance', params: { tab: 'omset' },
    warna: 'var(--red)',
  },
  {
    icon: '💰',
    judul: 'Update Saldo Rekening',
    desc: 'Kalau saldo bank berubah, perbarui lewat tombol Update Kas di Financial Forecasting',
    page: 'Finance', params: { tab: 'forecasting' },
    warna: '#EA580C',
  },
  {
    icon: '⭐',
    judul: 'Penilaian Kader',
    desc: 'SDM › Performa Kader: pastikan tiap anggota dinilai minimal sebulan sekali',
    page: 'SDM', params: { tab: 'kader' },
    warna: '#84cc16',
  },
]

const WA_REMINDER = `📋 *Checklist Mingguan ${ECOSYSTEM_NAME}*
Hai koordinator! Jangan lupa selesaikan tugas mingguan ini di dashboard:

📊 Laporan Omset Mingguan (Keuangan › Laporan Omset)
🧾 Catat Pengeluaran per Item
💰 Update Saldo Rekening kalau berubah
⭐ Penilaian Kader (minimal sebulan sekali)

👉 ${APP_URL}`

function ChecklistMingguan({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleSalin(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(WA_REMINDER).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="card" style={{ marginBottom: 24, border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: 'color-mix(in srgb, var(--green) 8%, transparent)',
        borderBottom: collapsed ? 'none' : '1px solid color-mix(in srgb, var(--green) 15%, transparent)',
        cursor: 'pointer',
      }} onClick={() => setCollapsed(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Checklist Mingguan — Koordinator ke atas</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Hal-hal yang perlu dikerjakan setiap minggu di dashboard {ECOSYSTEM_NAME}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', userSelect: 'none' }}>
          {collapsed ? '▼ Tampilkan' : '▲ Sembunyikan'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {CHECKLIST_MINGGUAN.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: 'var(--bg-surface)', borderRadius: 10,
              padding: '12px 14px', borderLeft: `3px solid ${item.warna}`,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{item.judul}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{item.desc}</div>
                <button
                  onClick={() => onNavigate(item.page, item.params)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${item.warna}`, background: `${alfa(item.warna, 9)}`, color: item.warna,
                    transition: 'all 0.15s',
                  }}>
                  Kerjakan →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!collapsed && (
        <div style={{
          padding: '0 20px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button
            onClick={handleSalin}
            style={{
              fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)',
              background: copied ? 'color-mix(in srgb, var(--green) 15%, transparent)' : 'var(--bg-surface)',
              color: copied ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {copied ? '✅ Tersalin!' : '📋 Salin Teks Reminder WA'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Tempel langsung ke grup WA koordinator
          </span>
        </div>
      )}
    </div>
  )
}

function PanduanMemulai({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 24, border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
        borderBottom: collapsed ? 'none' : '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
        cursor: 'pointer',
      }} onClick={() => setCollapsed(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Panduan Memulai — Koordinator ke atas</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              Hal-hal yang perlu dikerjakan sejak awal di dashboard {ECOSYSTEM_NAME}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', userSelect: 'none' }}>
          {collapsed ? '▼ Tampilkan' : '▲ Sembunyikan'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {CHECKLIST_KOORDINATOR.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: 'var(--bg-surface)', borderRadius: 10,
              padding: '12px 14px', borderLeft: `3px solid ${item.warna}`,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{item.judul}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{item.desc}</div>
                <button
                  onClick={() => onNavigate(item.page, item.params)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${item.warna}`, background: `${alfa(item.warna, 9)}`, color: item.warna,
                    transition: 'all 0.15s',
                  }}>
                  Kerjakan →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TARGET_OPTIONS = [
  { value: 'ALL',          label: '📣 Semua Anggota' },
  { value: 'CIRCLE',       label: '⭕ Per Circle' },
  { value: 'RUMAH_USAHA',  label: '🏠 Per Rumah Usaha' },
  { value: 'STUDIO',       label: '🎨 Per Studio' },
  { value: 'ROLE',         label: '👤 Per Role / Tier' },
]

const ROLE_OPTIONS = [
  { value: 'KOORDINATOR',      label: '🟣 Koordinator (Tetap)' },
  { value: 'PENDAMPING',       label: '🟣 Pendamping' },
  { value: 'KADER',            label: '🟠 Kader' },
  { value: 'KARYAWAN',         label: '🟠 Karyawan' },
  { value: 'MAGANG',           label: '🟢 Magang / Intern' },
  { value: 'LIVE_IN',          label: '🏠 Live In' },
  { value: 'KEPALA_CIRCLE',    label: '⭕ Kepala Circle' },
  { value: 'KEPALA_RUMAH_USAHA', label: '🏠 Kepala Rumah Usaha' },
  { value: 'ADMIN_FUNGSIONAL', label: '💰 Admin Fungsional' },
  { value: 'KEPALA_EKOSISTEM', label: '🏛 Kepala Ekosistem' },
]

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

const AVATAR_COLORS = ['var(--accent)','#0D9488','#EA580C','#1D4ED8','var(--pink)','var(--green)','var(--amber)']
function avatarColor(nama) {
  let h = 0
  for (const c of (nama ?? '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function Announcement({ onNavigate }) {
  const { user } = useAuth()
  const { data, loading, error, refetch } = useApi('/api/announcements?limit=50')
  const { data: circles } = useApi('/api/masterdata/circles')
  const { data: rumahUsahaList } = useApi('/api/masterdata/rumah-usaha')
  const { data: studios } = useApi('/api/masterdata/studios')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ judul: '', konten: '', targetTipe: 'ALL', targetId: '', kirimTelegram: false })
  const [submitting, setSubmit] = useState(false)
  const [msg, setMsg] = useState(null)

  const canPost = user?.roles?.some(r =>
    ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'].includes(r.roleType)
  )
  const isKoordinator = user?.roles?.some(r =>
    ['KOORDINATOR','PENDAMPING','ADMIN_FUNGSIONAL','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'].includes(r.roleType)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.judul.trim() || !form.konten.trim()) return
    setSubmit(true); setMsg(null)
    try {
      const res = await api.post('/api/announcements', form)
      setMsg({ type: 'success', text: res.data.message ?? 'Pengumuman berhasil dipublikasikan!' })
      setForm({ judul: '', konten: '', targetTipe: 'ALL', kirimTelegram: false })
      setShowForm(false)
      refetch()
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal membuat pengumuman' })
    } finally {
      setSubmit(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus pengumuman ini?')) return
    try {
      await api.delete(`/api/announcements/${id}`)
      refetch()
    } catch {}
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Pengumuman</h1>
            <p>Informasi & update untuk seluruh ekosistem {ECOSYSTEM_NAME}</p>
          </div>
          {canPost && (
            <button className="btn btn-primary" onClick={() => { setShowForm(v => !v); setMsg(null) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {showForm ? 'Tutup' : 'Buat Pengumuman'}
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Buat Pengumuman Baru</span>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TARGET_OPTIONS.map(t => (
                  <button key={t.value} type="button"
                    className={`btn ${form.targetTipe === t.value ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 12, padding: '8px 14px' }}
                    onClick={() => setForm(f => ({ ...f, targetTipe: t.value, targetId: '' }))}>
                    {t.label}
                  </button>
                ))}

                {/* Sub-selector: Circle */}
                {form.targetTipe === 'CIRCLE' && (
                  <select className="form-input" style={{ padding: '7px 12px', fontSize: 13, marginTop: 8, width: '100%' }}
                    value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))} required>
                    <option value="">— Pilih Circle —</option>
                    {(circles ?? []).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </select>
                )}

                {/* Sub-selector: Rumah Usaha */}
                {form.targetTipe === 'RUMAH_USAHA' && (
                  <select className="form-input" style={{ padding: '7px 12px', fontSize: 13, marginTop: 8, width: '100%' }}
                    value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))} required>
                    <option value="">— Pilih Rumah Usaha —</option>
                    {(rumahUsahaList ?? []).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.nama}
                      </option>
                    ))}
                  </select>
                )}

                {/* Sub-selector: Studio */}
                {form.targetTipe === 'STUDIO' && (
                  <select className="form-input" style={{ padding: '7px 12px', fontSize: 13, marginTop: 8, width: '100%' }}
                    value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))} required>
                    <option value="">— Pilih Studio / Project —</option>
                    {(studios ?? []).filter(s => s.statusAktif).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({(s.circle ?? s.rumahUsaha)?.nama})
                      </option>
                    ))}
                  </select>
                )}

                {/* Sub-selector: Role */}
                {form.targetTipe === 'ROLE' && (
                  <select className="form-input" style={{ padding: '7px 12px', fontSize: 13, marginTop: 8, width: '100%' }}
                    value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))} required>
                    <option value="">— Pilih Role / Tier —</option>
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Judul *</label>
              <input className="form-input" style={{ paddingLeft: 14 }}
                placeholder="Judul pengumuman..."
                value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} required />
            </div>

            <div className="form-group">
              <label className="form-label">Isi Pengumuman *</label>
              <textarea className="form-input"
                style={{ paddingLeft: 14, paddingTop: 10, minHeight: 120, resize: 'vertical' }}
                placeholder="Tulis pengumuman di sini..."
                value={form.konten} onChange={e => setForm(f => ({ ...f, konten: e.target.value }))} required />
            </div>

            {/* Toggle Telegram */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              background: form.kirimTelegram ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : 'var(--bg-surface)',
              border: `1px solid ${form.kirimTelegram ? 'color-mix(in srgb, var(--cyan) 30%, transparent)' : 'var(--border)'}`,
              borderRadius: 10, padding: '12px 16px', transition: 'all .2s' }}>
              <span style={{ fontSize: 20 }}>✈️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: form.kirimTelegram ? 'var(--cyan)' : 'var(--text)' }}>
                  Kirim ke Telegram
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Pengumuman akan dikirim langsung ke semua anggota yang sudah daftar bot
                </div>
              </div>
              <div style={{
                width: 40, height: 22, borderRadius: 99, transition: 'background .2s',
                background: form.kirimTelegram ? 'var(--cyan)' : 'var(--bg-input)',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left .2s',
                  left: form.kirimTelegram ? 20 : 3,
                }} />
              </div>
              <input type="checkbox" style={{ display: 'none' }}
                checked={form.kirimTelegram}
                onChange={e => setForm(f => ({ ...f, kirimTelegram: e.target.checked }))} />
            </label>

            {msg && (
              <div className="login-error" style={{
                background: msg.type === 'success' ? 'var(--green-subtle)' : 'var(--red-subtle)',
                color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
                borderColor: msg.type === 'success' ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'color-mix(in srgb, var(--red) 20%, transparent)',
              }}>{msg.text}</div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 160 }}>
                {submitting
                  ? <><span className="spinner"/>Mengirim...</>
                  : form.kirimTelegram ? '📣 Publikasikan + Kirim Telegram' : '📣 Publikasikan'
                }
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {isKoordinator && onNavigate && <ChecklistMingguan onNavigate={onNavigate} />}
      {isKoordinator && onNavigate && <PanduanMemulai onNavigate={onNavigate} />}

      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
          Memuat pengumuman...
        </div>
      ) : data?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Belum ada pengumuman</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data?.map(a => (
            <div key={a.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: avatarColor(a.namaPembuat),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                }}>
                  {initials(a.namaPembuat)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{a.judul}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span className={`badge ${
                        a.targetTipe === 'ALL' ? 'success' :
                        a.targetTipe === 'CIRCLE' ? 'info' :
                        a.targetTipe === 'RUMAH_USAHA' ? 'info' :
                        a.targetTipe === 'ROLE' ? 'warning' : 'purple'
                      }`}>
                        {a.targetTipe === 'ALL'          ? 'Semua' :
                         a.targetTipe === 'CIRCLE'       ? 'Circle' :
                         a.targetTipe === 'RUMAH_USAHA'  ? 'Rumah Usaha' :
                         a.targetTipe === 'STUDIO'       ? 'Studio' :
                         ROLE_OPTIONS.find(r => r.value === a.targetId)?.label.split(' ').slice(1).join(' ') ?? a.targetId}
                      </span>
                      {(a.dibuatOleh === user?.id || ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM','ADVISOR'].some(r => user?.roles?.some(ur => ur.roleType === r))) && (
                        <button onClick={() => handleDelete(a.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12, fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    {a.namaPembuat} · {formatTanggal(a.createdAt)}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {a.konten}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
