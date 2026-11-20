-- Mesin alur detail (acuan OGS): gerbang QC, revisi internal, preview & revisi klien.
-- HANYA penambahan nilai enum di berkas ini (Postgres: tidak boleh dicampur DDL lain dalam satu transaksi).
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'QC';
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'REVISI_INTERNAL';
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'PREVIEW_KLIEN';
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'REVISI_KLIEN';
