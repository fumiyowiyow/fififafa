import prisma from '../prisma.js'

// KABAR ORDER BARU KE GRUP KOORDINATOR (12 Nov 2026, keputusan user): setiap order baru (Tambah order / Tempel banyak, Jadikan order dari
// prospek, LTK → order) langsung dikirim bot @KandEcosystem_bot ke SATU grup Telegram — dengan nilai order (keputusan user, grup berisi
// koordinator). Hanya pesan keluar, tanpa tombol. Mati bila TELEGRAM_GRUP_ORDER kosong. Dikirim dari proses API lewat HTTP Bot API
// (tanpa menunggu: order tetap tersimpan walau Telegram gagal). Antrean dalam memori dengan jeda agar "Tempel banyak" tidak kena batas
// Telegram (±20 pesan/menit per grup). ID grup: tambahkan bot ke grup lalu ketik /idgrup.
// Pemakaian nyata (12 Nov 2026): dikirim LEWAT BOT LAPOR yang sudah ada (`updateorderstd`, /var/www/<lapor-bot>) ke topik "Update Status
// Order" di grup Project Koordinator — menggantikan laporan "New Order" manual marketer/admin. Env: TELEGRAM_GRUP_ORDER (chat id),
// TELEGRAM_TOPIK_ORDER (message_thread_id, opsional), TELEGRAM_BOT_ORDER_TOKEN (opsional; kosong = TELEGRAM_BOT_TOKEN @KandEcosystem_bot).
// Format meniru bot lapor (HTML: 🛒 New Order · 🏢 unit · 🏪 akun · 👤 pelapor · Order · 💰 Total) supaya topik tetap seragam.
const JEDA_MS = 3500
const antrean = []
let jalan = false

const rp = (n) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID')
const usd = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, '')}`
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tgl = (d) => { if (!d) return null; const x = new Date(new Date(d).getTime() + 7 * 3600000); return `${x.getUTCDate()} ${NAMA_BLN[x.getUTCMonth()]} ${x.getUTCFullYear()}` }

/** Teks pesan (HTML Telegram) — MURNI (diuji). o: {unit, lingkup, akun, klien, panggilan, judul, nilai, mataUang, nilaiUsd, kurs, deadline, pencatat, talent[]} */
export function pesanOrderBaru(o) {
  const isUsd = o.mataUang === 'USD' && o.nilaiUsd != null
  const nilai = isUsd ? `${usd(o.nilaiUsd)} (${rp(o.nilai)})` : rp(o.nilai)
  const klien = `${esc(o.klien)}${o.panggilan ? ` (${esc(o.panggilan)})` : ''}`
  return [
    '🛒 <b>New Order</b>',
    `🏢 ${esc(o.unit)}${o.lingkup ? ` · ${esc(o.lingkup)}` : ''}`,
    o.akun ? `🏪 ${esc(o.akun)}` : null,
    o.pencatat ? `👤 ${esc(o.pencatat)}` : null,
    '',
    '<b>Order</b>',
    `1. ${klien} — ${esc(o.judul)}`,
    o.deadline ? `📅 Deadline: ${tgl(o.deadline)}` : null,
    o.talent?.length ? `🎨 Talent: ${esc(o.talent.join(', '))}` : null,
    '',
    `💰 <b>Total order: ${nilai}</b>`,
    '<i>🌐 otomatis dari web circle</i>',
  ].filter(x => x != null).join('\n')
}

async function kirim(teks) {
  const token = process.env.TELEGRAM_BOT_ORDER_TOKEN || process.env.TELEGRAM_BOT_TOKEN, grup = process.env.TELEGRAM_GRUP_ORDER, topik = Number(process.env.TELEGRAM_TOPIK_ORDER) || null
  if (!token || !grup) return
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: grup, ...(topik ? { message_thread_id: topik } : {}), text: teks, parse_mode: 'HTML', disable_web_page_preview: true }) })
  if (!r.ok) console.error('[notif-grup]', r.status, (await r.text().catch(() => '')).slice(0, 200))
}
async function proses() {
  if (jalan) return
  jalan = true
  while (antrean.length) {
    try { await kirim(antrean.shift()) } catch (e) { console.error('[notif-grup]', e?.message) }
    if (antrean.length) await new Promise(r => setTimeout(r, JEDA_MS))
  }
  jalan = false
}

/** Masukkan teks (HTML) ke antrean kirim grup — dipakai juga laporan harian (utils/laporanGrup.js). */
export function antreKirim(teks) {
  if (!process.env.TELEGRAM_GRUP_ORDER || !teks) return
  antrean.push(teks); proses()
}

/** Panggil SETELAH order tersimpan; tidak perlu di-await dan tidak pernah melempar galat. */
export function kabarOrderBaru(orderId) {
  if (!process.env.TELEGRAM_GRUP_ORDER || !orderId) return
  ;(async () => {
    const o = await prisma.orderProduksi.findUnique({
      where: { id: orderId },
      select: {
        judul: true, klien: true, nilaiKotor: true, mataUang: true, nilaiUsd: true, kurs: true, deadline: true,
        klienRef: { select: { panggilan: true } }, akun: { select: { platform: true, namaAkun: true } },
        studio: { select: { nama: true, circle: { select: { nama: true } }, rumahUsaha: { select: { nama: true } }, induk: { select: { nama: true } } } },
        assignments: { where: { berhentiPada: null }, select: { namaEksternal: true, user: { select: { nama: true } } } },
        riwayatTahap: { select: { namaPengguna: true }, orderBy: { mulai: 'asc' }, take: 1 },
      },
    })
    if (!o) return
    antrean.push(pesanOrderBaru({
      unit: o.studio.nama.trim(), lingkup: o.studio.circle?.nama ?? o.studio.rumahUsaha?.nama ?? o.studio.induk?.nama ?? null,
      akun: o.akun ? `${o.akun.platform} · ${o.akun.namaAkun}` : null, klien: o.klien, panggilan: o.klienRef?.panggilan ?? null, judul: o.judul,
      nilai: o.nilaiKotor, mataUang: o.mataUang, nilaiUsd: o.nilaiUsd, kurs: o.kurs, deadline: o.deadline,
      talent: o.assignments.map(a => a.user?.nama ?? a.namaEksternal).filter(Boolean), pencatat: o.riwayatTahap[0]?.namaPengguna ?? null,
    }))
    proses()
  })().catch(e => console.error('[notif-grup]', e?.message))
}
