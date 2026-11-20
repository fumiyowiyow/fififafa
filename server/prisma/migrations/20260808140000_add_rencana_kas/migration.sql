-- CreateTable
CREATE TABLE "RencanaKas" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "estimasiPengeluaran" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimasiPendapatanMinggu1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimasiPendapatanMinggu2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimasiPendapatanMinggu3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimasiPendapatanMinggu4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RencanaKas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RencanaKas_studioId_bulan_tahun_key" ON "RencanaKas"("studioId", "bulan", "tahun");

-- AddForeignKey
ALTER TABLE "RencanaKas" ADD CONSTRAINT "RencanaKas_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
