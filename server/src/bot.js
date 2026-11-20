import { bulanIniWIB, simpanFotoCpm } from './utils/cpm.js'
import { Telegraf, Markup, Scenes, session } from 'telegraf'
import cron  from 'node-cron'
import https from 'https'
import prisma from './prisma.js'
import { getStartOfWeekWIB, getMonthAttributionRange, getReportingPeriod, isReportInMonth } from './utils/week.js'
import { ECOSYSTEM_NAME } from './config/ecosystem.js'
import { getStudioKas, getKasMapForStudios } from './utils/kas.js'
import { lingkupKeuangan, filterStudioId } from './utils/lingkup.js'
import { hasAnyRole, bestLevel, ROLE_LEVEL, canManageStudio, kelolaStudio, ROLE_KIRIM_LAPORAN, ROLE_DASHBOARD_PENUH, bolehMasukDashboard, levelMinimumDashboard, PESAN_AKSES_DITUTUP } from './utils/roles.js'
import { totalPengeluaranPeriode } from './utils/pengeluaran.js'
import { STUDIO_DIHITUNG, LAPORAN_DIHITUNG, USER_BUKAN_KOLABORASI_SAJA } from './utils/kolaborasi.js'
import { normalisasiKode, kodeValid, hashKode } from './utils/telegramKode.js'
import { laporLewatAnak } from './utils/korporasi.js'

const DASH   = process.env.DASHBOARD_URL || process.env.CLIENT_URL || 'http://localhost:5173'

const agent = new https.Agent({ rejectUnauthorized: false })
const bot   = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { telegram: { agent } })

// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────

const APP_URL = (process.env.CLIENT_URL ?? '').replace(/^https?:\/\//, '') || 'dashboard'
const PETUNJUK_TAUT =
  `Buka *Profil* di ${APP_URL} → *Hubungkan Telegram* → salin kode, lalu kirim ke sini:\n\`/daftar KODE\``
const PESAN_DAFTAR_DULU = `⚠️ Akun belum terhubung.\n\n${PETUNJUK_TAUT}`

// Percobaan kode salah per akun Telegram (di memori; hilang saat bot restart — cukup untuk meredam tebakan).
const gagalDaftar = new Map()
const MAKS_GAGAL = 5
const JENDELA_GAGAL_MS = 15 * 60 * 1000

async function getUserByTelegramId(telegramId) {
  return prisma.user.findFirst({
    // statusAktif: akun yang dinonaktifkan kehilangan akses bot walau tautannya masih tersimpan.
    where: { telegramId: String(telegramId), statusAktif: true },
    include: {
      roles: {
        include: {
          studio: { select: { id: true, nama: true } },
          circle: { select: { id: true, nama: true, colorHex: true } },
        },
      },
    },
  })
}

// ══ ATURAN AKSES BOT = ATURAN WEB (14 Okt 2026) ═══════════════════════════════════════════════
// Bot BUKAN jalan pintas. Tiap perintah memakai daftar peran/fungsi izin YANG SAMA dengan rute web
// (utils/roles.js), jadi aturannya tak bisa menyimpang. Dulu bot menebak "studio utama" dari peran
// pertama (akun pendamping 7 studio selalu dianggap studio pertama) dan menampilkan kas ke semua peran.
//  • lihat status laporan / kas / omset  = Koordinator ke atas (21 Okt 2026: talent Kader/Karyawan/Magang TIDAK melihat uang —
//                                          web circle kini mengajak semua anggota menautkan Telegram)
//  • kirim laporan                       = ROLE_KIRIM_LAPORAN + canManageStudio(studio)
//  • rekap ekosistem                     = Dashboard penuh (ROLE_DASHBOARD_PENUH)
// Pembatasan akses sementara (AKSES_DASHBOARD_MIN_ROLE di .env) berlaku juga di bot — sama seperti web.
const KADER_KE_ATAS = (user) => bestLevel(user.roles ?? []) <= ROLE_LEVEL.KOORDINATOR && bolehMasukDashboard(user.roles ?? [])
const pesanKader = () => (levelMinimumDashboard() != null
  ? `🔒 ${PESAN_AKSES_DITUTUP}`
  : '🔒 Fitur ini hanya untuk Koordinator ke atas.')
const PERAN_TALENT = ['KADER', 'KARYAWAN', 'MAGANG', 'DIGNITY']
const esc = (t) => String(t ?? '').trim().replace(/([_*`\[])/g, '\\$1')

/** Studio aktif yang boleh dikelola user — fungsi izin yang sama dengan rute web (canManageStudio), tanpa peran talent/Dignity
 *  (peran itu tidak membuka uang unitnya, 21 Okt 2026). */
async function studioDalamLingkup(user, extraCircleRoles = []) {
  const semua = await prisma.studio.findMany({
    where: { statusAktif: true },
    select: { id: true, nama: true, hitungDiEkosistem: true, mitraKolaborasi: true },
    orderBy: { nama: 'asc' },
  })
  const peran = (user.roles ?? []).filter(r => !PERAN_TALENT.includes(r.roleType))
  const izin = await Promise.all(semua.map(st => canManageStudio(peran, st.id, extraCircleRoles)))
  return semua.filter((_, i) => izin[i])
}
const labelStudio = (st) => `${esc(st.nama)}${st.hitungDiEkosistem === false ? ' 🤝' : ''}`
const CATATAN_KOLABORASI = '🤝 = studio kolaborasi (angkanya dihitung di circle mitra, tidak masuk total ekosistem).'

function fmtUSD(n)  { return `$${Number(n || 0).toFixed(2)}` }
function fmtRp(n)   { return `Rp ${Number(n || 0).toLocaleString('id-ID')}` }

// Periode laporan WIB (bisa minggu penuh Senin-Minggu ATAU stub pendek di batas bulan, lihat
// getReportingPeriod di utils/week.js) — dulu di sini pakai jam server mentah tanpa sadar WIB,
// bisa salah sampai 1 minggu penuh pas jam 00:00-06:59 WIB dan bikin laporan yang di-submit
// lewat bot ini kesimpen dengan periodeAwal yang gak konsisten sama laporan dari dashboard.
function getWeekPeriod() {
  const { periodeAwal, periodeAkhir } = getReportingPeriod()
  const end = new Date(periodeAkhir.getTime() + 24 * 60 * 60 * 1000 - 1) // akhir hari periodeAkhir, 23:59:59.999
  return { start: periodeAwal, end }
}

function getWeekPeriodLabel() {
  const { start, end } = getWeekPeriod()
  const fmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

// Minggu yang nyebrang bulan diatribusikan ke bulan dengan hari terbanyak (lihat
// getMonthAttributionRange di utils/week.js) -- konsisten sama Rekap Bulanan di dashboard,
// bukan cuma tanggal 1 kalender.
function getStartOfMonth() {
  const now = new Date()
  return getMonthAttributionRange(now.getMonth() + 1, now.getFullYear()).rangeStart
}

const MAIN_KEYBOARD = Markup.keyboard([
  ['/laporan', '/report'],
  ['/kas', '/help'],
]).resize()

// ──────────────────────────────────────────────────────────
// WIZARD: /laporan — Input Weekly Report via Telegram
// ──────────────────────────────────────────────────────────

const laporanWizard = new Scenes.WizardScene(
  'laporan-wizard',

  // ── Step 0: Init — cek user & studio ──────────────────
  async (ctx) => {
    const user = await getUserByTelegramId(ctx.from.id)
    if (!user) {
      await ctx.reply(PESAN_DAFTAR_DULU, { parse_mode: 'Markdown' })
      return ctx.scene.leave()
    }

    // Aturan web (POST /weekly-reports): hanya ROLE_KIRIM_LAPORAN, dan hanya untuk studio yang lolos
    // canManageStudio — BUKAN lagi sekadar "studio dari peran pertama".
    if (!hasAnyRole(user.roles ?? [], ROLE_KIRIM_LAPORAN)) {
      await ctx.reply('🔒 Laporan mingguan hanya bisa dikirim oleh Koordinator, Pendamping, Kepala Circle/Rumah Usaha, atau Super Admin — sama seperti di dashboard web.')
      return ctx.scene.leave()
    }
    const studios = await studioDalamLingkup(user)
    if (!studios.length) {
      await ctx.reply('❌ Tidak ada studio yang bisa kamu laporkan.')
      return ctx.scene.leave()
    }

    ctx.wizard.state.user    = { id: user.id, nama: user.nama }
    ctx.wizard.state.studios = studios.map(({ id, nama }) => ({ id, nama }))

    if (studios.length === 1) {
      ctx.wizard.state.studio = ctx.wizard.state.studios[0]
      return stepOmset(ctx)
    }

    // Pilih studio dulu
    await ctx.reply(
      `Halo *${user.nama}!* 👋\nKamu punya *${studios.length} studio*. Pilih yang mau dilaporkan:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(
          studios.map(s => Markup.button.callback(s.nama.trim(), `st_${s.id}`)),
          { columns: 2 }
        ),
      }
    )
    return ctx.wizard.next()
  },

  // ── Step 1: Pilih studio (jika multiple) ──────────────
  async (ctx) => {
    const cb = ctx.callbackQuery?.data
    if (!cb?.startsWith('st_')) {
      await ctx.reply('Pilih studio dengan tombol di atas 👆')
      return
    }
    await ctx.answerCbQuery()
    const studioId = cb.replace('st_', '')
    const studio   = ctx.wizard.state.studios.find(s => s.id === studioId)
    if (!studio) return ctx.reply('Studio tidak ditemukan.')
    ctx.wizard.state.studio = studio
    return stepOmset(ctx)
  },

  // ── Step 2: Terima omset ──────────────────────────────
  async (ctx) => {
    if (!ctx.message?.text) return
    const raw = ctx.message.text.trim()
    if (isBatal(raw)) return batal(ctx)

    // Parse ketat: tepat 1 angka (total) atau 6 angka (per platform), hanya angka tak-negatif — seperti web
    // ("Omset tidak boleh negatif"). Dulu teks apa pun dianggap 0 dan angka berlebih dibuang diam-diam.
    const angka = raw.split(/[\s,;]+/).filter(Boolean).map(v => (/^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : NaN))
    if (angka.some(Number.isNaN) || ![1, 6].includes(angka.length)) {
      await ctx.reply(
        '⚠️ Format belum benar. Isi *tepat 6 angka* atau *1 angka total*, tanpa huruf (desimal pakai titik):\n\n' +
        '*6 angka (pisah koma):*\n`Fiverr, Etsy, Upwork, VGen, Komunitas, Lainnya`\n\n' +
        '*Atau total saja:*\n`250`\n\n' +
        'Ketik `/batal` untuk membatalkan.',
        { parse_mode: 'Markdown' }
      )
      return
    }
    let fiverr = 0, etsy = 0, upwork = 0, vgen = 0, komunitas = 0, lainnya = 0
    if (angka.length === 6) [fiverr, etsy, upwork, vgen, komunitas, lainnya] = angka
    else lainnya = angka[0]

    const totalUsd = fiverr + etsy + upwork + vgen + komunitas + lainnya
    Object.assign(ctx.wizard.state, { fiverr, etsy, upwork, vgen, komunitas, lainnya, totalUsd })

    // Kas gak ditanya lagi (13 Okt 2026) -- snapshot otomatis dari saldo Rekening Bank (Bio Studio),
    // sama kayak form web. Dulu koordinator ngetik manual di sini, jadi ada dua angka kas.
    ctx.wizard.state.kasSekarang = await getStudioKas(ctx.wizard.state.studio.id).catch(() => 0)

    await ctx.reply(
      `💵 Total: *${fmtUSD(totalUsd)}* ✓\n` +
      `💰 Kas (saldo Rekening Bank): *${fmtRp(ctx.wizard.state.kasSekarang)}*\n` +
      `_Kalau saldo berubah, update di Bio Studio › Rekening Bank._\n\n` +
      `Ada *kendala* atau catatan minggu ini?\n_Ketik deskripsi singkat, atau / untuk skip._`,
      { parse_mode: 'Markdown' }
    )
    return ctx.wizard.next()
  },

  // ── Step 3: Kendala (opsional) ────────────────────────
  async (ctx) => {
    if (!ctx.message?.text) return
    const raw = ctx.message.text.trim()
    if (isBatal(raw)) return batal(ctx)

    ctx.wizard.state.kendala = raw === '/' ? null : raw

    const s    = ctx.wizard.state
    const week = getWeekPeriodLabel()

    const platformLines = [
      s.fiverr    > 0 ? `   • Fiverr:    *${fmtUSD(s.fiverr)}*`    : null,
      s.etsy      > 0 ? `   • Etsy:      *${fmtUSD(s.etsy)}*`      : null,
      s.upwork    > 0 ? `   • Upwork:    *${fmtUSD(s.upwork)}*`    : null,
      s.vgen      > 0 ? `   • VGen:      *${fmtUSD(s.vgen)}*`      : null,
      s.komunitas > 0 ? `   • Komunitas: *${fmtUSD(s.komunitas)}*` : null,
      s.lainnya   > 0 ? `   • Lainnya:   *${fmtUSD(s.lainnya)}*`   : null,
    ].filter(Boolean).join('\n') || '   _(tidak ada omset)_'

    await ctx.reply(
      `📋 *Ringkasan Laporan — Konfirmasi?*\n\n` +
      `🎨 Studio: *${s.studio.nama}*\n` +
      `📅 Periode: *${week}*\n\n` +
      `💵 Omset:\n${platformLines}\n` +
      `   ▸ *Total: ${fmtUSD(s.totalUsd)}*\n\n` +
      `💰 Kas (saldo Rekening Bank): *${fmtRp(s.kasSekarang)}*` +
      (s.kendala ? `\n📝 Kendala: _${s.kendala}_` : ''),
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Kirim Laporan', 'lapor_ok')],
          [Markup.button.callback('✏️ Isi Ulang', 'lapor_reset')],
          [Markup.button.callback('❌ Batalkan', 'lapor_batal')],
        ]),
      }
    )
    return ctx.wizard.next()
  },

  // ── Step 4: Submit ────────────────────────────────────
  async (ctx) => {
    const cb = ctx.callbackQuery?.data
    if (!cb) { await ctx.reply('Pilih tombol di atas 👆'); return }
    await ctx.answerCbQuery()

    if (cb === 'lapor_batal')  { await ctx.editMessageText('❌ Laporan dibatalkan.'); return ctx.scene.leave() }
    if (cb === 'lapor_reset')  {
      await ctx.editMessageText('🔄 Oke, mulai ulang dari omset ya.')
      return stepOmset(ctx)
    }
    if (cb !== 'lapor_ok') return

    const s = ctx.wizard.state
    // Periode SAMA dengan web (create → getReportingPeriod): periodeAkhir disimpan tengah malam hari terakhir.
    const { periodeAwal: start, periodeAkhir: end } = getReportingPeriod(new Date())

    try {
      // Otorisasi diperiksa ULANG saat menyimpan dengan peran TERBARU dari database (bukan keadaan
      // saat wizard dimulai) — peran bisa berubah / akun dinonaktifkan di tengah proses.
      const segar = await getUserByTelegramId(ctx.from.id)
      if (!segar || !hasAnyRole(segar.roles ?? [], ROLE_KIRIM_LAPORAN) || !(await kelolaStudio(segar.roles ?? [], s.studio.id))) {
        await ctx.editMessageText('🔒 Kamu tidak lagi punya wewenang melaporkan studio ini.')
        return ctx.scene.leave()
      }
      // Cek apakah sudah ada laporan periode ini (kunci yang sama dengan web: studio + periodeAwal)
      const existing = await prisma.weeklyReport.findFirst({
        where: { studioId: s.studio.id, periodeAwal: start },
      })
      if (existing) {
        await ctx.editMessageText(
          `⚠️ *${s.studio.nama}* sudah ada laporan untuk minggu ini.\n\n` +
          `Untuk edit, buka dashboard:\n${DASH}`,
          { parse_mode: 'Markdown' }
        )
        return ctx.scene.leave()
      }

      // Bot gak nanya kurs ke user -- pakai kurs yang terakhir kali diinput (laporan mana pun,
      // via web atau bot), bukan angka statis basi. Fallback 17000 kalau belum pernah ada laporan
      // sama sekali (studio/ekosistem baru).
      const lastReport = await prisma.weeklyReport.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { kurs: true },
      })
      await prisma.weeklyReport.create({
        data: {
          studioId:       s.studio.id,
          userId:         s.user.id,
          periodeAwal:    start,
          periodeAkhir:   end,
          omsetFiverr:    s.fiverr,
          omsetEtsy:      s.etsy,
          omsetUpwork:    s.upwork,
          omsetVgen:      s.vgen,
          omsetKomunitas: s.komunitas,
          omsetLainnya:   s.lainnya,
          totalUsd:       s.totalUsd,
          kurs:           lastReport?.kurs ?? 17000,
          kasSekarang:    await getStudioKas(s.studio.id).catch(() => s.kasSekarang),
          // Pengeluaran gak ditanya di bot -- total item yang sudah dicatat di web minggu ini.
          pengeluaran:    await totalPengeluaranPeriode(s.studio.id, start, end).catch(() => 0),
          kendala:        s.kendala ?? null,
        },
      })

      await ctx.editMessageText(
        `✅ *Laporan berhasil dikirim!*\n\n` +
        `🎨 ${s.studio.nama}\n` +
        `💵 Total omset: *${fmtUSD(s.totalUsd)}*\n` +
        `💰 Kas: *${fmtRp(s.kasSekarang)}*\n\n` +
        `Terima kasih sudah laporan tepat waktu! 🙏`,
        { parse_mode: 'Markdown' }
      )
    } catch (err) {
      // Detail galat hanya di log server — err.message mentah bisa membuka isi query/tabel ke pengguna.
      console.error('[Bot] gagal menyimpan laporan:', err)
      await ctx.editMessageText(
        err?.code === 'P2002'
          ? '⚠️ Laporan untuk studio ini di periode ini sudah ada.'
          : '❌ Gagal menyimpan laporan, coba lagi sebentar lagi.'
      )
    }

    return ctx.scene.leave()
  }
)

// Batal di langkah manapun
laporanWizard.command('batal', (ctx) => {
  ctx.reply('❌ Laporan dibatalkan.', MAIN_KEYBOARD)
  return ctx.scene.leave()
})

// Helper: tampilkan prompt omset
async function stepOmset(ctx) {
  const studio = ctx.wizard.state.studio
  const week   = getWeekPeriodLabel()

  await ctx.reply(
    `📊 *Weekly Report — ${studio.nama}*\n` +
    `📅 Periode: *${week}*\n\n` +
    `Masukkan *omset per platform* (USD), pisah koma:\n` +
    `\`Fiverr, Etsy, Upwork, VGen, Komunitas, Lainnya\`\n\n` +
    `Contoh: \`200, 50, 0, 100, 0, 0\`\n` +
    `Atau total saja: \`250\`\n\n` +
    `_Ketik \`/batal\` untuk membatalkan._`,
    { parse_mode: 'Markdown' }
  )
  // Kalau dari step 1 (pilih studio), perlu lompat ke step 2
  // Kalau dari step 0 langsung, perlu ke step 2 juga
  ctx.wizard.selectStep(2)
}

function isBatal(text) {
  return ['/batal','batal','cancel','/cancel'].includes(text.toLowerCase())
}
async function batal(ctx) {
  await ctx.reply('❌ Laporan dibatalkan.', MAIN_KEYBOARD)
  return ctx.scene.leave()
}

// ──────────────────────────────────────────────────────────
// SETUP BOT + SESSION + STAGE
// ──────────────────────────────────────────────────────────

const stage = new Scenes.Stage([laporanWizard])
bot.use(session())
bot.use(stage.middleware())

// ──────────────────────────────────────────────────────────
// /start
// ──────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id)
  if (user) {
    await ctx.reply(
      `👋 Halo, *${user.nama}!*\n\nKamu sudah terdaftar di ${ECOSYSTEM_NAME} Dashboard.\n\n` +
      `Menjelang akhir periode laporan tiap minggu, ketik */laporan* untuk isi weekly report langsung dari sini! 📊`,
      { parse_mode: 'Markdown', ...MAIN_KEYBOARD }
    )
  } else {
    await ctx.reply(
      `👋 Selamat datang di *${ECOSYSTEM_NAME} Dashboard Bot!*\n\n` +
      `Hubungkan akun ${ECOSYSTEM_NAME} kamu:\n\n${PETUNJUK_TAUT}`,
      { parse_mode: 'Markdown' }
    )
  }
})

// ──────────────────────────────────────────────────────────
// /laporan — masuk wizard
// ──────────────────────────────────────────────────────────

bot.command('laporan', (ctx) => ctx.scene.enter('laporan-wizard'))

// ──────────────────────────────────────────────────────────
// /daftar
// ──────────────────────────────────────────────────────────

bot.command('daftar', async (ctx) => {
  // Kode tautan hanya boleh dikirim lewat chat PRIBADI — di grup, isi pesan terbaca anggota lain.
  if (ctx.chat?.type !== 'private') {
    return ctx.reply('🔒 Kirim perintah ini lewat chat pribadi dengan bot ini, bukan di grup.')
  }
  const arg = (ctx.message.text.split(/\s+/)[1] ?? '').trim()
  // Format lama (`/daftar email`) sengaja ditolak: email bukan bukti kepemilikan akun.
  if (!arg || arg.includes('@')) {
    return ctx.reply(`Cara menghubungkan akun sekarang memakai kode:\n\n${PETUNJUK_TAUT}`, { parse_mode: 'Markdown' })
  }

  const idTg = String(ctx.from.id)
  const catatan = gagalDaftar.get(idTg)
  if (catatan && Date.now() < catatan.sampai && catatan.n >= MAKS_GAGAL) {
    return ctx.reply('⛔ Terlalu banyak kode yang salah. Coba lagi beberapa menit lagi.')
  }
  const tolak = (pesan) => {
    const n = catatan && Date.now() < catatan.sampai ? catatan.n + 1 : 1
    gagalDaftar.set(idTg, { n, sampai: catatan && Date.now() < catatan.sampai ? catatan.sampai : Date.now() + JENDELA_GAGAL_MS })
    return ctx.reply(pesan)
  }

  const kode = normalisasiKode(arg)
  if (!kodeValid(kode)) return tolak('❌ Kode tidak valid. Salin ulang dari halaman Profil.')
  const hash = hashKode(kode)

  const user = await prisma.user.findFirst({
    where: { telegramKodeHash: hash, telegramKodeKadaluarsa: { gt: new Date() }, statusAktif: true },
    select: { id: true, nama: true, telegramId: true },
  })
  if (!user) return tolak('❌ Kode salah atau sudah kedaluwarsa. Buat kode baru di halaman Profil.')

  // Telegram ini sudah dipakai akun LAIN → jangan diam-diam dipindah (nama akun itu tidak disebut).
  const bentrok = await prisma.user.findFirst({ where: { telegramId: idTg, id: { not: user.id } }, select: { id: true } })
  if (bentrok) {
    return ctx.reply('❌ Telegram ini sudah terhubung ke akun lain. Putuskan dulu dari halaman Profil akun tersebut.')
  }

  // Pakai-sekali secara atomik: bila dua pesan datang bersamaan, hanya satu yang menang.
  const hasil = await prisma.user.updateMany({
    where: { id: user.id, telegramKodeHash: hash, telegramKodeKadaluarsa: { gt: new Date() } },
    data: { telegramId: idTg, telegramKodeHash: null, telegramKodeKadaluarsa: null },
  })
  if (hasil.count !== 1) return tolak('❌ Kode salah atau sudah kedaluwarsa. Buat kode baru di halaman Profil.')
  gagalDaftar.delete(idTg)

  await ctx.reply(
    `✅ Akun *${user.nama}* berhasil terhubung!\n\nMenjelang akhir periode laporan tiap minggu, ketik */laporan* untuk isi weekly report. 🚀`,
    { parse_mode: 'Markdown', ...MAIN_KEYBOARD }
  )
  // Tautan dipindah dari Telegram lain (pemilik akun sendiri yang membuat kodenya) → beri tahu yang lama.
  if (user.telegramId && user.telegramId !== idTg) {
    notifyUser(user.telegramId, '⚠️ Akun kamu baru saja dihubungkan ke Telegram lain, jadi bot ini tidak lagi terhubung. Kalau bukan kamu, segera ganti password.').catch(() => {})
  }
})

// ──────────────────────────────────────────────────────────
// /report — status laporan minggu ini (read-only) — aturan = web: Kader ke atas, studio dalam cakupan
// ──────────────────────────────────────────────────────────

bot.command('report', async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id)
  if (!user) return ctx.reply(PESAN_DAFTAR_DULU, { parse_mode: 'Markdown' })
  if (!KADER_KE_ATAS(user)) return ctx.reply(pesanKader())

  const studios = await studioDalamLingkup(user, ['ADMIN_FUNGSIONAL'])
  if (!studios.length) return ctx.reply('❌ Tidak ada studio dalam cakupanmu.')

  // Periode yang SAMA dengan yang dipakai /laporan saat menyimpan (periode yang memuat hari ini).
  const { periodeAwal, periodeAkhir } = getReportingPeriod()
  const batasAkhir = new Date(periodeAkhir.getTime() + 24 * 60 * 60 * 1000)
  const laporan = await prisma.weeklyReport.findMany({
    where: { studioId: { in: studios.map(st => st.id) }, periodeAwal: { gte: periodeAwal, lt: batasAkhir } },
    select: { studioId: true, totalUsd: true },
    orderBy: { createdAt: 'desc' },
  })
  const per = {}
  for (const l of laporan) if (!per[l.studioId]) per[l.studioId] = l

  const baris = studios.slice(0, 40).map(st =>
    per[st.id] ? `✅ ${labelStudio(st)} — ${fmtUSD(per[st.id].totalUsd)}` : `❌ ${labelStudio(st)}`
  )
  const dihitung = studios.filter(st => st.hitungDiEkosistem !== false)
  const sudah = dihitung.filter(st => per[st.id]).length
  const adaKolab = studios.some(st => st.hitungDiEkosistem === false)
  const bisaLapor = hasAnyRole(user.roles ?? [], ROLE_KIRIM_LAPORAN)

  await ctx.reply(
    `📊 *Status Weekly Report*\nPeriode: ${getWeekPeriodLabel()}\n\n${baris.join('\n')}` +
    `\n\n*${sudah}/${dihitung.length} studio sudah lapor*` +
    (studios.length > 40 ? `\n_(${studios.length - 40} studio lain tidak ditampilkan)_` : '') +
    (adaKolab ? `\n_${CATATAN_KOLABORASI}_` : '') +
    (bisaLapor && sudah < dihitung.length ? `\n\nKetik */laporan* untuk mengisi. 🚀` : ''),
    { parse_mode: 'Markdown' }
  )
})

// ──────────────────────────────────────────────────────────
// /kas — saldo kas & omset bulan ini per studio — aturan = web: Kader ke atas, studio dalam cakupan
// ──────────────────────────────────────────────────────────

// /idgrup (12 Nov 2026): menampilkan ID chat grup untuk TELEGRAM_GRUP_ORDER (kabar order baru ke grup koordinator, utils/notifGrup.js).
// Hanya di grup; tidak membuka data apa pun.
bot.command('idgrup', (ctx) => {
  if (!['group', 'supergroup'].includes(ctx.chat?.type)) return ctx.reply('Perintah ini dipakai di dalam grup.')
  return ctx.reply(`ID grup ini: ${ctx.chat.id}\nIsi TELEGRAM_GRUP_ORDER=${ctx.chat.id} di server/.env lalu restart md-dashboard.`)
})

bot.command('kas', async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id)
  if (!user) return ctx.reply(PESAN_DAFTAR_DULU, { parse_mode: 'Markdown' })
  if (!KADER_KE_ATAS(user)) return ctx.reply(pesanKader())

  const studios = await studioDalamLingkup(user, ['ADMIN_FUNGSIONAL'])
  if (!studios.length) return ctx.reply('❌ Tidak ada studio dalam cakupanmu.')
  const ids = studios.map(st => st.id)

  // Kas = saldo Rekening Bank live (sama dengan web), bukan kas laporan terakhir yang bisa basi.
  const kasMap = await getKasMapForStudios(ids)

  // findMany + filter (bukan aggregate langsung) -- getStartOfMonth() cuma batas fetch AMAN
  // (over-inclusive), butuh baris mentah buat difilter presisi lewat isReportInMonth().
  const now = new Date()
  const laporanBulan = await prisma.weeklyReport.findMany({
    where: { studioId: { in: ids }, periodeAwal: { gte: getStartOfMonth() } },
    select: { studioId: true, totalUsd: true, periodeAwal: true, periodeAkhir: true },
  })
  const omset = {}
  for (const r of laporanBulan.filter(r => isReportInMonth(r, now.getMonth() + 1, now.getFullYear()))) {
    omset[r.studioId] = (omset[r.studioId] ?? 0) + r.totalUsd
  }

  const baris = studios.slice(0, 40).map(st =>
    `• *${labelStudio(st)}*\n   ${fmtRp(kasMap[st.id] ?? 0)} · ${fmtUSD(omset[st.id] ?? 0)} bulan ini`
  )
  const dihitung = studios.filter(st => st.hitungDiEkosistem !== false)
  const total = dihitung.reduce((a, st) => a + (kasMap[st.id] ?? 0), 0)
  const adaKolab = studios.some(st => st.hitungDiEkosistem === false)

  await ctx.reply(
    `💰 *Kas Studio*\n_Saldo Rekening Bank · omset bulan ini_\n\n${baris.join('\n')}` +
    `\n\n*Total saldo${studios.length > 1 ? ` (${dihitung.length} studio)` : ''}: ${fmtRp(total)}*` +
    (studios.length > 40 ? `\n_(${studios.length - 40} studio lain tidak ditampilkan)_` : '') +
    (adaKolab ? `\n_${CATATAN_KOLABORASI}_` : ''),
    { parse_mode: 'Markdown' }
  )
})

// ──────────────────────────────────────────────────────────

bot.command('rekap', async (ctx) => {
  const user = await getUserByTelegramId(ctx.from.id)
  if (!user) return ctx.reply(PESAN_DAFTAR_DULU, { parse_mode: 'Markdown' })

  // Aturan web: angka ekosistem hanya untuk yang bisa membuka Dashboard penuh (Koordinator ke atas).
  if (!hasAnyRole(user.roles ?? [], ROLE_DASHBOARD_PENUH)) {
    return ctx.reply('🔒 Rekap ekosistem hanya untuk Koordinator ke atas — sama seperti Dashboard di web.')
  }

  // Angka dana hanya dari wilayah peran (utils/lingkup.js): Advisor/Kepala Ekosistem = seluruh ekosistem,
  // peran lain = unit/circle/rumah usaha miliknya — sama persis dengan Dashboard web.
  const lingkup = await lingkupKeuangan(user.roles ?? [])
  const [totalUsers, totalStudios, weekReports, omsetBulanReports] = await Promise.all([
    // Rekap ekosistem: studio kolaborasi (angkanya dihitung di circle mitra) tidak ikut dihitung.
    prisma.user.count({ where: { statusAktif: true, ...USER_BUKAN_KOLABORASI_SAJA } }),
    prisma.studio.count({ where: { statusAktif: true, ...STUDIO_DIHITUNG } }),
    prisma.weeklyReport.count({ where: { periodeAwal: { gte: getStartOfWeekWIB() }, ...LAPORAN_DIHITUNG } }),
    // findMany + filter (bukan aggregate langsung) -- getStartOfMonth() cuma batas fetch AMAN
    // (over-inclusive), butuh baris mentah buat difilter presisi lewat isReportInMonth().
    prisma.weeklyReport.findMany({
      where: { periodeAwal: { gte: getStartOfMonth() }, ...LAPORAN_DIHITUNG, ...filterStudioId(lingkup) },
      select: { totalUsd: true, periodeAwal: true, periodeAkhir: true },
    }),
  ])
  const now = new Date()
  const omsetBulanUsd = omsetBulanReports
    .filter(r => isReportInMonth(r, now.getMonth() + 1, now.getFullYear()))
    .reduce((a, r) => a + r.totalUsd, 0)

  await ctx.reply(
    `📊 *Rekap Ekosistem ${ECOSYSTEM_NAME}*\n\n` +
    `👥 Anggota: *${totalUsers}*\n` +
    `🏢 Unit usaha: *${totalStudios}*\n` +
    `📝 Laporan minggu ini: *${weekReports}/${totalStudios}*\n` +
    `💰 Omset bulan ini${lingkup.semua ? '' : ' (wilayahmu)'}: *${fmtUSD(omsetBulanUsd)}*\n\n` +
    `${DASH}`,
    { parse_mode: 'Markdown' }
  )
})

// ──────────────────────────────────────────────────────────
// /help
// ──────────────────────────────────────────────────────────

bot.command('help', (ctx) => {
  ctx.reply(
    `🤖 *${ECOSYSTEM_NAME} Dashboard Bot*\n\n` +
    `*Perintah:*\n\n` +
    `/laporan — ✍️ Isi weekly report _(Koordinator, Pendamping, Kepala, Super Admin)_\n` +
    `/report — Status laporan minggu ini _(Kader ke atas)_\n` +
    `/kas — Saldo kas studio _(Kader ke atas)_\n` +
    `/rekap — Rekap ekosistem _(Koordinator ke atas)_\n` +
    `/daftar KODE — Hubungkan akun (kode dari halaman Profil)\n` +
    `/batal — Batalkan proses yang sedang berjalan\n\n` +
    `🌐 Dashboard: ${DASH}`,
    // Markdown biasa (bukan MarkdownV2): V2 mewajibkan escape untuk ( ) . - dst, dan pesan ini mengandungnya
    // sehingga Telegram menolaknya (400 "can't parse entities") — /help tidak pernah terkirim.
    { parse_mode: 'Markdown', ...MAIN_KEYBOARD }
  )
})

// ──────────────────────────────────────────────────────────
// SCHEDULER — Jadwal Jumat/Sabtu
// ──────────────────────────────────────────────────────────

async function sendToAllKoordinators(message) {
  const users = await prisma.user.findMany({
    where: {
      telegramId: { not: null },
      roles: { some: { roleType: { in: ['KOORDINATOR','PENDAMPING','KEPALA_CIRCLE','KEPALA_RUMAH_USAHA','KEPALA_EKOSISTEM'] } } },
    },
    select: { telegramId: true },
  })
  for (const u of users) {
    try { await bot.telegram.sendMessage(u.telegramId, message, { parse_mode: 'Markdown' }) } catch {}
  }
  return users.length
}

// Deadline lapor = periodeAkhir dari periode laporan yang lagi berjalan (getReportingPeriod) --
// biasanya Sabtu (minggu penuh Senin-Minggu), TAPI bisa hari lain kalau lagi di stub pendek awal/
// akhir bulan. Cron di bawah SEKARANG jalan tiap hari (bukan cuma Jumat/Sabtu) dan handler-nya
// sendiri yang cek "apa besok/hari ini beneran deadline periode berjalan" sebelum kirim --
// sebelumnya dijadwalkan hard di hari tetap, jadi salah/gak bunyi sama sekali kalau deadline-nya
// kebetulan bukan Jumat/Sabtu itu.
function getTodayWIB() {
  const WIB_MS = 7 * 60 * 60 * 1000
  const nowWIB = new Date(Date.now() + WIB_MS)
  return new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth(), nowWIB.getUTCDate()))
}

// Pengingat hanya boleh dijadwalkan di proses bot (bot-standalone.js). bot.js juga ikut ter-import
// oleh app.js (notifyUser) — kalau cron jalan di import-an itu, tiap pengingat terkirim dobel.
export function mulaiJadwal() {
// 08:00 tiap hari — reminder H-1 (laporan besok deadline)
cron.schedule('0 8 * * *', async () => {
  const { periodeAkhir } = getReportingPeriod()
  const besok = new Date(getTodayWIB().getTime() + 24 * 60 * 60 * 1000)
  if (besok.getTime() !== periodeAkhir.getTime()) return // besok bukan deadline, gak usah kirim

  const week = getWeekPeriodLabel()
  await sendToAllKoordinators(
    `📊 *Reminder Weekly Report*\n\n` +
    `Halo! Besok adalah hari terakhir periode laporan 📅\n\n` +
    `Periode: *${week}*\n\n` +
    `Besok langsung ketik */laporan* di sini untuk isi omset & kas studio kamu. ✍️`
  )
}, { timezone: 'Asia/Jakarta' })

// 09:00 tiap hari — hari-H deadline, buka laporan
cron.schedule('0 9 * * *', async () => {
  const { periodeAkhir } = getReportingPeriod()
  if (getTodayWIB().getTime() !== periodeAkhir.getTime()) return // bukan hari deadline, skip

  const week = getWeekPeriodLabel()
  await sendToAllKoordinators(
    `🚀 *Hari Laporan! — ${week}*\n\n` +
    `Ketik */laporan* sekarang untuk isi weekly report langsung di Telegram.\n\n` +
    `Hanya butuh 1 menit! ⚡`
  )
}, { timezone: 'Asia/Jakarta' })

// 00:30 tanggal 1 — foto CPM semua studio untuk bulan yang baru berakhir (studio yang sudah punya foto dilewati)
cron.schedule('30 0 1 * *', async () => {
  try {
    const { bulan, tahun } = bulanIniWIB()
    const lalu = bulan === 1 ? { bulan: 12, tahun: tahun - 1 } : { bulan: bulan - 1, tahun }
    const hasil = await simpanFotoCpm(lalu.bulan, lalu.tahun)
    console.log('[cpm] foto bulanan', hasil)
  } catch (err) {
    console.error('[cpm] foto bulanan gagal:', err.message)
  }
}, { timezone: 'Asia/Jakarta' })

// 15:00 tiap hari — hari-H deadline, alert studio yang belum lapor
cron.schedule('0 15 * * *', async () => {
  const { periodeAwal: weekStart, periodeAkhir } = getReportingPeriod()
  if (getTodayWIB().getTime() !== periodeAkhir.getTime()) return // bukan hari deadline, skip

  const studios        = await prisma.studio.findMany({
    where:   { statusAktif: true },
    include: { weeklyReports: { where: { periodeAwal: { gte: weekStart } }, take: 1 } },
  })
  // PT (Korporasi) ikut dianggap sudah lapor bila unit di bawahnya sudah lapor.
  const belumLapor = laporLewatAnak(studios.map(s => ({ ...s, sudahLapor: s.weeklyReports.length > 0 })))
    .filter(s => !s.sudahLapor)
  if (!belumLapor.length) return

  const koordinatorIds = [...new Set(belumLapor.map(s => s.koordinatorId).filter(Boolean))]
  const koordinators   = await prisma.user.findMany({
    where: { id: { in: koordinatorIds }, telegramId: { not: null } },
    select: { id: true, telegramId: true, nama: true },
  })

  const studioByKoord = {}
  for (const s of belumLapor) {
    if (s.koordinatorId) {
      if (!studioByKoord[s.koordinatorId]) studioByKoord[s.koordinatorId] = []
      studioByKoord[s.koordinatorId].push(s.nama)
    }
  }

  for (const k of koordinators) {
    const names = studioByKoord[k.id]?.join(', ') ?? ''
    try {
      await bot.telegram.sendMessage(
        k.telegramId,
        `⚠️ *Halo ${k.nama}!*\n\n` +
        `Studio *${names}* belum lapor hari ini.\n\n` +
        `Ketik */laporan* sekarang — cepat kok! 🙏`,
        { parse_mode: 'Markdown' }
      )
    } catch {}
  }
}, { timezone: 'Asia/Jakarta' })

// Pengingat web circle (audit OGS #10) — rencana harian, delivery H-1…5, biaya jatuh tempo, belum presensi,
// laporan harian marketer. MATI secara bawaan (OTOMASI_AKTIF=1 menyalakan, sama dengan otomatisasi di bawah); pratinjau isi pesan ada di
// web circle → Kehadiran → Pengingat. Hanya terkirim ke user yang sudah menautkan Telegram.
async function kirimPengingat(jenis) {
  if (process.env.OTOMASI_AKTIF !== '1') return
  try {
    const { kumpulkan } = await import('./utils/pengingatDb.js')
    for (const x of await kumpulkan(jenis)) {
      if (!x.telegramId) continue
      try { await bot.telegram.sendMessage(String(x.telegramId), x.teks) } catch {}
    }
  } catch (e) { console.error('[pengingat]', jenis, e?.message) }
}
// Kebersihan data (tanpa pesan, jadi TIDAK dikunci OTOMASI_AKTIF): tutup penugasan tahap yang menggantung di order SELESAI/BATAL
// (mis. diubah lewat halaman Produksi lama). Adaptasi OGS tasks:close-stale.
cron.schedule('55 7 * * 1-6', async () => {
  try { const { tutupPenugasanBasi } = await import('./utils/penugasanDb.js'); const r = await tutupPenugasanBasi(); if (r.selesai || r.ditutup) console.log('[close-stale]', r) } catch (e) { console.error('[close-stale]', e?.message) }
}, { timezone: 'Asia/Jakarta' })
cron.schedule('0 8 * * 1-6', () => kirimPengingat('rencana'), { timezone: 'Asia/Jakarta' })
cron.schedule('5 8 * * 1-6', () => kirimPengingat('delivery'), { timezone: 'Asia/Jakarta' })
cron.schedule('10 9 * * 1-6', () => kirimPengingat('biaya'), { timezone: 'Asia/Jakarta' })
cron.schedule('30 10 * * 1-6', () => kirimPengingat('presensi'), { timezone: 'Asia/Jakarta' })
cron.schedule('30 17 * * 1-6', () => kirimPengingat('laporanMarketer'), { timezone: 'Asia/Jakarta' })

// Tiap 10 menit — PULANG OTOMATIS per unit (16 Nov 2026, masukan tim): unit yang menyalakannya (web circle › Kehadiran › Jam kerja unit)
// menutup sesi tanpa presensi pulang setelah jam batasnya; waktu pulang = jam pulang resmi, tanpa lembur. Pekerjaan data (bukan pesan),
// jadi TIDAK dikunci OTOMASI_AKTIF; tanpa unit yang menyalakan = tidak melakukan apa pun.
cron.schedule('*/10 * * * *', async () => {
  try { const { tutupPulangOtomatis } = await import('./utils/jamKerjaUnit.js'); const r = await tutupPulangOtomatis(); if (r.ditutup) console.log('[pulang-otomatis]', r) } catch (e) { console.error('[pulang-otomatis]', e.message) }
}, { timezone: 'Asia/Jakarta' })

// 20:00 tiap hari — LAPORAN HARIAN MARKET otomatis ke topik grup koordinator (12 Nov 2026, keputusan user: tidak ada lagi lapor manual).
// Bukan pengingat pribadi, jadi TIDAK dikunci OTOMASI_AKTIF; mati bila TELEGRAM_GRUP_ORDER kosong. Satu pesan per unit yang ada kegiatan/marketer.
cron.schedule('0 20 * * *', async () => {
  try { const { kirimLaporanHarianGrup } = await import('./utils/laporanGrup.js'); const r = await kirimLaporanHarianGrup(); if (r.terkirim) console.log('[laporan-grup]', r) } catch (e) { console.error('[laporan-grup]', e?.message) }
}, { timezone: 'Asia/Jakarta' })

// 08:30 tiap hari — otomatisasi produksi web circle (adaptasi OGS): peringatan deadline tanpa penanggung jawab (H-1/H-0, sekali per
// order per hari) + eskalasi QC macet (≥3 hari → diskusi otomatis). HANYA jalan di proses md-bot (mulaiJadwal dipanggil bot-standalone.js).
// MATI secara bawaan: nyalakan dengan OTOMASI_AKTIF=1 di server/.env lalu restart pm2 (supaya koordinator tidak tiba-tiba menerima
// pesan sebelum diberi tahu). Pemeriksaan manual per unit tetap tersedia di web circle (Analitik → Peringatan).
cron.schedule('30 8 * * *', async () => {
  if (process.env.OTOMASI_AKTIF !== '1') return
  try {
    const { alertDeadlineBaru, eskalasiQcMacet } = await import('./utils/otomasiDb.js')
    const kirim = async (userIds, teks) => {
      const u = await prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] }, telegramId: { not: null }, statusAktif: true }, select: { telegramId: true } })
      for (const x of u) { try { await bot.telegram.sendMessage(String(x.telegramId), teks) } catch {} }
    }
    const studios = await prisma.studio.findMany({ where: { statusAktif: true }, select: { id: true, nama: true } })
    for (const s of studios) {
      const pengelola = async () => {
        const r = await prisma.userRole.findMany({ where: { studioId: s.id, roleType: { in: ['KOORDINATOR', 'PENDAMPING'] } }, select: { userId: true } })
        const a = await prisma.produksiAdminMarket.findMany({ where: { studioId: s.id }, select: { userId: true } })
        return [...r.map(x => x.userId), ...a.map(x => x.userId)]
      }
      const peringatan = await alertDeadlineBaru(s.id)
      if (peringatan.length) {
        const baris = peringatan.map(p => `• ${p.judul} (${p.label})${p.saran.length ? ' — saran: ' + p.saran.map(x => x.nama).join(', ') : ''}`).join('\n')
        await kirim(await pengelola(), `⏰ ${s.nama}: ${peringatan.length} order mendekati deadline tanpa penanggung jawab\n\n${baris}\n\nTugaskan di web circle → Penugasan.`)
      }
      for (const d of await eskalasiQcMacet(s.id)) await kirim(d.peserta, `🔎 ${s.nama}: order "${d.judul}" sudah ${d.umurHari} hari di tahap QC. Diskusi otomatis dibuat — buka menu Diskusi di web circle.`)
    }
  } catch (e) { console.error('[otomasi]', e.message) }
}, { timezone: 'Asia/Jakarta' })

}

// ──────────────────────────────────────────────────────────
// NOTIFY HELPERS — dipanggil dari controller
// ──────────────────────────────────────────────────────────

export async function notifyUser(telegramId, message) {
  try {
    await bot.telegram.sendMessage(String(telegramId), message, { parse_mode: 'Markdown' })
    return true
  } catch { return false }
}

export async function broadcast(message) {
  return sendToAllKoordinators(message)
}

// Pesan yang tak dikenali (mis. "profil", "/profil") — HARUS paling akhir supaya perintah & wizard
// laporan diproses lebih dulu. Tanpa ini bot diam saja dan terkesan mati. Hanya di chat pribadi
// (di grup bot tidak boleh menjawab setiap obrolan).
bot.on('text', async (ctx) => {
  if (ctx.chat?.type !== 'private') return
  const user = await getUserByTelegramId(ctx.from.id)
  if (!user) return ctx.reply(PESAN_DAFTAR_DULU, { parse_mode: 'Markdown' })
  return ctx.reply(
    '🤔 Aku belum paham pesan itu.\n\nPakai tombol di bawah, atau ketik /help untuk melihat perintah yang tersedia.',
    MAIN_KEYBOARD
  )
})

bot.catch((err) => console.error('[Bot Error]', err.message))

export default bot
