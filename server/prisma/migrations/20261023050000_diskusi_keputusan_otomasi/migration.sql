-- CreateTable
CREATE TABLE "DiskusiKeputusan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "orderId" TEXT,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "tautan" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'TERBUKA',
    "dibuatOlehId" TEXT,
    "dibuatOleh" TEXT NOT NULL,
    "otomatis" BOOLEAN NOT NULL DEFAULT false,
    "diputuskanOleh" TEXT,
    "diputuskanPada" TIMESTAMP(3),
    "ringkasanKeputusan" TEXT,
    "dibatalkanOleh" TEXT,
    "dibatalkanPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiskusiKeputusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesertaDiskusi" (
    "id" TEXT NOT NULL,
    "diskusiId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "peran" TEXT NOT NULL DEFAULT 'PESERTA',
    "terakhirDibaca" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesertaDiskusi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesanDiskusi" (
    "id" TEXT NOT NULL,
    "diskusiId" TEXT NOT NULL,
    "userId" TEXT,
    "nama" TEXT NOT NULL,
    "indukId" TEXT,
    "isi" TEXT NOT NULL,
    "tautan" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sebut" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dihapusPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesanDiskusi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogOtomasi" (
    "id" TEXT NOT NULL,
    "aturan" TEXT NOT NULL,
    "subjekTipe" TEXT,
    "subjekId" TEXT,
    "kunciDedup" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogOtomasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiskusiKeputusan_studioId_status_idx" ON "DiskusiKeputusan"("studioId", "status");

-- CreateIndex
CREATE INDEX "DiskusiKeputusan_orderId_idx" ON "DiskusiKeputusan"("orderId");

-- CreateIndex
CREATE INDEX "PesertaDiskusi_userId_idx" ON "PesertaDiskusi"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PesertaDiskusi_diskusiId_userId_key" ON "PesertaDiskusi"("diskusiId", "userId");

-- CreateIndex
CREATE INDEX "PesanDiskusi_diskusiId_createdAt_idx" ON "PesanDiskusi"("diskusiId", "createdAt");

-- CreateIndex
CREATE INDEX "LogOtomasi_aturan_subjekTipe_subjekId_idx" ON "LogOtomasi"("aturan", "subjekTipe", "subjekId");

-- CreateIndex
CREATE UNIQUE INDEX "LogOtomasi_aturan_kunciDedup_key" ON "LogOtomasi"("aturan", "kunciDedup");

-- AddForeignKey
ALTER TABLE "PesertaDiskusi" ADD CONSTRAINT "PesertaDiskusi_diskusiId_fkey" FOREIGN KEY ("diskusiId") REFERENCES "DiskusiKeputusan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesanDiskusi" ADD CONSTRAINT "PesanDiskusi_diskusiId_fkey" FOREIGN KEY ("diskusiId") REFERENCES "DiskusiKeputusan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
