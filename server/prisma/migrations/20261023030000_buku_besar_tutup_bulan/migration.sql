-- AlterTable
ALTER TABLE "KategoriBiaya" ADD COLUMN     "kategoriLedgerId" TEXT;

-- CreateTable
CREATE TABLE "KategoriLedger" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "nama" TEXT NOT NULL,
    "arus" TEXT NOT NULL,
    "sifat" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KategoriLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTetap" (
    "id" TEXT NOT NULL,
    "kategoriId" TEXT NOT NULL,
    "studioId" TEXT,
    "userId" TEXT,
    "nama" TEXT NOT NULL,
    "jumlahBawaan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemTetap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTetapBulan" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "catatan" TEXT,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemTetapBulan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntriLedger" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "kategoriId" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "sumberTipe" TEXT NOT NULL DEFAULT 'MANUAL',
    "sumberId" TEXT,
    "bulan" TEXT NOT NULL,
    "terkunci" BOOLEAN NOT NULL DEFAULT false,
    "dibuatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntriLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusBulan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BERJALAN',
    "kasAwalManual" DOUBLE PRECISION,
    "kasAwal" DOUBLE PRECISION,
    "masuk" DOUBLE PRECISION,
    "variabel" DOUBLE PRECISION,
    "tetap" DOUBLE PRECISION,
    "kasAkhir" DOUBLE PRECISION,
    "ditutupPada" TIMESTAMP(3),
    "ditutupOleh" TEXT,
    "catatan" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusBulan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KategoriLedger_arus_urutan_idx" ON "KategoriLedger"("arus", "urutan");

-- CreateIndex
CREATE INDEX "ItemTetap_studioId_aktif_idx" ON "ItemTetap"("studioId", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "ItemTetapBulan_itemId_bulan_key" ON "ItemTetapBulan"("itemId", "bulan");

-- CreateIndex
CREATE INDEX "EntriLedger_studioId_bulan_idx" ON "EntriLedger"("studioId", "bulan");

-- CreateIndex
CREATE INDEX "EntriLedger_sumberTipe_sumberId_idx" ON "EntriLedger"("sumberTipe", "sumberId");

-- CreateIndex
CREATE INDEX "StatusBulan_bulan_status_idx" ON "StatusBulan"("bulan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StatusBulan_studioId_bulan_key" ON "StatusBulan"("studioId", "bulan");

-- AddForeignKey
ALTER TABLE "ItemTetap" ADD CONSTRAINT "ItemTetap_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "KategoriLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTetapBulan" ADD CONSTRAINT "ItemTetapBulan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemTetap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntriLedger" ADD CONSTRAINT "EntriLedger_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "KategoriLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
