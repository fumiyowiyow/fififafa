-- CreateEnum
CREATE TYPE "StatusPenggajian" AS ENUM ('DRAFT', 'FINAL', 'DIBAYAR');

-- CreateTable
CREATE TABLE "RateCardLembur" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "keterangan" TEXT,
    "fee" DOUBLE PRECISION NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateCardLembur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatatanLembur" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "penggajianId" TEXT,
    "rateCardId" TEXT NOT NULL,
    "feeSaatItu" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "klien" TEXT,
    "briefName" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "progresAwal" DOUBLE PRECISION NOT NULL,
    "progresAkhir" DOUBLE PRECISION NOT NULL,
    "feeAkhir" DOUBLE PRECISION NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatatanLembur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penggajian" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "gajiPokok" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "komisi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lembur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tunjanganKos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tunjanganMakan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tunjanganKomunikasi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tunjanganTransport" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tunjanganBeras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "potongan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thp" DOUBLE PRECISION NOT NULL,
    "status" "StatusPenggajian" NOT NULL DEFAULT 'DRAFT',
    "buktiBayar" TEXT,
    "dilaporkanOleh" TEXT,
    "dikonfirmasiOleh" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Penggajian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateCardLembur_studioId_level_key" ON "RateCardLembur"("studioId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Penggajian_userId_studioId_bulan_tahun_key" ON "Penggajian"("userId", "studioId", "bulan", "tahun");

-- AddForeignKey
ALTER TABLE "RateCardLembur" ADD CONSTRAINT "RateCardLembur_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanLembur" ADD CONSTRAINT "CatatanLembur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanLembur" ADD CONSTRAINT "CatatanLembur_penggajianId_fkey" FOREIGN KEY ("penggajianId") REFERENCES "Penggajian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanLembur" ADD CONSTRAINT "CatatanLembur_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCardLembur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanLembur" ADD CONSTRAINT "CatatanLembur_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penggajian" ADD CONSTRAINT "Penggajian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penggajian" ADD CONSTRAINT "Penggajian_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
