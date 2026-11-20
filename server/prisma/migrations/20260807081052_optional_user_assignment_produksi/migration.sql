-- DropForeignKey
ALTER TABLE "AssignmentProduksi" DROP CONSTRAINT "AssignmentProduksi_userId_fkey";

-- AlterTable
ALTER TABLE "AssignmentProduksi" ADD COLUMN     "namaEksternal" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AssignmentProduksi" ADD CONSTRAINT "AssignmentProduksi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
