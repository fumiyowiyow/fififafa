import prisma from '../prisma.js'
import { resolveWeb } from '../utils/web.js'
import { studioBolehDilihat, peranStudio } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { bolehMeninjau } from './circleKehadiran.js'
import { hariIniWIB } from '../utils/kehadiran.js'
import * as R from '../utils/refleksi.js'

// REFLEKSI MINGGUAN web circle (21 Okt 2026) — adaptasi OGS SdmController (refleksi + komentar). Pemilik: tulis/ubah miliknya sampai Minggu.
// Koordinator ke atas dari unit tempat orang itu bekerja: membaca riwayat + memberi komentar. Orang lain: tak melihat.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const ISO = (d) => new Date(d).toISOString().slice(0, 10)
const dt = (s) => new Date(s + 'T00:00:00.000Z')
async function sesi(req, res) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  return web
}
const rapi = (r) => ({ id: r.id, mingguMulai: ISO(r.mingguMulai), mingguAkhir: R.mingguAkhir(ISO(r.mingguMulai)), kategori: r.kategori, tingkat: r.tingkat, hambatan: r.hambatan, komitmen: r.komitmen, perluDukungan: r.perluDukungan, bisaDiubah: R.masihBisaDiubah(ISO(r.mingguMulai), hariIniWIB()), komentar: (r.komentar ?? []).map(k => ({ id: k.id, penulisId: k.penulisId, penulis: k.penulis, isi: k.isi, waktu: k.createdAt })) })

export const getSaya = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const senin = R.seninDari(hariIniWIB())
  const semua = await prisma.refleksiMingguan.findMany({ where: { userId: req.user.id }, include: { komentar: { orderBy: { createdAt: 'asc' } } }, orderBy: { mingguMulai: 'desc' }, take: 30 })
  const ini = semua.find(r => ISO(r.mingguMulai) === senin) ?? null
  return res.json({ success: true, data: { mingguMulai: senin, mingguAkhir: R.mingguAkhir(senin), kategori: R.KATEGORI, mingguIni: ini ? rapi(ini) : null, riwayat: semua.filter(r => r !== ini).map(rapi) } })
})
export const buatRefleksi = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const b = req.body ?? {}; const galat = R.validasi(b); if (galat) return gagal(res, 422, galat)
  const senin = R.seninDari(hariIniWIB())
  if (await prisma.refleksiMingguan.findUnique({ where: { userId_mingguMulai: { userId: req.user.id, mingguMulai: dt(senin) } } })) return gagal(res, 409, 'Refleksi minggu ini sudah ada.')
  const r = await prisma.refleksiMingguan.create({ data: { userId: req.user.id, mingguMulai: dt(senin), kategori: b.kategori, tingkat: b.tingkat, hambatan: String(b.hambatan).trim(), komitmen: b.komitmen ? String(b.komitmen).trim() : null, perluDukungan: R.perluDukungan(b.tingkat) } })
  return res.status(201).json({ success: true, data: { id: r.id } })
})
export const ubahRefleksi = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const r = await prisma.refleksiMingguan.findUnique({ where: { id: req.params.id } })
  if (!r || r.userId !== req.user.id) return gagal(res, 404, 'Refleksi tidak ditemukan')
  if (!R.masihBisaDiubah(ISO(r.mingguMulai), hariIniWIB())) return gagal(res, 422, 'Deadline sudah lewat, refleksi tidak bisa diubah.')
  const b = req.body ?? {}; const galat = R.validasi(b); if (galat) return gagal(res, 422, galat)
  await prisma.refleksiMingguan.update({ where: { id: r.id }, data: { kategori: b.kategori, tingkat: b.tingkat, hambatan: String(b.hambatan).trim(), komitmen: b.komitmen ? String(b.komitmen).trim() : null, perluDukungan: R.perluDukungan(b.tingkat) } })
  return res.json({ success: true, message: 'Refleksi diperbarui' })
})

async function manajerUnit(req, res, studioId) {
  if (!(await sesi(req, res))) return false
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  const p = await peranStudio(req, studioId)
  if (!p.pengelola) { gagal(res, 403, 'Hanya Koordinator ke atas'); return false } // pemilik (lihat saja) & Admin Market tidak membaca refleksi pribadi
  return true
}
export const getTim = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await manajerUnit(req, res, studioId))) return
  const anggota = await anggotaStudio(studioId), ids = [...anggota.keys()], senin = R.seninDari(hariIniWIB())
  const [ini, terakhir] = await Promise.all([
    prisma.refleksiMingguan.findMany({ where: { userId: { in: ids }, mingguMulai: dt(senin) } }),
    prisma.refleksiMingguan.findMany({ where: { userId: { in: ids } }, orderBy: { mingguMulai: 'desc' }, take: ids.length * 6 }),
  ])
  const orang = ids.map(id => { const sekarang = ini.find(r => r.userId === id), akhir = terakhir.find(r => r.userId === id); return { userId: id, nama: anggota.get(id), sudahMingguIni: !!sekarang, perluDukungan: !!sekarang?.perluDukungan, terakhir: akhir ? { mingguMulai: ISO(akhir.mingguMulai), kategori: akhir.kategori, tingkat: akhir.tingkat } : null } }).sort((a, b) => Number(b.perluDukungan) - Number(a.perluDukungan) || a.nama.localeCompare(b.nama, 'id'))
  const sebulan = terakhir.filter(r => ISO(r.mingguMulai) >= new Date(dt(senin).getTime() - 21 * 86400000).toISOString().slice(0, 10))
  return res.json({ success: true, data: { mingguMulai: senin, sudah: ini.length, total: ids.length, perluDukungan: ini.filter(r => r.perluDukungan).length, orang, kategoriTerbanyak: R.rekapKategori(sebulan), cakupan: '4 minggu terakhir' } })
})
export const getOrang = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  if (!(await bolehMeninjau(req, req.params.userId))) return gagal(res, 403, 'Kamu tidak berwenang melihat refleksi orang ini')
  const [u, daftar] = await Promise.all([prisma.user.findUnique({ where: { id: req.params.userId }, select: { nama: true } }), prisma.refleksiMingguan.findMany({ where: { userId: req.params.userId }, include: { komentar: { orderBy: { createdAt: 'asc' } } }, orderBy: { mingguMulai: 'desc' }, take: 30 })])
  return res.json({ success: true, data: { nama: u?.nama ?? '—', refleksi: daftar.map(rapi) } })
})
export const tambahKomentar = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const r = await prisma.refleksiMingguan.findUnique({ where: { id: req.params.id } })
  if (!r) return gagal(res, 404, 'Refleksi tidak ditemukan')
  if (!(await bolehMeninjau(req, r.userId))) return gagal(res, 403, 'Kamu tidak berwenang mengomentari refleksi ini')
  const isi = String(req.body?.isi ?? '').trim(); if (!isi || isi.length > 2000) return gagal(res, 422, 'Komentar wajib diisi (maks 2000 huruf)')
  const nama = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'
  const k = await prisma.komentarRefleksi.create({ data: { refleksiId: r.id, penulisId: req.user.id, penulis: nama, isi } })
  return res.status(201).json({ success: true, data: { id: k.id } })
})
export const hapusKomentar = wrap(async (req, res) => {
  if (!(await sesi(req, res))) return
  const k = await prisma.komentarRefleksi.findUnique({ where: { id: req.params.id } })
  if (!k || k.penulisId !== req.user.id) return gagal(res, 404, 'Komentar tidak ditemukan')
  await prisma.komentarRefleksi.delete({ where: { id: k.id } })
  return res.json({ success: true, message: 'Komentar dihapus' })
})
