// REALTIME web circle (audit OGS: websocket/broadcast) — Server-Sent Events satu arah, tanpa pustaka. Server HANYA memberi tahu "ada perubahan di
// bagian X"; klien lalu mengambil ulang datanya lewat API biasa (jadi otorisasi tetap di API, tidak ada data bocor lewat aliran ini).
// Proses tunggal (pm2 fork) → daftar koneksi di memori. Dikelompokkan per alamat circle (slug).
const koneksi = new Set() // { res, slug, userId }
// Pengaman penumpukan koneksi: lebih dari ini, koneksi tertua orang itu ditutup. Sengaja longgar (21 Okt 2026) — dengan batas 6, tab ke-7
// menendang tab tertua yang lalu menyambung ulang & menendang tab lain (berputar terus). Klien kini hanya membuka stream untuk tab yang terlihat.
const MAKS_PER_ORANG = 20
export function daftarkan(res, slug, userId) {
  const milik = [...koneksi].filter(x => x.userId === userId)
  for (const lama of milik.slice(0, Math.max(0, milik.length - MAKS_PER_ORANG + 1))) { try { lama.res.end() } catch { /* putus */ } koneksi.delete(lama) }
  const k = { res, slug, userId }
  koneksi.add(k)
  const hb = setInterval(() => { try { res.write(': hb\n\n') } catch { /* putus */ } }, 25000)
  res.on('close', () => { clearInterval(hb); koneksi.delete(k) })
  return k
}
/** Beritahu semua klien pada alamat `slug` bahwa bagian `bagian` berubah (bagian = segmen pertama rute, mis. 'orders', 'penugasan'). */
export function umumkan(slug, bagian, oleh = null) {
  if (!slug) return 0
  const data = JSON.stringify({ bagian, oleh, waktu: Date.now() })
  let n = 0
  for (const k of koneksi) { if (k.slug !== slug) continue; try { k.res.write(`event: perubahan\ndata: ${data}\n\n`); n++ } catch { koneksi.delete(k) } }
  return n
}
export const jumlahKoneksi = () => koneksi.size
