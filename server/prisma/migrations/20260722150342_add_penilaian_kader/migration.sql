-- CreateTable
CREATE TABLE "PenilaianKader" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "penilaiId" TEXT NOT NULL,
    "tanggalPenilaian" TIMESTAMP(3) NOT NULL,
    "skorKehadiran" INTEGER NOT NULL,
    "skorKetepatanWaktu" INTEGER NOT NULL,
    "skorAdab" INTEGER NOT NULL,
    "skorKejujuran" INTEGER NOT NULL,
    "skorMenerimaMasukan" INTEGER NOT NULL,
    "skorKualitasKerja" INTEGER NOT NULL,
    "skorPenguasaanSkill" INTEGER NOT NULL,
    "skorInisiatif" INTEGER NOT NULL,
    "skorKerjaSama" INTEGER NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenilaianKader_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PenilaianKader_userId_idx" ON "PenilaianKader"("userId");

-- CreateIndex
CREATE INDEX "PenilaianKader_penilaiId_idx" ON "PenilaianKader"("penilaiId");

-- AddForeignKey
ALTER TABLE "PenilaianKader" ADD CONSTRAINT "PenilaianKader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenilaianKader" ADD CONSTRAINT "PenilaianKader_penilaiId_fkey" FOREIGN KEY ("penilaiId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
