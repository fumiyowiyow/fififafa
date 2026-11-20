// PENGINGAT TELEGRAM (adaptasi OGS SendDailyPlan / SendDeadlineDeliveryReminder / SendMarketerIncomeReminder / SendOverdueExpenseReminder /
// SendInactiveTodayReminder / SendMarketerDailyReport). Pembentuk pesan — MURNI, tanpa database. Teks polos (tanpa Markdown) agar aman dikirim.
export const JENIS_PENGINGAT = {
  rencana: 'Rencana harian (tugas aktif per orang)',
  delivery: 'Delivery H-1…H-5 (pengelola unit)',
  biaya: 'Biaya jatuh tempo / terlambat (pengelola unit)',
  presensi: 'Belum presensi datang',
  laporanMarketer: 'Laporan harian marketer (pengelola unit)',
}
const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const lbl = (sisa) => (sisa < 0 ? `telat ${-sisa} hari` : sisa === 0 ? 'HARI INI' : `H-${sisa}`)
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const tglPendek = (t) => { const [y, m, d] = t.split('-').map(Number); return `${d} ${NAMA_BLN[m - 1]}` }

/** tugas: [{judul, tahap, sisa|null, mendesak}] sudah berurutan antrean. */
export function pesanRencana(nama, tugas, maks = 8) {
  if (!tugas.length) return null
  const baris = tugas.slice(0, maks).map((t, i) => `${i + 1}. ${t.mendesak ? '🔥 ' : ''}${t.judul} — ${t.tahap}${t.sisa != null ? ` (${lbl(t.sisa)})` : ''}`)
  return `🗓 Rencana hari ini, ${nama.split(' ')[0]}\n\n${baris.join('\n')}${tugas.length > maks ? `\n…dan ${tugas.length - maks} tugas lagi` : ''}\n\nBuka web circle → Tugas saya.`
}
/** orders: [{judul, klien, sisa}] dengan sisa 1..5 */
export function pesanDelivery(studio, orders) {
  if (!orders.length) return null
  const per = new Map(); for (const o of orders) { if (!per.has(o.sisa)) per.set(o.sisa, []); per.get(o.sisa).push(o) }
  const bagian = [...per.entries()].sort((a, b) => a[0] - b[0]).map(([s, l]) => `H-${s}: ${l.map(o => o.judul).join(', ')}`)
  return `📦 ${studio}: ${orders.length} order mendekati delivery\n\n${bagian.join('\n')}`
}
/** biaya: [{kategori, deskripsi, jumlah, jatuhTempo 'YYYY-MM-DD'}], hari ini 'YYYY-MM-DD' */
export function pesanBiaya(studio, biaya, hari) {
  if (!biaya.length) return null
  const total = biaya.reduce((a, b) => a + b.jumlah, 0)
  const baris = biaya.slice(0, 8).map(b => `• ${b.deskripsi || b.kategori} — ${rp(b.jumlah)} (${b.jatuhTempo < hari ? `telat sejak ${tglPendek(b.jatuhTempo)}` : 'jatuh tempo hari ini'})`)
  return `🧾 ${studio}: ${biaya.length} biaya perlu dibayar, total ${rp(total)}\n\n${baris.join('\n')}${biaya.length > 8 ? `\n…dan ${biaya.length - 8} lagi` : ''}`
}
export const pesanPresensi = (nama, jamMulai) => `⏰ Halo ${nama.split(' ')[0]}, kamu belum presensi datang hari ini (jam kerja mulai ${jamMulai}).\n\nBuka web circle → Kehadiran. Kalau izin/sakit, ajukan lewat tab Izin.`
