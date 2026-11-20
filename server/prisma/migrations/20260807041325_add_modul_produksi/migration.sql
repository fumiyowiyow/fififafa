-- CreateEnum
CREATE TYPE "TipeKlienProduksi" AS ENUM ('INTERNAL', 'EKSTERNAL');

-- CreateEnum
CREATE TYPE "StatusOrderProduksi" AS ENUM ('MASUK', 'PROSES', 'SELESAI', 'BATAL');

-- CreateTable
CREATE TABLE "AkunProduksi" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "namaAkun" TEXT NOT NULL,
    "feePersen" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AkunProduksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderProduksi" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "akunId" TEXT NOT NULL,
    "tipeKlien" "TipeKlienProduksi" NOT NULL DEFAULT 'EKSTERNAL',
    "klienStudioId" TEXT,
    "klien" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "kategori" TEXT,
    "nilaiKotor" DOUBLE PRECISION NOT NULL,
    "nilaiBersih" DOUBLE PRECISION NOT NULL,
    "status" "StatusOrderProduksi" NOT NULL DEFAULT 'MASUK',
    "subStatus" TEXT,
    "tanggalMasuk" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3),
    "tanggalSelesai" TIMESTAMP(3),
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderProduksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentProduksi" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "peran" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentProduksi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AkunProduksi_studioId_namaAkun_key" ON "AkunProduksi"("studioId", "namaAkun");

-- CreateIndex
CREATE INDEX "OrderProduksi_akunId_status_idx" ON "OrderProduksi"("akunId", "status");

-- CreateIndex
CREATE INDEX "OrderProduksi_deadline_idx" ON "OrderProduksi"("deadline");

-- CreateIndex
CREATE INDEX "OrderProduksi_klienStudioId_idx" ON "OrderProduksi"("klienStudioId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentProduksi_orderId_userId_key" ON "AssignmentProduksi"("orderId", "userId");

-- AddForeignKey
ALTER TABLE "AkunProduksi" ADD CONSTRAINT "AkunProduksi_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProduksi" ADD CONSTRAINT "OrderProduksi_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProduksi" ADD CONSTRAINT "OrderProduksi_akunId_fkey" FOREIGN KEY ("akunId") REFERENCES "AkunProduksi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProduksi" ADD CONSTRAINT "OrderProduksi_klienStudioId_fkey" FOREIGN KEY ("klienStudioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProduksi" ADD CONSTRAINT "AssignmentProduksi_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentProduksi" ADD CONSTRAINT "AssignmentProduksi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
