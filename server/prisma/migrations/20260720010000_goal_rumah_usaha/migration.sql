-- Goal cuma punya circleId sejak awal dibuat -- Rumah Usaha jadi unit organisasi sejajar Circle
-- 19 Juli 2026, tapi Goal belum ikut di-update. Kolom baru nullable, pola sama kayak circleId
-- yang sudah ada (plain field, tanpa FK constraint formal).
ALTER TABLE "Goal" ADD COLUMN "rumahUsahaId" TEXT;
