-- AlterEnum: add MENUNGGU (PostgreSQL 16 supports this in a transaction)
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'MENUNGGU';

-- AlterTable: add self-report columns
ALTER TABLE "KoperasiSimpanan"
  ADD COLUMN IF NOT EXISTS "buktiBayar"        TEXT,
  ADD COLUMN IF NOT EXISTS "catatanAdmin"       TEXT,
  ADD COLUMN IF NOT EXISTS "dilaporkanOleh"     TEXT,
  ADD COLUMN IF NOT EXISTS "dikonfirmasiOleh"   TEXT;
