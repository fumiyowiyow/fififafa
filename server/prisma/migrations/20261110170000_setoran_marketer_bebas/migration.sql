-- CreateTable
CREATE TABLE "SetoranMarketer" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jumlah" DOUBLE PRECISION,
    "transferId" TEXT,
    "catatan" TEXT,
    "dicatatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetoranMarketer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetoranMarketer_studioId_tanggal_idx" ON "SetoranMarketer"("studioId", "tanggal");

-- CreateIndex
CREATE INDEX "SetoranMarketer_marketerId_tanggal_idx" ON "SetoranMarketer"("marketerId", "tanggal");
