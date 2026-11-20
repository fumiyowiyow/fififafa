-- CreateEnum
CREATE TYPE "StatusKeanggotaan" AS ENUM ('KARYAWAN', 'MENTOR', 'MAGANG', 'SISWA_VOKASI', 'SISWA_KBU');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kelas" TEXT,
ADD COLUMN     "rekamJejak" TEXT,
ADD COLUMN     "sekolah" TEXT,
ADD COLUMN     "statusKeanggotaan" "StatusKeanggotaan",
ADD COLUMN     "tinggalDengan" TEXT;
