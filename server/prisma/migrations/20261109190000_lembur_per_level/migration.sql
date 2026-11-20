-- AlterTable
ALTER TABLE "LemburKehadiran" ADD COLUMN     "feeLevel" DOUBLE PRECISION,
ADD COLUMN     "levelId" TEXT,
ADD COLUMN     "levelNama" TEXT,
ADD COLUMN     "progresAkhir" DOUBLE PRECISION,
ADD COLUMN     "progresAwal" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "LevelLembur" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT,
    "fee" DOUBLE PRECISION NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelLembur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LevelLembur_studioId_idx" ON "LevelLembur"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "LevelLembur_studioId_nama_key" ON "LevelLembur"("studioId", "nama");
