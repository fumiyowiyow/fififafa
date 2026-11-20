# Management Dashboard

> **⚠️ Ini repo TEMPLATE. Jangan dikerjakan langsung.** Buat repo sendiri dulu: tombol **Use this template** di
> GitHub (atau salin tanpa riwayat), ganti nama ekosistem, lalu kerjakan di repo baru itu. Langkah lengkap: **`KLON.md`**.

Web internal untuk mengelola satu ekosistem usaha kreatif: laporan omset mingguan, pengeluaran & kas, rekap bulanan,
koperasi, dana, anggota & peran, penilaian kader, rekrutmen, payroll, unit usaha, dan laporan PDF. Kerja harian tiap
unit (produksi, marketing, kehadiran, keuangan unit) ada di pasangannya, **Unit Operations Dashboard**, yang memakai
backend dan database repo ini.

- **Stack:** React 19 + Vite 5 · Node.js 20 + Express 5 · PostgreSQL + Prisma 5 · bot Telegram (Telegraf)
- **Dokumen:** `KLON.md` (mulai di sini) · `openspec.md` (spesifikasi & aturan) · `CLAUDE.md` / `AGENTS.md`
  (panduan kerja & aturan kode) · `DESIGN_SYSTEM.md` (tampilan)

## Menjalankan di laptop

Prasyarat: Node.js 20+, PostgreSQL 16.

```bash
npm run install:all
cp server/.env.example server/.env        # isi DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, CLIENT_URL
cd server && npx prisma migrate deploy && npx prisma generate
ADMIN_EMAIL=admin@contoh.test ADMIN_NAMA="Admin" ADMIN_PASSWORD='minimal-12-karakter' npm run db:seed
cd .. && npm run dev                       # client http://localhost:5173 · server http://localhost:3001
```

## Produksi (ringkas)

Build client (`npm run build`), jalankan `npm start` (atau PM2) di `127.0.0.1:3001` di belakang nginx + HTTPS, dan
jalankan bot sebagai proses terpisah (`node server/src/bot-standalone.js`). Setiap deploy: backup database →
`npx prisma migrate deploy` → `npx prisma generate` → build → restart server & bot. Backup harian contoh:
`server/scripts/backup-db.sh`, `server/scripts/backup-uploads.sh` (sesuaikan path & tujuan salinannya).
