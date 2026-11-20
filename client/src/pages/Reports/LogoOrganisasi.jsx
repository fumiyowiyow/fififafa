// LOGO circle / rumah usaha / unit untuk laporan (arahan Owner 9 Okt 2026 sore): pratinjau +
// unggah/ganti/hapus di tempat laporan dibuat (Unduh Laporan) dan di Bio Unit. Belum punya logo →
// laporan memakai logo otomatis (ubin warna circle + inisial); pratinjau di sini menirunya.
// Logo disimpan di server (kolom logoUrl) lewat /api/reports/logo — berlaku untuk semua pengurus
// dan kedua web. PNG dipertahankan (latar transparan).
import { useEffect, useRef, useState } from 'react'
import { warnaCircle } from '../../config/ekosistem'
import { ambilLogoServer, simpanLogoServer, hapusLogoServer, kecilkanLogo } from '../../components/laporan/fotoSampul'

const inisial = (nama = '') => nama.split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase() || '?'

/**
 * @param jenis    'circle' | 'rumah-usaha' | 'unit'
 * @param id       id sasaran
 * @param nama     nama sasaran (untuk logo otomatis & pesan)
 * @param slotWarna warna circle (logo otomatis)
 * @param awal     logoUrl yang sudah diketahui pemanggil (Bio Unit) — tanpa GET ulang
 * @param onUbah   (logoUrl|null) → pemanggil memperbarui datanya sendiri
 * @param ringkas  true = tanpa judul blok (dipakai di Bio Unit)
 * @param judul    judul blok pengganti (Weekly Report: "Foto Profil Unit")
 * @param wajib    tandai WAJIB (sampul Weekly memajangnya; kosong tetap jalan dengan logo otomatis)
 * @param onMuat   (logoUrl|null) setelah logo tersimpan dibaca dari server
 */
export default function LogoOrganisasi({ jenis, id, nama, slotWarna = 1, awal, onUbah, onMuat, ringkas = false, judul = null, wajib = false }) {
  const [logo, setLogo] = useState(awal ?? null)
  const [bolehUbah, setBolehUbah] = useState(awal !== undefined ? true : false)
  const [pesan, setPesan] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    if (!jenis || !id) return
    let batal = false
    setPesan(null)
    if (awal === undefined) setLogo(null)
    ambilLogoServer(jenis, id).then(d => {
      if (batal || !d) return
      setLogo(d.logoUrl ?? null)
      setBolehUbah(!!d.bolehUbah)
      onMuat?.(d.logoUrl ?? null)
    }).catch(() => { if (!batal) setBolehUbah(false) })
    return () => { batal = true }
  }, [jenis, id, awal])

  async function pilih(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSibuk(true); setPesan(null)
    try {
      const dataUrl = await kecilkanLogo(file)
      const d = await simpanLogoServer(jenis, id, dataUrl)
      setLogo(d?.logoUrl ?? dataUrl)
      onUbah?.(d?.logoUrl ?? dataUrl)
      setPesan(`Logo ${nama} disimpan — dipakai di semua laporan ${jenis === 'unit' ? 'unit ini' : 'circle ini'}.`)
    } catch (err) {
      setPesan(err?.response?.data?.message || err.message || 'Logo tidak bisa dipakai')
    } finally { setSibuk(false) }
  }

  async function hapus() {
    if (!window.confirm(`Hapus logo ${nama}? Laporan akan memakai logo otomatis.`)) return
    setSibuk(true); setPesan(null)
    try {
      await hapusLogoServer(jenis, id)
      setLogo(null)
      onUbah?.(null)
      setPesan('Logo dihapus — laporan memakai logo otomatis.')
    } catch (err) {
      setPesan(err?.response?.data?.message || 'Gagal menghapus logo')
    } finally { setSibuk(false) }
  }

  if (!jenis || !id) return null
  const warna = warnaCircle(slotWarna ?? 1)
  return (
    <div className={`pl-logo${ringkas ? ' pl-logo-ringkas' : ''}`}>
      {!ringkas && (
        <div className="pl-sublabel">
          {judul ?? `Logo ${jenis === 'unit' ? 'Unit' : jenis === 'circle' ? 'Circle' : 'Rumah Usaha'}`}
          {wajib && <span className={`pl-wajib${logo ? ' ada' : ''}`}>{logo ? '✓ Terpasang' : 'Wajib'}</span>}
          <small>{logo ? 'dipakai di laporan' : wajib ? 'belum ada · sampul memakai logo otomatis dulu' : 'belum ada · laporan memakai logo otomatis'}</small>
        </div>
      )}
      <div className="pl-logo-baris">
        <div className={`pl-logo-pratinjau${logo ? '' : ' otomatis'}`} style={{ '--warna-circle': warna }} title={logo ? `Logo ${nama}` : `Logo otomatis ${nama}`}>
          {logo ? <img src={logo} alt={`Logo ${nama}`} /> : <span>{inisial(nama)}</span>}
        </div>
        <div className="pl-logo-aksi">
          {bolehUbah ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={sibuk}>{logo ? (judul ? 'Ganti Foto' : 'Ganti Logo') : (judul ? 'Unggah Foto' : 'Unggah Logo')}</button>
              {logo && <button type="button" className="pl-tautan" onClick={hapus} disabled={sibuk}>Hapus</button>}
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pilih} />
            </>
          ) : <span className="pl-pesan" style={{ margin: 0 }}>{logo ? 'Diatur pengurus' : 'Hanya pengurus yang bisa mengunggah logo'}</span>}
          {pesan && <p className="pl-pesan" style={{ margin: 0 }}>{pesan}</p>}
        </div>
      </div>
    </div>
  )
}
