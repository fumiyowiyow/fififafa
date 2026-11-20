-- CreateTable
CREATE TABLE "KlienProduksi" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kontak" TEXT,
    "catatan" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KlienProduksi_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "klienId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "KlienProduksi_studioId_nama_key" ON "KlienProduksi"("studioId", "nama");

-- CreateIndex
CREATE INDEX "OrderProduksi_klienId_idx" ON "OrderProduksi"("klienId");

-- AddForeignKey
ALTER TABLE "KlienProduksi" ADD CONSTRAINT "KlienProduksi_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProduksi" ADD CONSTRAINT "OrderProduksi_klienId_fkey" FOREIGN KEY ("klienId") REFERENCES "KlienProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
