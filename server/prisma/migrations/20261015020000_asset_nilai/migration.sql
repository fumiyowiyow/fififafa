-- Nilai aset (15 Okt 2026): nilai beli & nilai terkini dalam Rupiah, boleh kosong.
ALTER TABLE "Asset" ADD COLUMN "nilaiBeli" DOUBLE PRECISION,
ADD COLUMN "nilaiTerkini" DOUBLE PRECISION;
