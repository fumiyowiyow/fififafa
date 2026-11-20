import prisma from '../prisma.js'
import { ROLE_KIRIM_LAPORAN, hasAnyRole } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat, peranStudio, pastikanTahap, tahapEfektif, saringAkun, orderDalamAkun } from './circle.js'
import { jenisNormal } from '../utils/alur.js'
import { JENIS_KERJA, KESULITAN, urutkanAntrean } from '../utils/penugasan.js'
import { catatAudit, bedaField } from '../utils/auditOrder.js'
import { kanonKategori } from '../utils/kategori.js'
import { pastikanFreelancer } from '../utils/freelancer.js'
import { kolomStudio, labelKhusus } from './circleKolomKhusus.js'
import { anggotaStudio, bebanAktif, buatBarisTahap, kandidatDb, saranDb, sinkronPenugasanTahap } from '../utils/penugasanDb.js'

// PENUGASAN web circle (20 Okt 2026) — adaptasi OGS: penugasan per tahap, antrean per orang, keahlian (tahap & genre) + kesulitan order,
// penugasan otomatis (opsional per unit), saran penugasan ulang. Koordinator ke atas (mode 'kelola') mengatur; anggota hanya miliknya.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'

async function manajerUnit(req, res, studioId, order = null) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  const p = await peranStudio(req, studioId)
  if (!p.manajer) { gagal(res, 403, 'Hanya Koordinator ke atas'); return false }
  // Admin per akun jualan (12 Nov 2026): hanya order dari akunnya; daftar antrean ikut disaring
  if (order && !orderDalamAkun(p, order)) { gagal(res, 403, 'Order ini di luar akun jualanmu'); return false }
  req._saringAkun = saringAkun(p)
  return true
}
const muatOrder = (id) => prisma.orderProduksi.findUnique({ where: { id }, include: { assignments: { select: { id: true, userId: true, peran: true, namaEksternal: true, tahapKerjaIds: true, berhentiPada: true, statusBayar: true, dpAmount: true } } } })
// Tim per tahap (10 Nov 2026): validasi daftar tahap yang dikerjakan seseorang — harus tahap KERJA/FINALISASI milik unit order ini ([] = semua tahap kerja)
async function validasiTahapKerja(studioId, ids) {
  if (!Array.isArray(ids)) return { galat: 'tahapKerjaIds harus berupa daftar' }
  const uniq = [...new Set(ids.map(String))]
  if (!uniq.length) return { ids: [] }
  const tahap = await pastikanTahap(studioId)
  const sah = new Set(tahap.filter(t => ['KERJA', 'FINALISASI'].includes(jenisNormal(t.jenis))).map(t => t.id))
  if (uniq.some(i => !sah.has(i))) return { galat: 'Ada tahap yang bukan tahap pengerjaan/finalisasi unit ini' }
  return { ids: uniq, tahap }
}
const namaTahapDari = (tahap, ids) => (ids?.length ? ids.map(i => tahap.find(t => t.id === i)?.nama ?? '?').join(', ') : 'semua tahap')
async function tahapSekarang(order) { const tahap = await pastikanTahap(order.studioId); return tahap.find(t => t.id === tahapEfektif(order, tahap)) }

// ── Antrean per orang ───────────────────────────────────────────────────────────────────────────────────────────────────
export const getAntrean = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await manajerUnit(req, res, studioId))) return
  const baris = await prisma.penugasanTahap.findMany({ where: { status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, order: { studioId, ...req._saringAkun } }, include: { order: { select: { id: true, judul: true, klien: true, deadline: true } } } })
  const anggota = await anggotaStudio(studioId)
  const perOrang = new Map()
  for (const b of baris) { if (!perOrang.has(b.userId)) perOrang.set(b.userId, []); perOrang.get(b.userId).push(b) }
  const orang = [...new Set([...perOrang.keys()])].map(id => ({ userId: id, nama: anggota.get(id) ?? '—', antrean: [...urutkanAntrean(perOrang.get(id).filter(b => !b.tunda)), ...perOrang.get(id).filter(b => b.tunda)].map(b => ({ id: b.id, nomor: b.nomor, orderId: b.order.id, judul: b.order.judul, klien: b.order.klien, deadline: b.order.deadline, tahap: b.namaTahap, status: b.status, tunda: b.tunda, mendesak: b.mendesak, progres: b.progres, catatanKerja: b.catatanKerja, urutan: b.urutanAntrean, otomatis: b.otomatis })) })).sort((a, b) => b.antrean.length - a.antrean.length || a.nama.localeCompare(b.nama, 'id'))
  const pengaturan = await prisma.pengaturanPenugasan.findUnique({ where: { studioId } })
  return res.json({ success: true, data: { orang, anggota: [...anggota.entries()].map(([id, nama]) => ({ id, nama })), otomatis: !!pengaturan?.otomatis } })
})
export const urutkanAntreanOrang = wrap(async (req, res) => {
  const { studioId, userId, ids } = req.body ?? {}
  if (!(await manajerUnit(req, res, studioId))) return
  if (!Array.isArray(ids) || ids.length > 100) return gagal(res, 422, 'ids harus berupa daftar')
  const sah = await prisma.penugasanTahap.findMany({ where: { id: { in: ids }, userId, status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, order: { studioId, ...req._saringAkun } }, select: { id: true } })
  if (sah.length !== ids.length) return gagal(res, 422, 'Ada penugasan yang bukan milik orang/unit ini atau sudah selesai')
  await prisma.$transaction(ids.map((id, i) => prisma.penugasanTahap.update({ where: { id }, data: { urutanAntrean: i + 1 } })))
  return res.json({ success: true, message: 'Urutan antrean disimpan' })
})
// Antrean saya (anggota): bernomor, tanpa data orang lain
export const getAntreanSaya = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  // Yang DITUNDA admin (12 Nov 2026) tidak masuk Antreanku — ordernya tampil di "Tugasku" sebagai prioritas berikutnya / lembur
  const baris = await prisma.penugasanTahap.findMany({ where: { userId: req.user.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, tunda: false, order: { studioId } }, include: { order: { select: { id: true, judul: true, klien: true, deadline: true, tautan: true, isianKhusus: true } } } })
  const kolomKhusus = await kolomStudio(studioId) // label kolom khusus (mis. Boleh pakai AI?) di antrean talent, 12 Nov 2026
  // Catatan proyek terbaru tiap order (16 Nov 2026, masukan tim): feedback klien yang diteruskan admin langsung terbaca di kartu Antreanku
  const ids = [...new Set(baris.map(b => b.order.id))]
  const catatan = new Map()
  for (const c of await prisma.catatanOrder.findMany({ where: { orderId: { in: ids } }, orderBy: { createdAt: 'desc' }, select: { orderId: true, isi: true, nama: true, createdAt: true } })) if (!catatan.has(c.orderId)) catatan.set(c.orderId, { isi: c.isi, nama: c.nama, waktu: c.createdAt })
  return res.json({ success: true, data: urutkanAntrean(baris).map(b => ({ id: b.id, nomor: b.nomor, orderId: b.order.id, folder: b.order.tautan?.[0] ?? null, catatanTerbaru: catatan.get(b.order.id) ?? null, khusus: labelKhusus(kolomKhusus, b.order.isianKhusus), judul: b.order.judul, klien: b.order.klien, deadline: b.order.deadline, tahap: b.namaTahap, status: b.status, mendesak: b.mendesak, progres: b.progres, catatanKerja: b.catatanKerja })) })
})
// TUNDA / MASUKKAN ANTREAN (12 Nov 2026, masukan tim): pengelola menentukan apakah tugas masuk antrean harian talent atau ditunda
// (tetap terlihat di Tugasku talent: prioritas berikutnya / bisa untuk lembur). Tidak memindah order.
export const ubahTunda = wrap(async (req, res) => {
  const b = await prisma.penugasanTahap.findUnique({ where: { id: req.params.id }, include: { order: { select: { id: true, studioId: true, akunId: true } } } })
  if (!b) return gagal(res, 404, 'Penugasan tidak ditemukan')
  if (!(await manajerUnit(req, res, b.order.studioId, b.order))) return
  if (!['MENUNGGU', 'DIKERJAKAN'].includes(b.status)) return gagal(res, 409, 'Penugasan ini sudah tidak aktif')
  const tunda = !!req.body?.tunda
  await prisma.penugasanTahap.update({ where: { id: b.id }, data: { tunda } })
  return res.json({ success: true, data: { tunda }, message: tunda ? 'Ditunda — tidak masuk antrean talent hari ini' : 'Masuk antrean talent' })
})
export const ubahPenugasan = wrap(async (req, res) => {
  const b = await prisma.penugasanTahap.findUnique({ where: { id: req.params.id }, include: { order: { select: { studioId: true, akunId: true } } } })
  if (!b) return gagal(res, 404, 'Penugasan tidak ditemukan')
  if (!(await studioBolehDilihat(req, b.order.studioId))) return gagal(res, 403, 'Bukan unit dalam wewenanganmu')
  const pb = await peranStudio(req, b.order.studioId), manajer = pb.manajer && orderDalamAkun(pb, b.order)
  if (!manajer && b.userId !== req.user.id) return gagal(res, 403, 'Hanya penugasan milikmu sendiri')
  if (b.status === 'SELESAI') return gagal(res, 409, 'Penugasan ini sudah selesai')
  const data = {}
  if (req.body.progres !== undefined) { const p = Number(req.body.progres); if (!Number.isInteger(p) || p < 0 || p > 100) return gagal(res, 422, 'progres harus bilangan bulat 0–100'); data.progres = p; if (p > 0 && b.status === 'MENUNGGU') { data.status = 'DIKERJAKAN'; data.mulaiPada = new Date() } }
  if (req.body.catatanKerja !== undefined) data.catatanKerja = req.body.catatanKerja ? String(req.body.catatanKerja).slice(0, 500) : null
  if (req.body.dijadwalkan !== undefined) { if (!manajer) return gagal(res, 403, 'Jadwal diatur Koordinator'); const t = req.body.dijadwalkan ? new Date(req.body.dijadwalkan + 'T00:00:00Z') : null; if (t && isNaN(t)) return gagal(res, 422, 'dijadwalkan harus YYYY-MM-DD'); data.dijadwalkan = t }
  await prisma.penugasanTahap.update({ where: { id: b.id }, data })
  return res.json({ success: true, message: 'Penugasan diperbarui' })
})

// ── Tim order, penugasan otomatis, saran ────────────────────────────────────────────────────────────────────────────────
export const tambahTimOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const { userId } = req.body ?? {}
  // Freelance (9 Nov 2026): tambahkan berdasarkan NAMA (tanpa akun) → pihak luar di tim order; ditautkan ke data freelancer Ekosistem bila cocok
  const namaFreelance = String(req.body?.namaFreelance ?? '').trim()
  if (namaFreelance) {
    if (namaFreelance.length > 200) return gagal(res, 422, 'Nama freelance maksimal 200 huruf')
    const adaFl = order.assignments.find(a => !a.userId && (a.namaEksternal ?? '').toLowerCase() === namaFreelance.toLowerCase())
    if (adaFl) return gagal(res, 409, adaFl.berhentiPada ? 'Freelance ini pernah berhenti di order ini — klik "Aktifkan lagi" di daftar talent' : 'Freelance ini sudah ada di tim order')
    const tid = await pastikanFreelancer(order.studioId, namaFreelance) // otomatis masuk menu Freelancer (lingkup circle ini)
    await prisma.assignmentProduksi.create({ data: { orderId: order.id, namaEksternal: namaFreelance, tipeEksternal: 'FREELANCER_PERORANGAN', talentEksternalId: tid, peran: req.body.peran ? String(req.body.peran).slice(0, 60) : null } })
    return res.status(201).json({ success: true, message: 'Freelance ditambahkan ke tim order' })
  }
  const anggota = await anggotaStudio(order.studioId)
  if (!anggota.has(userId)) return gagal(res, 422, 'Pengguna bukan anggota kerja unit ini')
  const ada = order.assignments.find(a => a.userId === userId)
  if (ada) return gagal(res, 409, ada.berhentiPada ? 'Orang ini pernah berhenti di order ini — klik "Aktifkan lagi" di daftar talent' : 'Sudah ditugaskan di order ini')
  const tahap = await tahapSekarang(order)
  let tahapKerjaIds = []
  if (req.body?.tahapKerjaIds !== undefined) { const v = await validasiTahapKerja(order.studioId, req.body.tahapKerjaIds); if (v.galat) return gagal(res, 422, v.galat); tahapKerjaIds = v.ids }
  await prisma.assignmentProduksi.create({ data: { orderId: order.id, userId, tahapKerjaIds, peran: req.body.peran ? String(req.body.peran).slice(0, 60) : (tahap?.nama ?? null) } })
  const berhakSekarang = !tahapKerjaIds.length || (tahap && (tahapKerjaIds.includes(tahap.id) || (tahap.indukId && tahapKerjaIds.includes(tahap.indukId))))
  if (tahap && berhakSekarang && JENIS_KERJA.includes(jenisNormal(tahap.jenis))) await buatBarisTahap({ order, tahap, userId, pengguna: await namaPengguna(req) })
  return res.status(201).json({ success: true, message: 'Ditugaskan' })
})
export const hapusTimOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const a = order.assignments.find(x => x.id === req.params.assignmentId)
  if (!a) return gagal(res, 404, 'Penugasan tidak ditemukan')
  // ✕ = salah input. Freelance yang SUDAH dibayar (Bayar freelance) tidak boleh dihapus: biaya "Fee Freelance" di Biaya & Kas menempel ke baris
  // ini dan akan kehilangan induknya (14 Nov 2026). Untuk yang berhenti di tengah jalan pakai "Berhenti" (data & fee tetap tercatat).
  if (!a.userId && (a.statusBayar !== 'BELUM_LUNAS' || (a.dpAmount ?? 0) > 0)) return gagal(res, 409, 'Freelance ini sudah dibayar lewat Bayar freelance — tidak bisa dihapus. Pakai "Berhenti" bila ia tidak melanjutkan.')
  // Tugasnya yang masih berjalan DITUTUP (bukan selesai — tidak masuk Tugas selesai; sama dengan Hold & pindah mundur). Freelance tak punya baris tahap.
  await prisma.$transaction([prisma.assignmentProduksi.delete({ where: { id: a.id } }), ...(a.userId ? [prisma.penugasanTahap.updateMany({ where: { orderId: order.id, userId: a.userId, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, data: { status: 'DITUTUP' } })] : [])])
  await catatAudit(order.id, req.user.id, 'UBAH', [{ field: 'tim', dari: a.userId ? `anggota ${a.peran ?? ''}`.trim() : `freelance ${a.namaEksternal ?? ''}`.trim(), ke: 'dihapus dari tim' }])
  return res.json({ success: true, message: 'Penugasan dihapus' })
})
// Talent BERHENTI di tengah order (14 Nov 2026, masukan tim): mis. talent pertama tidak bisa melanjutkan → dilanjutkan talent kedua.
// Baris talent TIDAK dihapus (nama, fee, riwayat, Bayar freelance tetap), tugas yang masih berjalan DITUTUP (bukan selesai), dan ia tidak
// menerima tahap berikutnya (sinkronPenugasanTahap hanya membaca talent aktif). "Aktifkan lagi" membatalkannya.
export const berhentiTimOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const a = order.assignments.find(x => x.id === req.params.assignmentId)
  if (!a) return gagal(res, 404, 'Penugasan tidak ditemukan')
  if (a.berhentiPada) return gagal(res, 409, 'Talent ini sudah berhenti')
  const alasan = String(req.body?.alasan ?? '').trim().slice(0, 200) || null
  const nama = a.userId ? (await prisma.user.findUnique({ where: { id: a.userId }, select: { nama: true } }))?.nama : a.namaEksternal
  await prisma.$transaction([
    prisma.assignmentProduksi.update({ where: { id: a.id }, data: { berhentiPada: new Date(), berhentiOleh: req.user.id, alasanBerhenti: alasan } }),
    ...(a.userId && !order.assignments.some(x => x.id !== a.id && x.userId === a.userId && !x.berhentiPada) ? [prisma.penugasanTahap.updateMany({ where: { orderId: order.id, userId: a.userId, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, data: { status: 'DITUTUP' } })] : []),
  ])
  await catatAudit(order.id, req.user.id, 'UBAH', [{ field: 'tim', dari: nama ?? 'talent', ke: `berhenti${alasan ? ` (${alasan})` : ''}` }])
  return res.json({ success: true, message: `${nama ?? 'Talent'} berhenti dari order ini. Tugasnya ditutup; nama & fee tetap tercatat.` })
})
export const aktifkanTimOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const a = order.assignments.find(x => x.id === req.params.assignmentId)
  if (!a) return gagal(res, 404, 'Penugasan tidak ditemukan')
  if (!a.berhentiPada) return gagal(res, 409, 'Talent ini masih aktif')
  if (['SELESAI', 'BATAL'].includes(order.status)) return gagal(res, 409, 'Order sudah Selesai/Batal')
  await prisma.assignmentProduksi.update({ where: { id: a.id }, data: { berhentiPada: null, berhentiOleh: null, alasanBerhenti: null } })
  // Sama dengan menambah talent: bila order sedang di tahap kerja yang menjadi bagiannya, langsung masuk antrean lagi
  const tahap = await tahapSekarang(order)
  const ids = a.tahapKerjaIds ?? []
  const berhak = !ids.length || (tahap && (ids.includes(tahap.id) || (tahap.indukId && ids.includes(tahap.indukId))))
  if (a.userId && tahap && berhak && JENIS_KERJA.includes(jenisNormal(tahap.jenis))) await buatBarisTahap({ order, tahap, userId: a.userId, pengguna: await namaPengguna(req) })
  await catatAudit(order.id, req.user.id, 'UBAH', [{ field: 'tim', dari: 'berhenti', ke: 'aktif lagi' }])
  return res.json({ success: true, message: 'Talent aktif lagi di order ini' })
})
// Ubah fee talent (anggota maupun freelance) & peran di order — Koordinator ke atas. feeTalent kosong/null = hapus fee. (10 Nov 2026, masukan tim)
export const ubahTimOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const a = await prisma.assignmentProduksi.findUnique({ where: { id: req.params.assignmentId }, select: { id: true, orderId: true, userId: true, feeTalent: true, peran: true, namaEksternal: true, user: { select: { nama: true } } } })
  if (!a || a.orderId !== order.id) return gagal(res, 404, 'Penugasan tidak ditemukan')
  const data = {}
  if (req.body?.feeTalent !== undefined) {
    if (req.body.feeTalent === null || req.body.feeTalent === '') data.feeTalent = null
    else { const f = Number(req.body.feeTalent); if (!Number.isFinite(f) || f < 0 || f > 1000000000) return gagal(res, 422, 'Fee harus angka 0–1.000.000.000 (Rp)'); data.feeTalent = Math.round(f) }
  }
  if (req.body?.peran !== undefined) data.peran = req.body.peran ? String(req.body.peran).slice(0, 60) : null
  let tahapBaru = null, daftarTahap = null
  if (req.body?.tahapKerjaIds !== undefined) {
    if (!a.userId) return gagal(res, 422, 'Pembagian tahap hanya untuk anggota berakun (freelance tak punya antrean)')
    const v = await validasiTahapKerja(order.studioId, req.body.tahapKerjaIds); if (v.galat) return gagal(res, 422, v.galat)
    data.tahapKerjaIds = v.ids; daftarTahap = v.tahap ?? await pastikanTahap(order.studioId); tahapBaru = v.ids
  }
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  const lama = order.assignments.find(x => x.id === a.id)
  await prisma.assignmentProduksi.update({ where: { id: a.id }, data })
  const nama = a.user?.nama ?? a.namaEksternal ?? '—'
  const perubahan = bedaField(a, data, ['feeTalent', 'peran']).map(x => ({ ...x, field: `${x.field} (${nama})` }))
  if (tahapBaru) {
    perubahan.push({ field: `tahap dikerjakan (${nama})`, dari: namaTahapDari(daftarTahap, lama?.tahapKerjaIds), ke: namaTahapDari(daftarTahap, tahapBaru) })
    // Terapkan ke tahap yang sedang berjalan: baris antrean orang ini dibuat/ditutup sesuai haknya yang baru
    try { const sekarangT = daftarTahap.find(t => t.id === tahapEfektif(order, daftarTahap)); if (sekarangT && JENIS_KERJA.includes(jenisNormal(sekarangT.jenis))) await sinkronPenugasanTahap({ order, tujuan: sekarangT, pengguna: await namaPengguna(req) }) } catch { /* abaikan */ }
  }
  await catatAudit(order.id, req.user.id, 'UBAH', perubahan)
  return res.json({ success: true, message: 'Tim order diperbarui' })
})
export const tugaskanOtomatis = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const tahap = await tahapSekarang(order)
  if (!tahap || !JENIS_KERJA.includes(jenisNormal(tahap.jenis))) return gagal(res, 409, 'Order belum berada di tahap kerja')
  if (!order.kesulitan) return gagal(res, 422, 'Isi tingkat kesulitan order dulu')
  const k = await kandidatDb(order, tahap)
  if (!k.userId) return gagal(res, 409, 'Tidak ada anggota yang keahliannya cocok. Isi keahlian di tab Penugasan → Keahlian.')
  if (order.assignments.some(a => a.userId === k.userId)) return gagal(res, 409, 'Kandidat terbaik sudah ditugaskan di order ini')
  await prisma.assignmentProduksi.create({ data: { orderId: order.id, userId: k.userId, peran: tahap.nama } })
  await buatBarisTahap({ order, tahap, userId: k.userId, pengguna: await namaPengguna(req), otomatis: true })
  return res.json({ success: true, data: { userId: k.userId, nama: k.anggota.get(k.userId) } })
})
export const getSaran = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const tahap = await tahapSekarang(order)
  if (!tahap) return res.json({ success: true, data: [] })
  return res.json({ success: true, data: await saranDb(order, tahap, Math.min(5, Math.max(1, Number(req.query.batas) || 2))) })
})
export const ubahProfilOrder = wrap(async (req, res) => {
  const order = await muatOrder(req.params.id)
  if (!order || !(await manajerUnit(req, res, order.studioId, order))) { if (!order) gagal(res, 404, 'Order tidak ditemukan'); return }
  const data = {}
  if (req.body.kesulitan !== undefined) { if (req.body.kesulitan !== null && req.body.kesulitan !== '' && !KESULITAN.includes(req.body.kesulitan)) return gagal(res, 422, `kesulitan harus ${KESULITAN.join(', ')}`); data.kesulitan = req.body.kesulitan || null }
  if (req.body.genre !== undefined) { const g = String(req.body.genre ?? '').trim(); if (g.length > 60) return gagal(res, 422, 'genre maks 60 huruf'); data.genre = g || null }
  if (req.body.kategori !== undefined) { const k = String(req.body.kategori ?? '').trim(); if (k.length > 250) return gagal(res, 422, 'kategori terlalu panjang'); if (k) { const kk = await kanonKategori(order.studioId, k); if (kk?.galat) return gagal(res, 422, kk.galat); data.kategori = kk } else data.kategori = null }
  await prisma.orderProduksi.update({ where: { id: order.id }, data })
  await catatAudit(order.id, req.user.id, 'UBAH', bedaField(order, data, ['kesulitan', 'genre', 'kategori']))
  return res.json({ success: true, message: 'Profil order disimpan' })
})

// ── Keahlian & pengaturan ───────────────────────────────────────────────────────────────────────────────────────────────
export const getKeahlian = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await manajerUnit(req, res, studioId))) return
  const [tahap, kt, kg, anggota, akun] = await Promise.all([pastikanTahap(studioId), prisma.keahlianTahap.findMany({ where: { studioId } }), prisma.keahlianGenre.findMany({ where: { studioId } }), anggotaStudio(studioId), prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true, namaAkun: true, platform: true } })])
  const kerja = tahap.filter(t => JENIS_KERJA.includes(jenisNormal(t.jenis)))
  return res.json({ success: true, data: {
    anggota: [...anggota.entries()].map(([id, nama]) => ({ id, nama })), tahap: kerja.map(t => ({ id: t.id, nama: t.nama })), akun, kesulitan: KESULITAN,
    keahlianTahap: kt.filter(k => anggota.has(k.userId)).map(k => ({ id: k.id, userId: k.userId, nama: anggota.get(k.userId), tahapId: k.tahapId, tahap: kerja.find(t => t.id === k.tahapId)?.nama ?? '—', akunId: k.akunId, maksKesulitan: k.maksKesulitan })),
    keahlianGenre: kg.filter(k => anggota.has(k.userId)).map(k => ({ id: k.id, userId: k.userId, nama: anggota.get(k.userId), genre: k.genre, maksKesulitan: k.maksKesulitan })),
  } })
})
export const simpanKeahlian = wrap(async (req, res) => {
  const { studioId, userId, tahapId, genre, akunId, maksKesulitan } = req.body ?? {}
  if (!(await manajerUnit(req, res, studioId))) return
  if (!KESULITAN.includes(maksKesulitan)) return gagal(res, 422, `maksKesulitan harus ${KESULITAN.join(', ')}`)
  const anggota = await anggotaStudio(studioId)
  if (!anggota.has(userId)) return gagal(res, 422, 'Pengguna bukan anggota kerja unit ini')
  if (!!tahapId === !!genre) return gagal(res, 422, 'Isi salah satu: tahapId ATAU genre')
  if (tahapId) {
    const tahap = (await pastikanTahap(studioId)).find(t => t.id === tahapId)
    if (!tahap || !JENIS_KERJA.includes(jenisNormal(tahap.jenis))) return gagal(res, 422, 'Tahap harus tahap kerja milik unit ini')
    if (akunId && !(await prisma.akunProduksi.findFirst({ where: { id: akunId, studioId }, select: { id: true } }))) return gagal(res, 422, 'Akun bukan milik unit ini')
    const ada = await prisma.keahlianTahap.findFirst({ where: { studioId, userId, tahapId, akunId: akunId || null } })
    if (ada) await prisma.keahlianTahap.update({ where: { id: ada.id }, data: { maksKesulitan } })
    else await prisma.keahlianTahap.create({ data: { studioId, userId, tahapId, akunId: akunId || null, maksKesulitan } })
  } else {
    const g = String(genre).trim(); if (!g || g.length > 60) return gagal(res, 422, 'genre wajib diisi (maks 60 huruf)')
    await prisma.keahlianGenre.upsert({ where: { studioId_userId_genre: { studioId, userId, genre: g } }, update: { maksKesulitan }, create: { studioId, userId, genre: g, maksKesulitan } })
  }
  return res.json({ success: true, message: 'Keahlian disimpan' })
})
export const hapusKeahlian = wrap(async (req, res) => {
  const { jenis } = req.query
  const model = jenis === 'genre' ? prisma.keahlianGenre : prisma.keahlianTahap
  const k = await model.findUnique({ where: { id: req.params.id } })
  if (!k) return gagal(res, 404, 'Keahlian tidak ditemukan')
  if (!(await manajerUnit(req, res, k.studioId))) return
  await model.delete({ where: { id: k.id } })
  return res.json({ success: true, message: 'Keahlian dihapus' })
})
export const simpanPengaturan = wrap(async (req, res) => {
  const { studioId, otomatis } = req.body ?? {}
  if (!(await manajerUnit(req, res, studioId))) return
  await prisma.pengaturanPenugasan.upsert({ where: { studioId }, update: { otomatis: !!otomatis }, create: { studioId, otomatis: !!otomatis } })
  return res.json({ success: true, message: otomatis ? 'Penugasan otomatis dinyalakan' : 'Penugasan otomatis dimatikan' })
})

// Isi keahlian dari riwayat (adaptasi OGS generateCompetenciesFromHistory): orang yang SUDAH menuntaskan sebuah tahap ≥ ambang kali di unit ini
// dianggap mampu tahap itu, level = kesulitan tertinggi order yang pernah dituntaskannya (tanpa kesulitan → MUDAH). Tidak menimpa yang sudah ada.
export const isiKeahlianDariRiwayat = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await manajerUnit(req, res, studioId))) return
  const ambang = Math.min(10, Math.max(1, Number(req.body?.ambang) || 2))
  const selesai = await prisma.penugasanTahap.findMany({ where: { status: 'SELESAI', tahapId: { not: null }, order: { studioId } }, select: { userId: true, tahapId: true, order: { select: { kesulitan: true } } } })
  const anggota = await anggotaStudio(studioId)
  const per = new Map()
  for (const b of selesai) {
    if (!anggota.has(b.userId)) continue
    const k = `${b.userId}|${b.tahapId}`, e = per.get(k) ?? { userId: b.userId, tahapId: b.tahapId, n: 0, lv: 0 }
    e.n++; e.lv = Math.max(e.lv, Math.max(0, KESULITAN.indexOf(b.order.kesulitan))); per.set(k, e)
  }
  const ada = await prisma.keahlianTahap.findMany({ where: { studioId }, select: { userId: true, tahapId: true } })
  const sudah = new Set(ada.map(x => `${x.userId}|${x.tahapId}`))
  const baru = [...per.values()].filter(e => e.n >= ambang && !sudah.has(`${e.userId}|${e.tahapId}`))
  if (baru.length) await prisma.keahlianTahap.createMany({ data: baru.map(e => ({ studioId, userId: e.userId, tahapId: e.tahapId, maksKesulitan: KESULITAN[e.lv] ?? 'MUDAH' })) })
  return res.json({ success: true, data: { ditambah: baru.length, ambang, dilewati: per.size - baru.length }, message: baru.length ? `${baru.length} keahlian ditambahkan dari riwayat` : 'Tidak ada keahlian baru yang memenuhi ambang' })
})
