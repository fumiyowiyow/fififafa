-- AlterTable: tambah field profil anggota (v3.4 — 4 Juni 2026)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "jenisKelamin"     TEXT,
  ADD COLUMN IF NOT EXISTS "posisi"           TEXT,
  ADD COLUMN IF NOT EXISTS "alamat"           TEXT,
  ADD COLUMN IF NOT EXISTS "noRekening"       TEXT,
  ADD COLUMN IF NOT EXISTS "atasNamaRekening" TEXT,
  ADD COLUMN IF NOT EXISTS "takeHomePay"      DOUBLE PRECISION;
