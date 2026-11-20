// ATURAN LEMBUR PER UNIT (21 Okt 2026) — murni (tanpa database) supaya bisa diuji (tes/uji-lembur-aturan.mjs).
// Keputusan user: aturan lembur beda-beda tiap studio, jadi KOORDINATOR UNIT yang menentukannya sendiri di web circle.
// Hanya lembur berstatus DISETUJUI yang dihitung. Perhitungan per HARI kerja (tanggalKerja WIB), lalu dibatasi per bulan.
import { hariLibur } from './kehadiran.js'

export const MODE_LEMBUR = {
  PER_JAM: 'Per jam (tarif × jam)',
  BERTINGKAT: 'Bertingkat (jam-jam awal & berikutnya beda tarif)',
  PER_HARI: 'Per hari lembur (tarif tetap per hari)',
  PER_PROYEK: 'Per project (nilai per order, diisi koordinator saat menyetujui)',
  PER_LEVEL: 'Per level & progres (fee level × progres yang dikerjakan)',
  TIDAK_DIBAYAR: 'Tidak dibayar (dicatat saja)',
}
// Mode lama berbasis JAM (warisan OGS). Keputusan user 10 Nov 2026: lembur Ekosistem = fee pekerjaan, bukan per jam → mode ini DISEMBUNYIKAN
// dari pilihan (kecuali unit yang sudah memakainya), tetap dihitung bila masih dipakai. Hanya mode ini yang mewajibkan jam mulai–selesai.
export const MODE_JAM = ['PER_JAM', 'BERTINGKAT', 'PER_HARI']
/** Pilihan mode yang ditampilkan ke koordinator: mode berbasis pekerjaan + mode yang sedang dipakai unit itu. */
export const pilihanMode = (modeSekarang) => Object.fromEntries(Object.entries(MODE_LEMBUR).filter(([k]) => !MODE_JAM.includes(k) || k === modeSekarang))
export const PEMBULATAN = [0, 15, 30, 60]
export const ATURAN_BAWAAN = { mode: 'PER_JAM', tarifPerJam: null, tingkat: null, tarifPerHari: null, pengaliLibur: 1, minimalMenit: 0, pembulatanMenit: 0, batasJamBulanan: null, perluPersetujuan: true, otomatisPerluSetuju: false, catatan: null }

const angka = (v) => (v === '' || v == null ? null : Number(v))

/** Validasi & rapikan isian aturan dari koordinator. { data } | { galat } */
export function validasiAturan(b = {}) {
  const mode = b.mode ?? 'PER_JAM'
  if (!MODE_LEMBUR[mode]) return { galat: `mode harus salah satu: ${Object.keys(MODE_LEMBUR).join(', ')}` }
  const out = { mode }
  const positif = (v, nama, { boleh0 = false } = {}) => { const n = angka(v); if (n == null) return null; if (!Number.isFinite(n) || n < 0 || (!boleh0 && n === 0)) throw new Error(`${nama} harus angka ${boleh0 ? '≥ 0' : '> 0'}`); return n }
  try {
    out.tarifPerJam = positif(b.tarifPerJam, 'Tarif per jam')
    out.tarifPerHari = positif(b.tarifPerHari, 'Tarif per hari')
    out.pengaliLibur = positif(b.pengaliLibur ?? 1, 'Pengali hari libur') ?? 1
    if (out.pengaliLibur > 5) return { galat: 'Pengali hari libur maksimal 5×' }
    out.minimalMenit = Math.round(positif(b.minimalMenit ?? 0, 'Minimal menit', { boleh0: true }) ?? 0)
    if (out.minimalMenit > 600) return { galat: 'Minimal menit maksimal 600' }
    out.pembulatanMenit = Number(b.pembulatanMenit ?? 0)
    if (!PEMBULATAN.includes(out.pembulatanMenit)) return { galat: `Pembulatan harus ${PEMBULATAN.join(', ')} menit` }
    out.batasJamBulanan = positif(b.batasJamBulanan, 'Batas jam per bulan')
    if (out.batasJamBulanan != null && out.batasJamBulanan > 300) return { galat: 'Batas jam per bulan maksimal 300' }
  } catch (e) { return { galat: e.message } }
  out.perluPersetujuan = b.perluPersetujuan ?? true
  out.otomatisPerluSetuju = !!b.otomatisPerluSetuju
  out.catatan = b.catatan ? String(b.catatan).slice(0, 500) : null
  out.tingkat = null
  if (mode === 'PER_JAM' && !out.tarifPerJam) return { galat: 'Isi tarif per jam' }
  if (mode === 'PER_HARI' && !out.tarifPerHari) return { galat: 'Isi tarif per hari' }
  if (mode === 'BERTINGKAT') {
    const t = Array.isArray(b.tingkat) ? b.tingkat : []
    if (t.length < 1 || t.length > 5) return { galat: 'Isi 1–5 tingkat tarif' }
    const rapi = []
    for (const [i, x] of t.entries()) {
      const tarif = angka(x?.tarifPerJam), sampai = angka(x?.sampaiJam)
      if (!Number.isFinite(tarif) || tarif <= 0) return { galat: `Tingkat ${i + 1}: tarif per jam harus > 0` }
      const terakhir = i === t.length - 1
      if (!terakhir && !(sampai > 0)) return { galat: `Tingkat ${i + 1}: isi "sampai jam ke-" (hanya tingkat terakhir yang boleh kosong)` }
      if (sampai != null && i > 0 && !(sampai > rapi[i - 1].sampaiJam)) return { galat: `Tingkat ${i + 1}: batas jam harus lebih besar dari tingkat sebelumnya` }
      rapi.push({ sampaiJam: terakhir && sampai == null ? null : sampai, tarifPerJam: tarif })
    }
    out.tingkat = rapi
  }
  return { data: out }
}

/** Uang untuk `jam` lembur dalam SATU hari menurut tingkat bertingkat. */
function uangBertingkat(jam, tingkat) {
  let sisa = jam, dari = 0, uang = 0
  for (const t of tingkat) {
    const atas = t.sampaiJam ?? Infinity
    const porsi = Math.max(0, Math.min(sisa, atas - dari))
    uang += porsi * t.tarifPerJam; sisa -= porsi; dari = atas
    if (sisa <= 0) break
  }
  return uang
}

/**
 * Hitung lembur sebulan untuk SATU orang di SATU unit.
 * baris: [{ tanggalKerja: Date|ISO, menit, status }] · aturan: PengaturanLembur (null = bawaan, tanpa tarif) · hariKhusus: Map 'YYYY-MM-DD' → 'LIBUR'|'WFA'
 * → { menit, jam, hari, uang, adaTarif, rincian: [{ tanggal, menitTercatat, menitDihitung, libur, uang }] }
 */
export function hitungLembur(baris = [], aturan = null, hariKhusus = new Map()) {
  const a = { ...ATURAN_BAWAAN, ...(aturan ?? {}) }
  const per = new Map(), nilaiHari = new Map()
  for (const b of baris) {
    if ((b.status ?? 'DISETUJUI') !== 'DISETUJUI') continue
    const tgl = new Date(b.tanggalKerja).toISOString().slice(0, 10)
    per.set(tgl, (per.get(tgl) ?? 0) + (b.menit ?? 0))
    nilaiHari.set(tgl, (nilaiHari.get(tgl) ?? 0) + (Number(b.nilaiProyek) || 0))
  }
  // PER_PROYEK (9 Nov 2026): uang = nilai per order yang diisi koordinator saat menyetujui (bukan dari jam; pengali libur & batas jam tidak berlaku)
  const adaTarif = a.mode === 'PER_JAM' ? a.tarifPerJam > 0 : a.mode === 'PER_HARI' ? a.tarifPerHari > 0 : a.mode === 'BERTINGKAT' ? Array.isArray(a.tingkat) && a.tingkat.length > 0 : a.mode === 'PER_PROYEK' || a.mode === 'PER_LEVEL'
  let sisaBatas = a.batasJamBulanan != null ? a.batasJamBulanan * 60 : Infinity
  const rincian = []
  let menitTotal = 0, uang = 0, hari = 0
  for (const tgl of [...per.keys()].sort()) {
    const tercatat = per.get(tgl)
    let m = tercatat < (a.minimalMenit || 0) ? 0 : tercatat
    if (a.pembulatanMenit > 0) m = Math.floor(m / a.pembulatanMenit) * a.pembulatanMenit
    m = Math.min(m, sisaBatas); sisaBatas -= m
    const libur = hariLibur(tgl, hariKhusus)
    const pengali = libur ? (a.pengaliLibur || 1) : 1
    let u = 0
    if (a.mode === 'PER_PROYEK' || a.mode === 'PER_LEVEL') { u = nilaiHari.get(tgl) ?? 0; m = tercatat }
    else if (m > 0 && adaTarif) {
      if (a.mode === 'PER_JAM') u = (m / 60) * a.tarifPerJam * pengali
      else if (a.mode === 'BERTINGKAT') u = uangBertingkat(m / 60, a.tingkat) * pengali
      else if (a.mode === 'PER_HARI') u = a.tarifPerHari * pengali
    }
    u = Math.round(u)
    if (m > 0) { hari++; menitTotal += m }
    uang += u
    rincian.push({ tanggal: tgl, menitTercatat: tercatat, menitDihitung: m, libur, uang: u })
  }
  return { menit: menitTotal, jam: Math.round((menitTotal / 60) * 100) / 100, hari, uang, adaTarif, rincian }
}

/** Status awal lembur baru menurut aturan unit. */
export const statusAwal = (sumber, aturan) => {
  const a = { ...ATURAN_BAWAAN, ...(aturan ?? {}) }
  if (sumber === 'MANUAL') return a.perluPersetujuan ? 'MENUNGGU' : 'DISETUJUI'
  return a.otomatisPerluSetuju ? 'MENUNGGU' : 'DISETUJUI'
}

/** Validasi progres 0–100 (%) → pecahan 0–1. { awal, akhir } | { galat }. Akhir harus > awal (acuan Sekai Land: fee × (akhir − awal)). */
export function validasiProgres(awalPersen, akhirPersen) {
  const a = Number(awalPersen), b = Number(akhirPersen)
  if (awalPersen === '' || awalPersen == null || akhirPersen === '' || akhirPersen == null || !Number.isFinite(a) || !Number.isFinite(b)) return { galat: 'Isi progres awal dan akhir (0–100%)' }
  if (a < 0 || b > 100) return { galat: 'Progres harus antara 0 dan 100%' }
  if (b <= a) return { galat: 'Progres akhir harus lebih besar dari progres awal' }
  return { awal: a / 100, akhir: b / 100 }
}
/** Uang lembur per level: fee level (terkunci saat dicatat) × (progres akhir − progres awal), dibulatkan ke rupiah. */
export const nilaiLevel = (fee, awal, akhir) => Math.round(Number(fee) * (Number(akhir) - Number(awal)))
