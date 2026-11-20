-- Bio Circle/Rumah Usaha: deskripsi, alamat, dan link Google Maps -- ditampilkan lewat modal
-- "Bio" baru (read-only, terbuka buat semua orang) terpisah dari modal "Edit" yang admin-only.

ALTER TABLE "Circle" ADD COLUMN "deskripsi" TEXT;
ALTER TABLE "Circle" ADD COLUMN "alamat" TEXT;
ALTER TABLE "Circle" ADD COLUMN "mapsUrl" TEXT;

ALTER TABLE "RumahUsaha" ADD COLUMN "alamat" TEXT;
ALTER TABLE "RumahUsaha" ADD COLUMN "mapsUrl" TEXT;
