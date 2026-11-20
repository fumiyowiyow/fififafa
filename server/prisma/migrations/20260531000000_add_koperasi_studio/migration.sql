-- AlterTable: make userId nullable, add studioId
ALTER TABLE "KoperasiSimpanan" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "KoperasiSimpanan" ADD COLUMN "studioId" TEXT;

-- Drop old unique constraint
DROP INDEX IF EXISTS "KoperasiSimpanan_userId_bulan_tahun_key";

-- Recreate unique index for user records (allows NULL userId)
CREATE UNIQUE INDEX "KoperasiSimpanan_userId_bulan_tahun_key"
  ON "KoperasiSimpanan"("userId", "bulan", "tahun");

-- New unique index for studio records
CREATE UNIQUE INDEX "KoperasiSimpanan_studioId_bulan_tahun_key"
  ON "KoperasiSimpanan"("studioId", "bulan", "tahun");
