-- Raport siswa mengikuti format raport Karir Anak (13 Okt 2026). Kolom lama format pertama
-- (dipakai < 1 hari) dipetakan: kompetensi -> teknis, catatanMentor -> untukOrangTua,
-- perkembangan / perluDikembangkan / target digabung ke untukSiswa supaya tidak ada isi yang hilang.

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "tempatLahir" TEXT;

-- AlterTable RaportSiswa
ALTER TABLE "RaportSiswa" RENAME COLUMN "kompetensi" TO "teknis";
ALTER TABLE "RaportSiswa" RENAME COLUMN "catatanMentor" TO "untukOrangTua";
ALTER TABLE "RaportSiswa" ADD COLUMN "untukSiswa" TEXT,
ADD COLUMN "kesanBelajar" TEXT,
ADD COLUMN "personal" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "renstraBelajar" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "renstraSelanjutnya" JSONB NOT NULL DEFAULT '[]';
UPDATE "RaportSiswa" SET "untukSiswa" = NULLIF(concat_ws(E'\n\n', "perkembangan", "perluDikembangkan", "target"), '');
ALTER TABLE "RaportSiswa" DROP COLUMN "perkembangan",
DROP COLUMN "perluDikembangkan",
DROP COLUMN "target",
DROP COLUMN "ringkasanNilai";
ALTER TABLE "RaportSiswa" ALTER COLUMN "penulisId" DROP NOT NULL;
ALTER TABLE "RaportSiswa" DROP CONSTRAINT "RaportSiswa_penulisId_fkey";
ALTER TABLE "RaportSiswa" ADD CONSTRAINT "RaportSiswa_penulisId_fkey" FOREIGN KEY ("penulisId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RaportLampiran" (
    "id" TEXT NOT NULL,
    "raportId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "keterangan" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaportLampiran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaportLampiran_raportId_idx" ON "RaportLampiran"("raportId");

-- AddForeignKey
ALTER TABLE "RaportLampiran" ADD CONSTRAINT "RaportLampiran_raportId_fkey" FOREIGN KEY ("raportId") REFERENCES "RaportSiswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
