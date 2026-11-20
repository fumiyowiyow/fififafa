import prisma from '../prisma.js'
import { hitungNilaiBersih } from '../utils/produksi.js'
import { jenisNormal } from '../utils/alur.js'
import { resolveWeb } from '../utils/web.js'
import { studioBolehDilihat, peranStudio, pastikanTahap, saringAkun, orderDalamAkun } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import * as L from '../utils/ltk.js'
import { catatAudit } from '../utils/auditOrder.js'
import { tautkanKlien } from './circleKlien.js'
import { lingkupStudio, whereFreelancerTerlihat } from '../utils/freelancer.js'
import { sinkronKategori, kanonKategori, pemakaianKategori, namaKategoriSah, gantiNamaDiTeks, MAKS_NAMA } from '../utils/kategori.js'
import { kabarOrderBaru } from '../utils/notifGrup.js'

// LTK — Lempar-Terima Kerjaan web circle (21 Okt 2026), adaptasi OGS LtkCase, SISI STAF (tanpa portal pihak luar). Akses: Koordinator ke atas atau
// Marketer unit tersebut. Negosiasi = catatan bertanda waktu. DEAL (TERIMA) → konversi jadi OrderProduksi di inbox.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch (e) { if (e?.code === 'P2002') return gagal(res, 409, 'Data duplikat, coba lagi'); return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(new Date(s)) ? new Date(s + 'T00:00:00.000Z') : null)
async function sesi(req, res) {
  const web = await resolveWeb(req)
  if (web.aud !== 'circle') { gagal(res, 403, 'Hanya untuk web circle'); return null }
  if (req.user?.aud === 'circle' && req.user.cs !== web.lingkup.slug) { gagal(res, 403, 'Token bukan untuk alamat ini'); return null }
  return web
}
export async function akses(req, res, studioId) {
  if (!(await sesi(req, res))) return null
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!(p.manajer || p.marketer)) { gagal(res, 403, 'Hanya Koordinator ke atas atau Marketer unit ini'); return null }
  return p
}
const rapi = (k) => ({ id: k.id, kode: k.kode, arah: k.arah, labelArah: L.ARAH[k.arah], status: k.status, labelStatus: L.STATUS[k.status], studioId: k.studioId, akunId: k.akunId, namaPihak: k.namaPihak, jenisPihak: k.jenisPihak, kontak: k.kontak, judul: k.judul, kategori: k.kategori, deskripsi: k.deskripsi, anggaranCatatan: k.anggaranCatatan, deadlineDiminta: ISO(k.deadlineDiminta), tautanRujukan: k.tautanRujukan, hargaSepakat: k.hargaSepakat, deadlineSepakat: ISO(k.deadlineSepakat), syarat: k.syarat, tautanHasil: k.tautanHasil, pemasarId: k.pemasarId, orderId: k.orderId, diajukanPada: k.diajukanPada, dealPada: k.dealPada, createdAt: k.createdAt, final: L.final(k.status), bisaDihapus: L.bisaDihapus(k) })
const muat = async (req, res) => {
  const k = await prisma.kasusLtk.findUnique({ where: { id: req.params.id }, include: { catatan: { orderBy: { createdAt: 'asc' } } } })
  if (!k) { gagal(res, 404, 'LTK tidak ditemukan'); return null }
  const p = await akses(req, res, k.studioId); if (!p) return null
  if (!p.manajer && !milikSendiri(req)(k)) { gagal(res, 403, 'Hanya LTK yang kamu tangani'); return null }
  return { k, p }
}
// Marketer (bukan manajer) hanya LTK yang ia tangani/buat — harga & anggaran LTK orang lain tidak terlihat (keputusan user 21 Okt 2026)
const milikSendiri = (req) => (k) => k.pemasarId === req.user.id || k.dibuatOlehId === req.user.id
const filterMilik = (req, p) => (p.manajer ? {} : { OR: [{ pemasarId: req.user.id }, { dibuatOlehId: req.user.id }] })
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'

export const getOpsi = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId))) return
  const [akun, anggota] = await Promise.all([prisma.akunProduksi.findMany({ where: { studioId }, orderBy: { namaAkun: 'asc' }, select: { id: true, platform: true, namaAkun: true } }), anggotaStudio(studioId)])
  return res.json({ success: true, data: { akun, anggota: [...anggota].map(([id, nama]) => ({ id, nama })), arah: L.ARAH, jenisPihak: L.JENIS_PIHAK, status: L.STATUS, pihak: await bankPihak(studioId) } })
})
// "Bank data" pihak (9 Nov 2026, permintaan tim Langit): nama + kontak dari LTK sebelumnya di circle/rumah usaha yang sama + freelancer
// (TalentEksternal) yang pernah bekerja di lingkup itu — supaya kontak tidak perlu diketik ulang. Data bank/rekening freelancer TIDAK dikirim.
async function bankPihak(studioId) {
  const st = await prisma.studio.findUnique({ where: { id: studioId }, select: { circleId: true, rumahUsahaId: true } })
  const lingkup = st?.circleId ? { circleId: st.circleId } : st?.rumahUsahaId ? { rumahUsahaId: st.rumahUsahaId } : { id: studioId }
  const ids = (await prisma.studio.findMany({ where: lingkup, select: { id: true } })).map(s => s.id)
  const [ltk, talent] = await Promise.all([
    prisma.kasusLtk.findMany({ where: { studioId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 500, select: { namaPihak: true, jenisPihak: true, kontak: true } }),
    prisma.talentEksternal.findMany({ where: { aktif: true, ...whereFreelancerTerlihat(await lingkupStudio(studioId), studioId) }, select: { nama: true, kontak: true, skill: true } }),
  ])
  const peta = new Map()
  for (const k of ltk) { const kunci = k.namaPihak.trim().toLowerCase(); if (!peta.has(kunci)) peta.set(kunci, { nama: k.namaPihak.trim(), jenisPihak: k.jenisPihak, kontak: k.kontak ?? null }); else if (!peta.get(kunci).kontak && k.kontak) peta.get(kunci).kontak = k.kontak }
  for (const t of talent) { const kunci = t.nama.trim().toLowerCase(); if (!peta.has(kunci)) peta.set(kunci, { nama: t.nama.trim(), jenisPihak: 'FREELANCE', kontak: t.kontak ?? null, skill: t.skill ?? null }); else { const e = peta.get(kunci); if (!e.kontak && t.kontak) e.kontak = t.kontak; if (t.skill) e.skill = t.skill; e.jenisPihak = 'FREELANCE' } }
  return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}
export const getDaftar = wrap(async (req, res) => {
  const { studioId, status, arah } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const where = { studioId, ...filterMilik(req, p), ...(status && L.STATUS[status] ? { status } : {}), ...(arah && L.ARAH[arah] ? { arah } : {}) }
  const daftar = await prisma.kasusLtk.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 })
  const hit = await prisma.kasusLtk.groupBy({ by: ['status'], where: { studioId, ...filterMilik(req, p) }, _count: true })
  return res.json({ success: true, data: { kasus: daftar.map(rapi), hitung: Object.fromEntries(hit.map(h => [h.status, h._count])) } })
})
export const getDetail = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  return res.json({ success: true, data: { ...rapi(d.k), catatan: d.k.catatan.map(c => ({ id: c.id, penulis: c.penulis, isi: c.isi, waktu: c.createdAt })) } })
})
async function kodeBaru(arah) {
  const tahun = new Date(Date.now() + 7 * 3600000).getUTCFullYear()
  const last = await prisma.kasusLtk.findFirst({ where: { arah, kode: { startsWith: `${L.PREFIKS[arah]}-${tahun}-` } }, orderBy: { kode: 'desc' }, select: { kode: true } })
  return L.kodeBerikut(arah, tahun, last?.kode)
}
function bidang(b, { baru }) {
  const d = {}
  const teks = (f, maks) => { if (b[f] !== undefined) { const v = b[f] == null ? null : String(b[f]).trim().slice(0, maks); d[f] = v || null } }
  teks('kontak', 200); teks('kategori', 250); teks('deskripsi', 4000); teks('anggaranCatatan', 200); teks('syarat', 2000)
  if (b.tautanHasil !== undefined) { const v = b.tautanHasil ? String(b.tautanHasil).trim() : null; if (v && !/^https?:\/\//i.test(v)) return { galat: 'Tautan hasil harus diawali http:// atau https://' }; d.tautanHasil = v }
  if (b.deadlineDiminta !== undefined) { if (b.deadlineDiminta && !tgl(b.deadlineDiminta)) return { galat: 'deadlineDiminta harus YYYY-MM-DD' }; d.deadlineDiminta = b.deadlineDiminta ? tgl(b.deadlineDiminta) : null }
  if (b.deadlineSepakat !== undefined) { if (b.deadlineSepakat && !tgl(b.deadlineSepakat)) return { galat: 'deadlineSepakat harus YYYY-MM-DD' }; d.deadlineSepakat = b.deadlineSepakat ? tgl(b.deadlineSepakat) : null }
  if (b.tautanRujukan !== undefined) { const t = L.bersihTautan(b.tautanRujukan); if (t.galat) return t; d.tautanRujukan = t.data }
  if (b.hargaSepakat !== undefined) { if (b.hargaSepakat == null || b.hargaSepakat === '') d.hargaSepakat = null; else { const h = Number(b.hargaSepakat); if (!Number.isFinite(h) || h < 0) return { galat: 'hargaSepakat harus angka ≥ 0' }; d.hargaSepakat = h } }
  if (baru || b.judul !== undefined) { const j = String(b.judul ?? '').trim(); if (!j || j.length > 200) return { galat: 'Judul wajib diisi (maks 200 huruf)' }; d.judul = j }
  if (baru || b.namaPihak !== undefined) { const n = String(b.namaPihak ?? '').trim(); if (!n || n.length > 200) return { galat: 'Nama pihak wajib diisi' }; d.namaPihak = n }
  if (b.jenisPihak !== undefined && !L.JENIS_PIHAK[b.jenisPihak]) return { galat: 'jenisPihak tidak dikenal' }
  if (b.jenisPihak !== undefined) d.jenisPihak = b.jenisPihak
  return { data: d }
}
async function cekRelasi(studioId, b) {
  if (b.akunId && !(await prisma.akunProduksi.findFirst({ where: { id: b.akunId, studioId } }))) return 'Akun jualan bukan milik unit ini'
  if (b.pemasarId && !(await anggotaStudio(studioId)).has(b.pemasarId)) return 'Pemasar bukan anggota unit ini'
  return null
}
export const buatKasus = wrap(async (req, res) => {
  const b = req.body ?? {}
  if (!(await akses(req, res, b.studioId))) return
  const g = L.validasiBuat(b); if (g) return gagal(res, 422, g)
  const { galat, data } = bidang(b, { baru: true }); if (galat) return gagal(res, 422, galat)
  const gr = await cekRelasi(b.studioId, b); if (gr) return gagal(res, 422, gr)
  if (data.kategori) { const kk = await kanonKategori(b.studioId, data.kategori); if (kk?.galat) return gagal(res, 422, kk.galat); data.kategori = kk }
  for (let i = 0; i < 3; i++) {
    try {
      const k = await prisma.kasusLtk.create({ data: { ...data, kode: await kodeBaru(b.arah), arah: b.arah, studioId: b.studioId, akunId: b.akunId || null, pemasarId: b.pemasarId || null, dibuatOlehId: req.user.id } })
      return res.status(201).json({ success: true, data: { id: k.id, kode: k.kode } })
    } catch (e) { if (e?.code !== 'P2002' || i === 2) throw e }
  }
})
export const ubahKasus = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  if (d.k.orderId || ['DITOLAK', 'DIBATALKAN'].includes(d.k.status)) return gagal(res, 409, 'LTK ini sudah final, tidak bisa diubah')
  const b = req.body ?? {}
  const { galat, data } = bidang(b, { baru: false }); if (galat) return gagal(res, 422, galat)
  const gr = await cekRelasi(d.k.studioId, b); if (gr) return gagal(res, 422, gr)
  if (data.kategori) { const kk = await kanonKategori(d.k.studioId, data.kategori); if (kk?.galat) return gagal(res, 422, kk.galat); data.kategori = kk }
  if (b.akunId !== undefined) data.akunId = b.akunId || null
  if (b.pemasarId !== undefined) data.pemasarId = b.pemasarId || null
  await prisma.kasusLtk.update({ where: { id: d.k.id }, data })
  return res.json({ success: true, message: 'LTK diperbarui' })
})
const pindah = (ke, siapkan) => wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  if (!L.bolehPindah(d.k.status, ke)) return gagal(res, 409, `LTK berstatus ${L.STATUS[d.k.status]} tidak bisa dipindah ke ${L.STATUS[ke]}`)
  const extra = siapkan ? siapkan(d.k, req.body ?? {}) : {}
  if (extra?.galat) return gagal(res, 422, extra.galat)
  await prisma.kasusLtk.update({ where: { id: d.k.id }, data: { status: ke, ...(extra?.data ?? {}) } })
  if (req.body?.catatan && String(req.body.catatan).trim()) await prisma.catatanLtk.create({ data: { kasusId: d.k.id, penulisId: req.user.id, penulis: await namaPengguna(req), isi: `[${L.STATUS[ke]}] ${String(req.body.catatan).trim().slice(0, 2000)}` } })
  return res.json({ success: true, message: `Status: ${L.STATUS[ke]}` })
})
export const ajukan = pindah('DIAJUKAN', () => ({ data: { diajukanPada: new Date() } }))
export const mulaiNegosiasi = pindah('NEGOSIASI')
export const tolak = pindah('DITOLAK')
export const batalkan = pindah('DIBATALKAN')
export const deal = pindah('DEAL', (k, b) => {
  const harga = b.hargaSepakat ?? k.hargaSepakat
  const g = L.validasiDeal({ hargaSepakat: harga }); if (g) return { galat: g }
  const dl = b.deadlineSepakat === undefined ? k.deadlineSepakat : (b.deadlineSepakat ? tgl(b.deadlineSepakat) : null)
  if (b.deadlineSepakat && !dl) return { galat: 'deadlineSepakat harus YYYY-MM-DD' }
  return { data: { hargaSepakat: Number(harga), deadlineSepakat: dl, ...(b.syarat !== undefined ? { syarat: b.syarat ? String(b.syarat).slice(0, 2000) : null } : {}), dealPada: new Date() } }
})
export const tambahCatatan = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  const isi = String(req.body?.isi ?? '').trim(); if (!isi || isi.length > 2000) return gagal(res, 422, 'Catatan wajib diisi (maks 2000 huruf)')
  const c = await prisma.catatanLtk.create({ data: { kasusId: d.k.id, penulisId: req.user.id, penulis: await namaPengguna(req), isi } })
  return res.status(201).json({ success: true, data: { id: c.id } })
})
// DEAL + TERIMA → OrderProduksi di inbox (nilai = harga sepakat, bersih mengikuti fee akun), tanpa memicu keuangan lain.
export const konversi = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  if (req.body?.akunId) { const gr = await cekRelasi(d.k.studioId, { akunId: req.body.akunId }); if (gr) return gagal(res, 422, gr); d.k.akunId = req.body.akunId }
  const g = L.validasiKonversi(d.k); if (g) return gagal(res, 422, g)
  const [tahap, akun, nama] = await Promise.all([pastikanTahap(d.k.studioId), prisma.akunProduksi.findUnique({ where: { id: d.k.akunId } }), namaPengguna(req)])
  const inbox = tahap.find(t => jenisNormal(t.jenis) === 'MASUK')
  const klienDir = await tautkanKlien(d.k.studioId, d.k.namaPihak, akun.platform)
  const order = await prisma.$transaction(async (tx) => {
    // Kunci baris LTK sampai transaksi selesai: dua klik "Konversi" bersamaan tidak boleh menghasilkan dua order
    await tx.$queryRaw`SELECT id FROM "KasusLtk" WHERE id = ${d.k.id} FOR UPDATE`
    const sudah = await tx.kasusLtk.findUnique({ where: { id: d.k.id }, select: { orderId: true } })
    if (sudah.orderId) throw Object.assign(new Error('dobel'), { code: 'P2002' })
    const o = await tx.orderProduksi.create({ data: {
      studioId: d.k.studioId, akunId: akun.id, tipeKlien: 'EKSTERNAL', klien: klienDir?.nama ?? d.k.namaPihak, klienId: klienDir?.id ?? null, judul: d.k.judul, kategori: d.k.kategori,
      nilaiDisepakati: d.k.hargaSepakat, nilaiKotor: d.k.hargaSepakat, nilaiBersih: hitungNilaiBersih(d.k.hargaSepakat, akun.feePersen),
      status: 'MASUK', subStatus: inbox.nama, tahapId: inbox.id, tahapAktif: ['-', ...tahap.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)],
      marketerId: d.k.pemasarId ?? null, deadline: d.k.deadlineSepakat ?? null,
      riwayatTahap: { create: { namaTahap: inbox.nama, jenis: jenisNormal(inbox.jenis), userId: req.user.id, namaPengguna: nama } },
    } })
    await tx.kasusLtk.update({ where: { id: d.k.id }, data: { orderId: o.id, akunId: akun.id } })
    await tx.auditOrder.create({ data: { orderId: o.id, userId: req.user.id, nama, aksi: 'KONVERSI', field: 'order', ke: `dari LTK ${d.k.kode}` } })
    await tx.catatanLtk.create({ data: { kasusId: d.k.id, penulisId: req.user.id, penulis: nama, isi: `Dikonversi menjadi order "${o.judul}".` } })
    return o
  })
  kabarOrderBaru(order.id) // grup Telegram koordinator (12 Nov 2026)
  return res.status(201).json({ success: true, data: { orderId: order.id } })
})

// LEMPAR (kita melempar pekerjaan ke pihak luar) yang sudah Deal → HUBUNGKAN ke order (9 Nov 2026, keputusan user): order yang sudah ada,
// atau order baru. Pihak luar dicatat di tim order (namaEksternal, fee = harga deal) sehingga alurnya terpantau di Produksi dan marketer
// pemegang order bisa menggeser tahap sebagai wakil freelance. Hanya pengelola unit (mengatur tim order).
export const getOrderUntukLempar = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  if (!d.p.manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  const o = await prisma.orderProduksi.findMany({ where: { studioId: d.k.studioId, status: { in: ['MASUK', 'PROSES'] }, ...saringAkun(d.p) }, orderBy: [{ deadline: 'asc' }, { tanggalMasuk: 'desc' }], take: 200, select: { id: true, judul: true, klien: true } })
  return res.json({ success: true, data: { order: o } })
})
export const hubungkanLempar = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  if (!d.p.manajer || d.p.lihatSaja) return gagal(res, 403, 'Hanya Koordinator ke atas yang bisa menghubungkan LTK ke order')
  if (d.k.arah !== 'LEMPAR') return gagal(res, 422, 'Hanya untuk LTK Lempar (Terima memakai "Konversi jadi order")')
  if (d.k.status !== 'DEAL') return gagal(res, 422, 'LTK harus berstatus Deal dulu')
  if (d.k.orderId) return gagal(res, 409, 'LTK ini sudah terhubung ke order')
  const b = req.body ?? {}
  const nama = await namaPengguna(req)
  const tipeEksternal = d.k.jenisPihak === 'FREELANCE' ? 'FREELANCER_PERORANGAN' : 'STUDIO_LAIN'
  const talent = d.k.jenisPihak === 'FREELANCE' ? await prisma.talentEksternal.findFirst({ where: { nama: { equals: d.k.namaPihak.trim(), mode: 'insensitive' }, ...whereFreelancerTerlihat(await lingkupStudio(d.k.studioId), d.k.studioId) }, select: { id: true } }) : null
  let orderId = b.orderId ? String(b.orderId) : null
  if (orderId) {
    const o = await prisma.orderProduksi.findUnique({ where: { id: orderId }, select: { studioId: true, status: true, akunId: true } })
    if (!o || o.studioId !== d.k.studioId) return gagal(res, 422, 'Order bukan milik unit ini')
    if (!orderDalamAkun(d.p, o)) return gagal(res, 403, 'Order ini di luar akun jualanmu')
    if (['SELESAI', 'BATAL'].includes(o.status)) return gagal(res, 409, 'Order sudah Selesai/Batal')
  } else {
    const klien = String(b.klien ?? '').trim()
    if (!klien || klien.length > 200) return gagal(res, 422, 'Isi nama klien untuk order baru (atau pilih order yang sudah ada)')
    const gr = b.akunId ? await cekRelasi(d.k.studioId, { akunId: b.akunId }) : null; if (gr) return gagal(res, 422, gr)
    const akunId = b.akunId || d.k.akunId
    if (!akunId) return gagal(res, 422, 'Pilih akun jualan untuk order baru')
    const nilai = b.nilai == null || b.nilai === '' ? 0 : Number(b.nilai)
    if (!Number.isFinite(nilai) || nilai < 0) return gagal(res, 422, 'Nilai order harus angka >= 0')
    const [tahap, akun] = await Promise.all([pastikanTahap(d.k.studioId), prisma.akunProduksi.findUnique({ where: { id: akunId } })])
    const inbox = tahap.find(t => jenisNormal(t.jenis) === 'MASUK')
    const klienDir = await tautkanKlien(d.k.studioId, klien, akun.platform)
    const o = await prisma.orderProduksi.create({ data: {
      studioId: d.k.studioId, akunId: akun.id, tipeKlien: 'EKSTERNAL', klien: klienDir?.nama ?? klien, klienId: klienDir?.id ?? null, judul: d.k.judul, kategori: d.k.kategori,
      nilaiDisepakati: nilai, nilaiKotor: nilai, nilaiBersih: hitungNilaiBersih(nilai, akun.feePersen),
      status: 'MASUK', subStatus: inbox.nama, tahapId: inbox.id, tahapAktif: ['-', ...tahap.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)],
      marketerId: d.k.pemasarId ?? null, deadline: d.k.deadlineSepakat ?? null,
      riwayatTahap: { create: { namaTahap: inbox.nama, jenis: jenisNormal(inbox.jenis), userId: req.user.id, namaPengguna: nama } },
    } })
    orderId = o.id
  }
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "KasusLtk" WHERE id = ${d.k.id} FOR UPDATE`
    if ((await tx.kasusLtk.findUnique({ where: { id: d.k.id }, select: { orderId: true } })).orderId) throw Object.assign(new Error('dobel'), { code: 'P2002' })
    await tx.assignmentProduksi.create({ data: { orderId, namaEksternal: d.k.namaPihak.trim(), tipeEksternal, talentEksternalId: talent?.id ?? null, feeTalent: d.k.hargaSepakat ?? null, peran: `Lempar ${d.k.kode}` } })
    await tx.kasusLtk.update({ where: { id: d.k.id }, data: { orderId } })
    await tx.auditOrder.create({ data: { orderId, userId: req.user.id, nama, aksi: 'KONVERSI', field: 'tim', ke: `${d.k.namaPihak} (LTK Lempar ${d.k.kode}, fee ${d.k.hargaSepakat ?? 0})` } })
    await tx.catatanLtk.create({ data: { kasusId: d.k.id, penulisId: req.user.id, penulis: nama, isi: b.orderId ? 'Dihubungkan ke order yang sudah ada.' : 'Dibuatkan order baru.' } })
  })
  if (!b.orderId) kabarOrderBaru(orderId) // order BARU saja → grup Telegram koordinator (12 Nov 2026)
  return res.status(201).json({ success: true, data: { orderId } })
})
export const hapusKasus = wrap(async (req, res) => {
  const d = await muat(req, res); if (!d) return
  if (!d.p.manajer) return gagal(res, 403, 'Hanya Koordinator ke atas yang bisa menghapus')
  if (!L.bisaDihapus(d.k)) return gagal(res, 409, 'Hanya LTK Draft/Ditolak/Dibatalkan tanpa order yang bisa dihapus')
  await prisma.kasusLtk.delete({ where: { id: d.k.id } })
  return res.json({ success: true, message: 'LTK dihapus' })
})

// Pilihan kategori unit (dipakai form LTK & profil order). Lihat/tambah: pengelola, marketer, admin market; ATUR (ganti nama/hapus): pengelola.
// Pemilik unit (lihat saja) hanya melihat.
async function aksesKategori(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  return { p, tambah: !p.lihatSaja && (p.manajer || p.marketer || p.adminMarket), kelola: !p.lihatSaja && p.manajer }
}
export const getKategoriOrder = wrap(async (req, res) => {
  const { studioId } = req.query
  const a = await aksesKategori(req, res, studioId); if (!a) return
  const baris = await sinkronKategori(studioId)
  const data = { kategori: baris.map(x => x.nama), bisaTambah: a.tambah, bisaKelola: a.kelola }
  if (a.kelola) { const hit = await pemakaianKategori(studioId); data.item = baris.map(x => ({ id: x.id, nama: x.nama, dipakai: hit.get(x.nama.toLowerCase()) ?? 0 })) }
  return res.json({ success: true, data })
})
export const tambahKategoriOrder = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  const a = await aksesKategori(req, res, studioId); if (!a) return
  if (!a.tambah) return gagal(res, 403, 'Hanya Koordinator ke atas atau marketer yang bisa menambah kategori')
  const nama = namaKategoriSah(req.body?.nama)
  if (!nama) return gagal(res, 422, `Nama kategori wajib diisi (maks ${MAKS_NAMA} huruf, tanpa tanda +)`)
  const kanon = await kanonKategori(studioId, nama)
  return res.status(201).json({ success: true, data: { nama: kanon, kategori: (await sinkronKategori(studioId)).map(x => x.nama) } })
})
// Ganti nama kategori: ikut mengubah order & LTK unit yang memakainya
export const gantiNamaKategoriOrder = wrap(async (req, res) => {
  const k = await prisma.kategoriOrder.findUnique({ where: { id: req.params.id } })
  if (!k) return gagal(res, 404, 'Kategori tidak ditemukan')
  const a = await aksesKategori(req, res, k.studioId); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya Koordinator ke atas yang bisa mengatur kategori')
  const baru = namaKategoriSah(req.body?.nama)
  if (!baru) return gagal(res, 422, `Nama kategori wajib diisi (maks ${MAKS_NAMA} huruf, tanpa tanda +)`)
  const lain = (await sinkronKategori(k.studioId)).find(x => x.id !== k.id && x.nama.toLowerCase() === baru.toLowerCase())
  if (lain) return gagal(res, 409, `Kategori "${lain.nama}" sudah ada`)
  const [order, ltk] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { studioId: k.studioId, kategori: { contains: k.nama, mode: 'insensitive' } }, select: { id: true, kategori: true } }),
    prisma.kasusLtk.findMany({ where: { studioId: k.studioId, kategori: { contains: k.nama, mode: 'insensitive' } }, select: { id: true, kategori: true } }),
  ])
  await prisma.$transaction([
    prisma.kategoriOrder.update({ where: { id: k.id }, data: { nama: baru } }),
    ...order.map(o => prisma.orderProduksi.update({ where: { id: o.id }, data: { kategori: gantiNamaDiTeks(o.kategori, k.nama, baru) } })),
    ...ltk.map(l => prisma.kasusLtk.update({ where: { id: l.id }, data: { kategori: gantiNamaDiTeks(l.kategori, k.nama, baru) } })),
  ])
  return res.json({ success: true, message: 'Nama kategori diganti' })
})
// Hapus kategori dari daftar: ditolak bila masih dipakai (ganti nama dulu atau ubah ordernya) agar riwayat tidak kehilangan kategori
export const hapusKategoriOrder = wrap(async (req, res) => {
  const k = await prisma.kategoriOrder.findUnique({ where: { id: req.params.id } })
  if (!k) return gagal(res, 404, 'Kategori tidak ditemukan')
  const a = await aksesKategori(req, res, k.studioId); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya Koordinator ke atas yang bisa mengatur kategori')
  const dipakai = (await pemakaianKategori(k.studioId)).get(k.nama.toLowerCase()) ?? 0
  if (dipakai) return gagal(res, 409, `Kategori "${k.nama}" masih dipakai ${dipakai} order/LTK — ganti nama saja, atau ubah dulu kategori order tersebut`)
  await prisma.kategoriOrder.delete({ where: { id: k.id } })
  return res.json({ success: true, message: 'Kategori dihapus dari daftar' })
})
