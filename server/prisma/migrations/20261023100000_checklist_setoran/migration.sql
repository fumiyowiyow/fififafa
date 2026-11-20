-- CreateTable
CREATE TABLE "ChecklistSetor" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "marketerId" TEXT NOT NULL,
    "periode" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "transferId" TEXT,
    "catatan" TEXT,
    "selesaiPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistSetor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistSetor_studioId_periode_idx" ON "ChecklistSetor"("studioId", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistSetor_studioId_marketerId_periode_key" ON "ChecklistSetor"("studioId", "marketerId", "periode");

