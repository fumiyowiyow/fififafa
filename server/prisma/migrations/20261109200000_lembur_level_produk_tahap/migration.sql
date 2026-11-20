-- DropIndex
DROP INDEX "LevelLembur_studioId_nama_key";

-- AlterTable
ALTER TABLE "LevelLembur" ADD COLUMN     "produk" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "TahapLembur" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "persen" INTEGER NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TahapLembur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TahapLembur_studioId_idx" ON "TahapLembur"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "TahapLembur_studioId_nama_key" ON "TahapLembur"("studioId", "nama");

-- CreateIndex
CREATE UNIQUE INDEX "LevelLembur_studioId_nama_produk_key" ON "LevelLembur"("studioId", "nama", "produk");
