import { AsyncLocalStorage } from 'node:async_hooks'

// Konteks per permintaan (21 Okt 2026): saat ini hanya `imp` (id Super Admin yang sedang menyamar), supaya jejak audit bisa
// menandai "dilakukan saat menyamar oleh X" tanpa mengubah semua pemanggil. Diisi di middleware authenticate.
export const konteks = new AsyncLocalStorage()
export const impSekarang = () => konteks.getStore()?.imp ?? null
