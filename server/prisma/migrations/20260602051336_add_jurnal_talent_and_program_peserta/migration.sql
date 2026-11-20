-- CreateTable
CREATE TABLE "JurnalTalent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "penulisId" TEXT NOT NULL,
    "periodeAwal" TIMESTAMP(3) NOT NULL,
    "periodeAkhir" TIMESTAMP(3) NOT NULL,
    "perkembangan" TEXT NOT NULL,
    "pencapaian" TEXT,
    "kendala" TEXT,
    "targetMingguDepan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurnalTalent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JurnalTalent_userId_idx" ON "JurnalTalent"("userId");

-- CreateIndex
CREATE INDEX "JurnalTalent_penulisId_idx" ON "JurnalTalent"("penulisId");

-- AddForeignKey
ALTER TABLE "JurnalTalent" ADD CONSTRAINT "JurnalTalent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurnalTalent" ADD CONSTRAINT "JurnalTalent_penulisId_fkey" FOREIGN KEY ("penulisId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
