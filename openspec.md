# Management Dashboard — openspec

> **Repo template.** Jangan dikerjakan langsung; buat repo sendiri dulu (lihat `KLON.md`).
> Dokumen ini menjelaskan produk dan aturannya. Kalau berbeda dengan kode, kode yang benar — perbaiki dokumen ini.
> Daftar API dan model di bagian Lampiran dibangkitkan dari kode; perbarui dengan menjalankan ulang pembangkitnya
> bila route atau skema berubah.

## Gambaran

- **Apa:** web internal (bukan publik) untuk mengelola satu ekosistem usaha kreatif. Menggantikan laporan manual
  (spreadsheet, chat, PDF) dengan satu tempat.
- **Prinsip:** dashboard = tempat data akhir terlihat; kerja harian unit dicatat di **Unit Operations Dashboard**
  (repo terpisah, memakai backend & database repo ini). Bot Telegram membantu pengingat dan laporan cepat.
- **Nama ekosistem** diatur di `client/src/config/ecosystem.js` (`ECOSYSTEM_NAME`, `ECOSYSTEM_NAME_FULL`, `APP_URL`,
  `TELEGRAM_BOT`, `FITUR`) dan env server `ECOSYSTEM_NAME`/`ECOSYSTEM_NAME_FULL`.

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19 + Vite 5, CSS Modules + token CSS, tanpa router/UI library |
| Backend | Node.js 20 + Express 5 |
| Database | PostgreSQL 16 + Prisma 5 |
| Auth | JWT akses (15 menit, di memori klien) + refresh token cookie httpOnly (7 hari), bcrypt |
| Bot | Telegraf (long polling), proses terpisah `server/src/bot-standalone.js`, jadwal `node-cron` |
| PDF | `@react-pdf/renderer` (dibuat di browser) + `pdfjs-dist` (pratinjau) |
| AI (opsional) | Google Gemini (`@google/genai`, `controllers/ai.js`); halaman AI ada di `PAGES` tapi tidak ditautkan di menu |
| Keamanan | helmet, express-rate-limit (global + login), CORS hanya `CLIENT_URL` |
| Hosting | VPS + PM2 + nginx; server hanya mendengar di `127.0.0.1` |

## Struktur folder

```
client/src/
  config/ecosystem.js     nama ekosistem & fitur yang bisa disembunyikan
  App.jsx                 PAGES, HUB_ALIAS, ID_TO_SLUG/SLUG_TO_ID, badge (diperbarui tiap 60 detik), Command Palette
  pages/<Halaman>/        satu folder per halaman
  components/layout/      Sidebar (NAV), Topbar
  components/common/      HubTabs, ItemRingkas, LabelJalur, dll.
  components/laporan/     PDF laporan (Progress/Monthly, Weekly), tema PDF di pdf/tema.js
  services/api.js         axios: token di memori, refresh otomatis
  utils/                  format.js, roles.js, tema.js, warna.js, week.js, tipeUnit.js, dll.
server/src/
  app.js                  setup Express, helmet, rate limit, CORS, mount route
  routes/ controllers/    satu berkas per domain (lihat Lampiran API)
  middleware/             auth.js, checkRole.js, upload.js (multer, nama file acak)
  utils/                  roles.js, lingkup.js, kolaborasi.js, kas.js, pengeluaran.js, korporasi.js, web.js, alur.js, ...
  bot.js bot-standalone.js
server/prisma/            schema.prisma, migrations/, seed.js (Super Admin pertama)
server/scripts/           backup-db.sh, backup-uploads.sh, foto-cpm-bulan.js, test-produksi-calc.js
server/uploads/           file upload (tidak di git): skb/, modul/, kanban/
```

## Navigasi

- Berbasis state (`App.jsx`), URL memakai slug Indonesia (mis. `/laporan-omset`, `/keuangan`, `/unit-usaha`,
  `/kepatuhan-laporan`, `/sdm`). Id internal tetap bahasa Inggris (`WeeklyReport`, `MasterData`, ...).
- **Hub bertab:** **Keuangan** (`pages/Finance/Hub.jsx`): Laporan Omset, Pengeluaran, Financial Forecasting, Rekap
  Bulanan, Koperasi, Dana & Pos. **SDM** (`pages/SDM/index.jsx`): Anggota, Performa Kader, Rekrutmen, Payroll, Raport.
  `HUB_ALIAS` mengalihkan id lama ke tab yang sesuai.
- **Sidebar** (`components/layout/Sidebar.jsx`):
  - Khusus: Dana Pengembangan (hanya `PENGELOLA_DANA`)
  - Ringkasan: Mulai dari Sini (Panduan), Dashboard, Kalender, Kepatuhan Laporan (Kader ke atas), Pengumuman
  - Operasional: Keuangan, SDM (tab tertentu hanya pengurus; Payroll hanya Super Admin/Kepala Ekosistem)
  - Unit Usaha: Unit (MasterData), Performa, Unduh Laporan
  - Strategi: Goals & Roadmap, Milestone, Bank Modul, Direktori Sosmed, Aset & Inventaris

## Struktur ekosistem

- **Circle** dan **Rumah Usaha**: naungan unit. Keduanya punya kepala (`kepalId`), warna (`colorHex`), deskripsi,
  alamat, dan slug alamat web unit (`slug`). Rumah Usaha setara Circle, dengan peran `KEPALA_RUMAH_USAHA` dan laporan
  dana mingguan lewat `OrgFundReport`.
- **Unit usaha** (`Studio`) bertipe **Studio**, **Project**, atau **Korporasi** (`StudioTipe`). Studio/Project dimiliki
  satu Circle ATAU satu Rumah Usaha (XOR, divalidasi controller).
- **Korporasi** (usaha berbadan hukum) berada langsung di bawah ekosistem. Unit lain bisa berada di bawahnya lewat
  `Studio.indukId` (circle & rumah usaha null); angkanya dijumlah ke Korporasi. Membuat/memindah ke Korporasi = Super
  Admin. Korporasi tidak lapor mingguan sendiri (lihat CLAUDE.md, aturan 7). Label & warna tipe: `client/src/utils/tipeUnit.js`.
- **Studio kolaborasi** (`hitungDiEkosistem = false`): tetap aktif, tapi tidak ikut total ekosistem (omset, kas,
  jumlah unit/anggota, kesehatan, laporan bulanan).
- **Pemilik unit** (`StudioPemilik`): kepemilikan saham dalam persen; penerima SHU; di web unit hanya bisa melihat.

## Peran & akses

Satu orang boleh punya banyak peran di unit berbeda (`UserRole`). Level dari `server/src/utils/roles.js` (`ROLE_LEVEL`),
angka kecil = wewenang lebih tinggi.

| Level | Peran | Lingkup |
|---|---|---|
| 0 | `ADVISOR` (tampil "Super Admin") | seluruh aplikasi; pengelola aplikasi |
| 1 | `KEPALA_EKOSISTEM` | seluruh ekosistem (puncak struktur bisnis) |
| 3 | `KEPALA_CIRCLE` | circle-nya + unit di dalamnya |
| 4 | `KEPALA_RUMAH_USAHA` | rumah usahanya + unit di dalamnya |
| 4,5 | `PENASIHAT` | posisi senior di unit; tanpa wewenang admin |
| 5 | `ADMIN_FUNGSIONAL` | pos keuangan yang dikelola + koperasi |
| 5 | `PENDAMPING` | unitnya: laporan omset, pengumuman, mentor penilaian |
| 6 | `KOORDINATOR` | unitnya sendiri (CEO unit): laporan, keuangan unit, penilaian, mengatur peran tingkat unit |
| 7 | `KADER` | data diri; batas bawah yang boleh melihat ringkasan omset |
| 8 | `KARYAWAN` | data diri saja, tanpa angka uang |
| 9 | `MAGANG` | data diri saja, tanpa angka uang |
| — | `PENGELOLA_DANA` | HANYA modul Dana Pengembangan (peran tambahan; Super Admin pun butuh peran ini) |
| 11 | `DIGNITY` | penanda riwayat jasa; bukan jenjang, tidak memberi akses web unit |

- `ADVISOR` dan `KEPALA_EKOSISTEM` = `SUPER_ADMIN` di kode (hak edit sama di semua fitur).
- Koordinator dan Pendamping sejajar untuk mengatur posisi di unit yang sama-sama mereka kelola.
- Wewenang per unit, penyamaran angka uang, pemilik lihat saja: lihat CLAUDE.md § Aturan produk.

## Modul

| Modul | Isi utama | Akses |
|---|---|---|
| Dashboard | ringkasan ekosistem, omset & kas per unit (dikelompokkan per tipe), status lapor minggu ini | semua yang login; angka uang sesuai wilayah |
| Laporan Omset (`WeeklyReport`) | omset mingguan per platform, kurs, kas (snapshot otomatis), pengeluaran per item; rekap bulanan | tulis: Koordinator/Pendamping unit itu ke atas |
| Pengeluaran | satu tempat mencatat pengeluaran per unit per bulan, per periode laporan | pengelola unit |
| Financial Forecasting & CPM | biaya rutin (`StudioPengeluaranRutin` + THP + SHU = CPM), foto CPM per bulan (`StudioCpmBulanan`) | pengelola |
| Keuangan › Dana & Pos | pos keuangan (`FinancePost`, tiap pos punya admin), dana di luar kas, laporan dana circle/rumah usaha | pengurus |
| Koperasi | simpanan, lapor, konfirmasi, rekap bulanan | admin koperasi; anggota melihat miliknya |
| Dana Pengembangan | modal & ekuitas dalam USD, laporan untung-rugi, deposit/penarikan | hanya `PENGELOLA_DANA` |
| Anggota & peran | direktori, peran per unit, THP per (orang, unit), akun tanpa login (`noaccount-…@akun.internal`) | pengurus |
| Performa Kader | `PenilaianKader` 9 dimensi, skala 1–5; dipakai Kondisi Tim di Kepatuhan Laporan | mentor (Koordinator/Pendamping/Kepala) |
| Rekrutmen | pipeline calon anggota + pohon referral (jalur masuk: Live In, Langsung, Referral) | pengurus |
| Payroll | rate card lembur, catatan lembur, tunjangan, penggajian DRAFT → FINAL → DIBAYAR; lembur dari web unit menurut aturan unit | Super Admin/Kepala Ekosistem; aksi per unit memakai `kelolaStudio` |
| Kepatuhan Laporan (`Health`) | kepatuhan lapor mingguan + aktivitas dasar per unit | Kader ke atas |
| Unit Usaha (`MasterData`) | circle, rumah usaha, unit, Bio Studio (rekening, pemilik, anggota, SHU, biaya rutin, SKB) | Koordinator ke atas sesuai wilayah |
| Unduh Laporan | Monthly/Progress Report (`laporanProgres.js`) & Weekly Report per unit (`laporanMingguan.js`); logo & foto sampul di `LogoLaporan`/`FotoSampul` | Kader ke atas; dibatasi per unit di controller |
| Pengumuman, Kalender, Goals, Milestone, Bank Modul, Direktori Sosmed, Aset | pendukung organisasi | sesuai menu |
| Profil | data diri, ganti password, tautan Telegram (kode 8 karakter, 10 menit, sekali pakai, disimpan sebagai hash) | pemilik akun |
| Raport | menu tautan ke aplikasi pendidikan eksternal (`pages/Raport/PindahKeTumbuh.jsx`); sesuaikan atau sembunyikan | — |

Modul yang ada di kode tapi tidak ditampilkan: halaman AI, Memori Institusional; backend Kanban dan Direktori Tim
masih terpasang tanpa tampilan.

## Kamus istilah uang

Selama web unit masih mode bayangan, ada dua jalur angka. Di layar aplikasi ini, angka resmi diberi penanda
**Resmi** dan angka web unit **Bayangan** (`components/common/LabelJalur.jsx`).

| Resmi (masuk laporan) | Sumber | Bayangan (web unit) | Sumber |
|---|---|---|---|
| **Pengeluaran** | tabel `Pengeluaran` (Keuangan › Pengeluaran) | **Biaya** | `BiayaStudio` |
| **Kas rekening** | `SUM(StudioRekening.saldo)`; `WeeklyReport.kasSekarang` = snapshot | **Kas akhir buku besar** | kas awal + pemasukan − pengeluaran (`StatusBulan`) |
| **Biaya rutin (CPM)** | `StudioPengeluaranRutin` + THP + SHU | **Biaya rutin (item tetap)** | `ItemTetap` |
| **Omset laporan** | `WeeklyReport` | **Omset order** | `OrderProduksi` |

Nama kolom/endpoint di kode tidak ikut diganti (`kasAkhir`, `kasSekarang`, `pengeluaranRutin`).

## Integrasi

- **Unit Operations Dashboard:** semua rute di `/api/circle/*` (`routes/circle.js`, controller `circle*.js`). Token
  `{ id, aud: 'circle', cs: <slug> }` hanya berlaku di sana dan di `/api/auth`; token aplikasi ini ditolak di sana dan
  sebaliknya. Lingkup unit per alamat WAJIB lewat `whereLingkup()` (`utils/web.js`); unit di bawah Korporasi dilayani
  di alamat yang diatur env `WEB_KORPORASI_SLUG`. Perubahan API di sini harus tetap cocok dengan web unit.
- **Aplikasi pendidikan (opsional):** `/api/vokasi/{verifikasi,cari,status}` (`routes/vokasi.js`) — login aplikasi lain
  memakai akun aplikasi ini. Hanya dari `127.0.0.1` tanpa header `X-Real-IP`/`X-Forwarded-For` + header
  `x-vokasi-rahasia` = `VOKASI_RAHASIA` (≥32 karakter); hanya membaca `User`. Kosongkan `VOKASI_RAHASIA` bila tidak dipakai.

## Aturan penting

**Wajib:** baca dokumen ini sebelum menulis kode · semua query lewat Prisma (query mentah selalu berparameter) · setiap
endpoint ber-`authenticate` + pengecekan peran · `formatRp()`/`formatUSD()` · respons `{ success, data | message }` ·
CSS Modules + token CSS · tampilan HP mulai 375px (daftar di HP pakai `ItemRingkas`) · waktu WIB.

**Dilarang:** Tailwind atau UI library · mengubah struktur database tanpa diskusi · hardcode warna · menyimpan file besar
di server (kecuali upload kecil yang sudah ada: SKB, modul) · kunci API di frontend · melewati middleware auth ·
React Router.

## Lampiran A — API

Perbarui dengan `node server/scripts/lampiran-openspec.mjs`.

<!-- api:mulai -->
_Dibangkitkan dari `server/src/app.js` + `server/src/routes/*.js`: 37 kelompok, 485 rute (+ langsung di app.js: `GET /api/ping`)._

- **`/api/auth`** (auth.js, 4 rute): `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`
- **`/api/vokasi`** (vokasi.js, 3 rute): `POST /verifikasi`, `POST /cari`, `POST /status`
- **`/api/dashboard`** (dashboard.js, 1 rute): `GET /overview`
- **`/api/members`** (members.js, 14 rute): `GET/POST /`, `DELETE/GET /:id`, `PATCH /:id/nonaktifkan`, `DELETE/PATCH /roles/:roleId`, `PATCH /roles/:roleId/thp`, `POST /:id/roles`, `PATCH /:id/livein`, `PATCH /:id/koperasi`, `PATCH /:id/reset-password`, `PATCH /:id/grant-access`, `PATCH /:id/profile`
- **`/api/weekly-reports`** (weeklyReport.js, 7 rute): `GET /bayangan`, `GET/POST /`, `GET /status/week`, `GET /monthly`, `DELETE/PUT /:id`
- **`/api/pengeluaran`** (pengeluaran.js, 5 rute): `GET/POST /`, `DELETE/PUT /:id`, `DELETE /total-lama`
- **`/api/cpm-bulanan`** (cpmBulanan.js, 3 rute): `DELETE/GET/PUT /`
- **`/api/finance`** (finance.js, 6 rute): `GET/POST /posts`, `GET /payments/:bulan/:tahun`, `GET /kas`, `DELETE/PUT /posts/:id`
- **`/api/kanban`** (kanban.js, 11 rute): `GET /studios`, `GET /columns/:studioId`, `POST /columns`, `DELETE/PUT /columns/:id`, `POST /:id/upload-hasil`, `GET /:studioId`, `POST /`, `DELETE/PUT /:id`, `PATCH /:id/status`
- **`/api/announcements`** (announcement.js, 3 rute): `GET/POST /`, `DELETE /:id`
- **`/api/health`** (health.js, 1 rute): `GET /ecosystem`
- **`/api/koperasi`** (koperasi.js, 8 rute): `GET /badge`, `GET /monthly-summary`, `GET /nasabah`, `GET /riwayat/:tipe/:id`, `GET /menunggu`, `POST /lapor`, `POST /simpanan`, `PATCH /konfirmasi/:id`
- **`/api/kader`** (kader.js, 5 rute): `GET/POST /`, `GET /:userId`, `DELETE/PUT /:id`
- **`/api/performance`** (performance.js, 2 rute): `GET /studios`, `GET /monthly`
- **`/api/goals`** (goals.js, 4 rute): `GET/POST /`, `DELETE/PATCH /:id`
- **`/api/assets`** (asset.js, 4 rute): `GET/POST /`, `DELETE/PATCH /:id`
- **`/api/rekrutmen`** (rekrutmen.js, 6 rute): `GET /badge`, `GET/POST /`, `PATCH /:id/status`, `POST /:id/jadikan-anggota`, `DELETE /:id`
- **`/api/profile`** (profile.js, 5 rute): `GET/PUT /`, `POST /password`, `POST /telegram/kode`, `DELETE /telegram`
- **`/api/ai`** (ai.js, 2 rute): `GET /insights`, `POST /chat`
- **`/api/milestones`** (milestone.js, 2 rute): `GET/POST /`
- **`/api/telegram`** (telegram.js, 2 rute): `POST /notify/:userId`, `POST /broadcast`
- **`/api/masterdata`** (masterdata.js, 29 rute): `GET /`, `GET/POST /circles`, `PUT /circles/:id`, `GET/POST /studios`, `DELETE/PUT /studios/:id`, `DELETE/POST /studios/:id/skb`, `GET/POST /studios/:studioId/rekening`, `DELETE/PUT /studios/:studioId/rekening/:id`, `GET /studios/:studioId/roster`, `GET/POST /studios/:studioId/pemilik`, `DELETE/PUT /studios/:studioId/pemilik/:id`, `GET/POST /studios/:studioId/pengeluaran-rutin`, `DELETE/PUT /studios/:studioId/pengeluaran-rutin/:id`, `POST /studios/:studioId/pengeluaran-rutin/seed-default`, `GET /users`, `GET/POST /rumah-usaha`, `DELETE/PUT /rumah-usaha/:id`
- **`/api/modul`** (modul.js, 5 rute): `GET/POST /`, `DELETE/GET/PUT /:id`
- **`/api/sosmed`** (sosmed.js, 4 rute): `GET/POST /`, `DELETE/PUT /:id`
- **`/api/memori`** (memori.js, 5 rute): `GET/POST /`, `DELETE/GET/PUT /:id`
- **`/api/direktori-tim`** (direktoriTim.js, 1 rute): `GET /`
- **`/api/calendar`** (calendar.js, 1 rute): `GET /`
- **`/api/reports`** (reports.js, 11 rute): `GET /progres/lingkup`, `GET /progres`, `GET /mingguan/unit`, `GET /mingguan`, `GET/POST /foto-sampul`, `DELETE/GET /foto-sampul/:fid`, `DELETE/GET/PUT /logo`
- **`/api/jurnal-talent`** (jurnalTalent.js, 1 rute): `GET /:userId`
- **`/api/raport`** (raport.js, 12 rute): `GET /saya`, `GET /siswa`, `GET /mentor-kandidat`, `PATCH /siswa/:userId`, `DELETE /lampiran/:id`, `GET/PUT /:userId`, `POST /:userId/terbit`, `POST /:userId/tarik`, `PUT /:userId/kesan`, `GET/POST /:userId/lampiran`
- **`/api/penilaian-kader`** (penilaianKader.js, 5 rute): `GET /skor-ringkasan`, `GET /:userId`, `POST /`, `DELETE/PATCH /:id`
- **`/api/monthly-data`** (monthlyData.js, 5 rute): `GET /summary`, `GET/POST /ecosystem`, `GET/POST /cpm`
- **`/api/dana-pengembangan`** (danaPengembangan.js, 15 rute): `GET/PUT /pool`, `GET /pengelola`, `GET /timeline`, `GET/POST /units`, `DELETE/PUT /units/:id`, `GET/POST /units/:unitId/laporan`, `DELETE/PUT /laporan/:id`, `GET/POST /units/:unitId/transaksi`, `DELETE /transaksi/:id`
- **`/api/org-fund-reports`** (orgFundReport.js, 3 rute): `GET /status`, `POST /`, `PUT /:id`
- **`/api/circle`** (circle.js, 269 rute): `GET /identitas`, `GET /tugas-saya`, `GET /tugas-admin`, `GET /tim`, `POST /tim/terima-saran`, `PUT /tim/:userId`, `GET/PUT /templat`, `PUT /templat/qc-semua`, `POST /orders/:id/aksi`, `PATCH /orders/:id/opsional`, `POST /tugas/:id/aksi`, `GET /saya`, `GET /papan`, `GET /papan/ringkasan`, `GET /gaji`, `PUT /gaji/rincian`, `POST /gaji/siapkan`, `POST /gaji/final-semua`, `DELETE/PATCH /gaji/baris/:barisId`, `GET /gaji/:id/slip`, `PATCH /gaji/:id`, `POST /gaji/:id/baris`, `PATCH /gaji/:id/tanggal`, `POST /gaji/:id/final`, `POST /gaji/:id/buka`, `POST /gaji/:id/dibayar`, `GET/POST /update-klien`, `POST /update-klien/feedback`, `GET /update-klien/:orderId/riwayat`, `DELETE/PATCH /update-klien/catatan/:id`, `GET/POST /klien`, `DELETE/PATCH /klien/:id`, `POST /klien/:id/gabung`, `GET/POST /freelancer`, `DELETE/PATCH /freelancer/:id`, `POST /orders`, `PATCH /orders/:id/tahap`, `GET /mulai`, `POST /mulai/alur`, `DELETE/GET /telegram`, `POST /telegram/kode`, `GET/POST /akun-jualan`, `DELETE/PATCH /akun-jualan/:id`, `GET /analitik/nadi`, `GET /analitik/kinerja`, `GET /analitik/kinerja-saya`, `GET /analitik/revisi`, `GET /analitik/tren`, `GET/POST /kalender/libur`, `DELETE /kalender/libur/:id`, `PATCH /orders/:id`, `GET /orders/:id/detail`, `POST /orders/:id/batal`, `POST /orders/:id/cancel-klien`, `POST /orders/:id/pulihkan`, `GET /orders-batal`, `GET /orders-selesai`, `PUT /orders/:id/item`, `POST /orders/:id/samakan-nilai`, `PATCH /orders/:id/isian-khusus`, `POST /orders/:id/termin`, `DELETE/PATCH /orders/:id/termin/:terminId`, `POST /orders/:id/catatan`, `DELETE /orders/:id/catatan/:catatanId`, `GET /piutang`, `GET /antrean`, `PUT /antrean/urutan`, `GET /antrean-saya`, `POST /penugasan/:id/tunda`, `POST /keahlian/dari-riwayat`, `PATCH /penugasan/:id`, `POST /orders/:id/tim`, `DELETE/PATCH /orders/:id/tim/:assignmentId`, `POST /orders/:id/tim/:assignmentId/berhenti`, `POST /orders/:id/tim/:assignmentId/aktifkan`, `POST /orders/:id/tugaskan-otomatis`, `GET /orders/:id/saran`, `PATCH /orders/:id/profil`, `GET/PUT /keahlian`, `DELETE /keahlian/:id`, `PUT /pengaturan-penugasan`, `GET /diskusi/opsi`, `GET /diskusi/belum-dibaca`, `GET/POST /diskusi`, `GET/PATCH /diskusi/:id`, `POST /diskusi/:id/pesan`, `DELETE /diskusi/:id/pesan/:pesanId`, `POST /diskusi/:id/putuskan`, `POST /diskusi/:id/batalkan`, `POST /diskusi/:id/peserta`, `DELETE /diskusi/:id/peserta/:userId`, `GET /otomasi/peringatan`, `POST /otomasi/eskalasi`, `GET /kaizen/eksekutif`, `GET /kaizen/omzet`, `GET /kaizen/siklus`, `GET /kaizen/keterlambatan`, `GET /kaizen/ketepatan`, `GET/PUT /kaizen/target`, `GET/POST /kaizen/tindakan`, `PATCH /kaizen/tindakan/:id`, `GET /kehadiran/hari-ini`, `POST /kehadiran/catat`, `POST /kehadiran/lembur`, `GET /kehadiran/order-lembur`, `GET /kehadiran/riwayat`, `GET/POST /kehadiran/cuti`, `POST /kehadiran/cuti/:id/batal`, `GET /kehadiran/kotak-cuti`, `POST /kehadiran/cuti/:id/setujui`, `POST /kehadiran/cuti/:id/tolak`, `GET/PUT /lembur/aturan`, `GET/PUT /kehadiran/jam-kerja`, `GET/PUT /lembur/level`, `GET/PUT /lembur/tahap`, `GET /lembur/usulan`, `POST /lembur/:id/setujui`, `POST /lembur/:id/tolak`, `GET /kehadiran/roster`, `GET /kehadiran/rekap`, `GET /kehadiran/lupa-pulang`, `POST /kehadiran/koreksi-pulang`, `GET /kehadiran/terlambat`, `GET /checkin/hari-ini`, `POST /checkin`, `POST /checkin/lewati`, `GET /checkin/tim`, `GET /kalender`, `POST /kalender/acara`, `DELETE/PATCH /kalender/acara/:id`, `POST /kalender/acara/:id/hentikan`, `GET /refleksi/saya`, `POST /refleksi`, `PATCH /refleksi/:id`, `GET /refleksi/tim`, `GET /refleksi/orang/:userId`, `POST /refleksi/:id/komentar`, `DELETE /refleksi/komentar/:id`, `GET /ltk/opsi`, `GET/POST /kategori-order`, `DELETE/PATCH /kategori-order/:id`, `GET/POST /ltk`, `DELETE/GET/PATCH /ltk/:id`, `POST /ltk/:id/ajukan`, `POST /ltk/:id/negosiasi`, `POST /ltk/:id/deal`, `POST /ltk/:id/tolak`, `POST /ltk/:id/batal`, `POST /ltk/:id/catatan`, `POST /ltk/:id/konversi`, `GET /ltk/:id/order-lempar`, `POST /ltk/:id/hubungkan`, `GET /tagihan/klien`, `GET/PUT /tagihan/penerbit`, `GET /tagihan/layak`, `GET/POST /tagihan`, `GET/PATCH /tagihan/:id`, `POST /tagihan/:id/tagih`, `POST /tagihan/:id/draft`, `POST /tagihan/:id/batal`, `POST /tagihan/:id/aktifkan`, `POST /tagihan/:id/lunas`, `GET/POST /orders/:id/invoice`, `GET /analitik/timeline`, `GET /analitik/jenis-order`, `GET /marketing/laporan-harian`, `GET/POST /setoran`, `DELETE /setoran/:id`, `GET /beranda`, `POST /penugasan/:id/mendesak`, `GET /tugas-selesai`, `POST /penugasan/:id/batal-selesai`, `GET /progres-harian`, `GET /kontribusi`, `GET /kontribusi/detail`, `GET /beban-kerja`, `GET /pembayaran`, `GET/POST /kolom-khusus`, `DELETE/PATCH /kolom-khusus/:id`, `GET /bayar-freelance`, `POST /bayar-freelance/:id/bayar`, `POST /bayar-freelance/:id/batal`, `POST /bayar-freelance/:id/ajukan`, `POST /bayar-freelance/:id/batal-ajuan`, `PUT /orders/:id/tautan`, `POST /orders/:id/selesaikan-semua`, `GET /pipeline`, `GET /riwayat-login`, `GET /pengingat/pratinjau`, `GET/POST /admin-market`, `DELETE /admin-market/:id`, `PUT /admin-market/:id/akun`, `GET /penjualan`, `GET /kurs`, `GET/PUT /penjualan/target`, `GET /peta-alur`, `GET /rekap-kerja`, `GET /slip-saya`, `GET /manajemen`, `GET /stream`, `GET /impersonasi/kandidat`, `GET /impersonasi/log`, `POST /impersonasi`, `GET/PUT /profil-sdm`, `GET /manpower`, `GET/POST /kategori`, `GET /ringkasan`, `GET /rincian`, `GET /laba-rugi`, `GET /rentang`, `GET /rencana`, `GET /ringkasan-circle`, `POST /entri`, `DELETE /entri/:id`, `GET/POST /item-tetap`, `PATCH /item-tetap/:id`, `PUT /item-tetap/:id/bulan`, `PUT /kas-awal`, `GET /rekening`, `PUT /saldo-awal-rekening`, `POST /pindah`, `DELETE /pindah/:id`, `POST /bayar-rutin`, `POST /bayar-rutin/batal`, `POST /samakan-bio`, `POST /tutup`, `POST /buka-lagi`
- **`/api/web-circle`** (ringkasanCircle.js, 1 rute): `GET /ringkasan`
- **`/api/payroll`** (payroll.js, 20 rute): `GET/POST /rate-card`, `PATCH /rate-card/:id`, `GET/POST /lembur`, `GET /order-opsi`, `GET /lembur-presensi`, `PUT /tarif-lembur`, `GET/POST /tunjangan-template`, `PATCH /tunjangan-template/:id`, `POST /generate`, `GET /`, `PATCH /:id`, `POST /:id/finalize`, `POST /:id/tandai-dibayar`, `GET /:id/slip`, `POST /:id/tunjangan`, `DELETE/PATCH /tunjangan/:id`
<!-- api:selesai -->

## Lampiran B — Model database

<!-- model:mulai -->
_Dibangkitkan dari `server/prisma/schema.prisma`: 121 model, 24 enum. Sumber kebenaran tetap `schema.prisma`._

- `User`
- `UserRole`
- `Circle`
- `Studio`
- `LogoLaporan` — Logo circle / rumah usaha / unit untuk laporan -- kosong = logo otomatis (inisial + warna).
- `FotoSampul` — Galeri foto sampul laporan per sasaran (maks 12) -- bisa dipakai lagi tanpa unggah ulang.
- `Pengeluaran` — Pengeluaran AKTUAL per item (13 Okt 2026) -- beda dari StudioPengeluaranRutin (template biaya bulanan buat hitung CPM). WeeklyReport.pengeluaran = total item ya
- `StudioPengeluaranRutin`
- `StudioPemilik` — Kepemilikan studio: N:N User<->Studio dengan PERSENTASE saham (bukan nilai Rupiah — sesuai JRUWay, kader/pendamping dapat 10-20% tergantung tier galur & level b
- `StudioMonthlyNote`
- `MonthlyEcosystemData`
- `RumahUsaha` — Unit organisasi sejajar/independen dari Circle (bukan bertingkat di dalamnya) — Studio milik SALAH SATU dari keduanya (circleId ATAU rumahUsahaId), divalidasi d
- `OrgFundReport` — Laporan mingguan dana Circle/Rumah Usaha -- persis pola WeeklyReport studio tapi tanpa breakdown omset per platform, cuma "dana terkini" (mirip KasModal-nya stu
- `StudioRekening`
- `WeeklyReport`
- `FinancePost`
- `KoperasiSimpanan`
- `KanbanColumn`
- `KanbanCard`
- `KaderTimeline`
- `Rekrutmen`
- `ProgramPeserta`
- `Penilaian`
- `Goal`
- `Milestone`
- `Announcement`
- `Asset`
- `JurnalTalent` — ARSIP READ-ONLY sejak 30 Juli 2026 -- 4 field naratifnya digabung ke PenilaianKader (lihat komentar model itu), gak ada entri baru dibuat lagi di sini, cuma dip
- `PenilaianKader` — Penilaian performa kader — DULU terpisah total dari JurnalTalent (naratif mingguan), tapi ternyata dua-duanya sama-sama ditulis mentor (bukan self-report kader)
- `Modul`
- `SosmedLink` — userId/studioId: link ini milik SALAH SATU (orang -- sosmed pribadi, ATAU studio -- akun kerja kayak Fiverr/Etsy/Upwork/VGen), XOR divalidasi di controller. Ase
- `Memori`
- `TelegramGroup`
- `DanaPengembanganPool` — Singleton row (id tetap 'dp-pool-main', di-seed lewat migration) — total dana yang sengaja dikeluarkan dari pembukuan resmi ekosistem untuk dikelola/diinvestasi
- `DanaPengembanganUnit` — Satu "unit" = satu trader manual, bot crypto, akun saham, dst. Modal & saldo dicatat dalam USD (konsisten dgn instrumen trading/crypto), dikonversi ke Rp pakai 
- `DanaPengembanganLaporan` — Laporan mingguan per unit (biasanya Sabtu) — equity terkini "sumber kebenaran" selalu dari laporan terbaru, tidak ada denormalisasi di Unit. equityUsd dalam USD
- `DanaPengembanganTransaksi` — Riwayat dana masuk (top-up modal) / keluar (penarikan) dari unit — dicatat terpisah dari laporan equity mingguan supaya P/L trading tidak tercampur dengan perge
- `AkunProduksi` — Akun platform (Fiverr/Etsy/dst) tempat order masuk -- satu studio bisa punya beberapa akun/ platform, feePersen dipakai controller buat hitung nilaiBersih dari 
- `OrderProduksi`
- `AssignmentProduksi`
- `ProduksiAdminMarket` — Akses kelola order (create/update/delete/assignment) untuk 1 studio TANPA butuh role KOORDINATOR ke atas -- buat orang yang ditunjuk khusus urus pemasaran/track
- `ProduksiSuperOverride` — Override akses Superadmin KHUSUS modul Produksi/Payroll (bukan ekosistem-wide) -- buat orang tertentu yang butuh akses penuh 2 modul ini (mis. dashboard lintas-
- `RateCardLembur`
- `CatatanLembur` — feeSaatItu SENGAJA disalin dari rateCard.fee pas entry dibuat (bukan cuma nyimpan rateCardId terus baca fee live tiap kali) -- kalau koordinator ubah fee rate c
- `Penggajian` — Model skema Fase 3 bagian 1 -- API/controller-nya BELUM dibuat (menyusul bagian 2/2), tapi relasi baliknya (catatanLembur) sudah dipakai CatatanLembur.penggajia
- `RencanaKas` — Fase 4b (Financial Forecasting) -- rencana kas per studio per bulan, TERPISAH dari Penggajian (itu realisasi gaji SUDAH dibayar; ini rencana ke depan, dicek law
- `TunjanganTemplate` — Daftar jenis tunjangan per studio (mis. Abstractlab: Kos/Makan/Komunikasi/Laundry-Transport/ BPJS; Mikamizu: Kos/Makan/Komunikasi/Laundry-Transport/Beras) -- po
- `TunjanganPenggajian` — Baris tunjangan aktual per Penggajian -- nama DISALIN dari template pas dibuat (bukan baca template.nama live), pola sama kayak feeSaatItu di CatatanLembur: kal
- `StudioJruLain` — Daftar referensi studio JRU lain (di luar Ekosistem) -- dukung mode "Studio Lain" di AssignmentProduksi.tipeEksternal (combobox autocomplete, lihat controllers/
- `KlienProduksi` — Fase 1 (Fondasi Klien/Talent, 8 Agustus 2026) -- klien eksternal OrderProduksi (tipeKlien= EKSTERNAL doang, lihat komentar OrderProduksi.klienRef) sebagai entit
- `MarketingLead`
- `TalentEksternal` — Fase 1 (Fondasi Klien/Talent, 8 Agustus 2026) -- freelancer perorangan eksternal (AssignmentProduksi.tipeEksternal=FREELANCER_PERORANGAN doang, BUKAN STUDIO_LAI
- `RaportSiswa` — Raport siswa Vokasi/KBU per 3 bulan (13 Okt 2026), format mengikuti raport Karir Anak yang sudah berjalan: Renstra Belajar (rencana periode ini + evaluasinya), 
- `RaportLampiran` — Foto karya untuk halaman "Lampiran Karya" -- disimpan sebagai data URL (dikecilkan di peramban, pola FotoSampul), BUKAN di /uploads yang publik: karyanya aset m
- `MentorSiswa` — Mentor siswa Vokasi/KBU (13 Okt 2026) -- satu siswa bisa punya beberapa mentor; semuanya boleh menulis raport siswa itu. Ditunjuk oleh pengelola unit di SDM › R
- `TahapProduksi`
- `RiwayatTahapOrder`
- `FungsiAnggota`
- `PenugasanAkunMarketer` — ══════════════════════════════════════════════════════════════════════════ MARKETING (20 Okt 2026) — adaptasi marketing OGS (tugas harian, rencana bulanan, prof
- `AktivitasMarketer`
- `TargetMarketing`
- `ProfilSosialMarketer`
- `LogHarianMarketer`
- `HariLiburKerja` — ══════════════════════════════════════════════════════════════════════════ KALENDER KERJA (20 Okt 2026) — hari libur global untuk menghitung JAM KERJA BERSIH di
- `ItemOrder` — ══════════════════════════════════════════════════════════════════════════ DETAIL ORDER web circle (20 Okt 2026) — adaptasi OGS TransactionItem / TransactionPay
- `TerminBayarOrder`
- `CatatanOrder`
- `KategoriBiaya` — ══════════════════════════════════════════════════════════════════════════ BIAYA, PENDAPATAN & KAS (20 Okt 2026) — adaptasi OGS (Expense, IncomeWithdrawal/Trans
- `BiayaStudio`
- `PenarikanPendapatan`
- `TransferPendapatan`
- `PendapatanTertahan`
- `DompetKas`
- `MutasiKas`
- `SaldoPlatformBulanan`
- `SaldoBankBulanan`
- `KategoriLedger` — ══════════════════════════════════════════════════════════════════════════ BUKU BESAR & TUTUP BULAN (20 Okt 2026) — adaptasi OGS Finance V2/V4 (Category, FixedI
- `ItemTetap`
- `ItemTetapBulan`
- `EntriLedger`
- `PindahRekening` — Pindah dana antar rekening unit (tarik tunai, pindah bank) — tidak mengubah total kas, hanya saldo per rekening (12 Nov 2026). Rekening = StudioRekening (Bio st
- `StatusBulan`
- `PenugasanTahap` — ══════════════════════════════════════════════════════════════════════════ PENUGASAN PER TAHAP, KEAHLIAN & ANTREAN (20 Okt 2026) — adaptasi OGS TransactionItemA
- `KeahlianTahap`
- `KeahlianGenre`
- `PengaturanPenugasan`
- `DiskusiKeputusan` — ══════════════════════════════════════════════════════════════════════════ DISKUSI KEPUTUSAN & OTOMATISASI (20 Okt 2026) — adaptasi OGS DecisionThread/Participa
- `PesertaDiskusi`
- `PesanDiskusi`
- `LogOtomasi`
- `TargetOmsetUnit` — ══════════════════════════════════════════════════════════════════════════ SKOR EKSEKUTIF & KAIZEN (20 Okt 2026) — adaptasi OGS StudioWeeklyTarget/AccountMonthl
- `TargetOmsetAkun`
- `KaizenTindakan`
- `KehadiranEvent` — ══════════════════════════════════════════════════════════════════════════ KEHADIRAN (20 Okt 2026) — adaptasi OGS Attendance (AttendanceEvent/Leave/OvertimeEntr
- `JamKerjaUnit` — JAM KERJA PER UNIT (16 Nov 2026, masukan timLangit): diatur Koordinator unit (CEO unit). Tanpa baris = jadwal bawaan (utils/jamKerja.js JADWAL: Sen–Jum 09–17, S
- `CutiKehadiran`
- `LemburKehadiran`
- `CheckInHarian`
- `AcaraKalender`
- `RefleksiMingguan` — REFLEKSI MINGGUAN web circle (21 Okt 2026) — adaptasi OGS SdmReflection/SdmReflectionComment. Satu refleksi per orang per minggu (Senin WIB).
- `KomentarRefleksi`
- `KasusLtk` — LTK (Lempar-Terima Kerjaan) web circle (21 Okt 2026) — adaptasi OGS LtkCase, SISI STAF SAJA (tanpa portal pihak luar). TERIMA = pihak luar membawa pekerjaan ke 
- `CatatanLtk`
- `TagihanKomunitas` — TAGIHAN KOMUNITAS web circle (21 Okt 2026) — adaptasi OGS CommunityInvoice, sisi staf. Menggabungkan beberapa order satu klien jadi satu tagihan. Lunas → status
- `TagihanKomunitasItem`
- `PengaturanInvoice` — PENERBIT INVOICE per unit (9 Nov 2026, keputusan user): diisi SENDIRI oleh koordinator di web circle — teks yang memang untuk dibagikan ke klien (nama penerbit,
- `ChecklistSetor` — CHECKLIST SETORAN MARKETER web circle (21 Okt 2026) — adaptasi OGS finance_v2_marketer_checklists: tiap tanggal 11 & 24 tiap marketer × unit mendapat satu check
- `LogLogin` — RIWAYAT LOGIN (21 Okt 2026) — adaptasi OGS user_login_logs. Dicatat tiap login berhasil (Ekosistem maupun web circle). Tanpa kata sandi/token.
- `AuditOrder` — AUDIT PERUBAHAN ORDER (21 Okt 2026) — adaptasi OGS TransactionAuditLog: siapa mengubah apa (nilai, deadline, klien, kurs, tautan…). Perpindahan tahap tetap di R
- `ProfilSdm` — PROFIL SDM web circle (21 Okt 2026) — adaptasi OGS SdmProfile (posisi sekarang/berikutnya). Satu baris per orang.
- `LogImpersonasi` — LOG IMPERSONASI (21 Okt 2026) — Super Admin "masuk sebagai" pengguna lain di web circle, untuk bantuan/uji. Selalu tercatat.
- `PengaturanLembur` — Tarif lembur per jam untuk lembur dari PRESENSI web circle (menit setelah jam kerja). Opsional per unit: kosong = lembur presensi hanya ditampilkan sebagai acua
- `StudioCpmBulanan` — Foto CPM sebuah studio pada akhir bulan (4 Nov 2026): bulan yang sudah lewat tidak ikut berubah kalau ada anggota resign/THP diubah sesudahnya. Bulan berjalan t
- `LevelLembur` — Daftar level lembur per unit (mode PER_LEVEL): fee per level pekerjaan (mis. Revisi Minor 30rb, Level 1 100rb). Uang lembur = fee level × (progres akhir − progr
- `TahapLembur` — Tahap pekerjaan unit (mode PER_LEVEL): nama tahap → persen progres yang tercapai di akhir tahap (mis. Blocking 20%, Finishing 100%). Hanya pilihan cepat saat an
- `KategoriOrder` — Pilihan kategori order/LTK per unit (10 Nov 2026, masukan tim): dipilih dari daftar agar tidak typo. Daftar yang ditampilkan = ini + kategori yang sudah dipakai
- `SetoranMarketer` — SETORAN MARKETER bebas waktu (10 Nov 2026, keputusan user): marketer mencatat SETIAP KALI menyetor pemasukan akun jualan ke kas studio — kapan saja, tanpa perio
- `UpdateKlien` — UPDATE KLIEN (10 Nov 2026, permintaan tim/Sekai Land): jejak kapan admin/marketer terakhir mengabari klien — supaya tak ada klien yang terlewat tanpa kabar ("gh
- `RincianGajiTetap` — RINCIAN GAJI TETAP (10 Nov 2026, web circle): THP di Bio studio = TOTAL; koordinator memecahnya jadi komponen (mis. Uang makan, Transport, BPJS). Gaji pokok = T
- `BayarRutin` — STATUS BAYAR BIAYA RUTIN per bulan (12 Nov 2026, masukan tim): baris rutin di buku besar (dari Bio: gaji/Dignity/SHU/langganan/iuran — sumber BIO; atau item tet
- `KolomKhususOrder` — KOLOM KHUSUS ORDER per studio (12 Nov 2026, masukan tim): kebutuhan khusus tiap project yang dirancang studio sendiri, mis. "Boleh pakai AI?" (YA_TIDAK), "Gaya"

Enum: `StatusKeanggotaan`, `StatusRaport`, `RoleType`, `PengeluaranRutinKategori`, `StudioTipe`, `FinancePostTipe`, `PaymentStatus`, `KanbanStatus`, `JalurMasuk`, `RekrutmenStatus`, `ProgramTipe`, `AnnouncementTarget`, `AssetTipe`, `TelegramGrupTipe`, `DanaPengembanganTipe`, `DanaPengembanganTransaksiTipe`, `TipeKlienProduksi`, `StatusOrderProduksi`, `StatusBayarProduksi`, `TipeEksternalProduksi`, `StatusPenggajian`, `StatusLeadMarketing`, `JenisTahap`, `FungsiKerja`
<!-- model:selesai -->
