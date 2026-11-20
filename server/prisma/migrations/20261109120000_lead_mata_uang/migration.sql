-- Prospek (MarketingLead) boleh diisi dalam USD × kurs (9 Nov 2026). Kolom tambahan, nullable; estimasiNilai tetap Rupiah.
ALTER TABLE "MarketingLead" ADD COLUMN "mataUang" TEXT;
ALTER TABLE "MarketingLead" ADD COLUMN "nilaiUsd" DOUBLE PRECISION;
ALTER TABLE "MarketingLead" ADD COLUMN "kurs" DOUBLE PRECISION;
