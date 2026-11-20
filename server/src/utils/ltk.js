// LTK — Lempar-Terima Kerjaan (adaptasi OGS LtkStatus/LtkDirection/LtkReferenceService). MURNI — tanpa database.
export const ARAH = { TERIMA: 'Terima (PO)', LEMPAR: 'Lempar' }
export const JENIS_PIHAK = { KOMUNITAS: 'Komunitas', FREELANCE: 'Freelance' }
export const STATUS = { DRAFT: 'Draft', DIAJUKAN: 'Diajukan', NEGOSIASI: 'Negosiasi', DEAL: 'Deal', DITOLAK: 'Ditolak', DIBATALKAN: 'Dibatalkan' }
export const PREFIKS = { TERIMA: 'PO', LEMPAR: 'LMP' }
// Perpindahan yang sah. DEAL/DITOLAK/DIBATALKAN final. 9 Nov 2026 (permintaan tim): DRAFT boleh langsung DEAL bila kesepakatan sudah jelas
// (tidak wajib Ajukan → Negosiasi dulu).
const BOLEH = { DRAFT: ['DIAJUKAN', 'DEAL', 'DIBATALKAN'], DIAJUKAN: ['NEGOSIASI', 'DEAL', 'DITOLAK', 'DIBATALKAN'], NEGOSIASI: ['DEAL', 'DITOLAK', 'DIBATALKAN'], DEAL: [], DITOLAK: [], DIBATALKAN: [] }
export const bolehPindah = (dari, ke) => (BOLEH[dari] ?? []).includes(ke)
export const final = (s) => (BOLEH[s] ?? []).length === 0
// 9 Nov 2026 (permintaan tim): LTK salah isi boleh dihapus pada status APA PUN selama belum menjadi order (dulu hanya Draft/Ditolak/Dibatalkan).
// LTK yang sudah jadi order: batalkan/hapus ordernya dulu.
export const bisaDihapus = (k) => !k.orderId
/** Kode berikutnya: PO-2031-0001. `terakhir` = kode terbesar tahun itu untuk arah yang sama (atau null). */
export function kodeBerikut(arah, tahun, terakhir) {
  const m = /-(\d+)$/.exec(terakhir ?? ''); const n = m ? Number(m[1]) + 1 : 1
  return `${PREFIKS[arah]}-${tahun}-${String(n).padStart(4, '0')}`
}
const tautanOk = (u) => { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) } catch { return false } }
export function bersihTautan(arr) {
  if (arr == null) return { data: [] }
  if (!Array.isArray(arr) || arr.length > 5) return { galat: 'Tautan rujukan maksimal 5.' }
  const b = arr.map(x => String(x).trim()).filter(Boolean)
  return b.every(tautanOk) ? { data: b } : { galat: 'Tautan harus diawali http:// atau https://.' }
}
export function validasiBuat(b) {
  if (!Object.keys(ARAH).includes(b?.arah)) return 'arah harus TERIMA atau LEMPAR'
  if (!Object.keys(JENIS_PIHAK).includes(b.jenisPihak)) return 'jenisPihak harus KOMUNITAS atau FREELANCE'
  if (!String(b.namaPihak ?? '').trim()) return 'Nama pihak wajib diisi'
  const j = String(b.judul ?? '').trim(); if (!j || j.length > 200) return 'Judul wajib diisi (maks 200 huruf)'
  return null
}
export function validasiDeal({ hargaSepakat }) {
  const h = Number(hargaSepakat)
  return Number.isFinite(h) && h > 0 ? null : 'Harga deal wajib diisi dan lebih dari 0'
}
/** Syarat konversi TERIMA → order. */
export function validasiKonversi(k) {
  if (k.status !== 'DEAL') return 'Hanya LTK berstatus Deal yang bisa dikonversi menjadi order.'
  if (k.orderId) return 'LTK ini sudah dikonversi menjadi order.'
  if (k.arah !== 'TERIMA') return 'Konversi otomatis hanya untuk inquiry Terima (PO).'
  if (!(k.hargaSepakat > 0)) return 'Harga deal belum diisi.'
  if (!k.akunId) return 'Akun jualan belum dipilih untuk LTK ini.'
  return null
}
