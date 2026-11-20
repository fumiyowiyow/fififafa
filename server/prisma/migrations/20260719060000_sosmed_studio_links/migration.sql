-- SosmedLink dulu cuma bisa milik ORANG (userId wajib) -- sekarang bisa juga milik STUDIO
-- (akun kerja Fiverr/Etsy/Upwork/VGen yang sebenarnya aset studio, bukan pribadi). userId jadi
-- opsional, studioId baru (opsional), XOR divalidasi di controller.
--
-- CATATAN: tabel SosmedLink ini TIDAK PERNAH punya migration sejak dibuat (drift lama, sama
-- pola kayak RumahUsaha/CircleMonthlyFund yang sudah ditemukan sebelumnya) -- migration ini
-- aman dijalankan baik kalau tabelnya kebetulan sudah ada di production (lewat db push) maupun
-- belum sama sekali.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SosmedLink') THEN
    ALTER TABLE "SosmedLink" ALTER COLUMN "userId" DROP NOT NULL;
    ALTER TABLE "SosmedLink" ADD COLUMN IF NOT EXISTS "studioId" TEXT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SosmedLink" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT,
    "studioId"  TEXT,
    "platform"  TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "username"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SosmedLink_pkey" PRIMARY KEY ("id")
);
