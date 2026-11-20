import prisma from '../prisma.js'
import { JENIS_KERJA, pilihKandidat, sarankan } from './penugasan.js'
import { jenisNormal } from './alur.js'

// Sinkronisasi penugasan per tahap dengan perpindahan tahap order (dipanggil dari terapkanPindah di controllers/circle.js).
export const bebanAktif = async (userIds) => {
  if (!userIds.length) return new Map()
  const g = await prisma.penugasanTahap.groupBy({ by: ['userId'], where: { userId: { in: userIds }, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, _count: true })
  return new Map(g.map(x => [x.userId, x._count]))
}
// TALENT unit (12 Nov 2026, permintaan tim): pilihan orang untuk dikerjakan order (Buat order & Tim order). Peran kerja saja
// (Koordinator/Kader/Karyawan/Magang — tanpa Pendamping/Penasihat/Admin fungsional/Kepala), dan bila unit sudah mengonfirmasi Fungsi anggota
// (Tim → Fungsi), hanya yang berfungsi ARTIST. Unit yang belum mengatur Fungsi tetap melihat semua peran kerja.
export const PERAN_KERJA_TALENT = ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG']
export async function talentUnit(studioId) {
  const [peran, artist] = await Promise.all([
    prisma.userRole.findMany({ where: { studioId, roleType: { in: PERAN_KERJA_TALENT }, user: { statusAktif: true } }, select: { user: { select: { id: true, nama: true } } } }),
    prisma.fungsiAnggota.findMany({ where: { studioId, fungsi: 'ARTIST', terkonfirmasi: true }, select: { userId: true } }),
  ])
  const peta = new Map(); for (const p of peran) peta.set(p.user.id, p.user.nama)
  const ids = new Set(artist.map(a => a.userId).filter(id => peta.has(id)))
  const hasil = ids.size ? [...peta].filter(([id]) => ids.has(id)) : [...peta]
  return new Map(hasil.sort((a, b) => a[1].localeCompare(b[1], 'id'))) // userId → nama
}
export async function anggotaStudio(studioId) {
  const peran = await prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { user: { select: { id: true, nama: true } } } })
  const peta = new Map(); for (const p of peran) peta.set(p.user.id, p.user.nama)
  return peta // userId → nama
}
export async function kandidatDb(order, tahap) {
  const [kt, kg, anggota] = await Promise.all([
    prisma.keahlianTahap.findMany({ where: { studioId: order.studioId } }),
    prisma.keahlianGenre.findMany({ where: { studioId: order.studioId } }),
    anggotaStudio(order.studioId),
  ])
  const aktif = (id) => anggota.has(id)
  const beban = await bebanAktif([...anggota.keys()])
  return { anggota, beban, userId: pilihKandidat({ kesulitan: order.kesulitan, genre: order.genre, tahapId: tahap.id, akunId: order.akunId, keahlianTahap: kt.filter(k => aktif(k.userId)), keahlianGenre: kg.filter(k => aktif(k.userId)), beban, nama: anggota }), keahlianTahap: kt, keahlianGenre: kg }
}
export async function saranDb(order, tahap, batas = 2) {
  const { anggota, beban, keahlianTahap, keahlianGenre } = await kandidatDb(order, tahap)
  const perlu = { MUDAH: 1, SEDANG: 2, SULIT: 3 }[order.kesulitan] ?? 0
  const rank = (m) => ({ MUDAH: 1, SEDANG: 2, SULIT: 3 }[m] ?? 0)
  const kompetenIds = keahlianTahap.filter(k => k.tahapId === tahap.id && (k.akunId == null || k.akunId === order.akunId) && rank(k.maksKesulitan) >= perlu && anggota.has(k.userId)).map(k => k.userId)
  const sebelumnya = await prisma.penugasanTahap.findFirst({ where: { orderId: order.id, tahapId: { not: tahap.id } }, orderBy: { selesaiPada: 'desc' }, select: { userId: true } })
  const bebanSemua = new Map([...anggota.keys()].map(id => [id, beban.get(id) ?? 0]))
  return sarankan({ kompetenIds, sebelumnyaId: sebelumnya && anggota.has(sebelumnya.userId) ? sebelumnya.userId : null, beban: bebanSemua, nama: anggota, batas }).map(id => ({ userId: id, nama: anggota.get(id), antrean: bebanSemua.get(id) ?? 0 }))
}

export async function buatBarisTahap({ order, tahap, userId, pengguna, otomatis = false, tunda = false }) {
  const ada = await prisma.penugasanTahap.findFirst({ where: { orderId: order.id, tahapId: tahap.id, userId, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, select: { id: true } })
  if (ada) return ada
  return prisma.penugasanTahap.create({ data: { orderId: order.id, tahapId: tahap.id, namaTahap: tahap.nama, jenisTahap: jenisNormal(tahap.jenis), userId, status: 'DIKERJAKAN', mulaiPada: new Date(), ditugaskanOleh: pengguna ?? null, otomatis, tunda: !!tunda } })
}

// tunda (12 Nov 2026, masukan tim): admin memindah kartu tapi pekerjaan BUKAN untuk hari ini → baris baru dibuat ditunda (tidak masuk Antreanku)
export async function sinkronPenugasanTahap({ order, tujuan, pengguna, tunda = false, manual = false }) {
  const sekarang = new Date()
  const jt = jenisNormal(tujuan.jenis)
  // tutup baris yang bukan milik tahap tujuan (termasuk loncatan manual); order SELESAI menutup semuanya
  // Ke HOLD (12 Nov 2026, laporan tim): pekerjaan DIJEDA, bukan selesai → baris ditutup 'DITUTUP' (tidak masuk Tugas selesai / kontribusi);
  // saat order dilanjutkan ke tahap kerja, baris baru dibuat lagi oleh buatBarisTahap.
  // PINDAH MANUAL (13 Nov 2026, laporan tim): admin memindah kartu MUNDUR / ke Inbox / ke tahap yang tidak sesudahnya = pekerjaan talent
  // belum tuntas → 'DITUTUP' (tidak masuk Tugas selesai). Hanya loncatan MAJU (tahap tujuan sesudah tahap baris) atau ke Selesai yang dihitung selesai.
  const tutup = jt === 'HOLD' ? { status: 'DITUTUP' } : { status: 'SELESAI', progres: 100, selesaiPada: sekarang }
  const whereTutup = { orderId: order.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, ...(jt === 'SELESAI' ? {} : { OR: [{ tahapId: { not: tujuan.id } }, { tahapId: null }] }) }
  if (manual && jt !== 'SELESAI' && jt !== 'HOLD') {
    const aktif = await prisma.penugasanTahap.findMany({ where: whereTutup, select: { id: true, tahap: { select: { urutan: true } } } })
    const maju = aktif.filter(b => b.tahap && b.tahap.urutan < tujuan.urutan).map(b => b.id)
    const mundur = aktif.filter(b => !maju.includes(b.id)).map(b => b.id)
    if (maju.length) await prisma.penugasanTahap.updateMany({ where: { id: { in: maju } }, data: tutup })
    if (mundur.length) await prisma.penugasanTahap.updateMany({ where: { id: { in: mundur } }, data: { status: 'DITUTUP' } })
  } else {
    await prisma.penugasanTahap.updateMany({ where: whereTutup, data: tutup })
  }
  if (!JENIS_KERJA.includes(jt)) return
  // Tim PER TAHAP (10 Nov 2026): anggota dengan `tahapKerjaIds` berisi hanya mengerjakan tahap-tahap itu (QC/revisi mengikuti tahap induknya);
  // kosong = semua tahap kerja (perilaku lama). Baris aktif di tahap ini milik orang yang tak lagi berhak ditutup (DITUTUP, bukan selesai).
  const indukId = tujuan.indukId ?? tujuan.id
  const asg = await prisma.assignmentProduksi.findMany({ where: { orderId: order.id, userId: { not: null }, berhentiPada: null }, select: { userId: true, tahapKerjaIds: true } }) // talent yang BERHENTI tidak menerima tahap berikutnya (14 Nov 2026)
  let tim = asg.filter(a => !a.tahapKerjaIds?.length || a.tahapKerjaIds.includes(tujuan.id) || a.tahapKerjaIds.includes(indukId)).map(a => a.userId)
  await prisma.penugasanTahap.updateMany({ where: { orderId: order.id, tahapId: tujuan.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, ...(tim.length ? { userId: { notIn: tim } } : {}) }, data: { status: 'DITUTUP' } })
  let otomatis = false
  if (!tim.length && (await prisma.pengaturanPenugasan.findUnique({ where: { studioId: order.studioId } }))?.otomatis) {
    const k = await kandidatDb({ ...order, kesulitan: order.kesulitan, genre: order.genre }, tujuan)
    if (k.userId) { await prisma.assignmentProduksi.create({ data: { orderId: order.id, userId: k.userId, peran: tujuan.nama } }); tim = [k.userId]; otomatis = true }
  }
  for (const userId of [...new Set(tim)]) await buatBarisTahap({ order, tahap: tujuan, userId, pengguna, otomatis, tunda })
}

/**
 * Tutup penugasan tahap yang sudah tidak relevan (adaptasi OGS tasks:close-stale). Order bisa diubah lewat halaman Produksi lama Ekosistem
 * (status SELESAI/BATAL langsung, tanpa lewat mesin alur) — penugasan aktifnya akan menggantung di antrean, menggelembungkan "task aktif",
 * beban penugasan otomatis, dan progres harian. SELESAI → penugasan ditandai SELESAI (kerja dianggap tuntas, ikut kontribusi);
 * BATAL → status 'DITUTUP' (tidak dihitung sebagai selesai/kontribusi).
 */
export async function tutupPenugasanBasi({ studioId = null, orderId = null } = {}) {
  const filter = { ...(studioId ? { studioId } : {}), ...(orderId ? { id: orderId } : {}) }
  const aktif = { in: ['MENUNGGU', 'DIKERJAKAN'] }
  const selesai = await prisma.penugasanTahap.findMany({ where: { status: aktif, order: { ...filter, status: 'SELESAI' } }, select: { id: true, order: { select: { tanggalSelesai: true } } } })
  const sekarang = new Date()
  if (selesai.length) await prisma.$transaction(selesai.map(b => prisma.penugasanTahap.update({ where: { id: b.id }, data: { status: 'SELESAI', progres: 100, selesaiPada: b.order.tanggalSelesai ?? sekarang } })))
  const batal = await prisma.penugasanTahap.updateMany({ where: { status: aktif, order: { ...filter, status: 'BATAL' } }, data: { status: 'DITUTUP' } })
  return { selesai: selesai.length, ditutup: batal.count }
}
