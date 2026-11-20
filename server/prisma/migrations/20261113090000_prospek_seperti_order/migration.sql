-- Prospek disamakan dengan isian Tambah order (13 Nov 2026, masukan tim): judul, jenis klien, deadline, talent (internal/freelance).
-- Semua opsional; "Jadikan order" memakai isian ini sehingga marketer tinggal melengkapi.
ALTER TABLE "MarketingLead" ADD COLUMN "judul" TEXT;
ALTER TABLE "MarketingLead" ADD COLUMN "tipeKlien" TEXT;
ALTER TABLE "MarketingLead" ADD COLUMN "deadline" TIMESTAMP(3);
ALTER TABLE "MarketingLead" ADD COLUMN "talentUserId" TEXT;
ALTER TABLE "MarketingLead" ADD COLUMN "namaFreelance" TEXT;
