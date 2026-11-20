import { JADWAL, kunciTanggalWIB } from './jamKerja.js'

// KEHADIRAN (acuan OGS AttendanceService). MURNI — tanpa database. Semua tanggal 'YYYY-MM-DD' menurut WIB; jam kerja & istirahat dari
// utils/jamKerja.js (Sen–Jum 09–17, Sab 09–16; istirahat otomatis Sen–Kam 12–13, Jum 11:30–13:30, Sab 12–13; Minggu libur).
// Sejak 16 Nov 2026 tiap unit boleh punya jadwal sendiri (JamKerjaUnit): fungsi di bawah menerima `jadwal` (bawaan JADWAL).
export const JENIS_KELUAR = { ISTIRAHAT: 'Istirahat', SHOLAT: 'Sholat', MEROKOK: 'Merokok', KELUAR_STUDIO: 'Keluar studio' }
export const MODE_KERJA = { WFO: 'WFO', WFA: 'WFA' }
export const LOKASI_WFA = { RUMAH_KOS: 'Rumah / kos', CAFE: 'Cafe', LAINNYA: 'Lainnya' }
export const JENIS_CUTI = { SAKIT: 'Sakit', IZIN: 'Izin pribadi', CUTI: 'Cuti', DINAS_LUAR: 'Dinas luar', LAINNYA: 'Lainnya' }
export const DURASI_CUTI = { SEHARI: 'Seharian', SETENGAH_PAGI: 'Setengah hari (pagi)', SETENGAH_SORE: 'Setengah hari (sore)' }
export const TOLERANSI_LEMBUR_MENIT = 30 // OGS overtime_grace_minutes: pulang ≤ 17:30 belum dihitung lembur
const WIB = 7 * 3600000
const MENIT = 60000

const dow = (tgl) => new Date(tgl + 'T00:00:00Z').getUTCDay()
const mutlak = (tgl, menitHari) => new Date(new Date(tgl + 'T00:00:00+07:00').getTime() + menitHari * MENIT)
const jamTeks = (d) => { const w = new Date(new Date(d).getTime() + WIB); return `${String(w.getUTCHours()).padStart(2, '0')}:${String(w.getUTCMinutes()).padStart(2, '0')}` }
export const formatMenit = (m) => { m = Math.max(0, Math.round(m)); if (m < 1) return '0 mnt'; const j = Math.floor(m / 60), s = m % 60; return j ? (s ? `${j} j ${s} mnt` : `${j} j`) : `${s} mnt` }
const tumpang = (a1, a2, b1, b2) => { const s = Math.max(a1, b1), e = Math.min(a2, b2); return e > s ? (e - s) / MENIT : 0 }

/** Jenis hari: LIBUR_MINGGU (Minggu) | LIBUR | WFA | KERJA. hariKhusus: Map 'YYYY-MM-DD' → 'LIBUR'|'WFA'|'LAINNYA'. */
export function jenisHari(tgl, hariKhusus = new Map()) {
  if (dow(tgl) === 0) return 'LIBUR_MINGGU'
  const k = hariKhusus.get(tgl)
  return k === 'LIBUR' ? 'LIBUR' : k === 'WFA' ? 'WFA' : 'KERJA'
}
export const hariLibur = (tgl, hariKhusus) => ['LIBUR', 'LIBUR_MINGGU'].includes(jenisHari(tgl, hariKhusus))
/** Jam kerja resmi hari itu (Date mulai/selesai + jendela istirahat), atau null bila libur. */
export function jamResmi(tgl, hariKhusus = new Map(), jadwal = JADWAL) {
  if (hariLibur(tgl, hariKhusus)) return null
  const j = jadwal[dow(tgl)]
  if (!j) return null
  return { mulai: mutlak(tgl, j.kerja[0]), selesai: mutlak(tgl, j.kerja[1]), istirahatMulai: mutlak(tgl, j.istirahat[0]), istirahatSelesai: mutlak(tgl, j.istirahat[1]), label: `${hhmm(j.kerja[0])} – ${hhmm(j.kerja[1])} WIB`, labelIstirahat: `${hhmm(j.istirahat[0])} – ${hhmm(j.istirahat[1])} WIB` }
}
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Status sesi dari event hari itu (OGS sessionState). events urut waktu. */
export function statusSesi(events) {
  const masuk = events.find(e => e.jenis === 'MASUK') ?? null
  const pulang = events.find(e => e.jenis === 'PULANG') ?? null
  let keluarTerbuka = null
  for (const e of events) { if (e.jenis === 'KELUAR') keluarTerbuka = e; else if (e.jenis === 'KEMBALI') keluarTerbuka = null }
  if (pulang) return { status: 'pulang', masuk, pulang, keluarTerbuka: null }
  if (keluarTerbuka) return { status: 'keluar_sementara', masuk, pulang: null, keluarTerbuka }
  if (masuk) return { status: 'hadir', masuk, pulang: null, keluarTerbuka: null }
  return { status: 'belum_hadir', masuk: null, pulang: null, keluarTerbuka: null }
}

/**
 * Validasi pencatatan (OGS recordEvent). Mengembalikan pesan galat atau null.
 * input: { jenis, jenisKeluar, modeKerja, lokasiWfa, catatan }, konteks: { sesi, tgl, hariKhusus, cutiDisetujui, cutiMenunggu }
 */
export function validasiCatat({ jenis, jenisKeluar, modeKerja, lokasiWfa, catatan }, { sesi, tgl, hariKhusus, cutiDisetujui, cutiMenunggu }) {
  if (jenis === 'MASUK') {
    if (sesi.status !== 'belum_hadir') return 'Kamu sudah presensi datang hari ini.'
    if (hariLibur(tgl, hariKhusus)) return 'Hari ini libur — tidak perlu presensi.'
    if (cutiDisetujui?.durasi === 'SEHARI') return 'Hari ini kamu berstatus izin tidak masuk (seharian).'
    if (cutiMenunggu?.durasi === 'SEHARI') return 'Ada pengajuan izin seharian yang masih menunggu persetujuan.'
    if (!['WFO', 'WFA'].includes(modeKerja)) return 'Pilih mode kerja: WFO atau WFA.'
    if (modeKerja === 'WFA') {
      if (!Object.keys(LOKASI_WFA).includes(lokasiWfa)) return 'Pilih lokasi WFA.'
      if (lokasiWfa === 'LAINNYA' && !String(catatan ?? '').trim()) return 'Isi keterangan lokasi untuk WFA Lainnya.'
    }
    return null
  }
  if (jenis === 'KELUAR') {
    if (!Object.keys(JENIS_KELUAR).includes(jenisKeluar)) return 'Pilih jenis izin keluar.'
    if (sesi.status === 'belum_hadir') return 'Catat kehadiran terlebih dahulu.'
    if (sesi.status === 'keluar_sementara') return 'Kamu masih dalam izin keluar. Tap kembali dulu.'
    if (sesi.status !== 'hadir') return 'Tidak bisa izin keluar saat ini.'
    return null
  }
  if (jenis === 'KEMBALI') return sesi.status === 'keluar_sementara' ? null : 'Tidak ada izin keluar yang aktif.'
  if (jenis === 'PULANG') {
    if (sesi.status === 'belum_hadir') return 'Catat kehadiran terlebih dahulu.'
    if (sesi.status === 'keluar_sementara') return `Kamu masih dalam izin keluar. Tap ${sesi.masuk?.modeKerja === 'WFA' ? 'kembali kerja' : 'kembali ke studio'} dulu sebelum pulang.`
    if (sesi.status === 'pulang') return 'Kamu sudah presensi pulang hari ini.'
    return null
  }
  return 'Jenis presensi tidak dikenal.'
}

/** Pasangan keluar–kembali (OGS pairBreaks); yang masih terbuka dihitung sampai `sekarang`. */
export function pasangKeluar(events, sekarang = new Date()) {
  const pasang = []; let buka = null
  for (const e of events) {
    if (e.jenis === 'KELUAR') buka = e
    else if (e.jenis === 'KEMBALI' && buka) { pasang.push({ jenisKeluar: buka.jenisKeluar, label: JENIS_KELUAR[buka.jenisKeluar] ?? buka.jenisKeluar, keluar: buka.dicatatPada, kembali: e.dicatatPada, menit: Math.round((new Date(e.dicatatPada) - new Date(buka.dicatatPada)) / MENIT) }); buka = null }
  }
  if (buka) pasang.push({ jenisKeluar: buka.jenisKeluar, label: JENIS_KELUAR[buka.jenisKeluar] ?? buka.jenisKeluar, keluar: buka.dicatatPada, kembali: null, berjalan: true, menit: Math.round((sekarang - new Date(buka.dicatatPada)) / MENIT) })
  return pasang
}
export function ringkasKeluar(pasang) {
  const perJenis = Object.fromEntries(Object.entries(JENIS_KELUAR).map(([k, l]) => [k, { label: l, menit: 0 }]))
  let total = 0
  for (const p of pasang) { perJenis[p.jenisKeluar].menit += p.menit; total += p.menit }
  return { total, perJenis }
}
/**
 * Potongan istirahat (OGS computeBreakDeductions): istirahat OTOMATIS = irisan jam kerja-nya dengan jendela istirahat resmi; izin keluar manual
 * hanya dipotong di luar jendela itu (tidak dipotong dua kali).
 */
export function potonganIstirahat({ tgl, masuk, pulang, pasang, sekarang = new Date(), hariKhusus, jadwal = JADWAL }) {
  const jam = jamResmi(tgl, hariKhusus, jadwal)
  const akhir = pulang ?? (masuk ? sekarang : null)
  const otomatis = jam && masuk && akhir ? tumpang(new Date(masuk), new Date(akhir), jam.istirahatMulai, jam.istirahatSelesai) : 0
  let manual = 0
  for (const p of pasang) {
    let m = p.menit
    if (jam) m = Math.max(0, m - tumpang(new Date(p.keluar), p.kembali ? new Date(p.kembali) : sekarang, jam.istirahatMulai, jam.istirahatSelesai))
    manual += m
  }
  return { otomatis: Math.round(otomatis), manual, info: jam ? { jadwal: jam.labelIstirahat, terpakaiMenit: Math.round(otomatis) } : null }
}
export function menitKerjaBersih({ masuk, pulang, potongan, sekarang = new Date() }) {
  if (!masuk) return 0
  const kotor = Math.round(((pulang ? new Date(pulang) : sekarang) - new Date(masuk)) / MENIT)
  return Math.max(0, kotor - (potongan.otomatis + potongan.manual))
}
/** Lembur otomatis (OGS syncAutoOvertimeFromCheckout): mulai = akhir jam kerja + toleransi; null bila pulang ≤ itu / hari libur. */
export function lemburOtomatis({ tgl, pulang, hariKhusus, toleransi = TOLERANSI_LEMBUR_MENIT, jadwal = JADWAL }) {
  const jam = jamResmi(tgl, hariKhusus, jadwal)
  if (!jam) return null
  const mulai = new Date(jam.selesai.getTime() + toleransi * MENIT)
  if (new Date(pulang) <= mulai) return null
  const menit = Math.round((new Date(pulang) - mulai) / MENIT)
  return menit >= 1 ? { mulai, selesai: new Date(pulang), menit } : null
}
/** Lembur manual 'HH:MM'–'HH:MM' pada tanggal itu (selesai ≤ mulai → hari berikutnya); harus setelah jam pulang. */
export function validasiLemburManual({ tgl, mulai, selesai, pulang, libur }) {
  if (!/^\d{2}:\d{2}$/.test(mulai ?? '') || !/^\d{2}:\d{2}$/.test(selesai ?? '')) return { galat: 'Jam harus HH:MM' }
  const [mh, mm] = mulai.split(':').map(Number), [sh, sm] = selesai.split(':').map(Number)
  if (mh > 23 || mm > 59 || sh > 23 || sm > 59) return { galat: 'Jam tidak valid' }
  if (!libur && !pulang) return { galat: 'Catat pulang terlebih dahulu.' }
  const a = mutlak(tgl, mh * 60 + mm); let b = mutlak(tgl, sh * 60 + sm)
  if (b <= a) b = new Date(b.getTime() + 86400000)
  if (pulang && a < new Date(pulang)) return { galat: `Waktu mulai harus setelah pulang (${jamTeks(pulang)}).` }
  return { mulai: a, selesai: b, menit: Math.round((b - a) / MENIT) }
}

/** Status presensi satu hari (OGS resolvePresenceStatus). */
export function statusPresensi({ tgl, hariIni, sesi, cutiDisetujui, cutiMenunggu, adaMasuk, hariKhusus }) {
  const jh = jenisHari(tgl, hariKhusus)
  if (['LIBUR', 'LIBUR_MINGGU'].includes(jh)) return 'libur'
  if (cutiDisetujui) return cutiDisetujui.durasi === 'SEHARI' ? 'izin' : adaMasuk ? 'hadir_izin_parsial' : 'izin_parsial'
  if (jh === 'WFA' && !adaMasuk) return 'wfa'
  if (adaMasuk) return 'hadir'
  if (cutiMenunggu) return 'menunggu_izin'
  return tgl === hariIni ? 'belum_presensi' : 'tidak_hadir'
}
export const LABEL_STATUS = { hadir: 'Hadir', hadir_izin_parsial: 'Hadir + izin parsial', izin: 'Izin', izin_parsial: 'Izin parsial', libur: 'Libur', wfa: 'WFA', tidak_hadir: 'Tidak hadir', belum_presensi: 'Belum presensi', menunggu_izin: 'Menunggu izin' }

const tglDari = (x) => new Date(x).toISOString().slice(0, 10)
export const cutiMencakup = (c, tgl) => tglDari(c.mulai) <= tgl && tglDari(c.selesai) >= tgl
export const cutiTumpangTindih = (daftar, mulai, selesai, kecualiId = null) => daftar.some(c => c.id !== kecualiId && ['MENUNGGU', 'DISETUJUI'].includes(c.status) && new Date(c.mulai).toISOString().slice(0, 10) <= selesai && new Date(c.selesai).toISOString().slice(0, 10) >= mulai)

/** Terlambat: masuk pertama tiap hari setelah jam mulai resmi (tanpa toleransi, OGS lateCheckIns). */
export function terlambat({ masukPertama, hariKhusus, jadwal = JADWAL }) {
  const perOrang = new Map()
  for (const m of masukPertama) {
    const jam = jamResmi(m.tgl, hariKhusus, jadwal); if (!jam) continue
    const dicatat = new Date(m.dicatatPada); if (dicatat <= jam.mulai) continue
    const menit = Math.round((dicatat - jam.mulai) / MENIT)
    const e = perOrang.get(m.userId) ?? { userId: m.userId, hariTerlambat: 0, totalMenit: 0, kejadian: [] }
    e.hariTerlambat++; e.totalMenit += menit; e.kejadian.push({ tanggal: m.tgl, masuk: jamTeks(dicatat), jamResmi: jamTeks(jam.mulai), menit }); perOrang.set(m.userId, e)
  }
  return [...perOrang.values()].sort((a, b) => b.totalMenit - a.totalMenit)
}
/**
 * Rekap bulan (OGS monthlyRecap): per orang — hari terlambat, tidak hadir, izin, lembur. Hari libur/Minggu dilewati; hari WFA tidak dihitung bolos.
 * rentangHari: array 'YYYY-MM-DD' (≤ hari ini); masukPertama: Map `${userId}|${tgl}` → Date; cuti: [{userId, mulai, selesai, durasi}] DISETUJUI.
 */
export function rekapBulan({ anggota, rentangHari, hariKhusus, masukPertama, cuti, lembur, jadwal = JADWAL }) {
  const kerja = rentangHari.filter(t => jamResmi(t, hariKhusus, jadwal)).map(t => ({ tgl: t, mulai: jamResmi(t, hariKhusus, jadwal).mulai, wfa: jenisHari(t, hariKhusus) === 'WFA' }))
  const baris = anggota.map(a => {
    let terlambatHari = 0, bolos = 0, izin = 0
    for (const h of kerja) {
      const m = masukPertama.get(`${a.id}|${h.tgl}`)
      const c = cuti.find(x => x.userId === a.id && new Date(x.mulai).toISOString().slice(0, 10) <= h.tgl && new Date(x.selesai).toISOString().slice(0, 10) >= h.tgl)
      if (c?.durasi === 'SEHARI' && !m) { izin++; continue }
      if (m) { if (new Date(m) > h.mulai) terlambatHari++; continue }
      if (h.wfa) continue
      bolos++
    }
    const lb = lembur.filter(l => l.userId === a.id)
    return { userId: a.id, nama: a.nama, hariTerlambat: terlambatHari, hariTidakHadir: bolos, hariIzin: izin, menitLembur: lb.reduce((s, l) => s + l.menit, 0), labelLembur: formatMenit(lb.reduce((s, l) => s + l.menit, 0)), hariLembur: new Set(lb.map(l => new Date(l.tanggalKerja).toISOString().slice(0, 10))).size }
  })
  return { hariKerja: kerja.length, orang: baris }
}

// ── Kalender: acara berulang ────────────────────────────────────────────────────────────────────────────────────────────
/** Apakah acara jatuh pada tanggal tertentu (pengulangan mingguan/bulanan/tahunan; berhenti setelah berulangDihentikan). */
export function acaraPadaTanggal(a, tgl) {
  const awal = new Date(a.tanggal).toISOString().slice(0, 10)
  if (tgl < awal) return false
  if (!a.berulang) return tgl === awal
  if (a.berulangDihentikan && tgl > new Date(a.berulangDihentikan).toISOString().slice(0, 10)) return false
  const A = new Date(awal + 'T00:00:00Z'), T = new Date(tgl + 'T00:00:00Z')
  if (a.berulang === 'MINGGUAN') return Math.round((T - A) / 86400000) % 7 === 0
  if (a.berulang === 'BULANAN') return T.getUTCDate() === A.getUTCDate()
  if (a.berulang === 'TAHUNAN') return T.getUTCDate() === A.getUTCDate() && T.getUTCMonth() === A.getUTCMonth()
  return false
}

// ── Check-in harian ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const EMOSI = { tenang: 'Tenang', senang: 'Senang / antusias', netral: 'Netral / biasa saja', cemas: 'Cemas / khawatir', frustrasi: 'Frustrasi / kesal', sedih: 'Sedih / lelah secara emosional', campur: 'Campur aduk' }
export const FOKUS_PIKIRAN = { pekerjaan: 'Pekerjaan dan prioritas', masalah: 'Masalah yang belum terselesaikan', hubungan: 'Hubungan atau komunikasi', pribadi: 'Urusan pribadi di luar pekerjaan', tidak_dominan: 'Tidak ada hal yang dominan', belum_tahu: 'Belum tahu' }
export const KEBUTUHAN = { fokus: 'Fokus dan waktu tanpa gangguan', kejelasan: 'Kejelasan prioritas atau instruksi', bantuan_tim: 'Bantuan atau diskusi dengan tim', istirahat: 'Istirahat sejenak', mandiri: 'Ruang untuk bekerja mandiri', tidak_khusus: 'Tidak membutuhkan hal khusus' }
export const jamPromptCheckIn = (tgl) => (dow(tgl) === 6 ? '15:45' : '16:45') // OGS PROMPT_AFTER(_SATURDAY)
export function validasiCheckIn(j) {
  if (!Object.keys(EMOSI).includes(j?.emosi)) return 'Pilih perasaan.'
  if (!(Number.isInteger(j.intensitas) && j.intensitas >= 1 && j.intensitas <= 5)) return 'Intensitas harus 1–5.'
  if (!(Number.isInteger(j.kejernihan) && j.kejernihan >= 1 && j.kejernihan <= 5)) return 'Kejernihan pikiran harus 1–5.'
  if (!Object.keys(FOKUS_PIKIRAN).includes(j.fokusPikiran)) return 'Pilih fokus pikiran.'
  if (!Object.keys(KEBUTUHAN).includes(j.kebutuhan)) return 'Pilih kebutuhan.'
  return null
}
/** Agregat tim TANPA data per orang: partisipasi + sebaran emosi/kebutuhan + rata-rata intensitas & kejernihan. */
export function agregatCheckIn({ anggotaIds, baris }) {
  const diisi = baris.filter(b => b.status === 'DIISI'), lewat = baris.filter(b => b.status === 'DILEWATI')
  const tally = (f) => Object.entries(diisi.reduce((a, b) => { a[b[f]] = (a[b[f]] ?? 0) + 1; return a }, {})).map(([kunci, jumlah]) => ({ kunci, jumlah })).sort((x, y) => y.jumlah - x.jumlah)
  const rata = (f) => (diisi.length ? Math.round((diisi.reduce((s, b) => s + b[f], 0) / diisi.length) * 10) / 10 : null)
  const sudah = new Set(baris.map(b => b.userId))
  return { anggota: anggotaIds.length, diisi: diisi.length, dilewati: lewat.length, belum: anggotaIds.filter(id => !sudah.has(id)).length, emosi: tally('emosi').map(e => ({ ...e, label: EMOSI[e.kunci] })), kebutuhan: tally('kebutuhan').map(e => ({ ...e, label: KEBUTUHAN[e.kunci] })), fokusPikiran: tally('fokusPikiran').map(e => ({ ...e, label: FOKUS_PIKIRAN[e.kunci] })), rataIntensitas: rata('intensitas'), rataKejernihan: rata('kejernihan') }
}
export const hariIniWIB = (sekarang = new Date()) => kunciTanggalWIB(sekarang)
export { jamTeks, mutlak }
