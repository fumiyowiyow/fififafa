-- CreateEnum
CREATE TYPE "DanaPengembanganTipe" AS ENUM ('TRADER_MANUAL', 'BOT_CRYPTO', 'SAHAM', 'LAINNYA');

-- CreateTable
CREATE TABLE "DanaPengembanganPool" (
    "id" TEXT NOT NULL,
    "totalPool" DOUBLE PRECISION NOT NULL DEFAULT 405000000,
    "catatan" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DanaPengembanganPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanaPengembanganUnit" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" "DanaPengembanganTipe" NOT NULL,
    "pengelolaId" TEXT NOT NULL,
    "modalAwal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DanaPengembanganUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanaPengembanganLaporan" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "periodeAwal" TIMESTAMP(3) NOT NULL,
    "periodeAkhir" TIMESTAMP(3) NOT NULL,
    "saldoAkhir" DOUBLE PRECISION NOT NULL,
    "prosesnya" TEXT NOT NULL,
    "dilaporkanOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DanaPengembanganLaporan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DanaPengembanganLaporan_unitId_periodeAwal_key" ON "DanaPengembanganLaporan"("unitId", "periodeAwal");

-- AddForeignKey
ALTER TABLE "DanaPengembanganUnit" ADD CONSTRAINT "DanaPengembanganUnit_pengelolaId_fkey" FOREIGN KEY ("pengelolaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanaPengembanganLaporan" ADD CONSTRAINT "DanaPengembanganLaporan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "DanaPengembanganUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedRow: singleton pool row, biar app tidak perlu logic "create on first GET"
INSERT INTO "DanaPengembanganPool" ("id", "totalPool", "createdAt", "updatedAt")
VALUES ('dp-pool-main', 405000000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
