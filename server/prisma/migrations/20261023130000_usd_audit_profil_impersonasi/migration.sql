-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "kurs" DOUBLE PRECISION,
ADD COLUMN     "mataUang" TEXT NOT NULL DEFAULT 'IDR',
ADD COLUMN     "nilaiUsd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AuditOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "nama" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "field" TEXT,
    "dari" TEXT,
    "ke" TEXT,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilSdm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "posisiSekarang" TEXT,
    "posisiBerikut" TEXT,
    "catatan" TEXT,
    "diubahOlehId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilSdm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogImpersonasi" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "web" TEXT NOT NULL,
    "alasan" TEXT,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogImpersonasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditOrder_orderId_waktu_idx" ON "AuditOrder"("orderId", "waktu");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilSdm_userId_key" ON "ProfilSdm"("userId");

-- CreateIndex
CREATE INDEX "LogImpersonasi_adminId_waktu_idx" ON "LogImpersonasi"("adminId", "waktu");

-- CreateIndex
CREATE INDEX "LogImpersonasi_targetId_waktu_idx" ON "LogImpersonasi"("targetId", "waktu");

-- AddForeignKey
ALTER TABLE "AuditOrder" ADD CONSTRAINT "AuditOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

