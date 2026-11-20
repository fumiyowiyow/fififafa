-- CreateTable
CREATE TABLE "TargetOmsetUnit" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "targetUsd" DOUBLE PRECISION NOT NULL,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetOmsetUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetOmsetAkun" (
    "id" TEXT NOT NULL,
    "akunId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "targetUsd" DOUBLE PRECISION NOT NULL,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetOmsetAkun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaizenTindakan" (
    "id" TEXT NOT NULL,
    "lingkupJenis" TEXT NOT NULL,
    "lingkupId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "sumberTab" TEXT,
    "snapshot" JSONB,
    "pemilikId" TEXT,
    "dibuatOlehId" TEXT NOT NULL,
    "dibuatOleh" TEXT NOT NULL,
    "jatuhTempo" DATE,
    "status" TEXT NOT NULL DEFAULT 'BARU',
    "prioritas" TEXT NOT NULL DEFAULT 'SEDANG',
    "selesaiPada" TIMESTAMP(3),
    "catatanHasil" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaizenTindakan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TargetOmsetUnit_studioId_tahun_bulan_key" ON "TargetOmsetUnit"("studioId", "tahun", "bulan");

-- CreateIndex
CREATE UNIQUE INDEX "TargetOmsetAkun_akunId_tahun_bulan_key" ON "TargetOmsetAkun"("akunId", "tahun", "bulan");

-- CreateIndex
CREATE INDEX "KaizenTindakan_lingkupJenis_lingkupId_status_idx" ON "KaizenTindakan"("lingkupJenis", "lingkupId", "status");
