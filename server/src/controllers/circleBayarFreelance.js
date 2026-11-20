import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat, peranStudio, saringAkun, orderDalamAkun } from './circle.js'
import { rekeningSah, bacaRekeningId } from '../utils/rekeningKas.js'

// BAYAR FREELANCE (12 Nov 2026, masukan tim): fee freelance di Tim order kini tercatat sebagai UTANG unit ke freelance → dibayar DP/lunas.
// Memakai kolom yang sudah ada di AssignmentProduksi (statusBayar BELUM_LUNAS|DP|LUNAS, dpAmount = total yang sudah dibayar, tanggalDibayar).
// Setiap pembayaran otomatis menjadi BIAYA unit (BiayaStudio kategori "Fee Freelance", disetujui, lunas, assignmentId terisi) sehingga ikut
// kas, Tutup bulan & laba rugi — tidak perlu dicatat lagi di Biaya & Kas. Batalkan = biaya otomatis itu dihapus & status kembali belum dibayar.
// Lihat: Koordinator/Pendamping/Admin Market unit (pemilik lihat saja); bayar/batal: hanya pengelola unit (Koordinator = CEO unit).
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !isNaN(new Date(s)) ? new Date(s + 'T00:00:00.000Z') : null)
const r2 = (n) => Math.round(n * 100) / 100
const hariIni = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
const bulanTertutup = async (studioId, t) => (await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId, bulan: ISO(t).slice(0, 7) } } }))?.status === 'DITUTUP'
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'
export const KATEGORI_FEE_FREELANCE = 'Fee Freelance'

const rapi = (a) => {
  const fee = a.feeTalent ?? 0, dibayar = a.statusBayar === 'LUNAS' ? Math.max(fee, a.dpAmount ?? 0) : (a.dpAmount ?? 0)
  return { id: a.id, nama: a.namaEksternal, order: { id: a.order.id, judul: a.order.judul, klien: a.order.klien, status: a.order.status }, fee: a.feeTalent, dibayar: r2(dibayar), sisa: r2(Math.max(0, fee - dibayar)), status: a.statusBayar, tanggalDibayar: ISO(a.tanggalDibayar), dibuat: ISO(a.createdAt),
    ajuan: a.ajuanJenis ? { jenis: a.ajuanJenis, jumlah: a.ajuanJumlah, catatan: a.ajuanCatatan, oleh: a.ajuanOleh, pada: a.ajuanPada } : null }
}
export const getBayarFreelance = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const p = await peranStudio(req, studioId)
  if (!p.manajer) return gagal(res, 403, 'Hanya Koordinator/Admin unit ini')
  const semua = req.query.semua === '1'
  const a = await prisma.assignmentProduksi.findMany({
    where: { namaEksternal: { not: null }, userId: null, order: { studioId, status: { not: 'BATAL' }, ...saringAkun(p) }, ...(semua ? {} : { statusBayar: { not: 'LUNAS' } }), ...(req.query.ajuan === '1' ? { ajuanJenis: { not: null } } : {}) },
    include: { order: { select: { id: true, judul: true, klien: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 300,
  })
  const baris = a.map(rapi)
  return res.json({ success: true, data: { baris, bisaBayar: await kelolaStudio(peranKerja(req), studioId), bisaAjukan: !p.lihatSaja, ringkas: { utang: r2(baris.reduce((s, b) => s + b.sisa, 0)), tanpaFee: baris.filter(b => !b.fee).length, ajuan: baris.filter(b => b.ajuan).length } } })
})

async function muat(req, res) {
  const a = await prisma.assignmentProduksi.findUnique({ where: { id: req.params.id }, include: { order: { select: { id: true, judul: true, klien: true, status: true, studioId: true } } } })
  if (!a || !a.namaEksternal || a.userId) { gagal(res, 404, 'Freelance tidak ditemukan'); return null }
  if (!(await studioBolehDilihat(req, a.order.studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  if (!(await kelolaStudio(peranKerja(req), a.order.studioId))) { gagal(res, 403, 'Pembayaran ke freelance hanya oleh Koordinator/Pendamping unit ini ke atas'); return null }
  if (req.user?.imp) { gagal(res, 403, 'Tidak bisa saat menyamar'); return null }
  return a
}
export const bayarFreelance = wrap(async (req, res) => {
  const a = await muat(req, res); if (!a) return
  const jenis = req.body?.jenis
  if (!['DP', 'LUNAS'].includes(jenis)) return gagal(res, 422, 'jenis harus DP atau LUNAS')
  if (a.statusBayar === 'LUNAS') return gagal(res, 409, 'Fee freelance ini sudah lunas')
  const t = tgl(req.body?.tanggal ?? hariIni()); if (!t) return gagal(res, 422, 'Tanggal harus YYYY-MM-DD')
  if (await bulanTertutup(a.order.studioId, t)) return gagal(res, 409, `Bulan ${ISO(t).slice(0, 7)} sudah ditutup di Tutup bulan`)
  const rekeningId = bacaRekeningId(req.body?.rekeningId) ?? null
  if (!(await rekeningSah(a.order.studioId, rekeningId))) return gagal(res, 422, 'Rekening bukan milik unit ini')
  const fee = a.feeTalent ?? 0, sudah = a.dpAmount ?? 0
  let jumlah = Number(req.body?.jumlah)
  if (jenis === 'LUNAS') { if (!fee) return gagal(res, 422, 'Isi fee freelance dulu di Tim order (ubah fee)'); jumlah = r2(fee - sudah) }
  else if (!(jumlah > 0)) return gagal(res, 422, 'Jumlah DP harus lebih dari 0')
  else if (fee && sudah + jumlah >= fee) return gagal(res, 422, 'Jumlah DP mencapai fee — pakai "Lunas"')
  const oleh = await namaPengguna(req)
  await prisma.$transaction([
    ...(jumlah > 0 ? [prisma.biayaStudio.create({ data: { studioId: a.order.studioId, kategori: KATEGORI_FEE_FREELANCE, tanggal: t, jumlah, jumlahDibayar: jumlah, deskripsi: `Fee freelance ${a.namaEksternal} — ${a.order.judul}${jenis === 'DP' ? ' (DP)' : sudah ? ' (pelunasan)' : ''}`.slice(0, 500), freelancer: a.namaEksternal.slice(0, 80), statusBayar: 'LUNAS', persetujuan: 'DISETUJUI', dibayarPada: t, dibayarOleh: oleh, dibuatOlehId: req.user.id, dibuatOleh: oleh, rekeningId, assignmentId: a.id } })] : []),
    prisma.assignmentProduksi.update({ where: { id: a.id }, data: { ...(jenis === 'LUNAS' ? { statusBayar: 'LUNAS', dpAmount: fee, tanggalDibayar: t } : { statusBayar: 'DP', dpAmount: r2(sudah + jumlah) }), ...AJUAN_KOSONG } }), // ajuan admin selesai saat dibayar
  ])
  return res.json({ success: true, message: jenis === 'LUNAS' ? `Fee ${a.namaEksternal} lunas (${jumlah.toLocaleString('id-ID')}) — tercatat sebagai biaya unit` : `DP ${a.namaEksternal} tercatat sebagai biaya unit` })
})
// AJUAN (16 Nov 2026, masukan tim): admin (Admin Market, juga Koordinator) menyiapkan pembayaran — DP berapa atau Lunas — lalu Koordinator
// melihatnya di Tugas saya › Bayar freelance, transfer, dan klik "Sudah dibayar" (bayarFreelance di atas, yang mencatat biaya & kas).
// Ajuan TIDAK menyentuh uang/kas (Aturan 8a); admin per akun hanya order akunnya; pemilik (lihat saja) tidak bisa.
const AJUAN_KOSONG = { ajuanJenis: null, ajuanJumlah: null, ajuanCatatan: null, ajuanOleh: null, ajuanPada: null }
async function muatAjuan(req, res) {
  const a = await prisma.assignmentProduksi.findUnique({ where: { id: req.params.id }, include: { order: { select: { id: true, judul: true, studioId: true, akunId: true, status: true } } } })
  if (!a || !a.namaEksternal || a.userId) { gagal(res, 404, 'Freelance tidak ditemukan'); return null }
  if (!(await studioBolehDilihat(req, a.order.studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return null }
  const p = await peranStudio(req, a.order.studioId)
  if (!p.manajer || p.lihatSaja || !orderDalamAkun(p, a.order)) { gagal(res, 403, 'Ajuan bayar freelance oleh Koordinator/Admin unit ini'); return null }
  if (req.user?.imp) { gagal(res, 403, 'Tidak bisa saat menyamar'); return null }
  return a
}
export const ajukanBayarFreelance = wrap(async (req, res) => {
  const a = await muatAjuan(req, res); if (!a) return
  if (a.statusBayar === 'LUNAS') return gagal(res, 409, 'Fee freelance ini sudah lunas')
  const jenis = req.body?.jenis
  if (!['DP', 'LUNAS'].includes(jenis)) return gagal(res, 422, 'jenis harus DP atau LUNAS')
  const fee = a.feeTalent ?? 0, sudah = a.dpAmount ?? 0
  let jumlah = Number(req.body?.jumlah)
  if (jenis === 'LUNAS') { if (!fee) return gagal(res, 422, 'Isi fee freelance dulu di Tim order (ubah fee)'); jumlah = r2(fee - sudah) }
  else if (!(jumlah > 0)) return gagal(res, 422, 'Jumlah DP harus lebih dari 0')
  else if (fee && sudah + jumlah >= fee) return gagal(res, 422, 'Jumlah DP mencapai fee — pilih "Lunas"')
  const catatan = String(req.body?.catatan ?? '').trim().slice(0, 300) || null
  await prisma.assignmentProduksi.update({ where: { id: a.id }, data: { ajuanJenis: jenis, ajuanJumlah: r2(jumlah), ajuanCatatan: catatan, ajuanOleh: await namaPengguna(req), ajuanPada: new Date() } })
  return res.json({ success: true, message: `Ajuan ${jenis === 'LUNAS' ? 'pelunasan' : 'DP'} ${a.namaEksternal} dikirim ke Koordinator` })
})
export const batalAjuanFreelance = wrap(async (req, res) => {
  const a = await muatAjuan(req, res); if (!a) return
  await prisma.assignmentProduksi.update({ where: { id: a.id }, data: AJUAN_KOSONG })
  return res.json({ success: true, message: 'Ajuan dibatalkan' })
})
export const batalBayarFreelance = wrap(async (req, res) => {
  const a = await muat(req, res); if (!a) return
  const biaya = await prisma.biayaStudio.findMany({ where: { assignmentId: a.id } })
  for (const b of biaya) if (await bulanTertutup(a.order.studioId, b.tanggal)) return gagal(res, 409, `Pembayaran bulan ${ISO(b.tanggal).slice(0, 7)} sudah ditutup — tidak bisa dibatalkan`)
  await prisma.$transaction([
    prisma.biayaStudio.deleteMany({ where: { assignmentId: a.id } }),
    prisma.assignmentProduksi.update({ where: { id: a.id }, data: { statusBayar: 'BELUM_LUNAS', dpAmount: null, tanggalDibayar: null } }),
  ])
  return res.json({ success: true, message: 'Pembayaran dibatalkan (biaya otomatisnya dihapus)' })
})
