-- CreateTable
CREATE TABLE "RefleksiMingguan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mingguMulai" DATE NOT NULL,
    "kategori" TEXT NOT NULL,
    "tingkat" INTEGER NOT NULL,
    "hambatan" TEXT NOT NULL,
    "komitmen" TEXT,
    "perluDukungan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefleksiMingguan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KomentarRefleksi" (
    "id" TEXT NOT NULL,
    "refleksiId" TEXT NOT NULL,
    "penulisId" TEXT NOT NULL,
    "penulis" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KomentarRefleksi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefleksiMingguan_mingguMulai_idx" ON "RefleksiMingguan"("mingguMulai");

-- CreateIndex
CREATE UNIQUE INDEX "RefleksiMingguan_userId_mingguMulai_key" ON "RefleksiMingguan"("userId", "mingguMulai");

-- CreateIndex
CREATE INDEX "KomentarRefleksi_refleksiId_idx" ON "KomentarRefleksi"("refleksiId");

-- AddForeignKey
ALTER TABLE "KomentarRefleksi" ADD CONSTRAINT "KomentarRefleksi_refleksiId_fkey" FOREIGN KEY ("refleksiId") REFERENCES "RefleksiMingguan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

