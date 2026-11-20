-- CreateTable
CREATE TABLE "Pengeluaran" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "kategori" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "dicatatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pengeluaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pengeluaran_studioId_tanggal_idx" ON "Pengeluaran"("studioId", "tanggal");

-- AddForeignKey
ALTER TABLE "Pengeluaran" ADD CONSTRAINT "Pengeluaran_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

