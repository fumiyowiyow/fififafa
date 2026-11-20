-- CreateEnum
CREATE TYPE "TipeEksternalProduksi" AS ENUM ('FREELANCER_PERORANGAN', 'STUDIO_LAIN');

-- AlterTable
ALTER TABLE "AssignmentProduksi" ADD COLUMN     "tipeEksternal" "TipeEksternalProduksi";
