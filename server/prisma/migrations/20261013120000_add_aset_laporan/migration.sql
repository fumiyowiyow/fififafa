-- CreateTable
CREATE TABLE "LogoLaporan" (
    "id" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "diunggahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogoLaporan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoSampul" (
    "id" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "nama" TEXT,
    "dataUrl" TEXT NOT NULL,
    "thumb" TEXT,
    "diunggahOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoSampul_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogoLaporan_jenis_targetId_key" ON "LogoLaporan"("jenis", "targetId");

-- CreateIndex
CREATE INDEX "FotoSampul_jenis_targetId_createdAt_idx" ON "FotoSampul"("jenis", "targetId", "createdAt");

