-- Tanggal beli aset (15 Okt 2026), boleh kosong. masaAktif tetap dipakai untuk garansi/langganan.
ALTER TABLE "Asset" ADD COLUMN "tanggalBeli" TIMESTAMP(3);
