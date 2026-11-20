import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio } from './circle.js'
import { kanonKategori } from '../utils/kategori.js'
import { lingkupStudio, whereFreelancerTerlihat } from '../utils/freelancer.js'

// DATA INDUK FREELANCER (10 Nov 2026, masukan tim): admin mengisi dulu — nama, no. HP, rekening, keahlian (= kategori unit, boleh lebih dari satu),
// tautan portofolio — lalu daftar itu menjadi pilihan saat mengisi order/LTK. Lingkup = circle (atau rumah usaha) pencatat; antar circle terisolasi
// (aturan keras). PER UNIT (13 Nov 2026, masukan tim — ada freelancer yang tidak mau dimunculkan ke studio lain): data milik unit pencatat;
// unit lain di circle hanya melihat bila "Bagikan ke unit lain" dicentang (bawaan tidak), atau bila freelancer itu pernah mengerjakan order mereka.
// Yang bukan milik unit ini: lihat & pakai di order saja (ubah/hapus/bagikan hanya unit pencatat), tanpa data rekening.
// Order · Total fee · Terakhir dihitung dari order UNIT INI saja (fee unit lain tidak terlihat; aturan 8 wewenang per unit).
// Nomor rekening TIDAK pernah dikirim utuh ke klien — hanya bank, atas nama, dan 4 digit terakhir (tersamar); mengganti = ketik ulang seluruhnya.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }

async function izinKelola(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return false }
  const p = await peranStudio(req, studioId)
  if (!p.manajer || p.lihatSaja) { gagal(res, 403, 'Data freelancer hanya untuk Koordinator ke atas / admin market'); return false }
  return true
}
const samar = (no) => { const d = String(no ?? '').replace(/\D/g, ''); return d ? `•••• ${d.slice(-4)}` : null }
// Milik unit ini = dicatat unit ini, atau data lama tanpa pencatat (diklaim unit yang pertama mengubahnya).
const milikUnit = (t, studioId) => !t.studioId || t.studioId === studioId
const rapi = (t, studioId, stat, namaUnit) => {
  const milik = milikUnit(t, studioId)
  return {
    id: t.id, nama: t.nama, kontak: t.kontak, skill: t.skill, tautanPorto: t.tautanPorto, catatan: milik ? t.catatan : null, aktif: t.aktif,
    milik, bagikan: t.bagikan, dariUnit: milik ? null : (namaUnit ?? 'unit lain'),
    bank: milik ? t.bank : null, atasNamaRekening: milik ? t.atasNamaRekening : null, rekening: milik ? samar(t.noRekening) : null, adaRekening: milik && !!t.noRekening,
    jumlahOrder: stat?.jumlahOrder ?? 0, totalFee: stat?.totalFee ?? 0, terakhir: stat?.terakhir ?? null,
  }
}
const bukanMilik = (res) => gagal(res, 403, 'Freelancer ini dicatat unit lain — hanya unit pencatat yang bisa mengubah, membagikan, atau menghapusnya')
function bersih(b, { baru }) {
  const d = {}
  const teks = (f, maks, nama) => { if (b[f] !== undefined) { const v = b[f] == null ? '' : String(b[f]).trim(); if (v.length > maks) throw new Error(`${nama} terlalu panjang (maks ${maks} huruf)`); d[f] = v || null } }
  try {
    if (baru || b.nama !== undefined) { const n = String(b.nama ?? '').trim(); if (!n || n.length > 120) throw new Error('Nama wajib diisi (maks 120 huruf)'); d.nama = n }
    teks('kontak', 60, 'No. HP'); teks('bank', 60, 'Bank'); teks('atasNamaRekening', 120, 'Atas nama'); teks('catatan', 500, 'Catatan')
    if (b.tautanPorto !== undefined) { const v = b.tautanPorto == null ? '' : String(b.tautanPorto).trim(); if (v && (!/^https?:\/\//i.test(v) || v.length > 500)) throw new Error('Tautan portofolio harus diawali http:// atau https://'); d.tautanPorto = v || null }
    if (b.noRekening !== undefined && String(b.noRekening ?? '').trim() !== '') { const v = String(b.noRekening).trim(); if (!/^[\d\s.-]{4,40}$/.test(v)) throw new Error('No. rekening hanya angka (4–40 karakter)'); d.noRekening = v }
    if (b.hapusRekening === true) { d.noRekening = null; d.bank = null; d.atasNamaRekening = null }
    if (b.aktif !== undefined) d.aktif = !!b.aktif
    if (b.bagikan !== undefined) d.bagikan = !!b.bagikan
  } catch (e) { return { galat: e.message } }
  return { data: d }
}

export const getFreelancer = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await izinKelola(req, res, studioId))) return
  const l = await lingkupStudio(studioId)
  const daftar = await prisma.talentEksternal.findMany({ where: whereFreelancerTerlihat(l, studioId), orderBy: { nama: 'asc' } })
  const baris = await prisma.assignmentProduksi.findMany({ where: { talentEksternalId: { in: daftar.map(t => t.id) }, order: { studioId } }, select: { talentEksternalId: true, feeTalent: true, createdAt: true } })
  const unit = new Map((await prisma.studio.findMany({ where: { id: { in: [...new Set(daftar.map(t => t.studioId).filter(Boolean))] } }, select: { id: true, nama: true } })).map(u => [u.id, u.nama]))
  const stat = new Map()
  for (const b of baris) { const e = stat.get(b.talentEksternalId) ?? { jumlahOrder: 0, totalFee: 0, terakhir: null }; e.jumlahOrder++; e.totalFee += b.feeTalent ?? 0; if (!e.terakhir || b.createdAt > e.terakhir) e.terakhir = b.createdAt; stat.set(b.talentEksternalId, e) }
  return res.json({ success: true, data: daftar.map(t => rapi(t, studioId, stat.get(t.id), unit.get(t.studioId))).sort((a, b) => (b.milik - a.milik) || b.jumlahOrder - a.jumlahOrder || a.nama.localeCompare(b.nama, 'id')) })
})
export const tambahFreelancer = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await izinKelola(req, res, studioId))) return
  const { galat, data } = bersih(req.body ?? {}, { baru: true }); if (galat) return gagal(res, 422, galat)
  const l = await lingkupStudio(studioId)
  if (await prisma.talentEksternal.findFirst({ where: { nama: { equals: data.nama, mode: 'insensitive' }, ...whereFreelancerTerlihat(l, studioId) }, select: { id: true } })) return gagal(res, 409, 'Freelancer dengan nama itu sudah ada di daftar')
  if (req.body?.skill !== undefined) { const kk = await kanonKategori(studioId, req.body.skill); if (kk?.galat) return gagal(res, 422, kk.galat); data.skill = kk }
  const t = await prisma.talentEksternal.create({ data: { ...data, lingkupKunci: l.kunci, studioId } })
  return res.status(201).json({ success: true, data: rapi(t, studioId) })
})
export const ubahFreelancer = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await izinKelola(req, res, studioId))) return
  const l = await lingkupStudio(studioId)
  const t = await prisma.talentEksternal.findFirst({ where: { id: req.params.id, ...whereFreelancerTerlihat(l, studioId) } })
  if (!t) return gagal(res, 404, 'Freelancer tidak ditemukan di lingkup ini')
  if (!milikUnit(t, studioId)) return bukanMilik(res)
  const { galat, data } = bersih(req.body ?? {}, { baru: false }); if (galat) return gagal(res, 422, galat)
  if (data.nama && data.nama.toLowerCase() !== t.nama.toLowerCase() && await prisma.talentEksternal.findFirst({ where: { id: { not: t.id }, nama: { equals: data.nama, mode: 'insensitive' }, ...whereFreelancerTerlihat(l, studioId) }, select: { id: true } })) return gagal(res, 409, 'Freelancer dengan nama itu sudah ada di daftar')
  if (req.body?.skill !== undefined) { const kk = await kanonKategori(studioId, req.body.skill); if (kk?.galat) return gagal(res, 422, kk.galat); data.skill = kk }
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  if (!t.lingkupKunci) data.lingkupKunci = l.kunci // data lama: ikut lingkup pencatat pertama yang menyuntingnya
  if (!t.studioId) data.studioId = studioId // data lama tanpa pencatat: diklaim unit yang pertama mengubahnya
  const baru = await prisma.talentEksternal.update({ where: { id: t.id }, data })
  return res.json({ success: true, data: rapi(baru, studioId) })
})
// Hapus freelancer (12 Nov 2026, masukan tim: salah input / tidak direkomendasikan lagi). Riwayat order AMAN: nama freelance di order
// (AssignmentProduksi.namaEksternal), fee & Bayar freelance tetap; hanya tautan ke data induk dilepas. Freelancer yang dicatat/dipakai circle
// lain / unit lain tidak bisa dihapus dari sini — cukup dinonaktifkan.
export const hapusFreelancer = wrap(async (req, res) => {
  const studioId = req.query.studioId ?? req.body?.studioId
  if (!(await izinKelola(req, res, studioId))) return
  const l = await lingkupStudio(studioId)
  const t = await prisma.talentEksternal.findFirst({ where: { id: req.params.id, ...whereFreelancerTerlihat(l, studioId) } })
  if (!t) return gagal(res, 404, 'Freelancer tidak ditemukan di lingkup ini')
  if (!milikUnit(t, studioId)) return bukanMilik(res)
  const luar = await prisma.assignmentProduksi.count({ where: { talentEksternalId: t.id, order: { studioId: { not: studioId } } } })
  if (luar || (t.lingkupKunci && t.lingkupKunci !== l.kunci)) return gagal(res, 409, 'Freelancer ini juga dipakai di order unit lain — tidak bisa dihapus dari sini. Nonaktifkan saja.')
  const n = await prisma.assignmentProduksi.count({ where: { talentEksternalId: t.id } })
  await prisma.$transaction([
    prisma.assignmentProduksi.updateMany({ where: { talentEksternalId: t.id }, data: { talentEksternalId: null } }),
    prisma.talentEksternal.delete({ where: { id: t.id } }),
  ])
  return res.json({ success: true, message: n ? `${t.nama} dihapus dari daftar. Namanya di ${n} order tetap tercatat (riwayat & fee tidak berubah).` : `${t.nama} dihapus dari daftar.` })
})
