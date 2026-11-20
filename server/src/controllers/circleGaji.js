import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { peranKerja, studioBolehDilihat } from './circle.js'
import { hitungThp } from '../utils/payroll.js'
import { hitungLembur } from '../utils/lembur.js'
import { hariKhususPeriode, lemburPresensiUnit } from './payroll.js'

// PENGGAJIAN di web circle (10 Nov 2026, keputusan user): gaji dikelola koordinator di web circle; Management Dashboard hanya untuk pemantauan (Super Admin).
// THP di Bio studio = TOTAL; koordinator memecahnya jadi RINCIAN TETAP (komponen) satu kali — gaji pokok = THP Bio − Σ komponen, jadi total tetap = THP Bio.
// Tiap bulan: "Siapkan slip" (gaji pokok + komponen tetap + lembur presensi otomatis) → koordinator menambah bonus/komisi/potongan/baris tambahan → Final → Dibayar.
// Akses (disetujui user): koordinator/pendamping unit ini atau atasannya (Kepala Circle/RU, Super Admin) melihat & mengelola unit itu; anggota hanya slipnya sendiri
// (setelah Final); admin market & pemilik unit TIDAK melihat gaji. Slip dapat dicetak/diunduh PDF dari peramban.
const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const r0 = (n) => Math.round(Number(n) || 0)
const HARI_GAJIAN = 27 // gajian tiap tanggal 27 (permintaan tim 12 Nov 2026); koordinator dapat mengubah per slip
const tglIso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const tglOk = (v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') && !isNaN(new Date(v + 'T00:00:00Z')))
const dt = (v) => (v ? new Date(v + 'T00:00:00.000Z') : null)

async function izinUnit(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan unit dalam wewenangmu'); return false }
  if (!(await kelolaStudio(peranKerja(req), studioId))) { gagal(res, 403, 'Penggajian hanya untuk Koordinator/Pendamping unit ini atau atasannya'); return false }
  return true
}
function periode(b, t) {
  const bulan = Number(b), tahun = Number(t)
  if (!(bulan >= 1 && bulan <= 12 && tahun >= 2020 && tahun <= 2100)) return null
  return { bulan, tahun, awal: new Date(Date.UTC(tahun, bulan - 1, 1)), akhir: new Date(Date.UTC(tahun, bulan, 1)), label: `${BULAN[bulan - 1]} ${tahun}` }
}
async function thpBio(studioId) {
  const rows = await prisma.userRole.findMany({ where: { studioId }, select: { userId: true, takeHomePay: true }, orderBy: { takeHomePay: { sort: 'desc', nulls: 'last' } } })
  const m = new Map(); for (const r of rows) if (!m.has(r.userId)) m.set(r.userId, r.takeHomePay ?? 0)
  return m
}
async function anggotaUnit(studioId) {
  const rows = await prisma.userRole.findMany({ where: { studioId, user: { statusAktif: true } }, select: { user: { select: { id: true, nama: true, posisi: true } } } })
  const m = new Map(); for (const r of rows) m.set(r.user.id, r.user)
  return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}
const jumlahRincian = (arr) => arr.reduce((s, x) => s + x.jumlah, 0)
const totalTunjangan = async (penggajianId) => (await prisma.tunjanganPenggajian.aggregate({ where: { penggajianId }, _sum: { jumlah: true } }))._sum.jumlah ?? 0
async function hitungUlangThp(id) {
  const p = await prisma.penggajian.findUnique({ where: { id } })
  return prisma.penggajian.update({ where: { id }, data: { thp: hitungThp(p, await totalTunjangan(id)) } })
}
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null

// ── Daftar ──────────────────────────────────────────────────────────────────────────────────────────
export const getGaji = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await izinUnit(req, res, studioId))) return
  const d = new Date(Date.now() + 7 * 3600000)
  const p = periode(req.query.bulan ?? d.getUTCMonth() + 1, req.query.tahun ?? d.getUTCFullYear()); if (!p) return gagal(res, 422, 'bulan (1–12) & tahun tidak valid')
  const [bio, anggota, rincianAll, slips] = await Promise.all([
    thpBio(studioId), anggotaUnit(studioId),
    prisma.rincianGajiTetap.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { nama: 'asc' }] }),
    prisma.penggajian.findMany({ where: { studioId, bulan: p.bulan, tahun: p.tahun }, include: { tunjangan: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, nama: true, posisi: true } } } }),
  ])
  const slipPer = new Map(slips.map(s => [s.userId, s]))
  const orang = new Map(anggota.map(a => [a.id, a])); for (const s of slips) if (!orang.has(s.userId)) orang.set(s.userId, s.user)
  const baris = [...orang.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id')).map(a => {
    const thp = bio.get(a.id) ?? 0, rincian = rincianAll.filter(x => x.userId === a.id), s = slipPer.get(a.id), sum = jumlahRincian(rincian)
    return {
      userId: a.id, nama: a.nama, posisi: a.posisi, thpBio: thp, rincian: rincian.map(x => ({ id: x.id, nama: x.nama, jumlah: x.jumlah })), jumlahRincian: sum, gajiPokokDasar: thp - sum, rincianMelebihi: sum > thp,
      slip: s ? { id: s.id, status: s.status, gajiPokok: s.gajiPokok, bonus: s.bonus, komisi: s.komisi, shu: s.shu, lembur: s.lembur, potongan: s.potongan, thp: s.thp, catatan: s.catatan, dilaporkanOleh: s.dilaporkanOleh, tanggalBayar: tglIso(s.tanggalBayar), tanggalBayarShu: tglIso(s.tanggalBayarShu),
        baris: s.tunjangan.map(t => ({ id: t.id, nama: t.nama, jumlah: t.jumlah, tetap: !!t.rincianId })), perluSegarkan: s.status === 'DRAFT' && (Math.abs(s.gajiPokok - Math.max(0, thp - sum)) > 0.5) } : null,
    }
  })
  const adaSlip = baris.filter(b => b.slip)
  return res.json({ success: true, data: {
    periode: { bulan: p.bulan, tahun: p.tahun, label: p.label },
    peringatan: { tanpaThp: baris.filter(b => !b.thpBio && !b.slip).map(b => b.nama), rincianMelebihi: baris.filter(b => b.rincianMelebihi).map(b => b.nama), perluSegarkan: adaSlip.filter(b => b.slip.perluSegarkan).map(b => b.nama), belumSlip: baris.filter(b => !b.slip && b.thpBio > 0).length },
    ringkas: { slip: adaSlip.length, draft: adaSlip.filter(b => b.slip.status === 'DRAFT').length, final: adaSlip.filter(b => b.slip.status === 'FINAL').length, dibayar: adaSlip.filter(b => b.slip.status === 'DIBAYAR').length, totalThp: adaSlip.reduce((s, b) => s + b.slip.thp, 0) },
    baris,
  } })
})

// ── Rincian tetap per orang ─────────────────────────────────────────────────────────────────────────
export const simpanRincian = wrap(async (req, res) => {
  const { studioId, userId } = req.body ?? {}
  if (!(await izinUnit(req, res, studioId))) return
  if (!userId || !(await prisma.userRole.findFirst({ where: { studioId, userId } }))) return gagal(res, 422, 'Orang itu bukan anggota unit ini')
  const thp = (await thpBio(studioId)).get(userId) ?? 0
  if (!(thp > 0)) return gagal(res, 422, 'THP orang ini belum diisi di Bio studio (isi dulu di Management Dashboard → Bio studio)')
  const masuk = Array.isArray(req.body?.komponen) ? req.body.komponen : []
  if (masuk.length > 12) return gagal(res, 422, 'Maksimal 12 komponen')
  const rapi = [], nama = new Set()
  for (const [i, x] of masuk.entries()) {
    const n = String(x?.nama ?? '').trim().slice(0, 60), j = Number(x?.jumlah)
    if (!n) return gagal(res, 422, `Komponen ${i + 1}: nama wajib diisi`)
    if (nama.has(n.toLowerCase())) return gagal(res, 422, `Komponen "${n}" dobel`)
    nama.add(n.toLowerCase())
    if (!Number.isFinite(j) || j <= 0 || j > 1000000000) return gagal(res, 422, `Komponen "${n}": jumlah harus angka > 0`)
    rapi.push({ studioId, userId, nama: n, jumlah: r0(j), urutan: i })
  }
  const sum = jumlahRincian(rapi)
  if (sum > thp) return gagal(res, 422, `Total komponen (Rp ${sum.toLocaleString('id-ID')}) melebihi THP di Bio (Rp ${thp.toLocaleString('id-ID')}). Gaji pokok = THP − komponen, jadi komponen tak boleh lebih besar.`)
  await prisma.$transaction([prisma.rincianGajiTetap.deleteMany({ where: { studioId, userId } }), ...(rapi.length ? [prisma.rincianGajiTetap.createMany({ data: rapi })] : [])])
  return res.json({ success: true, data: { thpBio: thp, jumlahRincian: sum, gajiPokokDasar: thp - sum }, message: 'Rincian disimpan. Klik "Siapkan slip" untuk menerapkannya ke slip bulan ini.' })
})

// ── Siapkan / segarkan slip bulan ini ───────────────────────────────────────────────────────────────
async function siapkanSatu({ userId, studioId, p, thp, rincian, aturan, hk, lemburBerbayar, oleh }) {
  const sum = jumlahRincian(rincian), gajiPokok = Math.max(0, thp - sum)
  const ada = await prisma.penggajian.findUnique({ where: { userId_studioId_bulan_tahun: { userId, studioId, bulan: p.bulan, tahun: p.tahun } } })
  if (ada && ada.status !== 'DRAFT') return { lewati: `sudah berstatus ${ada.status}` }
  if (sum > thp) return { lewati: 'rincian melebihi THP di Bio — perbaiki rincian dulu' }
  const presensi = lemburBerbayar ? await lemburPresensiUnit(userId, studioId, p.awal, p.akhir, { penggajianId: null }) : []
  const sudah = presensi.length && ada ? await prisma.lemburKehadiran.findMany({ where: { penggajianId: ada.id } }) : []
  const tambahLembur = presensi.length ? hitungLembur([...sudah, ...presensi], aturan, hk).uang - hitungLembur(sudah, aturan, hk).uang : 0
  let id, baru = false
  if (ada) { id = ada.id; await prisma.penggajian.update({ where: { id }, data: { gajiPokok, lembur: ada.lembur + tambahLembur, ...(ada.tanggalBayar ? {} : { tanggalBayar: new Date(Date.UTC(p.tahun, p.bulan - 1, HARI_GAJIAN)) }) } }); await prisma.tunjanganPenggajian.deleteMany({ where: { penggajianId: id, rincianId: { not: null } } }) }
  else { const s = await prisma.penggajian.create({ data: { userId, studioId, bulan: p.bulan, tahun: p.tahun, gajiPokok, lembur: tambahLembur, thp: 0, dilaporkanOleh: oleh, tanggalBayar: new Date(Date.UTC(p.tahun, p.bulan - 1, HARI_GAJIAN)) } }); id = s.id; baru = true }
  if (rincian.length) await prisma.tunjanganPenggajian.createMany({ data: rincian.map(x => ({ penggajianId: id, rincianId: x.id, nama: x.nama, jumlah: x.jumlah })) })
  if (presensi.length) await prisma.lemburKehadiran.updateMany({ where: { id: { in: presensi.map(x => x.id) } }, data: { penggajianId: id } })
  await hitungUlangThp(id)
  return { baru }
}
export const siapkanSlip = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await izinUnit(req, res, studioId))) return
  const p = periode(req.body?.bulan, req.body?.tahun); if (!p) return gagal(res, 422, 'bulan (1–12) & tahun tidak valid')
  const [bio, anggota, rincianAll, aturan, oleh] = await Promise.all([thpBio(studioId), anggotaUnit(studioId), prisma.rincianGajiTetap.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }] }), prisma.pengaturanLembur.findUnique({ where: { studioId } }), namaPengguna(req)])
  const lemburBerbayar = hitungLembur([], aturan).adaTarif
  const hk = lemburBerbayar ? await hariKhususPeriode(p.awal, p.akhir) : new Map()
  let dibuat = 0, disegarkan = 0; const dilewati = []
  for (const a of anggota) {
    const thp = bio.get(a.id) ?? 0
    if (!(thp > 0)) { dilewati.push({ nama: a.nama, alasan: 'THP di Bio belum diisi' }); continue }
    const r = await siapkanSatu({ userId: a.id, studioId, p, thp, rincian: rincianAll.filter(x => x.userId === a.id), aturan, hk, lemburBerbayar, oleh })
    if (r.lewati) dilewati.push({ nama: a.nama, alasan: r.lewati }); else if (r.baru) dibuat++; else disegarkan++
  }
  return res.json({ success: true, data: { dibuat, disegarkan, dilewati }, message: `Slip ${p.label}: ${dibuat} dibuat, ${disegarkan} disegarkan${dilewati.length ? `, ${dilewati.length} dilewati` : ''}` })
})

// ── Edit slip DRAFT ─────────────────────────────────────────────────────────────────────────────────
async function muatSlip(req, res, id, { harusDraft = true } = {}) {
  const s = await prisma.penggajian.findUnique({ where: { id } })
  if (!s) { gagal(res, 404, 'Slip tidak ditemukan'); return null }
  if (!(await izinUnit(req, res, s.studioId))) return null
  if (harusDraft && s.status !== 'DRAFT') { gagal(res, 409, 'Hanya slip berstatus DRAFT yang bisa diubah (buka kembali dulu bila perlu)'); return null }
  return s
}
export const ubahSlip = wrap(async (req, res) => {
  const s = await muatSlip(req, res, req.params.id); if (!s) return
  const data = {}
  for (const k of ['bonus', 'komisi', 'shu', 'potongan']) { if (req.body?.[k] === undefined) continue; const n = Number(req.body[k]); if (!Number.isFinite(n) || n < 0 || n > 10000000000) return gagal(res, 422, `${k} harus angka ≥ 0`); data[k] = r0(n) }
  if (req.body?.catatan !== undefined) data.catatan = req.body.catatan ? String(req.body.catatan).slice(0, 500) : null
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  await prisma.penggajian.update({ where: { id: s.id }, data }); await hitungUlangThp(s.id)
  return res.json({ success: true, message: 'Slip diperbarui' })
})
export const tambahBaris = wrap(async (req, res) => {
  const s = await muatSlip(req, res, req.params.id); if (!s) return
  const nama = String(req.body?.nama ?? '').trim().slice(0, 60), j = Number(req.body?.jumlah)
  if (!nama) return gagal(res, 422, 'Nama baris wajib diisi')
  if (!Number.isFinite(j) || j <= 0 || j > 10000000000) return gagal(res, 422, 'Jumlah harus angka > 0')
  await prisma.tunjanganPenggajian.create({ data: { penggajianId: s.id, nama, jumlah: r0(j) } }); await hitungUlangThp(s.id)
  return res.status(201).json({ success: true, message: 'Baris ditambahkan' })
})
async function muatBaris(req, res) {
  const b = await prisma.tunjanganPenggajian.findUnique({ where: { id: req.params.barisId } })
  if (!b) { gagal(res, 404, 'Baris tidak ditemukan'); return null }
  const s = await muatSlip(req, res, b.penggajianId); if (!s) return null
  if (b.rincianId) { gagal(res, 409, 'Baris ini berasal dari rincian tetap — ubah lewat Rincian orang tersebut, lalu Siapkan slip'); return null }
  return { b, s }
}
export const ubahBaris = wrap(async (req, res) => {
  const d = await muatBaris(req, res); if (!d) return
  const data = {}
  if (req.body?.nama !== undefined) { const n = String(req.body.nama).trim().slice(0, 60); if (!n) return gagal(res, 422, 'Nama baris wajib diisi'); data.nama = n }
  if (req.body?.jumlah !== undefined) { const j = Number(req.body.jumlah); if (!Number.isFinite(j) || j <= 0 || j > 10000000000) return gagal(res, 422, 'Jumlah harus angka > 0'); data.jumlah = r0(j) }
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  await prisma.tunjanganPenggajian.update({ where: { id: d.b.id }, data }); await hitungUlangThp(d.s.id)
  return res.json({ success: true, message: 'Baris diperbarui' })
})
export const hapusBaris = wrap(async (req, res) => {
  const d = await muatBaris(req, res); if (!d) return
  await prisma.tunjanganPenggajian.delete({ where: { id: d.b.id } }); await hitungUlangThp(d.s.id)
  return res.json({ success: true, message: 'Baris dihapus' })
})

// ── Status: Final → Dibayar ─────────────────────────────────────────────────────────────────────────
export const finalSlip = wrap(async (req, res) => {
  const s = await muatSlip(req, res, req.params.id); if (!s) return
  await prisma.penggajian.update({ where: { id: s.id }, data: { status: 'FINAL', dilaporkanOleh: await namaPengguna(req) } })
  return res.json({ success: true, message: 'Slip difinalkan — kini terlihat oleh yang bersangkutan' })
})
export const finalSemua = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await izinUnit(req, res, studioId))) return
  const p = periode(req.body?.bulan, req.body?.tahun); if (!p) return gagal(res, 422, 'bulan (1–12) & tahun tidak valid')
  const r = await prisma.penggajian.updateMany({ where: { studioId, bulan: p.bulan, tahun: p.tahun, status: 'DRAFT' }, data: { status: 'FINAL', dilaporkanOleh: await namaPengguna(req) } })
  return res.json({ success: true, data: { jumlah: r.count }, message: `${r.count} slip difinalkan` })
})
// Tanggal gajian & tanggal SHU (12 Nov 2026): boleh diubah selama slip belum DIBAYAR
export const ubahTanggal = wrap(async (req, res) => {
  const s = await muatSlip(req, res, req.params.id, { harusDraft: false }); if (!s) return
  if (s.status === 'DIBAYAR') return gagal(res, 409, 'Slip yang sudah dibayar tidak bisa diubah tanggalnya')
  const data = {}
  for (const [k, f] of [['tanggalBayar', 'tanggalBayar'], ['tanggalBayarShu', 'tanggalBayarShu']]) {
    if (req.body?.[k] === undefined) continue
    const v = req.body[k] === '' ? null : req.body[k]
    if (!tglOk(v)) return gagal(res, 422, `${k} harus YYYY-MM-DD`)
    if (k === 'tanggalBayar' && !v) return gagal(res, 422, 'Tanggal gajian tidak boleh kosong')
    data[f] = dt(v)
  }
  if (!Object.keys(data).length) return gagal(res, 422, 'Tidak ada yang diubah')
  await prisma.penggajian.update({ where: { id: s.id }, data })
  return res.json({ success: true, message: 'Tanggal disimpan' })
})
export const bukaSlip = wrap(async (req, res) => {
  const s = await muatSlip(req, res, req.params.id, { harusDraft: false }); if (!s) return
  if (s.status !== 'FINAL') return gagal(res, 409, 'Hanya slip FINAL yang bisa dibuka kembali (yang sudah dibayar tidak bisa)')
  await prisma.penggajian.update({ where: { id: s.id }, data: { status: 'DRAFT' } })
  return res.json({ success: true, message: 'Slip dibuka kembali ke DRAFT' })
})
export const bayarSlip = wrap(async (req, res) => {
  const s = await muatSlip(req, res, req.params.id, { harusDraft: false }); if (!s) return
  if (s.status !== 'FINAL') return gagal(res, 409, 'Hanya slip FINAL yang bisa ditandai dibayar')
  const tgl = req.body?.tanggalBayar || null
  if (tgl && !tglOk(tgl)) return gagal(res, 422, 'tanggalBayar harus YYYY-MM-DD')
  await prisma.penggajian.update({ where: { id: s.id }, data: { status: 'DIBAYAR', dikonfirmasiOleh: await namaPengguna(req), buktiBayar: req.body?.bukti ? String(req.body.bukti).slice(0, 300) : null, ...(tgl ? { tanggalBayar: dt(tgl) } : {}) } })
  return res.json({ success: true, message: 'Slip ditandai dibayar' })
})

// ── Data slip untuk cetak / PDF ─────────────────────────────────────────────────────────────────────
export const getSlipCetak = wrap(async (req, res) => {
  const s = await prisma.penggajian.findUnique({ where: { id: req.params.id }, include: { user: { select: { nama: true, posisi: true } }, studio: { select: { nama: true, circle: { select: { nama: true } }, rumahUsaha: { select: { nama: true } } } }, tunjangan: { orderBy: { createdAt: 'asc' } }, lemburPresensi: { select: { menit: true, tanggalKerja: true } } } })
  if (!s) return gagal(res, 404, 'Slip tidak ditemukan')
  const pengelola = await kelolaStudio(peranKerja(req), s.studioId)
  const miliknya = s.userId === req.user.id
  if (!pengelola && !miliknya) return gagal(res, 403, 'Tidak punya akses ke slip ini')
  if (!pengelola && s.status === 'DRAFT') return gagal(res, 403, 'Slip belum difinalkan')
  const hari = new Set(s.lemburPresensi.map(x => x.tanggalKerja.toISOString().slice(0, 10))).size, menit = s.lemburPresensi.reduce((a, x) => a + x.menit, 0)
  return res.json({ success: true, data: {
    id: s.id, status: s.status, periode: `${BULAN[s.bulan - 1]} ${s.tahun}`, studio: s.studio.nama, induk: s.studio.circle?.nama ?? s.studio.rumahUsaha?.nama ?? null,
    nama: s.user.nama, posisi: s.user.posisi, gajiPokok: s.gajiPokok, tetap: s.tunjangan.filter(t => t.rincianId).map(t => ({ nama: t.nama, jumlah: t.jumlah })), tambahan: s.tunjangan.filter(t => !t.rincianId).map(t => ({ nama: t.nama, jumlah: t.jumlah })),
    bonus: s.bonus, komisi: s.komisi, shu: s.shu, lembur: s.lembur, lemburMenit: menit, lemburHari: hari, potongan: s.potongan, thp: s.thp, catatan: s.catatan, dilaporkanOleh: s.dilaporkanOleh, tanggalBayar: tglIso(s.tanggalBayar), tanggalBayarShu: tglIso(s.tanggalBayarShu),
  } })
})
