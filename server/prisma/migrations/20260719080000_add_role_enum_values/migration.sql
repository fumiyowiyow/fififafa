-- Nilai enum RoleType ini SUDAH ada di production (ditambahkan manual lewat script standalone
-- migrate-roles-v4.js/v5.js dan migrate-add-kepala-rumah-usaha.js, karena Postgres tidak izinkan
-- ALTER TYPE ... ADD VALUE dicampur DDL lain dalam satu transaction) -- migration ini cuma
-- nyusulin biar riwayat migration lengkap & `prisma migrate deploy` dari nol beneran cukup,
-- gak perlu script manual lagi. IF NOT EXISTS jadi no-op aman di production yang udah punya
-- nilai-nilai ini.
--
-- CATATAN buat penambahan RoleType berikutnya: taruh HANYA statement ALTER TYPE ADD VALUE di
-- migration-nya sendiri (gak dicampur ALTER TABLE/CREATE TABLE dll) -- terbukti aman dijalankan
-- lewat `prisma migrate deploy` normal, TIDAK perlu script standalone terpisah lagi.
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'KEPALA_RUMAH_USAHA';
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'PENDAMPING';
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'KADER';
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'PENGELOLA_DANA';
