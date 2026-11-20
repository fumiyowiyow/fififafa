-- CreateEnum
CREATE TYPE "StatusRaport" AS ENUM ('DRAFT', 'TERBIT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fokusKompetensi" TEXT,
ADD COLUMN     "mentorId" TEXT,
ADD COLUMN     "tanggalMulaiProgram" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RaportSiswa" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "penulisId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "kuartal" INTEGER NOT NULL,
    "status" "StatusRaport" NOT NULL DEFAULT 'DRAFT',
    "kompetensi" JSONB NOT NULL DEFAULT '[]',
    "perkembangan" TEXT,
    "perluDikembangkan" TEXT,
    "catatanMentor" TEXT,
    "target" TEXT,
    "ringkasanNilai" JSONB,
    "identitas" JSONB,
    "terbitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaportSiswa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaportSiswa_penulisId_idx" ON "RaportSiswa"("penulisId");

-- CreateIndex
CREATE UNIQUE INDEX "RaportSiswa_userId_tahun_kuartal_key" ON "RaportSiswa"("userId", "tahun", "kuartal");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaportSiswa" ADD CONSTRAINT "RaportSiswa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaportSiswa" ADD CONSTRAINT "RaportSiswa_penulisId_fkey" FOREIGN KEY ("penulisId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
