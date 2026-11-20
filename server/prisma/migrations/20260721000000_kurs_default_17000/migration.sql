-- Update default kurs (Rp/USD) dari 15800 ke 17000 -- gak ubah data yang udah ada, cuma nilai
-- default buat row baru yang dibuat TANPA kurs eksplisit (jarang kejadian, app selalu kirim kurs).
ALTER TABLE "WeeklyReport" ALTER COLUMN "kurs" SET DEFAULT 17000;
ALTER TABLE "DanaPengembanganPool" ALTER COLUMN "kurs" SET DEFAULT 17000;
