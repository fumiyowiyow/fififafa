import prisma from '../prisma.js'
import { atasanStudio } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat, peranStudio } from './circle.js'
import { anggotaStudio } from '../utils/penugasanDb.js'
import { periksaStudio, eskalasiQcMacet } from '../utils/otomasiDb.js'

// DISKUSI KEPUTUSAN web circle (20 Okt 2026) — adaptasi OGS DecisionThreadController: thread terkait order, peserta, pesan berbalas
// (1 tingkat) dengan @sebut, keputusan/pembatalan dengan ringkasan, penanda belum dibaca. TANPA lampiran berkas: hanya tautan http(s).
// Akses: peserta + atasan di unit itu (Kepala Circle ke atas). Pembuatan: siapa pun yang punya akses unit (talent juga).
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const atasan = (req, studioId) => atasanStudio(peranKerja(req), studioId) // Kepala Circle/Rumah Usaha PEMILIK unit itu ke atas (21 Okt 2026)
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? 'Pengguna'
const tautanOk = (v) => { if (v == null) return []; if (!Array.isArray(v) || v.length > 5) return undefined; const out = v.map(x => String(x).trim()); return out.every(u => /^https?:\/\/\S{3,480}$/.test(u)) ? out : undefined }
const gabungId = (a) => [...new Set(a.filter(Boolean))]

async function akses(req, res, id, { tulis = false } = {}) {
  const d = await prisma.diskusiKeputusan.findUnique({ where: { id }, include: { peserta: true } })
  if (!d || !(await studioBolehDilihat(req, d.studioId))) { gagal(res, d ? 403 : 404, d ? 'Bukan unit dalam wewenangmu' : 'Diskusi tidak ditemukan'); return null }
  const peserta = d.peserta.find(p => p.userId === req.user.id)
  const pengawas = await atasan(req, d.studioId)
  if (!peserta && !pengawas) { gagal(res, 403, 'Kamu bukan peserta diskusi ini'); return null }
  if (tulis && d.status !== 'TERBUKA') { gagal(res, 422, 'Diskusi sudah ditutup'); return null }
  return { d, peserta, kelola: peserta?.peran === 'PEMILIK' || pengawas }
}

export const getDiskusiOpsi = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const [anggota, orders] = await Promise.all([anggotaStudio(studioId), prisma.orderProduksi.findMany({ where: { studioId, status: { in: ['MASUK', 'PROSES'] } }, select: { id: true, judul: true, klien: true }, orderBy: { createdAt: 'desc' }, take: 100 })])
  return res.json({ success: true, data: { anggota: [...anggota.entries()].filter(([id]) => id !== req.user.id).map(([id, nama]) => ({ id, nama })), order: orders } })
})

export const getDiskusi = wrap(async (req, res) => {
  const { studioId, status } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const where = { studioId, ...(['TERBUKA', 'DIPUTUSKAN', 'DIBATALKAN'].includes(status) ? { status } : {}), ...((await atasan(req, studioId)) ? {} : { peserta: { some: { userId: req.user.id } } }) }
  const daftar = await prisma.diskusiKeputusan.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100, include: { peserta: { select: { userId: true, terakhirDibaca: true } }, pesan: { where: { dihapusPada: null }, orderBy: { createdAt: 'desc' }, take: 1 } } })
  const orders = await prisma.orderProduksi.findMany({ where: { id: { in: gabungId(daftar.map(d => d.orderId)) } }, select: { id: true, judul: true } })
  const belum = await Promise.all(daftar.map(d => { const p = d.peserta.find(x => x.userId === req.user.id); return p ? prisma.pesanDiskusi.count({ where: { diskusiId: d.id, dihapusPada: null, createdAt: { gt: p.terakhirDibaca ?? new Date(0) }, OR: [{ userId: null }, { userId: { not: req.user.id } }] } }) : 0 }))
  return res.json({ success: true, data: daftar.map((d, i) => ({ id: d.id, judul: d.judul, status: d.status, otomatis: d.otomatis, order: orders.find(o => o.id === d.orderId) ?? null, jumlahPeserta: d.peserta.length, belumDibaca: belum[i], pesanTerakhir: d.pesan[0] ? { nama: d.pesan[0].nama, isi: d.pesan[0].isi.slice(0, 120), waktu: d.pesan[0].createdAt } : null, diperbarui: d.updatedAt })) })
})
export const getBelumDibaca = wrap(async (req, res) => {
  const p = await prisma.pesertaDiskusi.findMany({ where: { userId: req.user.id, diskusi: { status: 'TERBUKA' } }, select: { diskusiId: true, terakhirDibaca: true } })
  let total = 0
  for (const x of p) total += await prisma.pesanDiskusi.count({ where: { diskusiId: x.diskusiId, dihapusPada: null, createdAt: { gt: x.terakhirDibaca ?? new Date(0) }, OR: [{ userId: null }, { userId: { not: req.user.id } }] } })
  return res.json({ success: true, data: { belumDibaca: total } })
})

export const buatDiskusi = wrap(async (req, res) => {
  const { studioId, orderId } = req.body ?? {}
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  const judul = String(req.body.judul ?? '').trim(); if (!judul || judul.length > 200) return gagal(res, 422, 'Judul wajib diisi (maks 200 huruf)')
  const peserta = gabungId(req.body.peserta ?? []).filter(id => id !== req.user.id)
  if (!peserta.length) return gagal(res, 422, 'Pilih minimal satu peserta selain kamu')
  const anggota = await anggotaStudio(studioId)
  if (peserta.some(id => !anggota.has(id))) return gagal(res, 422, 'Ada peserta yang bukan anggota kerja unit ini')
  if (orderId && !(await prisma.orderProduksi.findFirst({ where: { id: orderId, studioId }, select: { id: true } }))) return gagal(res, 422, 'Order bukan milik unit ini')
  const tautan = tautanOk(req.body.tautan); if (tautan === undefined) return gagal(res, 422, 'Tautan harus http(s), maks 5 — tanpa unggahan berkas')
  const nama = await namaPengguna(req)
  const awal = String(req.body.pesanAwal ?? '').trim()
  const d = await prisma.diskusiKeputusan.create({ data: { studioId, orderId: orderId || null, judul, deskripsi: req.body.deskripsi ? String(req.body.deskripsi).slice(0, 2000) : null, tautan, dibuatOlehId: req.user.id, dibuatOleh: nama,
    peserta: { create: [{ userId: req.user.id, peran: 'PEMILIK', terakhirDibaca: new Date() }, ...peserta.map(userId => ({ userId, peran: 'PESERTA' }))] },
    ...(awal ? { pesan: { create: { userId: req.user.id, nama, isi: awal.slice(0, 2000) } } } : {}) } })
  return res.status(201).json({ success: true, data: { id: d.id } })
})

function susunPesan(pesan, nama) {
  const rapi = (m) => ({ id: m.id, nama: m.nama, userId: m.userId, isi: m.dihapusPada ? null : m.isi, dihapus: !!m.dihapusPada, tautan: m.dihapusPada ? [] : m.tautan, sebut: m.sebut.map(id => nama.get(id) ?? '—'), waktu: m.createdAt, otomatis: m.userId == null })
  const atas = pesan.filter(m => !m.indukId)
  return atas.map(m => ({ ...rapi(m), balasan: pesan.filter(x => x.indukId === m.id).map(rapi) }))
}
export const getDetailDiskusi = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id); if (!a) return
  const { d } = a
  const [pesan, user, order] = await Promise.all([prisma.pesanDiskusi.findMany({ where: { diskusiId: d.id }, orderBy: { createdAt: 'asc' } }), prisma.user.findMany({ where: { id: { in: d.peserta.map(p => p.userId) } }, select: { id: true, nama: true } }), d.orderId ? prisma.orderProduksi.findUnique({ where: { id: d.orderId }, select: { id: true, judul: true, klien: true } }) : null])
  const nama = new Map(user.map(u => [u.id, u.nama]))
  if (a.peserta) await prisma.pesertaDiskusi.update({ where: { id: a.peserta.id }, data: { terakhirDibaca: new Date() } })
  return res.json({ success: true, data: { id: d.id, judul: d.judul, deskripsi: d.deskripsi, tautan: d.tautan, status: d.status, otomatis: d.otomatis, dibuatOleh: d.dibuatOleh, createdAt: d.createdAt, order,
    ringkasanKeputusan: d.ringkasanKeputusan, diputuskanOleh: d.diputuskanOleh, diputuskanPada: d.diputuskanPada, dibatalkanOleh: d.dibatalkanOleh,
    peserta: d.peserta.map(p => ({ userId: p.userId, nama: nama.get(p.userId) ?? '—', peran: p.peran })), pesan: susunPesan(pesan, nama), bisaKelola: a.kelola, saya: req.user.id } })
})
export const kirimPesan = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id, { tulis: true }); if (!a) return
  const isi = String(req.body.isi ?? '').trim(), tautan = tautanOk(req.body.tautan)
  if (tautan === undefined) return gagal(res, 422, 'Tautan harus http(s), maks 5 — tanpa unggahan berkas')
  if (!isi && !tautan.length) return gagal(res, 422, 'Pesan atau tautan wajib diisi')
  if (isi.length > 2000) return gagal(res, 422, 'Pesan maks 2000 huruf')
  if (req.body.indukId) { const ind = await prisma.pesanDiskusi.findFirst({ where: { id: req.body.indukId, diskusiId: a.d.id } }); if (!ind) return gagal(res, 422, 'Komentar induk tidak ditemukan'); if (ind.indukId) return gagal(res, 422, 'Balasan hanya bisa ke komentar tingkat atas') }
  const anggota = await anggotaStudio(a.d.studioId)
  const sebut = gabungId(req.body.sebut ?? []).filter(id => anggota.has(id))
  const m = await prisma.pesanDiskusi.create({ data: { diskusiId: a.d.id, userId: req.user.id, nama: await namaPengguna(req), indukId: req.body.indukId || null, isi, tautan, sebut } })
  for (const userId of sebut) await prisma.pesertaDiskusi.upsert({ where: { diskusiId_userId: { diskusiId: a.d.id, userId } }, update: {}, create: { diskusiId: a.d.id, userId } })
  await prisma.diskusiKeputusan.update({ where: { id: a.d.id }, data: { updatedAt: new Date() } })
  if (a.peserta) await prisma.pesertaDiskusi.update({ where: { id: a.peserta.id }, data: { terakhirDibaca: new Date() } })
  return res.status(201).json({ success: true, data: { id: m.id } })
})
export const hapusPesan = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id); if (!a) return
  const m = await prisma.pesanDiskusi.findFirst({ where: { id: req.params.pesanId, diskusiId: a.d.id } })
  if (!m) return gagal(res, 404, 'Pesan tidak ditemukan')
  if (m.userId !== req.user.id) return gagal(res, 403, 'Hanya pemilik pesan yang bisa menghapus')
  await prisma.pesanDiskusi.update({ where: { id: m.id }, data: { dihapusPada: new Date() } })
  return res.json({ success: true, message: 'Pesan dihapus' })
})
export const ubahDiskusi = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya pemilik atau atasan yang bisa mengubah')
  if (a.d.status !== 'TERBUKA') return gagal(res, 422, 'Diskusi sudah ditutup')
  const data = {}
  if (req.body.judul !== undefined) { const j = String(req.body.judul).trim(); if (!j || j.length > 200) return gagal(res, 422, 'Judul wajib diisi (maks 200 huruf)'); data.judul = j }
  if (req.body.deskripsi !== undefined) data.deskripsi = req.body.deskripsi ? String(req.body.deskripsi).slice(0, 2000) : null
  if (req.body.tautan !== undefined) { const t = tautanOk(req.body.tautan); if (t === undefined) return gagal(res, 422, 'Tautan harus http(s), maks 5'); data.tautan = t }
  await prisma.diskusiKeputusan.update({ where: { id: a.d.id }, data })
  return res.json({ success: true, message: 'Diskusi diperbarui' })
})
export const putuskanDiskusi = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id, { tulis: true }); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya pemilik atau atasan yang bisa memutuskan')
  const ringkasan = String(req.body.ringkasan ?? '').trim(); if (!ringkasan) return gagal(res, 422, 'Ringkasan keputusan wajib diisi')
  await prisma.diskusiKeputusan.update({ where: { id: a.d.id }, data: { status: 'DIPUTUSKAN', ringkasanKeputusan: ringkasan.slice(0, 2000), diputuskanOleh: await namaPengguna(req), diputuskanPada: new Date() } })
  return res.json({ success: true, message: 'Keputusan dicatat' })
})
export const batalkanDiskusi = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id, { tulis: true }); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya pemilik atau atasan yang bisa membatalkan')
  await prisma.diskusiKeputusan.update({ where: { id: a.d.id }, data: { status: 'DIBATALKAN', dibatalkanOleh: await namaPengguna(req), dibatalkanPada: new Date() } })
  return res.json({ success: true, message: 'Diskusi dibatalkan' })
})
export const tambahPeserta = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id, { tulis: true }); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya pemilik atau atasan yang bisa menambah peserta')
  const anggota = await anggotaStudio(a.d.studioId)
  const baru = gabungId(req.body.userIds ?? []).filter(id => anggota.has(id) && !a.d.peserta.some(p => p.userId === id))
  if (!baru.length) return gagal(res, 422, 'Tidak ada peserta baru yang valid')
  await prisma.pesertaDiskusi.createMany({ data: baru.map(userId => ({ diskusiId: a.d.id, userId })), skipDuplicates: true })
  return res.json({ success: true, data: { ditambahkan: baru.length } })
})
export const hapusPeserta = wrap(async (req, res) => {
  const a = await akses(req, res, req.params.id, { tulis: true }); if (!a) return
  if (!a.kelola) return gagal(res, 403, 'Hanya pemilik atau atasan yang bisa menghapus peserta')
  const p = a.d.peserta.find(x => x.userId === req.params.userId)
  if (!p) return gagal(res, 404, 'Peserta tidak ditemukan')
  if (p.peran === 'PEMILIK') return gagal(res, 422, 'Pemilik tidak bisa dihapus dari diskusi')
  await prisma.pesertaDiskusi.delete({ where: { id: p.id } })
  return res.json({ success: true, message: 'Peserta dihapus' })
})

// ── Otomatisasi: pemeriksaan & eskalasi manual per unit (aturan yang sama dijalankan harian oleh md-bot) ───────────────────
export const getPeringatan = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  if (!(await peranStudio(req, studioId)).manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  return res.json({ success: true, data: await periksaStudio(studioId) })
})
export const jalankanEskalasi = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan unit dalam wewenangmu')
  if (!(await peranStudio(req, studioId)).manajer) return gagal(res, 403, 'Hanya Koordinator ke atas')
  const dibuat = await eskalasiQcMacet(studioId)
  return res.json({ success: true, data: { dibuat: dibuat.length, diskusi: dibuat.map(d => ({ id: d.diskusiId, judul: d.judul })) } })
})
