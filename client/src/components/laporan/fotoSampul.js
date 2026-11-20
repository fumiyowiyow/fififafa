// FOTO SAMPUL SENDIRI untuk Progress Report (arahan Owner 2 Okt 2026: latar
// boleh "custom"). Foto TIDAK dikirim ke server — dikecilkan di peramban lalu
// ditanam langsung ke PDF. Diingat per lingkup (circle/ekosistem) di
// localStorage peramban ini saja, supaya bulan depan tak perlu mengunggah ulang;
// bila penyimpanan penuh/diblokir, foto tetap berlaku untuk sesi ini.
import api from '../../services/api'

const AWALAN = 'md-laporan-foto:'
const PREFERENSI = 'md-laporan-preferensi'
const MAKS_UNGGAH = 15 * 1024 * 1024

/** Kecilkan foto ke ≤ 1800×1000 px JPEG — sampul 16:9 tetap tajam, PDF tetap ringan. */
export function kecilkanFoto(file, { lebar = 1800, tinggi = 1000, mutu = 0.84 } = {}) {
  return new Promise((ok, gagal) => {
    if (!file) return gagal(new Error('Tidak ada berkas'))
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return gagal(new Error('Pilih foto JPG, PNG, atau WEBP'))
    if (file.size > MAKS_UNGGAH) return gagal(new Error('Ukuran foto maksimal 15 MB'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const skala = Math.min(1, lebar / img.width, tinggi / img.height)
      const kanvas = document.createElement('canvas')
      kanvas.width = Math.max(1, Math.round(img.width * skala))
      kanvas.height = Math.max(1, Math.round(img.height * skala))
      const ctx = kanvas.getContext('2d')
      ctx.fillStyle = '#FFFFFF' // PNG transparan → latar kertas, bukan hitam
      ctx.fillRect(0, 0, kanvas.width, kanvas.height)
      ctx.drawImage(img, 0, 0, kanvas.width, kanvas.height)
      URL.revokeObjectURL(url)
      ok(kanvas.toDataURL('image/jpeg', mutu))
    }
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Foto tidak bisa dibaca')) }
    img.src = url
  })
}

export function ambilFotoSampul(lingkup) {
  try { return localStorage.getItem(AWALAN + lingkup) || null } catch { return null }
}

/** true = tersimpan di peramban; false = hanya untuk sesi ini (penyimpanan penuh/diblokir). */
export function simpanFotoSampul(lingkup, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(AWALAN + lingkup, dataUrl)
    else localStorage.removeItem(AWALAN + lingkup)
    return true
  } catch { return false }
}

/** Preferensi terakhir (tampilan, isi laporan/SKB) — kenyamanan per peramban. */
export function ambilPreferensi() {
  try { return JSON.parse(localStorage.getItem(PREFERENSI) || 'null') } catch { return null }
}
/** Digabung, bukan ditimpa: pembuat Progress Report & SKB berbagi pilihan tampilan
 *  tetapi masing-masing punya pilihan isi sendiri. */
export function simpanPreferensi(patch) {
  try { localStorage.setItem(PREFERENSI, JSON.stringify({ ...(ambilPreferensi() ?? {}), ...patch })) } catch { /* abaikan */ }
}

/** Kunci foto sampul SKB — per unit (Progress Report memakai kunci lingkup). */
export const kunciFotoUnit = (studioId) => `unit:${studioId}`

// ── Galeri foto sampul di SERVER (arahan Owner 9 Okt 2026) ──────────────
// Foto yang diunggah di Unduh Laporan disimpan per sasaran (ekosistem / circle / rumah
// usaha / unit) lewat /api/reports/foto-sampul, supaya bisa diganti atau dipakai lagi tanpa
// unggah ulang oleh pengurus mana pun. Peramban hanya mengingat foto MANA yang terakhir
// dipilih (id) + salinannya (cache di atas) supaya unduhan cepat tanpa mengambil ulang.
const MAKS_FOTO_SAMPUL = 880_000
const AWALAN_PILIH = 'md-laporan-foto-pilih:'

/** Kunci foto → sasaran galeri: 'ekosistem' | 'circle:<id>' | 'rumah-usaha:<id>' | 'unit:<id>'. */
export function sasaranFoto(kunci) {
  if (!kunci) return null
  if (kunci === 'ekosistem') return { jenis: 'ekosistem', id: '' }
  const m = /^(circle|rumah-usaha|unit):(.+)$/.exec(kunci)
  return m ? { jenis: m[1], id: m[2] } : null
}
export function fotoTerpilihId(kunci) {
  try { return localStorage.getItem(AWALAN_PILIH + kunci) || null } catch { return null }
}
export function ingatFotoTerpilih(kunci, id) {
  try { if (id) localStorage.setItem(AWALAN_PILIH + kunci, id); else localStorage.removeItem(AWALAN_PILIH + kunci) } catch { /* abaikan */ }
}
export async function daftarFotoServer(kunci) {
  const s = sasaranFoto(kunci)
  if (!s) return null
  const r = await api.get('/api/reports/foto-sampul', { params: { jenis: s.jenis, id: s.id } })
  return r.data?.data ?? null
}
export async function ambilFotoServer(id) {
  const r = await api.get(`/api/reports/foto-sampul/${encodeURIComponent(id)}`)
  return r.data?.data?.dataUrl ?? null
}
export async function unggahFotoServer(kunci, { nama, dataUrl, thumb }) {
  const s = sasaranFoto(kunci)
  if (!s) throw new Error('Sasaran foto tidak dikenal')
  const r = await api.post('/api/reports/foto-sampul', { jenis: s.jenis, id: s.id, nama, dataUrl, thumb })
  return r.data?.data
}
export async function hapusFotoServer(id) {
  await api.delete(`/api/reports/foto-sampul/${encodeURIComponent(id)}`)
}
/** Foto terpilih untuk sebuah kunci: cache peramban, atau diambil dari galeri bila hanya id-nya yang diingat. */
export async function ambilFotoTerpilih(kunci) {
  const cache = ambilFotoSampul(kunci)
  if (cache) return cache
  const id = fotoTerpilihId(kunci)
  if (!id) return null
  try {
    const d = await ambilFotoServer(id)
    if (d) simpanFotoSampul(kunci, d)
    return d
  } catch { return null }
}
/** Kecilkan bertahap sampai ≤ batas server (±650 KB). */
export async function kecilkanFotoSampul(file) {
  let lebar = 1800, tinggi = 1000, mutu = 0.84
  for (let i = 0; i < 4; i++) {
    const dataUrl = await kecilkanFoto(file, { lebar, tinggi, mutu })
    if (dataUrl.length <= MAKS_FOTO_SAMPUL) return dataUrl
    lebar = Math.round(lebar * 0.8); tinggi = Math.round(tinggi * 0.8); mutu = Math.max(0.6, mutu - 0.07)
  }
  throw new Error('Foto terlalu besar — coba foto lain')
}
/** Thumbnail 16:9 kecil untuk galeri (potong tengah). */
export function buatThumb(dataUrl, { lebar = 320, tinggi = 180, mutu = 0.72 } = {}) {
  return new Promise((ok, gagal) => {
    const img = new Image()
    img.onload = () => {
      const kanvas = document.createElement('canvas')
      kanvas.width = lebar; kanvas.height = tinggi
      const ctx = kanvas.getContext('2d')
      const skala = Math.max(lebar / img.width, tinggi / img.height)
      const w = img.width * skala, h = img.height * skala
      ctx.drawImage(img, (lebar - w) / 2, (tinggi - h) / 2, w, h)
      ok(kanvas.toDataURL('image/jpeg', mutu))
    }
    img.onerror = () => gagal(new Error('Thumbnail gagal dibuat'))
    img.src = dataUrl
  })
}

// ── Logo circle / rumah usaha / unit (DISIMPAN DI SERVER, 9 Okt 2026) ─────
// Dipakai di semua laporan sasaran itu; PNG dipertahankan supaya latar transparan tetap transparan.
const MAKS_LOGO = 380_000
export async function ambilLogoServer(jenis, id) {
  const r = await api.get('/api/reports/logo', { params: { jenis, id } })
  return r.data?.data ?? null
}
export async function simpanLogoServer(jenis, id, dataUrl) {
  const r = await api.put('/api/reports/logo', { jenis, id, dataUrl })
  return r.data?.data ?? null
}
export async function hapusLogoServer(jenis, id) {
  await api.delete('/api/reports/logo', { params: { jenis, id } })
}
/** Kecilkan logo ke ≤ 512 px sisi terpanjang; PNG/WEBP → PNG (transparan), JPG tetap JPG. */
export function kecilkanLogo(file, { sisi = 512 } = {}) {
  return new Promise((ok, gagal) => {
    if (!file) return gagal(new Error('Tidak ada berkas'))
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return gagal(new Error('Pilih logo PNG, JPG, atau WEBP'))
    if (file.size > 10 * 1024 * 1024) return gagal(new Error('Ukuran logo maksimal 10 MB'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const png = file.type !== 'image/jpeg'
      let s = sisi, hasil = null
      for (let i = 0; i < 5; i++) {
        const skala = Math.min(1, s / Math.max(img.width, img.height))
        const kanvas = document.createElement('canvas')
        kanvas.width = Math.max(1, Math.round(img.width * skala))
        kanvas.height = Math.max(1, Math.round(img.height * skala))
        const ctx = kanvas.getContext('2d')
        if (!png) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, kanvas.width, kanvas.height) }
        ctx.drawImage(img, 0, 0, kanvas.width, kanvas.height)
        hasil = png ? kanvas.toDataURL('image/png') : kanvas.toDataURL('image/jpeg', 0.86)
        if (hasil.length <= MAKS_LOGO) break
        s = Math.round(s * 0.72)
      }
      URL.revokeObjectURL(url)
      if (hasil.length > MAKS_LOGO) return gagal(new Error('Logo terlalu rumit/besar — coba versi yang lebih sederhana'))
      ok(hasil)
    }
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Logo tidak bisa dibaca')) }
    img.src = url
  })
}

// ── Foto tempat SKB (satu per circle/rumah usaha, DISIMPAN DI SERVER) ───
// Beda dengan foto sampul: foto ini milik bersama semua pengurus (arahan Owner
// 3 Okt 2026), jadi dikirim sebagai data URL ke PUT …/foto-tempat. Server menolak
// di atas ±900 rb karakter — kecilkan bertahap sampai muat.
const MAKS_FOTO_TEMPAT = 880_000
export async function kecilkanFotoTempat(file) {
  let sisi = 1400, mutu = 0.84
  for (let i = 0; i < 4; i++) {
    const dataUrl = await kecilkanFoto(file, { lebar: sisi, tinggi: sisi, mutu })
    if (dataUrl.length <= MAKS_FOTO_TEMPAT) return dataUrl
    sisi = Math.round(sisi * 0.75)
    mutu = Math.max(0.62, mutu - 0.07)
  }
  throw new Error('Foto terlalu besar — coba foto lain')
}

// ── Kurasi keuangan SKB per unit (pos yang dimatikan) ──────────────────
// Diingat di peramban ini; server yang menghitung ulang totalnya (?sembunyi=).
const AWALAN_KURASI = 'pge-skb-kurasi:'
export function ambilKurasiSkb(studioId) {
  try {
    const v = JSON.parse(localStorage.getItem(AWALAN_KURASI + studioId) || '[]')
    return Array.isArray(v) ? v.filter(k => typeof k === 'string') : []
  } catch { return [] }
}
export function simpanKurasiSkb(studioId, kunci) {
  try {
    if (kunci?.length) localStorage.setItem(AWALAN_KURASI + studioId, JSON.stringify(kunci))
    else localStorage.removeItem(AWALAN_KURASI + studioId)
  } catch { /* abaikan: tetap berlaku untuk sesi ini */ }
}

// ── Renstra / KPI Weekly Report per unit per bulan (8 Okt 2026) ─────────
// Empat kolom teks (Produksi · Marketing · Finance · SDM), satu baris = satu butir;
// awalan "v " / "x " menandai tercapai / belum. Diingat per unit & bulan di peramban ini.
const AWALAN_RENSTRA = 'pge-mingguan-renstra:'
export const kunciRenstra = (studioId, bulan, tahun) => `${AWALAN_RENSTRA}${studioId}:${tahun}-${String(bulan).padStart(2, '0')}`
export function ambilRenstra(studioId, bulan, tahun) {
  try { return JSON.parse(localStorage.getItem(kunciRenstra(studioId, bulan, tahun)) || 'null') ?? {} } catch { return {} }
}
export function simpanRenstra(studioId, bulan, tahun, teks) {
  try {
    const isi = Object.fromEntries(Object.entries(teks ?? {}).filter(([, v]) => String(v ?? '').trim()))
    if (Object.keys(isi).length) localStorage.setItem(kunciRenstra(studioId, bulan, tahun), JSON.stringify(isi))
    else localStorage.removeItem(kunciRenstra(studioId, bulan, tahun))
  } catch { /* abaikan: tetap berlaku untuk sesi ini */ }
}

// ── Kustomisasi Weekly Report per unit per bulan (8 Okt 2026, dari PDF acuan Owner) ──
// Bagian acuan yang BUKAN data aplikasi: pendapatan lain (pengembalian pinjaman/modal),
// dana lain di Financial Overview (pengamanan aset, piutang, money in transit), sebutan &
// butir tiap anggota di halaman Team, judul penutup. Bentuk:
//   { pendapatanLain: [{label, jumlah}], danaLain: [{label, jumlah}],
//     tim: { [userId]: { sembunyi, sebutan, teknis, nonTeknis } }, penutup: { judul, sub } }
const AWALAN_KUSTOM = 'pge-mingguan-kustom:'
export const kunciKustomMingguan = (studioId, bulan, tahun) => `${AWALAN_KUSTOM}${studioId}:${tahun}-${String(bulan).padStart(2, '0')}`
export function ambilKustomMingguan(studioId, bulan, tahun) {
  try {
    const v = JSON.parse(localStorage.getItem(kunciKustomMingguan(studioId, bulan, tahun)) || 'null')
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}
export function simpanKustomMingguan(studioId, bulan, tahun, kustom) {
  try {
    const bersih = rapikanKustom(kustom)
    if (Object.keys(bersih).length) localStorage.setItem(kunciKustomMingguan(studioId, bulan, tahun), JSON.stringify(bersih))
    else localStorage.removeItem(kunciKustomMingguan(studioId, bulan, tahun))
  } catch { /* abaikan: tetap berlaku untuk sesi ini */ }
}
/** Buang baris kosong & isian bawaan supaya yang tersimpan hanya yang benar-benar diubah. */
export function rapikanKustom(k = {}) {
  const baris = (arr) => (Array.isArray(arr) ? arr : []).filter(b => String(b?.label ?? '').trim() || Number(b?.jumlah)).map(b => ({ label: String(b.label ?? '').trim(), jumlah: Math.round(Number(b.jumlah) || 0) }))
  const hasil = {}
  const pl = baris(k.pendapatanLain); if (pl.length) hasil.pendapatanLain = pl
  const dl = baris(k.danaLain); if (dl.length) hasil.danaLain = dl
  const tim = {}
  for (const [id, o] of Object.entries(k.tim ?? {})) {
    if (!o || typeof o !== 'object') continue
    const t = {}
    if (o.sembunyi) t.sembunyi = true
    for (const f of ['sebutan', 'teknis', 'nonTeknis']) if (typeof o[f] === 'string') t[f] = o[f]
    if (Object.keys(t).length) tim[id] = t
  }
  if (Object.keys(tim).length) hasil.tim = tim
  const p = { judul: String(k.penutup?.judul ?? '').trim(), sub: String(k.penutup?.sub ?? '').trim() }
  if (p.judul || p.sub) hasil.penutup = Object.fromEntries(Object.entries(p).filter(([, v]) => v))
  return hasil
}

// ── Motto SKB per unit ──────────────────────────────────────────────────
// Isian bebas pembuat SKB, diingat per unit di peramban ini saja. Latar belakang
// TIDAK lagi di sini: sejak 3 Okt 2026 diambil dari Bio Unit › Latar Belakang.
const AWALAN_SKB = 'pge-skb-teks:'
export function ambilTeksSkb(studioId) {
  try { return JSON.parse(localStorage.getItem(AWALAN_SKB + studioId) || 'null') ?? {} } catch { return {} }
}
export function simpanTeksSkb(studioId, teks) {
  try {
    const isi = Object.fromEntries(Object.entries(teks ?? {}).filter(([, v]) => String(v ?? '').trim()))
    if (Object.keys(isi).length) localStorage.setItem(AWALAN_SKB + studioId, JSON.stringify(isi))
    else localStorage.removeItem(AWALAN_SKB + studioId)
  } catch { /* abaikan: tetap berlaku untuk sesi ini */ }
}
