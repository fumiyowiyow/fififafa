import prisma from '../prisma.js'
import { hitungNilaiBersih, klienTampakNominal } from '../utils/produksi.js'
import { jenisNormal, STATUS_DARI_JENIS } from '../utils/alur.js'
import { studioBolehDilihat, peranStudio, peranOrder, saringAkun, orderDalamAkun, akunUntukOrder, terapkanPindah, pastikanTahap, tahapEfektif } from './circle.js'
import { talentUnit, tutupPenugasanBasi } from '../utils/penugasanDb.js'
import { catatAudit, bedaField } from '../utils/auditOrder.js'
import { kolomStudio, isianLengkap, nilaiSah } from './circleKolomKhusus.js'
import { tautkanKlien } from './circleKlien.js'
import { validasiUsd, rupiahDariUsd } from '../utils/uang.js'

// DETAIL ORDER web circle (20 Okt 2026) — adaptasi OGS (halaman detail proyek, item/add-on, termin pembayaran, catatan proyek,
// tagihan jatuh tempo). Uang HANYA untuk manajer (Koordinator ke atas / Admin Market); anggota yang ditugaskan melihat order
// tanpa nilai uang; marketer pemilik order melihat orderannya tanpa uang. Termin menyelaraskan statusBayar order (Ekosistem), TIDAK menulis ke laporan omset.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const HARI = 86400000
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(new Date(s)) ? new Date(s + 'T00:00:00.000Z') : null)

const muatOrder = (id) => prisma.orderProduksi.findUnique({ where: { id }, include: { akun: { select: { namaAkun: true, platform: true, feePersen: true } }, tahap: { select: { nama: true, jenis: true } }, assignments: { select: { id: true, peran: true, feeTalent: true, namaEksternal: true, userId: true, tahapKerjaIds: true, berhentiPada: true, alasanBerhenti: true, user: { select: { id: true, nama: true } } } }, marketer: { select: { id: true, nama: true } } } })

/** Izin atas satu order: { lihat, manajer, terlibat } — lihat = boleh membuka detail (manajer, ditugaskan, atau marketer pemilik). */
async function izin(req, order) {
  if (!order || !(await studioBolehDilihat(req, order.studioId))) return null
  const { manajer, lihatSaja } = await peranOrder(req, order) // Admin per akun: di luar akunnya bukan pengelola
  const pemasar = order.marketerId === req.user.id
  const terlibat = order.assignments.some(a => a.userId === req.user.id) || pemasar
  return manajer || terlibat ? { manajer, terlibat, pemasar, lihatSaja: !!lihatSaja } : null
}

/** Selaraskan statusBayar order dari termin: LUNAS bila diterima ≥ acuan, DP bila sebagian. Acuan = uang masuk sebenarnya (bila diisi) atau perkiraan nilaiBersih. */
export async function sinkronBayar(orderId) {
  const o = await prisma.orderProduksi.findUnique({ where: { id: orderId }, select: { nilaiBersih: true, uangMasukRiil: true } })
  const termin = await prisma.terminBayarOrder.findMany({ where: { orderId }, select: { jumlah: true, dibayarPada: true } })
  if (!o || !termin.length) return
  const diterima = termin.filter(t => t.dibayarPada).reduce((a, t) => a + t.jumlah, 0)
  const terakhir = termin.filter(t => t.dibayarPada).map(t => t.dibayarPada).sort((a, b) => b - a)[0] ?? null
  const acuan = o.uangMasukRiil ?? o.nilaiBersih
  const lunas = acuan > 0 ? diterima >= acuan - 0.5 : diterima > 0 && termin.every(t => t.dibayarPada)
  await prisma.orderProduksi.update({ where: { id: orderId }, data: lunas ? { statusBayar: 'LUNAS', dpAmount: null, tanggalLunas: terakhir } : diterima > 0 ? { statusBayar: 'DP', dpAmount: diterima, tanggalLunas: null } : { statusBayar: 'BELUM_LUNAS', dpAmount: null, tanggalLunas: null } })
}

const totalAddon = (items) => items.filter(i => i.jenis === 'ADDON').reduce((a, i) => a + i.jumlah * i.hargaSatuan, 0)
const ringkasUang = (o, items, termin, sekarang = new Date()) => {
  const totalItem = items.reduce((a, i) => a + i.jumlah * i.hargaSatuan, 0)
  const diterima = termin.filter(t => t.dibayarPada).reduce((a, t) => a + t.jumlah, 0)
  const hariIni = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), sekarang.getUTCDate()))
  return {
    nilaiKotor: o.nilaiKotor, nilaiBersih: o.nilaiBersih, uangMasukRiil: o.uangMasukRiil, nilaiDisepakati: o.nilaiDisepakati, statusBayar: o.statusBayar,
    // Add-on MENAMBAH nilai order (13 Nov 2026, masukan tim): nilai order = pokok + add-on. Selisih hanya dicek bila ada baris ITEM (rincian pokok).
    totalItem, totalAddon: totalAddon(items), selisihItem: items.some(i => i.jenis !== 'ADDON') ? Math.round((o.nilaiKotor - totalItem) * 100) / 100 : null,
    diterima, sisaTagihan: Math.max(0, Math.round(((o.uangMasukRiil ?? o.nilaiBersih) - diterima) * 100) / 100),
    terlambat: termin.filter(t => !t.dibayarPada && t.jatuhTempo && t.jatuhTempo < hariIni).length,
  }
}

export const getDetail = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  const hak = await izin(req, order); if (!hak) return gagal(res, 403, 'Tidak punya akses ke order ini')
  const [items, termin, riwayat, catatan] = await Promise.all([
    prisma.itemOrder.findMany({ where: { orderId: order.id }, orderBy: { urutan: 'asc' } }),
    prisma.terminBayarOrder.findMany({ where: { orderId: order.id }, orderBy: { urutan: 'asc' } }),
    prisma.riwayatTahapOrder.findMany({ where: { orderId: order.id }, orderBy: { mulai: 'asc' } }),
    prisma.catatanOrder.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ])
  const data = {
    id: order.id, judul: order.judul, klien: order.klien, kategori: order.kategori, status: order.status, cancelKlien: order.cancelKlien, alasanCancel: order.cancelKlien ? order.alasanCancel : null, cancelPada: order.cancelKlien ? order.cancelPada : null, subStatus: order.subStatus, revisiKe: order.revisiKe,
    tahap: order.tahap ? { nama: order.tahap.nama, jenis: jenisNormal(order.tahap.jenis) } : null,
    akun: order.akun ? { id: order.akunId, namaAkun: order.akun.namaAkun, platform: order.akun.platform } : null,
    marketer: order.marketer, tanggalMasuk: order.tanggalMasuk, deadline: order.deadline, tanggalSelesai: order.tanggalSelesai, catatan: order.catatan,
    tim: order.assignments.map(a => ({ id: a.id, nama: a.user?.nama ?? a.namaEksternal ?? '—', peran: a.peran, eksternal: !a.userId, tahapKerjaIds: a.tahapKerjaIds ?? [], berhentiPada: a.berhentiPada, alasanBerhenti: a.alasanBerhenti })), // yang berhenti tetap tampil (riwayat & fee)
    riwayat: riwayat.map(r => ({ nama: r.namaTahap, jenis: jenisNormal(r.jenis), oleh: r.namaPengguna, mulai: r.mulai, selesai: r.selesai })),
    catatanProyek: catatan.map(c => ({ id: c.id, nama: c.nama, isi: c.isi, createdAt: c.createdAt, milikku: c.userId === req.user.id })),
    // Pemilik unit (lihat saja) melihat semua, tetapi tombol ubah hanya bila ia sendiri pemegang order (laporan 9 Nov 2026: tombol
    // "Batalkan order" tampil lalu ditolak server)
    studioId: order.studioId, bisaKelola: hak.manajer && !hak.lihatSaja, bisaUbahOrder: (hak.manajer && !hak.lihatSaja) || hak.pemasar,
    profil: { genre: order.genre, kesulitan: order.kesulitan, kategori: order.kategori },
    tautan: order.tautan ?? [], bisaUbahTautan: hak.manajer || hak.terlibat,
    // item tampil untuk semua yang berhak; harga/uang HANYA manajer & marketer pemegang order
    item: items.map(i => ({ id: i.id, jenis: i.jenis, nama: i.nama, jumlah: i.jumlah, catatan: i.catatan, ...(hak.manajer || hak.pemasar ? { hargaSatuan: i.hargaSatuan } : {}) })),
  }
  // Marketer pemegang order ini melihat & mengubah ORDERNYA SENDIRI (21 Okt: lihat; 9 Nov 2026: data dasar, item, termin), tanpa fee tim/audit.
  if (!hak.manajer && hak.pemasar) {
    data.uang = ringkasUang(order, items, termin)
    data.mataUang = { mataUang: order.mataUang, kurs: order.kurs, nilaiUsd: order.nilaiUsd }
    data.termin = termin.map(t => ({ id: t.id, label: t.label, jumlah: t.jumlah, jatuhTempo: ISO(t.jatuhTempo), dibayarPada: ISO(t.dibayarPada), catatan: t.catatan }))
  }
  if (hak.manajer) {
    // pilihan tahap untuk tim per tahap (hanya tahap pengerjaan & finalisasi)
    data.tahapKerja = (await pastikanTahap(order.studioId)).filter(t => ['KERJA', 'FINALISASI'].includes(jenisNormal(t.jenis))).map(t => ({ id: t.id, nama: t.nama, jenis: jenisNormal(t.jenis) }))
    data.termin = termin.map(t => ({ id: t.id, label: t.label, jumlah: t.jumlah, jatuhTempo: ISO(t.jatuhTempo), dibayarPada: ISO(t.dibayarPada), catatan: t.catatan }))
    data.uang = ringkasUang(order, items, termin)
    data.anggotaUnit = [...(await talentUnit(order.studioId)).entries()].map(([id, nama]) => ({ id, nama }))
    data.mataUang = { mataUang: order.mataUang, kurs: order.kurs, nilaiUsd: order.nilaiUsd }
    data.audit = (await prisma.auditOrder.findMany({ where: { orderId: order.id }, orderBy: { waktu: 'desc' }, take: 40 })).map(a => ({ id: a.id, nama: a.nama, aksi: a.aksi, field: a.field, dari: a.dari, ke: a.ke, waktu: a.waktu }))
    data.timFee = order.assignments.map(a => ({ id: a.id, nama: a.user?.nama ?? a.namaEksternal ?? '—', feeTalent: a.feeTalent }))
  }
  // Kolom khusus (12 Nov 2026): semua yang boleh membuka order (termasuk talent) melihat nilainya; pengelola/marketer pemegang yang mengisi
  data.khusus = isianLengkap(await kolomStudio(order.studioId), order.isianKhusus)
  data.bisaIsiKhusus = (hak.manajer && !hak.lihatSaja) || hak.pemasar
  return res.json({ success: true, data })
})

// Pengubah order: Koordinator ke atas / Admin Market, ATAU marketer pemegang order itu (keputusan user 9 Nov 2026: data dasar, item & add-on,
// termin pembayaran untuk order miliknya). Tim/penugasan, fee talent, dan pindah tahap manual tetap hanya pengelola.
async function manajerAtasOrder(req, res) {
  const order = await muatOrder(req.params.id)
  if (!order || !(await studioBolehDilihat(req, order.studioId))) { gagal(res, 403, 'Tidak punya akses ke order ini'); return null }
  if (!(await peranOrder(req, order)).manajer && order.marketerId !== req.user.id) { gagal(res, 403, 'Hanya Koordinator ke atas atau marketer pemegang order ini yang bisa mengubah order'); return null }
  return order
}

// Isi kolom khusus order (12 Nov 2026, masukan tim): body { [kolomId]: nilai } — hanya kolom aktif unit order ini; '' = kosongkan
export const simpanIsianKhusus = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  const kolom = await kolomStudio(order.studioId), baru = { ...(order.isianKhusus && typeof order.isianKhusus === 'object' ? order.isianKhusus : {}) }
  for (const [id, v] of Object.entries(req.body ?? {})) {
    const k = kolom.find(x => x.id === id); if (!k) return gagal(res, 422, 'Kolom tidak dikenal untuk unit ini')
    const n = nilaiSah(k, v); if (n === undefined) return gagal(res, 422, `Nilai "${k.nama}" tidak sah`)
    if (n == null) delete baru[id]; else baru[id] = n
  }
  await prisma.orderProduksi.update({ where: { id: order.id }, data: { isianKhusus: baru } })
  return res.json({ success: true, message: 'Tersimpan' })
})

// Item & add-on: DAFTAR DIGANTI seluruhnya (PUT) supaya penyuntingan sederhana
export const simpanItem = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  const daftar = req.body?.item
  if (!Array.isArray(daftar) || daftar.length > 60) return gagal(res, 422, 'item harus berupa daftar (maks 60 baris)')
  const bersih = []
  for (const [i, x] of daftar.entries()) {
    const nama = String(x?.nama ?? '').trim(), jumlah = Number(x?.jumlah ?? 1), harga = Number(x?.hargaSatuan ?? 0)
    if (!nama || nama.length > 120) return gagal(res, 422, `Baris ${i + 1}: nama wajib diisi (maks 120 huruf)`)
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 999) return gagal(res, 422, `Baris ${i + 1}: jumlah harus bilangan bulat 1–999`)
    if (!Number.isFinite(harga) || harga < 0) return gagal(res, 422, `Baris ${i + 1}: harga tidak boleh negatif`)
    if (!['ITEM', 'ADDON'].includes(x?.jenis ?? 'ITEM')) return gagal(res, 422, `Baris ${i + 1}: jenis harus ITEM atau ADDON`)
    bersih.push({ orderId: order.id, jenis: x.jenis ?? 'ITEM', nama, jumlah, hargaSatuan: harga, urutan: i, catatan: x?.catatan ? String(x.catatan).slice(0, 300) : null })
  }
  // Add-on menambah nilai order (13 Nov 2026, masukan tim: add-on Rp10 tidak mengubah nilai). Yang dihitung = SELISIH total add-on lama → baru,
  // jadi menyimpan ulang tanpa mengubah add-on tidak menggeser nilai. Nilai bersih dihitung ulang dari fee akun; status bayar disinkronkan.
  const lama = await prisma.itemOrder.findMany({ where: { orderId: order.id }, select: { jenis: true, jumlah: true, hargaSatuan: true } })
  const delta = totalAddon(bersih) - totalAddon(lama)
  if (delta && order.status === 'BATAL') return gagal(res, 422, 'Order yang dihapus tidak bisa diubah nilainya')
  const nilai = delta ? Math.max(0, Math.round(order.nilaiKotor + delta)) : null
  // Order USD (13 Nov 2026, masukan tim): add-on diisi dalam USD × kurs order → nilai USD order ikut bertambah
  const usdIkut = delta && order.mataUang === 'USD' && order.kurs > 0 ? { nilaiUsd: Math.max(0, Math.round(((order.nilaiUsd ?? 0) + delta / order.kurs) * 100) / 100) } : {}
  await prisma.$transaction([
    prisma.itemOrder.deleteMany({ where: { orderId: order.id } }), prisma.itemOrder.createMany({ data: bersih }),
    ...(delta ? [prisma.orderProduksi.update({ where: { id: order.id }, data: { nilaiKotor: nilai, nilaiDisepakati: nilai, nilaiBersih: hitungNilaiBersih(nilai, order.akun?.feePersen ?? 0), ...usdIkut } })] : []),
  ])
  const total = bersih.reduce((a, i) => a + i.jumlah * i.hargaSatuan, 0)
  await catatAudit(order.id, req.user.id, 'ITEM', [{ field: 'item', dari: null, ke: `${bersih.length} baris, total ${total}` }, ...(delta ? [{ field: 'nilaiKotor', dari: String(order.nilaiKotor), ke: `${nilai} (add-on ${delta > 0 ? '+' : ''}${delta})` }] : [])])
  if (delta) await sinkronBayar(order.id)
  const adaPokok = bersih.some(i => i.jenis !== 'ADDON'), kotor = nilai ?? order.nilaiKotor
  return res.json({ success: true, data: { jumlahBaris: bersih.length, totalItem: total, nilaiKotor: kotor, perubahanAddon: delta, selisihDenganNilaiOrder: adaPokok ? Math.round((kotor - total) * 100) / 100 : null } })
})

// Samakan nilai order dengan total item — tindakan EKSPLISIT (nilaiBersih dihitung ulang dari fee akun, sama seperti Ekosistem)
export const samakanNilai = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  const items = await prisma.itemOrder.findMany({ where: { orderId: order.id } })
  if (!items.some(i => i.jenis !== 'ADDON')) return gagal(res, 409, 'Belum ada item pokok untuk dijadikan acuan nilai (add-on sudah otomatis menambah nilai order)')
  const total = items.reduce((a, i) => a + i.jumlah * i.hargaSatuan, 0)
  const bersih = hitungNilaiBersih(total, order.akun?.feePersen ?? 0)
  const usd = order.mataUang === 'USD' && order.kurs > 0 ? { nilaiUsd: Math.round((total / order.kurs) * 100) / 100 } : {} // sama dengan ubah nilai langsung
  await prisma.orderProduksi.update({ where: { id: order.id }, data: { nilaiKotor: total, nilaiDisepakati: total, nilaiBersih: bersih, ...usd } })
  await catatAudit(order.id, req.user.id, 'UBAH', [{ field: 'nilaiKotor', dari: String(order.nilaiKotor), ke: String(total) }, { field: 'nilaiBersih', dari: String(order.nilaiBersih), ke: String(bersih) }])
  await sinkronBayar(order.id)
  return res.json({ success: true, data: { nilaiKotor: total, nilaiBersih: bersih } })
})

function bersihTermin(b, { baru }) {
  const out = {}
  if (baru || b.label !== undefined) { const l = String(b.label ?? '').trim(); if (!l || l.length > 60) return { galat: 'Label termin wajib diisi (maks 60 huruf)' }; out.label = l }
  if (baru || b.jumlah !== undefined) { const j = Number(b.jumlah); if (!Number.isFinite(j) || j <= 0) return { galat: 'Jumlah termin harus lebih dari 0' }; out.jumlah = j }
  if (b.jatuhTempo !== undefined) { if (b.jatuhTempo === null || b.jatuhTempo === '') out.jatuhTempo = null; else { const t = tgl(b.jatuhTempo); if (!t) return { galat: 'Jatuh tempo harus YYYY-MM-DD' }; out.jatuhTempo = t } }
  if (b.dibayarPada !== undefined) { if (b.dibayarPada === null || b.dibayarPada === '') out.dibayarPada = null; else { const t = tgl(b.dibayarPada); if (!t) return { galat: 'Tanggal bayar harus YYYY-MM-DD' }; out.dibayarPada = t } }
  if (b.catatan !== undefined) out.catatan = b.catatan ? String(b.catatan).slice(0, 300) : null
  return { data: out }
}
export const buatTermin = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  const { galat, data } = bersihTermin(req.body ?? {}, { baru: true }); if (galat) return gagal(res, 422, galat)
  const n = await prisma.terminBayarOrder.count({ where: { orderId: order.id } })
  if (n >= 24) return gagal(res, 409, 'Maksimal 24 termin per order')
  const t = await prisma.terminBayarOrder.create({ data: { orderId: order.id, urutan: n, ...data } })
  await catatAudit(order.id, req.user.id, 'TERMIN', [{ field: 'termin+', dari: null, ke: `${data.label} ${data.jumlah}` }])
  await sinkronBayar(order.id)
  return res.status(201).json({ success: true, data: { id: t.id } })
})
const lewatTermin = (isi) => wrap(async (req, res) => {
  const t = await prisma.terminBayarOrder.findUnique({ where: { id: req.params.terminId } })
  if (!t || t.orderId !== req.params.id) return gagal(res, 404, 'Termin tidak ditemukan')
  const order = await manajerAtasOrder(req, res); if (!order) return
  return isi(req, res, t, order)
})
export const ubahTermin = lewatTermin(async (req, res, t) => {
  const { galat, data } = bersihTermin(req.body ?? {}, { baru: false }); if (galat) return gagal(res, 422, galat)
  await prisma.terminBayarOrder.update({ where: { id: t.id }, data })
  await catatAudit(t.orderId, req.user.id, 'TERMIN', bedaField(t, data, ['label', 'jumlah', 'jatuhTempo', 'dibayarPada']).map(x => ({ ...x, field: `termin ${t.label}: ${x.field}` })))
  await sinkronBayar(t.orderId)
  return res.json({ success: true, message: 'Termin diperbarui' })
})
export const hapusTermin = lewatTermin(async (req, res, t) => {
  await prisma.terminBayarOrder.delete({ where: { id: t.id } })
  await catatAudit(t.orderId, req.user.id, 'TERMIN', [{ field: 'termin-', dari: `${t.label} ${t.jumlah}`, ke: null }])
  await sinkronBayar(t.orderId)
  return res.json({ success: true, message: 'Termin dihapus' })
})

// Catatan proyek (OGS ProjectNoteService): siapa pun yang berhak melihat order boleh menulis; hapus = milik sendiri atau manajer
export const buatCatatan = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  const hak = await izin(req, order); if (!hak) return gagal(res, 403, 'Tidak punya akses ke order ini')
  const isi = String(req.body?.isi ?? '').trim()
  if (!isi || isi.length > 1000) return gagal(res, 422, 'Catatan wajib diisi (maks 1000 huruf)')
  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } })
  const c = await prisma.catatanOrder.create({ data: { orderId: order.id, userId: req.user.id, nama: u?.nama ?? 'Pengguna', isi } })
  return res.status(201).json({ success: true, data: { id: c.id } })
})
export const hapusCatatan = wrap(async (req, res) => {
  const c = await prisma.catatanOrder.findUnique({ where: { id: req.params.catatanId } })
  if (!c || c.orderId !== req.params.id) return gagal(res, 404, 'Catatan tidak ditemukan')
  const order = await muatOrder(req.params.id)
  const hak = await izin(req, order); if (!hak) return gagal(res, 403, 'Tidak punya akses ke order ini')
  if (c.userId !== req.user.id && !hak.manajer) return gagal(res, 403, 'Hanya penulis atau Koordinator yang bisa menghapus')
  await prisma.catatanOrder.delete({ where: { id: c.id } })
  return res.json({ success: true, message: 'Catatan dihapus' })
})

// Tagihan & jatuh tempo per unit (adaptasi OGS aging piutang): termin belum dibayar, dikelompokkan menurut keterlambatan
export const getPiutang = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  const pp = await peranStudio(req, studioId)
  if (!pp.manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  const sekarang = new Date(), hariIni = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), sekarang.getUTCDate()))
  const termin = await prisma.terminBayarOrder.findMany({ where: { dibayarPada: null, order: { studioId, status: { not: 'BATAL' }, ...saringAkun(pp) } }, include: { order: { select: { id: true, judul: true, klien: true } } }, orderBy: [{ jatuhTempo: 'asc' }, { urutan: 'asc' }] })
  const kelompok = [['belumTempo', 'Belum jatuh tempo'], ['telat1_7', 'Telat 1–7 hari'], ['telat8_30', 'Telat 8–30 hari'], ['telat30', 'Telat > 30 hari'], ['tanpaTempo', 'Tanpa jatuh tempo']]
  const kunci = (t) => { if (!t.jatuhTempo) return 'tanpaTempo'; const telat = Math.floor((hariIni - t.jatuhTempo) / HARI); return telat <= 0 ? 'belumTempo' : telat <= 7 ? 'telat1_7' : telat <= 30 ? 'telat8_30' : 'telat30' }
  const baris = termin.map(t => ({ id: t.id, orderId: t.order.id, judul: t.order.judul, klien: t.order.klien, label: t.label, jumlah: t.jumlah, jatuhTempo: ISO(t.jatuhTempo), telatHari: t.jatuhTempo ? Math.max(0, Math.floor((hariIni - t.jatuhTempo) / HARI)) : null, kelompok: kunci(t) }))
  return res.json({ success: true, data: { total: baris.reduce((a, b) => a + b.jumlah, 0), kelompok: kelompok.map(([k, label]) => ({ kunci: k, label, jumlah: baris.filter(b => b.kelompok === k).length, total: baris.filter(b => b.kelompok === k).reduce((a, b) => a + b.jumlah, 0) })), baris } })
})

// Ubah data pokok order (judul, klien, jenis klien, deadline, mata uang/kurs/nilai USD). Nilai Rupiah order TIDAK berubah di sini kecuali order
// belum punya item/termin dan nilai USD/kurs diubah; selain itu ubah lewat item lalu "Samakan nilai". Semua perubahan tercatat di audit.
export const editOrder = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  const b = req.body ?? {}, data = {}
  if (b.judul !== undefined) { const j = String(b.judul ?? '').trim(); if (!j || j.length > 200) return gagal(res, 422, 'Judul wajib diisi (maks 200 huruf)'); data.judul = j }
  if (b.klien !== undefined) { const k = String(b.klien ?? '').trim(); if (!k || k.length > 200) return gagal(res, 422, 'Klien wajib diisi (maks 200 huruf)'); if (klienTampakNominal(k)) return gagal(res, 422, `Nama klien "${k.slice(0, 30)}" tampak seperti nominal uang — isi nama klien yang benar`); const kd = await tautkanKlien(order.studioId, k, order.akun?.platform); data.klien = kd?.nama ?? k; data.klienId = kd?.id ?? null }
  if (b.tipeKlien !== undefined) { if (!['INTERNAL_EKOSISTEM', 'INTERNAL_JRU_LAIN', 'EKSTERNAL'].includes(b.tipeKlien)) return gagal(res, 422, 'tipeKlien tidak dikenal'); data.tipeKlien = b.tipeKlien }
  if (b.deadline !== undefined) { if (b.deadline === null || b.deadline === '') data.deadline = null; else { const t = tgl(b.deadline); if (!t) return gagal(res, 422, 'deadline harus YYYY-MM-DD'); data.deadline = t } }
  let peringatan = null
  if (b.mataUang !== undefined || b.kurs !== undefined || b.nilaiUsd !== undefined) {
    const mu = b.mataUang ?? order.mataUang, kurs = b.kurs ?? order.kurs, nu = b.nilaiUsd ?? order.nilaiUsd
    if (mu === 'IDR') { data.mataUang = 'IDR'; data.kurs = null; data.nilaiUsd = null }
    else {
      const g = validasiUsd({ mataUang: mu, nilaiUsd: nu, kurs }); if (g) return gagal(res, 422, g)
      data.mataUang = 'USD'; data.kurs = Number(kurs); data.nilaiUsd = Number(nu)
      if (b.nilaiUsd !== undefined || b.kurs !== undefined) {
        const [ni, nt] = await Promise.all([prisma.itemOrder.count({ where: { orderId: order.id } }), prisma.terminBayarOrder.count({ where: { orderId: order.id } })])
        if (ni || nt) peringatan = 'Order sudah punya item/termin: nilai Rupiah tidak diubah otomatis. Ubah item/termin lalu "Samakan nilai".'
        else { data.nilaiKotor = rupiahDariUsd(nu, kurs); data.nilaiBersih = hitungNilaiBersih(data.nilaiKotor, order.akun?.feePersen ?? 0); data.nilaiDisepakati = data.nilaiKotor }
      }
    }
  }
  // Ubah NILAI order (Rp) langsung — harga kesepakatan berubah (negosiasi ulang). 10 Nov 2026, pertanyaan tim: dulu hanya lewat item + "Samakan nilai"
  // atau saat Selesai, sehingga mengganti jumlah termin saja membuat status bayar tidak pernah Lunas. Nilai bersih dihitung ulang dari fee akun,
  // status bayar disinkronkan dengan termin. Pada order USD, nilai USD ikut dihitung dari kurs.
  if (b.nilaiKotor !== undefined) {
    if (order.status === 'BATAL') return gagal(res, 422, 'Order yang dihapus tidak bisa diubah nilainya')
    const v = Number(b.nilaiKotor)
    if (b.nilaiKotor === null || b.nilaiKotor === '' || !Number.isFinite(v) || v < 0 || v > 100000000000) return gagal(res, 422, 'Nilai order harus angka ≥ 0 (Rp)')
    const kotor = Math.round(v), feePersen = (data.akunId ? null : order.akun?.feePersen) ?? 0
    if (kotor !== order.nilaiKotor) {
      data.nilaiKotor = kotor; data.nilaiDisepakati = kotor
      data.nilaiBersih = hitungNilaiBersih(kotor, feePersen)
      if ((data.mataUang ?? order.mataUang) === 'USD' && (data.kurs ?? order.kurs) > 0) data.nilaiUsd = Math.round((kotor / (data.kurs ?? order.kurs)) * 100) / 100
    }
  }
  // Uang masuk sebenarnya (setelah potongan platform): koreksi perkiraan nilai bersih bila uang yang cair beda; kosong = kembali ke perkiraan
  if (b.uangMasukRiil !== undefined) {
    if (order.status === 'BATAL') return gagal(res, 422, 'Order yang dihapus tidak bisa diubah')
    if (b.uangMasukRiil === null || b.uangMasukRiil === '') data.uangMasukRiil = null
    else { const v = Number(b.uangMasukRiil); if (!Number.isFinite(v) || v < 0 || v > 100000000000) return gagal(res, 422, 'Uang masuk harus angka ≥ 0 (Rp)'); data.uangMasukRiil = Math.round(v) }
  } else if (data.nilaiBersih != null && order.uangMasukRiil != null) data.uangMasukRiil = null // harga/akun berubah → koreksi lama tak berlaku lagi
  // Ganti akun jualan (mis. order lama yang tercatat "Order Internal"): nilai bersih dihitung ulang dari fee akun baru (sama seperti Ekosistem)
  let akunBaru = null
  if (b.akunId !== undefined) {
    const p = await akunUntukOrder(order.studioId, b.akunId); if (p.galat) return gagal(res, 422, p.galat)
    if (p.akun.id !== order.akunId && !orderDalamAkun(await peranStudio(req, order.studioId), { akunId: p.akun.id }) && order.marketerId !== req.user.id) return gagal(res, 403, 'Akun jualan tujuan bukan tanggung jawabmu')
    if (p.akun.id !== order.akunId) { akunBaru = p.akun; data.akunId = p.akun.id; data.nilaiBersih = hitungNilaiBersih(data.nilaiKotor ?? order.nilaiKotor, p.akun.feePersen) }
  }
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  const beda = bedaField(order, data, ['judul', 'klien', 'tipeKlien', 'deadline', 'mataUang', 'kurs', 'nilaiUsd', 'nilaiKotor', 'nilaiDisepakati', 'nilaiBersih', 'uangMasukRiil'])
  if (akunBaru) beda.push({ field: 'akun', dari: order.akun?.namaAkun ?? null, ke: akunBaru.namaAkun })
  await prisma.orderProduksi.update({ where: { id: order.id }, data })
  await catatAudit(order.id, req.user.id, 'UBAH', beda)
  if (data.nilaiBersih != null || data.uangMasukRiil !== undefined) await sinkronBayar(order.id)
  return res.json({ success: true, message: 'Order diperbarui', data: { peringatan } })
})

// ── Batalkan / pulihkan order (permintaan tim 9 Nov 2026: order salah input atau batal dari klien) ──────────────────────────────
// Batal = status BATAL (bukan hapus): hilang dari papan & hitungan omzet/piutang, riwayat & audit tetap. Pengelola atau marketer
// pemegang order. Ditolak bila sudah ada termin yang dibayar (uang sudah masuk → koreksi termin dulu) atau order sudah Selesai.
export const batalkanOrder = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  if (order.status === 'BATAL') return gagal(res, 409, 'Order ini sudah dibatalkan')
  if (order.status === 'SELESAI') return gagal(res, 409, 'Order yang sudah Selesai tidak bisa dibatalkan')
  if (await prisma.terminBayarOrder.count({ where: { orderId: order.id, dibayarPada: { not: null } } })) return gagal(res, 409, 'Sudah ada termin yang dibayar — koreksi/hapus termin dulu sebelum membatalkan')
  // Alasan OPSIONAL (10 Nov 2026, masukan tim): hapus order cukup konfirmasi — biasanya salah input / uji coba admin
  const alasan = String(req.body?.alasan ?? '').trim()
  if (alasan.length > 300) return gagal(res, 422, 'Alasan maksimal 300 huruf')
  await prisma.orderProduksi.update({ where: { id: order.id }, data: { status: 'BATAL' } })
  await catatAudit(order.id, req.user.id, 'BATAL', [{ field: 'status', dari: order.status, ke: alasan ? `BATAL — ${alasan}` : 'BATAL' }])
  await tutupPenugasanBasi({ orderId: order.id })
  return res.json({ success: true, message: 'Order dibatalkan' })
})
// CANCEL KLIEN (10 Nov 2026, masukan tim): klien batal di tengah jalan padahal pekerjaan sudah dikerjakan → order DITUTUP di tahap Selesai
// (riwayat, penugasan & fee talent tetap tercatat; tetap dihitung di omzet/laporan) dan ditandai Cancel. Beda dengan "Hapus order" (BATAL = tidak dihitung).
// Nilai riil (opsional) menggantikan nilai kotor, sama seperti memindahkan ke Selesai dengan nilai riil. Marketer pemegang & pengelola.
export const cancelKlien = wrap(async (req, res) => {
  const order = await manajerAtasOrder(req, res); if (!order) return
  if (!['MASUK', 'PROSES'].includes(order.status)) return gagal(res, 409, order.status === 'BATAL' ? 'Order ini sudah dihapus' : 'Hanya order yang masih berjalan yang bisa di-Cancel')
  const alasan = String(req.body?.alasan ?? '').trim()
  if (!alasan || alasan.length > 300) return gagal(res, 422, 'Alasan cancel wajib diisi (maks 300 huruf)')
  const extra = { cancelKlien: true, cancelPada: new Date(), alasanCancel: alasan }
  const n = req.body?.nilaiRiil
  if (n != null && n !== '') {
    const v = Number(n); if (!Number.isFinite(v) || v < 0 || v > 100000000000) return gagal(res, 422, 'Nilai riil harus angka ≥ 0 (Rp)')
    extra.nilaiKotor = Math.round(v); extra.nilaiBersih = hitungNilaiBersih(extra.nilaiKotor, order.akun?.feePersen ?? 0)
  }
  const tahap = await pastikanTahap(order.studioId)
  const tujuan = tahap.find(t => jenisNormal(t.jenis) === 'SELESAI')
  if (!tujuan) return gagal(res, 409, 'Unit ini belum punya tahap Selesai')
  const asal = tahap.find(t => t.id === tahapEfektif(order, tahap))
  await terapkanPindah({ order, tahapAsal: asal, tujuan, userId: req.user.id, extra })
  const perubahan = [{ field: 'status', dari: order.status, ke: `CANCEL KLIEN — ${alasan}` }]
  if (extra.nilaiBersih != null) perubahan.push({ field: 'nilaiKotor', dari: String(order.nilaiKotor), ke: String(extra.nilaiKotor) })
  await catatAudit(order.id, req.user.id, 'CANCEL', perubahan)
  return res.json({ success: true, message: 'Order ditutup sebagai Cancel klien' })
})
// Pulihkan: hanya pengelola unit. Status kembali mengikuti tahap order saat ini.
export const pulihkanOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await studioBolehDilihat(req, order.studioId))) return gagal(res, 403, 'Tidak punya akses ke order ini')
  if (!(await peranOrder(req, order)).manajer) return gagal(res, 403, 'Hanya Koordinator ke atas yang bisa memulihkan order')
  if (order.status !== 'BATAL') return gagal(res, 409, 'Order ini tidak dalam status batal')
  const status = order.tahap ? (STATUS_DARI_JENIS[jenisNormal(order.tahap.jenis)] ?? 'MASUK') : 'MASUK'
  await prisma.orderProduksi.update({ where: { id: order.id }, data: { status } })
  await catatAudit(order.id, req.user.id, 'PULIH', [{ field: 'status', dari: 'BATAL', ke: status }])
  return res.json({ success: true, message: 'Order dipulihkan' })
})
// Daftar order batal (90 hari terakhir) untuk unit — pengelola melihat semua, marketer hanya miliknya
// ORDER SELESAI / ARSIP (16 Nov 2026, masukan tim): papan Produksi hanya memuat Done bulan berjalan, jadi order yang selesai bulan-bulan
// sebelumnya dicari di sini (judul/klien, per bulan selesai) → buka detail order (folder proyek, pembayaran, riwayat). Tanpa angka uang;
// wewenang sama dengan papan: pengelola (admin per akun hanya akunnya) & marketer (hanya order miliknya).
export const getOrderSelesai = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const p = await peranStudio(req, studioId)
  if (!p.manajer && !p.marketer) return gagal(res, 403, 'Hanya Koordinator ke atas atau marketer')
  const bulan = /^\d{4}-\d{2}$/.test(req.query.bulan ?? '') ? req.query.bulan : null
  const kata = String(req.query.cari ?? '').trim().slice(0, 80)
  const rentang = bulan ? { gte: new Date(`${bulan}-01T00:00:00.000Z`), lt: new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 1)) } : null
  const o = await prisma.orderProduksi.findMany({
    where: {
      studioId, status: 'SELESAI', ...(p.manajer ? saringAkun(p) : { marketerId: req.user.id }),
      ...(rentang ? { OR: [{ tanggalSelesai: rentang }, { tanggalSelesai: null, updatedAt: rentang }] } : {}),
      ...(kata ? { AND: [{ OR: [{ judul: { contains: kata, mode: 'insensitive' } }, { klien: { contains: kata, mode: 'insensitive' } }] }] } : {}),
    },
    orderBy: [{ tanggalSelesai: 'desc' }, { updatedAt: 'desc' }], take: 200,
    select: { id: true, judul: true, klien: true, tanggalMasuk: true, tanggalSelesai: true, updatedAt: true, statusBayar: true, tautan: true, akun: { select: { platform: true, namaAkun: true } }, klienRef: { select: { panggilan: true } }, assignments: { select: { namaEksternal: true, user: { select: { nama: true } } } } },
  })
  return res.json({ success: true, data: { bulan, order: o.map(x => ({ id: x.id, judul: x.judul, klien: x.klien, panggilan: x.klienRef?.panggilan ?? null, akun: x.akun ? `${x.akun.platform} · ${x.akun.namaAkun}` : null, masuk: x.tanggalMasuk, selesai: x.tanggalSelesai ?? x.updatedAt, statusBayar: x.statusBayar, folder: x.tautan?.[0] ?? null, talent: x.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean) })) } })
})

export const getOrderBatal = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const p = await peranStudio(req, studioId)
  if (!p.manajer && !p.marketer) return gagal(res, 403, 'Hanya Koordinator ke atas atau marketer')
  const o = await prisma.orderProduksi.findMany({ where: { studioId, status: 'BATAL', updatedAt: { gte: new Date(Date.now() - 90 * HARI) }, ...(p.manajer ? saringAkun(p) : { marketerId: req.user.id }) }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, judul: true, klien: true, updatedAt: true } })
  const alasan = new Map((await prisma.auditOrder.findMany({ where: { orderId: { in: o.map(x => x.id) }, aksi: 'BATAL' }, orderBy: { waktu: 'desc' }, select: { orderId: true, ke: true, nama: true } })).map(a => [a.orderId, a]))
  return res.json({ success: true, data: { bisaPulihkan: p.manajer && !p.lihatSaja, order: o.map(x => ({ id: x.id, judul: x.judul, klien: x.klien, dibatalkanPada: x.updatedAt, oleh: alasan.get(x.id)?.nama ?? null, alasan: (alasan.get(x.id)?.ke ?? '').replace(/^BATAL — /, '') || null })) } })
})
