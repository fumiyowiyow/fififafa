-- AlterEnum
BEGIN;
CREATE TYPE "TipeKlienProduksi_new" AS ENUM ('INTERNAL_EKOSISTEM', 'INTERNAL_JRU_LAIN', 'EKSTERNAL');
ALTER TABLE "OrderProduksi" ALTER COLUMN "tipeKlien" DROP DEFAULT;
ALTER TABLE "OrderProduksi" ALTER COLUMN "tipeKlien" TYPE "TipeKlienProduksi_new" USING ("tipeKlien"::text::"TipeKlienProduksi_new");
ALTER TYPE "TipeKlienProduksi" RENAME TO "TipeKlienProduksi_old";
ALTER TYPE "TipeKlienProduksi_new" RENAME TO "TipeKlienProduksi";
DROP TYPE "TipeKlienProduksi_old";
ALTER TABLE "OrderProduksi" ALTER COLUMN "tipeKlien" SET DEFAULT 'EKSTERNAL';
COMMIT;
