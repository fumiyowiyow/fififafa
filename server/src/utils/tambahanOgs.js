// Timeline order, Jenis Order, Laporan harian marketer, Checklist setoran — adaptasi OGS (TimelineController, JenisOrderService,
// MarketerDailyReportBuilder, CreateMarketerIncomeChecklists). MURNI — tanpa database. Tanggal 'YYYY-MM-DD' WIB.
const HARI = 86400000
const r1 = (n) => Math.round(n * 10) / 10
const tgl = (s) => new Date(s + 'T00:00:00Z')
const selisihHari = (dari, ke) => Math.round((tgl(ke) - tgl(dari)) / HARI)
export const JENIS_KLIEN = ['PREVIEW_KLIEN', 'MENUNGGU_KLIEN', 'REVISI_KLIEN']

// ── Timeline ─────────────────────────────────────────────────────────────────────────────────────
/** o: {tanggalMasuk, deadline, tanggalSelesai, status, statusBayar, nilaiKotor}, riwayat: [{jenis, mulai, selesai}], penanggung: [nama]. kunci: Date → 'YYYY-MM-DD' WIB */
export function barisTimeline({ o, riwayat, penanggung, hariIni, sekarang, kunci }) {
  const masuk = kunci(o.tanggalMasuk), dl = o.deadline ? kunci(o.deadline) : null
  const sisa = dl ? selisihHari(hariIni, dl) : null
  const hariPlan = dl && dl > masuk ? r1(selisihHari(masuk, dl)) : 0
  const urut = [...riwayat].sort((a, b) => new Date(a.mulai) - new Date(b.mulai))
  const mulaiKerja = urut.find(r => r.jenis !== 'MASUK')
  const selesai = o.status === 'SELESAI'
  const akhir = selesai ? new Date(o.tanggalSelesai ?? sekarang) : sekarang
  const hariAktual = mulaiKerja ? r1(Math.max(0, (akhir - new Date(mulaiKerja.mulai)) / HARI)) : 0
  const sekarangJenis = urut.filter(r => !r.selesai).at(-1)?.jenis ?? urut.at(-1)?.jenis ?? null
  const badge = selesai ? 'on_track' : !mulaiKerja ? 'belum_start' : sisa != null && sisa < 0 ? 'terlambat' : 'sedang_jalan'
  return {
    sisaHari: sisa, hariPlan, hariAktual, persenAktual: hariPlan > 0 ? Math.min(100, Math.round((hariAktual / hariPlan) * 100)) : 0, badge,
    mulaiKerja: mulaiKerja ? kunci(mulaiKerja.mulai) : null, tanpaPenanggung: penanggung.length === 0 && !selesai,
    belumLunas: o.statusBayar !== 'LUNAS' && o.nilaiKotor > 0,
    perluUpdateDeadline: !selesai && JENIS_KLIEN.includes(sekarangJenis) && sisa != null && sisa < 0,
  }
}
export function kpiTimeline(baris) {
  const aktif = baris.filter(b => !b.selesai)
  return { total: baris.length, terlambat: aktif.filter(b => b.sisaHari != null && b.sisaHari < 0).length, segera: aktif.filter(b => b.sisaHari != null && b.sisaHari >= 0 && b.sisaHari <= 3).length, tanpaPenanggung: aktif.filter(b => b.tanpaPenanggung).length, belumLunas: baris.filter(b => b.belumLunas).length, perluUpdateDeadline: aktif.filter(b => b.perluUpdateDeadline).length }
}
export const urutTimeline = (a, b) => (a.deadline ?? '9999') .localeCompare(b.deadline ?? '9999') || b.hariPlan - a.hariPlan

// ── Jenis Order (jumlah order per akun × kategori dalam periode) ──────────────────────────────────
export function rentangPeriode(view, tanggal) {
  if (view === 'bulan') { const [y, m] = tanggal.slice(0, 7).split('-').map(Number); return { dari: `${tanggal.slice(0, 7)}-01`, sampai: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) } }
  const d = tgl(tanggal), dow = (d.getUTCDay() + 6) % 7, senin = new Date(d.getTime() - dow * HARI)
  return { dari: senin.toISOString().slice(0, 10), sampai: new Date(senin.getTime() + 6 * HARI).toISOString().slice(0, 10) }
}
/** orders: [{akunId, kategori}], akun: Map id → {platform, namaAkun}. Kategori kosong → 'Lainnya'. */
export function hitungJenisOrder(orders, akun) {
  const per = new Map(), kat = new Set()
  for (const o of orders) {
    // order bundling punya beberapa kategori ("3D Modeling + Animation"): masing-masing dihitung satu; total order tetap satu
    const daftarK = [...new Set(String(o.kategori ?? '').split('+').map(x => x.trim()).filter(Boolean))]
    if (!daftarK.length) daftarK.push('Lainnya')
    const e = per.get(o.akunId) ?? { akunId: o.akunId, platform: akun.get(o.akunId)?.platform ?? '—', namaAkun: akun.get(o.akunId)?.namaAkun ?? '—', total: 0, perKategori: {} }
    e.total++
    for (const k of daftarK) { kat.add(k); e.perKategori[k] = (e.perKategori[k] ?? 0) + 1 }
    per.set(o.akunId, e)
  }
  const totalKat = {}; for (const e of per.values()) for (const [k, n] of Object.entries(e.perKategori)) totalKat[k] = (totalKat[k] ?? 0) + n
  return { kategori: [...kat].sort((a, b) => (totalKat[b] - totalKat[a]) || a.localeCompare(b, 'id')), akun: [...per.values()].sort((a, b) => b.total - a.total || a.namaAkun.localeCompare(b.namaAkun, 'id')), total: orders.length, totalKategori: totalKat }
}

// ── Laporan harian marketer (teks siap tempel) ────────────────────────────────────────────────────
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** katalog: [{kunci,label,tahap}]; aktivitas: [{userId, jenis, jumlah, selesai}] ; marketer: [{id, nama}] */
export function susunLaporanHarian({ tanggal, marketer, aktivitas, katalog, tahapLabel }) {
  const d = tgl(tanggal), kat = new Map(katalog.map(k => [k.kunci, k]))
  const L = [`📋 Task Marketer · ${NAMA_HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${NAMA_BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}`, `Ringkasan: ${marketer.length} marketer · ${aktivitas.reduce((a, b) => a + b.jumlah, 0)} aktivitas`, '']
  const blok = marketer.map(m => {
    const mine = aktivitas.filter(a => a.userId === m.id), total = mine.reduce((a, b) => a + b.jumlah, 0)
    const baris = [`── ${m.nama} · ${total} ──`]
    if (!mine.length) baris.push('(belum ada aktivitas hari ini)')
    else {
      for (const [kunciTahap, label] of Object.entries(tahapLabel)) {
        const t = mine.filter(a => kat.get(a.jenis)?.tahap === kunciTahap); if (!t.length) continue
        const rinci = new Map(); for (const a of t) { const l = a.jenis === 'lainnya' && a.judul ? a.judul.trim() : (kat.get(a.jenis)?.label ?? a.jenis); rinci.set(l, (rinci.get(l) ?? 0) + a.jumlah) }
        baris.push(`${label.padEnd(9)} ${t.reduce((a, b) => a + b.jumlah, 0)}  (${[...rinci].map(([l, n]) => `${n} ${l}`).join(', ')})`)
      }
      const buka = mine.filter(a => !a.selesai).length; if (buka) baris.push(`⚠ ${buka} aktivitas belum selesai`)
    }
    return { total, baris }
  }).sort((a, b) => b.total - a.total)
  for (const b of blok) L.push(...b.baris, '')
  if (!blok.length) L.push('Tidak ada marketer untuk dilaporkan.', '')
  return L.join('\n').trimEnd()
}

// ── Checklist setoran: periode tanggal 11 & 24 ─────────────────────────────────────────────────────
/** Periode yang sudah tiba (≤ hari ini) dalam `bulanMundur` bulan terakhir, terbaru dulu. */
export function periodeSetoran(hariIni, bulanMundur = 2) {
  const [y, m] = hariIni.split('-').map(Number), out = []
  for (let i = 0; i < bulanMundur; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1)), ym = d.toISOString().slice(0, 7)
    for (const h of ['24', '11']) if (`${ym}-${h}` <= hariIni) out.push(`${ym}-${h}`)
  }
  return out
}
