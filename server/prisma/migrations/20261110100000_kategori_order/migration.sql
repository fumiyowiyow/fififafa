-- CreateTable
CREATE TABLE "KategoriOrder" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KategoriOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KategoriOrder_studioId_idx" ON "KategoriOrder"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "KategoriOrder_studioId_nama_key" ON "KategoriOrder"("studioId", "nama");
