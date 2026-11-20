// Kalkulasi THP modul Payroll -- dipisah dari controller biar konsisten dipakai di generate,
// update, dan (kalau nanti perlu) diverifikasi ad-hoc kayak utils/produksi.js.
export const KOMPONEN_DEBET_KEYS = ['gajiPokok', 'bonus', 'komisi', 'lembur', 'shu']

// thp = SUM(gajiPokok+bonus+komisi+lembur+shu) + SUM(tunjangan dinamis) - potongan.
// totalTunjangan DIPISAH sebagai parameter (bukan baca field tetap) karena tunjangan sekarang
// baris dinamis per studio (TunjanganPenggajian) -- caller yang nge-SUM baris-barisnya sendiri
// (dari DB atau dari array yang lagi di-mutasi), fungsi ini gak perlu tahu bentuk penyimpanannya.
export function hitungThp(p, totalTunjangan = 0) {
  const debet = KOMPONEN_DEBET_KEYS.reduce((s, k) => s + (p[k] ?? 0), 0)
  return debet + totalTunjangan - (p.potongan ?? 0)
}

// ── Lembur dari PRESENSI web circle → Payroll (21 Okt 2026) ──────────────────────────────────────────────────────────────
// Lembur Payroll Ekosistem yang lama = progres × rate card (CatatanLembur). Lembur presensi = MENIT setelah jam kerja (LemburKehadiran). Keduanya
// dijumlahkan ke Penggajian.lembur HANYA bila unit mengisi tarif per jam; tanpa tarif, lembur presensi cuma ditampilkan sebagai acuan.
export const ringkasLemburPresensi = (baris, tarifPerJam = null) => {
  const menit = baris.reduce((a, b) => a + b.menit, 0)
  const hari = new Set(baris.map(b => new Date(b.tanggalKerja).toISOString().slice(0, 10))).size
  const uang = tarifPerJam > 0 ? Math.round((menit / 60) * tarifPerJam) : 0
  return { menit, hari, jam: Math.round((menit / 60) * 100) / 100, uang }
}
