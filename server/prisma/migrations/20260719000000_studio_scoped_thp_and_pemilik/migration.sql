-- PENTING: jalankan query verifikasi di bagian bawah file ini SEBELUM & SESUDAH deploy,
-- bandingkan hasilnya (lihat CLAUDE.md bagian "Current Work in Progress").

-- 1. Kolom THP per-role (baru, nullable, aman ditambahkan kapan saja)
ALTER TABLE "UserRole" ADD COLUMN "takeHomePay" DOUBLE PRECISION;

-- 2. Copy: THP flat User lama -> SEMUA UserRole yang studioId-nya terisi milik user itu (nilai
--    SAMA di semua posisi, bukan dibagi -- admin betulkan manual kalau perlu split beda per studio).
UPDATE "UserRole" ur
SET "takeHomePay" = u."takeHomePay"
FROM "User" u
WHERE u.id = ur."userId"
  AND ur."studioId" IS NOT NULL
  AND u."takeHomePay" IS NOT NULL;

-- 3. Hard assertion sebelum DROP COLUMN (irreversible) -- abort transaksi kalau ada baris yang
--    gagal ke-copy (harusnya mustahil, tapi ini pengaman eksplisit, bukan cuma catatan manual).
DO $$
DECLARE missing_count INT;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM "UserRole" ur
  JOIN "User" u ON u.id = ur."userId"
  WHERE ur."studioId" IS NOT NULL
    AND u."takeHomePay" IS NOT NULL
    AND ur."takeHomePay" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration abort: % UserRole rows failed to receive takeHomePay copy', missing_count;
  END IF;
END $$;

-- 4. Tabel kepemilikan studio baru (persentase saham, BUKAN nilai Rupiah)
CREATE TABLE "StudioPemilik" (
    "id"          TEXT NOT NULL,
    "studioId"    TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "persenSaham" DOUBLE PRECISION NOT NULL,
    "keterangan"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudioPemilik_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudioPemilik_studioId_userId_key" ON "StudioPemilik"("studioId", "userId");
ALTER TABLE "StudioPemilik" ADD CONSTRAINT "StudioPemilik_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioPemilik" ADD CONSTRAINT "StudioPemilik_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Tabel riwayat distribusi SHU + breakdown per-pemilik (snapshot, bukan live-computed)
CREATE TABLE "StudioShuDistribusi" (
    "id"             TEXT NOT NULL,
    "studioId"       TEXT NOT NULL,
    "tanggal"        TIMESTAMP(3) NOT NULL,
    "totalDibagikan" DOUBLE PRECISION NOT NULL,
    "kasSaatItu"     DOUBLE PRECISION,
    "keterangan"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioShuDistribusi_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StudioShuDistribusi" ADD CONSTRAINT "StudioShuDistribusi_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudioShuItem" (
    "id"            TEXT NOT NULL,
    "distribusiId"  TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "jumlah"        DOUBLE PRECISION NOT NULL,
    "persenSaatItu" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "StudioShuItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StudioShuItem" ADD CONSTRAINT "StudioShuItem_distribusiId_fkey"
  FOREIGN KEY ("distribusiId") REFERENCES "StudioShuDistribusi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioShuItem" ADD CONSTRAINT "StudioShuItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Drop kolom lama -- HANYA sampai sini kalau langkah 3 lolos.
ALTER TABLE "User" DROP COLUMN "takeHomePay";

-- ============================================================
-- Query verifikasi pre/post-deploy (jalankan manual di VPS via psql):
--
-- SEBELUM migrate deploy:
--   SELECT COUNT(*) FILTER (WHERE "takeHomePay" IS NOT NULL) AS users_with_thp,
--          SUM("takeHomePay") AS sum_thp
--   FROM "User";
--
-- SESUDAH migrate deploy, bandingkan sum_thp harus SAMA dengan:
--   SELECT COUNT(*) AS roles_with_thp, SUM("takeHomePay") AS sum_thp
--   FROM "UserRole" WHERE "takeHomePay" IS NOT NULL;
-- ============================================================
