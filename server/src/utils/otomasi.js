// OTOMATISASI (acuan OGS DeadlineUnassignedService, StuckQcEscalationService). MURNI — tanpa database.
export const JENDELA_DEADLINE = [1, 0]   // OGS deadline_unassigned_days: H-1 dan H-0
export const AMBANG_QC_MACET_HARI = 3    // OGS stuck_qc_days
export const MASA_TUNGGU_ESKALASI_HARI = 7 // OGS stuck_qc_re_escalate_days
const WIB = 7 * 3600 * 1000
const hariWIB = (d) => Math.floor((new Date(d).getTime() + WIB) / 86400000)
/** Selisih hari kalender (WIB) b − a. */
export const selisihHari = (a, b) => hariWIB(b) - hariWIB(a)
export const labelDeadline = (sisa) => (sisa > 0 ? `H-${sisa}` : sisa === 0 ? 'H-0' : `H+${Math.abs(sisa)}`)

/** Order terbuka di tahap kerja yang deadline-nya H-1/H-0 dan belum ada penanggung jawab tahap itu. */
export function deadlineTanpaPenanggung({ orders, sekarang, jendela = JENDELA_DEADLINE }) {
  return orders.filter(o => o.deadline && o.dalamTahapKerja && !o.adaPenanggung)
    .map(o => ({ ...o, sisaHari: selisihHari(sekarang, o.deadline) }))
    .filter(o => jendela.includes(o.sisaHari))
}
/** Order di tahap QC selama ≥ ambang hari kalender. */
export function qcMacet({ orders, sekarang, ambang = AMBANG_QC_MACET_HARI }) {
  return orders.filter(o => o.dalamQc && o.mulaiTahap).map(o => ({ ...o, umurHari: selisihHari(o.mulaiTahap, sekarang) })).filter(o => o.umurHari >= ambang)
}
/** Perlu eskalasi? tidak bila sudah ada diskusi otomatis terbuka, sudah dijalankan hari ini, atau masih dalam masa tunggu. */
export function perluEskalasi({ adaDiskusiTerbuka, logTerakhir, sekarang, masaTunggu = MASA_TUNGGU_ESKALASI_HARI }) {
  if (adaDiskusiTerbuka) return false
  if (!logTerakhir) return true
  if (selisihHari(logTerakhir, sekarang) < 1) return false
  return selisihHari(logTerakhir, sekarang) >= masaTunggu
}
