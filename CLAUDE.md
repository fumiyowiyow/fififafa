# CLAUDE.md

> ## ⚠️ Repo ini TEMPLATE — jangan dikerjakan langsung
> `mellakamal/management-dashboard` adalah template. Setiap ekosistem membuat **repo sendiri** dari template ini
> (GitHub: **Use this template**, atau salin tanpa riwayat), lalu bekerja di repo barunya. Langkahnya di `KLON.md`.
> - **Untuk AI:** cek `git remote get-url origin`. Kalau masih `mellakamal/management-dashboard`, JANGAN mengubah
>   kode atau dokumen. Berhenti dan ingatkan pengguna untuk membuat repo sendiri dulu. Pengecualian: pemilik template
>   meminta perbaikan template secara tegas — kerjakan di branch terpisah dan ajukan pull request, jangan langsung ke `main`.
> - Perbaikan yang berguna untuk semua ekosistem diajukan ke template lewat pull request dan disetujui pemilik.

Panduan untuk Claude Code di repo ini. Bahasa komunikasi dengan pengguna: **Bahasa Indonesia**.

## Project Context

**Management Dashboard** — web internal untuk mengelola satu ekosistem usaha kreatif: keuangan (laporan omset
mingguan, pengeluaran, kas, rekap bulanan, koperasi, dana), SDM (anggota, peran, penilaian kader, rekrutmen, payroll),
unit usaha (circle, rumah usaha, studio, project, korporasi), dan laporan PDF. Pasangannya, **Unit Operations
Dashboard** (repo terpisah), adalah tempat kerja harian tiap unit; backend dan database-nya ada di repo INI
(`/api/circle/*`).

Dokumen: **`openspec.md`** (spesifikasi produk & aturan), **`AGENTS.md`** (aturan kode), **`DESIGN_SYSTEM.md`**
(tampilan), **`KLON.md`** (menyiapkan ekosistem baru). Kalau dokumen dan kode berbeda, **kode yang benar** — perbaiki
dokumennya.

## Development Commands

```bash
npm run install:all          # pasang dependensi client + server (dari folder utama)
npm run dev                  # client (Vite :5173) + server (Express :3001) bersamaan
npm run dev:client | npm run dev:server
npm run build                # build client ke client/dist (disajikan Express)
npm start                    # NODE_ENV=production node server/src/app.js

npm run db:migrate           # prisma migrate DEPLOY: hanya menerapkan migrasi yang sudah ada
npm run db:generate          # prisma generate (WAJIB setelah migrasi/ubah skema)
npm run db:seed              # buat Super Admin pertama dari env ADMIN_EMAIL/ADMIN_NAMA/ADMIN_PASSWORD
```

Tidak ada test framework. Verifikasi lewat dev server, `npm run build`, dan skrip uji API di repo Unit Operations
Dashboard (`tes/`).

## Architecture

- **Monorepo:** `client/` (React 19 + Vite 5, CSS Modules, tanpa router library) dan `server/` (Node.js 20 + Express 5,
  Prisma 5 + PostgreSQL).
- **Produksi:** Express menyajikan `client/dist` dan API di **`127.0.0.1` saja** (env `HOST`), di belakang nginx. Bot
  Telegram berjalan sebagai proses terpisah (`server/src/bot-standalone.js`).
- **Client:** navigasi berbasis state — `App.jsx` memetakan string `active` ke objek `PAGES`; URL disinkronkan lewat
  tabel `ID_TO_SLUG`/`SLUG_TO_ID`. Halaman menerima `onNavigate(pageId)`. Token akses disimpan **di memori**
  (`services/api.js`), refresh token di cookie httpOnly, refresh otomatis saat 401.
- **Server:** `routes/` dan `controllers/` satu berkas per domain; `middleware/auth.js` (`authenticate`),
  `middleware/checkRole.js` (`checkRole`, `checkMinRole`, `populateRoles`, `checkCircleAccess`, `checkStudioAccess`);
  aturan peran di `utils/roles.js`.
- **Database:** `User` → banyak `UserRole` (`roleType` + opsional `circleId`/`rumahUsahaId`/`studioId`). `Studio`
  dimiliki `Circle` ATAU `RumahUsaha` (atau berada di bawah unit Korporasi lewat `indukId`). Daftar lengkap model:
  `openspec.md` § Lampiran.

## Key Conventions

- **Gaya:** CSS Modules + token CSS di `client/src/styles/index.css` (`:root` = gelap, `:root[data-theme="light"]` =
  terang). Jangan hardcode warna; warna transparan pakai `alfa()` dari `utils/warna.js`. Tema PDF di
  `components/laporan/pdf/tema.js`. Detail di `DESIGN_SYSTEM.md`.
- **Uang:** selalu `formatRp()` / `formatUSD()` dari `utils/format.js` (`null` → "—"). Istilah uang di layar mengikuti
  `openspec.md` § Kamus istilah uang.
- **Respons API:** `{ success: true, data }` atau `{ success: false, message }`; paginasi menambah `pagination`.
- **Penamaan:** komponen `PascalCase`, CSS module `camelCase`, route `kebab-case`, konstanta `SCREAMING_SNAKE_CASE`.
- **Nama ekosistem** hanya dari `client/src/config/ecosystem.js` dan env server `ECOSYSTEM_NAME`/`ECOSYSTEM_NAME_FULL`.
  Jangan menulis nama ekosistem, domain, nama orang, atau rekening di kode.
- **Waktu:** semua tanggal dan minggu dihitung dalam **WIB (UTC+7)**.

## Aturan produk yang dijalankan kode (jangan dilanggar tanpa keputusan pemilik)

1. **Wewenang per unit.** Aksi pengelola dan uang memakai `kelolaStudio` / `atasanStudio` / `atasanLingkup`
   (`utils/roles.js`): peran dan unitnya harus dari baris peran yang sama. Koordinator unit A yang hanya Kader di
   unit B tidak mengelola B.
2. **Koordinator = CEO unitnya:** target omset, kas awal, biaya tetap, persetujuan biaya, tutup bulan, kategori khusus,
   aturan lembur. Membuka lagi bulan yang sudah ditutup = Super Admin.
3. **Angka uang di luar wilayah peran disamarkan** (server mengirim `null`): satu sumber `utils/lingkup.js`
   (`lingkupKeuangan`, `samarkan`). Endpoint baru yang memuat uang WAJIB memakainya dan route WAJIB mengisi
   `req.userRoles`. Peran Kader/Karyawan/Magang/Dignity tidak membuka angka uang.
4. **Pemilik unit (`StudioPemilik`) = lihat saja**; tidak pernah dipakai untuk izin menulis.
5. **Studio kolaborasi** (`hitungDiEkosistem = false`) tidak ikut total ekosistem: setiap penjumlahan WAJIB memakai
   `utils/kolaborasi.js` (`STUDIO_DIHITUNG`, `LAPORAN_DIHITUNG`, `PERAN_DIHITUNG`, `userDihitung`).
6. **Satu sumber kas:** `WeeklyReport.kasSekarang` = snapshot `SUM(StudioRekening.saldo)` (`utils/kas.js`).
   **Pengeluaran per item** di tabel `Pengeluaran`; `WeeklyReport.pengeluaran` dihitung server (`utils/pengeluaran.js`).
   Pengeluaran hanya dicatat di Keuangan › Pengeluaran.
7. **Korporasi tidak lapor mingguan sendiri:** dianggap sudah lapor bila unit di bawahnya lapor (`utils/korporasi.js`
   `laporLewatAnak`) dan tidak dinilai di Kepatuhan Laporan.
8. **Mode bayangan:** kode web unit tidak menulis ke `WeeklyReport`, `StudioMonthlyNote`, atau `Pengeluaran` sampai
   pemilik memutuskan pipeline disambung. Jembatan yang ada hanya baca (`utils/omsetBayangan.js`).
9. **Token web unit** (`aud: 'circle'`) hanya berlaku untuk `/api/circle` dan `/api/auth`. Nginx wajib menimpa header
   `X-Unit-Web` (`app` untuk aplikasi ini, slug untuk tiap alamat unit). Server harus tetap mendengar di `127.0.0.1`.
10. **Menyamar** (Super Admin) tidak boleh menulis uang/presensi (`TULIS_TERLARANG_SAAT_MENYAMAR`,
    `middleware/auth.js`).
11. **Rekening** (`StudioRekening`) hanya dikirim ke pengelola unit itu; data bank freelancer tidak pernah dikirim utuh.
12. **Gerbang login opsional** `AKSES_DASHBOARD_MIN_ROLE` (mis. `KOORDINATOR`) membatasi siapa yang boleh masuk
    aplikasi ini dan memakai bot; web unit tidak terpengaruh.
13. **Bot Telegram:** aturan akses bot = aturan web (`ROLE_KIRIM_LAPORAN`, `ROLE_DASHBOARD_PENUH` di `utils/roles.js`).
    Cron pengingat hanya lewat `mulaiJadwal()` di `bot-standalone.js` (bukan di level modul `bot.js`, yang juga
    di-import `app.js` → pesan dobel). Pengingat web unit hanya berjalan bila `OTOMASI_AKTIF=1`.

## Database & migrasi

- Membuat migrasi baru: `cd server && npx prisma migrate dev --name <nama>` di database lokal, lalu
  `npx prisma generate`. **Jangan pernah** memberi `--shadow-database-url` ke database yang berisi data: Prisma
  mengosongkan database itu.
- Menambah nilai enum yang sudah ada: tulis `ALTER TYPE ... ADD VALUE IF NOT EXISTS` di berkas migrasi tersendiri
  (jangan dicampur DDL lain).
- Urutan deploy: backup database → `migrate deploy` → `prisma generate` → build client → restart proses server & bot.
  Tanpa `prisma generate`, Prisma Client lama bisa crash saat membaca nilai enum baru.
- Migrasi sudah diuji dari database kosong: hasilnya sama persis dengan `schema.prisma`. Jaga agar tetap begitu
  (cek dengan `prisma migrate diff --from-url <db-uji-kosong> --to-schema-datamodel prisma/schema.prisma`).

## Keamanan

- Rahasia hanya di `server/.env` (izin 600, tidak di git): `JWT_SECRET`, `REFRESH_TOKEN_SECRET` (acak, ≥32 karakter,
  berbeda), `DATABASE_URL`, token bot, kunci API. Server berhenti kalau tiga yang pertama kosong.
- File upload di `server/uploads/` disajikan tanpa login; pengamannya nama file acak (`randomBytes(24)`). Jangan
  memakai nama file yang bisa ditebak.
- Jangan menaruh token GitHub di server. Jangan meng-commit `.env`, backup database, atau data anggota.
