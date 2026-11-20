// JAM KERJA BERSIH (acuan OGS BusinessHoursCalculator): Senin–Jumat 09:00–17:00, Sabtu 09:00–16:00, dikurangi istirahat
// (Senin–Kamis 12–13, Jumat 11:30–13:30, Sabtu 12–13); Minggu dan hari libur kalender = 0. Zona waktu WIB (UTC+7).
// Murni (tanpa database): daftar libur diberikan pemanggil sebagai Set 'YYYY-MM-DD'.
const WIB = 7 * 3600 * 1000
const HARI = 86400000
const mnt = (j, m = 0) => j * 60 + m
export const JADWAL = {
  1: { kerja: [mnt(9), mnt(17)], istirahat: [mnt(12), mnt(13)] },
  2: { kerja: [mnt(9), mnt(17)], istirahat: [mnt(12), mnt(13)] },
  3: { kerja: [mnt(9), mnt(17)], istirahat: [mnt(12), mnt(13)] },
  4: { kerja: [mnt(9), mnt(17)], istirahat: [mnt(12), mnt(13)] },
  5: { kerja: [mnt(9), mnt(17)], istirahat: [mnt(11, 30), mnt(13, 30)] },
  6: { kerja: [mnt(9), mnt(16)], istirahat: [mnt(12), mnt(13)] },
}
export const AMBANG_SETENGAH_HARI = 3.5 // jam (OGS HALF_DAY_HOURS)
export const AMBANG_SEHARI = 7.0       // jam (OGS FULL_DAY_HOURS)

/** 'YYYY-MM-DD' menurut WIB. */
export const kunciTanggalWIB = (d) => new Date(new Date(d).getTime() + WIB).toISOString().slice(0, 10)

/** Menit kerja bersih antara dua waktu (Date/ISO). */
/** jadwal = jadwal unit (16 Nov 2026, jam kerja per unit — utils/jamKerjaUnit.js); bawaan JADWAL. */
export function menitKerja(mulai, selesai, libur = new Set(), jadwal = JADWAL) {
  const a = new Date(mulai).getTime() + WIB
  const b = new Date(selesai).getTime() + WIB
  if (!(b > a)) return 0
  let total = 0
  for (let hari = Math.floor(a / HARI) * HARI; hari <= Math.floor(b / HARI) * HARI; hari += HARI) {
    const dow = new Date(hari).getUTCDay()
    const j = jadwal[dow]
    if (!j || libur.has(new Date(hari).toISOString().slice(0, 10))) continue
    const s = Math.max(a, hari + j.kerja[0] * 60000), e = Math.min(b, hari + j.kerja[1] * 60000)
    if (e <= s) continue
    let menit = (e - s) / 60000
    const os = Math.max(s, hari + j.istirahat[0] * 60000), oe = Math.min(e, hari + j.istirahat[1] * 60000)
    if (oe > os) menit -= (oe - os) / 60000
    total += menit
  }
  return Math.max(0, Math.round(total))
}

export const jamKerja = (mulai, selesai, libur, jadwal = JADWAL) => Math.round((menitKerja(mulai, selesai, libur, jadwal) / 60) * 100) / 100

/** Penanda warna lama berjalan: ok < 3,5 jam ≤ warn < 7 jam ≤ bad (acuan OGS ProductionPulseService::tone). */
export const nada = (jam) => (jam >= AMBANG_SEHARI ? 'bad' : jam >= AMBANG_SETENGAH_HARI ? 'warn' : 'ok')
