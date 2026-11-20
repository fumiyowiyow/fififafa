import prisma from '../prisma.js'
import { hariIniWIB } from './kehadiran.js'
import { KATALOG } from './marketing.js'
import { masihDiUnit } from './fungsi.js'
import { antreKirim } from './notifGrup.js'

// LAPORAN HARIAN MARKET OTOMATIS KE TOPIK GRUP (12 Nov 2026, keputusan user: "semua orang tidak perlu lapor manual lagi"). Menggantikan
// "📋 Laporan Harian Market" yang dulu dikirim manual marketer/admin lewat bot lapor. Tiap malam (cron di md-bot) SATU pesan per unit yang
// punya kegiatan hari itu: order masuk (+ nilai), deliver, complete, dan aktivitas tiap marketer — semua dari data web circle. Tujuan & bot
// sama dengan kabar order baru (TELEGRAM_GRUP_ORDER / _TOPIK_ / _BOT_ORDER_TOKEN, utils/notifGrup.js); kosong = mati.
const rp = (n) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID')
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const WIB = 7 * 3600000
const tanggalPanjang = (hari) => { const d = new Date(hari + 'T00:00:00Z'); return `${NAMA_HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${NAMA_BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const daftar = (judul, l) => (l.length ? [`${judul}`, ...l.map((x, i) => `${i + 1}. ${x}`), ''] : [])

/** Teks laporan (HTML Telegram) — MURNI (diuji). Kosong (null) bila unit tidak punya kegiatan & tidak punya marketer.
 *  d: {unit, lingkup, hari 'YYYY-MM-DD', masuk:[{klien, judul, nilai}], deliver:[{klien, judul}], complete:[{klien, judul}],
 *      marketer:[{nama, aktivitas:[{label, tahap, jumlah}], belumSelesai}]} */
export function pesanLaporanHarian(d) {
  const adaKegiatan = d.masuk.length || d.deliver.length || d.complete.length || d.marketer.some(m => m.aktivitas.length)
  if (!adaKegiatan && !d.marketer.length) return null
  const L = ['📋 <b>Laporan Harian Market</b>', `🏢 ${esc(d.unit)}${d.lingkup ? ` · ${esc(d.lingkup)}` : ''}`, `📅 ${tanggalPanjang(d.hari)}`, '']
  const total = d.masuk.reduce((a, o) => a + (o.nilai ?? 0), 0)
  L.push(...daftar(`🛒 <b>Order masuk</b> (${d.masuk.length} · ${rp(total)})`, d.masuk.map(o => `${esc(o.klien)} — ${esc(o.judul)} (${rp(o.nilai)})`)))
  L.push(...daftar('📦 <b>Deliver</b>', d.deliver.map(o => `${esc(o.klien)} — ${esc(o.judul)}`)))
  L.push(...daftar('✅ <b>Complete</b>', d.complete.map(o => `${esc(o.klien)} — ${esc(o.judul)}`)))
  if (d.marketer.length) {
    L.push('💬 <b>Aktivitas marketer</b>')
    for (const m of [...d.marketer].sort((a, b) => b.aktivitas.reduce((s, x) => s + x.jumlah, 0) - a.aktivitas.reduce((s, x) => s + x.jumlah, 0))) {
      const n = m.aktivitas.reduce((s, x) => s + x.jumlah, 0)
      L.push(`👤 ${esc(m.nama)} · ${n}${n ? `: ${m.aktivitas.map(a => `${a.jumlah} ${esc(a.label)}`).join(', ')}` : ' (belum ada aktivitas)'}${m.belumSelesai ? ` · ⚠ ${m.belumSelesai} belum selesai` : ''}`)
    }
    L.push('')
  }
  if (!adaKegiatan) L.push('<i>Tidak ada order & aktivitas tercatat hari ini.</i>', '')
  L.push('<i>🌐 otomatis dari web circle</i>')
  return L.join('\n')
}

/** Kumpulkan data satu hari untuk semua unit aktif → daftar teks (tanpa mengirim). */
export async function susunLaporanSemuaUnit(hari = hariIniWIB()) {
  const awal = new Date(new Date(hari + 'T00:00:00Z').getTime() - WIB), akhir = new Date(awal.getTime() + 86400000) // satu hari kalender WIB
  const tanggal = new Date(hari + 'T00:00:00.000Z')
  const kat = new Map(KATALOG.map(k => [k.kunci, k]))
  const studios = await prisma.studio.findMany({ where: { statusAktif: true, tipe: { not: 'KORPORASI' } }, select: { id: true, nama: true, circle: { select: { nama: true } }, rumahUsaha: { select: { nama: true } }, induk: { select: { nama: true } } }, orderBy: { nama: 'asc' } })
  const hasil = []
  for (const s of studios) {
    const [masuk, deliver, complete, mk] = await Promise.all([
      prisma.orderProduksi.findMany({ where: { studioId: s.id, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir } }, select: { klien: true, judul: true, nilaiKotor: true }, orderBy: { tanggalMasuk: 'asc' } }),
      prisma.riwayatTahapOrder.findMany({ where: { jenis: 'DELIVERY', mulai: { gte: awal, lt: akhir }, order: { studioId: s.id, status: { not: 'BATAL' } } }, select: { order: { select: { id: true, klien: true, judul: true } } }, distinct: ['orderId'] }),
      prisma.orderProduksi.findMany({ where: { studioId: s.id, status: 'SELESAI', tanggalSelesai: { gte: awal, lt: akhir } }, select: { klien: true, judul: true } }),
      prisma.fungsiAnggota.findMany({ where: { studioId: s.id, fungsi: 'MARKETER', user: masihDiUnit(s.id) }, select: { user: { select: { id: true, nama: true } } } }),
    ])
    const ids = [...new Map(mk.map(m => [m.user.id, m.user])).values()]
    const akt = ids.length ? await prisma.aktivitasMarketer.findMany({ where: { studioId: s.id, tanggal, userId: { in: ids.map(m => m.id) } }, select: { userId: true, jenis: true, judul: true, jumlah: true, selesai: true } }) : []
    const marketer = ids.map(m => {
      const mine = akt.filter(a => a.userId === m.id), per = new Map()
      for (const a of mine) { const k = kat.get(a.jenis); const l = a.jenis === 'lainnya' ? (a.judul?.trim() || 'Lainnya') : (k?.label ?? a.jenis); per.set(l, { label: l, tahap: k?.tahap ?? null, jumlah: (per.get(l)?.jumlah ?? 0) + a.jumlah }) }
      return { nama: m.nama, aktivitas: [...per.values()], belumSelesai: mine.filter(a => !a.selesai).length }
    })
    const teks = pesanLaporanHarian({ unit: s.nama.trim(), lingkup: s.circle?.nama ?? s.rumahUsaha?.nama ?? s.induk?.nama ?? null, hari, masuk: masuk.map(o => ({ klien: o.klien, judul: o.judul, nilai: o.nilaiKotor })), deliver: deliver.map(r => r.order), complete, marketer })
    if (teks) hasil.push({ studioId: s.id, unit: s.nama.trim(), teks })
  }
  return hasil
}

/** Dipanggil cron md-bot tiap malam. Mati bila TELEGRAM_GRUP_ORDER kosong. */
export async function kirimLaporanHarianGrup(hari = hariIniWIB()) {
  if (!process.env.TELEGRAM_GRUP_ORDER) return { terkirim: 0 }
  const daftarTeks = await susunLaporanSemuaUnit(hari)
  for (const x of daftarTeks) antreKirim(x.teks)
  return { terkirim: daftarTeks.length }
}
