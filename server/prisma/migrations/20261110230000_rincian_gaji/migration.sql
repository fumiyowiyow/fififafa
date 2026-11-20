-- AlterTable
ALTER TABLE "TunjanganPenggajian" ADD COLUMN     "rincianId" TEXT;

-- CreateTable
CREATE TABLE "RincianGajiTetap" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RincianGajiTetap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RincianGajiTetap_studioId_userId_idx" ON "RincianGajiTetap"("studioId", "userId");
