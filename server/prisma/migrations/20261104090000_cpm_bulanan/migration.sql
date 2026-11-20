-- Foto CPM per studio per bulan (4 Nov 2026)

-- CreateTable
CREATE TABLE "StudioCpmBulanan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "totalThp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jumlahOrang" INTEGER NOT NULL DEFAULT 0,
    "totalPengeluaranRutin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalShu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioCpmBulanan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioCpmBulanan_studioId_bulan_tahun_key" ON "StudioCpmBulanan"("studioId", "bulan", "tahun");

-- AddForeignKey
ALTER TABLE "StudioCpmBulanan" ADD CONSTRAINT "StudioCpmBulanan_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
