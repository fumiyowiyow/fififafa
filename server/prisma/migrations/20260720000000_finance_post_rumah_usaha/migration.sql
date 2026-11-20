-- FinancePost cuma punya circleId sejak awal dibuat -- Rumah Usaha jadi unit organisasi
-- sejajar Circle 19 Juli 2026, tapi Pos Keuangan gak ikut di-update sampai sekarang, jadi
-- Rumah Usaha gak pernah bisa punya Pos Keuangan sama sekali. Kolom baru ini nullable dan pola
-- konsisten sama circleId yang sudah ada (plain field, tanpa FK constraint formal).
ALTER TABLE "FinancePost" ADD COLUMN "rumahUsahaId" TEXT;
