-- CreateTable
CREATE TABLE "HariLiburKerja" (
    "id" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "nama" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HariLiburKerja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HariLiburKerja_tanggal_key" ON "HariLiburKerja"("tanggal");
