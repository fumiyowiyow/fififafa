-- AlterEnum
-- Role CO_ADMIN dihapus -- keputusan user 25 Juli 2026: Co-Admin dan Super Admin (ADVISOR di UI)
-- konsepnya sama-sama "pengelola aplikasi", cuma satu tingkat yang perlu ada (Super Admin),
-- dikonfirmasi lewat audit kode: SETIAP pengecekan akses di seluruh codebase yang menyertakan
-- CO_ADMIN SELALU menyertakan ADVISOR juga di array yang sama -- tidak ada satupun tempat yang
-- memperlakukan CO_ADMIN beda dari ADVISOR. Satu-satunya pemegang CO_ADMIN di production (Mella
-- Fitriansyah, u-mella) dinaikkan ke ADVISOR sebelum enum value-nya dihapus, supaya aksesnya
-- tidak berubah (persis pola migration 20260723000000_remove_ortu_academy_role -- Postgres tidak
-- dukung ALTER TYPE ... DROP VALUE, jadi enum di-rebuild total: buat tipe baru tanpa CO_ADMIN,
-- pindahkan kolom yang pakai, lalu ganti nama).
BEGIN;

UPDATE "UserRole" SET "roleType" = 'ADVISOR' WHERE "roleType" = 'CO_ADMIN';

CREATE TYPE "RoleType_new" AS ENUM ('ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA', 'ADMIN_FUNGSIONAL', 'PENDAMPING', 'KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG', 'PENGELOLA_DANA', 'DIGNITY', 'PENASIHAT');
ALTER TABLE "UserRole" ALTER COLUMN "roleType" TYPE "RoleType_new" USING ("roleType"::text::"RoleType_new");
ALTER TYPE "RoleType" RENAME TO "RoleType_old";
ALTER TYPE "RoleType_new" RENAME TO "RoleType";
DROP TYPE "RoleType_old";

COMMIT;
