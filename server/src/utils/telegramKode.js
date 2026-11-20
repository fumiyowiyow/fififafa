import { createHash, randomInt } from 'crypto'

// Kode tautan Telegram (14 Okt 2026): 8 karakter dari alfabet tanpa huruf/angka yang mudah tertukar
// (tanpa 0/O/1/I/L) → 31^8 ≈ 8,5×10^11 kemungkinan, berlaku 10 menit, SEKALI pakai. Disimpan sebagai
// hash SHA-256, jadi isi database tidak bisa dipakai untuk menautkan akun orang lain.
const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const PANJANG_KODE = 8
export const MASA_BERLAKU_MS = 10 * 60 * 1000

export function buatKode() {
  let kode = ''
  for (let i = 0; i < PANJANG_KODE; i++) kode += ALFABET[randomInt(ALFABET.length)]
  return kode
}

/** Rapikan masukan pengguna: huruf besar, buang spasi/strip ("abcd-efgh" → "ABCDEFGH"). */
export const normalisasiKode = (teks) => String(teks ?? '').toUpperCase().replace(/[\s-]/g, '')

export const kodeValid = (kode) => kode.length === PANJANG_KODE && [...kode].every(c => ALFABET.includes(c))

export const hashKode = (kode) => createHash('sha256').update(kode).digest('hex')
