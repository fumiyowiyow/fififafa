-- Studio kolaborasi (13 Okt 2026): angka studio dihitung di circle mitra, bukan di total ekosistem.
-- Default true = semua studio yang ada tetap dihitung seperti biasa.
ALTER TABLE "Studio" ADD COLUMN "hitungDiEkosistem" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mitraKolaborasi" TEXT;
