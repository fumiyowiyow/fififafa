-- Model RumahUsaha/RumahUsahaFund sudah lama ada di schema.prisma (sejak commit a28105f,
-- "Rumah Usaha master data + dana per rumah usaha") dan controller-nya sudah live sejak saat
-- itu, TAPI migration yang bikin tabel-nya ternyata tidak pernah dibuat -- fitur ini cuma
-- pernah dijalankan lewat `prisma db push` di lingkungan dev, bukan lewat migration resmi.
-- IF NOT EXISTS dipakai supaya aman baik untuk DB yang kebetulan sudah punya tabel ini
-- (drift) maupun DB baru yang belum sama sekali.

CREATE TABLE IF NOT EXISTS "RumahUsaha" (
    "id"          TEXT NOT NULL,
    "nama"        TEXT NOT NULL,
    "deskripsi"   TEXT,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RumahUsaha_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RumahUsahaFund" (
    "id"           TEXT NOT NULL,
    "rumahUsahaId" TEXT NOT NULL,
    "bulan"        INTEGER NOT NULL,
    "tahun"        INTEGER NOT NULL,
    "dana"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RumahUsahaFund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RumahUsahaFund_rumahUsahaId_bulan_tahun_key"
  ON "RumahUsahaFund"("rumahUsahaId", "bulan", "tahun");

DO $$ BEGIN
  ALTER TABLE "RumahUsahaFund" ADD CONSTRAINT "RumahUsahaFund_rumahUsahaId_fkey"
    FOREIGN KEY ("rumahUsahaId") REFERENCES "RumahUsaha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
