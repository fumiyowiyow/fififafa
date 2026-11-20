-- CreateTable
CREATE TABLE "TalentEksternal" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kontak" TEXT,
    "bank" TEXT,
    "noRekening" TEXT,
    "atasNamaRekening" TEXT,
    "catatan" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentEksternal_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AssignmentProduksi" ADD COLUMN     "talentEksternalId" TEXT;

-- CreateIndex
CREATE INDEX "TalentEksternal_nama_idx" ON "TalentEksternal"("nama");

-- CreateIndex
CREATE INDEX "AssignmentProduksi_talentEksternalId_idx" ON "AssignmentProduksi"("talentEksternalId");

-- AddForeignKey
ALTER TABLE "AssignmentProduksi" ADD CONSTRAINT "AssignmentProduksi_talentEksternalId_fkey" FOREIGN KEY ("talentEksternalId") REFERENCES "TalentEksternal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
