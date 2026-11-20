import prisma from '../prisma.js'
import { hasAnyRole, SUPER_ADMIN } from './roles.js'

// JALUR MASUK (19 Okt 2026): satu server melayani Management Dashboard (app.domain-anda.com) DAN web tiap circle
// (bloom.domain-anda.com dst). Nginx menambahkan header X-Unit-Web ('app' atau slug circle) dan SELALU
// menimpa nilai kiriman klien (proxy_set_header), jadi klien biasa tidak bisa memalsukannya.
// Memalsukan header (mis. menembak langsung ke IP server) tidak memberi hak lebih: 'app' tetap
// kena pembatas peran, 'circle' hanya mendapat token terbatas.

const TTL_MS = 60_000
const cache = new Map() // slug → { at, nilai }

export async function cariLingkup(slug) {
  const ada = cache.get(slug)
  if (ada && Date.now() - ada.at < TTL_MS) return ada.nilai
  const [circle, rumah] = await Promise.all([
    prisma.circle.findUnique({ where: { slug }, select: { id: true, nama: true, colorHex: true } }),
    prisma.rumahUsaha.findUnique({ where: { slug }, select: { id: true, nama: true, colorHex: true } }),
  ])
  const nilai = circle ? { jenis: 'circle', slug, ...circle } : rumah ? { jenis: 'rumah-usaha', slug, ...rumah } : null
  cache.set(slug, { at: Date.now(), nilai })
  return nilai
}

/** { aud: 'app' } | { aud: 'circle', lingkup } | { galat } */
export async function resolveWeb(req) {
  const h = String(req.headers['x-unit-web'] ?? '').trim().toLowerCase()
  if (!h || h === 'app') return { aud: 'app' }
  if (!/^[a-z0-9-]{1,40}$/.test(h)) return { galat: 'Alamat web tidak dikenal' }
  const lingkup = await cariLingkup(h)
  return lingkup ? { aud: 'circle', lingkup } : { galat: 'Alamat web tidak dikenal' }
}

// UNIT DI BAWAH KORPORASI (keputusan user 9 Nov 2026): unit yang bernaung di Korporasi (Studio.indukId → unit bertipe KORPORASI,
// tanpa circle/rumah usaha, mis. Ekosistem Project di bawah PT. Karir Anak Indonesia) dilayani di alamat Circle Ekosistem (circle.domain-anda.com).
// Bisa dipindah lewat env WEB_KORPORASI_SLUG. Unit KORPORASI-nya sendiri (induk) tidak ditampilkan sebagai unit kerja.
export const SLUG_KORPORASI = (process.env.WEB_KORPORASI_SLUG || 'circle').toLowerCase()
const filterAnakKorporasi = { circleId: null, rumahUsahaId: null, induk: { tipe: 'KORPORASI' } }
/** Filter Prisma untuk model Studio: semua unit yang dilayani alamat web `lingkup`. SATU-SATUNYA sumber lingkup unit web circle. */
export function whereLingkup(lingkup) {
  if (lingkup.jenis !== 'circle') return { rumahUsahaId: lingkup.id }
  return lingkup.slug === SLUG_KORPORASI ? { OR: [{ circleId: lingkup.id }, filterAnakKorporasi] } : { circleId: lingkup.id }
}
/** Apakah studio (objek dengan circleId/rumahUsahaId/indukId) masuk lingkup — versi tanpa query (indukId dianggap = Korporasi). */
const studioCocok = (s, lingkup) => !!s && (lingkup.jenis === 'circle'
  ? s.circleId === lingkup.id || (lingkup.slug === SLUG_KORPORASI && !s.circleId && !s.rumahUsahaId && !!s.indukId)
  : s.rumahUsahaId === lingkup.id)

/** Boleh masuk web circle ini? Super admin / Kepala Ekosistem: ya. Lainnya: harus punya peran KERJA
 *  (bukan Dignity) di circle/rumah usaha itu — langsung atau lewat studionya. `roles` harus memuat studio. */
export function izinLingkup(roles = [], lingkup) {
  if (hasAnyRole(roles, SUPER_ADMIN)) return true
  const kunci = lingkup.jenis === 'circle' ? 'circleId' : 'rumahUsahaId'
  return roles.some(r => r.roleType !== 'DIGNITY' && (r[kunci] === lingkup.id || studioCocok(r.studio, lingkup)))
}

/** Seperti izinLingkup, ditambah PEMILIK (StudioPemilik) unit di circle/rumah usaha ini — boleh masuk untuk MELIHAT saja (21 Okt 2026).
 *  Wewenang lihat-saja ditegakkan per permintaan di controller (studioBolehDilihat / peranStudio: hanya GET). */
export async function izinMasukLingkup(userId, roles = [], lingkup) {
  if (izinLingkup(roles, lingkup)) return true
  // peran di unit anak Korporasi (roles bisa dimuat tanpa indukId) — dicek ke database
  if (lingkup.jenis === 'circle' && lingkup.slug === SLUG_KORPORASI && await prisma.userRole.findFirst({ where: { userId, roleType: { not: 'DIGNITY' }, studio: filterAnakKorporasi }, select: { id: true } })) return true
  return !!(await prisma.studioPemilik.findFirst({ where: { userId, studio: whereLingkup(lingkup) }, select: { id: true } }))
}

export const PESAN_BUKAN_LINGKUP = (nama) => `Akunmu tidak terdaftar di ${nama}. Gunakan alamat web circle-mu sendiri.`
