# AGENTS.md — Aturan main AI

> **Repo ini TEMPLATE.** Kalau `git remote get-url origin` masih `mellakamal/management-dashboard`, jangan mengubah
> apa pun: minta pengguna membuat repo sendiri dulu (`KLON.md`). Perbaikan template hanya lewat branch + pull request
> yang diminta pemilik template.

Baca di awal setiap sesi, bersama `CLAUDE.md` dan `openspec.md`.

## Identitas proyek

- **Nama:** Management Dashboard (pasangannya: Unit Operations Dashboard, repo terpisah)
- **Stack:** React 19 + Vite 5 · Node.js 20 + Express 5 · PostgreSQL + Prisma 5
- **Komunikasi:** Bahasa Indonesia, singkat, dengan rekomendasi. Tidak ada test framework: verifikasi lewat dev server,
  `npm run build`, dan skrip uji API di repo Unit Operations (`tes/`).

## Konteks yang harus dipahami

- **Multi-peran:** satu orang bisa memegang beberapa peran di unit berbeda (mis. Kepala Circle di satu circle sekaligus
  Koordinator di dua studio). Selalu baca `UserRole`, jangan menganggap satu orang satu peran.
- **Dua sumbu berbeda:** `ADVISOR` (Super Admin) = pengelola aplikasi; `KEPALA_EKOSISTEM` = puncak struktur bisnis.
  Di kode keduanya `SUPER_ADMIN`.
- **Tier anggota:** Pengurus Inti (ungu) · Staf (jingga) · Magang (hijau). Satu sumber label & warna badge:
  `TIER_BADGE` dan pemetaan peran → tier di `client/src/utils/roles.js`.
- **Warna circle** berasal dari data (`Circle.colorHex`), bukan dari kode.

## Konvensi kode

```
Komponen React   PascalCase      WeeklyReportForm.jsx
Fungsi/variabel  camelCase       fetchWeeklyReport()
CSS Module       camelCase       weeklyReport.module.css
Route Express    kebab-case      /api/weekly-reports
Konstanta        SCREAMING_SNAKE ROLE_LEVEL
```

Route selalu `authenticate` lalu pengecekan peran, controller memakai try/catch dan format respons standar:

```js
router.get('/', authenticate, checkMinRole('KADER'), getAll)
router.post('/', authenticate, populateRoles, create)   // wewenang per unit dicek di controller (kelolaStudio)

export const create = async (req, res) => {
  try {
    if (!kelolaStudio(req.userRoles, req.body.studioId)) return res.status(403).json({ success: false, message: 'Tidak berwenang untuk unit ini' })
    const data = await prisma.contoh.create({ data: { /* field yang diizinkan saja */ } })
    return res.json({ success: true, data })
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' })
  }
}
```

- Respons: `{ success: true, data }` · `{ success: false, message }` · paginasi `{ ..., pagination: { page, limit, total } }`.
- Uang: `formatRp`, `formatRpShort`, `formatUSD`; tanggal: `getBulanLabel`, `formatTanggal`, `formatTanggalPendek`
  (semua dari `utils/format.js`); periode minggu laporan dari `utils/week.js`.
- Warna hanya token CSS (`client/src/styles/index.css`); lihat `DESIGN_SYSTEM.md`.
- Daftar di HP: `ItemRingkas` di dalam `.responsive-cards.list-ringkas`, bukan kartu bertumpuk.

## Wewenang & data (wajib)

- Aksi pengelola & uang unit: `kelolaStudio(req.userRoles, studioId)`; atasan lintas unit: `atasanStudio` /
  `atasanLingkup` (`utils/roles.js`). Jangan pola "punya peran tinggi di mana saja + punya peran apa pun di unit itu".
- Endpoint yang memuat uang memakai `utils/lingkup.js` (`lingkupKeuangan`, `samarkan`).
- Penjumlahan ekosistem memakai `utils/kolaborasi.js`.
- Endpoint web unit baru (di `routes/circle.js`): `authenticate, populateRoles`, lalu `studioBolehDilihat` + mode dari
  `peranStudio()`; lingkup per alamat lewat `whereLingkup(web.lingkup)`; daftar marketer disaring `masihDiUnit(studioId)`;
  data SDM orang lain memakai `peranStudio().pengelola`; pemilik (`lihatSaja`) hanya boleh membaca.
- Freelance tidak pernah diberi akun; tahap kerja order freelance digerakkan marketer pemegang order lewat `wakilFreelance()`.
- Rekening hanya untuk pengelola unit (`GET /api/circle/tagihan/penerbit`); data bank freelancer tidak dikirim utuh.
- Teks yang dikirim ke web unit memakai diksi akrab yang sama dengan tampilan web unit (daftar di `CLAUDE.md` repo
  Unit Operations); kunci/endpoint tidak diganti.

## Bot Telegram

- Perintah dan pengingat mengikuti aturan peran yang sama dengan web (`ROLE_KIRIM_LAPORAN`, `ROLE_DASHBOARD_PENUH`).
- Cron hanya di `mulaiJadwal()` (dipanggil `bot-standalone.js`). Pengingat web unit hanya jika `OTOMASI_AKTIF=1`.

## Git

- Kerja di branch `feat/...` atau `fix/...`, commit kecil dengan awalan `feat:` / `fix:` / `refactor:` / `style:` /
  `docs:`. Jangan push atau deploy tanpa persetujuan pengguna.
- Di repo template: hanya lewat pull request yang diminta pemilik template.

## Checklist sebelum lapor selesai

- [ ] Berjalan tanpa galat di lokal; `npm run build` lolos
- [ ] Semua route baru ber-auth dan dicek wewenang per unit
- [ ] Angka uang memakai `lingkup.js`; tidak ada data uang untuk Karyawan/Magang
- [ ] Tidak ada hardcode warna, nama ekosistem, domain, atau data orang
- [ ] Ada migrasi bila skema berubah, dan `prisma generate` sudah dijalankan
- [ ] `openspec.md` diperbarui bila perilaku berubah; lampiran dibangkitkan ulang
      (`node server/scripts/lampiran-openspec.mjs`) bila route atau skema berubah

## Jika ragu

Tanya pengguna: "Saya ragu tentang X, bagaimana seharusnya?". Jangan menebak untuk hal yang menyangkut arsitektur,
database, uang, atau hak akses. Cek klaim penting ke kode, bukan hanya ke dokumen.
