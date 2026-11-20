-- AlterTable
ALTER TABLE "AssignmentProduksi" ADD COLUMN     "dpAmount" DOUBLE PRECISION,
ADD COLUMN     "statusBayar" "StatusBayarProduksi" NOT NULL DEFAULT 'BELUM_LUNAS',
ADD COLUMN     "tanggalDibayar" TIMESTAMP(3);
