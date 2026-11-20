-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN "isianKhusus" JSONB;

-- CreateTable
CREATE TABLE "KolomKhususOrder" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "pilihan" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diKartu" BOOLEAN NOT NULL DEFAULT true,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KolomKhususOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KolomKhususOrder_studioId_aktif_idx" ON "KolomKhususOrder"("studioId", "aktif");
