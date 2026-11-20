// OMZET BAYANGAN (21 Okt 2026) — jembatan menuju integrasi omzet: omzet dari ORDER web circle ditampilkan BERDAMPINGAN dengan Laporan Omset
// (WeeklyReport, angka resmi yang diisi manual) per periode laporan, tanpa menulis apa pun (Aturan Keras 4: mode bayangan). Tujuannya melihat
// selisih dulu sebelum memutuskan Laporan Omset diisi otomatis dari order.
//   • Periode = periode Laporan Omset Ekosistem (minggu Senin–Minggu dipotong di batas bulan, getReportingPeriod).
//   • Order dihitung menurut TANGGAL MASUK (WIB); order BATAL tidak dihitung.
//   • Platform akun jualan → kolom Laporan Omset; akun "Order Internal" (platform Internal) ditampilkan terpisah, TIDAK dibandingkan.
//   • Nilai ditampilkan KOTOR dan BERSIH (setelah fee akun) dalam USD — belum diputuskan mana yang setara dengan isian Laporan Omset.
//   • Order USD memakai kurs ordernya; order Rupiah memakai kurs Laporan Omset periode itu, atau rata-rata kurs laporan bulan itu, atau bawaan.
import prisma from '../prisma.js'
import { getReportingPeriod, isReportInMonth, getMonthAttributionRange } from './week.js'
import { kursRata, KURS_BAWAAN } from './uang.js'

export const KOLOM = [
  { kolom: 'omsetFiverr', label: 'Fiverr', platform: ['fiverr'] },
  { kolom: 'omsetEtsy', label: 'Etsy', platform: ['etsy'] },
  { kolom: 'omsetUpwork', label: 'Upwork', platform: ['upwork'] },
  { kolom: 'omsetVgen', label: 'VGen', platform: ['vgen'] },
  { kolom: 'omsetKomunitas', label: 'Komunitas', platform: ['komunitas'] },
  { kolom: 'omsetLainnya', label: 'Lainnya', platform: ['lainnya'] },
]
const HARI = 86400000
const r2 = (n) => Math.round(n * 100) / 100
const kunciWIB = (d) => new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(0, 10)
const iso = (d) => new Date(d).toISOString().slice(0, 10)

/** Kolom Laporan Omset untuk platform akun; null = order internal (tidak dibandingkan). */
export function kolomDariPlatform(platform) {
  const p = String(platform ?? '').trim().toLowerCase()
  if (!p || p === 'internal') return null
  return KOLOM.find(k => k.platform.includes(p))?.kolom ?? 'omsetLainnya'
}

/** Periode laporan dalam satu bulan (sama persis dengan Laporan Mingguan Ekosistem). */
export function periodeBulan(bulan, tahun) {
  const akhir = new Date(Date.UTC(tahun, bulan, 0)), hasil = []
  let t = new Date(Date.UTC(tahun, bulan - 1, 1))
  while (t <= akhir && hasil.length < 7) {
    const { periodeAwal, periodeAkhir } = getReportingPeriod(t)
    hasil.push({ periodeAwal: iso(periodeAwal), periodeAkhir: iso(periodeAkhir) })
    t = new Date(periodeAkhir.getTime() + HARI)
  }
  return hasil
}

/**
 * MURNI. periode: [{periodeAwal,periodeAkhir}] (YYYY-MM-DD) · laporan: WeeklyReport bulan itu · orders: [{tanggalMasuk, nilaiKotor, nilaiBersih,
 * mataUang, kurs, nilaiUsd, akun:{platform, feePersen}}] → { periode:[…], total }
 */
export function susunBayangan({ periode, laporan = [], orders = [] }) {
  const kursBulan = kursRata(laporan.map(l => l.kurs))
  const kosong = () => Object.fromEntries(KOLOM.map(k => [k.kolom, { kotor: 0, bersih: 0, jumlah: 0 }]))
  const baris = periode.map(p => {
    const lap = laporan.find(l => iso(l.periodeAwal) === p.periodeAwal) ?? null
    const kursP = lap?.kurs > 0 ? lap.kurs : kursBulan
    const per = kosong(), internal = { jumlah: 0, kotor: 0 }
    for (const o of orders) {
      const t = kunciWIB(o.tanggalMasuk)
      if (t < p.periodeAwal || t > p.periodeAkhir) continue
      const usd = o.mataUang === 'USD' && o.kurs > 0
      const kotor = usd && o.nilaiUsd != null ? Number(o.nilaiUsd) : (o.nilaiKotor ?? 0) / (usd ? o.kurs : kursP)
      const bersih = usd ? (o.nilaiBersih ?? 0) / o.kurs : (o.nilaiBersih ?? 0) / kursP
      const kol = kolomDariPlatform(o.akun?.platform)
      if (!kol) { internal.jumlah++; internal.kotor += kotor; continue }
      per[kol].kotor += kotor; per[kol].bersih += bersih; per[kol].jumlah++
    }
    const kolom = KOLOM.map(k => {
      const o = per[k.kolom], l = lap ? Number(lap[k.kolom]) || 0 : null
      return { kolom: k.kolom, label: k.label, laporan: l, orderKotor: r2(o.kotor), orderBersih: r2(o.bersih), jumlahOrder: o.jumlah, selisihKotor: l == null ? null : r2(o.kotor - l), selisihBersih: l == null ? null : r2(o.bersih - l) }
    })
    const orderKotor = r2(kolom.reduce((a, k) => a + k.orderKotor, 0)), orderBersih = r2(kolom.reduce((a, k) => a + k.orderBersih, 0))
    const lapTotal = lap ? r2(Number(lap.totalUsd) || 0) : null
    return { ...p, adaLaporan: !!lap, kurs: kursP, kursDari: lap?.kurs > 0 ? 'laporan periode ini' : laporan.length ? 'rata-rata laporan bulan ini' : 'bawaan', laporanUsd: lapTotal, orderKotorUsd: orderKotor, orderBersihUsd: orderBersih, selisihKotor: lapTotal == null ? null : r2(orderKotor - lapTotal), selisihBersih: lapTotal == null ? null : r2(orderBersih - lapTotal), jumlahOrder: kolom.reduce((a, k) => a + k.jumlahOrder, 0), internal: { jumlah: internal.jumlah, kotorUsd: r2(internal.kotor) }, kolom }
  })
  const dgnLap = baris.filter(b => b.adaLaporan)
  const jml = (arr, f) => r2(arr.reduce((a, b) => a + (b[f] ?? 0), 0))
  return {
    periode: baris,
    total: {
      laporanUsd: jml(dgnLap, 'laporanUsd'), orderKotorUsd: jml(baris, 'orderKotorUsd'), orderBersihUsd: jml(baris, 'orderBersihUsd'),
      // selisih total hanya dari periode yang SUDAH ada laporannya (periode tanpa laporan tidak bisa dibandingkan)
      orderKotorUsdBerlaporan: jml(dgnLap, 'orderKotorUsd'), orderBersihUsdBerlaporan: jml(dgnLap, 'orderBersihUsd'),
      selisihKotor: r2(jml(dgnLap, 'orderKotorUsd') - jml(dgnLap, 'laporanUsd')), selisihBersih: r2(jml(dgnLap, 'orderBersihUsd') - jml(dgnLap, 'laporanUsd')),
      periodeBerlaporan: dgnLap.length, jumlahPeriode: baris.length, jumlahOrder: baris.reduce((a, b) => a + b.jumlahOrder, 0), internal: { jumlah: baris.reduce((a, b) => a + b.internal.jumlah, 0), kotorUsd: r2(baris.reduce((a, b) => a + b.internal.kotorUsd, 0)) },
    },
  }
}

/** Bayangan omzet satu unit satu bulan (BACA saja). */
export async function bayanganOmsetStudio(studioId, bulan, tahun) {
  const periode = periodeBulan(bulan, tahun)
  const { rangeStart, rangeEnd } = getMonthAttributionRange(bulan, tahun)
  const awal = new Date(periode[0].periodeAwal + 'T00:00:00+07:00'), akhir = new Date(new Date(periode[periode.length - 1].periodeAkhir + 'T00:00:00+07:00').getTime() + HARI)
  const [laporan, orders] = await Promise.all([
    prisma.weeklyReport.findMany({ where: { studioId, periodeAwal: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.orderProduksi.findMany({ where: { studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir } }, select: { tanggalMasuk: true, nilaiKotor: true, nilaiBersih: true, mataUang: true, kurs: true, nilaiUsd: true, akun: { select: { platform: true, feePersen: true } } } }),
  ])
  const hasil = susunBayangan({ periode, laporan: laporan.filter(l => isReportInMonth(l, bulan, tahun)), orders })
  return { bulan, tahun, kursBawaan: KURS_BAWAAN, ...hasil, catatan: 'Tampilan bayangan: omzet dari order web circle (tanggal masuk, tanpa order batal) dibandingkan dengan Laporan Omset resmi. Tidak ada yang ditulis. Order internal tidak dibandingkan. Selisih = order − laporan; dihitung untuk nilai kotor dan bersih (setelah fee akun) karena belum diputuskan mana yang setara dengan isian Laporan Omset.' }
}
