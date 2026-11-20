-- Penerbit invoice per unit (9 Nov 2026): nama penerbit, rekening penerima & catatan kaki yang diisi koordinator di web circle.
-- Terpisah dari StudioRekening Ekosistem (rekening Ekosistem tetap tidak dikirim ke web circle).
CREATE TABLE "PengaturanInvoice" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "namaPenerbit" TEXT,
    "rekening" TEXT,
    "catatanKaki" TEXT,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PengaturanInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PengaturanInvoice_studioId_key" ON "PengaturanInvoice"("studioId");
