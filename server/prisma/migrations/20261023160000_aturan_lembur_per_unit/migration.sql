-- Aturan lembur per unit (koordinator menentukan sendiri) + lembur presensi terikat unit & berstatus persetujuan (21 Okt 2026)

-- AlterTable
ALTER TABLE "LemburKehadiran" ADD COLUMN     "catatanPeninjau" TEXT,
ADD COLUMN     "ditinjauOleh" TEXT,
ADD COLUMN     "ditinjauOlehId" TEXT,
ADD COLUMN     "ditinjauPada" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DISETUJUI',
ADD COLUMN     "studioId" TEXT;

-- Lembur MANUAL yang sudah tercatat belum pernah disetujui siapa pun → menunggu persetujuan (belum ada yang dibayar: tarif belum pernah diisi)
UPDATE "LemburKehadiran" SET "status" = 'MENUNGGU' WHERE "sumber" = 'MANUAL' AND "penggajianId" IS NULL;

-- AlterTable
ALTER TABLE "PengaturanLembur" ADD COLUMN     "batasJamBulanan" DOUBLE PRECISION,
ADD COLUMN     "catatan" TEXT,
ADD COLUMN     "minimalMenit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'PER_JAM',
ADD COLUMN     "otomatisPerluSetuju" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pembulatanMenit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pengaliLibur" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "perluPersetujuan" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tarifPerHari" DOUBLE PRECISION,
ADD COLUMN     "tingkat" JSONB;

-- CreateIndex
CREATE INDEX "LemburKehadiran_studioId_status_idx" ON "LemburKehadiran"("studioId", "status");
