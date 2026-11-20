# Menyiapkan Management Dashboard untuk ekosistem baru

## ⚠️ Aturan template: buat repo sendiri dulu

Repo `mellakamal/management-dashboard` (dan pasangannya `mellakamal/unit-operations-dashboard`) adalah **template**.
Template tidak dikerjakan langsung, tidak berisi data ekosistem mana pun, dan hanya berubah lewat pull request yang
disetujui pemilik template.

1. **Buat repo baru dari template:** di GitHub buka repo template → **Use this template** → **Create a new repository**
   (pilih *Private*). Repo baru otomatis tanpa riwayat template. Lakukan untuk kedua repo (Management Dashboard dan
   Unit Operations Dashboard), simpan keduanya bersebelahan dalam satu folder.
   Tanpa akses tombol itu: unduh isi repo (tanpa folder `.git`), lalu `git init` di repo baru.
2. **Kerjakan hanya di repo baru**: nama ekosistem, domain, env, data, dan semua perubahan.
3. **Perbaikan untuk semua ekosistem** (bug, keamanan): ajukan pull request ke template. Jangan memasukkan nama,
   domain, akun, atau data ekosistem Anda ke template.

Repo ini disalin dari sistem yang sudah berjalan pada 12 Nov 2026, tanpa riwayat git dan tanpa data anggota.

## Yang sudah dibersihkan

- Seed dan skrip impor berisi data orang sungguhan (nama, email, rekening, gaji), skrip perbaikan sekali pakai,
  dan dokumen server lama.
- Nama organisasi asal diganti nama netral **"Ekosistem"**, nama anggota di dokumen diganti `[nama anggota]`,
  domain diganti `domain-anda.com`, IP server diganti `<IP-VPS>`.
- Password awal bawaan di form Tambah Anggota dihapus: admin wajib mengisi password sendiri (minimal 10 karakter).

Yang tetap: semua kode aplikasi, 109 migrasi database, `schema.prisma`, dan dokumentasi (`CLAUDE.md`, `AGENTS.md`,
`openspec.md`, `DESIGN_SYSTEM.md`) yang sudah ditulis ulang sebagai aturan produk dan arsitektur, tanpa riwayat atau
data instalasi asal.

## Langkah pertama

1. **Nama ekosistem:** sekarang "Ekosistem". Ganti di dua tempat:
   - `client/src/config/ecosystem.js`: `ECOSYSTEM_NAME`, `ECOSYSTEM_NAME_FULL`, `APP_URL`, `TELEGRAM_BOT`;
   - env server `ECOSYSTEM_NAME` dan `ECOSYSTEM_NAME_FULL`.
   Teks yang memakai nama ini: judul aplikasi, laporan, PDF, CSV, pesan bot.
2. **Env server:** salin `server/.env.example` ke `server/.env`, lalu isi:
   - `DATABASE_URL`: database PostgreSQL baru (kosong), dengan user database sendiri (bukan superuser).
   - `JWT_SECRET` dan `REFRESH_TOKEN_SECRET`: **dua nilai acak berbeda**, minimal 32 karakter
     (misalnya `openssl rand -hex 32`).
   - `CLIENT_URL` dan `DASHBOARD_URL`: alamat aplikasi Anda.
   - `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_BOT_USERNAME`: bot baru dari @BotFather (kosongkan kalau tidak memakai bot).
   - `GEMINI_API_KEY`: opsional.
   - `VOKASI_RAHASIA`: hanya kalau memakai jembatan ke aplikasi Jalur Tumbuh; selain itu kosongkan.
   - Opsional: `HOST` (bawaan `127.0.0.1`, biarkan), `AKSES_DASHBOARD_MIN_ROLE`, `WEB_KORPORASI_SLUG`, `OTOMASI_AKTIF`.
3. **Database:** `cd server && npm install && npx prisma migrate deploy && npx prisma generate`.
   Diuji 12 Nov 2026 dari database kosong: 109 migrasi berhasil, hasil sama persis dengan `schema.prisma`.
4. **Admin pertama** (seed bersih, tidak menghapus apa pun, aman diulang):
   `ADMIN_EMAIL=admin@domain-anda.com ADMIN_NAMA="Nama Admin" ADMIN_PASSWORD='minimal-12-karakter' npm run db:seed`
   Login, ganti password, lalu buat circle, studio, dan akun lain dari dalam aplikasi.
5. **Jalankan:** dari folder utama `npm run install:all`, `npm run build`, lalu `npm start` (atau PM2).

## Hubungan dengan Unit Operations Dashboard

- Unit Operations Dashboard memanggil `/api/circle/*` di domainnya sendiri. nginx meneruskannya ke server ini
  (`127.0.0.1:3001`) dan **menimpa** header `X-Unit-Web` dengan slug unit. Server memakai header itu untuk tahu
  web mana yang dibuka, jadi:
  - server **harus** tetap mendengar di `127.0.0.1` saja (jangan buka port 3001 ke internet);
  - blok nginx aplikasi ini wajib `proxy_set_header X-Unit-Web app;`, dan tiap alamat unit
    `proxy_set_header X-Unit-Web <slug>;`. Contoh: `deploy/nginx-circle-contoh.conf` di repo Unit Operations.
- Slug diisi di kolom `slug` tabel `Circle` (atau `RumahUsaha`), sama dengan isi header nginx.

## Catatan keamanan (uji 12 Nov 2026)

- Lolos: token web unit hanya berlaku untuk `/api/circle` dan `/api/auth`; refresh token di cookie `httpOnly`;
  token akses hanya di memori (bukan localStorage); query SQL mentah memakai parameter; batas percobaan login aktif;
  server berhenti kalau `JWT_SECRET`/`REFRESH_TOKEN_SECRET`/`DATABASE_URL` kosong; `npm audit` 0 kerentanan.
- File upload (`/uploads/...`) disajikan **tanpa login**; pengamannya nama file acak 48 karakter. Siapa pun yang
  memegang tautannya bisa membuka filenya.
- Server tidak memeriksa panjang `JWT_SECRET`, jadi pastikan sendiri nilainya panjang dan acak.
- Modul Raport dan menu "Jalur Tumbuh" masih menautkan ke aplikasi pendidikan milik organisasi asal
  (`client/src/pages/Raport/PindahKeTumbuh.jsx`, logo `client/src/assets/raport/logo-karir-anak.png`).
  Sesuaikan atau sembunyikan kalau tidak dipakai.

## Memperbarui dokumen

- Lampiran API & model di `openspec.md` dibangkitkan dari kode: `node server/scripts/lampiran-openspec.mjs`
  (tambahkan `--circle ../unit-operations-dashboard/openspec.md` untuk daftar `/api/circle` di repo pasangannya).
- Saat ekosistem baru mulai dipakai, catat keputusan dan aturan baru di `openspec.md` sebagai aturan (bukan catatan
  harian), dan perbarui `CLAUDE.md` bila ada aturan yang harus diikuti AI.

## Riwayat sinkron dengan sistem asal

Repo ini tanpa riwayat git asal, jadi titik sinkron dicatat di sini. Cara memperbarui berikutnya: ambil selisih sistem asal
sejak titik terakhir, bersihkan nama/domain dengan aturan yang sama, gabungkan tiga arah (dasar = sistem asal pada titik terakhir,
milik kita = repo ini, tujuan = sistem asal terbaru), lalu uji dari database kosong (`prisma migrate deploy` + `migrate diff` harus kosong).

| Tanggal | Titik sistem asal | Isi |
|---|---|---|
| 12 Nov 2026 | `e2e8663` | Salinan awal (109 migrasi) |
| 16 Nov 2026 | `d31139a` | +13 migrasi (122 total): kas per rekening, bayar freelance, invoice per order, kolom khusus order, prospek seperti order, freelancer per unit, talent berhenti, dll.; halaman Web Circle; kabar order & laporan harian ke grup Telegram (env `TELEGRAM_GRUP_ORDER`, `TELEGRAM_TOPIK_ORDER`, `TELEGRAM_BOT_ORDER_TOKEN`, kosong = mati). Skrip perapian data sekali pakai milik asal tidak dibawa. |
| 16 Nov 2026 (sore) | `7d20825` | +2 migrasi (total 124): jam kerja per unit + pulang otomatis, ajuan bayar freelance; kolom khusus order bisa diubah + pilihan banyak; ringkasan Produksi per bulan; akun jualan & penugasan akun hanya Koordinator; catatan diteruskan ke talent; hapus prospek. |
