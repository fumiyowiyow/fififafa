-- Fitur "Ekosistem Academy" dihapus total sesuai konfirmasi user: halaman & controller-nya
-- (client/src/pages/Academy, server/src/controllers/academy.js) gak pernah di-wire ke navigasi
-- manapun (bukan sengaja disembunyikan kayak Memori/AI -- 0 entry point), programnya sendiri
-- belum pernah benar-benar jalan. 3 baris ProgramPeserta yang programTipe-nya AKADEMI
-- dikonfirmasi bukan data penting (dicek lewat check-akademi.js), dihapus bareng
-- Penilaian terkait sebelum enum value-nya di-drop.

DELETE FROM "Penilaian"
WHERE "pesertaId" IN (SELECT "id" FROM "ProgramPeserta" WHERE "programTipe" = 'AKADEMI');

DELETE FROM "ProgramPeserta" WHERE "programTipe" = 'AKADEMI';

-- Hapus value AKADEMI dari enum JalurMasuk (0 baris Rekrutmen pakai, dikonfirmasi lewat
-- check-akademi.js).
CREATE TYPE "JalurMasuk_new" AS ENUM ('LIVE_IN', 'LANGSUNG', 'REFERRAL');
ALTER TABLE "Rekrutmen" ALTER COLUMN "jalurMasuk" TYPE "JalurMasuk_new" USING ("jalurMasuk"::text::"JalurMasuk_new");
ALTER TYPE "JalurMasuk" RENAME TO "JalurMasuk_old";
ALTER TYPE "JalurMasuk_new" RENAME TO "JalurMasuk";
DROP TYPE "JalurMasuk_old";

-- Hapus value AKADEMI dari enum ProgramTipe (sisa cuma KARIR_ANAK, yang masih aktif dipakai).
CREATE TYPE "ProgramTipe_new" AS ENUM ('KARIR_ANAK');
ALTER TABLE "ProgramPeserta" ALTER COLUMN "programTipe" TYPE "ProgramTipe_new" USING ("programTipe"::text::"ProgramTipe_new");
ALTER TYPE "ProgramTipe" RENAME TO "ProgramTipe_old";
ALTER TYPE "ProgramTipe_new" RENAME TO "ProgramTipe";
DROP TYPE "ProgramTipe_old";
