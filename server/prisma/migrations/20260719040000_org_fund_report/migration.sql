-- Ganti "Dana Rumah Tangga Circle" (CircleMonthlyFund) + "Dana Rumah Usaha" (RumahUsahaFund,
-- dead code -- gak pernah punya UI) dengan satu model OrgFundReport: laporan mingguan dana
-- Circle/Rumah Usaha, persis pola WeeklyReport studio tapi cuma "dana terkini" (bukan omset).
--
-- CircleMonthlyFund/RumahUsahaFund sendiri TIDAK PERNAH punya migration sejak dibuat (drift
-- lama, sama kayak temuan RumahUsaha sebelumnya) -- pakai IF EXISTS supaya aman baik di DB
-- yang kebetulan sudah punya tabelnya (lewat db push) maupun yang belum sama sekali.

DROP TABLE IF EXISTS "CircleMonthlyFund";
DROP TABLE IF EXISTS "RumahUsahaFund";

CREATE TABLE IF NOT EXISTS "OrgFundReport" (
    "id"           TEXT NOT NULL,
    "circleId"     TEXT,
    "rumahUsahaId" TEXT,
    "periodeAwal"  TIMESTAMP(3) NOT NULL,
    "periodeAkhir" TIMESTAMP(3) NOT NULL,
    "dana"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pengeluaran"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "catatan"      TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgFundReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgFundReport_circleId_periodeAwal_key"
  ON "OrgFundReport"("circleId", "periodeAwal");
CREATE UNIQUE INDEX IF NOT EXISTS "OrgFundReport_rumahUsahaId_periodeAwal_key"
  ON "OrgFundReport"("rumahUsahaId", "periodeAwal");

DO $$ BEGIN
  ALTER TABLE "OrgFundReport" ADD CONSTRAINT "OrgFundReport_circleId_fkey"
    FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgFundReport" ADD CONSTRAINT "OrgFundReport_rumahUsahaId_fkey"
    FOREIGN KEY ("rumahUsahaId") REFERENCES "RumahUsaha"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
