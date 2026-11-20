-- AlterTable
ALTER TABLE "HariLiburKerja" ADD COLUMN     "catatan" TEXT,
ADD COLUMN     "jenis" TEXT NOT NULL DEFAULT 'LIBUR';

-- CreateTable
CREATE TABLE "KehadiranEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tanggalKerja" DATE NOT NULL,
    "jenis" TEXT NOT NULL,
    "jenisKeluar" TEXT,
    "modeKerja" TEXT,
    "lokasiWfa" TEXT,
    "dicatatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "catatan" TEXT,

    CONSTRAINT "KehadiranEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CutiKehadiran" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "mulai" DATE NOT NULL,
    "selesai" DATE NOT NULL,
    "durasi" TEXT NOT NULL DEFAULT 'SEHARI',
    "alasan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "ditinjauOlehId" TEXT,
    "ditinjauOleh" TEXT,
    "ditinjauPada" TIMESTAMP(3),
    "catatanPeninjau" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CutiKehadiran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LemburKehadiran" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tanggalKerja" DATE NOT NULL,
    "sumber" TEXT NOT NULL,
    "mulai" TIMESTAMP(3) NOT NULL,
    "selesai" TIMESTAMP(3) NOT NULL,
    "menit" INTEGER NOT NULL,
    "catatan" TEXT,

    CONSTRAINT "LemburKehadiran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInHarian" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "emosi" TEXT,
    "intensitas" INTEGER,
    "kejernihan" INTEGER,
    "fokusPikiran" TEXT,
    "kebutuhan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInHarian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaraKalender" (
    "id" TEXT NOT NULL,
    "lingkupJenis" TEXT NOT NULL,
    "lingkupId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "seharian" BOOLEAN NOT NULL DEFAULT false,
    "mulai" TEXT,
    "selesai" TEXT,
    "lokasi" TEXT,
    "deskripsi" TEXT,
    "berulang" TEXT,
    "berulangDihentikan" DATE,
    "dibuatOlehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcaraKalender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KehadiranEvent_userId_tanggalKerja_idx" ON "KehadiranEvent"("userId", "tanggalKerja");

-- CreateIndex
CREATE INDEX "KehadiranEvent_tanggalKerja_jenis_idx" ON "KehadiranEvent"("tanggalKerja", "jenis");

-- CreateIndex
CREATE INDEX "CutiKehadiran_userId_mulai_selesai_idx" ON "CutiKehadiran"("userId", "mulai", "selesai");

-- CreateIndex
CREATE INDEX "CutiKehadiran_status_mulai_idx" ON "CutiKehadiran"("status", "mulai");

-- CreateIndex
CREATE INDEX "LemburKehadiran_userId_tanggalKerja_idx" ON "LemburKehadiran"("userId", "tanggalKerja");

-- CreateIndex
CREATE INDEX "CheckInHarian_tanggal_status_idx" ON "CheckInHarian"("tanggal", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInHarian_userId_tanggal_key" ON "CheckInHarian"("userId", "tanggal");

-- CreateIndex
CREATE INDEX "AcaraKalender_lingkupJenis_lingkupId_tanggal_idx" ON "AcaraKalender"("lingkupJenis", "lingkupId", "tanggal");
