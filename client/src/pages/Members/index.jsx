import { useState, useMemo, useEffect } from 'react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../context/AuthContext'
import { getRoleLabel, getHighestRole, ROLE_TIER, TIER_BADGE, STATUS_KEANGGOTAAN, STATUS_PROGRAM_SISWA, getRoleOrgUnit, getRoleCircle, getRoleRumahUsaha } from '../../utils/roles'
import api from '../../services/api'
import { downloadCsv } from '../../utils/csv'
import { ECOSYSTEM_NAME } from '../../config/ecosystem'
import { onActivate } from '../../utils/a11y'

function initials(nama) {
  return nama?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function getCircleColor(roles) {
  const orgUnit = roles?.map(getRoleOrgUnit).find(Boolean)
  return orgUnit?.colorHex ?? 'var(--text-muted)'
}

function getStudioName(roles) {
  const r = roles?.find(r => r.studio)
  return r?.studio?.nama ?? null
}

function getCircleName(roles) {
  const orgUnit = roles?.map(getRoleOrgUnit).find(Boolean)
  return orgUnit?.nama ?? null
}

// Sama persis sama kriteria "Total Anggota" di server/src/controllers/dashboard.js -- akun yang
// SEMUA role-nya (atau nol role sama sekali) cuma PENGELOLA_DANA/DIGNITY/PENDAMPING (tag/posisi
// administratif, bukan anggota tim operasional harian) dianggap "akun khusus", gak masuk hitungan
// tim kerja Dashboard. Ditandain di sini biar gak bingung liat 154 vs 123 di dua halaman beda.
const NON_TEAM_ROLES = ['PENGELOLA_DANA', 'DIGNITY', 'PENDAMPING']
function isAkunKhusus(roles) {
  if (!roles?.length) return true
  return roles.every(r => NON_TEAM_ROLES.includes(r.roleType))
}

const TIER_BG = {
  tetap:    { bg: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)' },
  karyawan: { bg: '#EA580C22', color: '#EA580C' },
  magang:   { bg: '#84CC1622', color: '#84CC16' },
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} title="Salin"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--text-muted)', fontSize: 12, padding: '2px 6px' }}>
      {copied ? '✓' : '⎘'}
    </button>
  )
}

const ROLE_OPTIONS = ['MAGANG','KARYAWAN','KADER','DIGNITY','PENASIHAT','PENDAMPING','KOORDINATOR','ADMIN_FUNGSIONAL','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM']

function LiveInToggle({ memberId, isLiveIn, onUpdated }) {
  const [live, setLive]     = useState(isLiveIn)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    setSaving(true)
    try {
      const res = await api.patch(`/api/members/${memberId}/livein`)
      setLive(res.data.data.isLiveIn)
      onUpdated?.()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <button onClick={toggle} disabled={saving}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none',
        border: 'none', cursor: 'pointer', padding: 0,
      }}>
      <div style={{
        width: 36, height: 20, borderRadius: 99, transition: 'background .2s',
        background: live ? 'var(--cyan)' : 'var(--bg-input)',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, transition: 'left .2s',
          left: live ? 18 : 3,
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: live ? 'var(--cyan)' : 'var(--text-muted)' }}>
        {saving ? '…' : live ? '🏠 Live In' : 'Non Live In'}
      </span>
    </button>
  )
}

function KoperasiToggle({ memberId, isAnggotaKoperasi, onUpdated }) {
  const [aktif, setAktif]   = useState(isAnggotaKoperasi)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    setSaving(true)
    try {
      const res = await api.patch(`/api/members/${memberId}/koperasi`)
      setAktif(res.data.data.isAnggotaKoperasi)
      onUpdated?.()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <button onClick={toggle} disabled={saving}
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <div style={{
        width: 36, height: 20, borderRadius: 99, transition: 'background .2s',
        background: aktif ? 'var(--green)' : 'var(--bg-input)', position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, transition: 'left .2s', left: aktif ? 18 : 3,
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: aktif ? 'var(--green)' : 'var(--text-muted)' }}>
        {saving ? '…' : aktif ? '🏦 Anggota Koperasi' : 'Bukan Anggota'}
      </span>
    </button>
  )
}

function MemberDrawer({ member, onClose, onNonaktifkan, onRoleUpdated, canManage, isSuperAdmin = false, studios = [] }) {
  const [confirming, setConfirming]         = useState(false)
  const [loading, setLoading]               = useState(false)
  const [resetMode, setResetMode]           = useState(false)
  const [newPassword, setNewPassword]       = useState('')
  const [resetLoading, setResetLoading]     = useState(false)
  const [resetMsg, setResetMsg]             = useState(null)
  const [grantMode, setGrantMode]           = useState(false)
  const [grantEmail, setGrantEmail]         = useState('')
  const [grantPassword, setGrantPassword]   = useState('')
  const [grantLoading, setGrantLoading]     = useState(false)
  const [grantMsg, setGrantMsg]             = useState(null)
  const [editMode, setEditMode]             = useState(false)
  const [editForm, setEditForm]             = useState({
    nama: member.nama, nomorWa: member.nomorWa ?? '', telegramUsername: member.telegramUsername ?? '',
    tanggalLahir: member.tanggalLahir ? new Date(member.tanggalLahir).toISOString().split('T')[0] : '',
    tanggalMasuk: member.tanggalMasuk ? new Date(member.tanggalMasuk).toISOString().split('T')[0] : '',
    jenisKelamin: member.jenisKelamin ?? '', posisi: member.posisi ?? '', alamat: member.alamat ?? '',
    noRekening: member.noRekening ?? '', atasNamaRekening: member.atasNamaRekening ?? '',
    nik: member.nik ?? '', nomorBpjs: member.nomorBpjs ?? '',
    statusKeanggotaan: member.statusKeanggotaan ?? '', kelas: member.kelas ?? '', sekolah: member.sekolah ?? '',
    tinggalDengan: member.tinggalDengan ?? '', rekamJejak: member.rekamJejak ?? '',
  })
  const [editLoading, setEditLoading]       = useState(false)
  const [editMsg, setEditMsg]               = useState(null)
  const [editRoleId, setEditRoleId]         = useState(null)
  const [editRoleForm, setEditRoleForm]     = useState({ studioId: '', roleType: '' })
  const [savingRole, setSavingRole]         = useState(false)
  const [showAddRole, setShowAddRole]       = useState(false)
  const [addRoleForm, setAddRoleForm]       = useState({ studioId: '', roleType: 'KOORDINATOR' })
  const [addingRole, setAddingRole]         = useState(false)

  // Posisi level-ekosistem (bukan scoped ke satu studio) -- Co-Admin/Kepala Ekosistem/Super Admin/
  // Pengelola Dana selalu tanpa cakupan (circleId/rumahUsahaId kosong); Kepala Circle/Kepala Rumah
  // Usaha/Admin Fungsional butuh pilih Circle atau Rumah Usaha. Ditambahkan 25 Juli 2026 --
  // sebelumnya role-role ini cuma bisa di-set saat bikin anggota baru atau lewat SQL manual di VPS,
  // gak ada cara nambahin ke anggota yang SUDAH ada dari UI sama sekali.
  const ECOSYSTEM_ROLES = ['ADVISOR','KEPALA_EKOSISTEM','PENGELOLA_DANA','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','ADMIN_FUNGSIONAL']
  const { data: masterdata } = useApi('/api/masterdata')
  const circles         = masterdata?.circles ?? []
  const rumahUsahaList  = masterdata?.rumahUsaha ?? []
  const [showAddEko, setShowAddEko]         = useState(false)
  const [addEkoForm, setAddEkoForm]         = useState({ roleType: 'ADVISOR', cakupan: '' })
  const [addingEko, setAddingEko]           = useState(false)
  const [editEkoId, setEditEkoId]           = useState(null)
  const [editEkoForm, setEditEkoForm]       = useState({ roleType: '', cakupan: '' })
  const [savingEko, setSavingEko]           = useState(false)

  const cakupanToScope = (cakupan) => {
    const [tipe, id] = (cakupan || '').split(':')
    return { circleId: tipe === 'circle' ? id : null, rumahUsahaId: tipe === 'rumah' ? id : null }
  }
  const scopeToCakupan = (r) => r.circleId ? `circle:${r.circleId}` : r.rumahUsahaId ? `rumah:${r.rumahUsahaId}` : ''

  const handleAddEkoRole = async () => {
    setAddingEko(true)
    try {
      await api.post(`/api/members/${member.id}/roles`, { roleType: addEkoForm.roleType, ...cakupanToScope(addEkoForm.cakupan) })
      setShowAddEko(false)
      setAddEkoForm({ roleType: 'ADVISOR', cakupan: '' })
      onRoleUpdated()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menambah posisi') }
    setAddingEko(false)
  }

  const handleEditEkoRole = async () => {
    setSavingEko(true)
    try {
      await api.patch(`/api/members/roles/${editEkoId}`, { roleType: editEkoForm.roleType, ...cakupanToScope(editEkoForm.cakupan) })
      setEditEkoId(null)
      onRoleUpdated()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    setSavingEko(false)
  }

  const STUDIO_ROLES = ['KOORDINATOR','PENDAMPING','KADER','KARYAWAN','MAGANG','DIGNITY','PENASIHAT','ADMIN_FUNGSIONAL','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA']

  const handleEditRole = async () => {
    setSavingRole(true)
    try {
      // circleId/rumahUsahaId gak perlu dikirim -- posisi ini studio-scoped (dropdown-nya cuma
      // STUDIO_ROLES), server nurunkan circle dari studio.circleId sendiri. Sebelumnya di sini
      // ngirim circleId studio yang dipilih SAAT INI, yang jadi snapshot basi kalau studionya
      // dipindah circle belakangan -- itu sumber circle filter di Anggota suka salah/kosong.
      await api.patch(`/api/members/roles/${editRoleId}`, {
        roleType: editRoleForm.roleType,
        studioId: editRoleForm.studioId || null,
      })
      setEditRoleId(null)
      onRoleUpdated()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menyimpan') }
    setSavingRole(false)
  }

  const handleAddRole = async () => {
    if (!addRoleForm.studioId) return alert('Pilih studio terlebih dahulu')
    setAddingRole(true)
    try {
      // circleId/rumahUsahaId gak perlu dikirim -- lihat komentar sama di handleEditRole.
      await api.post(`/api/members/${member.id}/roles`, {
        roleType: addRoleForm.roleType,
        studioId: addRoleForm.studioId,
      })
      setShowAddRole(false)
      setAddRoleForm({ studioId: '', roleType: 'KOORDINATOR' })
      onRoleUpdated()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menambah posisi') }
    setAddingRole(false)
  }

  const handleRemoveRole = async (roleId) => {
    if (!confirm('Hapus posisi ini dari anggota?')) return
    try {
      await api.delete(`/api/members/roles/${roleId}`)
      onRoleUpdated()
    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus') }
  }

  const doEditProfile = async () => {
    setEditLoading(true); setEditMsg(null)
    try {
      await api.patch(`/api/members/${member.id}/profile`, editForm)
      setEditMsg({ ok: true, text: 'Data berhasil diperbarui' })
      setTimeout(() => { setEditMode(false); setEditMsg(null); onRoleUpdated() }, 1500)
    } catch (e) {
      setEditMsg({ ok: false, text: e.response?.data?.message || 'Gagal menyimpan' })
    } finally { setEditLoading(false) }
  }

  const doResetPassword = async () => {
    if (newPassword.length < 8) return setResetMsg({ ok: false, text: 'Minimal 8 karakter' })
    setResetLoading(true)
    setResetMsg(null)
    try {
      const res = await api.patch(`/api/members/${member.id}/reset-password`, { newPassword })
      setResetMsg({ ok: true, text: res.data.message })
      setNewPassword('')
      setTimeout(() => { setResetMode(false); setResetMsg(null) }, 2000)
    } catch (e) {
      setResetMsg({ ok: false, text: e.response?.data?.message || 'Gagal reset password' })
    } finally { setResetLoading(false) }
  }

  const isShellAccount = /^noaccount-.+@[a-z0-9-]+\.internal$/.test(member.email ?? '')

  const doGrantAccess = async () => {
    if (!grantEmail.trim()) return setGrantMsg({ ok: false, text: 'Email wajib diisi' })
    if (grantPassword.length < 8) return setGrantMsg({ ok: false, text: 'Password minimal 8 karakter' })
    setGrantLoading(true)
    setGrantMsg(null)
    try {
      const res = await api.patch(`/api/members/${member.id}/grant-access`, { email: grantEmail, newPassword: grantPassword })
      setGrantMsg({ ok: true, text: res.data.message })
      setTimeout(() => { setGrantMode(false); setGrantMsg(null); setGrantPassword(''); onRoleUpdated() }, 2000)
    } catch (e) {
      setGrantMsg({ ok: false, text: e.response?.data?.message || 'Gagal mengaktifkan akses login' })
    } finally { setGrantLoading(false) }
  }

  const top   = getHighestRole(member.roles)
  const color = getCircleColor(member.roles)

  const doNonaktifkan = async () => {
    setLoading(true)
    try {
      await api.patch(`/api/members/${member.id}/nonaktifkan`)
      onNonaktifkan()
    } catch (e) {
      alert(e.response?.data?.message || 'Gagal menonaktifkan')
    } finally { setLoading(false) }
  }

  const studioRoles = member.roles.filter(r => r.studio)
  // Semua posisi BUKAN scoped-studio: circle-scoped (Kepala Circle), rumah-usaha-scoped (Kepala
  // Rumah Usaha), ATAU tanpa cakupan sama sekali (Co-Admin/Kepala Ekosistem/Super Admin/Pengelola
  // Dana). Sebelumnya cuma nangkep yang circle-scoped (circleRoles) -- role rumah-usaha-scoped dan
  // yang scope-less gak pernah muncul di drawer sama sekali (cuma keliatan sebagai badge read-only
  // di ringkasan atas).
  const ekosistemRoles = member.roles.filter(r => !r.studio)

  // Ringkasan role di atas drawer -- dikelompokkan per roleType (bukan 1 badge per UserRole)
  // biar gak numpuk belasan badge kalau orangnya punya banyak posisi (mis. Pendamping di 10+
  // studio). Detail per-studio (termasuk edit/hapus tiap posisi) tetap ada di section
  // "Studio & Posisi Saya" di bawah -- badge ringkasan ini READ-ONLY, gak perlu diulang jadi
  // interaktif juga di sini.
  const roleGroups = Object.entries(
    member.roles.reduce((acc, r) => ({ ...acc, [r.roleType]: (acc[r.roleType] ?? 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        {/* Header */}
        <div className="drawer-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Biodata Anggota</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {/* Avatar + Nama */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="drawer-avatar" style={{ background: color }}>
              {initials(member.nama)}
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{member.nama}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {top ? getRoleLabel(top.roleType) : 'Tanpa posisi'}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
              {roleGroups.map(([roleType, count]) => {
                const tier  = ROLE_TIER[roleType] ?? 'magang'
                const color = TIER_BG[tier]
                return (
                  <span key={roleType} className="drawer-role-tag" style={{ background: color.bg, color: color.color }}>
                    {getRoleLabel(roleType)}{count > 1 && ` ×${count}`}
                  </span>
                )
              })}
            </div>
            {canManage && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Detail & ubah posisi di bagian "Studio / Project" di bawah
              </div>
            )}
            {isAkunKhusus(member.roles) && (
              <div title="Bukan bagian tim kerja studio/circle -- gak masuk hitungan Total Anggota di Dashboard"
                style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', color: 'var(--text-muted)' }}>
                ✦ Akun Khusus — di luar hirarki tim
              </div>
            )}
          </div>

          {/* Kontak */}
          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="drawer-section-title" style={{ marginBottom: 0 }}>Informasi Kontak</div>
              {canManage && !editMode && (
                <button onClick={() => { setEditMode(true); setConfirming(false); setResetMode(false) }}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                  ✎ Edit
                </button>
              )}
            </div>

            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: 'nama',             label: 'Nama Lengkap' },
                  { key: 'nomorWa',          label: 'WhatsApp' },
                  { key: 'telegramUsername', label: 'Username Telegram (tanpa @)' },
                  { key: 'posisi',           label: 'Posisi / Jabatan (3D Artist, Admin, dll)' },
                  { key: 'alamat',           label: 'Alamat Rumah' },
                  { key: 'noRekening',       label: 'No. Rekening' },
                  { key: 'atasNamaRekening', label: 'Atas Nama Rekening' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                    <input value={editForm[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { key: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date' },
                    { key: 'tanggalMasuk', label: 'Tanggal Bergabung', type: 'date' },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                      <input type={type} value={editForm[key]}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Jenis Kelamin</div>
                  <select value={editForm.jenisKelamin} onChange={e => setEditForm(f => ({ ...f, jenisKelamin: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13 }}>
                    <option value="">—</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Status Keanggotaan (label, bukan hak akses)</div>
                  <select value={editForm.statusKeanggotaan} onChange={e => setEditForm(f => ({ ...f, statusKeanggotaan: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">— ikut tier role —</option>
                    {Object.entries(STATUS_KEANGGOTAAN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {STATUS_PROGRAM_SISWA.includes(editForm.statusKeanggotaan) && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Kelas</div>
                        <input value={editForm.kelas} onChange={e => setEditForm(f => ({ ...f, kelas: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Sekolah</div>
                        <input value={editForm.sekolah} onChange={e => setEditForm(f => ({ ...f, sekolah: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Tinggal Dengan (Orang Tua / Asrama / Lainnya)</div>
                      <input value={editForm.tinggalDengan} onChange={e => setEditForm(f => ({ ...f, tinggalDengan: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Rekam Jejak 🔒</div>
                      <textarea rows={4} value={editForm.rekamJejak} onChange={e => setEditForm(f => ({ ...f, rekamJejak: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  </>
                )}
                {/* THP dipindah — sekarang diedit per posisi/studio lewat Bio Studio (MasterData), bukan di sini */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>NIK 🔒</div>
                    <input value={editForm.nik}
                      onChange={e => setEditForm(f => ({ ...f, nik: e.target.value }))}
                      placeholder="16 digit NIK"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>No. BPJS 🔒</div>
                    <input value={editForm.nomorBpjs}
                      onChange={e => setEditForm(f => ({ ...f, nomorBpjs: e.target.value }))}
                      placeholder="No. BPJS Kesehatan"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                </div>
                {editMsg && (
                  <span style={{ fontSize: 12, color: editMsg.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {editMsg.text}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEditMode(false); setEditMsg(null) }}
                    className="btn btn-ghost" style={{ flex: 1 }}>Batal</button>
                  <button onClick={doEditProfile} disabled={editLoading}
                    style={{ flex: 2, padding: '8px', borderRadius: 8, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: editLoading ? 0.6 : 1 }}>
                    {editLoading ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Email</span>
                  <span className="drawer-info-value">{member.email}</span>
                  <CopyButton text={member.email} />
                </div>
                <div className="drawer-info-row">
                  <span className="drawer-info-label">WhatsApp</span>
                  <span className="drawer-info-value" style={{ color: member.nomorWa ? 'var(--text)' : 'var(--text-muted)' }}>
                    {member.nomorWa || '—'}
                  </span>
                  {member.nomorWa && <CopyButton text={member.nomorWa} />}
                </div>
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Telegram</span>
                  <span className="drawer-info-value" style={{ color: member.telegramUsername ? 'var(--text)' : 'var(--text-muted)' }}>
                    {member.telegramUsername ? `@${member.telegramUsername}` : '—'}
                  </span>
                </div>
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Jenis Kelamin</span>
                  <span className="drawer-info-value" style={{ color: member.jenisKelamin ? 'var(--text)' : 'var(--text-muted)' }}>
                    {member.jenisKelamin ? (member.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') : '—'}
                  </span>
                </div>
                {member.statusKeanggotaan && (
                  <div className="drawer-info-row">
                    <span className="drawer-info-label">Status</span>
                    <span className="drawer-info-value">{STATUS_KEANGGOTAAN[member.statusKeanggotaan]?.label}</span>
                  </div>
                )}
                {STATUS_PROGRAM_SISWA.includes(member.statusKeanggotaan) && [
                  ['Kelas', member.kelas], ['Sekolah', member.sekolah], ['Tinggal', member.tinggalDengan],
                ].map(([label, val]) => (
                  <div key={label} className="drawer-info-row">
                    <span className="drawer-info-label">{label}</span>
                    <span className="drawer-info-value" style={{ color: val ? 'var(--text)' : 'var(--text-muted)' }}>{val || '—'}</span>
                  </div>
                ))}
                {STATUS_PROGRAM_SISWA.includes(member.statusKeanggotaan) && member.rekamJejak && (
                  <div style={{ marginTop: 8 }}>
                    <div className="drawer-info-label" style={{ marginBottom: 4 }}>Rekam Jejak</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{member.rekamJejak}</div>
                  </div>
                )}
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Posisi</span>
                  <span className="drawer-info-value" style={{ color: member.posisi ? 'var(--text)' : 'var(--text-muted)' }}>
                    {member.posisi || '—'}
                  </span>
                </div>
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Alamat</span>
                  <span className="drawer-info-value" style={{ fontSize: 12, color: member.alamat ? 'var(--text)' : 'var(--text-muted)' }}>
                    {member.alamat || '—'}
                  </span>
                </div>
                {canManage && (
                  <div className="drawer-info-row">
                    <span className="drawer-info-label">Rekening</span>
                    <span className="drawer-info-value" style={{ color: member.noRekening ? 'var(--text)' : 'var(--text-muted)' }}>
                      {member.noRekening ? `${member.noRekening} (${member.atasNamaRekening || '—'})` : '—'}
                    </span>
                    {member.noRekening && <CopyButton text={member.noRekening} />}
                  </div>
                )}
                {canManage && (
                  <div className="drawer-info-row">
                    <span className="drawer-info-label">Total Pendapatan 🔒</span>
                    <span className="drawer-info-value" style={{ color: member.totalKompensasi ? 'var(--green)' : 'var(--text-muted)', fontWeight: member.totalKompensasi ? 700 : 400 }}>
                      {member.totalKompensasi
                        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(member.totalKompensasi)
                        : '—'}
                    </span>
                  </div>
                )}
                {canManage && (
                  <div className="drawer-info-row">
                    <span className="drawer-info-label">NIK 🔒</span>
                    <span className="drawer-info-value" style={{ color: member.nik ? 'var(--text)' : 'var(--text-muted)' }}>
                      {member.nik || '—'}
                    </span>
                    {member.nik && <CopyButton text={member.nik} />}
                  </div>
                )}
                {canManage && (
                  <div className="drawer-info-row">
                    <span className="drawer-info-label">No. BPJS 🔒</span>
                    <span className="drawer-info-value" style={{ color: member.nomorBpjs ? 'var(--text)' : 'var(--text-muted)' }}>
                      {member.nomorBpjs || '—'}
                    </span>
                    {member.nomorBpjs && <CopyButton text={member.nomorBpjs} />}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Studio & Circle */}
          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="drawer-section-title" style={{ marginBottom: 0 }}>Studio / Project</div>
              {canManage && !showAddRole && (
                <button onClick={() => { setShowAddRole(true); setEditRoleId(null) }}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                  + Tambah Posisi
                </button>
              )}
            </div>

            {studioRoles.map(r => (
              <div key={r.id}>
                {editRoleId === r.id ? (
                  <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <select value={editRoleForm.studioId} onChange={e => setEditRoleForm(f => ({ ...f, studioId: e.target.value }))}
                        style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                        <option value="">— Pilih Studio —</option>
                        {studios.map(s => <option key={s.id} value={s.id}>{s.nama} ({s.circle?.nama})</option>)}
                      </select>
                      <select value={editRoleForm.roleType} onChange={e => setEditRoleForm(f => ({ ...f, roleType: e.target.value }))}
                        style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                        {STUDIO_ROLES.map(rt => <option key={rt} value={rt}>{getRoleLabel(rt)}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditRoleId(null)} className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}>Batal</button>
                        <button onClick={handleEditRole} disabled={savingRole} className="btn btn-primary" style={{ flex: 2, fontSize: 12 }}>
                          {savingRole ? 'Menyimpan…' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="drawer-info-row" style={{ alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: getRoleOrgUnit(r)?.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.studio?.nama}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getRoleLabel(r.roleType)} · {getRoleOrgUnit(r)?.nama}</div>
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => { setEditRoleId(r.id); setShowAddRole(false); setEditRoleForm({ studioId: r.studioId ?? '', roleType: r.roleType }) }}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          Pindah
                        </button>
                        {member.roles.length > 1 && (
                          <button onClick={() => handleRemoveRole(r.id)}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', background: 'var(--red-subtle)', color: 'var(--red)', cursor: 'pointer' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {studioRoles.length === 0 && !showAddRole && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>Belum ada posisi di studio</div>
            )}

            {showAddRole && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 10, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Tambah Posisi Baru</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select value={addRoleForm.studioId} onChange={e => setAddRoleForm(f => ({ ...f, studioId: e.target.value }))}
                    style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                    <option value="">— Pilih Studio —</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.nama} ({s.circle?.nama})</option>)}
                  </select>
                  <select value={addRoleForm.roleType} onChange={e => setAddRoleForm(f => ({ ...f, roleType: e.target.value }))}
                    style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                    {STUDIO_ROLES.map(rt => <option key={rt} value={rt}>{getRoleLabel(rt)}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setShowAddRole(false)} className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}>Batal</button>
                    <button onClick={handleAddRole} disabled={addingRole} className="btn btn-primary" style={{ flex: 2, fontSize: 12 }}>
                      {addingRole ? 'Menambah…' : 'Tambah'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(ekosistemRoles.length > 0 || isSuperAdmin) && (
            <div className="drawer-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="drawer-section-title" style={{ marginBottom: 0 }}>Role Ekosistem</div>
                {/* Nambah/ubah/hapus role level-ekosistem cuma buat Super Admin (ADVISOR/
                    KEPALA_EKOSISTEM) -- selaras sama canAssignScope() server: role tanpa cakupan
                    (Kepala Ekosistem, Super Admin, Pengelola Dana) HANYA bisa di-assign
                    Super Admin, siapa pun selain itu bakal ke-403 walau tombolnya kelihatan. Manajer
                    studio/circle biasa (Koordinator, Kepala Circle, dst) masih bisa LIHAT role di
                    sini (mis. tahu siapa Pendamping-nya), cuma gak bisa ubah. */}
                {isSuperAdmin && !showAddEko && (
                  <button onClick={() => { setShowAddEko(true); setEditEkoId(null) }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                    + Tambah Posisi
                  </button>
                )}
              </div>

              {ekosistemRoles.map(r => (
                <div key={r.id}>
                  {editEkoId === r.id ? (
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <select value={editEkoForm.roleType} onChange={e => setEditEkoForm(f => ({ ...f, roleType: e.target.value }))}
                          style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                          {ECOSYSTEM_ROLES.map(rt => <option key={rt} value={rt}>{getRoleLabel(rt)}</option>)}
                        </select>
                        <select value={editEkoForm.cakupan} onChange={e => setEditEkoForm(f => ({ ...f, cakupan: e.target.value }))}
                          style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                          <option value="">— Ekosistem (tanpa cakupan) —</option>
                          {circles.length > 0 && (
                            <optgroup label="Circle">
                              {circles.map(c => <option key={c.id} value={`circle:${c.id}`}>{c.nama}</option>)}
                            </optgroup>
                          )}
                          {rumahUsahaList.length > 0 && (
                            <optgroup label="Rumah Usaha">
                              {rumahUsahaList.map(ru => <option key={ru.id} value={`rumah:${ru.id}`}>{ru.nama}</option>)}
                            </optgroup>
                          )}
                        </select>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setEditEkoId(null)} className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}>Batal</button>
                          <button onClick={handleEditEkoRole} disabled={savingEko} className="btn btn-primary" style={{ flex: 2, fontSize: 12 }}>
                            {savingEko ? 'Menyimpan…' : 'Simpan'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="drawer-info-row" style={{ alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: getRoleOrgUnit(r)?.colorHex ?? 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="drawer-info-value" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getRoleOrgUnit(r)?.nama ?? 'Ekosistem (tanpa cakupan)'}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{getRoleLabel(r.roleType)}</span>
                      {isSuperAdmin && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                          <button onClick={() => { setEditEkoId(r.id); setShowAddEko(false); setEditEkoForm({ roleType: r.roleType, cakupan: scopeToCakupan(r) }) }}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            ✎
                          </button>
                          {member.roles.length > 1 && (
                            <button onClick={() => handleRemoveRole(r.id)}
                              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid color-mix(in srgb, var(--red) 40%, transparent)', background: 'var(--red-subtle)', color: 'var(--red)', cursor: 'pointer' }}>
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {showAddEko && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Tambah Posisi Ekosistem</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select value={addEkoForm.roleType} onChange={e => setAddEkoForm(f => ({ ...f, roleType: e.target.value }))}
                      style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                      {ECOSYSTEM_ROLES.map(rt => <option key={rt} value={rt}>{getRoleLabel(rt)}</option>)}
                    </select>
                    <select value={addEkoForm.cakupan} onChange={e => setAddEkoForm(f => ({ ...f, cakupan: e.target.value }))}
                      style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', width: '100%' }}>
                      <option value="">— Ekosistem (tanpa cakupan) —</option>
                      {circles.length > 0 && (
                        <optgroup label="Circle">
                          {circles.map(c => <option key={c.id} value={`circle:${c.id}`}>{c.nama}</option>)}
                        </optgroup>
                      )}
                      {rumahUsahaList.length > 0 && (
                        <optgroup label="Rumah Usaha">
                          {rumahUsahaList.map(ru => <option key={ru.id} value={`rumah:${ru.id}`}>{ru.nama}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Co-Admin / Kepala Ekosistem / Super Admin / Pengelola Dana biarkan "Ekosistem (tanpa cakupan)". Kepala Circle / Kepala Rumah Usaha wajib pilih Circle atau Rumah Usaha.
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setShowAddEko(false)} className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}>Batal</button>
                      <button onClick={handleAddEkoRole} disabled={addingEko} className="btn btn-primary" style={{ flex: 2, fontSize: 12 }}>
                        {addingEko ? 'Menambah…' : 'Tambah'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {ekosistemRoles.length === 0 && !showAddEko && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>Belum ada posisi level-ekosistem</div>
              )}
            </div>
          )}

          {/* Info Bergabung */}
          <div className="drawer-section">
            <div className="drawer-section-title">Info Keanggotaan</div>
            <div className="drawer-info-row">
              <span className="drawer-info-label">Bergabung</span>
              <span className="drawer-info-value">
                {new Date(member.tanggalMasuk).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            {(() => {
              const masuk = new Date(member.tanggalMasuk)
              const now = new Date()
              const bulan = (now.getFullYear() - masuk.getFullYear()) * 12 + (now.getMonth() - masuk.getMonth())
              const thn = Math.floor(bulan / 12)
              const bln = bulan % 12
              return (
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Usia Karir</span>
                  <span className="drawer-info-value">{thn > 0 ? `${thn} th ` : ''}{bln} bln</span>
                </div>
              )
            })()}
            {member.tanggalLahir && (() => {
              const lahir = new Date(member.tanggalLahir)
              const now = new Date()
              const usia = now.getFullYear() - lahir.getFullYear() - (now < new Date(now.getFullYear(), lahir.getMonth(), lahir.getDate()) ? 1 : 0)
              return (
                <div className="drawer-info-row">
                  <span className="drawer-info-label">Tanggal Lahir</span>
                  <span className="drawer-info-value">
                    {lahir.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · {usia} tahun
                  </span>
                </div>
              )
            })()}
            <div className="drawer-info-row">
              <span className="drawer-info-label">Status</span>
              <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>● Aktif</span>
            </div>
            <div className="drawer-info-row">
              <span className="drawer-info-label">Live In</span>
              {canManage ? (
                <LiveInToggle memberId={member.id} isLiveIn={member.isLiveIn} onUpdated={onRoleUpdated} />
              ) : (
                <span style={{ fontWeight: 600, fontSize: 13, color: member.isLiveIn ? 'var(--cyan)' : 'var(--text-muted)' }}>
                  {member.isLiveIn ? '🏠 Ya' : '—'}
                </span>
              )}
            </div>
            <div className="drawer-info-row">
              <span className="drawer-info-label">Koperasi</span>
              {canManage ? (
                <KoperasiToggle memberId={member.id} isAnggotaKoperasi={member.isAnggotaKoperasi} onUpdated={onRoleUpdated} />
              ) : (
                <span style={{ fontWeight: 600, fontSize: 13, color: member.isAnggotaKoperasi ? 'var(--green)' : 'var(--text-muted)' }}>
                  {member.isAnggotaKoperasi ? '🏦 Ya' : '—'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer — tombol reset password + nonaktifkan */}
        {canManage && (
          <div className="drawer-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Aktifkan Akses Login — cuma buat akun shell (dibuat tanpa email/password, mis. dari
                Kepemilikan Saham atau onboarding "cuma buat pencatatan"). Ganti Reset Password biasa
                karena akun shell gak punya email asli buat login sama sekali. */}
            {isShellAccount && (
              !grantMode ? (
                <button onClick={() => { setGrantMode(true); setResetMode(false); setConfirming(false) }}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--accent-subtle)', color: 'var(--accent-light)', border: '1px solid var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  🔓 Aktifkan Akses Login
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    Akun <strong>{member.nama}</strong> belum bisa login (dibuat tanpa email). Isi email & password biar bisa akses dashboard.
                  </p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={grantEmail}
                    onChange={e => setGrantEmail(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                  <input
                    type="password"
                    placeholder="Password awal (min. 8 karakter)"
                    value={grantPassword}
                    onChange={e => setGrantPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doGrantAccess()}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                  {grantMsg && (
                    <span style={{ fontSize: 12, color: grantMsg.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {grantMsg.text}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setGrantMode(false); setGrantEmail(''); setGrantPassword(''); setGrantMsg(null) }}
                      className="btn btn-ghost" style={{ flex: 1 }}>Batal</button>
                    <button onClick={doGrantAccess} disabled={grantLoading}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: grantLoading ? 0.6 : 1 }}>
                      {grantLoading ? 'Menyimpan…' : 'Aktifkan'}
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Reset Password */}
            {!isShellAccount && (!resetMode ? (
              <button onClick={() => { setResetMode(true); setConfirming(false) }}
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Reset Password
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Set password baru untuk <strong>{member.nama}</strong>
                </p>
                <input
                  type="password"
                  placeholder="Password baru (min. 8 karakter)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doResetPassword()}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                />
                {resetMsg && (
                  <span style={{ fontSize: 12, color: resetMsg.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {resetMsg.text}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setResetMode(false); setNewPassword(''); setResetMsg(null) }}
                    className="btn btn-ghost" style={{ flex: 1 }}>Batal</button>
                  <button onClick={doResetPassword} disabled={resetLoading}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--cyan)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: resetLoading ? 0.6 : 1 }}>
                    {resetLoading ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </div>
            ))}

            {/* Nonaktifkan */}
            {!confirming ? (
              <button onClick={() => { setConfirming(true); setResetMode(false) }}
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--red-subtle)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Nonaktifkan Anggota (Resign)
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Yakin nonaktifkan <strong>{member.nama}</strong>? Akun tidak bisa login lagi.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirming(false)} className="btn btn-ghost" style={{ flex: 1 }}>Batal</button>
                  <button onClick={doNonaktifkan} disabled={loading}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--red)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Memproses…' : 'Ya, Nonaktifkan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function OnboardModal({ onClose, onSuccess }) {
  const { data: masterdata } = useApi('/api/masterdata')
  const [form, setForm] = useState({ nama: '', email: '', passwordAwal: '', roleType: 'MAGANG', cakupan: '', studioId: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const circles     = masterdata?.circles ?? []
  const rumahUsahaList = masterdata?.rumahUsaha ?? []
  const [cakupanTipe, cakupanId] = form.cakupan.split(':')
  const studios = masterdata?.studios?.filter(s => {
    if (!form.cakupan) return false
    return cakupanTipe === 'circle' ? s.circleId === cakupanId : s.rumahUsahaId === cakupanId
  }) ?? []

  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'cakupan' ? { studioId: '' } : {}) }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/members', {
        nama:         form.nama,
        email:        form.email,
        passwordAwal: form.passwordAwal,
        roleType:     form.roleType,
        circleId:     cakupanTipe === 'circle' ? cakupanId : null,
        rumahUsahaId: cakupanTipe === 'rumah'  ? cakupanId : null,
        studioId:     form.studioId  || null,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambahkan anggota')
    } finally { setLoading(false) }
  }

  const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <span style={{ fontWeight: 700, fontSize: 15 }}>Tambah Anggota Baru</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <form onSubmit={submit} className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nama Lengkap *</label>
            <input style={inputStyle} value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama lengkap" required />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="nama@domain-anda.com" required />
          </div>
          <div>
            <label style={labelStyle}>Password Awal *</label>
            <input style={inputStyle} type="text" minLength={10} autoComplete="new-password" placeholder="minimal 10 karakter, beri tahu langsung ke orangnya" value={form.passwordAwal} onChange={e => set('passwordAwal', e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Role *</label>
            <select style={inputStyle} value={form.roleType} onChange={e => set('roleType', e.target.value)}>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Circle / Rumah Usaha</label>
            <select style={inputStyle} value={form.cakupan} onChange={e => set('cakupan', e.target.value)}>
              <option value="">— Pilih Circle / Rumah Usaha —</option>
              {circles.length > 0 && (
                <optgroup label="Circle">
                  {circles.map(c => <option key={c.id} value={`circle:${c.id}`}>{c.nama}</option>)}
                </optgroup>
              )}
              {rumahUsahaList.length > 0 && (
                <optgroup label="Rumah Usaha">
                  {rumahUsahaList.map(r => <option key={r.id} value={`rumah:${r.id}`}>{r.nama}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Studio / Project</label>
            <select style={inputStyle} value={form.studioId} onChange={e => set('studioId', e.target.value)} disabled={!form.cakupan}>
              <option value="">— Pilih Studio —</option>
              {studios.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>

          {error && <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{error}</span>}

          <div className="drawer-footer" style={{ display: 'flex', gap: 8, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Batal</button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, padding: '10px', borderRadius: 10, background: 'var(--purple)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Menyimpan…' : 'Tambah Anggota'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default function Members({ openUserId }) {
  const { user }                           = useAuth()
  const { data: members, loading, error, refetch } = useApi('/api/members?limit=200')
  const { data: allStudios } = useApi('/api/kanban/studios')
  const [search, setSearch]         = useState('')
  const [circleFilter, setCircle]   = useState('Semua')
  const [rumahUsahaFilter, setRumahUsaha] = useState('Semua')
  const [tierFilter, setTier]       = useState('Semua')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [studioFilter, setStudio]   = useState('Semua')
  const [viewMode, setViewMode]     = useState('grid')
  const [selected, setSelected]     = useState(null)
  const [showOnboard, setShowOnboard] = useState(false)

  // getAll (list) sengaja tidak nyertain totalKompensasi (biar THP per-posisi nggak bocor ke
  // direktori umum) — begitu drawer dibuka, langsung tarik detail lengkap dari getById supaya
  // "Total Kompensasi" kelihatan tanpa nunggu aksi lain (mis. edit role) yang kebetulan refetch.
  const openMember = (m) => {
    setSelected(m)
    api.get(`/api/members/${m.id}`).then(res => setSelected(res.data.data)).catch(() => {})
  }

  useEffect(() => {
    if (!openUserId || !members) return
    const m = members.find(m => m.id === openUserId)
    if (m) openMember(m)
  }, [openUserId, members])

  const isAdmin       = user?.roles?.some(r => ['ADVISOR','KEPALA_EKOSISTEM'].includes(r.roleType))
  const isKepalaCircle = user?.roles?.some(r => r.roleType === 'KEPALA_CIRCLE')
  const isKepalaRumahUsaha = user?.roles?.some(r => r.roleType === 'KEPALA_RUMAH_USAHA')
  const myCircleIds   = new Set(user?.roles?.filter(r => r.circleId).map(r => r.circleId) ?? [])
  const myRumahUsahaIds = new Set(user?.roles?.filter(r => r.rumahUsahaId).map(r => r.rumahUsahaId) ?? [])
  const myStudioIds   = new Set(user?.roles?.filter(r => r.studioId).map(r => r.studioId) ?? [])
  // Studio yang caller BENERAN boleh kelola anggotanya -- cuma role KOORDINATOR/PENDAMPING yang
  // hitung (sama persis canManageMember() di server/src/utils/roles.js). myStudioIds di atas
  // dipakai buat kebutuhan lain (mis. filter tampilan studio sendiri), jangan dipakai buat
  // otorisasi -- KARYAWAN/KADER studio-scoped juga masuk myStudioIds tapi bukan berarti dia
  // boleh kelola sesama anggota studionya.
  const myManagerStudioIds = new Set(
    user?.roles?.filter(r => ['KOORDINATOR', 'PENDAMPING'].includes(r.roleType) && r.studioId).map(r => r.studioId) ?? []
  )
  const canManage     = user?.roles?.some(r => ['ADVISOR','KOORDINATOR','PENDAMPING','KEPALA_EKOSISTEM','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA'].includes(r.roleType))

  // r.circleId/r.rumahUsahaId di role si TARGET cuma keisi kalau role itu SENDIRI circle/rumah-
  // usaha-scoped (mis. ADMIN_FUNGSIONAL, KADER, KEPALA_CIRCLE) -- buat mayoritas staf yang
  // studio-scoped (KOORDINATOR, PENDAMPING, KARYAWAN, MAGANG), field itu null, jadi harus dicek
  // lewat r.studio?.circleId/rumahUsahaId (circle/rumah usaha PEMILIK studio-nya), sama persis
  // kayak canManageMember di server/src/utils/roles.js. Sebelumnya cuma cek r.circleId langsung
  // -> Kepala Circle/Rumah Usaha gak bisa edit data sensitif (rekening/NIK/BPJS) siapa pun yang
  // studio-scoped di circle/rumah usaha-nya sendiri, walau server sebenarnya mengizinkan.
  const canManageMember = (member) => {
    if (isAdmin) return true
    if (isKepalaCircle && member?.roles?.some(r => myCircleIds.has(r.circleId) || myCircleIds.has(r.studio?.circleId))) return true
    if (isKepalaRumahUsaha && member?.roles?.some(r => myRumahUsahaIds.has(r.rumahUsahaId) || myRumahUsahaIds.has(r.studio?.rumahUsahaId))) return true
    return member?.roles?.some(r => myManagerStudioIds.has(r.studioId))
  }

  const circles = useMemo(() => {
    if (!members) return []
    const names = [...new Set(members.flatMap(m => m.roles.map(r => getRoleCircle(r)?.nama).filter(Boolean)))]
    return ['Semua', ...names]
  }, [members])

  // Rumah Usaha sejajar Circle (unit organisasi lain, bukan sub-Circle) -- sebelumnya filter di
  // halaman ini cuma nyediain Circle, jadi anggota studio yang naung ke Rumah Usaha gak bisa
  // difilter lewat kontrol manapun sama sekali.
  const rumahUsahaList = useMemo(() => {
    if (!members) return []
    const names = [...new Set(members.flatMap(m => m.roles.map(r => getRoleRumahUsaha(r)?.nama).filter(Boolean)))]
    return ['Semua', ...names]
  }, [members])

  const filtered = useMemo(() => {
    if (!members) return []
    return members.filter(m => {
      const matchSearch = m.nama.toLowerCase().includes(search.toLowerCase())
      const matchCircle = circleFilter === 'Semua' || m.roles.some(r => getRoleCircle(r)?.nama === circleFilter)
      const matchRumahUsaha = rumahUsahaFilter === 'Semua' || m.roles.some(r => getRoleRumahUsaha(r)?.nama === rumahUsahaFilter)
      const matchTier   = tierFilter   === 'Semua' || (() => {
        const top = getHighestRole(m.roles)
        return ROLE_TIER[top?.roleType] === tierFilter.toLowerCase()
      })()
      const matchStudio = studioFilter === 'Semua' || m.roles.some(r => r.studio?.nama === studioFilter)
      const matchStatus = statusFilter === 'Semua' || m.statusKeanggotaan === statusFilter
      return matchSearch && matchCircle && matchRumahUsaha && matchTier && matchStudio && matchStatus
    })
  }, [members, search, circleFilter, rumahUsahaFilter, tierFilter, studioFilter, statusFilter])

  const groupedByStudio = useMemo(() => {
    const map = new Map()
    filtered.forEach(m => {
      const studioRoles = m.roles.filter(r => r.studio)
      if (studioRoles.length === 0) {
        const key = '— Tanpa Studio'
        if (!map.has(key)) map.set(key, { nama: key, colorHex: 'var(--text-muted)', members: [] })
        map.get(key).members.push(m)
      } else {
        studioRoles.forEach(r => {
          const key = r.studio.nama
          if (!map.has(key)) map.set(key, { nama: key, colorHex: getRoleOrgUnit(r)?.colorHex ?? 'var(--text-muted)', members: [] })
          if (!map.get(key).members.find(mem => mem.id === m.id)) map.get(key).members.push(m)
        })
      }
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const counts = useMemo(() => {
    if (!members) return { tetap: 0, karyawan: 0, magang: 0 }
    return members.reduce((acc, m) => {
      const top = getHighestRole(m.roles)
      const tier = ROLE_TIER[top?.roleType]
      if (tier) acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, { tetap: 0, karyawan: 0, magang: 0 })
  }, [members])

  const handleDownloadCsv = () => {
    const rows = (filtered ?? []).map(m => {
      const top = getHighestRole(m.roles)
      return {
        'Nama':              m.nama,
        'Email':             m.email ?? '',
        'No WA':             m.nomorWa ?? '',
        'Telegram':          m.telegramId ?? '',
        'Role':              getRoleLabel(top?.roleType) || '',
        'Circle':            getCircleName(m.roles) ?? '',
        'Studio':            getStudioName(m.roles) ?? '',
        'Live In':           m.isLiveIn ? 'Ya' : 'Tidak',
        'Anggota Koperasi':  m.isAnggotaKoperasi ? 'Ya' : 'Tidak',
        'Tanggal Masuk':     m.tanggalMasuk ? m.tanggalMasuk.slice(0, 10) : '',
      }
    })
    downloadCsv(`${ECOSYSTEM_NAME}-Anggota-${new Date().toISOString().slice(0,10)}.csv`, rows)
  }

  return (
    <>
      {/* Summary */}
      <div className="stat-grid">
        {[
          {
            label: 'Total Anggota', val: members?.length ?? '—', color: 'purple',
            // Breakdown eksplisit di sini biar gak bingung liat angka beda sama "Total Anggota"
            // di Dashboard (yang cuma ngitung tim kerja) -- kriteria sama persis kayak isAkunKhusus.
            sub: members ? `${members.length - members.filter(m => isAkunKhusus(m.roles)).length} tim kerja · ${members.filter(m => isAkunKhusus(m.roles)).length} akun khusus` : null,
          },
          { label: '🟣 Pengurus Inti', val: counts.tetap,         color: 'purple' },
          { label: '🟠 Staf',          val: counts.karyawan,      color: 'amber'  },
          { label: '🟢 Magang',        val: counts.magang,        color: 'green'  },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '…' : s.val}</div>
            {s.sub && !loading && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {/* Row 1: Search + Tambah */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, marginBottom: 0, position: 'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input placeholder="Cari nama anggota..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 2 }}>
                ✕
              </button>
            )}
          </div>
          {canManage && (
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={handleDownloadCsv} disabled={!filtered?.length} title="Download CSV">
              ↓ CSV
            </button>
          )}
          {canManage && (
            <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}
              onClick={() => setShowOnboard(true)}>
              + Tambah Anggota
            </button>
          )}
        </div>

        {/* Row 2: Circle filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>CIRCLE</span>
          {circles.map(c => (
            <button key={c} className={`btn ${circleFilter === c ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => { setCircle(circleFilter === c && c !== 'Semua' ? 'Semua' : c); setRumahUsaha('Semua'); setStudio('Semua') }}>
              {c}
            </button>
          ))}
        </div>

        {/* Row 2b: Rumah Usaha filter -- sejajar Circle (unit organisasi lain, bukan sub-Circle) */}
        {rumahUsahaList.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>RUMAH USAHA</span>
            {rumahUsahaList.map(ru => (
              <button key={ru} className={`btn ${rumahUsahaFilter === ru ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => { setRumahUsaha(rumahUsahaFilter === ru && ru !== 'Semua' ? 'Semua' : ru); setCircle('Semua'); setStudio('Semua') }}>
                {ru}
              </button>
            ))}
          </div>
        )}

        {/* Row 2c: Status keanggotaan (label kategori, bukan hak akses) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>STATUS</span>
          {['Semua', ...Object.keys(STATUS_KEANGGOTAAN)].map(st => (
            <button key={st} className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setStatusFilter(statusFilter === st && st !== 'Semua' ? 'Semua' : st)}>
              {st === 'Semua' ? 'Semua Status' : STATUS_KEANGGOTAAN[st].label}
            </button>
          ))}
        </div>

        {/* Row 3: Tier + Studio + View mode */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>TIER</span>
            {['Semua','tetap','karyawan','magang'].map(t => (
              <button key={t} className={`btn ${tierFilter === t ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setTier(tierFilter === t && t !== 'Semua' ? 'Semua' : t)}>
                {t === 'Semua' ? 'Semua Tier' : TIER_BADGE[t]?.label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STUDIO</span>
            <select
              value={studioFilter}
              onChange={e => setStudio(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
                background: studioFilter !== 'Semua' ? 'var(--accent)' : 'var(--bg-card)',
                color: studioFilter !== 'Semua' ? '#fff' : 'var(--text)', cursor: 'pointer', outline: 'none' }}>
              <option value="Semua">Semua Studio</option>
              {(allStudios ?? [])
                .filter(s => circleFilter === 'Semua' || s.circle?.nama === circleFilter)
                .filter(s => rumahUsahaFilter === 'Semua' || s.rumahUsaha?.nama === rumahUsahaFilter)
                .map(s => <option key={s.id} value={s.nama}>{s.nama}</option>)}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {[
              { mode: 'grid',   icon: '⊞', title: 'Tampilan Grid' },
              { mode: 'studio', icon: '📋', title: 'Kelompok per Studio' },
            ].map(v => (
              <button key={v.mode} title={v.title}
                onClick={() => setViewMode(v.mode)}
                style={{ padding: '6px 10px', fontSize: 15, borderRadius: 8, border: '1px solid var(--border)',
                  background: viewMode === v.mode ? 'var(--accent)' : 'var(--bg-card)',
                  color: viewMode === v.mode ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
                {v.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        {!loading && members && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>
              Menampilkan <strong style={{ color: filtered.length < members.length ? 'var(--accent-light)' : 'var(--text)' }}>{filtered.length}</strong> dari <strong style={{ color: 'var(--text)' }}>{members.length}</strong> anggota
            </span>
            {(search || circleFilter !== 'Semua' || rumahUsahaFilter !== 'Semua' || tierFilter !== 'Semua' || studioFilter !== 'Semua' || statusFilter !== 'Semua') && (
              <button
                onClick={() => { setSearch(''); setCircle('Semua'); setRumahUsaha('Semua'); setTier('Semua'); setStudio('Semua') }}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                ✕ Reset filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card" style={{ height: 180, opacity: 0.3, background: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : viewMode === 'studio' ? (
        /* ---- VIEW PER STUDIO ---- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groupedByStudio.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              Tidak ada anggota yang cocok
            </div>
          )}
          {groupedByStudio.map(([studioName, studioData]) => (
            <div key={studioName}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: studioData.colorHex, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{studioName}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-surface)',
                  padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                  {studioData.members.length} anggota
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div className="member-grid">
                {studioData.members.map(m => {
                  const top   = getHighestRole(m.roles)
                  // Fallback ke tier 'magang' cuma buat roleType yang KEBETULAN gak dikenal
                  // ROLE_TIER (defensif) -- BUKAN buat akun tanpa role sama sekali (top null),
                  // itu bukan berarti Magang, malah sebaliknya bukan bagian tim operasional.
                  const tier  = top ? (ROLE_TIER[top.roleType] ?? 'magang') : null
                  const color = getCircleColor(m.roles)
                  // Badge tier disembunyikan buat akun khusus -- DIGNITY/PENGELOLA_DANA
                  // di-bucket ke tier 'karyawan'/'tetap' cuma buat hitungan agregat Dashboard,
                  // BUKAN berarti orangnya beneran Karyawan/Tetap. Nampilin badge itu di kartu
                  // per-orang malah nyesatin (kontradiksi sama badge "Akun Khusus" di sebelahnya).
                  const badge = STATUS_KEANGGOTAAN[m.statusKeanggotaan] ?? ((tier && !isAkunKhusus(m.roles)) ? TIER_BADGE[tier] : null)
                  return (
                    <div key={m.id} className="member-card" onClick={() => openMember(m)}
                      role="button" tabIndex={0} onKeyDown={onActivate(() => openMember(m))}
                      style={{ cursor: 'pointer' }}>
                      <div className="member-avatar" style={{ background: color }}>{initials(m.nama)}</div>
                      <div>
                        <div className="member-name">{m.nama}</div>
                        <div className="member-role">{top ? getRoleLabel(top.roleType) : 'Tanpa posisi'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {badge && <span className={`badge ${badge.cls}`}>{badge.label}</span>}
                        {isAkunKhusus(m.roles) && (
                          <span title="Bukan bagian tim kerja studio/circle -- gak masuk hitungan Total Anggota di Dashboard"
                            style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                              background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', color: 'var(--text-muted)' }}>✦ Akun Khusus</span>
                        )}
                        {m.isLiveIn && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: 'color-mix(in srgb, var(--cyan) 15%, transparent)', color: 'var(--cyan)' }}>🏠 Live In</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ---- VIEW GRID BIASA ---- */
        <div className="member-grid">
          {filtered.map(m => {
            const top    = getHighestRole(m.roles)
            // Fallback ke tier 'magang' cuma buat roleType yang KEBETULAN gak dikenal ROLE_TIER
            // (defensif) -- BUKAN buat akun tanpa role sama sekali (top null), itu bukan berarti
            // Magang, malah sebaliknya bukan bagian tim operasional (lihat isAkunKhusus).
            const tier   = top ? (ROLE_TIER[top.roleType] ?? 'magang') : null
            const color  = getCircleColor(m.roles)
            // Badge tier disembunyikan buat akun khusus -- lihat komentar sama di view per-studio.
            const badge  = STATUS_KEANGGOTAAN[m.statusKeanggotaan] ?? ((tier && !isAkunKhusus(m.roles)) ? TIER_BADGE[tier] : null)
            const studio = getStudioName(m.roles)
            const circle = getCircleName(m.roles)

            return (
              <div key={m.id} className="member-card" onClick={() => openMember(m)}
                role="button" tabIndex={0} onKeyDown={onActivate(() => openMember(m))}
                style={{ cursor: 'pointer' }}>
                <div className="member-avatar" style={{ background: color }}>{initials(m.nama)}</div>
                <div>
                  <div className="member-name">{m.nama}</div>
                  <div className="member-role">{top ? getRoleLabel(top.roleType) : 'Tanpa posisi'}</div>
                </div>
                {studio && <div className="member-dept">{studio}</div>}
                {circle && !studio && <div className="member-dept">{circle}</div>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {badge && <span className={`badge ${badge.cls}`}>{badge.label}</span>}
                  {isAkunKhusus(m.roles) && (
                    <span title="Bukan bagian tim kerja studio/circle -- gak masuk hitungan Total Anggota di Dashboard"
                      style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', color: 'var(--text-muted)' }}>✦ Akun Khusus</span>
                  )}
                  {m.isLiveIn && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--cyan) 15%, transparent)', color: 'var(--cyan)' }}>🏠 Live In</span>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              Tidak ada anggota yang cocok
            </div>
          )}
        </div>
      )}

      {showOnboard && (
        <OnboardModal
          onClose={() => setShowOnboard(false)}
          onSuccess={() => refetch()}
        />
      )}

      {selected && (
        <MemberDrawer
          member={selected}
          canManage={canManageMember(selected)}
          isSuperAdmin={isAdmin}
          studios={allStudios ?? []}
          onClose={() => setSelected(null)}
          onNonaktifkan={() => { setSelected(null); refetch() }}
          onRoleUpdated={async () => {
            refetch()
            try {
              const res = await api.get(`/api/members/${selected.id}`)
              setSelected(res.data.data)
            } catch {}
          }}
        />
      )}
    </>
  )
}
