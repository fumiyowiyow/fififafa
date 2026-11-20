-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "genre" TEXT,
ADD COLUMN     "kesulitan" TEXT;

-- CreateTable
CREATE TABLE "PenugasanTahap" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tahapId" TEXT,
    "namaTahap" TEXT NOT NULL,
    "jenisTahap" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "progres" INTEGER NOT NULL DEFAULT 0,
    "catatanKerja" TEXT,
    "dijadwalkan" DATE,
    "ditugaskanPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mulaiPada" TIMESTAMP(3),
    "selesaiPada" TIMESTAMP(3),
    "urutanAntrean" INTEGER,
    "ditugaskanOleh" TEXT,
    "otomatis" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PenugasanTahap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeahlianTahap" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tahapId" TEXT NOT NULL,
    "akunId" TEXT,
    "maksKesulitan" TEXT NOT NULL DEFAULT 'MUDAH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeahlianTahap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeahlianGenre" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "maksKesulitan" TEXT NOT NULL DEFAULT 'MUDAH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeahlianGenre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PengaturanPenugasan" (
    "studioId" TEXT NOT NULL,
    "otomatis" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PengaturanPenugasan_pkey" PRIMARY KEY ("studioId")
);

-- CreateIndex
CREATE INDEX "PenugasanTahap_userId_status_idx" ON "PenugasanTahap"("userId", "status");

-- CreateIndex
CREATE INDEX "PenugasanTahap_orderId_tahapId_idx" ON "PenugasanTahap"("orderId", "tahapId");

-- CreateIndex
CREATE INDEX "KeahlianTahap_studioId_tahapId_idx" ON "KeahlianTahap"("studioId", "tahapId");

-- CreateIndex
CREATE INDEX "KeahlianTahap_userId_idx" ON "KeahlianTahap"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KeahlianGenre_studioId_userId_genre_key" ON "KeahlianGenre"("studioId", "userId", "genre");

-- AddForeignKey
ALTER TABLE "PenugasanTahap" ADD CONSTRAINT "PenugasanTahap_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenugasanTahap" ADD CONSTRAINT "PenugasanTahap_tahapId_fkey" FOREIGN KEY ("tahapId") REFERENCES "TahapProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeahlianTahap" ADD CONSTRAINT "KeahlianTahap_tahapId_fkey" FOREIGN KEY ("tahapId") REFERENCES "TahapProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
