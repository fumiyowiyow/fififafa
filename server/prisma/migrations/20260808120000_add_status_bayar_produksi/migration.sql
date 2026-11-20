-- CreateEnum
CREATE TYPE "StatusBayarProduksi" AS ENUM ('BELUM_LUNAS', 'DP', 'LUNAS');

-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "dpAmount" DOUBLE PRECISION,
ADD COLUMN     "statusBayar" "StatusBayarProduksi" NOT NULL DEFAULT 'BELUM_LUNAS',
ADD COLUMN     "tanggalLunas" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OrderProduksi_statusBayar_idx" ON "OrderProduksi"("statusBayar");
