-- CreateTable
CREATE TABLE "BayarRutin" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "sumber" TEXT NOT NULL,
    "sumberId" TEXT NOT NULL,
    "dibayarPada" DATE NOT NULL,
    "rekeningId" TEXT,
    "oleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BayarRutin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BayarRutin_studioId_bulan_sumber_sumberId_key" ON "BayarRutin"("studioId", "bulan", "sumber", "sumberId");
