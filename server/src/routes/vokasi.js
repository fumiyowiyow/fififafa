// ══ JEMBATAN Ekosistem → JALUR TUMBUH (web vokasi, tumbuh.kariranak.com) — 22 Okt 2026 ═══════════════════════
// Supaya anak & mentor yang punya akun Ekosistem bisa masuk Jalur Tumbuh dengan EMAIL + SANDI Ekosistem (tanpa akun baru).
// Rancangan: Vokasi Dashboard docs/keamanan.md § 3 (disetujui Faizal).
//   - HANYA dari dalam VPS: server Tumbuh memanggil http://127.0.0.1:3001/api/vokasi/* langsung. Permintaan yang
//     lewat nginx (semua situs Ekosistem & circle memasang X-Real-IP/X-Forwarded-For) DITOLAK 404 — jadi pintu ini tidak
//     bisa diketuk dari internet walau rahasianya bocor.
//   - Dijaga kunci rahasia VOKASI_RAHASIA (≥32 karakter, sama di .env Ekosistem & Tumbuh; perbandingan waktu-tetap).
//   - Sandi TIDAK disimpan / dicatat di mana pun; Ekosistem hanya menjawab sah/tidak + id + aktif.
//   - Tidak mengubah data Ekosistem sama sekali (hanya membaca User).
import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import rateLimit from 'express-rate-limit'
import prisma from '../prisma.js'

const router = Router()
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-vokasi', 10)
const MAKS_DAFTAR = 500

function hanyaDariTumbuh(req, res, next) {
  const rahasia = process.env.VOKASI_RAHASIA ?? ''
  const kiriman = String(req.get('x-vokasi-rahasia') ?? '')
  const lewatNginx = Boolean(req.get('x-real-ip') || req.get('x-forwarded-for'))
  const alamat = req.socket.remoteAddress
  const lokal = alamat === '127.0.0.1' || alamat === '::1' || alamat === '::ffff:127.0.0.1'
  const cocok = rahasia.length >= 32 && kiriman.length === rahasia.length &&
    crypto.timingSafeEqual(Buffer.from(kiriman), Buffer.from(rahasia))
  // 404 (bukan 403) supaya keberadaan pintu ini tidak terlihat
  if (lewatNginx || !lokal || !cocok) return res.status(404).json({ success: false, message: 'Tidak ditemukan' })
  next()
}

// Percobaan sandi dibatasi per email (permintaan selalu dari 127.0.0.1, jadi bukan per IP)
const batasVerifikasi = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `vokasi:${String(req.body?.email ?? '').toLowerCase().slice(0, 120)}`,
  standardHeaders: false,
  legacyHeaders: false,
  validate: false,
  message: { sah: false, terlaluBanyak: true },
})

router.use(hanyaDariTumbuh)

// POST /api/vokasi/verifikasi { email, password } → { sah, id?, nama?, aktif? }
router.post('/verifikasi', batasVerifikasi, async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    if (!email || !password) return res.status(401).json({ sah: false })
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, nama: true, passwordHash: true, statusAktif: true } })
    const cocok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !cocok) return res.status(401).json({ sah: false })
    return res.json({ sah: true, id: user.id, nama: user.nama, aktif: user.statusAktif })
  } catch {
    return res.status(500).json({ sah: false })
  }
})

// POST /api/vokasi/cari { emails: [] } → [{ email, id, nama, aktif }] — untuk admin Tumbuh menautkan anak ke akun Ekosistem
router.post('/cari', async (req, res) => {
  try {
    const emails = [...new Set((Array.isArray(req.body?.emails) ? req.body.emails : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))].slice(0, MAKS_DAFTAR)
    const rows = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, nama: true, statusAktif: true } })
    return res.json(rows.map((u) => ({ email: u.email, id: u.id, nama: u.nama, aktif: u.statusAktif })))
  } catch {
    return res.status(500).json([])
  }
})

// POST /api/vokasi/status { ids: [] } → [{ id, aktif }] — Tumbuh memeriksa ulang apakah akun Ekosistem masih aktif
router.post('/status', async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(String).slice(0, MAKS_DAFTAR)
    const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, statusAktif: true } })
    return res.json(rows.map((u) => ({ id: u.id, aktif: u.statusAktif })))
  } catch {
    return res.status(500).json([])
  }
})

export default router
