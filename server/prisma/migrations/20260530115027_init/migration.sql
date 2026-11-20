-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('ADVISOR', 'KEPALA_EKOSISTEM', 'CO_ADMIN', 'KEPALA_CIRCLE', 'ADMIN_FUNGSIONAL', 'KOORDINATOR', 'KARYAWAN', 'MAGANG', 'ORTU_ACADEMY');

-- CreateEnum
CREATE TYPE "StudioTipe" AS ENUM ('STUDIO', 'PROJECT');

-- CreateEnum
CREATE TYPE "FinancePostTipe" AS ENUM ('INTERNAL', 'EKSTERNAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('LUNAS', 'BELUM', 'NUNGGAK');

-- CreateEnum
CREATE TYPE "KanbanStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "JalurMasuk" AS ENUM ('AKADEMI', 'LIVE_IN', 'LANGSUNG', 'REFERRAL');

-- CreateEnum
CREATE TYPE "RekrutmenStatus" AS ENUM ('PENDAFTARAN', 'SELEKSI', 'DITERIMA', 'DITOLAK');

-- CreateEnum
CREATE TYPE "ProgramTipe" AS ENUM ('AKADEMI', 'KARIR_ANAK');

-- CreateEnum
CREATE TYPE "AnnouncementTarget" AS ENUM ('ALL', 'CIRCLE', 'STUDIO');

-- CreateEnum
CREATE TYPE "AssetTipe" AS ENUM ('PERALATAN', 'SOFTWARE', 'AKUN_MARKETPLACE');

-- CreateEnum
CREATE TYPE "TelegramGrupTipe" AS ENUM ('GENERAL', 'WEEKLY_OMZET', 'STUDIO', 'PENDAMPINGAN', 'ANGGOTA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "telegramId" TEXT,
    "tanggalMasuk" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleType" "RoleType" NOT NULL,
    "circleId" TEXT,
    "studioId" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kepalId" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "tipe" "StudioTipe" NOT NULL,
    "niche" TEXT,
    "koordinatorId" TEXT,
    "cpmTarget" DOUBLE PRECISION,
    "tanggalBerdiri" TIMESTAMP(3),
    "statusAktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeAwal" TIMESTAMP(3) NOT NULL,
    "periodeAkhir" TIMESTAMP(3) NOT NULL,
    "omsetFiverr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "omsetEtsy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "omsetUpwork" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "omsetVgen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "omsetKomunitas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "omsetLainnya" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kurs" DOUBLE PRECISION NOT NULL DEFAULT 15800,
    "kasSekarang" DOUBLE PRECISION NOT NULL,
    "pengeluaran" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kendala" TEXT,
    "skorSemangat" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePost" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tipe" "FinancePostTipe" NOT NULL,
    "circleId" TEXT,

    CONSTRAINT "FinancePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayment" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'BELUM',
    "tanggalKonfirmasi" TIMESTAMP(3),
    "dikonfirmasiOleh" TEXT,

    CONSTRAINT "FinancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KoperasiSimpanan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bulan" INTEGER NOT NULL,
    "tahun" INTEGER NOT NULL,
    "pokok" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wajib" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sukarela" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'BELUM',

    CONSTRAINT "KoperasiSimpanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanCard" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "platform" TEXT,
    "nilaiOrder" DOUBLE PRECISION,
    "deadline" TIMESTAMP(3),
    "assigneeId" TEXT,
    "status" "KanbanStatus" NOT NULL DEFAULT 'TODO',
    "linkBrief" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaderTimeline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipeEvent" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "dicatatOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rekrutmen" (
    "id" TEXT NOT NULL,
    "namaCalon" TEXT NOT NULL,
    "jalurMasuk" "JalurMasuk" NOT NULL,
    "referralDari" TEXT,
    "studioTujuan" TEXT,
    "status" "RekrutmenStatus" NOT NULL DEFAULT 'PENDAFTARAN',
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rekrutmen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramPeserta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programTipe" "ProgramTipe" NOT NULL,
    "programId" TEXT,
    "mentorId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "ortuNama" TEXT,
    "ortuTelegram" TEXT,
    "tanggalMasuk" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetSelesai" TIMESTAMP(3),

    CONSTRAINT "ProgramPeserta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penilaian" (
    "id" TEXT NOT NULL,
    "pesertaId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "periode" TIMESTAMP(3) NOT NULL,
    "kpiData" JSONB NOT NULL,
    "skorKeaktifan" INTEGER,
    "skorDisiplin" INTEGER,
    "skorPenyerapan" INTEGER,
    "catatanNaratif" TEXT,
    "lampiranUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penilaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "circleId" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "satuan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "userId" TEXT,
    "tipe" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "dibuatOleh" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "konten" TEXT NOT NULL,
    "targetTipe" "AnnouncementTarget" NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" "AssetTipe" NOT NULL,
    "keterangan" TEXT,
    "pemegangId" TEXT,
    "masaAktif" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'aktif',

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramGroup" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "circleId" TEXT,
    "tipeGrup" "TelegramGrupTipe" NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "namaGrup" TEXT NOT NULL,

    CONSTRAINT "TelegramGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayment_studioId_postId_bulan_tahun_key" ON "FinancePayment"("studioId", "postId", "bulan", "tahun");

-- CreateIndex
CREATE UNIQUE INDEX "KoperasiSimpanan_userId_bulan_tahun_key" ON "KoperasiSimpanan"("userId", "bulan", "tahun");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramGroup_telegramChatId_key" ON "TelegramGroup"("telegramChatId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayment" ADD CONSTRAINT "FinancePayment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FinancePost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penilaian" ADD CONSTRAINT "Penilaian_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "ProgramPeserta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
