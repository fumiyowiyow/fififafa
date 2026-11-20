import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import { ECOSYSTEM_NAME } from './config/ecosystem.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Fail fast jika secret penting tidak diset
const REQUIRED_ENV = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'DATABASE_URL']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`)
    process.exit(1)
  }
}
import authRoutes         from './routes/auth.js'
import vokasiRoutes       from './routes/vokasi.js' // jembatan login Jalur Tumbuh (hanya dari 127.0.0.1 + rahasia)
import dashboardRoutes    from './routes/dashboard.js'
import membersRoutes      from './routes/members.js'
import weeklyReportRoutes from './routes/weeklyReport.js'
import pengeluaranRoutes from './routes/pengeluaran.js'
import cpmBulananRoutes from './routes/cpmBulanan.js'
import financeRoutes       from './routes/finance.js'
import kanbanRoutes        from './routes/kanban.js'
import announcementRoutes  from './routes/announcement.js'
import healthRoutes        from './routes/health.js'
import koperasiRoutes      from './routes/koperasi.js'
import kaderRoutes         from './routes/kader.js'
import performanceRoutes   from './routes/performance.js'
import goalsRoutes         from './routes/goals.js'
import assetRoutes         from './routes/asset.js'
import rekrutmenRoutes     from './routes/rekrutmen.js'
import profileRoutes       from './routes/profile.js'
import aiRoutes            from './routes/ai.js'
import milestoneRoutes     from './routes/milestone.js'
import telegramRoutes      from './routes/telegram.js'
import masterdataRoutes    from './routes/masterdata.js'
import modulRoutes         from './routes/modul.js'
import sosmedRoutes        from './routes/sosmed.js'
import memoriRoutes        from './routes/memori.js'
import direktoriTimRoutes  from './routes/direktoriTim.js'
import calendarRoutes    from './routes/calendar.js'
import reportsRoutes    from './routes/reports.js'
import jurnalTalentRoutes from './routes/jurnalTalent.js'
import raportRoutes       from './routes/raport.js'
import penilaianKaderRoutes from './routes/penilaianKader.js'
import monthlyDataRoutes  from './routes/monthlyData.js'
import orgFundReportRoutes from './routes/orgFundReport.js'
import danaPengembanganRoutes from './routes/danaPengembangan.js'
import circleRoutes        from './routes/circle.js'
import ringkasanCircleRoutes from './routes/ringkasanCircle.js'
import payrollRoutes       from './routes/payroll.js'

const app = express()
const PORT = process.env.PORT || 3001

// Di belakang nginx (1 lapis proxy): pakai IP klien asli dari X-Forwarded-For yang DITAMBAHKAN nginx
// (entri paling kanan), bukan 127.0.0.1. Tanpa ini semua pengguna terlihat satu IP, jadi pembatas login
// (30/15 menit) berlaku untuk seluruh organisasi bersama-sama. SYARAT: nginx harus meneruskan
// X-Forwarded-For (proxy_add_x_forwarded_for) — kalau tidak, klien bisa memalsukan header ini.
// Kalau nanti ada Cloudflare di depan nginx, jumlah lapisan di sini harus ikut dinaikkan.
app.set('trust proxy', 1)

// Origin localhost hanya untuk pengembangan — di produksi cukup CLIENT_URL (klien disajikan Express
// sendiri, jadi request same-origin tidak butuh CORS sama sekali).
const originDev = process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3001',
]
const allowedOrigins = new Set([process.env.CLIENT_URL, ...originDev].filter(Boolean))

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // dihandle oleh Vite build
  crossOriginEmbedderPolicy: false,
}))

// App internal, sengaja gak boleh ke-index mesin pencari -- lihat juga robots.txt +
// meta noindex di client/index.html. Header ini lebih kuat karena kebaca crawler
// meski gak render HTML/JS-nya.
app.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next() })

// Rate limiting — cuma buat /api, BUKAN request statis (JS/CSS/font hasil build client). Client
// di-code-split jadi puluhan chunk (lihat App.jsx React.lazy) -- kalau limiter kepasang global,
// satu kali buka app dari banyak orang di IP yang sama (mis. WiFi kantor/sekolah) bisa abisin
// jatah 1000 request/15 menit cuma dari download file statis doang, bukan dari abuse beneran.
// Insiden nyata: app.domain-anda.com keluar "Terlalu banyak request" pas buka halaman biasa (root "/"),
// bukan pas login/API call -- baru ketahuan gara-gara limiter kepasang di app.use() paling atas.
// Pengguna yang sudah login dihitung PER AKUN (bukan per IP): satu studio/kantor yang berbagi WiFi tidak
// saling menghabiskan jatah. Permintaan tanpa token sah tetap dihitung per IP seperti semula.
const idDariToken = (req) => {
  if (req._limiterId !== undefined) return req._limiterId
  let id = null
  const h = req.headers.authorization
  if (h?.startsWith('Bearer ')) { try { id = jwt.verify(h.slice(7), process.env.JWT_SECRET).id ?? null } catch { id = null } }
  return (req._limiterId = id)
}
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (idDariToken(req) ? 1500 : 1000),
  keyGenerator: (req) => { const id = idDariToken(req); return id ? `u:${id}` : ipKeyGenerator(req.ip) },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak request, coba lagi nanti' },
})


app.use(cors({
  origin: (origin, cb) => {
    // !origin = same-origin request (production: client served dari Express)
    if (!origin || allowedOrigins.has(origin)) return cb(null, true)
    cb(null, false)
  },
  credentials: true,
}))
app.use('/api', globalLimiter)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/api/ping', (_req, res) => {
  res.json({ success: true, message: `${ECOSYSTEM_NAME} Dashboard API running` })
})

app.use('/api/auth',           authRoutes)
app.use('/api/vokasi',         vokasiRoutes)
app.use('/api/dashboard',     dashboardRoutes)
app.use('/api/members',       membersRoutes)
app.use('/api/weekly-reports', weeklyReportRoutes)
app.use('/api/pengeluaran', pengeluaranRoutes)
app.use('/api/cpm-bulanan', cpmBulananRoutes)
app.use('/api/finance',        financeRoutes)
app.use('/api/kanban',         kanbanRoutes)
app.use('/api/announcements',  announcementRoutes)
app.use('/api/health',         healthRoutes)
app.use('/api/koperasi',       koperasiRoutes)
app.use('/api/kader',          kaderRoutes)
app.use('/api/performance',    performanceRoutes)
app.use('/api/goals',          goalsRoutes)
app.use('/api/assets',         assetRoutes)
app.use('/api/rekrutmen',      rekrutmenRoutes)
app.use('/api/profile',        profileRoutes)
app.use('/api/ai',             aiRoutes)
app.use('/api/milestones',     milestoneRoutes)
app.use('/api/telegram',       telegramRoutes)
app.use('/api/masterdata',    masterdataRoutes)
app.use('/api/modul',         modulRoutes)
app.use('/api/sosmed',        sosmedRoutes)
app.use('/api/memori',        memoriRoutes)
app.use('/api/direktori-tim', direktoriTimRoutes)
app.use('/api/calendar',       calendarRoutes)
app.use('/api/reports',        reportsRoutes)
app.use('/api/jurnal-talent',  jurnalTalentRoutes)
app.use('/api/raport',         raportRoutes)
app.use('/api/penilaian-kader', penilaianKaderRoutes)
app.use('/api/monthly-data',  monthlyDataRoutes)
app.use('/api/dana-pengembangan', danaPengembanganRoutes)
app.use('/api/org-fund-reports', orgFundReportRoutes)
app.use('/api/circle',         circleRoutes)
app.use('/api/web-circle',     ringkasanCircleRoutes) // ringkasan web circle untuk Management Dashboard (baca saja, per wilayah)
app.use('/api/payroll',        payrollRoutes)

// Serve client build di production
if (process.env.NODE_ENV === 'production') {
  const { serveClient } = await import('./build-client.js')
  serveClient(app)
}

// Error handler generik — WAJIB paling akhir. Tanpa ini, error yang gak sengaja ke-throw sebelum
// controller sempat jalan (paling sering: Multer nolak upload — file kegedean/tipe salah) jatuh ke
// default error handler Express yang balikin HTML, bukan JSON — client cuma dapet pesan generik
// ("Gagal mengunggah SKB") walau sebab aslinya jelas (mis. "Ukuran file terlalu besar").
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file terlalu besar' : err.message
    return res.status(422).json({ success: false, message: msg })
  }
  // Pesan yang SENGAJA ditujukan ke pengguna (mis. penolakan tipe file di middleware/upload.js).
  if (err?.untukPengguna) {
    return res.status(err.status ?? 422).json({ success: false, message: err.message })
  }
  // Error klien dari body-parser dkk (JSON rusak, body kegedean): pesan generik, bukan teks pustaka.
  const status = Number(err?.status ?? err?.statusCode)
  if (status >= 400 && status < 500) {
    const pesan = status === 413 ? 'Data yang dikirim terlalu besar' : 'Permintaan tidak valid'
    return res.status(status).json({ success: false, message: pesan })
  }
  if (err) {
    // Detail hanya di log server — err.message mentah bisa membuka nama tabel/query/path internal.
    console.error(err)
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' })
  }
  next()
})

// Hanya dengar di loopback (21 Okt 2026): port 3001 sempat terbuka ke internet tanpa nginx → header X-Unit-Web &
// X-Forwarded-For bisa dipalsukan (pembatas login per IP jadi bisa diakali) dan login lewat HTTP polos. Semua lalu lintas
// harus lewat nginx (127.0.0.1). HOST=0.0.0.0 hanya bila memang perlu diakses dari luar mesin.
const HOST = process.env.HOST || '127.0.0.1'
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`)
})

// Bot Telegram dijalankan terpisah via bot-standalone.js (pm2: md-bot)
