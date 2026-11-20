-- Ajuan bayar freelance oleh admin, dikonfirmasi Koordinator (16 Nov 2026, masukan tim)
ALTER TABLE "AssignmentProduksi" ADD COLUMN "ajuanJenis" TEXT;
ALTER TABLE "AssignmentProduksi" ADD COLUMN "ajuanJumlah" DOUBLE PRECISION;
ALTER TABLE "AssignmentProduksi" ADD COLUMN "ajuanCatatan" TEXT;
ALTER TABLE "AssignmentProduksi" ADD COLUMN "ajuanOleh" TEXT;
ALTER TABLE "AssignmentProduksi" ADD COLUMN "ajuanPada" TIMESTAMP(3);
