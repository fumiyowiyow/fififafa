-- Migration "catch-up" -- nutup drift lama antara schema.prisma dan riwayat migration.
-- Ditemukan gak sengaja berkali-kali sesi ini (RumahUsaha, SosmedLink, dll): banyak fitur lama
-- ditambahkan ke schema.prisma dan dijalankan ke DB lewat `prisma db push` (bukan migration
-- resmi), jadi migration deploy dari nol sebelum ini bakal gagal/nggak lengkap. Semua statement
-- di sini IF NOT EXISTS / guarded -- aman dijalankan baik di DB yang datanya sudah ada (lewat
-- db push, termasuk production) maupun DB baru yang belum sama sekali.

-- ── User (isAnggotaKoperasi, namaBank, nik, nomorBpjs, refreshTokenVersion, unique telegramId) ──
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAnggotaKoperasi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "namaBank" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nik" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nomorBpjs" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "refreshTokenVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");

-- ── Studio (market) ──
ALTER TABLE "Studio" ADD COLUMN IF NOT EXISTS "market" TEXT;

-- ── Goal (studioId, tercapai, tercapaiAt) ──
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "studioId" TEXT;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "tercapai" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "tercapaiAt" TIMESTAMP(3);

-- ── KanbanCard (kolomId, linkHasilKarya) ──
ALTER TABLE "KanbanCard" ADD COLUMN IF NOT EXISTS "kolomId" TEXT;
ALTER TABLE "KanbanCard" ADD COLUMN IF NOT EXISTS "linkHasilKarya" TEXT;

-- ── Rekrutmen (data calon lengkap + tombol jadikan anggota) ──
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "jenisKelamin" TEXT;
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "nomorWa" TEXT;
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "posisi" TEXT;
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "sudahJadiAnggota" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "tanggalLahir" TIMESTAMP(3);
ALTER TABLE "Rekrutmen" ADD COLUMN IF NOT EXISTS "telegramId" TEXT;

-- ── StudioMonthlyNote (tabel penuh, dari CPM & Dana di Luar Kas bulanan) ──
CREATE TABLE IF NOT EXISTS "StudioMonthlyNote" (
    "id"         TEXT NOT NULL,
    "studioId"   TEXT NOT NULL,
    "bulan"      INTEGER NOT NULL,
    "tahun"      INTEGER NOT NULL,
    "cpmBulanan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ekuitas"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioMonthlyNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudioMonthlyNote_studioId_bulan_tahun_key"
  ON "StudioMonthlyNote"("studioId", "bulan", "tahun");
DO $$ BEGIN
  ALTER TABLE "StudioMonthlyNote" ADD CONSTRAINT "StudioMonthlyNote_studioId_fkey"
    FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── MonthlyEcosystemData (tabel penuh, dari Dana PE/Forum/Berkah ekosistem) ──
CREATE TABLE IF NOT EXISTS "MonthlyEcosystemData" (
    "id"         TEXT NOT NULL,
    "bulan"      INTEGER NOT NULL,
    "tahun"      INTEGER NOT NULL,
    "danaPE"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "danaForum"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "danaBerkah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rumahUsaha" INTEGER NOT NULL DEFAULT 5,
    "catatan"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyEcosystemData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyEcosystemData_bulan_tahun_key"
  ON "MonthlyEcosystemData"("bulan", "tahun");

-- ── StudioRekening (tabel penuh, rekening bank studio) ──
CREATE TABLE IF NOT EXISTS "StudioRekening" (
    "id"            TEXT NOT NULL,
    "studioId"      TEXT NOT NULL,
    "namaBank"      TEXT NOT NULL,
    "nomorRekening" TEXT NOT NULL,
    "atasNama"      TEXT NOT NULL,
    "saldo"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioRekening_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "StudioRekening" ADD CONSTRAINT "StudioRekening_studioId_fkey"
    FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── KanbanColumn (tabel penuh, kolom kanban custom per studio) ──
CREATE TABLE IF NOT EXISTS "KanbanColumn" (
    "id"        TEXT NOT NULL,
    "studioId"  TEXT NOT NULL,
    "nama"      TEXT NOT NULL,
    "warna"     TEXT NOT NULL DEFAULT '#6B7280',
    "urutan"    INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KanbanColumn_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "KanbanColumn" ADD CONSTRAINT "KanbanColumn_studioId_fkey"
    FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Modul (tabel penuh, Bank Modul) ──
CREATE TABLE IF NOT EXISTS "Modul" (
    "id"        TEXT NOT NULL,
    "judul"     TEXT NOT NULL,
    "deskripsi" TEXT,
    "linkDrive" TEXT NOT NULL,
    "kategori"  TEXT NOT NULL,
    "aksesRole" TEXT NOT NULL DEFAULT 'SEMUA',
    "urutan"    INTEGER NOT NULL DEFAULT 0,
    "authorId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modul_pkey" PRIMARY KEY ("id")
);

-- ── DanaPengembanganTransaksi: waktu rename dari DanaPengembanganWithdraw, constraint PK-nya
--    kelewat gak ikut di-rename (beda dari FK yang sudah bener di migration sebelumnya), dan
--    default sementara tipe/kurs (dipasang buat backfill baris lama pas kolom baru ditambah)
--    belum pernah dilepas -- controller selalu isi keduanya secara eksplisit, aman dilepas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DanaPengembanganWithdraw_pkey') THEN
    ALTER TABLE "DanaPengembanganTransaksi" RENAME CONSTRAINT "DanaPengembanganWithdraw_pkey" TO "DanaPengembanganTransaksi_pkey";
  END IF;
END $$;
ALTER TABLE "DanaPengembanganTransaksi" ALTER COLUMN "tipe" DROP DEFAULT;
ALTER TABLE "DanaPengembanganTransaksi" ALTER COLUMN "kurs" DROP DEFAULT;

-- ── Memori (tabel penuh, Memori Institusional) ──
CREATE TABLE IF NOT EXISTS "Memori" (
    "id"        TEXT NOT NULL,
    "judul"     TEXT NOT NULL,
    "konten"    TEXT NOT NULL,
    "tipe"      TEXT NOT NULL DEFAULT 'Lainnya',
    "tanggal"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags"      TEXT,
    "authorId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memori_pkey" PRIMARY KEY ("id")
);
