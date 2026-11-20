-- CreateTable
CREATE TABLE "ItemOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL DEFAULT 'ITEM',
    "nama" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "hargaSatuan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminBayarOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "jatuhTempo" DATE,
    "dibayarPada" DATE,
    "catatan" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminBayarOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatatanOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "nama" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatatanOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemOrder_orderId_urutan_idx" ON "ItemOrder"("orderId", "urutan");

-- CreateIndex
CREATE INDEX "TerminBayarOrder_orderId_urutan_idx" ON "TerminBayarOrder"("orderId", "urutan");

-- CreateIndex
CREATE INDEX "TerminBayarOrder_dibayarPada_jatuhTempo_idx" ON "TerminBayarOrder"("dibayarPada", "jatuhTempo");

-- CreateIndex
CREATE INDEX "CatatanOrder_orderId_createdAt_idx" ON "CatatanOrder"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ItemOrder" ADD CONSTRAINT "ItemOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminBayarOrder" ADD CONSTRAINT "TerminBayarOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatatanOrder" ADD CONSTRAINT "CatatanOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
