-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "alasanCancel" TEXT,
ADD COLUMN     "cancelKlien" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancelPada" TIMESTAMP(3);
