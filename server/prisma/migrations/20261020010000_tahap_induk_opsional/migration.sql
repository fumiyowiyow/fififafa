-- Tahap: induk gerbang, opsional per order. Order: daftar tahap opsional yang menyala.
ALTER TABLE "TahapProduksi" ADD COLUMN "indukId" TEXT,
ADD COLUMN "opsional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aktifBawaan" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OrderProduksi" ADD COLUMN "tahapAktif" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Nilai legacy dari prototipe awal → nilai baru
UPDATE "TahapProduksi" SET "jenis" = 'PREVIEW_KLIEN' WHERE "jenis" = 'PREVIEW';
UPDATE "TahapProduksi" SET "jenis" = 'REVISI_KLIEN'  WHERE "jenis" = 'REVISI';
UPDATE "RiwayatTahapOrder" SET "jenis" = 'PREVIEW_KLIEN' WHERE "jenis" = 'PREVIEW';
UPDATE "RiwayatTahapOrder" SET "jenis" = 'REVISI_KLIEN'  WHERE "jenis" = 'REVISI';
