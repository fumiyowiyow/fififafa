-- CreateEnum
CREATE TYPE "StatusLeadMarketing" AS ENUM ('DISCUSSING', 'FOLLOW_UP', 'NEGO', 'CONVERTED', 'LOST');

-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "marketerId" TEXT;

-- CreateTable
CREATE TABLE "MarketingLead" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "klienId" TEXT,
    "klien" TEXT NOT NULL,
    "sumber" TEXT,
    "kontak" TEXT,
    "estimasiNilai" DOUBLE PRECISION,
    "status" "StatusLeadMarketing" NOT NULL DEFAULT 'DISCUSSING',
    "catatan" TEXT,
    "tanggalMasuk" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggalFollowUpTerakhir" TIMESTAMP(3),
    "marketerId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLead_orderId_key" ON "MarketingLead"("orderId");

-- CreateIndex
CREATE INDEX "MarketingLead_studioId_status_idx" ON "MarketingLead"("studioId", "status");

-- CreateIndex
CREATE INDEX "MarketingLead_klienId_idx" ON "MarketingLead"("klienId");

-- CreateIndex
CREATE INDEX "OrderProduksi_marketerId_idx" ON "OrderProduksi"("marketerId");

-- AddForeignKey
ALTER TABLE "OrderProduksi" ADD CONSTRAINT "OrderProduksi_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_klienId_fkey" FOREIGN KEY ("klienId") REFERENCES "KlienProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
