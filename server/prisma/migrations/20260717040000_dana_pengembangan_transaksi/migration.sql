-- CreateEnum
CREATE TYPE "DanaPengembanganTransaksiTipe" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- RenameTable: DanaPengembanganWithdraw -> DanaPengembanganTransaksi
-- (aman dijalankan berulang -- kalau tabel sudah bernama DanaPengembanganTransaksi karena
--  migration sebelumnya belum sempat di-deploy sebelum perubahan ini, blok DO ini di-skip)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DanaPengembanganWithdraw') THEN
    ALTER TABLE "DanaPengembanganWithdraw" RENAME TO "DanaPengembanganTransaksi";
    ALTER TABLE "DanaPengembanganTransaksi" RENAME CONSTRAINT "DanaPengembanganWithdraw_unitId_fkey" TO "DanaPengembanganTransaksi_unitId_fkey";
  END IF;
END $$;

-- CreateTable (fallback kalau migration withdraw sebelumnya belum pernah jalan sama sekali)
CREATE TABLE IF NOT EXISTS "DanaPengembanganTransaksi" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jumlahUsd" DOUBLE PRECISION NOT NULL,
    "keterangan" TEXT,
    "dicatatOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DanaPengembanganTransaksi_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DanaPengembanganTransaksi_unitId_fkey'
  ) THEN
    ALTER TABLE "DanaPengembanganTransaksi" ADD CONSTRAINT "DanaPengembanganTransaksi_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "DanaPengembanganUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable: tambah kolom tipe & kurs (default sementara untuk baris lama, lalu dilepas)
ALTER TABLE "DanaPengembanganTransaksi" ADD COLUMN IF NOT EXISTS "tipe" "DanaPengembanganTransaksiTipe" NOT NULL DEFAULT 'WITHDRAW';
ALTER TABLE "DanaPengembanganTransaksi" ADD COLUMN IF NOT EXISTS "kurs" DOUBLE PRECISION NOT NULL DEFAULT 15800;

-- AlterTable: Pool dapat angka USD utama (diisi langsung, bukan diturunkan dari kurs)
ALTER TABLE "DanaPengembanganPool" ADD COLUMN IF NOT EXISTS "totalPoolUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
