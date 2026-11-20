-- CreateTable
CREATE TABLE "KategoriBiaya" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "khususManajemen" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KategoriBiaya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiayaStudio" (
    "id" TEXT NOT NULL,
    "studioId" TEXT,
    "kategori" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jatuhTempo" DATE,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "jumlahDibayar" DOUBLE PRECISION,
    "deskripsi" TEXT,
    "freelancer" TEXT,
    "tipe" TEXT,
    "statusBayar" TEXT NOT NULL DEFAULT 'BELUM',
    "persetujuan" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "dibayarPada" TIMESTAMP(3),
    "dibayarOleh" TEXT,
    "dibuatOlehId" TEXT,
    "dibuatOleh" TEXT,
    "linkInvoice" TEXT,
    "linkDrive" TEXT,
    "terkunci" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiayaStudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenarikanPendapatan" (
    "id" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "akunId" TEXT,
    "tanggal" DATE NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "dariPlatform" TEXT NOT NULL,
    "bankTujuan" TEXT NOT NULL,
    "atasNama" TEXT NOT NULL,
    "catatan" TEXT,
    "bulan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "dibuatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenarikanPendapatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferPendapatan" (
    "id" TEXT NOT NULL,
    "penarikanId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "dariBank" TEXT NOT NULL,
    "dariAtasNama" TEXT NOT NULL,
    "keRekening" TEXT NOT NULL DEFAULT 'Kas pusat',
    "catatan" TEXT,
    "bulan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
    "dibuatOleh" TEXT,
    "ditransferOleh" TEXT,
    "ditransferPada" TIMESTAMP(3),
    "dikonfirmasiOleh" TEXT,
    "dikonfirmasiPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferPendapatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendapatanTertahan" (
    "id" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "penarikanId" TEXT,
    "studioId" TEXT NOT NULL,
    "akunId" TEXT,
    "tanggal" DATE NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "bank" TEXT NOT NULL,
    "atasNama" TEXT NOT NULL,
    "dariPlatform" TEXT NOT NULL DEFAULT 'lainnya',
    "catatan" TEXT,
    "linkDrive" TEXT,
    "bulan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TERTAHAN',
    "transferId" TEXT,
    "dibuatOleh" TEXT,
    "dilepasOleh" TEXT,
    "dilepasPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendapatanTertahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DompetKas" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "pemegang" TEXT,
    "akhiran" TEXT,
    "mataUang" TEXT NOT NULL DEFAULT 'IDR',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DompetKas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutasiKas" (
    "id" TEXT NOT NULL,
    "dompetId" TEXT NOT NULL,
    "dompetLawanId" TEXT,
    "kunciImpor" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "tanggal" DATE,
    "tipe" TEXT NOT NULL,
    "arah" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "kategori" TEXT,
    "subkategori" TEXT,
    "deskripsi" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "mempengaruhiPl" BOOLEAN NOT NULL DEFAULT true,
    "rekonStatus" TEXT NOT NULL DEFAULT 'BELUM',
    "cocokTipe" TEXT,
    "cocokId" TEXT,
    "catatanRekon" TEXT,
    "direkonPada" TIMESTAMP(3),
    "direkonOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutasiKas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoPlatformBulanan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dibuatOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaldoPlatformBulanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoBankBulanan" (
    "id" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "namaRekening" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dibuatOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaldoBankBulanan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KategoriBiaya_nama_key" ON "KategoriBiaya"("nama");

-- CreateIndex
CREATE INDEX "BiayaStudio_studioId_tanggal_idx" ON "BiayaStudio"("studioId", "tanggal");

-- CreateIndex
CREATE INDEX "BiayaStudio_statusBayar_persetujuan_idx" ON "BiayaStudio"("statusBayar", "persetujuan");

-- CreateIndex
CREATE UNIQUE INDEX "PenarikanPendapatan_nomor_key" ON "PenarikanPendapatan"("nomor");

-- CreateIndex
CREATE INDEX "PenarikanPendapatan_studioId_bulan_idx" ON "PenarikanPendapatan"("studioId", "bulan");

-- CreateIndex
CREATE INDEX "TransferPendapatan_studioId_bulan_idx" ON "TransferPendapatan"("studioId", "bulan");

-- CreateIndex
CREATE INDEX "TransferPendapatan_status_idx" ON "TransferPendapatan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PendapatanTertahan_nomor_key" ON "PendapatanTertahan"("nomor");

-- CreateIndex
CREATE INDEX "PendapatanTertahan_studioId_bulan_idx" ON "PendapatanTertahan"("studioId", "bulan");

-- CreateIndex
CREATE INDEX "PendapatanTertahan_status_idx" ON "PendapatanTertahan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DompetKas_kode_key" ON "DompetKas"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "MutasiKas_kunciImpor_key" ON "MutasiKas"("kunciImpor");

-- CreateIndex
CREATE INDEX "MutasiKas_dompetId_bulan_idx" ON "MutasiKas"("dompetId", "bulan");

-- CreateIndex
CREATE INDEX "MutasiKas_bulan_rekonStatus_idx" ON "MutasiKas"("bulan", "rekonStatus");

-- CreateIndex
CREATE INDEX "MutasiKas_cocokTipe_cocokId_idx" ON "MutasiKas"("cocokTipe", "cocokId");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoPlatformBulanan_studioId_bulan_platform_key" ON "SaldoPlatformBulanan"("studioId", "bulan", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoBankBulanan_bulan_namaRekening_key" ON "SaldoBankBulanan"("bulan", "namaRekening");

-- AddForeignKey
ALTER TABLE "BiayaStudio" ADD CONSTRAINT "BiayaStudio_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenarikanPendapatan" ADD CONSTRAINT "PenarikanPendapatan_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferPendapatan" ADD CONSTRAINT "TransferPendapatan_penarikanId_fkey" FOREIGN KEY ("penarikanId") REFERENCES "PenarikanPendapatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendapatanTertahan" ADD CONSTRAINT "PendapatanTertahan_penarikanId_fkey" FOREIGN KEY ("penarikanId") REFERENCES "PenarikanPendapatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendapatanTertahan" ADD CONSTRAINT "PendapatanTertahan_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "TransferPendapatan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutasiKas" ADD CONSTRAINT "MutasiKas_dompetId_fkey" FOREIGN KEY ("dompetId") REFERENCES "DompetKas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutasiKas" ADD CONSTRAINT "MutasiKas_dompetLawanId_fkey" FOREIGN KEY ("dompetLawanId") REFERENCES "DompetKas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
