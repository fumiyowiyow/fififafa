-- AlterTable
ALTER TABLE "LemburKehadiran" ADD COLUMN     "penggajianId" TEXT;

-- CreateTable
CREATE TABLE "PengaturanLembur" (
    "studioId" TEXT NOT NULL,
    "tarifPerJam" DOUBLE PRECISION,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PengaturanLembur_pkey" PRIMARY KEY ("studioId")
);

-- AddForeignKey
ALTER TABLE "LemburKehadiran" ADD CONSTRAINT "LemburKehadiran_penggajianId_fkey" FOREIGN KEY ("penggajianId") REFERENCES "Penggajian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

