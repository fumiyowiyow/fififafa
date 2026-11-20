-- AlterEnum
-- Role ORTU_ACADEMY dihapus (sudah tidak relevan, dan dikonfirmasi 0 baris UserRole yang
-- memakainya di production sebelum migration ini dibuat -- lihat query verifikasi tanggal
-- 23 Juli 2026). Postgres tidak dukung ALTER TYPE ... DROP VALUE, jadi enum di-rebuild:
-- buat tipe baru tanpa ORTU_ACADEMY, pindahkan kolom yang pakai, lalu ganti nama.
BEGIN;
CREATE TYPE "RoleType_new" AS ENUM ('ADVISOR', 'KEPALA_EKOSISTEM', 'CO_ADMIN', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL', 'PENDAMPING', 'KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG', 'PENGELOLA_DANA', 'DIGNITY');
ALTER TABLE "UserRole" ALTER COLUMN "roleType" TYPE "RoleType_new" USING ("roleType"::text::"RoleType_new");
ALTER TYPE "RoleType" RENAME TO "RoleType_old";
ALTER TYPE "RoleType_new" RENAME TO "RoleType";
DROP TYPE "RoleType_old";
COMMIT;
