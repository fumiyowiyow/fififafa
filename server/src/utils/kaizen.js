import { jenisNormal } from './alur.js'
import { kunciTanggalWIB } from './jamKerja.js'

// SKOR EKSEKUTIF & KAIZEN (acuan OGS ExecutiveScorecardService, PaceComputerService, KaizenAnalyticsService). MURNI — tanpa database.
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const rata = (a) => (a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : 0)
const median = (a) => { if (!a.length) return 0; const x = [...a].sort((p, q) => p - q); const m = Math.floor(x.length / 2); return r1(x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2) }
const HARI = 86400000

/** Status pace omset (OGS PaceComputerService::buildMonthlyScorecardPace). */
export function statusPace({ aktual, target, hariKe, hariDalamBulan, bulanBerjalan }) {
  if (!(target > 0)) return { status: 'neutral', progressPct: 0, harapanPct: null }
  const progressPct = r1((aktual / target) * 100)
  if (bulanBerjalan) {
    const harapan = (Math.max(1, hariKe) / Math.max(1, hariDalamBulan)) * 100
    const d = progressPct - harapan
    return { status: d >= 0 ? 'ahead' : d >= -5 ? 'on-track' : d >= -15 ? 'behind' : 'critical', progressPct, harapanPct: r1(harapan) }
  }
  return { status: progressPct >= 100 ? 'ahead' : progressPct >= 90 ? 'on-track' : progressPct >= 75 ? 'behind' : 'critical', progressPct, harapanPct: 100 }
}
// Pemetaan status KPI (OGS assembleFounderExecutive): good | warn | critical | neutral
export const statusOmzet = (pace, adaTarget) => (!adaTarget ? 'neutral' : ['ahead', 'on-track'].includes(pace) ? 'good' : pace === 'behind' ? 'warn' : 'critical')
export const statusKoleksi = (cashIn, piutang) => (cashIn + piutang <= 0 ? 'neutral' : (cashIn / (cashIn + piutang)) * 100 >= 80 ? 'good' : (cashIn / (cashIn + piutang)) * 100 >= 55 ? 'warn' : 'critical')
export const statusOtd = (rate) => (rate == null ? 'neutral' : rate >= 85 ? 'good' : rate >= 70 ? 'warn' : 'critical')
export const statusRevisi = (rate) => (rate == null ? 'neutral' : rate <= 25 ? 'good' : rate <= 40 ? 'warn' : 'critical')
export const statusSdm = (rata10) => (rata10 == null ? 'neutral' : rata10 >= 7.5 ? 'good' : rata10 >= 6 ? 'warn' : 'critical')
export function statusBeban({ total, carryOver, wip, terbuka }) {
  if (total === 0) return 'neutral'
  if (carryOver > Math.max(5, Math.round(total * 0.45))) return 'warn'
  if (wip > Math.max(1, Math.round(terbuka * 0.65))) return 'warn'
  return 'good'
}

const bucket = (jenis) => { const j = jenisNormal(jenis); return j === 'SELESAI' ? 'completed' : ['FINALISASI', 'DELIVERY'].includes(j) ? 'delivery' : j === 'MASUK' ? 'in' : 'wip' }
/** Beban order bulan (OGS monthlyOrderWorkload): carry-over, baru, dan sebaran status per akhir bulan. orders: [{id, tanggalMasuk, tanggalSelesai, jenisSaatIni, riwayat:[{jenis, mulai}]}] */
export function bebanOrderBulan({ orders, awalBulan, akhirBulan }) {
  let carryOver = 0, baru = 0; const hit = { in: 0, wip: 0, delivery: 0, completed: 0 }
  for (const o of orders) {
    const masuk = new Date(o.tanggalMasuk), selesai = o.tanggalSelesai ? new Date(o.tanggalSelesai) : null
    const baruBulanIni = masuk >= awalBulan && masuk <= akhirBulan
    const terbukaAwalBulan = masuk < awalBulan && (!selesai || selesai >= awalBulan)
    if (!baruBulanIni && !terbukaAwalBulan) continue
    if (terbukaAwalBulan) carryOver++
    if (baruBulanIni) baru++
    const sampaiAkhir = (o.riwayat ?? []).filter(r => new Date(r.mulai) <= akhirBulan).sort((a, b) => new Date(a.mulai) - new Date(b.mulai)).at(-1)
    hit[bucket(sampaiAkhir?.jenis ?? o.jenisSaatIni)]++
  }
  return { carryOver, baru, ...hit, total: carryOver + baru }
}

/** Ketepatan deadline (OGS trailingOtd): rencana = order ber-deadline di rentang; terkirim / telat / berjalan. */
export function ketepatanDeadline({ orders, dari, sampai, hariIni }) {
  let rencana = 0, terkirim = 0, telat = 0, berjalan = 0
  const perUnit = new Map()
  for (const o of orders) {
    if (!o.deadline) continue
    const d = new Date(o.deadline)
    if (d < dari || d > sampai) continue
    rencana++
    const hasil = o.terkirim ? 'terkirim' : d < hariIni ? 'telat' : 'berjalan'
    if (hasil === 'terkirim') terkirim++; else if (hasil === 'telat') telat++; else berjalan++
    const u = perUnit.get(o.studioId) ?? { studioId: o.studioId, rencana: 0, terkirim: 0, telat: 0, berjalan: 0 }; u.rencana++; u[hasil]++; perUnit.set(o.studioId, u)
  }
  return { rate: rencana ? r1((terkirim / rencana) * 100) : null, rencana, terkirim, telat, berjalan, perUnit: [...perUnit.values()].map(u => ({ ...u, rate: u.rencana ? r1((u.terkirim / u.rencana) * 100) : null })) }
}
/** Tingkat revisi (OGS trailingRevisionRate): % order SELESAI di rentang yang pernah direvisi. */
export function tingkatRevisi({ orders, dari, sampai }) {
  const selesai = orders.filter(o => o.tanggalSelesai && new Date(o.tanggalSelesai) >= dari && new Date(o.tanggalSelesai) <= sampai)
  const denganRevisi = selesai.filter(o => (o.revisiKe ?? 0) > 0).length
  return { rate: selesai.length ? r1((denganRevisi / selesai.length) * 100) : null, selesai: selesai.length, denganRevisi }
}
/** Keterlambatan 6 bulan (OGS getDeadlineMiss): order lewat deadline yang belum terkirim. */
export function keterlambatan({ orders, hariIni, bulanMundur = 6 }) {
  const batas = new Date(hariIni.getTime() - bulanMundur * 30 * HARI)
  const kena = orders.filter(o => o.deadline && new Date(o.deadline) >= batas && new Date(o.deadline) < hariIni)
  const telat = kena.filter(o => !o.terkirim).map(o => ({ orderId: o.id, judul: o.judul, klien: o.klien, studioId: o.studioId, status: o.tahapNama, deadline: kunciTanggalWIB(o.deadline), hariTelat: Math.floor((hariIni - new Date(o.deadline)) / HARI) })).sort((a, b) => b.hariTelat - a.hariTelat)
  return { periode: `${bulanMundur} bulan terakhir`, total: kena.length, telat: telat.length, tepat: kena.length - telat.length, persenTelat: kena.length ? r1((telat.length / kena.length) * 100) : 0, daftar: telat }
}
/**
 * Siklus (OGS getCycleTime): rata-rata hari per tahap (bottleneck), lead time (masuk→selesai), revisi per order, tren 6 bulan, per unit.
 * orders: [{id, studioId, tanggalSelesai, revisiKe, riwayat:[{namaTahap, jenis, mulai, selesai}]}]
 */
export function siklus({ orders, namaUnit = new Map(), sekarang = new Date(), minSampel = 3 }) {
  const perTahap = new Map(), lead = [], revisi = [], tren = new Map(), perUnit = new Map()
  const awalTren = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - 5, 1))
  for (const o of orders) {
    const iv = (o.riwayat ?? []).map(r => ({ nama: r.namaTahap, jenis: jenisNormal(r.jenis), mulai: new Date(r.mulai), selesai: r.selesai ? new Date(r.selesai) : null })).sort((a, b) => a.mulai - b.mulai)
    for (const i of iv) {
      if (!i.selesai || i.jenis === 'SELESAI') continue
      const hari = (i.selesai - i.mulai) / HARI
      if (hari >= 0 && hari < 180) { const e = perTahap.get(i.nama) ?? []; e.push(hari); perTahap.set(i.nama, e) }
    }
    if (!o.tanggalSelesai || !iv.length) continue
    const hariLead = (new Date(o.tanggalSelesai) - iv[0].mulai) / HARI
    if (hariLead < 0 || hariLead > 365) continue
    lead.push(hariLead); revisi.push(o.revisiKe ?? 0)
    const ym = kunciTanggalWIB(o.tanggalSelesai).slice(0, 7)
    if (new Date(o.tanggalSelesai) >= awalTren) { const e = tren.get(ym) ?? []; e.push(hariLead); tren.set(ym, e) }
    const u = perUnit.get(o.studioId) ?? []; u.push(hariLead); perUnit.set(o.studioId, u)
  }
  const bulan = []
  for (let k = 5; k >= 0; k--) { const d = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - k, 1)); const ym = d.toISOString().slice(0, 7); const e = tren.get(ym); bulan.push({ bulan: ym, rataHari: e ? rata(e) : null, jumlah: e?.length ?? 0 }) }
  const denganRevisi = revisi.filter(x => x > 0).length
  return {
    ringkasan: { order: lead.length, rataLead: rata(lead), medianLead: median(lead) },
    bottleneck: [...perTahap.entries()].map(([tahap, a]) => ({ tahap, rataHari: rata(a), jumlah: a.length })).filter(x => x.jumlah >= minSampel).sort((a, b) => b.rataHari - a.rataHari),
    revisi: { diukur: revisi.length, rataPerOrder: rata(revisi), persenDenganRevisi: revisi.length ? r1((denganRevisi / revisi.length) * 100) : 0 },
    tren: bulan,
    perUnit: [...perUnit.entries()].map(([id, a]) => ({ studioId: id, unit: namaUnit.get(id) ?? '—', rataHari: rata(a), jumlah: a.length })).sort((a, b) => b.jumlah - a.jumlah),
    minSampel,
  }
}
/** Radar SDM dari Penilaian Kader (skala 1–5) → skala 10 seperti OGS; rata-rata empat kategori. */
export function radarSdm(penilaian) {
  const kat = [['Kehadiran & Kedisiplinan', ['skorKehadiran', 'skorKetepatanWaktu']], ['Adab & Karakter', ['skorAdab', 'skorKejujuran', 'skorMenerimaMasukan']], ['Kompetensi Teknis', ['skorKualitasKerja', 'skorPenguasaanSkill']], ['Kolaborasi & Inisiatif', ['skorInisiatif', 'skorKerjaSama']]]
  const nilai = kat.map(([label, f]) => { const a = penilaian.flatMap(p => f.map(k => p[k])).filter(v => typeof v === 'number'); return { label, nilai: a.length ? r1((a.reduce((x, y) => x + y, 0) / a.length) * 2) : null } })
  const ada = nilai.filter(n => n.nilai != null)
  return { kategori: nilai, rata: ada.length ? r1(ada.reduce((x, n) => x + n.nilai, 0) / ada.length) : null, jumlahPenilaian: penilaian.length }
}
export { r1, r2, rata, median }
