-- Lembur per project (9 Nov 2026, keputusan user: nilai per order, diisi koordinator saat menyetujui). Kolom tambahan, nullable.
ALTER TABLE "LemburKehadiran" ADD COLUMN "orderId" TEXT;
ALTER TABLE "LemburKehadiran" ADD COLUMN "nilaiProyek" DOUBLE PRECISION;
