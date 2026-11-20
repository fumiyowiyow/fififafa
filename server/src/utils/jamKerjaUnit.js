import prisma from '../prisma.js'
import { JADWAL } from './jamKerja.js'
import { jamResmi, statusSesi, hariIniWIB } from './kehadiran.js'

// JAM KERJA PER UNIT + PULANG OTOMATIS (16 Nov 2026, masukan timLangit). Satu sumber jadwal untuk presensi (jam resmi, potongan istirahat,
// terlambat, lembur otomatis, rekap, kehadiran tim) dan Analitik (jam kerja bersih order). Diatur Koordinator unit (CEO unit, Aturan 8b);
// unit tanpa pengaturan = jadwal bawaan JADWAL. Format simpan: { "1": { kerja: ["08:30","16:30"], istirahat: ["11:30","13:00"] } | null, … "6" }.
const HARI = 86400000
const HH = /^([01]\d|2[0-3]):[0-5]\d$/
export const NAMA_HARI = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' }
export const keMenit = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const keTeks = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Jadwal format menit (dipakai fungsi murni) → format teks (untuk tampilan / form). */
export const jadwalKeTeks = (j) => Object.fromEntries(Object.keys(NAMA_HARI).map(d => [d, j[d] ? { kerja: j[d].kerja.map(keTeks), istirahat: j[d].istirahat.map(keTeks) } : null]))

/** Format simpan → format menit. Hari yang isiannya rusak memakai jadwal bawaan hari itu (tidak pernah melempar). */
export function jadwalDariSimpan(simpan) {
  const out = {}
  for (const d of Object.keys(NAMA_HARI)) {
    const h = simpan?.[d]
    if (h === null) { out[d] = null; continue }
    const ok = h && HH.test(h.kerja?.[0] ?? '') && HH.test(h.kerja?.[1] ?? '') && HH.test(h.istirahat?.[0] ?? '') && HH.test(h.istirahat?.[1] ?? '')
    out[d] = ok ? { kerja: h.kerja.map(keMenit), istirahat: h.istirahat.map(keMenit) } : JADWAL[d] ?? null
  }
  return out
}

/** Validasi isian Koordinator. Istirahat kosong = tanpa istirahat (disimpan selebar nol di jam mulai). */
export function validasiJadwal(input) {
  const out = {}
  for (const [d, nama] of Object.entries(NAMA_HARI)) {
    const h = input?.[d]
    if (!h) { out[d] = null; continue }
    const [m, p] = h.kerja ?? []
    if (!HH.test(m ?? '') || !HH.test(p ?? '')) return { galat: `${nama}: jam masuk & pulang harus HH:MM` }
    if (keMenit(p) <= keMenit(m)) return { galat: `${nama}: jam pulang harus setelah jam masuk` }
    let [a, b] = h.istirahat ?? []
    if (!a && !b) { a = m; b = m } else {
      if (!HH.test(a ?? '') || !HH.test(b ?? '')) return { galat: `${nama}: jam istirahat harus HH:MM (atau kosongkan keduanya)` }
      if (keMenit(b) <= keMenit(a)) return { galat: `${nama}: akhir istirahat harus setelah mulainya` }
      if (keMenit(a) < keMenit(m) || keMenit(b) > keMenit(p)) return { galat: `${nama}: istirahat harus di dalam jam kerja` }
    }
    out[d] = { kerja: [m, p], istirahat: [a, b] }
  }
  if (!Object.values(out).some(Boolean)) return { galat: 'Minimal satu hari kerja' }
  return { data: out }
}

/** Pengaturan jam kerja satu unit (selalu ada isi: bawaan bila belum diatur). */
export async function jamKerjaUnit(studioId) {
  const r = studioId ? await prisma.jamKerjaUnit.findUnique({ where: { studioId } }) : null
  return { jadwal: r ? jadwalDariSimpan(r.jadwal) : JADWAL, diatur: !!r, pulangOtomatis: !!r?.pulangOtomatis, batasPulang: r?.batasPulang ?? null, aktifSejak: r?.aktifSejak ?? null, diubahOleh: r?.diubahOleh ?? null, updatedAt: r?.updatedAt ?? null }
}
export const jadwalUnit = async (studioId) => (await jamKerjaUnit(studioId)).jadwal

/** Unit kerja seseorang (peran selain Dignity), opsional dibatasi `whereStudio` (lingkup alamat web). */
export async function unitOrang(userId, whereStudio = undefined) {
  const r = await prisma.userRole.findMany({ where: { userId, roleType: { not: 'DIGNITY' }, studioId: { not: null }, ...(whereStudio ? { studio: whereStudio } : {}) }, select: { studioId: true } })
  return [...new Set(r.map(x => x.studioId))]
}
/**
 * Unit yang jadwalnya berlaku untuk presensi seseorang pada suatu hari: unit yang tercatat di presensi MASUK hari itu → unit yang diminta
 * (unit di sidebar) bila ia memang bekerja di sana → satu-satunya unitnya → null (jadwal bawaan).
 */
export async function unitPresensi(userId, { studioMasuk = null, diminta = null, whereStudio } = {}) {
  if (studioMasuk) return studioMasuk
  const ids = await unitOrang(userId, whereStudio)
  if (diminta && ids.includes(diminta)) return diminta
  return ids.length === 1 ? ids[0] : null
}

const mutlak = (tgl, hhmm) => new Date(`${tgl}T${hhmm}:00+07:00`)
/**
 * PULANG OTOMATIS (dipanggil cron md-bot tiap 10 menit, juga aman dipanggil berulang): untuk unit yang menyalakannya, sesi hari ini /
 * kemarin yang punya MASUK tanpa PULANG ditutup setelah jam `batasPulang` — waktu pulang = jam pulang resmi unit (atau saat masuk / izin
 * keluar terakhir bila lebih akhir), bertanda otomatis. Tidak membuat lembur. Sesi sebelum `aktifSejak` tidak disentuh.
 */
export async function tutupPulangOtomatis(sekarang = new Date()) {
  const unit = await prisma.jamKerjaUnit.findMany({ where: { pulangOtomatis: true, batasPulang: { not: null } } })
  if (!unit.length) return { ditutup: 0 }
  const hariIni = hariIniWIB(sekarang), kemarin = new Date(new Date(hariIni + 'T00:00:00Z').getTime() - HARI).toISOString().slice(0, 10)
  const libur = new Map((await prisma.hariLiburKerja.findMany({ where: { tanggal: { gte: new Date(kemarin + 'T00:00:00Z'), lte: new Date(hariIni + 'T00:00:00Z') } }, select: { tanggal: true, jenis: true } })).map(b => [b.tanggal.toISOString().slice(0, 10), b.jenis]))
  let ditutup = 0
  for (const u of unit) {
    const jadwal = jadwalDariSimpan(u.jadwal)
    for (const tgl of [kemarin, hariIni]) {
      const batas = mutlak(tgl, u.batasPulang)
      if (sekarang < batas) continue
      const jam = jamResmi(tgl, libur, jadwal)
      const masuk = await prisma.kehadiranEvent.findMany({ where: { tanggalKerja: new Date(tgl + 'T00:00:00Z'), jenis: 'MASUK', ...(u.aktifSejak ? { dicatatPada: { gte: u.aktifSejak } } : {}) }, orderBy: { dicatatPada: 'asc' } })
      const sudah = new Set()
      for (const m of masuk) {
        if (sudah.has(m.userId)) continue
        sudah.add(m.userId)
        // presensi MASUK lama tanpa unit: milik unit ini bila orangnya hanya bekerja di unit ini
        if (m.studioId ? m.studioId !== u.studioId : (await unitOrang(m.userId)).join() !== u.studioId) continue
        const ev = await prisma.kehadiranEvent.findMany({ where: { userId: m.userId, tanggalKerja: m.tanggalKerja }, orderBy: [{ dicatatPada: 'asc' }, { id: 'asc' }] })
        const ss = statusSesi(ev)
        if (ss.status === 'pulang' || ss.status === 'belum_hadir') continue
        const waktu = new Date(Math.min(batas.getTime(), Math.max(jam?.selesai?.getTime() ?? batas.getTime(), new Date(ss.masuk.dicatatPada).getTime() + 60000, ss.keluarTerbuka ? new Date(ss.keluarTerbuka.dicatatPada).getTime() : 0)))
        const data = []
        if (ss.keluarTerbuka) data.push({ userId: m.userId, tanggalKerja: m.tanggalKerja, jenis: 'KEMBALI', dicatatPada: waktu, studioId: u.studioId, otomatis: true, catatan: 'Otomatis — izin keluar ditutup saat pulang otomatis' })
        data.push({ userId: m.userId, tanggalKerja: m.tanggalKerja, jenis: 'PULANG', dicatatPada: waktu, studioId: u.studioId, otomatis: true, catatan: `Pulang otomatis (belum presensi pulang sampai ${u.batasPulang})` })
        await prisma.kehadiranEvent.createMany({ data })
        ditutup++
      }
    }
  }
  return { ditutup }
}
