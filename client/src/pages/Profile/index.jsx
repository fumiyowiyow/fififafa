import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatTanggal, formatRp } from '../../utils/format'
import { getRoleLabel } from '../../utils/roles'
import { onActivate } from '../../utils/a11y'
import { alfa } from '../../utils/warna'
import { TELEGRAM_BOT } from '../../config/ecosystem'

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function avatarColor(roles) {
  const r = roles?.find(r => r.circleId || r.rumahUsahaId)
  return (r?.circle ?? r?.rumahUsaha)?.colorHex ?? 'var(--accent)'
}

// ── Hubungkan Telegram (14 Okt 2026) ─────────────────────────────────────────────────────────
// Dulu `/daftar email` di bot bisa menautkan Telegram siapa pun ke akun mana pun. Sekarang pemilik
// akun yang SUDAH LOGIN membuat kode sekali pakai (berlaku 10 menit) di sini, lalu mengirim
// `/daftar KODE` ke bot. Selama kode tampil, status kode dicek tiap 3 detik (kode terpakai = tidak
// aktif lagi) supaya kartu ini berubah sendiri begitu berhasil — juga untuk akun yang sudah tertaut.
const format = (k) => `${k.slice(0, 4)} ${k.slice(4)}`
const menitDetik = (d) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`

function TautanTelegram({ tertaut, onUbah }) {
  const [kode, setKode]           = useState(null)   // { teks, sampai }
  const [sisa, setSisa]           = useState(0)
  const [sibuk, setSibuk]         = useState(false)
  const [pesan, setPesan]         = useState(null)
  const [tersalin, setTersalin]   = useState(false)

  useEffect(() => {
    if (!kode) return
    const hitung = () => {
      const d = Math.max(0, Math.round((kode.sampai - Date.now()) / 1000))
      setSisa(d)
      if (d === 0) { setKode(null); setPesan({ ok: false, teks: 'Kode kedaluwarsa. Buat kode baru kalau masih mau menghubungkan.' }) }
    }
    hitung()
    const jam = setInterval(hitung, 1000)
    const cek = setInterval(async () => {
      try {
        const r = await api.get('/api/profile')
        // Kode sudah tidak aktif padahal belum kedaluwarsa menurut jam kita = sudah dipakai di bot.
        if (!r.data.data.telegramKodeAktif && Date.now() < kode.sampai - 1500) {
          setKode(null); setPesan({ ok: true, teks: 'Telegram berhasil terhubung. 🎉' }); onUbah(!!r.data.data.telegramTertaut)
        }
      } catch { /* jaringan putus sebentar — coba lagi di putaran berikutnya */ }
    }, 3000)
    return () => { clearInterval(jam); clearInterval(cek) }
  }, [kode]) // eslint-disable-line react-hooks/exhaustive-deps

  const buat = async () => {
    setSibuk(true); setPesan(null); setTersalin(false)
    try {
      const r = await api.post('/api/profile/telegram/kode')
      setKode({ teks: r.data.data.kode, sampai: new Date(r.data.data.kadaluarsa).getTime() })
    } catch (e) {
      setPesan({ ok: false, teks: e.response?.data?.message ?? 'Gagal membuat kode' })
    }
    setSibuk(false)
  }
  const putuskan = async () => {
    if (!window.confirm('Putuskan tautan Telegram? Kamu tidak akan menerima notifikasi bot dan tidak bisa memakai /laporan sampai menghubungkan lagi.')) return
    setSibuk(true); setPesan(null)
    try { await api.delete('/api/profile/telegram'); setKode(null); onUbah(false); setPesan({ ok: true, teks: 'Tautan Telegram diputus.' }) }
    catch (e) { setPesan({ ok: false, teks: e.response?.data?.message ?? 'Gagal memutus tautan' }) }
    setSibuk(false)
  }
  const salin = async () => {
    try { await navigator.clipboard.writeText(kode.teks); setTersalin(true); setTimeout(() => setTersalin(false), 2000) } catch { /* izin clipboard ditolak */ }
  }

  return (
    <div className="form-group" style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Bot Telegram</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Notifikasi & isi laporan mingguan lewat <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>@{TELEGRAM_BOT}</a>
          </div>
        </div>
        <span className={`badge ${tertaut ? 'success' : 'warning'}`}>{tertaut ? 'Terhubung' : 'Belum terhubung'}</span>
      </div>

      {kode ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.12em', padding: '6px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px dashed var(--accent)', color: 'var(--text)' }}>
              {format(kode.teks)}
            </code>
            <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={salin}>{tersalin ? '✓ Tersalin' : 'Salin'}</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>berlaku {menitDetik(sisa)}</span>
          </div>
          <ol style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: 18 }}>
            <li>Buka <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>@{TELEGRAM_BOT}</a> di Telegram (chat pribadi).</li>
            <li>Kirim: <code>/daftar {kode.teks}</code></li>
            <li>Halaman ini otomatis berubah begitu berhasil. Kode hanya bisa dipakai sekali — jangan dibagikan ke siapa pun.</li>
          </ol>
        </div>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }} disabled={sibuk} onClick={buat}>
            {sibuk ? 'Membuat kode…' : tertaut ? 'Pindahkan ke Telegram lain' : 'Hubungkan Telegram'}
          </button>
          {tertaut && <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} disabled={sibuk} onClick={putuskan}>Putuskan</button>}
        </div>
      )}
      {pesan && <div style={{ marginTop: 8, fontSize: 12.5, color: pesan.ok ? 'var(--green)' : 'var(--red)' }}>{pesan.teks}</div>}
    </div>
  )
}

export default function Profile({ onNavigate }) {
  const { user, logout } = useAuth()
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('profil')

  // Profile form
  const [nama,             setNama]     = useState('')
  const [telegramId,       setTelegram] = useState('')
  const [nomorWa,          setWa]       = useState('')
  const [tanggalLahir,     setTglLahir] = useState('')
  const [fotoUrl,          setFotoUrl]  = useState('')
  const [fotoError,        setFotoError] = useState(null)
  const [jenisKelamin,     setJK]       = useState('')
  const [posisi,           setPosisi]   = useState('')
  const [alamat,           setAlamat]   = useState('')
  const [namaBank,         setNamaBank] = useState('')
  const [noRekening,       setNoRek]    = useState('')
  const [atasNamaRekening, setAtasNama] = useState('')
  const [nik,              setNik]      = useState('')
  const [nomorBpjs,        setBpjs]     = useState('')
  const [saving,           setSaving]   = useState(false)
  const [profileMsg,       setProfileMsg] = useState(null)

  // Password form
  const [pwLama, setPwLama]   = useState('')
  const [pwBaru, setPwBaru]   = useState('')
  const [pwKonfirm, setPwKonfirm] = useState('')
  const [savingPw, setSavingPw]   = useState(false)
  const [pwMsg, setPwMsg]         = useState(null)

  useEffect(() => {
    api.get('/api/profile')
      .then(r => {
        setProfile(r.data.data)
        setNama(r.data.data.nama ?? '')
        setTelegram(r.data.data.telegramUsername ?? '')
        setWa(r.data.data.nomorWa ?? '')
        setTglLahir(r.data.data.tanggalLahir ? r.data.data.tanggalLahir.split('T')[0] : '')
        setFotoUrl(r.data.data.fotoUrl ?? '')
        setJK(r.data.data.jenisKelamin ?? '')
        setPosisi(r.data.data.posisi ?? '')
        setAlamat(r.data.data.alamat ?? '')
        setNamaBank(r.data.data.namaBank ?? '')
        setNoRek(r.data.data.noRekening ?? '')
        setAtasNama(r.data.data.atasNamaRekening ?? '')
        setNik(r.data.data.nik ?? '')
        setBpjs(r.data.data.nomorBpjs ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true); setProfileMsg(null)
    try {
      const r = await api.put('/api/profile', {
        nama,
        telegramUsername: telegramId || null,
        nomorWa: nomorWa || null,
        tanggalLahir: tanggalLahir || null,
        fotoUrl: fotoUrl || null,
        jenisKelamin: jenisKelamin || null,
        posisi: posisi || null,
        alamat: alamat || null,
        namaBank: namaBank || null,
        noRekening: noRekening || null,
        atasNamaRekening: atasNamaRekening || null,
        nik: nik || null,
        nomorBpjs: nomorBpjs || null,
      })
      setProfile(prev => ({ ...prev, ...r.data.data }))
      setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui!' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Gagal memperbarui profil' })
    }
    setSaving(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwBaru !== pwKonfirm) return setPwMsg({ type: 'error', text: 'Konfirmasi password tidak cocok' })
    setSavingPw(true); setPwMsg(null)
    try {
      await api.post('/api/profile/password', { passwordLama: pwLama, passwordBaru: pwBaru })
      setPwMsg({ type: 'success', text: 'Password berhasil diubah! Silakan login kembali.' })
      setPwLama(''); setPwBaru(''); setPwKonfirm('')
      setTimeout(() => logout(), 2000)
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.message || 'Gagal mengubah password' })
    }
    setSavingPw(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  const color = avatarColor(profile?.roles)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Profile Card */}
      <div className="card" style={{ marginBottom: 20, padding: 28 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#fff', flexShrink: 0,
            boxShadow: `0 0 24px ${alfa(color, 25)}`, overflow: 'hidden',
          }}>
            {profile?.fotoUrl
              ? <img src={profile.fotoUrl} alt={profile.nama} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(profile?.nama)
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{profile?.nama}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{profile?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* Role global (bukan scoped ke satu studio) tampil satu-satu -- biasanya cuma
                  segelintir, penting buat identitas cepat (Super Admin, Kepala Circle, dst).
                  Role scoped-studio (mis. Pendamping di banyak studio) DIGABUNG jadi satu badge
                  ringkas -- rinciannya sudah lengkap per-baris di § Studio & Posisi Saya di bawah,
                  gak perlu diulang di sini. Sebelumnya semua role di-flat jadi badge terpisah,
                  orang dengan banyak posisi (mis. Pendamping di 5+ studio) bio-nya jadi tembok
                  badge yang berantakan. */}
              {profile?.roles.filter(r => !r.studio).map(r => {
                const label = `${getRoleLabel(r.roleType)}${(r.circle ?? r.rumahUsaha) ? ` · ${(r.circle ?? r.rumahUsaha).nama}` : ''}`
                return (
                  // maxWidth+ellipsis -- badge role+circle (mis. "Kepala Circle · Circle Ekosistem")
                  // bisa lebih panjang dari sisa ruang di baris ini (kolom kanan Bergabung/Tanggal
                  // Lahir/Telegram fixed width di sebelahnya) -- tanpa ini teksnya nembus/tumpang
                  // tindih ke kolom kanan alih-alih terpotong rapi.
                  <span key={r.id} className="badge info" title={label}
                    style={{ fontSize: 10, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </span>
                )
              })}
              {(() => {
                const studioRoles = profile?.roles.filter(r => r.studio) ?? []
                if (studioRoles.length === 0) return null
                if (studioRoles.length === 1) {
                  const r = studioRoles[0]
                  const label = `${getRoleLabel(r.roleType)} · ${r.studio.nama}`
                  return (
                    <span className="badge info" title={label}
                      style={{ fontSize: 10, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label}
                    </span>
                  )
                }
                return (
                  <span className="badge" style={{ fontSize: 10, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }} title={studioRoles.map(r => `${getRoleLabel(r.roleType)} · ${r.studio.nama}`).join(', ')}>
                    + {studioRoles.length} posisi studio
                  </span>
                )
              })()}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bergabung</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatTanggal(profile?.tanggalMasuk)}</div>
            {profile?.tanggalLahir && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, marginBottom: 2 }}>Tanggal Lahir</div>
                {/* lineHeight eksplisit -- glyph emoji "🎂" sering punya metrik font lebih tinggi
                    dari teks biasa, kalau gak di-set bisa nabrak baris "Telegram" di bawahnya. */}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                  🎂 {formatTanggal(profile.tanggalLahir)}
                </div>
              </>
            )}
            {profile?.telegramUsername && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, marginBottom: 2 }}>Telegram</div>
                <div style={{ fontSize: 13, color: 'var(--cyan)' }}>@{profile.telegramUsername}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Studio & Posisi Saya */}
      {(profile?.roles?.length > 0 || profile?.studioPemilik?.length > 0) && (
        <div className="card" style={{ marginBottom: 20, padding: 24 }}>
          <div className="card-header" style={{ marginBottom: 14 }}>
            <span className="card-title">🏢 Studio & Posisi Saya</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profile.roles.map(r => {
              const orgUnit = r.circle ?? r.rumahUsaha
              const label   = r.studio?.nama ?? orgUnit?.nama ?? '—'
              const sub     = r.studio ? orgUnit?.nama : null
              // THP melekat langsung ke posisi (UserRole.takeHomePay), SHU dihitung on-the-fly
              // dari StudioPemilik (studio.totalShu * persenSaham/100) -- sama pola persis kayak
              // computeTotalKompensasi di server/src/utils/compensation.js, cuma di sini per-studio.
              const pemilik = r.studio ? profile.studioPemilik?.find(p => p.studio?.id === r.studio.id) : null
              const shu = pemilik?.studio?.statusShu ? (pemilik.studio.totalShu * pemilik.persenSaham) / 100 : null
              const goStudio = r.studio ? () => onNavigate?.('MasterData', { autoStudio: r.studio.id }) : null
              return (
                <div key={r.id} onClick={goStudio}
                  role={goStudio ? 'button' : undefined} tabIndex={goStudio ? 0 : undefined}
                  onKeyDown={goStudio ? onActivate(goStudio) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10,
                    cursor: goStudio ? 'pointer' : 'default', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (goStudio) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={e => { if (goStudio) e.currentTarget.style.background = 'var(--bg-surface)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: orgUnit?.colorHex ?? 'var(--text-muted)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
                    {(r.takeHomePay > 0 || shu > 0) && (
                      <div style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {r.takeHomePay > 0 && (
                          <span style={{ color: 'var(--green)', fontWeight: 600 }}>THP {formatRp(r.takeHomePay)}</span>
                        )}
                        {shu > 0 && (
                          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                            SHU {formatRp(shu)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pemilik.persenSaham}%)</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="badge info" style={{ fontSize: 10, flexShrink: 0 }}>{getRoleLabel(r.roleType)}</span>
                </div>
              )
            })}
            {/* Studio yang dimiliki (StudioPemilik) tapi gak punya posisi kerja di situ -- tetap
                ditampilin biar SHU-nya kelihatan, gak nyelip cuma karena gak ada UserRole. */}
            {(profile.studioPemilik ?? [])
              .filter(p => p.studio && !profile.roles.some(r => r.studio?.id === p.studio.id))
              .map(p => {
                const shu = p.studio.statusShu ? (p.studio.totalShu * p.persenSaham) / 100 : null
                const goStudio = () => onNavigate?.('MasterData', { autoStudio: p.studio.id })
                return (
                  <div key={`pemilik-${p.id}`} onClick={goStudio}
                    role="button" tabIndex={0} onKeyDown={onActivate(goStudio)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 10,
                      cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: 'var(--text-muted)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.studio.nama}</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                          SHU {shu != null ? formatRp(shu) : '—'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({p.persenSaham}%)</span>
                        </span>
                      </div>
                    </div>
                    <span className="badge" style={{ fontSize: 10, flexShrink: 0 }}>Pemilik Saham</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {['profil','password'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 13, padding: '9px 20px', textTransform: 'capitalize' }}
            onClick={() => setTab(t)}>
            {t === 'profil' ? '👤 Edit Profil' : '🔒 Ganti Password'}
          </button>
        ))}
        <button className="btn btn-ghost" style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 30%, transparent)', fontSize: 13 }}
          onClick={logout}>
          Keluar
        </button>
      </div>

      {/* Tab: Profil */}
      {tab === 'profil' && (
        <div className="card" style={{ padding: 28 }}>
          <div className="card-header" style={{ marginBottom: 20 }}>
            <span className="card-title">Informasi Profil</span>
          </div>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Foto Profil */}
            <div className="form-group">
              <label className="form-label">Foto Profil</label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 14, background: color, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, color: '#fff', overflow: 'hidden',
                  border: '2px solid var(--border)',
                }}>
                  {fotoUrl
                    ? <img src={fotoUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials(nama || profile?.nama)
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" id="foto-upload"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 10 * 1024 * 1024) {
                        setFotoError('Ukuran file maksimal 10 MB')
                        e.target.value = ''
                        return
                      }
                      setFotoError(null)
                      const reader = new FileReader()
                      reader.onload = ev => {
                        // Kompres ke max 300x300px, JPEG 85% — hasilnya ~15-40KB
                        const img = new Image()
                        img.onload = () => {
                          const MAX = 300
                          const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
                          const canvas = document.createElement('canvas')
                          canvas.width  = Math.round(img.width  * ratio)
                          canvas.height = Math.round(img.height * ratio)
                          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                          setFotoUrl(canvas.toDataURL('image/jpeg', 0.85))
                        }
                        img.src = ev.target.result
                      }
                      reader.readAsDataURL(file)
                    }}
                  />
                  <label htmlFor="foto-upload" className="btn btn-ghost"
                    style={{ cursor: 'pointer', display: 'inline-block', fontSize: 13 }}>
                    📷 Pilih Foto
                  </label>
                  {fotoUrl && (
                    <button type="button" onClick={() => setFotoUrl('')}
                      style={{ marginLeft: 8, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ✕ Hapus
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    JPG / PNG / WebP · Maks. 10 MB · otomatis dikompres ke ~300×300px
                  </div>
                  {fotoError && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{fotoError}</div>}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input className="form-input" style={{ paddingLeft: 14 }}
                value={nama} onChange={e => setNama(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" style={{ paddingLeft: 14, opacity: 0.6 }}
                value={profile?.email ?? ''} disabled />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Email tidak bisa diubah</div>
            </div>
            <div className="form-group">
              <label className="form-label">Telegram Username (tanpa @)</label>
              <div className="input-wrap">
                <span className="input-icon" style={{ fontSize: 14 }}>@</span>
                <input className="form-input" style={{ paddingLeft: 28 }}
                  placeholder="username_telegram"
                  value={telegramId} onChange={e => setTelegram(e.target.value)} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Hanya untuk tampilan (mis. kalender ulang tahun). Untuk menerima notifikasi bot, hubungkan akunmu di bawah.
              </div>
            </div>
            <TautanTelegram tertaut={!!profile?.telegramTertaut} onUbah={(v) => setProfile(p => ({ ...p, telegramTertaut: v }))} />
            <div className="form-group">
              <label className="form-label">Nomor WhatsApp</label>
              <input className="form-input" style={{ paddingLeft: 14 }}
                placeholder="08xxxxxxxxxx"
                value={nomorWa} onChange={e => setWa(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Lahir</label>
              <input type="date" className="form-input" style={{ paddingLeft: 14 }}
                value={tanggalLahir} onChange={e => setTglLahir(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                🎂 Akan muncul di Kalender Ekosistem sebagai hari ulang tahun
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Data Tambahan
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Jenis Kelamin</label>
                    <select className="form-input" style={{ paddingLeft: 10 }}
                      value={jenisKelamin} onChange={e => setJK(e.target.value)}>
                      <option value="">— Pilih —</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Posisi / Jabatan</label>
                    <input className="form-input" style={{ paddingLeft: 14 }}
                      placeholder="3D Artist, Admin, Rigger, dll"
                      value={posisi} onChange={e => setPosisi(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Alamat Rumah</label>
                  <input className="form-input" style={{ paddingLeft: 14 }}
                    placeholder="Jl. ..."
                    value={alamat} onChange={e => setAlamat(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nama Bank</label>
                    <input className="form-input" style={{ paddingLeft: 14 }}
                      placeholder="BCA, Mandiri, BRI, dll"
                      value={namaBank} onChange={e => setNamaBank(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. Rekening</label>
                    <input className="form-input" style={{ paddingLeft: 14 }}
                      placeholder="0123456789"
                      value={noRekening} onChange={e => setNoRek(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Atas Nama Rekening</label>
                    <input className="form-input" style={{ paddingLeft: 14 }}
                      placeholder="Nama sesuai rekening"
                      value={atasNamaRekening} onChange={e => setAtasNama(e.target.value)} />
                  </div>
                </div>

                {/* NIK & BPJS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">NIK (KTP)</label>
                    <input className="form-input" style={{ paddingLeft: 14 }}
                      placeholder="16 digit NIK"
                      maxLength={16}
                      value={nik} onChange={e => setNik(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No. BPJS Kesehatan</label>
                    <input className="form-input" style={{ paddingLeft: 14 }}
                      placeholder="13 digit no. BPJS"
                      maxLength={13}
                      value={nomorBpjs} onChange={e => setBpjs(e.target.value)} />
                  </div>
                </div>

                {/* Total Kompensasi — read-only, gabungan THP dari semua studio + SHU yang pernah
                    diterima. THP sekarang melekat per posisi/studio, diedit dari Bio Studio oleh
                    admin studio/circle-nya, bukan self-report lagi. */}
                {profile?.totalKompensasi != null && (
                  <div className="form-group">
                    <label className="form-label">Total Pendapatan 🔒</label>
                    <div className="form-input" style={{ paddingLeft: 14, color: 'var(--green)', fontWeight: 700, background: 'var(--bg-subtle)', cursor: 'default' }}>
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(profile.totalKompensasi)}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      THP: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(profile.totalThp)}
                      {' · '}
                      SHU: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(profile.totalShu)}
                      {' — diatur oleh admin studio'}
                    </span>
                  </div>
                )}

              </div>
            </div>

            {profileMsg && (
              <div className="login-error" style={{
                background: profileMsg.type === 'success' ? 'var(--green-subtle)' : 'var(--red-subtle)',
                color: profileMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
                borderColor: profileMsg.type === 'success' ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'color-mix(in srgb, var(--red) 20%, transparent)',
              }}>{profileMsg.text}</div>
            )}

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', minWidth: 150 }}>
              {saving ? <><span className="spinner"/>Menyimpan...</> : 'Simpan Profil'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Password */}
      {tab === 'password' && (
        <div className="card" style={{ padding: 28 }}>
          <div className="card-header" style={{ marginBottom: 20 }}>
            <span className="card-title">Ganti Password</span>
          </div>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { label: 'Password Lama', val: pwLama, set: setPwLama },
              { label: 'Password Baru (min. 8 karakter)', val: pwBaru, set: setPwBaru },
              { label: 'Konfirmasi Password Baru', val: pwKonfirm, set: setPwKonfirm },
            ].map(f => (
              <div key={f.label} className="form-group">
                <label className="form-label">{f.label}</label>
                <input type="password" className="form-input" style={{ paddingLeft: 14 }}
                  placeholder="••••••••" value={f.val}
                  onChange={e => f.set(e.target.value)} required />
              </div>
            ))}

            {pwMsg && (
              <div className="login-error" style={{
                background: pwMsg.type === 'success' ? 'var(--green-subtle)' : 'var(--red-subtle)',
                color: pwMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
                borderColor: pwMsg.type === 'success' ? 'color-mix(in srgb, var(--green) 20%, transparent)' : 'color-mix(in srgb, var(--red) 20%, transparent)',
              }}>{pwMsg.text}</div>
            )}

            <button type="submit" className="btn btn-primary" disabled={savingPw} style={{ alignSelf: 'flex-start', minWidth: 160 }}>
              {savingPw ? <><span className="spinner"/>Mengubah...</> : '🔒 Ubah Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
