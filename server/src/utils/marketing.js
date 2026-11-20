// MARKETING (20 Okt 2026) — adaptasi marketing OGS. Murni (tanpa database) supaya bisa diuji.
// Sumber (kode OGS): MarketerTaskController (aturan wajib isi), MarketerMonthlyMarketingPlanService (KPI & rencana standar),
// migrasi katalog 5 Agt 2026 (15 aktivitas pemasaran), MarketingDashboardService (corong & efisiensi Effort→Order).
//
// Sejak 5 Agt 2026 OGS memindahkan Chat / Brief / Preview / Delivery keluar dari tugas harian (jadi tahap alur order milik
// marketer + prospek). Di Ekosistem itu sama: tahap alur v2 + MarketingLead. Tugas harian hanya aktivitas pemasaran di bawah.
// TIDAK menyentuh keuangan / omset (keputusan user 21 Okt 2026).

// ── Katalog aktivitas (15, sama dengan OGS) ───────────────────────────────────────────────────────────────
// lingkup platform: 'marketing' = sosmed, 'marketplace' = akun jualan, 'all' = keduanya, null = bebas
export const KATALOG = [
  { kunci: 'publish_post', label: 'Post', tahap: 'publish', butuhAkun: true, lingkup: 'marketing', urut: 10 },
  { kunci: 'publish_thread', label: 'Thread', tahap: 'publish', butuhAkun: true, lingkup: 'marketing', urut: 20 },
  { kunci: 'publish_video', label: 'Video', tahap: 'publish', butuhAkun: true, lingkup: 'marketing', urut: 30 },
  { kunci: 'publish_portfolio', label: 'Portfolio', tahap: 'publish', butuhAkun: true, lingkup: 'all', urut: 40 },
  { kunci: 'engage_reply', label: 'Reply', tahap: 'engage', butuhAkun: true, lingkup: 'marketing', urut: 50 },
  { kunci: 'engage_comment', label: 'Komentar', tahap: 'engage', butuhAkun: true, lingkup: 'marketing', urut: 60 },
  { kunci: 'engage_quote_tweet', label: 'Quote Tweet', tahap: 'engage', butuhAkun: true, lingkup: 'marketing', urut: 70 },
  { kunci: 'engage_discussion', label: 'Diskusi', tahap: 'engage', butuhAkun: true, lingkup: 'all', urut: 80 },
  { kunci: 'network_dm', label: 'DM', tahap: 'network', butuhAkun: true, lingkup: 'all', urut: 90 },
  { kunci: 'network_collaboration', label: 'Kolaborasi', tahap: 'network', butuhAkun: false, lingkup: null, urut: 100 },
  { kunci: 'network_partnership', label: 'Partnership', tahap: 'network', butuhAkun: false, lingkup: null, urut: 110 },
  { kunci: 'optimize_profile', label: 'Update Profil', tahap: 'optimize', butuhAkun: true, lingkup: 'all', urut: 120 },
  { kunci: 'optimize_seo', label: 'SEO', tahap: 'optimize', butuhAkun: true, lingkup: 'all', urut: 130 },
  { kunci: 'optimize_ab_test', label: 'A/B Test', tahap: 'optimize', butuhAkun: true, lingkup: 'all', urut: 140 },
  { kunci: 'optimize_portfolio', label: 'Portfolio', tahap: 'optimize', butuhAkun: true, lingkup: 'all', urut: 150 },
  // Aktivitas bebas (13 Nov 2026, masukan tim: jenis bawaan masih bernuansa VGen/sosmed) — namanya ditulis di Judul; tanpa KPI, tahap sendiri.
  { kunci: 'lainnya', label: 'Lainnya (tulis sendiri)', tahap: 'lainnya', butuhAkun: false, lingkup: null, urut: 200 },
]
// Label tampilan berbahasa Indonesia (9 Nov 2026, permintaan user: diksi lebih akrab); kunci tetap kode OGS
export const TAHAP_AKTIVITAS = { publish: 'Unggah konten', engage: 'Interaksi', network: 'Jejaring', optimize: 'Optimasi', lainnya: 'Lainnya' }
export const DAFTAR_KUNCI = KATALOG.map(k => k.kunci)

// Platform (sama dengan OGS)
export const PLATFORM_SOSMED = ['X', 'IG', 'TikTok', 'LinkedIn', 'Threads', 'Discord', 'WhatsApp', 'Telegram', 'Email', 'YouTube', 'Behance', 'Pinterest', 'Bluesky', 'Ko-fi', 'Reddit', 'Lainnya'] // WhatsApp/Telegram/Email: 9 Nov 2026 (kanal prospek LTK)
export const PLATFORM_AKUN = ['Fiverr', 'Vgen', 'Etsy']
export const PLATFORM_PROFIL = [...PLATFORM_SOSMED, ...PLATFORM_AKUN]

// ── KPI rencana bulanan ───────────────────────────────────────────────────────────────────────────────────
export const KPI = [
  { kunci: 'post', label: 'Post' },
  { kunci: 'reply', label: 'Komen/Reply' },
  { kunci: 'update', label: 'Update' },
  { kunci: 'seo', label: 'SEO' },
]
// aktivitas → KPI (network_* tidak punya KPI, sama dengan OGS)
export const AKTIVITAS_KE_KPI = {
  publish_post: 'post', publish_thread: 'post', publish_video: 'post', publish_portfolio: 'post',
  engage_reply: 'reply', engage_comment: 'reply', engage_quote_tweet: 'reply', engage_discussion: 'reply',
  optimize_profile: 'update', optimize_portfolio: 'update', optimize_ab_test: 'update',
  optimize_seo: 'seo',
}
// Rencana standar per akun: reply ≥5/hari, post ≥3/minggu, update ≥8/bulan, SEO ≥8/bulan
export const STANDAR = {
  reply: { rate: 5, per: 'hari', label: '≥ 5 / hari' },
  post: { rate: 3, per: 'minggu', label: '≥ 3 / minggu' },
  update: { rate: 8, per: 'bulan', label: '≥ 8 / bulan' },
  seo: { rate: 8, per: 'bulan', label: '≥ 8 / bulan' },
}
export const hariDalamBulan = (bulan, tahun) => new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()

/** Target standar sebulan: reply × hari kalender, post × (hari/7) dibulatkan ke atas, update & seo tetap. */
export function targetStandar(bulan, tahun) {
  const hari = hariDalamBulan(bulan, tahun)
  return { post: Math.ceil((STANDAR.post.rate * hari) / 7), reply: STANDAR.reply.rate * hari, update: STANDAR.update.rate, seo: STANDAR.seo.rate }
}

/** Realisasi KPI dari daftar aktivitas SELESAI. Tiap aktivitas dihitung `jumlah` (≥1). */
export function hitungKpi(aktivitas = []) {
  const hasil = { post: 0, reply: 0, update: 0, seo: 0 }
  for (const a of aktivitas) {
    if (!a.selesai) continue
    const k = AKTIVITAS_KE_KPI[a.jenis]
    if (k) hasil[k] += Math.max(1, Number(a.jumlah) || 1)
  }
  return hasil
}

/** Progres tiap KPI: { kunci, label, target, realisasi, persen (0–100+, null bila target 0) }. */
export function progresKpi(target, realisasi) {
  return KPI.map(k => ({ kunci: k.kunci, label: k.label, target: target[k.kunci] ?? 0, realisasi: realisasi[k.kunci] ?? 0, persen: (target[k.kunci] ?? 0) > 0 ? Math.round(((realisasi[k.kunci] ?? 0) / target[k.kunci]) * 100) : null }))
}

// ── Aturan wajib isi (dari validateMarketingRepeaterTasks OGS, dipetakan ke katalog 15 aktivitas) ──────────
const NAMA_FIELD = { judul: 'Judul', platform: 'Platform', akunId: 'Akun', link: 'Link', jamPosting: 'Jam posting', targetAkun: 'Akun yang dikomen', pengikut: 'Jumlah follower' }
const kosong = (v) => v == null || (typeof v === 'string' && v.trim() === '')

/** @returns daftar galat [{ field, pesan }]; kosong = sah. */
export function validasiAktivitas(a, { akunMilikStudio = null } = {}) {
  const galat = []
  const def = KATALOG.find(k => k.kunci === a?.jenis)
  if (!def) return [{ field: 'jenis', pesan: 'Jenis aktivitas tidak dikenal.' }]
  const wajib = (field) => { if (kosong(a[field])) galat.push({ field, pesan: `${NAMA_FIELD[field]} wajib diisi.` }) }
  // Aktivitas yang berhubungan dengan akun/konten wajib terlacak: judul, platform, akun, link
  if (def.butuhAkun) ['judul', 'platform', 'akunId', 'link'].forEach(wajib)
  else ['judul'].forEach(wajib)
  if (def.tahap === 'publish') wajib('jamPosting')                                   // seperti "Jam posting wajib diisi" untuk post
  if (def.tahap === 'engage') { wajib('targetAkun'); if (a.pengikut == null || a.pengikut === '') galat.push({ field: 'pengikut', pesan: 'Jumlah follower wajib diisi.' }) } // reply/komen
  if (!kosong(a.jamPosting) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.jamPosting)) galat.push({ field: 'jamPosting', pesan: 'Jam posting harus berformat HH:MM.' })
  if (a.pengikut != null && a.pengikut !== '' && !(Number.isInteger(Number(a.pengikut)) && Number(a.pengikut) >= 0)) galat.push({ field: 'pengikut', pesan: 'Jumlah follower harus bilangan bulat ≥ 0.' })
  if (!kosong(a.jumlah) && !(Number.isInteger(Number(a.jumlah)) && Number(a.jumlah) >= 1 && Number(a.jumlah) <= 500)) galat.push({ field: 'jumlah', pesan: 'Jumlah harus bilangan 1–500.' })
  if (!kosong(a.link) && !/^https?:\/\/\S+$/i.test(a.link.trim())) galat.push({ field: 'link', pesan: 'Link harus diawali http:// atau https://.' })
  if (!kosong(a.platform)) {
    const sah = def.lingkup === 'marketing' ? PLATFORM_SOSMED : def.lingkup === 'marketplace' ? PLATFORM_AKUN : PLATFORM_PROFIL
    if (!sah.includes(a.platform)) galat.push({ field: 'platform', pesan: `Platform tidak sesuai untuk ${def.label} (${sah.join(', ')}).` })
  }
  if (a.akunId && akunMilikStudio && !akunMilikStudio.has(a.akunId)) galat.push({ field: 'akunId', pesan: 'Akun bukan milik studio ini.' })
  for (const f of ['judul', 'catatan', 'hasil', 'targetAkun']) if (typeof a[f] === 'string' && a[f].length > 300) galat.push({ field: f, pesan: `${f} maksimal 300 karakter.` })
  return galat
}

// ── Log harian (suasana hati; sama dengan OGS) ────────────────────────────────────────────────────────────
export const MOOD = [
  { kunci: 'semangat', label: '🔥 Semangat' }, { kunci: 'bahagia', label: '😊 Bahagia' }, { kunci: 'gembira', label: '🎉 Gembira' },
  { kunci: 'biasa', label: '😐 Biasa' }, { kunci: 'capek', label: '😓 Capek' }, { kunci: 'sedih', label: '😢 Sedih' },
  { kunci: 'stress', label: '😰 Stress' }, { kunci: 'marah', label: '😠 Marah' },
]
export const KUNCI_MOOD = MOOD.map(m => m.kunci)

// ── Corong & efisiensi (acuan MarketingDashboardService: Effort → Order) ──────────────────────────────────
/** Corong berurutan; tiap tahap menyimpan laju dari tahap sebelumnya. */
export function susunCorong({ effort = 0, chat = 0, order = 0, preview = 0, delivery = 0 }) {
  const urut = [
    ['effort', 'Aktivitas', 'Aktivitas pemasaran selesai', effort],
    ['chat', 'Chat', 'Prospek / lead masuk', chat],
    ['order', 'Order', 'Lead jadi order', order],
    ['preview', 'Preview', 'Order sampai fase klien (preview)', preview],
    ['delivery', 'Delivery', 'Order terkirim / selesai', delivery],
  ]
  return urut.map(([kunci, label, petunjuk, nilai], i) => {
    const sebelum = i > 0 ? urut[i - 1][3] : null
    // Laju hanya bermakna bila tahap MENYEMPIT; bila lebih besar dari sebelumnya (mis. order langsung dari klien lama tanpa prospek) → null
    return { kunci, label, petunjuk, nilai, lajuDariSebelumnya: sebelum != null && sebelum > 0 && nilai <= sebelum ? Math.round((nilai / sebelum) * 1000) / 10 : null }
  })
}
/** Laju Effort→Order (%) satu desimal, null bila effort 0. */
export const lajuEffortKeOrder = (effort, order) => (effort > 0 ? Math.round((order / effort) * 1000) / 10 : null)
/** Peringkat efisiensi: hanya marketer dengan effort > 0, laju tertinggi dulu (seri: effort lebih besar dulu). */
export function peringkatEfisiensi(baris) {
  return baris.filter(b => b.effort > 0)
    .map(b => ({ ...b, laju: lajuEffortKeOrder(b.effort, b.order) }))
    .sort((a, b) => (b.laju - a.laju) || (b.effort - a.effort) || a.nama.localeCompare(b.nama, 'id'))
    .map((b, i) => ({ ...b, peringkat: i + 1 }))
}
