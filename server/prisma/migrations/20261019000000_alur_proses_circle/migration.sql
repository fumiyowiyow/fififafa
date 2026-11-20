-- Alur proses web circle: templat tahap per studio + riwayat tahap tiap order.
CREATE TYPE "JenisTahap" AS ENUM ('MASUK', 'KERJA', 'PREVIEW', 'REVISI', 'HOLD', 'SELESAI');

CREATE TABLE "TahapProduksi" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" "JenisTahap" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TahapProduksi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiwayatTahapOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "namaTahap" TEXT NOT NULL,
    "jenis" "JenisTahap" NOT NULL,
    "userId" TEXT,
    "namaPengguna" TEXT,
    "mulai" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selesai" TIMESTAMP(3),
    CONSTRAINT "RiwayatTahapOrder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderProduksi" ADD COLUMN "tahapId" TEXT,
ADD COLUMN "nilaiDisepakati" DOUBLE PRECISION,
ADD COLUMN "revisiKe" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "TahapProduksi_studioId_nama_key" ON "TahapProduksi"("studioId", "nama");
CREATE INDEX "TahapProduksi_studioId_urutan_idx" ON "TahapProduksi"("studioId", "urutan");
CREATE INDEX "RiwayatTahapOrder_orderId_mulai_idx" ON "RiwayatTahapOrder"("orderId", "mulai");

ALTER TABLE "OrderProduksi" ADD CONSTRAINT "OrderProduksi_tahapId_fkey" FOREIGN KEY ("tahapId") REFERENCES "TahapProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TahapProduksi" ADD CONSTRAINT "TahapProduksi_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiwayatTahapOrder" ADD CONSTRAINT "RiwayatTahapOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
