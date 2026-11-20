import prisma from '../prisma.js'
import { akses as aksesLtk } from './circleLtk.js'
import * as T from '../utils/tagihan.js'
import { kelolaStudio } from '../utils/roles.js'
import { peranKerja, saringAkun } from './circle.js'
import { sinkronBayar } from './circleOrder.js'
import { muatPosisiTagih } from '../utils/posisiTagihDb.js'

// TAGIHAN KOMUNITAS web circle (21 Okt 2026) — adaptasi OGS CommunityInvoice, sisi staf. Gabung beberapa order SATU klien → satu tagihan.
// DRAFT → DITAGIH → LUNAS (lunas = status bayar order ikut LUNAS). Nilai tagihan = nilaiKotor order (Rp). Tanpa portal pihak luar.
// Tagihan menggabungkan nilai order beberapa orang → HANYA Koordinator ke atas unit itu (marketer talent tidak melihat uang orang lain, 21 Okt 2026).
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
async function akses(req, res, studioId) {
  const p = await aksesLtk(req, res, studioId); if (!p) return null
  if (!p.manajer) { gagal(res, 403, 'Tagihan hanya untuk Koordinator ke atas unit ini'); return null }
  return p
}
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch (e) { if (e?.code === 'P2002') return gagal(res, 409, 'Data duplikat, coba lagi'); return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const r2 = (n) => Math.round(n * 100) / 100
const tglOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(new Date(s))

async function orderSudahDitagih(studioId, kecualiTagihanId = null) {
  const baris = await prisma.tagihanKomunitasItem.findMany({ where: { tagihan: { studioId, status: { not: 'BATAL' }, ...(kecualiTagihanId ? { id: { not: kecualiTagihanId } } : {}) } }, select: { orderId: true } })
  return new Set(baris.map(b => b.orderId))
}
// Admin per akun jualan (12 Nov 2026): order yang bisa ditagih hanya dari akunnya; tagihan hanya terlihat bila SEMUA ordernya dari akunnya.
async function semuaDalamAkun(t, p) {
  if (!p?.akunAdmin) return true
  const o = await prisma.orderProduksi.findMany({ where: { id: { in: t.item.map(i => i.orderId) } }, select: { akunId: true } })
  return o.every(x => p.akunAdmin.includes(x.akunId))
}
async function orderLayak(studioId, klien, kecualiTagihanId = null, p = null) {
  const [orders, sudah] = await Promise.all([prisma.orderProduksi.findMany({ where: { studioId, klien: { equals: klien.trim(), mode: 'insensitive' }, status: { not: 'BATAL' }, ...saringAkun(p) }, orderBy: { tanggalMasuk: 'asc' } }), orderSudahDitagih(studioId, kecualiTagihanId)])
  return orders.filter(o => T.layak(o, klien, sudah))
}
const rapi = (t, namaOrder = new Map()) => ({ id: t.id, nomor: t.nomor, studioId: t.studioId, klien: t.klien, status: t.status, labelStatus: T.STATUS[t.status], total: t.total, catatan: t.catatan, tautanBukti: t.tautanBukti, ditagihPada: t.ditagihPada, lunasPada: t.lunasPada, createdAt: t.createdAt, item: (t.item ?? []).sort((a, b) => a.urutan - b.urutan).map(i => ({ id: i.id, orderId: i.orderId, judul: `${namaOrder.get(i.orderId) ?? '—'}${i.keterangan ? ` — ${i.keterangan}` : ''}`, keterangan: i.keterangan ?? null, jumlah: i.jumlah })) })
async function muat(req, res) {
  const t = await prisma.tagihanKomunitas.findUnique({ where: { id: req.params.id }, include: { item: true } })
  if (!t) { gagal(res, 404, 'Tagihan tidak ditemukan'); return null }
  const p = await akses(req, res, t.studioId); if (!p) return null
  if (!(await semuaDalamAkun(t, p))) { gagal(res, 403, 'Tagihan ini memuat order di luar akun jualanmu'); return null }
  t._p = p
  return t
}
async function dengan(t) { const o = await prisma.orderProduksi.findMany({ where: { id: { in: t.item.map(i => i.orderId) } }, select: { id: true, judul: true } }); return rapi(t, new Map(o.map(x => [x.id, x.judul]))) }
async function nomorBaru() {
  const tahun = new Date(Date.now() + 7 * 3600000).getUTCFullYear()
  const last = await prisma.tagihanKomunitas.findFirst({ where: { nomor: { startsWith: `INV-${tahun}-` } }, orderBy: { nomor: 'desc' }, select: { nomor: true } })
  return T.nomorBerikut(tahun, last?.nomor)
}

export const getDaftar = wrap(async (req, res) => {
  const { studioId, status } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  if (p.akunAdmin) { // admin per akun: saring di sini (tagihan bisa memuat beberapa order)
    const semua = await prisma.tagihanKomunitas.findMany({ where: { studioId }, include: { item: true }, orderBy: { createdAt: 'desc' }, take: 500 })
    const milik = []; for (const t of semua) if (await semuaDalamAkun(t, p)) milik.push(t)
    const ringkasan = {}; for (const t of milik) { const e = ringkasan[t.status] ?? { jumlah: 0, total: 0 }; e.jumlah++; e.total = r2(e.total + t.total); ringkasan[t.status] = e }
    return res.json({ success: true, data: { tagihan: milik.filter(t => !(status && T.STATUS[status]) || t.status === status).slice(0, 200).map(t => rapi(t)), ringkasan } })
  }
  const daftar = await prisma.tagihanKomunitas.findMany({ where: { studioId, ...(status && T.STATUS[status] ? { status } : {}) }, include: { item: true }, orderBy: { createdAt: 'desc' }, take: 200 })
  const hit = await prisma.tagihanKomunitas.groupBy({ by: ['status'], where: { studioId }, _count: true, _sum: { total: true } })
  return res.json({ success: true, data: { tagihan: daftar.map(t => rapi(t)), ringkasan: Object.fromEntries(hit.map(h => [h.status, { jumlah: h._count, total: r2(h._sum.total ?? 0) }])) } })
})
// Klien yang punya order layak ditagih (untuk pilihan di formulir)
export const getKlien = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const [orders, sudah] = await Promise.all([prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, statusBayar: { not: 'LUNAS' }, nilaiKotor: { gt: 0 }, ...saringAkun(p) }, select: { id: true, klien: true, nilaiKotor: true } }), orderSudahDitagih(studioId)])
  const m = new Map(); for (const o of orders) { if (sudah.has(o.id)) continue; const k = o.klien.trim(); const e = m.get(k.toLowerCase()) ?? { klien: k, order: 0, total: 0 }; e.order++; e.total = r2(e.total + o.nilaiKotor); m.set(k.toLowerCase(), e) }
  return res.json({ success: true, data: [...m.values()].sort((a, b) => b.total - a.total) })
})
export const getLayak = wrap(async (req, res) => {
  const { studioId, klien, tagihanId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  if (!klien?.trim()) return gagal(res, 422, 'klien wajib diisi')
  const o = await orderLayak(studioId, klien, tagihanId || null, p)
  return res.json({ success: true, data: o.map(x => ({ id: x.id, judul: x.judul, nilaiKotor: x.nilaiKotor, statusBayar: x.statusBayar, tanggalMasuk: x.tanggalMasuk })) })
})
async function susunItem(studioId, klien, orderIds, kecualiTagihanId, p = null) {
  if (!Array.isArray(orderIds) || !orderIds.length) return { galat: 'Pilih minimal satu order.' }
  if (new Set(orderIds).size !== orderIds.length) return { galat: 'Ada order yang dipilih dua kali.' }
  const layak = await orderLayak(studioId, klien, kecualiTagihanId, p)
  const peta = new Map(layak.map(o => [o.id, o]))
  const tak = orderIds.filter(id => !peta.has(id))
  if (tak.length) return { galat: `${tak.length} order tidak layak ditagih (klien berbeda, sudah lunas/batal, atau sudah ada di tagihan lain).` }
  return { item: orderIds.map((id, i) => ({ orderId: id, jumlah: peta.get(id).nilaiKotor, urutan: i })) }
}
export const buat = wrap(async (req, res) => {
  const { studioId, klien, orderIds, catatan } = req.body ?? {}
  const p = await akses(req, res, studioId); if (!p) return
  if (!String(klien ?? '').trim()) return gagal(res, 422, 'Klien wajib diisi')
  const s = await susunItem(studioId, klien, orderIds, null, p); if (s.galat) return gagal(res, 422, s.galat)
  for (let i = 0; i < 3; i++) {
    try {
      const t = await prisma.tagihanKomunitas.create({ data: { nomor: await nomorBaru(), studioId, klien: String(klien).trim(), total: T.hitungTotal(s.item), catatan: catatan ? String(catatan).slice(0, 1000) : null, dibuatOlehId: req.user.id, item: { create: s.item } } })
      return res.status(201).json({ success: true, data: { id: t.id, nomor: t.nomor } })
    } catch (e) { if (e?.code !== 'P2002' || i === 2) throw e }
  }
})
// Penerbit invoice (9 Nov 2026): nama studio/PH + induknya + rekening & catatan kaki yang diisi koordinator (PengaturanInvoice).
async function penerbit(studioId) {
  const [s, p] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nama: true, circle: { select: { nama: true } }, rumahUsaha: { select: { nama: true } } } }),
    prisma.pengaturanInvoice.findUnique({ where: { studioId } }),
  ])
  return { nama: (p?.namaPenerbit || s?.nama || '').trim(), induk: s?.circle?.nama ?? s?.rumahUsaha?.nama ?? null, rekening: p?.rekening ?? null, catatanKaki: p?.catatanKaki ?? null }
}
export const getDetail = wrap(async (req, res) => { const t = await muat(req, res); if (!t) return; return res.json({ success: true, data: { ...(await dengan(t)), penerbit: await penerbit(t.studioId) } }) })
export const getPengaturanInvoice = wrap(async (req, res) => {
  const { studioId } = req.query
  const p = await akses(req, res, studioId); if (!p) return
  const x = await prisma.pengaturanInvoice.findUnique({ where: { studioId } })
  const pengelola = await kelolaStudio(peranKerja(req), studioId)
  // Rekening Ekosistem (StudioRekening) untuk mengisi invoice — keputusan user 9 Nov 2026: boleh, asal aman. HANYA dikirim ke pengelola unit itu
  // (Koordinator/Pendamping ke atas via kelolaStudio), hanya di endpoint ini; talent, marketer, Admin Market, pemilik & unit lain tidak menerimanya.
  const rekeningInternal = pengelola
    ? (await prisma.studioRekening.findMany({ where: { studioId }, orderBy: { createdAt: 'asc' }, select: { namaBank: true, nomorRekening: true, atasNama: true } })).map(r => ({ namaBank: r.namaBank, nomorRekening: r.nomorRekening, atasNama: r.atasNama }))
    : []
  // Siapa yang boleh mengisi (hanya nama): supaya yang tidak punya wewenang tahu harus meminta ke siapa (laporan tim 10 Nov 2026)
  const yangBoleh = pengelola ? [] : (await prisma.userRole.findMany({ where: { studioId, roleType: { in: ['KOORDINATOR', 'PENDAMPING'] }, user: { statusAktif: true } }, select: { user: { select: { nama: true } } } })).map(r => r.user.nama)
  return res.json({ success: true, data: { namaPenerbit: x?.namaPenerbit ?? '', rekening: x?.rekening ?? '', catatanKaki: x?.catatanKaki ?? '', bisaUbah: pengelola, yangBoleh: [...new Set(yangBoleh)], rekeningInternal, contoh: await penerbit(studioId) } })
})
// Hanya pengelola unit (Koordinator = CEO unit); Admin Market & pemilik tidak mengubah data penerima uang
export const simpanPengaturanInvoice = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await akses(req, res, studioId))) return
  if (!(await kelolaStudio(peranKerja(req), studioId))) return gagal(res, 403, 'Hanya Koordinator unit yang bisa mengubah data penerbit invoice')
  const t = (v, maks) => { const s = String(v ?? '').trim(); return s ? s.slice(0, maks) : null }
  const data = { namaPenerbit: t(req.body?.namaPenerbit, 120), rekening: t(req.body?.rekening, 500), catatanKaki: t(req.body?.catatanKaki, 500), diubahOleh: req.user.id }
  await prisma.pengaturanInvoice.upsert({ where: { studioId }, update: data, create: { studioId, ...data } })
  return res.json({ success: true, message: 'Penerbit invoice disimpan' })
})
export const ubah = wrap(async (req, res) => {
  const t = await muat(req, res); if (!t) return
  if (!T.bisaDiubah(t)) return gagal(res, 409, 'Hanya tagihan Draft yang bisa diubah')
  const b = req.body ?? {}, data = {}
  if (b.catatan !== undefined) data.catatan = b.catatan ? String(b.catatan).slice(0, 1000) : null
  if (b.orderIds !== undefined) {
    const s = await susunItem(t.studioId, t.klien, b.orderIds, t.id, t._p); if (s.galat) return gagal(res, 422, s.galat)
    data.total = T.hitungTotal(s.item)
    await prisma.$transaction([prisma.tagihanKomunitasItem.deleteMany({ where: { tagihanId: t.id } }), prisma.tagihanKomunitasItem.createMany({ data: s.item.map(i => ({ ...i, tagihanId: t.id })) }), prisma.tagihanKomunitas.update({ where: { id: t.id }, data })])
  } else await prisma.tagihanKomunitas.update({ where: { id: t.id }, data })
  return res.json({ success: true, message: 'Tagihan diperbarui' })
})
const pindah = (ke, siapkan) => wrap(async (req, res) => {
  const t = await muat(req, res); if (!t) return
  if (!T.bolehPindah(t.status, ke)) return gagal(res, 409, `Tagihan ${T.STATUS[t.status]} tidak bisa dipindah ke ${T.STATUS[ke]}`)
  const x = siapkan ? await siapkan(t, req) : {}
  if (x?.galat) return gagal(res, x.kode ?? 422, x.galat)
  await prisma.$transaction(async (tx) => {
    await tx.tagihanKomunitas.update({ where: { id: t.id }, data: { status: ke, ...(x?.data ?? {}) } })
    if (x?.sesudah) await x.sesudah(tx)
  })
  if (x?.setelah) await x.setelah()
  return res.json({ success: true, message: `Status: ${T.STATUS[ke]}` })
})
export const tagih = pindah('DITAGIH', (t) => (t.item.length ? { data: { ditagihPada: new Date() } } : { galat: 'Tagihan harus memiliki minimal satu order.' }))
export const kembaliDraft = pindah('DRAFT', () => ({ data: { ditagihPada: null } }))
export const batalkan = pindah('BATAL', (t) => (t.status === 'DRAFT' ? {} : { galat: 'Hanya tagihan Draft yang bisa dibatalkan.', kode: 409 }))
export const aktifkanLagi = pindah('DRAFT', async (t) => {
  const s = await susunItem(t.studioId, t.klien, t.item.map(i => i.orderId), t.id, t._p)
  return s.galat ? { galat: 'Sebagian order sudah tidak layak ditagih: ' + s.galat, kode: 409 } : {}
})
// Lunas (12 Nov 2026, masukan tim): pembayaran invoice DICATAT SEBAGAI CICILAN order (TerminBayarOrder, dibayar, tagihanId) → status bayar order
// dihitung ulang dari cicilan (sinkronBayar) — invoice DP membuat order berstatus DP, bukan dipaksa Lunas. Cicilan = uang diterima studio (setelah
// potongan platform), jadi jumlah invoice (harga ke klien) dikonversi dengan rasio nilai bersih/kotor. Invoice nilai penuh (tagihan gabungan lama)
// mencatat sisa yang belum diterima.
export const lunas = pindah('LUNAS', async (t, req) => {
  const b = req.body ?? {}
  if (b.tanggal && !tglOk(b.tanggal)) return { galat: 'tanggal harus YYYY-MM-DD' }
  if (b.tautanBukti && !/^https?:\/\//i.test(b.tautanBukti)) return { galat: 'Tautan bukti harus diawali http:// atau https://' }
  const waktu = b.tanggal ? new Date(b.tanggal + 'T00:00:00.000Z') : new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const orders = await prisma.orderProduksi.findMany({ where: { id: { in: t.item.map(i => i.orderId) } }, select: { id: true, nilaiKotor: true, nilaiBersih: true, terminBayar: { select: { jumlah: true, dibayarPada: true } } } })
  const peta = new Map(orders.map(o => [o.id, o]))
  const termin = []
  for (const i of t.item) {
    const o = peta.get(i.orderId); if (!o) continue
    const diterima = o.terminBayar.filter(x => x.dibayarPada).reduce((a, x) => a + x.jumlah, 0)
    const jumlah = i.keterangan ? r2(o.nilaiKotor > 0 ? i.jumlah * (o.nilaiBersih / o.nilaiKotor) : i.jumlah) : r2(Math.max(0, o.nilaiBersih - diterima))
    if (jumlah > 0) termin.push({ orderId: o.id, label: (i.keterangan ?? 'Pelunasan').slice(0, 60), jumlah, dibayarPada: waktu, tagihanId: t.id, catatan: `Invoice ${t.nomor}`, urutan: o.terminBayar.length })
  }
  return {
    data: { lunasPada: waktu, tautanBukti: b.tautanBukti || null },
    sesudah: (tx) => termin.length ? tx.terminBayarOrder.createMany({ data: termin }) : null,
    setelah: async () => { for (const id of new Set(termin.map(x => x.orderId))) await sinkronBayar(id) },
  }
})

// ── Invoice per order (12 Nov 2026, masukan tim): dari detail order, Invoice DP / Pelunasan langsung terbit (DITAGIH) & siap cetak —
// tanpa menyusun tagihan manual. Total semua invoice aktif satu order tidak boleh melebihi harga yang disepakati.
async function orderUntukInvoice(req, res) {
  const o = await prisma.orderProduksi.findUnique({ where: { id: req.params.id }, select: { id: true, studioId: true, akunId: true, klien: true, judul: true, status: true, nilaiKotor: true, nilaiDisepakati: true } })
  if (!o) { gagal(res, 404, 'Order tidak ditemukan'); return null }
  const p = await akses(req, res, o.studioId); if (!p) return null
  if (p.akunAdmin && !p.akunAdmin.includes(o.akunId)) { gagal(res, 403, 'Order ini di luar akun jualanmu'); return null }
  return o
}
async function invoiceOrder(orderId) {
  const item = await prisma.tagihanKomunitasItem.findMany({ where: { orderId, tagihan: { status: { not: 'BATAL' } } }, include: { tagihan: { select: { id: true, nomor: true, status: true, ditagihPada: true, lunasPada: true } } }, orderBy: { tagihan: { createdAt: 'asc' } } })
  return item.map(i => ({ id: i.tagihan.id, nomor: i.tagihan.nomor, status: i.tagihan.status, labelStatus: T.STATUS[i.tagihan.status], keterangan: i.keterangan ?? 'Nilai penuh', jumlah: i.jumlah, ditagihPada: i.tagihan.ditagihPada, lunasPada: i.tagihan.lunasPada }))
}
export const getInvoiceOrder = wrap(async (req, res) => {
  const o = await orderUntukInvoice(req, res); if (!o) return
  const [daftar, pos] = await Promise.all([invoiceOrder(o.id), muatPosisiTagih([o.id]).then(m => m.get(o.id))])
  return res.json({ success: true, data: { invoice: daftar, harga: pos.harga, sudahDitagih: pos.dalamTagihan, dibayarTanpaInvoice: pos.dibayarLangsung, belumDitagih: pos.belumDitagih } })
})
export const buatInvoiceOrder = wrap(async (req, res) => {
  const o = await orderUntukInvoice(req, res); if (!o) return
  if (o.status === 'BATAL') return gagal(res, 409, 'Order dibatalkan')
  const jenis = req.body?.jenis
  if (!['DP', 'CICILAN', 'PELUNASAN', 'LAIN'].includes(jenis)) return gagal(res, 422, 'jenis harus DP, CICILAN, PELUNASAN, atau LAIN')
  // Sisa = rumus bersama posisiTagih: harga − invoice aktif − cicilan yang sudah diterima tanpa invoice (mis. DP dicatat langsung)
  const pos = (await muatPosisiTagih([o.id])).get(o.id), harga = pos.harga, sisa = pos.belumDitagih
  if (!(harga > 0)) return gagal(res, 422, 'Harga order belum diisi')
  if (sisa <= 0.5) return gagal(res, 409, 'Seluruh harga order sudah ditagih atau sudah dibayar')
  const jumlah = r2(jenis === 'PELUNASAN' && req.body?.jumlah == null ? sisa : Number(req.body?.jumlah))
  if (!(jumlah > 0)) return gagal(res, 422, 'Jumlah invoice harus lebih dari 0')
  if (jumlah > sisa + 0.5) return gagal(res, 422, `Melebihi sisa yang belum ditagih (Rp ${Math.round(sisa).toLocaleString('id-ID')})`)
  // Cicilan bernomor otomatis (12 Nov 2026, masukan tim): Cicilan 1, 2, … dari invoice cicilan order ini yang sudah ada
  const nCicilan = jenis === 'CICILAN' ? (await invoiceOrder(o.id)).filter(x => /^Cicilan/i.test(x.keterangan)).length + 1 : 0
  const keterangan = jenis === 'DP' ? 'DP' : jenis === 'PELUNASAN' ? 'Pelunasan' : jenis === 'CICILAN' ? `Cicilan ${nCicilan}` : String(req.body?.keterangan ?? '').trim().slice(0, 60)
  if (!keterangan) return gagal(res, 422, 'Isi keterangan invoice')
  for (let i = 0; i < 3; i++) {
    try {
      const t = await prisma.tagihanKomunitas.create({ data: { nomor: await nomorBaru(), studioId: o.studioId, klien: o.klien, status: 'DITAGIH', ditagihPada: new Date(), total: jumlah, catatan: req.body?.catatan ? String(req.body.catatan).slice(0, 1000) : null, dibuatOlehId: req.user.id, item: { create: [{ orderId: o.id, jumlah, keterangan, urutan: 0 }] } } })
      return res.status(201).json({ success: true, data: { id: t.id, nomor: t.nomor }, message: `Invoice ${t.nomor} (${keterangan}) terbit` })
    } catch (e) { if (e?.code !== 'P2002' || i === 2) throw e }
  }
})
