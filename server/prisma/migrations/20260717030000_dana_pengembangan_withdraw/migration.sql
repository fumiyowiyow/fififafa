-- CreateTable
CREATE TABLE "DanaPengembanganWithdraw" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jumlahUsd" DOUBLE PRECISION NOT NULL,
    "keterangan" TEXT,
    "dicatatOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DanaPengembanganWithdraw_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DanaPengembanganWithdraw" ADD CONSTRAINT "DanaPengembanganWithdraw_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "DanaPengembanganUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
