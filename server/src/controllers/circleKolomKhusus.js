import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat } from './circle.js'

// KOLOM KHUSUS ORDER (12 Nov 2026, masukan tim): tiap studio merancang kebutuhan khusus project-nya sendiri — mis. "Boleh pakai AI?"
// (Ya/Tidak), "Gaya" (pilihan), "Catatan klien" (teks). Nilai disimpan per order (OrderProduksi.isianKhusus). Kolom "diKartu" tampil sebagai label
// di kartu papan & antrean talent, supaya talent tahu tanpa membuka detail. Atur kolom: pengelola unit (kelolaStudio). Tanpa angka uang.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
// PILIHAN_BANYAK (16 Nov 2026, masukan tim): boleh mencentang lebih dari satu (mis. File delivery: STL F + FBX) — disimpan sebagai array
export const TIPE = { YA_TIDAK: 'Ya / Tidak', PILIHAN: 'Pilihan (satu)', PILIHAN_BANYAK: 'Pilihan (boleh lebih dari satu)', TEKS: 'Teks bebas' }
const BERPILIHAN = ['PILIHAN', 'PILIHAN_BANYAK']
/** Nilai tersimpan → bentuk tipe kolom sekarang (tipe boleh diubah Koordinator: satu ↔ banyak). Nilai di luar daftar pilihan tetap ditampilkan. */
export function nilaiTampil(k, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null
  if (k.tipe === 'PILIHAN_BANYAK') return Array.isArray(v) ? v.map(String) : [String(v)]
  return Array.isArray(v) ? v.map(String).join(', ') : String(v)
}
const rapi = (k) => ({ id: k.id, nama: k.nama, tipe: k.tipe, pilihan: k.pilihan, diKartu: k.diKartu, urutan: k.urutan })

export const kolomStudio = (studioId) => prisma.kolomKhususOrder.findMany({ where: { studioId, aktif: true }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] })
/** Nilai yang sah untuk satu kolom; undefined = tidak sah. '' / null = kosongkan. */
export function nilaiSah(k, v) {
  if (k.tipe === 'PILIHAN_BANYAK') {
    const daftar = (Array.isArray(v) ? v : v == null || v === '' ? [] : String(v).split(',')).map(x => String(x).trim()).filter(Boolean)
    if (daftar.some(x => !k.pilihan.includes(x))) return undefined
    return daftar.length ? k.pilihan.filter(x => daftar.includes(x)) : null // urut sesuai daftar pilihan
  }
  if (v == null || v === '') return null
  const t = String(v).trim()
  if (k.tipe === 'YA_TIDAK') return ['Ya', 'Tidak'].includes(t) ? t : undefined
  if (k.tipe === 'PILIHAN') return k.pilihan.includes(t) ? t : undefined
  return t.slice(0, 300)
}
/** Label kartu: [{nama, nilai, nada}] dari kolom diKartu yang terisi. nada: ok (Ya) | bad (Tidak) | null. */
export function labelKhusus(kolom, isian) {
  const x = isian && typeof isian === 'object' ? isian : {}
  return kolom.map(k => ({ k, n: nilaiTampil(k, x[k.id]) })).filter(({ k, n }) => k.diKartu && n != null).map(({ k, n }) => ({ nama: k.nama, nilai: Array.isArray(n) ? n.join(', ') : n, nada: k.tipe === 'YA_TIDAK' ? (n === 'Ya' ? 'ok' : 'bad') : null }))
}
/** Semua kolom aktif + nilainya (untuk detail order). */
export const isianLengkap = (kolom, isian) => kolom.map(k => ({ ...rapi(k), nilai: isian && typeof isian === 'object' ? nilaiTampil(k, isian[k.id]) : null }))

export const getKolom = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  return res.json({ success: true, data: { kolom: (await kolomStudio(studioId)).map(rapi), tipe: TIPE, bisaAtur: await kelolaStudio(peranKerja(req), studioId) } })
})
function bersih(b, { baru }) {
  const d = {}
  if (baru || b.nama !== undefined) { const n = String(b.nama ?? '').trim(); if (!n || n.length > 60) return { galat: 'Nama kolom wajib diisi (maks 60 huruf)' }; d.nama = n }
  if (baru || b.tipe !== undefined) { if (!TIPE[b.tipe]) return { galat: 'Tipe harus YA_TIDAK, PILIHAN, atau TEKS' }; d.tipe = b.tipe }
  if (b.pilihan !== undefined) { const p = [...new Set((Array.isArray(b.pilihan) ? b.pilihan : String(b.pilihan).split(',')).map(x => String(x).trim()).filter(Boolean))].slice(0, 20); if (p.some(x => x.length > 40)) return { galat: 'Tiap pilihan maks 40 huruf' }; d.pilihan = p }
  if (b.diKartu !== undefined) d.diKartu = !!b.diKartu
  if (b.urutan !== undefined) d.urutan = Number(b.urutan) || 0
  return { data: d }
}
async function bolehAtur(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  if (!(await kelolaStudio(peranKerja(req), studioId))) { gagal(res, 403, 'Kolom khusus diatur Koordinator/Pendamping unit ini'); return false }
  return true
}
export const tambahKolom = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await bolehAtur(req, res, studioId))) return
  const { galat, data } = bersih(req.body ?? {}, { baru: true }); if (galat) return gagal(res, 422, galat)
  if (BERPILIHAN.includes(data.tipe) && !(data.pilihan?.length >= 2)) return gagal(res, 422, 'Kolom pilihan butuh minimal 2 pilihan')
  if ((await prisma.kolomKhususOrder.count({ where: { studioId, aktif: true } })) >= 12) return gagal(res, 409, 'Maksimal 12 kolom khusus per unit')
  const k = await prisma.kolomKhususOrder.create({ data: { studioId, ...data, urutan: data.urutan ?? 99 } })
  return res.status(201).json({ success: true, data: rapi(k) })
})
async function muat(req, res) {
  const k = await prisma.kolomKhususOrder.findUnique({ where: { id: req.params.id } })
  if (!k || !k.aktif) { gagal(res, 404, 'Kolom tidak ditemukan'); return null }
  if (!(await bolehAtur(req, res, k.studioId))) return null
  return k
}
export const ubahKolom = wrap(async (req, res) => {
  const k = await muat(req, res); if (!k) return
  const { galat, data } = bersih(req.body ?? {}, { baru: false }); if (galat) return gagal(res, 422, galat)
  // UBAH kolom (16 Nov 2026, masukan tim): nama, tipe, daftar pilihan, tampil di kartu — tetap hanya Koordinator (Alur = alur kerja unit).
  // Nilai yang sudah terisi di order TIDAK diubah; pilihan yang dihapus tetap tampil di order lama sampai diganti.
  if (BERPILIHAN.includes(data.tipe ?? k.tipe) && !((data.pilihan ?? k.pilihan).length >= 2)) return gagal(res, 422, 'Kolom pilihan butuh minimal 2 pilihan')
  return res.json({ success: true, data: rapi(await prisma.kolomKhususOrder.update({ where: { id: k.id }, data })) })
})
// Hapus = nonaktifkan (nilai lama di order tidak dibaca lagi; tidak menghapus data order)
export const hapusKolom = wrap(async (req, res) => {
  const k = await muat(req, res); if (!k) return
  await prisma.kolomKhususOrder.update({ where: { id: k.id }, data: { aktif: false } })
  return res.json({ success: true, message: 'Kolom dihapus' })
})
