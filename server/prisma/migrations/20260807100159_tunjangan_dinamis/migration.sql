-- AlterTable
ALTER TABLE "Penggajian" DROP COLUMN "tunjanganBeras",
DROP COLUMN "tunjanganKomunikasi",
DROP COLUMN "tunjanganKos",
DROP COLUMN "tunjanganMakan",
DROP COLUMN "tunjanganTransport";

-- CreateTable
CREATE TABLE "TunjanganTemplate" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TunjanganTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TunjanganPenggajian" (
    "id" TEXT NOT NULL,
    "penggajianId" TEXT NOT NULL,
    "templateId" TEXT,
    "nama" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TunjanganPenggajian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TunjanganTemplate_studioId_nama_key" ON "TunjanganTemplate"("studioId", "nama");

-- AddForeignKey
ALTER TABLE "TunjanganTemplate" ADD CONSTRAINT "TunjanganTemplate_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TunjanganPenggajian" ADD CONSTRAINT "TunjanganPenggajian_penggajianId_fkey" FOREIGN KEY ("penggajianId") REFERENCES "Penggajian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TunjanganPenggajian" ADD CONSTRAINT "TunjanganPenggajian_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TunjanganTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
