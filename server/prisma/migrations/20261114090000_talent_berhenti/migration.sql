-- Talent BERHENTI di tengah order (14 Nov 2026, masukan tim): talent tetap tercatat di order (nama, fee, riwayat) tetapi keluar dari antrean
-- dan tidak menerima tahap berikutnya. Kosong = masih aktif (semua data lama).
ALTER TABLE "AssignmentProduksi" ADD COLUMN "berhentiPada" TIMESTAMP(3);
ALTER TABLE "AssignmentProduksi" ADD COLUMN "berhentiOleh" TEXT;
ALTER TABLE "AssignmentProduksi" ADD COLUMN "alasanBerhenti" TEXT;
