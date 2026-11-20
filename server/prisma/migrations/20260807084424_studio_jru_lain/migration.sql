-- CreateTable
CREATE TABLE "StudioJruLain" (
    "id" TEXT NOT NULL,
    "circle" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioJruLain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioJruLain_circle_nama_key" ON "StudioJruLain"("circle", "nama");
