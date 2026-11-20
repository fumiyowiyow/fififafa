-- AlterTable: tambah kurs global (USD->IDR) di Pool
ALTER TABLE "DanaPengembanganPool" ADD COLUMN "kurs" DOUBLE PRECISION NOT NULL DEFAULT 15800;

-- AlterTable: modal & equity unit dicatat dalam USD (rename, data existing ikut terbawa)
ALTER TABLE "DanaPengembanganUnit" RENAME COLUMN "modalAwal" TO "modalAwalUsd";
ALTER TABLE "DanaPengembanganLaporan" RENAME COLUMN "saldoAkhir" TO "equityUsd";
