/*
  Warnings:

  - You are about to drop the column `cpmTarget` on the `Studio` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PengeluaranRutinKategori" AS ENUM ('SUBSCRIPTION', 'SUPPORT', 'LAINNYA');

-- AlterTable
ALTER TABLE "Studio" DROP COLUMN "cpmTarget";

-- CreateTable
CREATE TABLE "StudioPengeluaranRutin" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "kategori" "PengeluaranRutinKategori" NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioPengeluaranRutin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StudioPengeluaranRutin" ADD CONSTRAINT "StudioPengeluaranRutin_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
