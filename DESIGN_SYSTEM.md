# Management Dashboard — Design System

> Sumber kebenaran: token di `client/src/styles/index.css`. Kalau dokumen ini berbeda dengan berkas itu, berkas itu
> yang benar.

## Ringkasan visual

- **Tema:** bersih, aksen **toska** `#0fc1bd`, huruf **Inter** (`system-ui` cadangan).
- **Dua mode:** gelap (`:root`, bawaan) dan terang (`:root[data-theme="light"]`). Pilihan disimpan di localStorage
  `md-tema` (`utils/tema.js`: `useTema`, `aturTema`) dan dipasang oleh skrip awal di `client/index.html`; kosong =
  ikut setelan sistem. PDF punya tema terang/gelap sendiri di `components/laporan/pdf/tema.js`.
- **Layout:** sidebar tetap di kiri (`--sidebar-w` 256px) + topbar (`--header-h` 64px) + isi halaman yang bisa digulir.
  Di HP sidebar menjadi menu geser.

## Token

| Kelompok | Token |
|---|---|
| Latar | `--bg-primary`, `--bg-surface`, `--bg-card`, `--bg-card-hover`, `--bg-input` |
| Garis | `--border`, `--border-hover` |
| Teks | `--text`, `--text-secondary`, `--text-muted` |
| Aksen | `--accent`, `--accent-hover`, `--accent-light`, `--accent-glow`, `--accent-subtle`, `--on-accent` (teks di atas aksen) |
| Semantik | `--green`, `--amber`, `--red`, `--cyan`, `--pink`, masing-masing dengan `*-subtle` |
| Interaksi | `--hover-overlay`, `--hover-strong`, `--track` (batang progres), `--backdrop` (latar modal) |
| Bentuk | `--radius` 12px, `--radius-sm` 8px, `--radius-xs` 6px, `--shadow`, `--shadow-sm` |

- Jangan menulis warna langsung (hex/rgba) di komponen. Butuh warna transparan dari warna data (mis. warna circle):
  `alfa(warna, persen)` dari `utils/warna.js` (memakai `color-mix`).
- Warna circle/rumah usaha berasal dari data (`colorHex`), bukan token tetap.
- Badge tier: `TIER_BADGE` di `utils/roles.js` (kelas `purple` / `warning` / `success`). Label & warna tipe unit
  (Studio/Project/Korporasi): `utils/tipeUnit.js`.

## Komponen

- **Card:** `--bg-card`, garis `--border`, radius `--radius`. Header kartu: judul tebal di kiri, aksi kecil di kanan.
- **Stat card:** grid, angka utama besar; angka uang lewat `formatRp()` / `formatUSD()` (`null` tampil "—").
- **Tombol:** utama (latar `--accent`, teks `--on-accent`) dan ghost (transparan bergaris).
- **Badge:** pil (`success`, `warning`, `danger`, `info`, `purple`), warna dari token semantik.
- **Isian:** latar `--bg-input`, fokus = garis aksen + bayangan `--accent-subtle`.
- **Modal & drawer:** latar `--backdrop`; drawer masuk dari kanan.
- **Tabel:** dibungkus `.table-wrap` (geser ke samping); di HP diganti list ringkas (di bawah).
- **List ringkas (HP):** `components/common/ItemRingkas.jsx` di dalam `<div className="responsive-cards list-ringkas">`.
  Satu baris per item (judul + keterangan di kiri, angka utama di kanan), detail & aksi terbuka saat diketuk. Props:
  `judul`, `sub`, `nilai`, `warna`, `redup`, `onPilih`, `selaluBuka`, `buka`/`onToggle`. Jangan menumpuk `.data-card`.
- **Hub bertab:** `components/common/HubTabs.jsx` (Keuangan, SDM).
- **Penanda jalur uang:** `<LabelJalur jenis="resmi" />` (hijau, masuk laporan) / `jenis="bayangan"` (kuning, dari web
  unit). Istilah uang mengikuti `openspec.md` § Kamus istilah uang.

## Pola

1. Angka uang selalu lewat fungsi format, tidak pernah diformat langsung.
2. Keadaan kosong: teks di tengah, warna `--text-muted`.
3. Memuat: `.spinner` atau kerangka redup.
4. Galat: latar `--red-subtle` + garis `--red`.
5. Lebar minimum yang harus nyaman: 375px.

