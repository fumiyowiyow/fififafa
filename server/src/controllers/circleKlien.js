import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio, saringAkun } from './circle.js'
import { klienTampakNominal } from '../utils/produksi.js'

// DIREKTORI KLIEN per unit (10 Nov 2026, masukan tim): nama/username, nickname, asal order, jumlah order dengan kita (repeat order),
// supaya nama klien tidak typo & mudah dilacak. Order baru otomatis tertaut ke direktori (ejaan disamakan dengan yang sudah ada);
// klien dari order lama otomatis masuk daftar. Hanya angka & tanggal — tanpa nilai uang. Tambah/ubah: pengelola/admin market atau marketer.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const norm = (t) => String(t ?? '').trim().replace(/\s+/g, ' ')
const kunci = (t) => norm(t).toLowerCase()
const PLATFORM_ASAL = ['Fiverr', 'Etsy', 'Upwork', 'Vgen', 'Komunitas', 'WhatsApp', 'Telegram', 'Instagram', 'Lainnya']

/** Cari klien dengan nama sama (tanpa peduli huruf) atau buat baru; mengembalikan { id, nama } berejaan baku. asal dipakai bila klien baru. */
export async function tautkanKlien(studioId, namaKlien, asal = null) {
  const nama = norm(namaKlien).slice(0, 120)
  if (!nama || klienTampakNominal(nama)) return null // nominal bukan nama klien (jangan masuk direktori)
  const ada = await prisma.klienProduksi.findFirst({ where: { studioId, nama: { equals: nama, mode: 'insensitive' } }, select: { id: true, nama: true } })
  if (ada) return ada
  try { return await prisma.klienProduksi.create({ data: { studioId, nama, asal: asal && asal !== 'Internal' ? asal : null }, select: { id: true, nama: true } }) }
  catch (e) { if (e.code === 'P2002') return prisma.klienProduksi.findFirst({ where: { studioId, nama: { equals: nama, mode: 'insensitive' } }, select: { id: true, nama: true } }); throw e }
}
/** Klien dari order lama (teks bebas) dimasukkan ke direktori; asal diambil dari akun order terbaru. */
async function sinkronKlien(studioId) {
  const [ada, order] = await Promise.all([
    prisma.klienProduksi.findMany({ where: { studioId }, select: { nama: true } }),
    prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' } }, orderBy: { tanggalMasuk: 'desc' }, select: { klien: true, akun: { select: { platform: true } } } }),
  ])
  const punya = new Set(ada.map(k => kunci(k.nama))), baru = new Map()
  for (const o of order) { const n = norm(o.klien).slice(0, 120); if (n && !klienTampakNominal(n) && !punya.has(kunci(n)) && !baru.has(kunci(n))) baru.set(kunci(n), { studioId, nama: n, asal: o.akun?.platform && o.akun.platform !== 'Internal' ? o.akun.platform : null }) }
  if (baru.size) await prisma.klienProduksi.createMany({ data: [...baru.values()], skipDuplicates: true })
}
async function izin(req, res, studioId, { tulis }) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!p.manajer && !p.marketer) { gagal(res, 403, 'Direktori klien untuk Koordinator ke atas, admin market, atau marketer'); return null }
  if (tulis && p.lihatSaja) { gagal(res, 403, 'Pemilik unit hanya bisa melihat'); return null }
  return p
}
function bersih(b, { baru }) {
  const d = {}
  const teks = (f, maks, nama) => { if (b[f] !== undefined) { const v = b[f] == null ? '' : norm(b[f]); if (v.length > maks) throw new Error(`${nama} terlalu panjang (maks ${maks} huruf)`); d[f] = v || null } }
  try {
    if (baru || b.nama !== undefined) { const n = norm(b.nama); if (!n || n.length > 120) throw new Error('Nama / username wajib diisi (maks 120 huruf)'); if (klienTampakNominal(n)) throw new Error('Nama klien tampak seperti nominal uang — isi nama klien yang benar'); d.nama = n }
    teks('panggilan', 60, 'Nickname'); teks('kontak', 120, 'Kontak'); teks('catatan', 500, 'Catatan')
    if (b.asal !== undefined) { const v = norm(b.asal); if (v.length > 60) throw new Error('Asal order terlalu panjang'); d.asal = v || null }
    if (b.aktif !== undefined) d.aktif = !!b.aktif
  } catch (e) { return { galat: e.message } }
  return { data: d }
}

export const getKlien = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await izin(req, res, studioId, { tulis: false }); if (!p) return
  await sinkronKlien(studioId)
  const [klien, order, akun] = await Promise.all([
    prisma.klienProduksi.findMany({ where: { studioId }, orderBy: { nama: 'asc' } }),
    prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' } }, select: { id: true, klien: true, klienId: true, status: true, tanggalMasuk: true, akunId: true } }),
    prisma.akunProduksi.findMany({ where: { studioId }, select: { platform: true } }),
  ])
  const stat = new Map(), adaOrder = new Set()
  for (const o of order) { const k = klien.find(x => x.id === o.klienId) ?? klien.find(x => kunci(x.nama) === kunci(o.klien)); if (k) adaOrder.add(k.id) }
  // Admin per akun jualan: hitungan & daftar hanya dari order akunnya (klien tanpa order sama sekali tetap tampil — baru ditambahkan)
  for (const o of order.filter(o => !p.akunAdmin || p.akunAdmin.includes(o.akunId))) {
    const k = klien.find(x => x.id === o.klienId) ?? klien.find(x => kunci(x.nama) === kunci(o.klien)); if (!k) continue
    const e = stat.get(k.id) ?? { jumlah: 0, berjalan: 0, terakhir: null }
    e.jumlah++; if (['MASUK', 'PROSES'].includes(o.status)) e.berjalan++
    if (!e.terakhir || o.tanggalMasuk > e.terakhir) e.terakhir = o.tanggalMasuk
    stat.set(k.id, e)
  }
  // Terakhir dikabari (13 Nov 2026, masukan tim: siapa yang perlu di-follow-up lagi) = kontak terakhir di Update klien (Preview/Kata/Deliver, bukan CATATAN) dari order klien itu
  const klienOrder = new Map(order.filter(o => !p.akunAdmin || p.akunAdmin.includes(o.akunId)).map(o => [o.id, (klien.find(x => x.id === o.klienId) ?? klien.find(x => kunci(x.nama) === kunci(o.klien)))?.id]))
  const kontak = await prisma.updateKlien.groupBy({ by: ['orderId'], where: { studioId, orderId: { in: [...klienOrder.keys()] }, jenis: { not: 'CATATAN' } }, _max: { waktu: true } })
  for (const k of kontak) { const id = klienOrder.get(k.orderId), e = id && stat.get(id); if (e && (!e.kontak || k._max.waktu > e.kontak)) e.kontak = k._max.waktu }
  const asal = [...new Set([...PLATFORM_ASAL, ...akun.map(a => a.platform).filter(x => x && x !== 'Internal'), ...klien.map(k => k.asal).filter(Boolean)])]
  const data = klien.filter(k => !p.akunAdmin || stat.has(k.id) || !adaOrder.has(k.id)).map(k => ({ id: k.id, nama: k.nama, panggilan: k.panggilan, asal: k.asal, kontak: k.kontak, catatan: k.catatan, aktif: k.aktif, jumlahOrder: stat.get(k.id)?.jumlah ?? 0, orderBerjalan: stat.get(k.id)?.berjalan ?? 0, terakhir: stat.get(k.id)?.terakhir ?? null, terakhirKontak: stat.get(k.id)?.kontak ?? null }))
  return res.json({ success: true, data: { klien: data.sort((a, b) => b.jumlahOrder - a.jumlahOrder || a.nama.localeCompare(b.nama, 'id')), asal, bisaUbah: !p.lihatSaja } })
})
export const tambahKlien = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await izin(req, res, studioId, { tulis: true }))) return
  const { galat, data } = bersih(req.body ?? {}, { baru: true }); if (galat) return gagal(res, 422, galat)
  if (await prisma.klienProduksi.findFirst({ where: { studioId, nama: { equals: data.nama, mode: 'insensitive' } }, select: { id: true } })) return gagal(res, 409, 'Klien dengan nama itu sudah ada di direktori')
  const k = await prisma.klienProduksi.create({ data: { studioId, ...data } })
  return res.status(201).json({ success: true, data: { id: k.id, nama: k.nama } })
})
// Ubah data klien. Mengganti NAMA ikut memperbaiki ejaan di semua order klien itu (perbaiki typo sekali, berlaku di semua order).
export const ubahKlien = wrap(async (req, res) => {
  const k = await prisma.klienProduksi.findUnique({ where: { id: req.params.id } })
  if (!k) return gagal(res, 404, 'Klien tidak ditemukan')
  if (!(await izin(req, res, k.studioId, { tulis: true }))) return
  const { galat, data } = bersih(req.body ?? {}, { baru: false }); if (galat) return gagal(res, 422, galat)
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  if (data.nama && kunci(data.nama) !== kunci(k.nama) && await prisma.klienProduksi.findFirst({ where: { studioId: k.studioId, id: { not: k.id }, nama: { equals: data.nama, mode: 'insensitive' } }, select: { id: true } })) return gagal(res, 409, 'Nama itu sudah dipakai klien lain — pakai "Gabungkan" bila keduanya orang yang sama')
  await prisma.$transaction([
    prisma.klienProduksi.update({ where: { id: k.id }, data }),
    ...(data.nama && data.nama !== k.nama ? [prisma.orderProduksi.updateMany({ where: { studioId: k.studioId, OR: [{ klienId: k.id }, { klien: { equals: k.nama, mode: 'insensitive' } }] }, data: { klien: data.nama, klienId: k.id } })] : []),
  ])
  return res.json({ success: true, message: 'Data klien disimpan' })
})
// Gabungkan dua entri yang sebenarnya klien sama (mis. typo "Maxlus07" & "maxlus07 "): semua order & prospek pindah ke entri tujuan, entri asal dihapus.
export const gabungKlien = wrap(async (req, res) => {
  const sumber = await prisma.klienProduksi.findUnique({ where: { id: req.params.id } })
  const tujuan = req.body?.keId ? await prisma.klienProduksi.findUnique({ where: { id: String(req.body.keId) } }) : null
  if (!sumber || !tujuan || sumber.id === tujuan.id || sumber.studioId !== tujuan.studioId) return gagal(res, 422, 'Pilih klien tujuan yang berbeda di unit yang sama')
  if (!(await izin(req, res, sumber.studioId, { tulis: true }))) return
  await prisma.$transaction([
    prisma.orderProduksi.updateMany({ where: { studioId: sumber.studioId, OR: [{ klienId: sumber.id }, { klien: { equals: sumber.nama, mode: 'insensitive' } }] }, data: { klien: tujuan.nama, klienId: tujuan.id } }),
    prisma.marketingLead.updateMany({ where: { klienId: sumber.id }, data: { klienId: tujuan.id } }),
    prisma.klienProduksi.update({ where: { id: tujuan.id }, data: { panggilan: tujuan.panggilan ?? sumber.panggilan, asal: tujuan.asal ?? sumber.asal, kontak: tujuan.kontak ?? sumber.kontak } }),
    prisma.klienProduksi.delete({ where: { id: sumber.id } }),
  ])
  return res.json({ success: true, message: `Digabung ke ${tujuan.nama}` })
})

// Hapus entri klien yang TAK dipakai (mis. sisa salah ketik setelah nama di order diperbaiki): ditolak bila masih ada order (apa pun statusnya) atau prospek.
export const hapusKlien = wrap(async (req, res) => {
  const k = await prisma.klienProduksi.findUnique({ where: { id: req.params.id } })
  if (!k) return gagal(res, 404, 'Klien tidak ditemukan')
  if (!(await izin(req, res, k.studioId, { tulis: true }))) return
  const [order, prospek] = await Promise.all([
    prisma.orderProduksi.count({ where: { studioId: k.studioId, OR: [{ klienId: k.id }, { klien: { equals: k.nama, mode: 'insensitive' } }] } }),
    prisma.marketingLead.count({ where: { klienId: k.id } }),
  ])
  if (order || prospek) return gagal(res, 409, `Klien ini masih dipakai ${order} order${prospek ? ` & ${prospek} prospek` : ''} (termasuk yang sudah dihapus) — pakai "Gabung" ke klien yang benar atau ubah dulu ordernya`)
  await prisma.klienProduksi.delete({ where: { id: k.id } })
  return res.json({ success: true, message: 'Klien dihapus dari direktori' })
})
