// PENJUALAN: periode closing, target per periode + carry-over (adaptasi OGS ClosingPeriodService, StudioTargetService::computePeriodBreakdown,
// FinanceDashboardController). MURNI — tanpa database. Tanggal 'YYYY-MM-DD'.
const HARI = 86400000
const tgl = (s) => new Date(s + 'T00:00:00Z')
const iso = (d) => d.toISOString().slice(0, 10)
const r2 = (n) => Math.round(n * 100) / 100
const SKIP_HARI = 3 // OGS SKIP_THRESHOLD_DAYS

/** Tanggal closing sebulan: tiap Jumat + akhir bulan; Jumat dilewati bila ≤ 3 hari dari akhir bulan ini / akhir bulan lalu (kecuali Jumat itu sendiri akhir bulan). */
export function tanggalClosing(tahun, bulan) {
  const awal = new Date(Date.UTC(tahun, bulan - 1, 1)), akhir = new Date(Date.UTC(tahun, bulan, 0)), akhirLalu = new Date(awal.getTime() - HARI)
  const out = []
  for (let t = awal.getTime(); t <= akhir.getTime(); t += HARI) {
    const d = new Date(t)
    if (d.getUTCDay() !== 5) continue
    const dekatLalu = d.getTime() !== akhirLalu.getTime() && Math.abs(d - akhirLalu) / HARI <= SKIP_HARI
    const dekatIni = d.getTime() !== akhir.getTime() && Math.abs(d - akhir) / HARI <= SKIP_HARI
    if (!dekatLalu && !dekatIni) out.push(iso(d))
  }
  if (!out.includes(iso(akhir))) out.push(iso(akhir))
  return out.sort()
}
/** Periode: [{index, mulai, akhir, hari}] — menutup seluruh bulan tanpa celah. */
export function periodeBulan(tahun, bulan) {
  let mulai = new Date(Date.UTC(tahun, bulan - 1, 1))
  return tanggalClosing(tahun, bulan).map((c, i) => { const akhir = tgl(c), p = { index: i + 1, mulai: iso(mulai), akhir: c, hari: Math.round((akhir - mulai) / HARI) + 1 }; mulai = new Date(akhir.getTime() + HARI); return p })
}
export const periodeUntuk = (periode, tanggal) => periode.find(p => tanggal >= p.mulai && tanggal <= p.akhir) ?? null

/** Status periode: untuk periode selesai pakai ambang tercapai (≥100 ahead, ≥90 on-track, ≥75 behind, selain itu critical); berjalan = proporsional hari. */
export function statusPeriode({ aktual, efektif, berjalan, hariKe = 0, hari = 1 }) {
  if (!(efektif > 0)) return 'neutral'
  const pct = (aktual / efektif) * 100
  if (berjalan) { const harap = (Math.max(1, hariKe) / Math.max(1, hari)) * 100, d = pct - harap; return d >= 0 ? 'ahead' : d >= -5 ? 'on-track' : d >= -15 ? 'behind' : 'critical' }
  return pct >= 100 ? 'ahead' : pct >= 90 ? 'on-track' : pct >= 75 ? 'behind' : 'critical'
}

/**
 * Rincian per periode: target dasar = target bulan ÷ jumlah periode; kekurangan periode sebelumnya DIBAWA (carry) ke periode berikutnya
 * (OGS computePeriodBreakdown). aktualPerTanggal: Map 'YYYY-MM-DD' → nilai. hariIni: tanggal acuan.
 */
export function rincianPeriode({ periode, targetBulan, aktualPerTanggal, hariIni }) {
  const dasar = periode.length ? targetBulan / periode.length : 0
  const aktual = periode.map(p => { let s = 0; for (const [t, v] of aktualPerTanggal) if (t >= p.mulai && t <= p.akhir) s += v; return r2(s) })
  let carry = 0
  return periode.map((p, i) => {
    const selesai = hariIni > p.akhir, berjalan = hariIni >= p.mulai && hariIni <= p.akhir, depan = hariIni < p.mulai
    const efektif = r2(dasar + carry)
    const hariKe = berjalan ? Math.round((tgl(hariIni) - tgl(p.mulai)) / HARI) + 1 : p.hari
    const hasil = { ...p, aktual: aktual[i], dasar: r2(dasar), carry: r2(carry), efektif, persen: efektif > 0 ? Math.round((aktual[i] / efektif) * 1000) / 10 : 0, selesai, berjalan, depan, status: depan ? 'neutral' : statusPeriode({ aktual: aktual[i], efektif, berjalan, hariKe, hari: p.hari }) }
    if (selesai) carry += dasar - aktual[i] // hanya periode yang sudah selesai yang membawa kekurangan/kelebihan
    return hasil
  })
}
