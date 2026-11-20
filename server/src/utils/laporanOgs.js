// Progres harian, kontribusi nilai per orang, beban kerja per orang (adaptasi OGS MyTasksController::buildDailyProgress,
// ReportController::kontribusi/workload). MURNI — tanpa database. Hari = WIB.
const HARI = 86400000
const WIB = '+07:00'
const awalHari = (tgl) => new Date(tgl + 'T00:00:00' + WIB)
const akhirHari = (tgl) => new Date(awalHari(tgl).getTime() + HARI - 1)
const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100
export const daftarTanggal = (dari, sampai) => { const out = []; for (let t = awalHari(dari).getTime(); t <= awalHari(sampai).getTime(); t += HARI) out.push(new Date(t + 12 * 3600000).toISOString().slice(0, 10)); return out }

/**
 * baris: [{userId, ditugaskanPada, selesaiPada|null}]. Satu penugasan "ada di beban hari H" bila sudah ditugaskan sebelum akhir H dan
 * (belum selesai atau selesai pada/setelah awal H). Carry-over = ditugaskan SEBELUM hari H. Selesai = selesaiPada jatuh pada H.
 */
export function progresHarian(baris, dari, sampai) {
  return daftarTanggal(dari, sampai).map(tgl => {
    const a = awalHari(tgl), z = akhirHari(tgl)
    const hari = { tanggal: tgl, selesai: 0, total: 0, selesaiCarry: 0, selesaiBaru: 0, totalCarry: 0, totalBaru: 0 }
    const per = new Map()
    for (const b of baris) {
      const tugas = new Date(b.ditugaskanPada), tuntas = b.selesaiPada ? new Date(b.selesaiPada) : null
      if (tugas > z) continue
      if (tuntas && tuntas < a) continue
      const carry = tugas < a
      const w = per.get(b.userId) ?? { userId: b.userId, selesai: 0, total: 0, selesaiCarry: 0, selesaiBaru: 0, totalCarry: 0, totalBaru: 0 }
      w.total++; hari.total++; carry ? (w.totalCarry++, hari.totalCarry++) : (w.totalBaru++, hari.totalBaru++)
      if (tuntas && tuntas >= a && tuntas <= z) { w.selesai++; hari.selesai++; carry ? (w.selesaiCarry++, hari.selesaiCarry++) : (w.selesaiBaru++, hari.selesaiBaru++) }
      per.set(b.userId, w)
    }
    return { ...hari, persen: hari.total ? Math.round((hari.selesai / hari.total) * 100) : 0, perPekerja: [...per.values()].map(w => ({ ...w, persen: w.total ? Math.round((w.selesai / w.total) * 100) : 0 })) }
  })
}

/**
 * Porsi nilai satu tahap-selesai = nilaiOrder ÷ jumlah tahap berbeda pada order ÷ jumlah pekerja pada tahap itu (OGS stageContributionUsd).
 * selesai: [{id, orderId, userId, namaTahap, selesaiPada, bulan(1-12)}]; semua: Map orderId → [{namaTahap, userId}]; nilai: Map orderId → nilai.
 * bulanTerpilih 0 = seluruh tahun (hanya kumulatif).
 */
export function porsiTahap(s, semua, nilai) {
  const baris = semua.get(s.orderId) ?? []
  const nTahap = Math.max(1, new Set(baris.map(x => x.namaTahap)).size)
  const nPekerja = Math.max(1, baris.filter(x => x.namaTahap === s.namaTahap).length)
  return (nilai.get(s.orderId) ?? 0) / nTahap / nPekerja
}
export function hitungKontribusi(selesai, semua, nilai, bulanTerpilih) {
  const acc = new Map()
  for (const s of selesai) {
    const dalamKum = bulanTerpilih === 0 || s.bulan <= bulanTerpilih, dalamBulan = bulanTerpilih !== 0 && s.bulan === bulanTerpilih
    if (!dalamKum && !dalamBulan) continue
    const porsi = porsiTahap(s, semua, nilai)
    const e = acc.get(s.userId) ?? { userId: s.userId, bulan: { tahap: 0, nilai: 0, order: new Set() }, kumulatif: { tahap: 0, nilai: 0, order: new Set() } }
    if (dalamBulan) { e.bulan.tahap++; e.bulan.nilai += porsi; e.bulan.order.add(s.orderId) }
    if (dalamKum) { e.kumulatif.tahap++; e.kumulatif.nilai += porsi; e.kumulatif.order.add(s.orderId) }
    acc.set(s.userId, e)
  }
  const rapi = (x) => ({ tahap: x.tahap, order: x.order.size, nilai: r2(x.nilai) })
  const out = [...acc.values()].map(e => ({ userId: e.userId, bulan: rapi(e.bulan), kumulatif: rapi(e.kumulatif) })).sort((a, b) => b.kumulatif.nilai - a.kumulatif.nilai)
  const jml = (k, f) => r2(out.reduce((a, b) => a + b[k][f], 0))
  return { orang: out, total: { bulan: { tahap: jml('bulan', 'tahap'), nilai: jml('bulan', 'nilai') }, kumulatif: { tahap: jml('kumulatif', 'tahap'), nilai: jml('kumulatif', 'nilai') } } }
}

/** aksi: [{userId, bulan(1-12)}] → per orang 12 bulan + total, urut total terbanyak. */
export function bebanKerja(aksi) {
  const m = new Map()
  for (const a of aksi) { const e = m.get(a.userId) ?? { userId: a.userId, bulan: Array(12).fill(0), total: 0 }; e.bulan[a.bulan - 1]++; e.total++; m.set(a.userId, e) }
  return [...m.values()].sort((a, b) => b.total - a.total)
}
export { r1, r2 }

// ── Rekap kerja per orang per bulan (adaptasi OGS WorkerMonthWorkLogService): kartu yang dipegang, tahap, lama di tangan (jam kerja bersih) ──
import { jamKerja } from './jamKerja.js'
/**
 * baris: [{id, judul, klien, namaTahap, status, ditugaskanPada, mulaiPada, selesaiPada}]. Jendela = [awal, akhir) bulan; berjalan dipotong `sekarang`.
 * Lama di tangan = jam kerja bersih (tanpa libur/Minggu/istirahat) dari max(mulai ?? ditugaskan, awal jendela) sampai min(selesai ?? sekarang, akhir jendela).
 */
export function rekapKerjaBulan(baris, awal, akhir, sekarang = new Date(), libur = new Set(), jadwal = undefined) {
  const batas = new Date(Math.min(akhir.getTime(), sekarang.getTime()))
  const rows = []
  for (const b of baris) {
    const mulai = new Date(b.mulaiPada ?? b.ditugaskanPada), selesai = b.selesaiPada ? new Date(b.selesaiPada) : null
    if (mulai >= akhir || (selesai && selesai < awal)) continue
    const a = new Date(Math.max(mulai.getTime(), awal.getTime())), z = new Date(Math.min((selesai ?? batas).getTime(), batas.getTime()))
    const jam = z > a ? jamKerja(a, z, libur, jadwal) : 0
    rows.push({ id: b.id, judul: b.judul, klien: b.klien, tahap: b.namaTahap, status: b.status, mulai, selesai, jam, selesaiBulanIni: !!selesai && selesai >= awal && selesai < akhir })
  }
  rows.sort((x, y) => y.jam - x.jam)
  const total = Math.round(rows.reduce((a, r) => a + r.jam, 0) * 100) / 100
  return { rows, total: { kartu: rows.length, selesai: rows.filter(r => r.selesaiBulanIni).length, jam: total, rataJam: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0 } }
}
