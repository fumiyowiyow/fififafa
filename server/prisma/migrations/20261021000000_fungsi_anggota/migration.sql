-- Fungsi kerja anggota per studio (artist / marketer / PM-QC / admin), dengan status konfirmasi koordinator.
CREATE TYPE "FungsiKerja" AS ENUM ('ARTIST', 'MARKETER', 'PM_QC', 'ADMIN');

CREATE TABLE "FungsiAnggota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "fungsi" "FungsiKerja" NOT NULL,
    "bidang" TEXT,
    "terkonfirmasi" BOOLEAN NOT NULL DEFAULT false,
    "dikonfirmasiOleh" TEXT,
    "dikonfirmasiPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FungsiAnggota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FungsiAnggota_userId_studioId_fungsi_key" ON "FungsiAnggota"("userId", "studioId", "fungsi");
CREATE INDEX "FungsiAnggota_studioId_fungsi_idx" ON "FungsiAnggota"("studioId", "fungsi");

ALTER TABLE "FungsiAnggota" ADD CONSTRAINT "FungsiAnggota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FungsiAnggota" ADD CONSTRAINT "FungsiAnggota_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
