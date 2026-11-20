-- AlterTable
-- skbUrl sudah ditambahkan langsung ke production sebelumnya (tanpa migration resmi, sekitar 14 Juni 2026).
-- Pakai IF NOT EXISTS supaya migration ini aman dijalankan baik di production (kolom sudah ada, no-op)
-- maupun di environment baru yang di-setup dari nol (kolom belum ada, dibuat).
ALTER TABLE "Studio" ADD COLUMN IF NOT EXISTS "skbUrl" TEXT;
