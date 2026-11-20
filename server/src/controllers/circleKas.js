import crypto from 'crypto'
import prisma from '../prisma.js'
import { SUPER_ADMIN, STAFF_PLUS, hasAnyRole, kelolaStudio } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat, pengelolaAtauPemilikBaca } from './circle.js'
import { daftarRekening, rekeningSah, bacaRekeningId } from '../utils/rekeningKas.js'

// BIAYA, PENDAPATAN & KAS web circle (20 Okt 2026) — adaptasi OGS (ExpenseController, IncomeController, CashWallet,
// CashReconciliationService). MODE BAYANGAN: tidak menulis ke WeeklyReport / tabel Pengeluaran Ekosistem.
// Akses: biaya & pendapatan per unit = pelapor (Koordinator/Pendamping ke atas) pada unit dalam wewenangnya; persetujuan/kunci biaya =
// Koordinator unit ke atas (CEO unit, 21 Okt 2026); konfirmasi transfer + dompet/mutasi/rekonsiliasi (kas pusat) = Super Admin / Kepala Ekosistem.
// Nomor rekening lengkap tidak disimpan; tanpa unggahan berkas (hanya tautan http/https).
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch (e) { if (e?.code === 'P2002') return gagal(res, 409, 'Data duplikat'); return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
// Wewenang PER UNIT (21 Okt 2026): pelapor & penyetuju = Koordinator/Pendamping unit ini ke atas (Kepala Circle/Rumah Usaha pemiliknya,
// Super Admin). Keputusan user: Koordinator adalah CEO unitnya — menyetujui, mengunci & menghapus biaya serta memakai kategori khusus manajemen.
const pelaporUnit = (req, studioId) => kelolaStudio(peranKerja(req), studioId)
const atasan = pelaporUnit
const atasanMana = (req) => hasAnyRole(peranKerja(req), STAFF_PLUS) // kategori khusus manajemen: Koordinator ke atas (CEO unit)
const superAdmin = (req) => hasAnyRole(peranKerja(req), SUPER_ADMIN)
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(new Date(s)) ? new Date(s + 'T00:00:00.000Z') : null)
const bulanOk = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(b ?? '')
const bulanDari = (d) => d.toISOString().slice(0, 7)
const url = (v) => { if (v == null || v === '') return null; const s = String(v).trim(); return /^https?:\/\/\S{3,480}$/.test(s) ? s : undefined } // undefined = tidak sah
const angka = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN }
const PLATFORM_WD = ['paypal', 'vgen', 'fiverr', 'etsy', 'upwork', 'komunitas', 'lainnya'] // komunitas = order lewat komunitas/WhatsApp (12 Nov 2026, masukan tim) — sama dengan kolom Komunitas Laporan Omset
const HARI = 86400000
const TOLERANSI_HARI = 3 // OGS DATE_TOLERANCE_DAYS

async function bolehUnit(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  if (!(await pengelolaAtauPemilikBaca(req, studioId))) { gagal(res, 403, 'Hanya Koordinator/Pendamping unit ini ke atas'); return false } // pemilik: lihat saja
  return true
}
// Bulan yang sudah DITUTUP di buku besar: sumbernya (biaya/transfer) dikunci supaya buku tertutup tetap cocok dengan datanya.
async function bulanTertutup(studioId, bulan) { return (await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan } } }))?.status === 'DITUTUP' }
async function tolakBulanTertutup(res, studioId, ...tanggal) {
  for (const t of tanggal) {
    if (!t) continue
    const bulan = bulanDari(new Date(t))
    if (await bulanTertutup(studioId, bulan)) { gagal(res, 409, `Bulan ${bulan} sudah ditutup di Tutup bulan — minta Super Admin membukanya dulu`); return true }
  }
  return false
}
const hanyaSuper = (req, res) => { if (!superAdmin(req)) { gagal(res, 403, 'Hanya Super Admin / Kepala Ekosistem'); return false } return true }
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'

// ══ BIAYA (OGS Expense) ══════════════════════════════════════════════════════════════════════════════════════════════
const BIAYA_PILIH = { id: true, studioId: true, kategori: true, tanggal: true, jatuhTempo: true, jumlah: true, jumlahDibayar: true, deskripsi: true, freelancer: true, tipe: true, statusBayar: true, persetujuan: true, dibayarPada: true, dibayarOleh: true, dibuatOleh: true, linkInvoice: true, linkDrive: true, terkunci: true, rekeningId: true, assignmentId: true }
const rapiBiaya = (b) => ({ ...b, tanggal: ISO(b.tanggal), jatuhTempo: ISO(b.jatuhTempo), dibayarPada: ISO(b.dibayarPada) })

export const getBiaya = wrap(async (req, res) => {
  const { studioId, bulan, status } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  const where = { studioId }
  if (bulan) { if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM'); where.tanggal = { gte: new Date(bulan + '-01T00:00:00Z'), lt: new Date(new Date(bulan + '-01T00:00:00Z').setUTCMonth(new Date(bulan + '-01T00:00:00Z').getUTCMonth() + 1)) } }
  if (['BELUM', 'SEBAGIAN', 'LUNAS'].includes(status)) where.statusBayar = status
  const bisaSetuju = await atasan(req, studioId)
  const [baris, kategori] = await Promise.all([prisma.biayaStudio.findMany({ where, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 300, select: BIAYA_PILIH }), prisma.kategoriBiaya.findMany({ where: { aktif: true }, orderBy: { nama: 'asc' } })])
  const dibayar = (b) => (b.statusBayar === 'LUNAS' ? (b.jumlahDibayar ?? b.jumlah) : b.statusBayar === 'SEBAGIAN' ? (b.jumlahDibayar ?? 0) : 0)
  return res.json({ success: true, data: {
    biaya: baris.map(rapiBiaya), kategori: kategori.map(k => ({ id: k.id, nama: k.nama, khususManajemen: k.khususManajemen })).filter(k => !k.khususManajemen || bisaSetuju),
    ringkasan: { total: baris.reduce((a, b) => a + b.jumlah, 0), dibayar: baris.reduce((a, b) => a + dibayar(b), 0), belumDibayar: baris.reduce((a, b) => a + (b.jumlah - dibayar(b)), 0), disetujui: baris.filter(b => b.persetujuan === 'DISETUJUI').length, menunggu: baris.filter(b => b.persetujuan === 'MENUNGGU').length },
    bisaSetuju, rekening: (await daftarRekening(studioId)).map(r => ({ id: r.id, nama: r.nama })),
  } })
})

async function bersihBiaya(req, b, { baru, studioId }) {
  const out = {}
  if (baru || b.kategori !== undefined) { const k = String(b.kategori ?? '').trim(); if (!k || k.length > 60) return { galat: 'Kategori wajib diisi (maks 60 huruf)' }; const master = await prisma.kategoriBiaya.findUnique({ where: { nama: k } }); if (master?.khususManajemen && !(await atasan(req, studioId))) return { galat: 'Kategori ini khusus manajemen', kode: 403 }; out.kategori = k }
  if (baru || b.tanggal !== undefined) { const t = tgl(b.tanggal); if (!t) return { galat: 'Tanggal harus YYYY-MM-DD' }; out.tanggal = t }
  if (b.jatuhTempo !== undefined) { if (b.jatuhTempo === null || b.jatuhTempo === '') out.jatuhTempo = null; else { const t = tgl(b.jatuhTempo); if (!t) return { galat: 'Jatuh tempo harus YYYY-MM-DD' }; out.jatuhTempo = t } }
  if (baru || b.jumlah !== undefined) { const j = angka(b.jumlah); if (!(j > 0)) return { galat: 'Jumlah harus lebih dari 0' }; out.jumlah = j }
  for (const f of ['deskripsi', 'freelancer', 'tipe']) if (b[f] !== undefined) out[f] = b[f] ? String(b[f]).slice(0, f === 'deskripsi' ? 500 : 80) : null
  for (const f of ['linkInvoice', 'linkDrive']) if (b[f] !== undefined) { const u = url(b[f]); if (u === undefined) return { galat: `${f} harus tautan http(s) — tanpa unggahan berkas` }; out[f] = u }
  const rk = bacaRekeningId(b.rekeningId) // dibayar dari rekening mana (Bio Ekosistem, 12 Nov 2026)
  if (rk !== undefined) { if (!(await rekeningSah(studioId, rk))) return { galat: 'Rekening bukan milik unit ini' }; out.rekeningId = rk }
  return { data: out }
}
export const buatBiaya = wrap(async (req, res) => {
  if (!(await bolehUnit(req, res, req.body?.studioId))) return
  const { galat, data, kode } = await bersihBiaya(req, req.body ?? {}, { baru: true, studioId: req.body.studioId }); if (galat) return gagal(res, kode ?? 422, galat)
  if (await tolakBulanTertutup(res, req.body.studioId, data.tanggal)) return
  const b = await prisma.biayaStudio.create({ data: { studioId: req.body.studioId, ...data, dibuatOlehId: req.user.id, dibuatOleh: await namaPengguna(req) }, select: BIAYA_PILIH })
  return res.status(201).json({ success: true, data: rapiBiaya(b) })
})
const lewatBiaya = (isi) => wrap(async (req, res) => {
  const b = await prisma.biayaStudio.findUnique({ where: { id: req.params.id } })
  if (!b || !(await bolehUnit(req, res, b.studioId))) { if (!b) gagal(res, 404, 'Biaya tidak ditemukan'); return }
  // Biaya otomatis dari Bayar freelance (12 Nov 2026): tidak diubah/dihapus/disetujui ulang di sini — atur lewat menu Bayar freelance
  if (b.assignmentId) return gagal(res, 409, 'Biaya ini dari Bayar freelance — ubah/batalkan lewat menu Bayar freelance')
  return isi(req, res, b)
})
export const ubahBiaya = lewatBiaya(async (req, res, b) => {
  if (b.terkunci) return gagal(res, 409, 'Biaya terkunci, tidak bisa diubah')
  const { galat, data, kode } = await bersihBiaya(req, req.body ?? {}, { baru: false, studioId: b.studioId }); if (galat) return gagal(res, kode ?? 422, galat)
  if (await tolakBulanTertutup(res, b.studioId, b.tanggal, data.tanggal)) return
  // (Yang bisa mengubah biaya = pengelola unit = penyetuju, Koordinator adalah CEO unit — tak perlu persetujuan ulang.)
  return res.json({ success: true, data: rapiBiaya(await prisma.biayaStudio.update({ where: { id: b.id }, data, select: BIAYA_PILIH })) })
})
export const setujuiBiaya = lewatBiaya(async (req, res, b) => {
  if (!(await atasan(req, b.studioId))) return gagal(res, 403, 'Persetujuan hanya untuk Koordinator unit ini ke atas')
  if (!['MENUNGGU', 'DISETUJUI', 'DITOLAK'].includes(req.body?.status)) return gagal(res, 422, 'status harus MENUNGGU, DISETUJUI, atau DITOLAK')
  if (b.terkunci) return gagal(res, 409, 'Biaya terkunci')
  if (await tolakBulanTertutup(res, b.studioId, b.tanggal)) return
  return res.json({ success: true, data: rapiBiaya(await prisma.biayaStudio.update({ where: { id: b.id }, data: { persetujuan: req.body.status }, select: BIAYA_PILIH })) })
})
export const bayarBiaya = lewatBiaya(async (req, res, b) => {
  if (b.terkunci) return gagal(res, 409, 'Biaya terkunci')
  const st = req.body?.status
  if (!['BELUM', 'SEBAGIAN', 'LUNAS'].includes(st)) return gagal(res, 422, 'status harus BELUM, SEBAGIAN, atau LUNAS')
  if (st !== 'BELUM' && b.persetujuan !== 'DISETUJUI') return gagal(res, 409, 'Biaya harus disetujui Kepala Circle dulu sebelum dibayar')
  const data = { statusBayar: st }
  if (st === 'BELUM') Object.assign(data, { jumlahDibayar: null, dibayarPada: null, dibayarOleh: null })
  else {
    const dibayar = req.body.jumlahDibayar != null && req.body.jumlahDibayar !== '' ? angka(req.body.jumlahDibayar) : (st === 'LUNAS' ? b.jumlah : NaN)
    if (!(dibayar > 0)) return gagal(res, 422, 'jumlahDibayar harus lebih dari 0')
    if (st === 'SEBAGIAN' && dibayar >= b.jumlah) return gagal(res, 422, 'Pembayaran sebagian harus kurang dari jumlah biaya')
    const t = req.body.dibayarPada ? tgl(req.body.dibayarPada) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
    if (!t) return gagal(res, 422, 'dibayarPada harus YYYY-MM-DD')
    Object.assign(data, { jumlahDibayar: dibayar, dibayarPada: t, dibayarOleh: await namaPengguna(req) })
  }
  return res.json({ success: true, data: rapiBiaya(await prisma.biayaStudio.update({ where: { id: b.id }, data, select: BIAYA_PILIH })) })
})
export const kunciBiaya = lewatBiaya(async (req, res, b) => {
  if (!(await atasan(req, b.studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas')
  return res.json({ success: true, data: rapiBiaya(await prisma.biayaStudio.update({ where: { id: b.id }, data: { terkunci: !!req.body?.terkunci }, select: BIAYA_PILIH })) })
})
export const hapusBiaya = lewatBiaya(async (req, res, b) => {
  if (!(await atasan(req, b.studioId))) return gagal(res, 403, 'Hanya Koordinator unit ini ke atas yang menghapus biaya')
  if (b.terkunci) return gagal(res, 409, 'Biaya terkunci')
  if (await tolakBulanTertutup(res, b.studioId, b.tanggal)) return
  if (await prisma.mutasiKas.count({ where: { cocokTipe: 'BIAYA', cocokId: b.id, rekonStatus: 'COCOK' } })) return gagal(res, 409, 'Biaya sudah direkonsiliasi dengan mutasi bank')
  await prisma.biayaStudio.delete({ where: { id: b.id } })
  return res.json({ success: true, message: 'Biaya dihapus' })
})
export const getKategoriBiaya = wrap(async (req, res) => {
  if (!hasAnyRole(peranKerja(req), STAFF_PLUS)) return gagal(res, 403, 'Hanya Koordinator/Pendamping ke atas')
  const k = await prisma.kategoriBiaya.findMany({ orderBy: { nama: 'asc' } })
  return res.json({ success: true, data: { kategori: k.filter(x => !x.khususManajemen || atasanMana(req)).map(x => ({ id: x.id, nama: x.nama, khususManajemen: x.khususManajemen, aktif: x.aktif, kategoriLedgerId: x.kategoriLedgerId })), bisaUbah: superAdmin(req) } })
})
export const simpanKategoriBiaya = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const nama = String(req.body?.nama ?? '').trim()
  if (!nama || nama.length > 60) return gagal(res, 422, 'Nama kategori wajib diisi (maks 60 huruf)')
  let kategoriLedgerId
  if (req.body.kategoriLedgerId !== undefined) { if (req.body.kategoriLedgerId && !(await prisma.kategoriLedger.findUnique({ where: { id: String(req.body.kategoriLedgerId) } }))) return gagal(res, 422, 'Kategori buku besar tidak ditemukan'); kategoriLedgerId = req.body.kategoriLedgerId || null }
  const k = await prisma.kategoriBiaya.upsert({ where: { nama }, update: { aktif: req.body.aktif ?? true, khususManajemen: !!req.body.khususManajemen, ...(kategoriLedgerId !== undefined ? { kategoriLedgerId } : {}) }, create: { nama, khususManajemen: !!req.body.khususManajemen, kategoriLedgerId: kategoriLedgerId ?? null } })
  return res.status(201).json({ success: true, data: { id: k.id } })
})

// ══ PENDAPATAN: penarikan → transfer → konfirmasi; dana tertahan (OGS IncomeController) ════════════════════════════════
async function nomorBaru(model, awalan, bulan) {
  const kunci = `${awalan}-${bulan.replace('-', '')}-`
  const n = await prisma[model].count({ where: { nomor: { startsWith: kunci } } })
  return `${kunci}${String(n + 1).padStart(4, '0')}`
}
const buatBernomor = async (model, awalan, bulan, data) => { for (let i = 0; i < 5; i++) { try { return await prisma[model].create({ data: { ...data, nomor: await nomorBaru(model, awalan, bulan) } }) } catch (e) { if (e?.code !== 'P2002') throw e } } throw new Error('nomor') }
const rapiWd = (w) => ({ id: w.id, nomor: w.nomor, studioId: w.studioId, akunId: w.akunId, rekeningId: w.rekeningId, tanggal: ISO(w.tanggal), jumlah: w.jumlah, dariPlatform: w.dariPlatform, bankTujuan: w.bankTujuan, atasNama: w.atasNama, catatan: w.catatan, bulan: w.bulan, status: w.status })
const rapiTf = (t) => ({ id: t.id, penarikanId: t.penarikanId, studioId: t.studioId, tanggal: ISO(t.tanggal), jumlah: t.jumlah, dariBank: t.dariBank, dariAtasNama: t.dariAtasNama, keRekening: t.keRekening, catatan: t.catatan, bulan: t.bulan, status: t.status, ditransferOleh: t.ditransferOleh, dikonfirmasiOleh: t.dikonfirmasiOleh, dikonfirmasiPada: t.dikonfirmasiPada })
const rapiHd = (h) => ({ id: h.id, nomor: h.nomor, studioId: h.studioId, akunId: h.akunId, tanggal: ISO(h.tanggal), jumlah: h.jumlah, bank: h.bank, atasNama: h.atasNama, dariPlatform: h.dariPlatform, catatan: h.catatan, linkDrive: h.linkDrive, bulan: h.bulan, status: h.status, transferId: h.transferId })
async function akunSah(studioId, akunId) { if (!akunId) return true; return !!(await prisma.akunProduksi.findFirst({ where: { id: akunId, studioId }, select: { id: true } })) }

export const getPendapatan = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  if (bulan && !bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const where = { studioId, ...(bulan ? { bulan } : {}) }
  const [wd, tf, hd] = await Promise.all([prisma.penarikanPendapatan.findMany({ where, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 200 }), prisma.transferPendapatan.findMany({ where, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 200 }), prisma.pendapatanTertahan.findMany({ where, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 200 })])
  const jml = (a, f = (x) => x.jumlah) => a.reduce((s, x) => s + f(x), 0)
  // Pembanding (10 Nov 2026, masukan tim): omzet bersih PERKIRAAN dari order bulan itu vs uang yang benar-benar ditarik + masih tertahan.
  // Selisih kecil wajar (kurs, potongan tambahan, waktu cair); selisih besar = periksa. Order yang masuk bulan ini bisa cair bulan depan.
  const orderBulan = bulan ? await prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: new Date(bulan + '-01T00:00:00Z'), lt: new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5)), 1)) } }, select: { nilaiBersih: true, uangMasukRiil: true } }) : []
  const omzetBersihOrder = orderBulan.reduce((s, o) => s + (o.uangMasukRiil ?? o.nilaiBersih), 0)
  // Pemasukan yang dicatat MANUAL di Rincian Tutup bulan (12 Nov 2026, masukan tim) ikut tampil di sini; "Pendapatan Usaha" ikut dibandingkan
  // dengan omset order (uang klien yang masuk langsung). Saran nama klien untuk isian "Dari klien / keterangan" penarikan.
  const manual = bulan ? await prisma.entriLedger.findMany({ where: { studioId, bulan, sumberTipe: 'MANUAL', kategori: { arus: 'INCOME' } }, include: { kategori: { select: { nama: true } } }, orderBy: { tanggal: 'desc' } }) : []
  const manualUsaha = manual.filter(m => m.kategori.nama === 'Pendapatan Usaha').reduce((a, m) => a + m.jumlah, 0)
  const klien = (await prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' } }, select: { klien: true }, orderBy: { tanggalMasuk: 'desc' }, take: 300 })).map(o => o.klien)
  return res.json({ success: true, data: {
    penarikan: wd.map(rapiWd), transfer: tf.map(rapiTf), tertahan: hd.map(rapiHd), bisaKonfirmasi: superAdmin(req), platform: PLATFORM_WD, rekening: (await daftarRekening(studioId)).map(r => ({ id: r.id, nama: r.nama })),
    ringkasan: { ditarik: jml(wd), transferMenunggu: jml(tf.filter(t => t.status === 'MENUNGGU')), transferTerkirim: jml(tf.filter(t => t.status === 'DITRANSFER')), transferDikonfirmasi: jml(tf.filter(t => t.status === 'DIKONFIRMASI')), tertahan: jml(hd.filter(h => h.status === 'TERTAHAN')), omzetBersihOrder: bulan ? omzetBersihOrder : null, selisih: bulan ? Math.round(omzetBersihOrder - jml(wd) - jml(hd.filter(h => h.status === 'TERTAHAN')) - manualUsaha) : null, manual: jml(manual), manualUsaha },
    manual: manual.map(m => ({ id: m.id, tanggal: ISO(m.tanggal), kategori: m.kategori.nama, deskripsi: m.deskripsi, jumlah: m.jumlah })), klien: [...new Set(klien)].slice(0, 150),
  } })
})

// Penarikan "masuk ke" rekening Bio (12 Nov 2026): bila rekening dipilih, bank tujuan & atas nama diisi otomatis dari Bio (tidak dikirim balik ke klien).
async function isiDariRekening(studioId, b) {
  const rk = bacaRekeningId(b.rekeningId)
  if (rk === undefined) return { data: {} }
  if (!rk) return { data: { rekeningId: null } }
  const r = await prisma.studioRekening.findFirst({ where: { id: rk, studioId }, select: { namaBank: true, atasNama: true } })
  if (!r) return { galat: 'Rekening bukan milik unit ini' }
  return { data: { rekeningId: rk }, isi: { bankTujuan: b.bankTujuan || r.namaBank, atasNama: b.atasNama || r.atasNama } }
}
function bersihWd(b, { baru }) {
  const out = {}
  if (baru || b.tanggal !== undefined) { const t = tgl(b.tanggal); if (!t) return { galat: 'Tanggal harus YYYY-MM-DD' }; out.tanggal = t; out.bulan = bulanDari(t) }
  if (baru || b.jumlah !== undefined) { const j = angka(b.jumlah); if (!(j > 0)) return { galat: 'Jumlah harus lebih dari 0' }; out.jumlah = j }
  if (baru || b.dariPlatform !== undefined) { if (!PLATFORM_WD.includes(b.dariPlatform)) return { galat: `Platform harus salah satu: ${PLATFORM_WD.join(', ')}` }; out.dariPlatform = b.dariPlatform }
  for (const f of ['bankTujuan', 'atasNama']) if (baru || b[f] !== undefined) { const v = String(b[f] ?? '').trim(); if (!v || v.length > 80) return { galat: `${f} wajib diisi (maks 80 huruf)` }; out[f] = v }
  if (b.catatan !== undefined) out.catatan = b.catatan ? String(b.catatan).slice(0, 500) : null
  if (b.akunId !== undefined) out.akunId = b.akunId || null
  return { data: out }
}
export const buatPenarikan = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  const rk = await isiDariRekening(studioId, req.body); if (rk.galat) return gagal(res, 422, rk.galat)
  const { galat, data } = bersihWd({ ...req.body, ...rk.isi }, { baru: true }); if (galat) return gagal(res, 422, galat)
  if (!(await akunSah(studioId, data.akunId))) return gagal(res, 422, 'Akun bukan milik unit ini')
  const w = await buatBernomor('penarikanPendapatan', 'WD', data.bulan, { studioId, ...data, ...rk.data, dibuatOleh: await namaPengguna(req) })
  return res.status(201).json({ success: true, data: rapiWd(w) })
})
const lewatWd = (isi) => wrap(async (req, res) => { const w = await prisma.penarikanPendapatan.findUnique({ where: { id: req.params.id } }); if (!w) return gagal(res, 404, 'Penarikan tidak ditemukan'); if (!(await bolehUnit(req, res, w.studioId))) return; return isi(req, res, w) })
export const ubahPenarikan = lewatWd(async (req, res, w) => {
  if (w.status === 'SELESAI') return gagal(res, 409, 'Penarikan yang sudah selesai tidak bisa diubah')
  const rk = await isiDariRekening(w.studioId, req.body ?? {}); if (rk.galat) return gagal(res, 422, rk.galat)
  const { galat, data } = bersihWd({ ...(req.body ?? {}), ...(rk.isi ?? {}) }, { baru: false }); if (galat) return gagal(res, 422, galat)
  if (data.akunId && !(await akunSah(w.studioId, data.akunId))) return gagal(res, 422, 'Akun bukan milik unit ini')
  if (await tolakBulanTertutup(res, w.studioId, w.tanggal, data.tanggal)) return
  return res.json({ success: true, data: rapiWd(await prisma.penarikanPendapatan.update({ where: { id: w.id }, data: { ...data, ...rk.data } })) })
})
export const hapusPenarikan = lewatWd(async (req, res, w) => {
  if (w.status === 'SELESAI') return gagal(res, 409, 'Penarikan yang sudah selesai tidak bisa dihapus')
  if (await prisma.transferPendapatan.count({ where: { penarikanId: w.id, status: { not: 'MENUNGGU' } } })) return gagal(res, 409, 'Sudah ada transfer yang berjalan untuk penarikan ini')
  if (await tolakBulanTertutup(res, w.studioId, w.tanggal)) return
  await prisma.penarikanPendapatan.delete({ where: { id: w.id } })
  return res.json({ success: true, message: 'Penarikan dihapus' })
})

export const buatTransfer = wrap(async (req, res) => {
  const w = await prisma.penarikanPendapatan.findUnique({ where: { id: req.body?.penarikanId ?? '' } })
  if (!w) return gagal(res, 404, 'Penarikan tidak ditemukan')
  if (!(await bolehUnit(req, res, w.studioId))) return
  const t = tgl(req.body.tanggal), j = angka(req.body.jumlah)
  if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (!(j > 0)) return gagal(res, 422, 'Jumlah harus lebih dari 0')
  if (await tolakBulanTertutup(res, w.studioId, t)) return
  const row = await prisma.transferPendapatan.create({ data: { penarikanId: w.id, studioId: w.studioId, tanggal: t, jumlah: j, dariBank: String(req.body.dariBank || w.bankTujuan).slice(0, 80), dariAtasNama: String(req.body.dariAtasNama || w.atasNama).slice(0, 80), keRekening: String(req.body.keRekening || 'Kas pusat').slice(0, 80), catatan: req.body.catatan ? String(req.body.catatan).slice(0, 500) : null, bulan: bulanDari(t), dibuatOleh: await namaPengguna(req) } })
  return res.status(201).json({ success: true, data: rapiTf(row) })
})
const lewatTf = (isi) => wrap(async (req, res) => { const t = await prisma.transferPendapatan.findUnique({ where: { id: req.params.id } }); if (!t) return gagal(res, 404, 'Transfer tidak ditemukan'); if (!(await bolehUnit(req, res, t.studioId))) return; return isi(req, res, t) })
export const ubahTransfer = lewatTf(async (req, res, t) => {
  if (t.status === 'DIKONFIRMASI') return gagal(res, 409, 'Transfer yang sudah dikonfirmasi tidak bisa diubah')
  if (await tolakBulanTertutup(res, t.studioId, t.tanggal, req.body.tanggal ? tgl(req.body.tanggal) : null)) return
  const data = {}
  if (req.body.tanggal !== undefined) { const d = tgl(req.body.tanggal); if (!d) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD'); data.tanggal = d; data.bulan = bulanDari(d) }
  if (req.body.jumlah !== undefined) { const j = angka(req.body.jumlah); if (!(j > 0)) return gagal(res, 422, 'Jumlah harus lebih dari 0'); data.jumlah = j }
  for (const f of ['dariBank', 'dariAtasNama', 'keRekening']) if (req.body[f]) data[f] = String(req.body[f]).slice(0, 80)
  if (req.body.catatan !== undefined) data.catatan = req.body.catatan ? String(req.body.catatan).slice(0, 500) : null
  return res.json({ success: true, data: rapiTf(await prisma.transferPendapatan.update({ where: { id: t.id }, data })) })
})
export const hapusTransfer = lewatTf(async (req, res, t) => {
  if (t.status === 'DIKONFIRMASI') return gagal(res, 409, 'Transfer yang sudah dikonfirmasi tidak bisa dihapus')
  if (await tolakBulanTertutup(res, t.studioId, t.tanggal)) return
  await prisma.transferPendapatan.delete({ where: { id: t.id } })
  // penarikan kembali MENUNGGU bila tidak ada lagi transfer aktif (OGS destroyTransfer)
  if (!(await prisma.transferPendapatan.count({ where: { penarikanId: t.penarikanId, status: { in: ['DITRANSFER', 'DIKONFIRMASI'] } } }))) await prisma.penarikanPendapatan.update({ where: { id: t.penarikanId }, data: { status: 'MENUNGGU' } })
  return res.json({ success: true, message: 'Transfer dihapus' })
})
export const transferTerkirim = lewatTf(async (req, res, t) => {
  if (t.status !== 'MENUNGGU') return gagal(res, 422, 'Status tidak valid untuk aksi ini')
  if (await tolakBulanTertutup(res, t.studioId, t.tanggal)) return
  await prisma.$transaction([prisma.transferPendapatan.update({ where: { id: t.id }, data: { status: 'DITRANSFER', ditransferOleh: await namaPengguna(req), ditransferPada: new Date() } }), prisma.penarikanPendapatan.update({ where: { id: t.penarikanId }, data: { status: 'SELESAI' } })])
  return res.json({ success: true, message: 'Transfer ditandai terkirim' })
})
export const konfirmasiTransfer = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const t = await prisma.transferPendapatan.findUnique({ where: { id: req.params.id } })
  if (!t) return gagal(res, 404, 'Transfer tidak ditemukan')
  if (t.status !== 'DITRANSFER') return gagal(res, 422, 'Transfer harus berstatus "Terkirim" untuk dikonfirmasi')
  await prisma.transferPendapatan.update({ where: { id: t.id }, data: { status: 'DIKONFIRMASI', dikonfirmasiOleh: await namaPengguna(req), dikonfirmasiPada: new Date() } })
  return res.json({ success: true, message: 'Transfer dikonfirmasi diterima' })
})

export const buatTertahan = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  const t = tgl(req.body.tanggal), j = angka(req.body.jumlah)
  if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (!(j > 0)) return gagal(res, 422, 'Jumlah harus lebih dari 0')
  for (const f of ['bank', 'atasNama']) if (!String(req.body[f] ?? '').trim()) return gagal(res, 422, `${f} wajib diisi`)
  const ld = url(req.body.linkDrive); if (ld === undefined) return gagal(res, 422, 'linkDrive harus tautan http(s) — tanpa unggahan berkas')
  if (!(await akunSah(studioId, req.body.akunId))) return gagal(res, 422, 'Akun bukan milik unit ini')
  const h = await buatBernomor('pendapatanTertahan', 'HD', bulanDari(t), { studioId, akunId: req.body.akunId || null, tanggal: t, jumlah: j, bank: String(req.body.bank).trim().slice(0, 80), atasNama: String(req.body.atasNama).trim().slice(0, 80), dariPlatform: PLATFORM_WD.includes(req.body.dariPlatform) ? req.body.dariPlatform : 'lainnya', catatan: req.body.catatan ? String(req.body.catatan).slice(0, 500) : null, linkDrive: ld, bulan: bulanDari(t), dibuatOleh: await namaPengguna(req) })
  return res.status(201).json({ success: true, data: rapiHd(h) })
})
const lewatHd = (isi) => wrap(async (req, res) => { const h = await prisma.pendapatanTertahan.findUnique({ where: { id: req.params.id } }); if (!h) return gagal(res, 404, 'Data tidak ditemukan'); if (!(await bolehUnit(req, res, h.studioId))) return; return isi(req, res, h) })
export const hapusTertahan = lewatHd(async (req, res, h) => {
  if (h.status !== 'TERTAHAN') return gagal(res, 409, 'Pemasukan ditahan yang sudah dilepas tidak bisa dihapus')
  await prisma.pendapatanTertahan.delete({ where: { id: h.id } })
  return res.json({ success: true, message: 'Dihapus' })
})
// Lepas dana tertahan → tercatat sebagai PENARIKAN (uang kini benar-benar cair ke rekening studio), jumlah = yang benar-benar cair.
// Tanpa langkah "transfer ke kas pusat": Ekosistem tiap studio mandiri, tidak ada kas pusat (10 Nov 2026, keputusan user).
export const lepasTertahan = lewatHd(async (req, res, h) => {
  if (h.status !== 'TERTAHAN') return gagal(res, 422, 'Status tidak valid untuk aksi ini')
  const t = req.body?.tanggal ? tgl(req.body.tanggal) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const j = req.body?.jumlah != null && req.body.jumlah !== '' ? angka(req.body.jumlah) : h.jumlah
  if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (!(j > 0)) return gagal(res, 422, 'Jumlah harus lebih dari 0')
  const bulan = bulanDari(t)
  let wdId = h.penarikanId
  if (!wdId) { const w = await buatBernomor('penarikanPendapatan', 'WD', bulan, { studioId: h.studioId, akunId: h.akunId, tanggal: t, jumlah: j, dariPlatform: h.dariPlatform, bankTujuan: h.bank, atasNama: h.atasNama, catatan: 'Dari pemasukan ditahan ' + h.nomor, bulan, dibuatOleh: await namaPengguna(req) }); wdId = w.id }
  await prisma.pendapatanTertahan.update({ where: { id: h.id }, data: { status: 'DILEPAS', penarikanId: wdId, dilepasOleh: await namaPengguna(req), dilepasPada: new Date() } })
  return res.json({ success: true, data: { penarikanId: wdId }, message: 'Dilepas — tercatat sebagai penarikan.' })
})

// Saldo platform per unit per bulan (OGS PlatformBalance)
export const getSaldoPlatform = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!(await bolehUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const baris = await prisma.saldoPlatformBulanan.findMany({ where: { studioId, bulan } })
  return res.json({ success: true, data: { bulan, platform: PLATFORM_WD, saldo: PLATFORM_WD.map(p => ({ platform: p, jumlah: baris.find(b => b.platform === p)?.jumlah ?? 0 })) } })
})
export const simpanSaldoPlatform = wrap(async (req, res) => {
  const { studioId, bulan, platform } = req.body ?? {}
  if (!(await bolehUnit(req, res, studioId))) return
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (!PLATFORM_WD.includes(platform)) return gagal(res, 422, 'Platform tidak dikenal')
  const j = angka(req.body.jumlah); if (!(j >= 0)) return gagal(res, 422, 'Jumlah tidak boleh negatif')
  await prisma.saldoPlatformBulanan.upsert({ where: { studioId_bulan_platform: { studioId, bulan, platform } }, update: { jumlah: j, dibuatOleh: await namaPengguna(req) }, create: { studioId, bulan, platform, jumlah: j, dibuatOleh: await namaPengguna(req) } })
  return res.json({ success: true, message: 'Saldo platform disimpan' })
})

// ══ KAS PUSAT (Super Admin): dompet, mutasi, rekonsiliasi (OGS CashWallet + CashReconciliationService) ═══════════════════
export const getDompet = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const d = await prisma.dompetKas.findMany({ orderBy: { kode: 'asc' } })
  return res.json({ success: true, data: d.map(x => ({ id: x.id, kode: x.kode, nama: x.nama, tipe: x.tipe, pemegang: x.pemegang, akhiran: x.akhiran, mataUang: x.mataUang, aktif: x.aktif })) })
})
export const simpanDompet = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const b = req.body ?? {}
  const kode = String(b.kode ?? '').trim().toUpperCase(), nama = String(b.nama ?? '').trim()
  if (!/^[A-Z0-9-]{2,20}$/.test(kode)) return gagal(res, 422, 'Kode 2–20 karakter (huruf besar, angka, strip)')
  if (!nama || nama.length > 80) return gagal(res, 422, 'Nama wajib diisi (maks 80 huruf)')
  if (!['BANK', 'EWALLET'].includes(b.tipe)) return gagal(res, 422, 'Tipe harus BANK atau EWALLET')
  if (b.akhiran && !/^\d{1,4}$/.test(String(b.akhiran))) return gagal(res, 422, 'Isi hanya 4 digit terakhir rekening — nomor lengkap tidak disimpan')
  const data = { nama, tipe: b.tipe, pemegang: b.pemegang ? String(b.pemegang).slice(0, 80) : null, akhiran: b.akhiran ? String(b.akhiran) : null, aktif: b.aktif ?? true }
  const d = await prisma.dompetKas.upsert({ where: { kode }, update: data, create: { kode, ...data } })
  return res.status(201).json({ success: true, data: { id: d.id } })
})

const mutasiRapi = (m) => ({ id: m.id, dompetId: m.dompetId, dompet: m.dompet ? { kode: m.dompet.kode, nama: m.dompet.nama } : undefined, tanggal: ISO(m.tanggal), tipe: m.tipe, arah: m.arah, jumlah: m.jumlah, kategori: m.kategori, subkategori: m.subkategori, deskripsi: m.deskripsi, internal: m.internal, rekonStatus: m.rekonStatus, cocokTipe: m.cocokTipe, cocokId: m.cocokId, catatanRekon: m.catatanRekon, direkonOleh: m.direkonOleh })
export const getMutasi = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const { bulan, dompetId, status } = req.query
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const where = { bulan, ...(dompetId ? { dompetId } : {}), ...(['BELUM', 'COCOK', 'ABAIKAN'].includes(status) ? { rekonStatus: status } : {}) }
  const [m, ringkasan] = await Promise.all([prisma.mutasiKas.findMany({ where, include: { dompet: { select: { kode: true, nama: true } } }, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }], take: 200 }), ringkasRekon(bulan, dompetId)])
  return res.json({ success: true, data: { mutasi: m.map(mutasiRapi), ringkasan } })
})
const TIPE_MUTASI = ['OPENING', 'DEPOSIT', 'WITHDRAWAL', 'INTERNAL', 'EXPENSE', 'INCOME', 'ADJUSTMENT', 'OTHER']
// Impor = TEMPEL baris (bukan unggah berkas): idempoten lewat kunciImpor
export const imporMutasi = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const { dompetId, baris } = req.body ?? {}
  const dompet = await prisma.dompetKas.findUnique({ where: { id: dompetId ?? '' } })
  if (!dompet) return gagal(res, 404, 'Dompet tidak ditemukan')
  if (!Array.isArray(baris) || !baris.length || baris.length > 500) return gagal(res, 422, 'baris harus berupa daftar 1–500 baris')
  const dilihat = new Map(), data = []
  for (const [i, b] of baris.entries()) {
    const t = tgl(b?.tanggal), j = angka(b?.jumlah)
    if (!t) return gagal(res, 422, `Baris ${i + 1}: tanggal harus YYYY-MM-DD`)
    if (!(j > 0)) return gagal(res, 422, `Baris ${i + 1}: jumlah harus lebih dari 0`)
    if (!['CR', 'DB'].includes(b?.arah)) return gagal(res, 422, `Baris ${i + 1}: arah harus CR atau DB`)
    const tipe = b.tipe ?? (b.arah === 'CR' ? 'INCOME' : 'EXPENSE'); if (!TIPE_MUTASI.includes(tipe)) return gagal(res, 422, `Baris ${i + 1}: tipe tidak dikenal`)
    const desk = b.deskripsi ? String(b.deskripsi).slice(0, 300) : null
    const dasar = [dompet.id, b.tanggal, b.arah, j, desk ?? ''].join('|'); const urut = (dilihat.get(dasar) ?? 0) + 1; dilihat.set(dasar, urut)
    const internal = !!b.internal || tipe === 'INTERNAL'
    data.push({ dompetId: dompet.id, kunciImpor: crypto.createHash('sha1').update(dasar + '|' + urut).digest('hex'), bulan: bulanDari(t), tanggal: t, tipe, arah: b.arah, jumlah: j, kategori: b.kategori ? String(b.kategori).slice(0, 80) : null, subkategori: b.subkategori ? String(b.subkategori).slice(0, 80) : null, deskripsi: desk, internal, mempengaruhiPl: b.mempengaruhiPl ?? !internal })
  }
  const r = await prisma.mutasiKas.createMany({ data, skipDuplicates: true })
  return res.status(201).json({ success: true, data: { diterima: data.length, baru: r.count, duplikat: data.length - r.count } })
})
export const hapusMutasi = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const m = await prisma.mutasiKas.findUnique({ where: { id: req.params.id } })
  if (!m) return gagal(res, 404, 'Mutasi tidak ditemukan')
  if (m.rekonStatus === 'COCOK') return gagal(res, 409, 'Lepas pasangan dulu sebelum menghapus')
  await prisma.mutasiKas.delete({ where: { id: m.id } })
  return res.json({ success: true, message: 'Mutasi dihapus' })
})

async function ringkasRekon(bulan, dompetId) {
  const dasar = { bulan, ...(dompetId ? { dompetId } : {}) }
  const g = await prisma.mutasiKas.groupBy({ by: ['rekonStatus'], where: dasar, _count: true })
  const n = (s) => g.find(x => x.rekonStatus === s)?._count ?? 0
  const belum = await prisma.mutasiKas.aggregate({ where: { ...dasar, rekonStatus: 'BELUM' }, _sum: { jumlah: true } })
  return { belum: n('BELUM'), cocok: n('COCOK'), diabaikan: n('ABAIKAN'), jumlahBelum: Math.round((belum._sum.jumlah ?? 0) * 100) / 100 }
}
async function terpakai(tipe) { return new Set((await prisma.mutasiKas.findMany({ where: { rekonStatus: 'COCOK', cocokTipe: tipe, cocokId: { not: null } }, select: { cocokId: true } })).map(x => x.cocokId)) }
async function kandidat(m) {
  if (m.internal || !m.tanggal) return []
  const dari = new Date(m.tanggal.getTime() - TOLERANSI_HARI * HARI), sampai = new Date(m.tanggal.getTime() + TOLERANSI_HARI * HARI)
  if (m.arah === 'CR') {
    const ambil = await terpakai('TRANSFER')
    const tf = await prisma.transferPendapatan.findMany({ where: { status: 'DIKONFIRMASI', bulan: m.bulan, jumlah: m.jumlah, tanggal: { gte: dari, lte: sampai }, id: { notIn: [...ambil] } }, orderBy: { tanggal: 'asc' }, take: 10, include: { penarikan: { select: { nomor: true } } } })
    const studio = await prisma.studio.findMany({ where: { id: { in: tf.map(t => t.studioId) } }, select: { id: true, nama: true } })
    return tf.map(t => ({ tipe: 'TRANSFER', id: t.id, label: `${t.penarikan?.nomor ?? 'Transfer'} · ${studio.find(s => s.id === t.studioId)?.nama ?? ''}`, jumlah: t.jumlah, tanggal: ISO(t.tanggal), meta: `${t.dariBank} → ${t.keRekening}` }))
  }
  const ambil = await terpakai('BIAYA')
  const bi = await prisma.biayaStudio.findMany({ where: { OR: [{ statusBayar: 'LUNAS' }, { dibayarPada: { not: null } }], tanggal: { gte: dari, lte: sampai }, AND: [{ OR: [{ jumlah: m.jumlah }, { jumlahDibayar: m.jumlah }] }], id: { notIn: [...ambil] } }, orderBy: { tanggal: 'asc' }, take: 10, include: { studio: { select: { nama: true } } } })
  return bi.map(b => ({ tipe: 'BIAYA', id: b.id, label: `${b.kategori} · ${b.studio?.nama ?? 'Pusat'}`, jumlah: b.jumlahDibayar ?? b.jumlah, tanggal: ISO(b.tanggal), meta: (b.deskripsi ?? '').slice(0, 80) }))
}
export const getKandidat = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const m = await prisma.mutasiKas.findUnique({ where: { id: req.params.id } })
  if (!m) return gagal(res, 404, 'Mutasi tidak ditemukan')
  return res.json({ success: true, data: await kandidat(m) })
})
export const cocokkanMutasi = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const m = await prisma.mutasiKas.findUnique({ where: { id: req.params.id } })
  if (!m) return gagal(res, 404, 'Mutasi tidak ditemukan')
  if (m.rekonStatus !== 'BELUM') return gagal(res, 409, 'Mutasi ini sudah direkonsiliasi. Lepas dulu sebelum mencocokkan ulang.')
  const { tipe, id } = req.body ?? {}
  if (!['TRANSFER', 'BIAYA'].includes(tipe)) return gagal(res, 422, 'Tipe pasangan tidak valid')
  if (await prisma.mutasiKas.count({ where: { rekonStatus: 'COCOK', cocokTipe: tipe, cocokId: id, id: { not: m.id } } })) return gagal(res, 409, 'Baris buku ini sudah dipasangkan ke mutasi lain')
  const ada = tipe === 'TRANSFER' ? await prisma.transferPendapatan.count({ where: { id, status: 'DIKONFIRMASI' } }) : await prisma.biayaStudio.count({ where: { id, OR: [{ statusBayar: 'LUNAS' }, { dibayarPada: { not: null } }] } })
  if (!ada) return gagal(res, 404, tipe === 'TRANSFER' ? 'Transfer tidak ditemukan atau belum dikonfirmasi' : 'Biaya tidak ditemukan atau belum dibayar')
  await prisma.mutasiKas.update({ where: { id: m.id }, data: { rekonStatus: 'COCOK', cocokTipe: tipe, cocokId: id, catatanRekon: null, direkonPada: new Date(), direkonOleh: await namaPengguna(req) } })
  return res.json({ success: true, message: 'Dicocokkan' })
})
export const abaikanMutasi = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const m = await prisma.mutasiKas.findUnique({ where: { id: req.params.id } })
  if (!m) return gagal(res, 404, 'Mutasi tidak ditemukan')
  const catatan = String(req.body?.catatan ?? '').trim()
  if (!catatan) return gagal(res, 422, 'Alasan abaikan wajib diisi')
  if (m.rekonStatus === 'COCOK') return gagal(res, 409, 'Lepas pasangan dulu sebelum mengabaikan')
  await prisma.mutasiKas.update({ where: { id: m.id }, data: { rekonStatus: 'ABAIKAN', cocokTipe: null, cocokId: null, catatanRekon: catatan.slice(0, 255), direkonPada: new Date(), direkonOleh: await namaPengguna(req) } })
  return res.json({ success: true, message: 'Diabaikan' })
})
export const lepasMutasi = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const m = await prisma.mutasiKas.findUnique({ where: { id: req.params.id } })
  if (!m) return gagal(res, 404, 'Mutasi tidak ditemukan')
  await prisma.mutasiKas.update({ where: { id: m.id }, data: { rekonStatus: 'BELUM', cocokTipe: null, cocokId: null, catatanRekon: null, direkonPada: null, direkonOleh: null } })
  return res.json({ success: true, message: 'Pasangan dilepas' })
})
// Otomatis: abaikan transfer internal / saldo awal, lalu cocokkan 1:1 serakah (hanya menyentuh kolom rekon, tidak pernah jumlah)
export const rekonOtomatis = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const bulan = req.body?.bulan
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const oleh = 'Auto Recon'
  const belum = await prisma.mutasiKas.findMany({ where: { bulan, rekonStatus: 'BELUM' }, orderBy: [{ tanggal: 'asc' }, { createdAt: 'asc' }] })
  let diabaikan = 0, cocok = 0; const perTipe = {}
  for (const m of belum) {
    if (m.internal || m.kategori === 'Transfer Internal') { await prisma.mutasiKas.update({ where: { id: m.id }, data: { rekonStatus: 'ABAIKAN', catatanRekon: 'Auto: transfer internal (bukan P&L)', direkonPada: new Date(), direkonOleh: oleh } }); diabaikan++; continue }
    if (m.kategori === 'Saldo Awal' || m.tipe === 'OPENING') { await prisma.mutasiKas.update({ where: { id: m.id }, data: { rekonStatus: 'ABAIKAN', catatanRekon: 'Auto: saldo awal (bukan aliran bulan)', direkonPada: new Date(), direkonOleh: oleh } }); diabaikan++; continue }
    const pilih = (await kandidat(m))[0]
    if (!pilih) continue
    await prisma.mutasiKas.update({ where: { id: m.id }, data: { rekonStatus: 'COCOK', cocokTipe: pilih.tipe, cocokId: pilih.id, direkonPada: new Date(), direkonOleh: oleh } })
    cocok++; perTipe[pilih.tipe] = (perTipe[pilih.tipe] ?? 0) + 1
  }
  return res.json({ success: true, data: { diabaikan, cocok, perTipe, ...(await ringkasRekon(bulan)) } })
})
export const getRingkasRekon = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  if (!bulanOk(req.query.bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  return res.json({ success: true, data: await ringkasRekon(req.query.bulan, req.query.dompetId) })
})

// Saldo bank per bulan (OGS BankBalance), kas pusat
export const getSaldoBank = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  if (!bulanOk(req.query.bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const b = await prisma.saldoBankBulanan.findMany({ where: { bulan: req.query.bulan }, orderBy: { namaRekening: 'asc' } })
  return res.json({ success: true, data: { bulan: req.query.bulan, saldo: b.map(x => ({ namaRekening: x.namaRekening, jumlah: x.jumlah })), total: b.reduce((a, x) => a + x.jumlah, 0) } })
})
export const simpanSaldoBank = wrap(async (req, res) => {
  if (!hanyaSuper(req, res)) return
  const { bulan, namaRekening } = req.body ?? {}
  if (!bulanOk(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const nama = String(namaRekening ?? '').trim(); if (!nama || nama.length > 80) return gagal(res, 422, 'namaRekening wajib diisi (maks 80 huruf)')
  const j = angka(req.body.jumlah); if (!(j >= 0)) return gagal(res, 422, 'Jumlah tidak boleh negatif')
  await prisma.saldoBankBulanan.upsert({ where: { bulan_namaRekening: { bulan, namaRekening: nama } }, update: { jumlah: j, dibuatOleh: await namaPengguna(req) }, create: { bulan, namaRekening: nama, jumlah: j, dibuatOleh: await namaPengguna(req) } })
  return res.json({ success: true, message: 'Saldo bank disimpan' })
})
