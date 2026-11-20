-- Koreksi atas migration sebelumnya (20260719000000): SHU ternyata SATU angka tetap per studio
-- ("fix ditentukan", bukan riwayat/dihitung dari kas), bukan log distribusi berkala. Tabel
-- StudioShuDistribusi/StudioShuItem baru dideploy dan belum sempat dipakai (kosong) — aman
-- didrop tanpa migrasi data.

-- 1. Drop tabel riwayat SHU yang salah model (child dulu baru parent, ikuti FK)
DROP TABLE IF EXISTS "StudioShuItem";
DROP TABLE IF EXISTS "StudioShuDistribusi";

-- 2. Tambah kolom SHU tetap di Studio. Jumlah tiap pemilik dihitung on-the-fly
--    (totalShu * persenSaham/100) di aplikasi -- TIDAK disimpan per-pemilik.
ALTER TABLE "Studio" ADD COLUMN "statusShu" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Studio" ADD COLUMN "totalShu" DOUBLE PRECISION NOT NULL DEFAULT 0;
