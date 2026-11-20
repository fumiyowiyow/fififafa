// TEBAKAN FUNGSI KERJA (21 Okt 2026) — dari teks bebas User.posisi + peran jenjang. Murni (tanpa database).
// Hanya SARAN: koordinator yang mengonfirmasi (FungsiAnggota.terkonfirmasi). Aturan mengikuti keputusan:
//   • "Admin" (tanpa kata lain) → MARKETER by default (di Sekartaji Admin memegang chat & klien), koordinator mengoreksi
//     bila ternyata administrasi keuangan/operasional.
//   • Satu orang boleh punya beberapa fungsi (mis. "Admin-Illustrator", "Karyawan/Rigger&Animator").
//   • Posisi kosong / tak dikenal → tidak ada saran (harus diisi koordinator).

export const FUNGSI = ['ARTIST', 'MARKETER', 'PM_QC', 'ADMIN']
// Filter Prisma untuk `user`: masih aktif DAN masih punya peran kerja di unit itu (SDM Ekosistem). FungsiAnggota & penugasan akun tidak ikut
// terhapus saat anggota dipindah unit di Ekosistem — tanpa filter ini orang yang sudah pindah tetap muncul sebagai marketer unit lama (9 Nov 2026).
export const masihDiUnit = (studioId) => ({ statusAktif: true, roles: { some: { studioId, roleType: { not: 'DIGNITY' } } } })
export const BIDANG = ['3D', 'Rigging', 'Animasi', 'Ilustrasi', 'GFS', 'Desain']

// bidang artist dari kata kunci; urutan = prioritas bila ada beberapa kata kunci pada satu segmen
const BIDANG_KATA = [
  ['Rigging', /rigg?er|rigging|riiging/],
  ['Animasi', /animat|animasi/],
  ['3D', /\b3d\b|modell?er|sculpt/],
  ['Ilustrasi', /ilustr|illustr|artist\s*2d|2d/],
  ['GFS', /\bgfs\b|graphic for stream|overlay/],
  ['Desain', /design|desain/],
]
const KATA_ARTIST = /artist|ilustr|illustr|animat|rigg?er|rigging|design|desain|\b3d\b|\b2d\b|modell?er|sculpt|vtuber|produksi/
const KATA_MARKETER = /market|vgen|ltk|customer|\bcs\b|chat|sales|klien/
const KATA_PM = /koordinator|coordinator|project manager|\bpm\b|\bhead\b|kepala|manajer|manager|\bqc\b/

/**
 * @param posisi  teks posisi (boleh kosong)
 * @param peran   peran jenjang di studio ('KOORDINATOR' | 'KADER' | 'KARYAWAN' | 'MAGANG' | …)
 * @returns [{ fungsi, bidang }]  — kosong bila tak ada dasar untuk menebak
 */
export function tebakFungsi(posisi, peran) {
  const teks = String(posisi ?? '').toLowerCase().replace(/maggang/g, 'magang')
  const hasil = new Map()
  const bidangArtist = new Set()
  const tambah = (fungsi) => { if (!hasil.has(fungsi)) hasil.set(fungsi, null) }

  // pecah posisi gabungan: "Karyawan/Rigger&Animator", "Admin-Illustrator", "Rigger/Animator Magang"
  const segmen = teks.split(/[\/&,+]|\s-\s|-(?=[a-z])/).map(s => s.trim()).filter(Boolean)
  for (const s of segmen) {
    const marketer = KATA_MARKETER.test(s)
    const artist = KATA_ARTIST.test(s)
    const adminPolos = /^admin\b/.test(s) && !marketer && !artist
    if (marketer) tambah('MARKETER')
    if (adminPolos) tambah('MARKETER')            // keputusan: Admin polos → marketer, koordinator mengoreksi
    if (artist) { tambah('ARTIST'); for (const [nama, re] of BIDANG_KATA) if (re.test(s)) bidangArtist.add(nama) }
    if (KATA_PM.test(s)) tambah('PM_QC')
  }
  if (peran === 'KOORDINATOR') tambah('PM_QC') // koordinator selalu berfungsi PM/QC (QC & preview: koordinator atau admin)
  // bidang artist: boleh lebih dari satu ("Rigger & Animator"), disimpan sebagai teks dipisah koma sesuai urutan BIDANG
  const urut = BIDANG.filter(b => bidangArtist.has(b))
  return [...hasil.entries()].map(([fungsi]) => ({ fungsi, bidang: fungsi === 'ARTIST' && urut.length ? urut.join(',') : null }))
}

/** Validasi isian koordinator: [{ fungsi, bidang? }] → daftar bersih atau pesan galat. */
export function validasiFungsi(daftar) {
  if (!Array.isArray(daftar)) return { galat: 'Isian fungsi harus berupa daftar.' }
  const unik = new Map()
  for (const f of daftar) {
    if (!FUNGSI.includes(f?.fungsi)) return { galat: `Fungsi tidak dikenal: ${f?.fungsi}` }
    const bidang = (Array.isArray(f.bidang) ? f.bidang : String(f.bidang ?? '').split(',')).map(b => b.trim()).filter(Boolean)
    const salah = bidang.find(b => !BIDANG.includes(b))
    if (salah) return { galat: `Bidang tidak dikenal: ${salah}` }
    if (bidang.length && f.fungsi !== 'ARTIST') return { galat: 'Bidang hanya untuk fungsi Artist.' }
    unik.set(f.fungsi, f.fungsi === 'ARTIST' && bidang.length ? BIDANG.filter(b => bidang.includes(b)).join(',') : null)
  }
  return { daftar: [...unik.entries()].map(([fungsi, bidang]) => ({ fungsi, bidang })) }
}
