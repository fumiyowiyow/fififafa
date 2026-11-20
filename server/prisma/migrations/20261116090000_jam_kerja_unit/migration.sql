-- Jam kerja per unit + pulang otomatis (16 Nov 2026, masukan tim)
ALTER TABLE "KehadiranEvent" ADD COLUMN "studioId" TEXT;
ALTER TABLE "KehadiranEvent" ADD COLUMN "otomatis" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "JamKerjaUnit" (
    "studioId" TEXT NOT NULL,
    "jadwal" JSONB NOT NULL,
    "pulangOtomatis" BOOLEAN NOT NULL DEFAULT false,
    "batasPulang" TEXT,
    "aktifSejak" TIMESTAMP(3),
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JamKerjaUnit_pkey" PRIMARY KEY ("studioId")
);
