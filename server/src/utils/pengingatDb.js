import prisma from './../prisma.js'
import { kunciTanggalWIB } from './jamKerja.js'
import { hariIniWIB, jenisHari, jamResmi, cutiMencakup, jamTeks } from './kehadiran.js'
import { urutkanAntrean } from './penugasan.js'
import { anggotaStudio } from './penugasanDb.js'
import { susunLaporanHarian } from './tambahanOgs.js'
import { KATALOG, TAHAP_AKTIVITAS } from './marketing.js'
import * as P from './pengingat.js'
import { masihDiUnit } from './fungsi.js'

// Pengumpul pengingat: menghasilkan daftar {userId, nama, teks, punyaTelegram} TANPA mengirim. Dipakai pratinjau (web circle) dan cron bot.
const dt = (s) => new Date(s + 'T00:00:00.000Z')
const selisih = (a, b) => Math.round((dt(b) - dt(a)) / 86400000)
export async function pengelolaStudio(studioId) {
  const [r, a] = await Promise.all([prisma.userRole.findMany({ where: { studioId, roleType: { in: ['KOORDINATOR', 'PENDAMPING'] } }, select: { userId: true } }), prisma.produksiAdminMarket.findMany({ where: { studioId }, select: { userId: true } })])
  return [...new Set([...r.map(x => x.userId), ...a.map(x => x.userId)])]
}
async function lengkapi(daftar) {
  const ids = [...new Set(daftar.map(d => d.userId))]
  const u = await prisma.user.findMany({ where: { id: { in: ids }, statusAktif: true }, select: { id: true, nama: true, telegramId: true } })
  const m = new Map(u.map(x => [x.id, x]))
  return daftar.filter(d => m.has(d.userId)).map(d => ({ ...d, nama: m.get(d.userId).nama, punyaTelegram: !!m.get(d.userId).telegramId, telegramId: m.get(d.userId).telegramId }))
}
const studios = (studioId) => prisma.studio.findMany({ where: { statusAktif: true, ...(studioId ? { id: studioId } : {}) }, select: { id: true, nama: true } })

export async function kumpulkan(jenis, { studioId = null, hari = hariIniWIB() } = {}) {
  const out = []
  const sisaDari = (d) => (d ? selisih(hari, kunciTanggalWIB(d)) : null)
  if (jenis === 'rencana') {
    const baris = await prisma.penugasanTahap.findMany({ where: { status: { in: ['MENUNGGU', 'DIKERJAKAN'] }, order: { status: { not: 'BATAL' }, ...(studioId ? { studioId } : {}) } }, include: { order: { select: { judul: true, deadline: true } } } })
    const per = new Map(); for (const b of baris) { if (!per.has(b.userId)) per.set(b.userId, []); per.get(b.userId).push(b) }
    for (const [userId, l] of per) { const t = urutkanAntrean(l).map(b => ({ judul: b.order.judul, tahap: b.namaTahap, sisa: sisaDari(b.order.deadline), mendesak: b.mendesak })); const teks = P.pesanRencana('x', t); if (teks) out.push({ userId, jenis, teksFn: (nama) => P.pesanRencana(nama, t) }) }
  } else if (jenis === 'delivery' || jenis === 'biaya' || jenis === 'laporanMarketer') {
    for (const s of await studios(studioId)) {
      let teks = null
      if (jenis === 'delivery') {
        const o = await prisma.orderProduksi.findMany({ where: { studioId: s.id, status: { in: ['MASUK', 'PROSES'] }, deadline: { not: null } }, select: { judul: true, klien: true, deadline: true } })
        teks = P.pesanDelivery(s.nama, o.map(x => ({ ...x, sisa: sisaDari(x.deadline) })).filter(x => x.sisa >= 1 && x.sisa <= 5))
      } else if (jenis === 'biaya') {
        const b = await prisma.biayaStudio.findMany({ where: { studioId: s.id, persetujuan: 'DISETUJUI', statusBayar: { not: 'LUNAS' }, jatuhTempo: { lte: dt(hari) } }, orderBy: { jatuhTempo: 'asc' } })
        teks = P.pesanBiaya(s.nama, b.map(x => ({ kategori: x.kategori, deskripsi: x.deskripsi, jumlah: x.jumlah - (x.jumlahDibayar ?? 0), jatuhTempo: x.jatuhTempo.toISOString().slice(0, 10) })).filter(x => x.jumlah > 0), hari)
      } else {
        const mk = await prisma.fungsiAnggota.findMany({ where: { studioId: s.id, fungsi: 'MARKETER', user: masihDiUnit(s.id) }, select: { user: { select: { id: true, nama: true } } } })
        const marketer = mk.map(m => ({ id: m.user.id, nama: m.user.nama }))
        if (marketer.length) {
          const akt = await prisma.aktivitasMarketer.findMany({ where: { studioId: s.id, tanggal: dt(hari), userId: { in: marketer.map(m => m.id) } }, select: { userId: true, jenis: true, jumlah: true, selesai: true } })
          teks = susunLaporanHarian({ tanggal: hari, marketer, aktivitas: akt, katalog: KATALOG, tahapLabel: TAHAP_AKTIVITAS })
        }
      }
      if (teks) for (const userId of await pengelolaStudio(s.id)) out.push({ userId, jenis, teks })
    }
  } else if (jenis === 'presensi') {
    const lib = await prisma.hariLiburKerja.findMany({ where: { tanggal: dt(hari) }, select: { jenis: true } })
    const hk = new Map(lib.map(l => [hari, l.jenis])), jam = jamResmi(hari, hk)
    if (!jam) return []
    const sudah = new Set()
    for (const s of await studios(studioId)) {
      const anggota = await anggotaStudio(s.id), ids = [...anggota.keys()]
      const [masuk, cuti] = await Promise.all([prisma.kehadiranEvent.findMany({ where: { userId: { in: ids }, tanggalKerja: dt(hari), jenis: 'MASUK' }, select: { userId: true } }), prisma.cutiKehadiran.findMany({ where: { userId: { in: ids }, status: 'DISETUJUI', mulai: { lte: dt(hari) }, selesai: { gte: dt(hari) } } })])
      const hadir = new Set(masuk.map(m => m.userId)), izin = new Set(cuti.filter(c => c.durasi === 'SEHARI' && cutiMencakup(c, hari)).map(c => c.userId))
      for (const [id, nama] of anggota) if (!hadir.has(id) && !izin.has(id) && !sudah.has(id)) { sudah.add(id); out.push({ userId: id, jenis, teksFn: (n) => P.pesanPresensi(n || nama, jamTeks(jam.mulai)) }) }
    }
  }
  const lengkap = await lengkapi(out)
  return lengkap.map(d => ({ userId: d.userId, nama: d.nama, punyaTelegram: d.punyaTelegram, telegramId: d.telegramId, jenis: d.jenis, teks: d.teks ?? d.teksFn(d.nama) })).filter(d => d.teks)
}
