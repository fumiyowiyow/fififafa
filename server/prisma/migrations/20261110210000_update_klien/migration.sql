-- CreateTable
CREATE TABLE "UpdateKlien" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "catatan" TEXT,
    "otomatis" BOOLEAN NOT NULL DEFAULT false,
    "dicatatOlehId" TEXT,
    "dicatatOleh" TEXT,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpdateKlien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpdateKlien_studioId_waktu_idx" ON "UpdateKlien"("studioId", "waktu");

-- CreateIndex
CREATE INDEX "UpdateKlien_orderId_waktu_idx" ON "UpdateKlien"("orderId", "waktu");


-- AddForeignKey
ALTER TABLE "UpdateKlien" ADD CONSTRAINT "UpdateKlien_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
