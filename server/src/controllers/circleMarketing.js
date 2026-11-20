import prisma from '../prisma.js'
import { hitungNilaiBersih } from '../utils/produksi.js'
import { aksiTersedia, jenisNormal, JENIS_MARKETER } from '../utils/alur.js'
import * as M from '../utils/marketing.js'
import { masihDiUnit } from '../utils/fungsi.js'
import { validasiUsd, rupiahDariUsd } from '../utils/uang.js'
import { pastikanTahap, tahapEfektif, peranStudio, studioBolehDilihat, riwayatOrder, jejakUntuk, akunUntukOrder, tanggalSah, saringAkun } from './circle.js'
import { kabarOrderBaru } from '../utils/notifGrup.js'
import { talentUnit } from '../utils/penugasanDb.js'
import { tautkanKlien } from './circleKlien.js'
import { pastikanFreelancer } from '../utils/freelancer.js'
import { catatAudit } from '../utils/auditOrder.js'
import { klienTampakNominal } from '../utils/produksi.js'

// API MARKETING WEB CIRCLE (20 Okt 2026) — adaptasi marketing OGS di atas entitas Ekosistem. Tidak menyentuh keuangan / omset.
// Akses: Marketer (fungsi MARKETER terkonfirmasi) = datanya sendiri; Koordinator ke atas / Admin Market = seluruh tim studio.
// Semua batas studio & circle memakai helper yang sama dengan alur produksi (token circle terikat ke circle di alamatnya).

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const STATUS_LEAD = ['DISCUSSING', 'FOLLOW_UP', 'NEGO', 'CONVERTED', 'LOST']

const sekarangWIB = () => new Date(Date.now() + 7 * 3600 * 1000)
const hariIni = () => sekarangWIB().toISOString().slice(0, 10)
const tgl = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') ? new Date(s + 'T00:00:00.000Z') : null)
const bulanTahun = (q) => {
  const w = sekarangWIB()
  const bulan = Number(q.bulan) || w.getUTCMonth() + 1, tahun = Number(q.tahun) || w.getUTCFullYear()
  if (!(bulan >= 1 && bulan <= 12 && tahun >= 2024 && tahun <= 2100)) return null
  return { bulan, tahun, awal: new Date(Date.UTC(tahun, bulan - 1, 1)), akhir: new Date(Date.UTC(tahun, bulan, 1)) }
}

// Pintu masuk marketing: harus bisa melihat studio DAN (manajer atau marketer). Mengembalikan peran, atau menulis 403 dan null.
async function akses(req, res, studioId) {
  if (!(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  if (!p.manajer && !p.marketer) { gagal(res, 403, 'Marketing hanya untuk Marketer studio ini atau Koordinator ke atas'); return null }
  return p
}
const marketerStudio = async (studioId) => (await prisma.fungsiAnggota.findMany({ where: { studioId, fungsi: 'MARKETER', user: masihDiUnit(studioId) }, select: { user: { select: { id: true, nama: true } } } })).map(f => f.user)
const akunStudio = (studioId) => prisma.akunProduksi.findMany({ where: { studioId }, select: { id: true, platform: true, namaAkun: true }, orderBy: [{ platform: 'asc' }, { namaAkun: 'asc' }] })
// Akun yang boleh dipakai pelaksana: marketer = akun yang ditugaskan padanya; manajer = semua akun studio
async function akunBolehDipakai(userId, studioId, peran) {
  const semua = await akunStudio(studioId)
  if (peran.akunAdmin) { // admin per akun jualan: hanya akunnya (+ akun yang ditugaskan sebagai marketer)
    const tugasM = new Set((await prisma.penugasanAkunMarketer.findMany({ where: { userId, akunId: { in: semua.map(a => a.id) } }, select: { akunId: true } })).map(x => x.akunId))
    return semua.filter(a => peran.akunAdmin.includes(a.id) || tugasM.has(a.id))
  }
  if (peran.manajer && !peran.marketer) return semua
  const tugas = new Set((await prisma.penugasanAkunMarketer.findMany({ where: { userId, akunId: { in: semua.map(a => a.id) } }, select: { akunId: true } })).map(x => x.akunId))
  return peran.manajer ? semua : semua.filter(a => tugas.has(a.id))
}

// ── Ruang kerja marketer (hari ini) ────────────────────────────────────────────────────────────────────────
export const getRuang = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const tanggal = tgl(req.query.tanggal) ?? tgl(hariIni())
    const bt = bulanTahun({ bulan: tanggal.getUTCMonth() + 1, tahun: tanggal.getUTCFullYear() })
    const tahap = await pastikanTahap(studioId)

    // Antrean klien: order di fase milik marketer (Preview klien, Menunggu client, Delivery) — aksinya dari mesin alur
    const orders = await prisma.orderProduksi.findMany({
      where: { studioId, status: { in: ['MASUK', 'PROSES'] }, ...(peran.akunAdmin ? { OR: [saringAkun(peran), { marketerId: req.user.id }] } : {}) }, // admin per akun
      include: { assignments: { where: { berhentiPada: null }, select: { user: { select: { nama: true } }, namaEksternal: true } } },
      orderBy: [{ deadline: 'asc' }, { tanggalMasuk: 'desc' }],
    })
    const jejak = await riwayatOrder(orders.map(o => o.id))
    const antrean = []
    let milikDiProduksi = 0 // order miliknya yang belum sampai fase klien — ditampilkan sebagai keterangan, supaya Antrean kosong tidak membingungkan
    for (const o of orders) {
      const sekarang = tahap.find(t => t.id === tahapEfektif(o, tahap))
      if (!sekarang || !JENIS_MARKETER.includes(jenisNormal(sekarang.jenis))) { if (o.marketerId === req.user.id) milikDiProduksi++; continue }
      const aksi = aksiTersedia({ templat: tahap, order: o, sekarang, riwayat: jejakUntuk(jejak.filter(r => r.orderId === o.id), tahap), peran: { manajer: peran.manajer && !peran.lihatSaja, ditugaskan: false, marketer: peran.marketer } })
      antrean.push({
        id: o.id, judul: o.judul, klien: o.klien, deadline: o.deadline, revisiKe: o.revisiKe, tahap: sekarang.nama, jenis: jenisNormal(sekarang.jenis),
        // nilai uang: manajer semua; marketer HANYA order miliknya sendiri (keputusan user 21 Okt 2026)
        ...(peran.manajer || o.marketerId === req.user.id ? { nilaiDisepakati: o.nilaiDisepakati, nilaiBersih: o.nilaiBersih } : {}), talent: o.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean),
        aksi: aksi.map(a => ({ aksi: a.aksi, label: a.label })),
      })
    }
    const aktivitas = await prisma.aktivitasMarketer.findMany({ where: { studioId, userId: req.user.id, tanggal }, orderBy: { createdAt: 'asc' }, include: { akun: { select: { namaAkun: true, platform: true } } } })
    const akun = await akunBolehDipakai(req.user.id, studioId, peran)
    const bulanIni = await prisma.aktivitasMarketer.findMany({ where: { studioId, userId: req.user.id, tanggal: { gte: bt.awal, lt: bt.akhir } }, select: { jenis: true, selesai: true, jumlah: true } })
    const lead = await prisma.marketingLead.groupBy({ by: ['status'], where: { studioId, ...(peran.manajer ? saringAkun(peran) : { marketerId: req.user.id }) }, _count: true })
    return res.json({
      success: true,
      data: {
        peran: { manajer: peran.manajer, marketer: peran.marketer }, tanggal: tanggal.toISOString().slice(0, 10), katalog: M.KATALOG, tahapAktivitas: M.TAHAP_AKTIVITAS,
        platform: { sosmed: M.PLATFORM_SOSMED, akun: M.PLATFORM_AKUN }, akun, antrean, milikDiProduksi,
        aktivitas: aktivitas.map(a => ({ id: a.id, jenis: a.jenis, judul: a.judul, platform: a.platform, akun: a.akun, jamPosting: a.jamPosting, link: a.link, targetAkun: a.targetAkun, pengikut: a.pengikut, jumlah: a.jumlah, selesai: a.selesai, catatan: a.catatan })),
        kpiBulanIni: M.hitungKpi(bulanIni), lead: Object.fromEntries(lead.map(l => [l.status, l._count])),
      },
    })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// ── Aktivitas harian ───────────────────────────────────────────────────────────────────────────────────────
export const buatAktivitas = async (req, res) => {
  try {
    const { studioId, items } = req.body
    const peran = await akses(req, res, studioId); if (!peran) return
    const tanggal = tgl(req.body.tanggal)
    if (!tanggal) return gagal(res, 422, 'Tanggal wajib (YYYY-MM-DD)')
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) return gagal(res, 422, 'Kirim 1–50 aktivitas')
    const batas = new Date(sekarangWIB().getTime() + 24 * 3600 * 1000)
    if (tanggal > batas) return gagal(res, 422, 'Tanggal tidak boleh di masa depan')
    const boleh = await akunBolehDipakai(req.user.id, studioId, peran)
    const setAkun = new Set(boleh.map(a => a.id))
    const galat = []
    items.forEach((a, i) => M.validasiAktivitas(a, { akunMilikStudio: setAkun }).forEach(g => galat.push({ baris: i + 1, ...g })))
    if (galat.length) return res.status(422).json({ success: false, message: 'Ada isian yang belum benar', galat })
    await prisma.aktivitasMarketer.createMany({
      data: items.map(a => ({
        userId: req.user.id, studioId, tanggal, jenis: a.jenis, akunId: a.akunId || null, judul: a.judul?.trim() || null, platform: a.platform || null,
        jamPosting: a.jamPosting || null, link: a.link?.trim() || null, targetAkun: a.targetAkun?.trim() || null,
        pengikut: a.pengikut === '' || a.pengikut == null ? null : Number(a.pengikut), hasil: a.hasil?.trim() || null,
        jumlah: a.jumlah ? Number(a.jumlah) : 1, catatan: a.catatan?.trim() || null, dibuatOleh: req.user.id,
      })),
    })
    return res.status(201).json({ success: true, data: { dibuat: items.length } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan aktivitas')
  }
}

async function aktivitasBolehDiubah(req, res) {
  const a = await prisma.aktivitasMarketer.findUnique({ where: { id: req.params.id } })
  if (!a) { gagal(res, 404, 'Aktivitas tidak ditemukan'); return null }
  if (!(await studioBolehDilihat(req, a.studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return null }
  const p = await peranStudio(req, a.studioId)
  if (a.userId !== req.user.id && !p.manajer) { gagal(res, 403, 'Hanya pemilik aktivitas atau Koordinator ke atas'); return null }
  return a
}

export const ubahAktivitas = async (req, res) => {
  try {
    const a = await aktivitasBolehDiubah(req, res); if (!a) return
    const data = {}
    if (typeof req.body.selesai === 'boolean') { data.selesai = req.body.selesai; data.selesaiPada = req.body.selesai ? new Date() : null }
    if (req.body.jumlah != null) {
      const n = Number(req.body.jumlah)
      if (!(Number.isInteger(n) && n >= 1 && n <= 500)) return gagal(res, 422, 'Jumlah harus bilangan 1–500')
      data.jumlah = n
    }
    if (Object.keys(data).length === 0) return gagal(res, 422, 'Tidak ada perubahan')
    await prisma.aktivitasMarketer.update({ where: { id: a.id }, data })
    return res.json({ success: true, data: { id: a.id } })
  } catch {
    return gagal(res, 500, 'Gagal memperbarui aktivitas')
  }
}

export const hapusAktivitas = async (req, res) => {
  try {
    const a = await aktivitasBolehDiubah(req, res); if (!a) return
    await prisma.aktivitasMarketer.delete({ where: { id: a.id } })
    return res.json({ success: true, data: { id: a.id } })
  } catch {
    return gagal(res, 500, 'Gagal menghapus aktivitas')
  }
}

// ── Rencana bulanan per marketer × akun ────────────────────────────────────────────────────────────────────
export const getRencana = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const bt = bulanTahun(req.query); if (!bt) return gagal(res, 422, 'Bulan/tahun tidak valid')
    const marketer = await marketerStudio(studioId)
    // marketer melihat dirinya; manajer boleh memilih marketer (?userId=) atau semuanya (?semua=1)
    const pilih = peran.manajer ? (req.query.semua === '1' ? marketer : marketer.filter(m => m.id === (req.query.userId ?? req.user.id))) : marketer.filter(m => m.id === req.user.id)
    const akunSemua = await akunStudio(studioId)
    const hasil = []
    for (const m of pilih) {
      const tugas = await prisma.penugasanAkunMarketer.findMany({ where: { userId: m.id, akunId: { in: akunSemua.map(a => a.id) } }, select: { akunId: true } })
      const idAkun = tugas.map(t => t.akunId)
      const [target, aktivitas] = await Promise.all([
        prisma.targetMarketing.findMany({ where: { userId: m.id, akunId: { in: idAkun }, bulan: bt.bulan, tahun: bt.tahun } }),
        prisma.aktivitasMarketer.findMany({ where: { userId: m.id, studioId, akunId: { in: idAkun }, tanggal: { gte: bt.awal, lt: bt.akhir } }, select: { akunId: true, jenis: true, selesai: true, jumlah: true } }),
      ])
      hasil.push({
        marketer: m,
        akun: idAkun.map(id => {
          const a = akunSemua.find(x => x.id === id)
          const t = target.find(x => x.akunId === id)
          const efektif = t ? { post: t.post, reply: t.reply, update: t.update, seo: t.seo } : M.targetStandar(bt.bulan, bt.tahun)
          const real = M.hitungKpi(aktivitas.filter(x => x.akunId === id))
          return { akunId: id, nama: a.namaAkun, platform: a.platform, pakaiStandar: !t, target: efektif, realisasi: real, progres: M.progresKpi(efektif, real) }
        }),
      })
    }
    return res.json({ success: true, data: { bulan: bt.bulan, tahun: bt.tahun, standar: Object.entries(M.STANDAR).map(([kunci, s]) => ({ kunci, label: s.label })), targetStandar: M.targetStandar(bt.bulan, bt.tahun), marketer: hasil, bisaAtur: peran.manajer, bisaTugaskanAkun: !!peran.pengelola && !peran.lihatSaja } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

export const simpanRencana = async (req, res) => {
  try {
    const { studioId, akunId } = req.body
    const peran = await akses(req, res, studioId); if (!peran) return
    const bt = bulanTahun(req.body); if (!bt) return gagal(res, 422, 'Bulan/tahun tidak valid')
    const userId = peran.manajer && req.body.userId ? req.body.userId : req.user.id
    if (!(await marketerStudio(studioId)).some(m => m.id === userId)) return gagal(res, 422, 'Pengguna bukan Marketer studio ini')
    const ditugaskan = await prisma.penugasanAkunMarketer.findFirst({ where: { userId, akunId, akun: { studioId } } })
    if (!ditugaskan) return gagal(res, 422, 'Akun ini belum ditugaskan ke marketer tersebut')
    const nilai = {}
    for (const k of M.KPI) {
      const n = Number(req.body[k.kunci] ?? 0)
      if (!(Number.isInteger(n) && n >= 0 && n <= 5000)) return gagal(res, 422, `Target ${k.label} harus bilangan 0–5000`)
      nilai[k.kunci] = n
    }
    await prisma.targetMarketing.upsert({ where: { userId_akunId_bulan_tahun: { userId, akunId, bulan: bt.bulan, tahun: bt.tahun } }, update: nilai, create: { userId, akunId, bulan: bt.bulan, tahun: bt.tahun, ...nilai } })
    return res.json({ success: true, data: { userId, akunId, ...nilai } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan rencana')
  }
}

// ── Akun & penugasan ───────────────────────────────────────────────────────────────────────────────────────
export const getAkun = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const akun = peran.akunAdmin ? await akunBolehDipakai(req.user.id, studioId, peran) : await akunStudio(studioId) // admin per akun: pilihan akun hanya miliknya
    const marketer = await marketerStudio(studioId)
    const tugas = await prisma.penugasanAkunMarketer.findMany({ where: { akunId: { in: akun.map(a => a.id) } }, select: { userId: true, akunId: true } })
    const lihat = peran.manajer ? marketer : marketer.filter(m => m.id === req.user.id)
    // penugasan akun ke marketer = pengaturan unit → hanya Koordinator/Pendamping (16 Nov 2026, masukan tim; Aturan 8a)
    return res.json({ success: true, data: { akun, marketer: lihat.map(m => ({ ...m, akunIds: tugas.filter(t => t.userId === m.id).map(t => t.akunId) })), bisaAtur: !!peran.pengelola && !peran.lihatSaja } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

export const simpanPenugasanAkun = async (req, res) => {
  try {
    const { studioId, userId, akunIds } = req.body
    const peran = await akses(req, res, studioId); if (!peran) return
    if (!peran.pengelola || peran.lihatSaja) return gagal(res, 403, 'Penugasan akun ke marketer diatur Koordinator unit')
    if (!Array.isArray(akunIds)) return gagal(res, 422, 'akunIds harus berupa daftar')
    if (!(await marketerStudio(studioId)).some(m => m.id === userId)) return gagal(res, 422, 'Pengguna bukan Marketer studio ini')
    const milik = new Set((await akunStudio(studioId)).map(a => a.id))
    if (!akunIds.every(id => milik.has(id))) return gagal(res, 422, 'Ada akun yang bukan milik studio ini')
    await prisma.$transaction([
      prisma.penugasanAkunMarketer.deleteMany({ where: { userId, akunId: { in: [...milik] } } }),
      prisma.penugasanAkunMarketer.createMany({ data: [...new Set(akunIds)].map(akunId => ({ userId, akunId })) }),
    ])
    return res.json({ success: true, data: { userId, akunIds } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan penugasan')
  }
}

// ── Profil sosial & log harian (milik sendiri) ─────────────────────────────────────────────────────────────
export const getProfil = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const ids = peran.manajer ? (await marketerStudio(studioId)).map(m => m.id) : [req.user.id]
    const baris = await prisma.profilSosialMarketer.findMany({ where: { userId: { in: ids } }, include: { user: { select: { nama: true } } }, orderBy: { createdAt: 'asc' } })
    // AKUN SOSMED & MARKETPLACE STUDIO dari Management Dashboard (SosmedLink.studioId; 12 Nov 2026, keputusan user): BACA-SAJA, hanya untuk pengelola
    // (bukan pemilik lihat-saja), Admin Market & Marketer UNIT INI — tidak untuk talent, unit lain, atau publik. Diubah tetap di Management Dashboard.
    const bolehAkunStudio = (peran.manajer && !peran.lihatSaja) || peran.marketer
    const sosmedStudio = bolehAkunStudio ? await prisma.sosmedLink.findMany({ where: { studioId }, select: { id: true, platform: true, url: true, username: true }, orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }] }) : []
    return res.json({ success: true, data: { akunStudio: sosmedStudio, platform: M.PLATFORM_PROFIL, profil: baris.map(b => ({ id: b.id, userId: b.userId, nama: b.user.nama, platform: b.platform, link: b.link, label: b.label, milikSaya: b.userId === req.user.id })) } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

export const simpanProfil = async (req, res) => {
  try {
    const { studioId, profil } = req.body
    const peran = await akses(req, res, studioId); if (!peran) return
    if (!Array.isArray(profil) || profil.length > 30) return gagal(res, 422, 'Kirim daftar profil (maks 30)')
    for (const p of profil) {
      if (!M.PLATFORM_PROFIL.includes(p?.platform)) return gagal(res, 422, `Platform tidak dikenal: ${p?.platform}`)
      if (!/^https?:\/\/\S+$/i.test(String(p?.link ?? '').trim())) return gagal(res, 422, 'Link profil harus diawali http:// atau https://')
      if (String(p.label ?? '').length > 80) return gagal(res, 422, 'Label maksimal 80 karakter')
    }
    await prisma.$transaction([
      prisma.profilSosialMarketer.deleteMany({ where: { userId: req.user.id } }),
      prisma.profilSosialMarketer.createMany({ data: profil.map(p => ({ userId: req.user.id, platform: p.platform, link: p.link.trim(), label: p.label?.trim() || null })) }),
    ])
    return res.json({ success: true, data: { tersimpan: profil.length } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan profil')
  }
}

export const getLog = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const bt = bulanTahun(req.query); if (!bt) return gagal(res, 422, 'Bulan/tahun tidak valid')
    const baris = await prisma.logHarianMarketer.findMany({ where: { userId: req.user.id, tanggal: { gte: bt.awal, lt: bt.akhir } }, orderBy: { tanggal: 'asc' } })
    return res.json({ success: true, data: { mood: M.MOOD, log: baris.map(b => ({ tanggal: b.tanggal.toISOString().slice(0, 10), mood: b.mood, catatan: b.catatan })) } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// Log suasana hati bersifat PRIBADI: hanya pemiliknya yang membaca & menulis (koordinator tidak ikut melihat).
export const simpanLog = async (req, res) => {
  try {
    const { studioId, mood, catatan } = req.body
    const peran = await akses(req, res, studioId); if (!peran) return
    const tanggal = tgl(req.body.tanggal)
    if (!tanggal) return gagal(res, 422, 'Tanggal wajib (YYYY-MM-DD)')
    if (!M.KUNCI_MOOD.includes(mood)) return gagal(res, 422, 'Suasana hati tidak dikenal')
    if (String(catatan ?? '').length > 500) return gagal(res, 422, 'Catatan maksimal 500 karakter')
    await prisma.logHarianMarketer.upsert({ where: { userId_tanggal: { userId: req.user.id, tanggal } }, update: { mood, catatan: catatan?.trim() || null }, create: { userId: req.user.id, tanggal, mood, catatan: catatan?.trim() || null } })
    return res.json({ success: true, data: { tanggal: req.body.tanggal, mood } })
  } catch {
    return gagal(res, 500, 'Gagal menyimpan log')
  }
}

// ── Prospek (lead) — satu entitas dengan lead Ekosistem ─────────────────────────────────────────────────────────
export const getLead = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const lead = await prisma.marketingLead.findMany({
      where: { studioId, ...(peran.manajer ? saringAkun(peran) : { marketerId: req.user.id }) },
      include: { akun: { select: { namaAkun: true, platform: true } }, marketer: { select: { nama: true } }, order: { select: { status: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    })
    const talent = await talentUnit(studioId) // pilihan talent di isian prospek (sama dengan Tambah order) — nama saja
    const namaTalent = (id) => talent.get(id) ?? null
    const batal = (l) => l.status === 'CONVERTED' && (!l.orderId || l.order?.status === 'BATAL') // ordernya dihapus di Produksi
    return res.json({ success: true, data: { status: STATUS_LEAD, talent: [...talent].map(([id, nama]) => ({ id, nama })), lead: lead.map(l => ({ id: l.id, klien: l.klien, judul: l.judul, tipeKlien: l.tipeKlien, deadline: l.deadline, talentUserId: l.talentUserId, talent: l.talentUserId ? namaTalent(l.talentUserId) : null, namaFreelance: l.namaFreelance, akunId: l.akunId, bisaUbah: (l.status !== 'CONVERTED' || batal(l)) && (peran.manajer || l.marketerId === req.user.id), orderBatal: batal(l), sumber: l.sumber, platform: l.platform, akun: l.akun, kontak: l.kontak, estimasiNilai: l.estimasiNilai, mataUang: l.mataUang ?? 'IDR', nilaiUsd: l.nilaiUsd, kurs: l.kurs, status: l.status, catatan: l.catatan, tanggalMasuk: l.tanggalMasuk, tanggalFollowUpTerakhir: l.tanggalFollowUpTerakhir, marketer: l.marketer?.nama ?? null, orderId: l.orderId })) } })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// Isian prospek yang sama dengan Tambah order (13 Nov 2026, masukan tim). Mengembalikan {data} untuk create/update atau {galat}.
// `sebagian` = PATCH: hanya kunci yang dikirim yang divalidasi/diubah.
const TIPE_KLIEN = ['INTERNAL_EKOSISTEM', 'INTERNAL_JRU_LAIN', 'EKSTERNAL']
async function isianProspek(body, studioId, sebagian = false) {
  const ada = (k) => !sebagian || body[k] !== undefined
  const data = {}
  if (ada('klien')) { if (!String(body.klien ?? '').trim()) return { galat: 'Nama klien wajib diisi' }; if (klienTampakNominal(body.klien)) return { galat: 'Nama klien tampak seperti nominal uang' }; data.klien = String(body.klien).trim() }
  if (ada('judul')) data.judul = String(body.judul ?? '').trim().slice(0, 200) || null
  if (ada('tipeKlien')) data.tipeKlien = TIPE_KLIEN.includes(body.tipeKlien) ? body.tipeKlien : null
  if (ada('platform')) { if (body.platform && !M.PLATFORM_PROFIL.includes(body.platform)) return { galat: 'Platform tidak dikenal' }; data.platform = body.platform || null }
  if (ada('akunId')) {
    const id = body.akunId === 'INTERNAL' ? null : body.akunId
    if (id && !(await prisma.akunProduksi.findFirst({ where: { id, studioId } }))) return { galat: 'Akun bukan milik studio ini' }
    data.akunId = id || null
  }
  if (ada('kontak')) data.kontak = String(body.kontak ?? '').trim() || null
  if (ada('catatan')) data.catatan = String(body.catatan ?? '').trim() || null
  if (ada('deadline')) { const t = tanggalSah(body.deadline); if (t === undefined) return { galat: 'Deadline harus YYYY-MM-DD' }; data.deadline = t }
  if (ada('talentUserId') || ada('namaFreelance')) {
    const t = body.talentUserId || null, f = String(body.namaFreelance ?? '').trim().slice(0, 200) || null
    if (t && f) return { galat: 'Pilih salah satu: talent internal atau freelance' }
    if (t && !(await prisma.userRole.findFirst({ where: { userId: t, studioId } }))) return { galat: 'Talent bukan anggota studio ini' }
    data.talentUserId = t; data.namaFreelance = f
  }
  if (ada('mataUang') || ada('estimasiNilai') || ada('nilaiUsd')) {
    const usd = body.mataUang === 'USD'
    if (usd) { const g = validasiUsd(body); if (g) return { galat: g } }
    const nilai = usd ? rupiahDariUsd(body.nilaiUsd, body.kurs) : body.estimasiNilai == null || body.estimasiNilai === '' ? null : Number(body.estimasiNilai)
    if (nilai != null && !(Number.isFinite(nilai) && nilai >= 0)) return { galat: 'Estimasi nilai harus angka >= 0' }
    Object.assign(data, { estimasiNilai: nilai, mataUang: usd ? 'USD' : null, nilaiUsd: usd ? Number(body.nilaiUsd) : null, kurs: usd ? Number(body.kurs) : null })
  }
  return { data }
}

export const buatLead = async (req, res) => {
  try {
    const { studioId, sumber } = req.body
    const peran = await akses(req, res, studioId); if (!peran) return
    const v = await isianProspek(req.body, studioId); if (v.galat) return gagal(res, 422, v.galat)
    const lead = await prisma.marketingLead.create({ data: { studioId, ...v.data, sumber: sumber?.trim() || null, marketerId: req.user.id } })
    return res.status(201).json({ success: true, data: { id: lead.id } })
  } catch {
    return gagal(res, 500, 'Gagal menambah prospek')
  }
}

async function leadBolehDiubah(req, res) {
  const l = await prisma.marketingLead.findUnique({ where: { id: req.params.id } })
  if (!l) { gagal(res, 404, 'Prospek tidak ditemukan'); return null }
  const peran = await akses(req, res, l.studioId); if (!peran) return null
  if (l.marketerId !== req.user.id && !peran.manajer) { gagal(res, 403, 'Hanya pemilik prospek atau Koordinator ke atas'); return null }
  return l
}

export const ubahLead = async (req, res) => {
  try {
    const l = await leadBolehDiubah(req, res); if (!l) return
    const { status } = req.body
    // Prospek yang ordernya sudah dihapus (BATAL) di Produksi boleh dikembalikan ke kolom lain (13 Nov 2026, masukan tim); tautan order dilepas
    const orderBatal = l.status === 'CONVERTED' && (!l.orderId || (await prisma.orderProduksi.findUnique({ where: { id: l.orderId }, select: { status: true } }))?.status === 'BATAL')
    if (l.status === 'CONVERTED' && !orderBatal) return gagal(res, 409, 'Prospek sudah jadi order — ubah lewat order')
    // Semua isian prospek bisa diubah (13 Nov 2026, masukan tim: salah ketik tidak bisa diperbaiki)
    const v = await isianProspek(req.body, l.studioId, true); if (v.galat) return gagal(res, 422, v.galat)
    const data = { ...v.data }
    if (status != null) {
      if (!STATUS_LEAD.includes(status) || status === 'CONVERTED') return gagal(res, 422, 'Status tidak valid (gunakan "Jadikan order" untuk Converted)')
      data.status = status
      if (['FOLLOW_UP', 'NEGO'].includes(status)) data.tanggalFollowUpTerakhir = new Date()
    }
    if (orderBatal) { if (!data.status) return gagal(res, 422, 'Pindahkan dulu prospek ini ke kolom lain'); data.orderId = null }
    if (Object.keys(data).length === 0) return gagal(res, 422, 'Tidak ada perubahan')
    await prisma.marketingLead.update({ where: { id: l.id }, data })
    return res.json({ success: true, data: { id: l.id } })
  } catch {
    return gagal(res, 500, 'Gagal memperbarui prospek')
  }
}

// HAPUS prospek (16 Nov 2026, masukan tim): untuk salah input — beda dengan Lost (prospek sungguhan yang gagal, ikut dihitung di
// "Jadi order (%)"). Yang sudah jadi order tidak bisa dihapus (rantai prospek↔order), kecuali ordernya sudah dibatalkan.
export const hapusLead = async (req, res) => {
  try {
    const l = await leadBolehDiubah(req, res); if (!l) return
    if (l.status === 'CONVERTED' && l.orderId && (await prisma.orderProduksi.findUnique({ where: { id: l.orderId }, select: { status: true } }))?.status !== 'BATAL') return gagal(res, 409, 'Prospek sudah jadi order — tidak bisa dihapus')
    await prisma.marketingLead.delete({ where: { id: l.id } })
    return res.json({ success: true, message: 'Prospek dihapus' })
  } catch {
    return gagal(res, 500, 'Gagal menghapus prospek')
  }
}

// Prospek → order (masuk Inbox/Queue; marketer tercatat). Rantai prospek↔order dijaga satu arah (orderId unik).
export const jadiOrder = async (req, res) => {
  try {
    const l = await leadBolehDiubah(req, res); if (!l) return
    if (l.status === 'CONVERTED' || l.orderId) return gagal(res, 409, 'Prospek ini sudah jadi order')
    // 13 Nov 2026 (masukan tim): isian prospek (judul, klien, jenis klien, akun, nilai, deadline, talent) TERBAWA — isian di layar
    // Jadikan order hanya menimpa yang dikirim. Klien ditautkan ke direktori Klien & freelance ke data Freelancer, sama dengan Tambah order.
    const b = req.body ?? {}
    const pakai = (k, cad) => (b[k] !== undefined ? b[k] : cad)
    const judul = pakai('judul', l.judul), klien = String(pakai('klien', l.klien) ?? '').trim()
    if (!klien) return gagal(res, 422, 'Nama klien wajib diisi')
    if (klienTampakNominal(klien)) return gagal(res, 422, 'Nama klien tampak seperti nominal uang')
    const asalUsd = b.mataUang !== undefined ? b : (l.mataUang === 'USD' && (b.nilaiDisepakati == null || b.nilaiDisepakati === '') ? { mataUang: 'USD', nilaiUsd: l.nilaiUsd, kurs: l.kurs } : {})
    const usd = asalUsd.mataUang === 'USD'
    if (usd) { const g = validasiUsd(asalUsd); if (g) return gagal(res, 422, g) }
    const nilai = usd ? rupiahDariUsd(asalUsd.nilaiUsd, asalUsd.kurs) : b.nilaiDisepakati == null || b.nilaiDisepakati === '' ? (l.estimasiNilai ?? 0) : Number(b.nilaiDisepakati)
    if (!Number.isFinite(nilai) || nilai < 0) return gagal(res, 422, 'Nilai harus angka >= 0')
    const talentUserId = pakai('talentUserId', l.talentUserId) || null
    const namaFreelance = String(pakai('namaFreelance', l.namaFreelance) ?? '').trim().slice(0, 200)
    if (talentUserId && namaFreelance) return gagal(res, 422, 'Pilih salah satu: talent internal atau freelance')
    if (talentUserId && !(await prisma.userRole.findFirst({ where: { userId: talentUserId, studioId: l.studioId } }))) return gagal(res, 422, 'Talent bukan anggota studio ini')
    const dl = b.deadline !== undefined ? tanggalSah(b.deadline) : l.deadline; if (dl === undefined) return gagal(res, 422, 'Deadline harus YYYY-MM-DD')
    const tipe = TIPE_KLIEN.includes(pakai('tipeKlien', l.tipeKlien)) ? pakai('tipeKlien', l.tipeKlien) : 'EKSTERNAL'
    // Akun jualan wajib (21 Okt 2026): dari isian, atau akun prospek — tidak lagi jatuh diam-diam ke "Order Internal"
    const pilihAkun = await akunUntukOrder(l.studioId, b.akunId ?? l.akunId); if (pilihAkun.galat) return gagal(res, 422, pilihAkun.galat)
    const akunDefault = pilihAkun.akun
    { const pr = await peranStudio(req, l.studioId); if (pr.akunAdmin && !pr.marketer && !pr.akunAdmin.includes(akunDefault.id)) return gagal(res, 403, 'Akun jualan ini bukan tanggung jawabmu — pilih akun yang ditugaskan kepadamu') }
    const [tahap, pengguna] = await Promise.all([pastikanTahap(l.studioId), prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } })])
    const masuk = tahap.find(t => jenisNormal(t.jenis) === 'MASUK')
    const aktifAwal = ['-', ...tahap.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)]
    const klienDir = await tautkanKlien(l.studioId, klien, akunDefault.platform)
    const talentEks = namaFreelance ? { id: await pastikanFreelancer(l.studioId, namaFreelance) } : null
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.orderProduksi.create({
        data: {
          studioId: l.studioId, akunId: akunDefault.id, tipeKlien: tipe, klien: klienDir?.nama ?? klien, klienId: klienDir?.id ?? l.klienId ?? null, judul: String(judul ?? '').trim() || `Order ${klien}`,
          nilaiDisepakati: nilai, nilaiKotor: nilai, nilaiBersih: hitungNilaiBersih(nilai, akunDefault.feePersen),
          ...(usd ? { mataUang: 'USD', kurs: Number(asalUsd.kurs), nilaiUsd: Number(asalUsd.nilaiUsd) } : {}),
          status: 'MASUK', subStatus: masuk.nama, tahapId: masuk.id, tahapAktif: aktifAwal, marketerId: l.marketerId ?? req.user.id,
          deadline: dl ?? null,
          ...(talentUserId ? { assignments: { create: { userId: talentUserId } } } : namaFreelance ? { assignments: { create: { namaEksternal: namaFreelance, tipeEksternal: 'FREELANCER_PERORANGAN', talentEksternalId: talentEks?.id ?? null } } } : {}),
          riwayatTahap: { create: { namaTahap: masuk.nama, jenis: jenisNormal(masuk.jenis), userId: req.user.id, namaPengguna: pengguna?.nama ?? null } },
        },
      })
      await tx.marketingLead.update({ where: { id: l.id }, data: { status: 'CONVERTED', orderId: o.id, klienId: klienDir?.id ?? l.klienId ?? null, tanggalFollowUpTerakhir: new Date() } })
      return o
    })
    try { await catatAudit(order.id, req.user.id, 'BUAT', [{ field: 'order', dari: null, ke: `${order.judul} · ${order.klien} · ${akunDefault.namaAkun} · Rp ${Math.round(nilai)} (dari prospek)` }]) } catch { /* abaikan */ }
    kabarOrderBaru(order.id) // grup Telegram koordinator (12 Nov 2026)
    return res.status(201).json({ success: true, data: { orderId: order.id } })
  } catch {
    return gagal(res, 500, 'Gagal menjadikan order')
  }
}

// ── Insight: corong & efisiensi (acuan MarketingDashboardService; HANYA hitungan, tanpa uang) ───────────────
export const getInsight = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const bt = bulanTahun(req.query); if (!bt) return gagal(res, 422, 'Bulan/tahun tidak valid')
    const marketer = await marketerStudio(studioId)
    const lingkupUser = peran.manajer ? marketer.map(m => m.id) : [req.user.id]
    const [aktivitas, lead, ordersBulan, tahap] = await Promise.all([
      prisma.aktivitasMarketer.findMany({ where: { studioId, userId: { in: lingkupUser }, tanggal: { gte: bt.awal, lt: bt.akhir }, selesai: true }, select: { userId: true, tanggal: true, jenis: true, jumlah: true } }),
      prisma.marketingLead.findMany({ where: { studioId, tanggalMasuk: { gte: bt.awal, lt: bt.akhir }, ...(peran.manajer ? saringAkun(peran) : { marketerId: req.user.id }) }, select: { marketerId: true } }),
      prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: bt.awal, lt: bt.akhir }, ...(peran.manajer ? saringAkun(peran) : { marketerId: req.user.id }) }, select: { id: true, marketerId: true, status: true, tahapId: true, subStatus: true, tahapAktif: true } }),
      pastikanTahap(studioId),
    ])
    const jejak = await riwayatOrder(ordersBulan.map(o => o.id))
    const sampaiKlien = new Set(), terkirim = new Set()
    for (const o of ordersBulan) {
      const riw = jejak.filter(r => r.orderId === o.id).map(r => jenisNormal(r.jenis))
      const sekarang = jenisNormal(tahap.find(t => t.id === tahapEfektif(o, tahap))?.jenis)
      if (riw.some(j => ['PREVIEW_KLIEN', 'DELIVERY', 'SELESAI'].includes(j)) || ['PREVIEW_KLIEN', 'DELIVERY', 'SELESAI'].includes(sekarang) || o.status === 'SELESAI') sampaiKlien.add(o.id)
      if (o.status === 'SELESAI' || riw.includes('DELIVERY') || riw.includes('SELESAI')) terkirim.add(o.id)
    }
    const volume = (arr) => arr.reduce((a, x) => a + Math.max(1, x.jumlah || 1), 0)
    const effort = volume(aktivitas)
    const corong = M.susunCorong({ effort, chat: lead.length, order: ordersBulan.length, preview: sampaiKlien.size, delivery: terkirim.size })
    const harian = {}
    for (const a of aktivitas) { const k = a.tanggal.toISOString().slice(0, 10); harian[k] = (harian[k] ?? 0) + Math.max(1, a.jumlah || 1) }
    const perTahap = Object.fromEntries(Object.keys(M.TAHAP_AKTIVITAS).map(k => [k, 0]))
    for (const a of aktivitas) { const d = M.KATALOG.find(x => x.kunci === a.jenis); if (d) perTahap[d.tahap] += Math.max(1, a.jumlah || 1) }
    const data = { bulan: bt.bulan, tahun: bt.tahun, cakupan: peran.manajer ? 'tim' : 'saya', effort, lajuEffortKeOrder: M.lajuEffortKeOrder(effort, ordersBulan.length), corong, harian: Object.entries(harian).sort().map(([tanggal, nilai]) => ({ tanggal, nilai })), perTahap: Object.entries(perTahap).map(([kunci, nilai]) => ({ kunci, label: M.TAHAP_AKTIVITAS[kunci], nilai })) }
    if (peran.manajer) {
      data.peringkat = M.peringkatEfisiensi(marketer.map(m => ({ userId: m.id, nama: m.nama, effort: volume(aktivitas.filter(a => a.userId === m.id)), chat: lead.filter(l => l.marketerId === m.id).length, order: ordersBulan.filter(o => o.marketerId === m.id).length })))
      data.marketerTanpaAktivitas = marketer.filter(m => volume(aktivitas.filter(a => a.userId === m.id)) === 0).map(m => m.nama)
    }
    return res.json({ success: true, data })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}

// ── DASHBOARD MARKETING lengkap (20 Okt 2026, adaptasi OGS MarketingDashboardService::build) ─────────────────────────────
// Tampilan bulan (seri harian) atau tahun (seri bulanan), filter marketer (manajer), KPI, corong, peringkat efisiensi,
// seri order, aktivitas per tahap, pemenuhan preview/delivery (kali PERTAMA masuk), konversi Effort→Order per bulan.
// Hanya hitungan — tanpa angka uang. Anggota biasa (marketer) hanya melihat datanya sendiri.
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const kunciTgl = (d) => new Date(d).toISOString().slice(0, 10)
const kunciWIB = (d) => new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(0, 10)
export const getDashboard = async (req, res) => {
  try {
    const { studioId } = req.query
    const peran = await akses(req, res, studioId); if (!peran) return
    const bt = bulanTahun(req.query); if (!bt) return gagal(res, 422, 'Bulan/tahun tidak valid')
    const tahunan = req.query.tampilan === 'tahun'
    const awal = tahunan ? new Date(Date.UTC(bt.tahun, 0, 1)) : bt.awal
    const akhir = tahunan ? new Date(Date.UTC(bt.tahun + 1, 0, 1)) : bt.akhir
    const marketer = await marketerStudio(studioId)
    // Marketer di luar daftar yang boleh dilihat diabaikan (angka tak bocor lewat ?marketerId=)
    const filterId = peran.manajer && marketer.some(m => m.id === req.query.marketerId) ? req.query.marketerId : null
    const idDilihat = peran.manajer ? (filterId ? [filterId] : marketer.map(m => m.id)) : [req.user.id]
    const punyaMarketer = { ...(peran.manajer && !filterId ? {} : { marketerId: peran.manajer ? filterId : req.user.id }), ...(peran.manajer ? saringAkun(peran) : {}) }

    const [aktivitas, ordersRentang] = await Promise.all([
      prisma.aktivitasMarketer.findMany({ where: { studioId, userId: { in: idDilihat }, tanggal: { gte: awal, lt: akhir }, selesai: true }, select: { userId: true, tanggal: true, jenis: true, jumlah: true } }),
      prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir }, ...punyaMarketer }, select: { id: true, marketerId: true, tanggalMasuk: true } }),
    ])
    const lead = await prisma.marketingLead.findMany({ where: { studioId, tanggalMasuk: { gte: awal, lt: akhir }, ...punyaMarketer }, select: { marketerId: true } })
    const vol = (a) => Math.max(1, a.jumlah || 1)
    const tahapDari = (jenis) => M.KATALOG.find(x => x.kunci === jenis)?.tahap

    // pemenuhan: kali pertama order (milik marketer terpilih) memasuki fase Klien / Delivery
    const idOrderTerlihat = await prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, ...punyaMarketer }, select: { id: true } })
    const riwayat = idOrderTerlihat.length ? await prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: idOrderTerlihat.map(o => o.id) }, jenis: { in: ['PREVIEW_KLIEN', 'PREVIEW', 'DELIVERY', 'SELESAI'] }, mulai: { lt: akhir } }, orderBy: { mulai: 'asc' }, select: { orderId: true, jenis: true, mulai: true } }) : []
    const pertama = { preview: new Map(), delivery: new Map() }
    for (const r of riwayat) {
      const j = jenisNormal(r.jenis)
      const kel = j === 'PREVIEW_KLIEN' ? 'preview' : 'delivery'
      if (!pertama[kel].has(r.orderId)) pertama[kel].set(r.orderId, r.mulai)
    }
    const dalam = (t) => t >= awal && t < akhir
    const previewTgl = [...pertama.preview.values()].filter(dalam), deliveryTgl = [...pertama.delivery.values()].filter(dalam)

    // kerangka periode
    const periode = []
    if (tahunan) for (let m = 0; m < 12; m++) periode.push(`${bt.tahun}-${String(m + 1).padStart(2, '0')}`)
    else for (let d = 1; d <= M.hariDalamBulan(bt.bulan, bt.tahun); d++) periode.push(`${bt.tahun}-${String(bt.bulan).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    const kunciP = (t, wib = false) => (tahunan ? (wib ? kunciWIB(t) : kunciTgl(t)).slice(0, 7) : (wib ? kunciWIB(t) : kunciTgl(t)))
    const seri = Object.fromEntries(periode.map(k => [k, { kunci: k, order: 0, publish: 0, engage: 0, network: 0, optimize: 0, preview: 0, delivery: 0 }]))
    for (const o of ordersRentang) { const e = seri[kunciP(o.tanggalMasuk, true)]; if (e) e.order += 1 }
    for (const a of aktivitas) { const e = seri[kunciP(a.tanggal)], t = tahapDari(a.jenis); if (e && t) e[t] += vol(a) }
    for (const t of previewTgl) { const e = seri[kunciP(t, true)]; if (e) e.preview += 1 }
    for (const t of deliveryTgl) { const e = seri[kunciP(t, true)]; if (e) e.delivery += 1 }

    const effort = aktivitas.reduce((s, a) => s + vol(a), 0)
    const corong = M.susunCorong({ effort, chat: lead.length, order: ordersRentang.length, preview: previewTgl.length, delivery: deliveryTgl.length })
    const perTahap = Object.fromEntries(Object.keys(M.TAHAP_AKTIVITAS).map(k => [k, aktivitas.filter(a => tahapDari(a.jenis) === k).reduce((s, a) => s + vol(a), 0)]))
    const data = {
      tampilan: tahunan ? 'tahun' : 'bulan', bulan: bt.bulan, tahun: bt.tahun, cakupan: peran.manajer ? (filterId ? 'marketer' : 'tim') : 'saya',
      marketer: peran.manajer ? marketer.map(m => ({ id: m.id, nama: m.nama })) : [], marketerId: filterId,
      kpi: { order: ordersRentang.length, effort, chat: lead.length, preview: previewTgl.length, delivery: deliveryTgl.length, ...perTahap },
      corong, lajuEffortKeOrder: M.lajuEffortKeOrder(effort, ordersRentang.length),
      seri: periode.map(k => seri[k]),
      catatanBaca: [
        'Aktivitas tinggi, Order rendah → sudah banyak promosi/chat, tapi jarang berhasil deal.',
        'Chat tinggi, Order rendah → banyak ngobrol, jarang jadi order.',
        'Order tinggi, Preview/Delivery rendah → pekerjaan tertahan setelah deal (cek produksi).',
        'Peringkat: siapa paling sedikit aktivitas per order (bukan siapa paling sibuk).',
      ],
    }
    if (tahunan) {
      const bulananEffort = Array(12).fill(0), bulananOrder = Array(12).fill(0)
      for (const a of aktivitas) bulananEffort[a.tanggal.getUTCMonth()] += vol(a)
      for (const o of ordersRentang) bulananOrder[new Date(o.tanggalMasuk.getTime() + 7 * 3600000).getUTCMonth()] += 1
      const w = sekarangWIB(), bulanIni = w.getUTCFullYear() === bt.tahun ? w.getUTCMonth() : (bt.tahun < w.getUTCFullYear() ? 11 : -1)
      const bln = NAMA_BLN.map((label, i) => ({ bulan: i + 1, label, effort: bulananEffort[i], order: bulananOrder[i], laju: M.lajuEffortKeOrder(bulananEffort[i], bulananOrder[i]), mendatang: i > bulanIni }))
      const berlaju = bln.filter(b => b.laju != null)
      data.konversiTahunan = { tahun: bt.tahun, rataRata: berlaju.length ? Math.round((berlaju.reduce((s, b) => s + b.laju, 0) / berlaju.length) * 10) / 10 : null, bulan: bln }
    }
    if (peran.manajer) {
      const dm = await prisma.aktivitasMarketer.findMany({ where: { studioId, userId: { in: marketer.map(m => m.id) }, tanggal: { gte: awal, lt: akhir }, selesai: true }, select: { userId: true, jenis: true, jumlah: true } })
      const orderPerOrang = await prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir }, marketerId: { in: marketer.map(m => m.id) } }, select: { marketerId: true } })
      const leadPerOrang = await prisma.marketingLead.findMany({ where: { studioId, tanggalMasuk: { gte: awal, lt: akhir }, marketerId: { in: marketer.map(m => m.id) } }, select: { marketerId: true } })
      const baris = marketer.map(m => {
        const a = dm.filter(x => x.userId === m.id)
        return { userId: m.id, nama: m.nama, effort: a.reduce((s, x) => s + vol(x), 0), chat: leadPerOrang.filter(l => l.marketerId === m.id).length, order: orderPerOrang.filter(o => o.marketerId === m.id).length,
          ...Object.fromEntries(Object.keys(M.TAHAP_AKTIVITAS).map(k => [k, a.filter(x => tahapDari(x.jenis) === k).reduce((s, x) => s + vol(x), 0)])) }
      })
      data.peringkat = M.peringkatEfisiensi(baris)
      data.perMarketer = baris.sort((a, b) => b.effort - a.effort || a.nama.localeCompare(b.nama, 'id'))
    }
    return res.json({ success: true, data })
  } catch {
    return gagal(res, 500, 'Terjadi kesalahan, coba lagi')
  }
}
