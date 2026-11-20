-- Jejak koreksi manual foto CPM (4 Nov 2026)

-- AlterTable
ALTER TABLE "StudioCpmBulanan" ADD COLUMN     "diubahOleh" TEXT,
ADD COLUMN     "diubahPada" TIMESTAMP(3);
