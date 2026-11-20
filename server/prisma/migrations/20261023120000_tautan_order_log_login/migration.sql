-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "tautan" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "LogLogin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "web" TEXT NOT NULL,
    "ip" TEXT,
    "perangkat" TEXT,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogLogin_userId_waktu_idx" ON "LogLogin"("userId", "waktu");

-- CreateIndex
CREATE INDEX "LogLogin_waktu_idx" ON "LogLogin"("waktu");

