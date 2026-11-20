import prisma from '../prisma.js'
import { JENIS_KERJA } from './penugasan.js'
import { deadlineTanpaPenanggung, qcMacet, perluEskalasi, labelDeadline, selisihHari } from './otomasi.js'
import { jenisNormal } from './alur.js'
import { saranDb, anggotaStudio } from './penugasanDb.js'

// Pemeriksaan otomatis per unit (dipakai endpoint web circle DAN cron di proses md-bot).
const ISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

async function muatOrderAktif(studioId) {
  const orders = await prisma.orderProduksi.findMany({ where: { studioId, status: { in: ['MASUK', 'PROSES'] } }, include: { tahap: { select: { id: true, nama: true, jenis: true } }, assignments: { where: { userId: { not: null }, berhentiPada: null }, select: { userId: true } } } })
  const ids = orders.map(o => o.id)
  const [riwayat, baris] = ids.length ? await Promise.all([
    prisma.riwayatTahapOrder.findMany({ where: { orderId: { in: ids }, selesai: null }, select: { orderId: true, mulai: true } }),
    prisma.penugasanTahap.findMany({ where: { orderId: { in: ids }, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, select: { orderId: true, tahapId: true } }),
  ]) : [[], []]
  return orders.map(o => {
    const jenis = jenisNormal(o.tahap?.jenis ?? (o.status === 'MASUK' ? 'MASUK' : 'KERJA'))
    const bar = baris.filter(b => b.orderId === o.id)
    return { id: o.id, studioId: o.studioId, judul: o.judul, klien: o.klien, deadline: o.deadline, tahap: o.tahap, tahapNama: o.tahap?.nama ?? o.subStatus, jenis,
      dalamTahapKerja: JENIS_KERJA.includes(jenis), dalamQc: jenis === 'QC',
      adaPenanggung: bar.length ? bar.some(b => b.tahapId === o.tahap?.id) : o.assignments.length > 0,
      mulaiTahap: riwayat.find(r => r.orderId === o.id)?.mulai ?? o.tanggalMasuk, raw: o, tim: o.assignments.map(a => a.userId) }
  })
}

export async function periksaStudio(studioId, sekarang = new Date()) {
  const orders = await muatOrderAktif(studioId)
  const dt = deadlineTanpaPenanggung({ orders, sekarang })
  const hasilDt = []
  for (const o of dt) hasilDt.push({ orderId: o.id, judul: o.judul, klien: o.klien, tahap: o.tahapNama, deadline: ISO(o.deadline), sisaHari: o.sisaHari, label: labelDeadline(o.sisaHari), saran: o.tahap ? await saranDb({ ...o.raw }, o.tahap, 2) : [] })
  const qm = qcMacet({ orders, sekarang })
  const hasilQc = []
  for (const o of qm) {
    const terbuka = await prisma.diskusiKeputusan.findFirst({ where: { orderId: o.id, otomatis: true, status: 'TERBUKA', judul: { startsWith: '[Otomatis] QC macet' } }, select: { id: true } })
    const log = await prisma.logOtomasi.findFirst({ where: { aturan: 'qc_macet', subjekTipe: 'order', subjekId: o.id }, orderBy: { createdAt: 'desc' } })
    hasilQc.push({ orderId: o.id, judul: o.judul, klien: o.klien, tahap: o.tahapNama, umurHari: o.umurHari, deadline: ISO(o.deadline), sudahDiskusi: !!terbuka, perluEskalasi: perluEskalasi({ adaDiskusiTerbuka: !!terbuka, logTerakhir: log?.createdAt ?? null, sekarang }) })
  }
  return { deadlineTanpaPenanggung: hasilDt, qcMacet: hasilQc }
}

const kunciHari = (d) => new Date(d).toISOString().slice(0, 10)
/** Catat alert deadline sebagai "terkirim" sekali per order per hari; mengembalikan hanya yang BARU (belum pernah dikirim hari itu). */
export async function alertDeadlineBaru(studioId, sekarang = new Date()) {
  const { deadlineTanpaPenanggung: daftar } = await periksaStudio(studioId, sekarang)
  const baru = []
  for (const a of daftar) {
    try { await prisma.logOtomasi.create({ data: { aturan: 'deadline_tanpa_penanggung', subjekTipe: 'order', subjekId: a.orderId, kunciDedup: `order:${a.orderId}:${kunciHari(sekarang)}`, aksi: 'peringatan', payload: { sisaHari: a.sisaHari } } }); baru.push(a) } catch (e) { if (e?.code !== 'P2002') throw e }
  }
  return baru
}

// Pengelola (PEMILIK, boleh memutuskan/membatalkan) = koordinator, pendamping, admin market; penanggung order = PESERTA.
async function pesertaEskalasi(studioId, timIds) {
  const pm = await prisma.userRole.findMany({ where: { studioId, roleType: { in: ['KOORDINATOR', 'PENDAMPING'] }, user: { statusAktif: true } }, select: { userId: true } })
  const am = await prisma.produksiAdminMarket.findMany({ where: { studioId }, select: { userId: true } })
  const pengelola = [...new Set([...pm.map(p => p.userId), ...am.map(a => a.userId)])]
  return [...pengelola.map(userId => ({ userId, peran: 'PEMILIK' })), ...[...new Set(timIds)].filter(id => !pengelola.includes(id)).map(userId => ({ userId, peran: 'PESERTA' }))]
}
/** Buat diskusi "[Otomatis] QC macet" untuk order yang perlu dieskalasi (OGS StuckQcEscalationService). Mengembalikan diskusi yang dibuat. */
export async function eskalasiQcMacet(studioId, sekarang = new Date()) {
  const orders = await muatOrderAktif(studioId)
  const anggota = await anggotaStudio(studioId)
  const dibuat = []
  for (const o of qcMacet({ orders, sekarang })) {
    const terbuka = await prisma.diskusiKeputusan.findFirst({ where: { orderId: o.id, otomatis: true, status: 'TERBUKA', judul: { startsWith: '[Otomatis] QC macet' } }, select: { id: true } })
    const log = await prisma.logOtomasi.findFirst({ where: { aturan: 'qc_macet', subjekTipe: 'order', subjekId: o.id }, orderBy: { createdAt: 'desc' } })
    if (!perluEskalasi({ adaDiskusiTerbuka: !!terbuka, logTerakhir: log?.createdAt ?? null, sekarang })) continue
    const sisa = o.deadline ? selisihHari(sekarang, o.deadline) : null
    const garisDeadline = o.deadline ? `Deadline: ${ISO(o.deadline)} (${labelDeadline(sisa)})` : 'Deadline: belum diatur'
    const peserta = await pesertaEskalasi(studioId, o.tim)
    if (!peserta.length) continue
    const timNama = o.tim.map(id => anggota.get(id)).filter(Boolean).join(', ') || 'belum ada'
    const d = await prisma.diskusiKeputusan.create({ data: {
      studioId, orderId: o.id, judul: `[Otomatis] QC macet — ${o.klien} · ${o.judul}`.slice(0, 200), otomatis: true, dibuatOleh: 'Otomasi',
      deskripsi: [`Order: ${o.judul}`, `Tahap: ${o.tahapNama}`, `Lama di tahap: ${o.umurHari} hari`, garisDeadline, `Tim: ${timNama}`].join('\n'),
      peserta: { create: peserta },
      pesan: { create: { userId: null, nama: 'Otomasi', isi: `Order ini sudah ${o.umurHari} hari di "${o.tahapNama}" tanpa perubahan status.\n${garisDeadline}\nTim: ${timNama}\n\nMohon konfirmasi: lanjut QC, tugaskan ulang, atau ada hambatan?` } },
    } })
    await prisma.logOtomasi.create({ data: { aturan: 'qc_macet', subjekTipe: 'order', subjekId: o.id, kunciDedup: `order:${o.id}:${sekarang.getTime()}`, aksi: 'diskusi_dibuat', payload: { diskusiId: d.id, umurHari: o.umurHari } } })
    dibuat.push({ diskusiId: d.id, orderId: o.id, judul: o.judul, umurHari: o.umurHari, peserta: peserta.map(p => p.userId) })
  }
  return dibuat
}
