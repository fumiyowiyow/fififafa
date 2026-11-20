-- AlterTable
ALTER TABLE "BiayaStudio" ADD COLUMN     "rekeningId" TEXT;

-- AlterTable
ALTER TABLE "EntriLedger" ADD COLUMN     "rekeningId" TEXT;

-- AlterTable
ALTER TABLE "ItemTetap" ADD COLUMN     "rekeningId" TEXT;

-- AlterTable
ALTER TABLE "PenarikanPendapatan" ADD COLUMN     "rekeningId" TEXT;

-- AlterTable
ALTER TABLE "StatusBulan" ADD COLUMN     "saldoAwalRekening" JSONB,
ADD COLUMN     "saldoRekening" JSONB;

-- CreateTable
CREATE TABLE "PindahRekening" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "bulan" TEXT NOT NULL,
    "dariId" TEXT NOT NULL,
    "keId" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "catatan" TEXT,
    "dibuatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PindahRekening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PindahRekening_studioId_bulan_idx" ON "PindahRekening"("studioId", "bulan");


