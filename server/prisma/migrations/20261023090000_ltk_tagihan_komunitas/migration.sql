-- CreateTable
CREATE TABLE "KasusLtk" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "arah" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "studioId" TEXT NOT NULL,
    "akunId" TEXT,
    "namaPihak" TEXT NOT NULL,
    "jenisPihak" TEXT NOT NULL,
    "kontak" TEXT,
    "judul" TEXT NOT NULL,
    "kategori" TEXT,
    "deskripsi" TEXT,
    "anggaranCatatan" TEXT,
    "deadlineDiminta" DATE,
    "tautanRujukan" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hargaSepakat" DOUBLE PRECISION,
    "deadlineSepakat" DATE,
    "syarat" TEXT,
    "tautanHasil" TEXT,
    "pemasarId" TEXT,
    "dibuatOlehId" TEXT NOT NULL,
    "orderId" TEXT,
    "diajukanPada" TIMESTAMP(3),
    "dealPada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KasusLtk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatatanLtk" (
    "id" TEXT NOT NULL,
    "kasusId" TEXT NOT NULL,
    "penulisId" TEXT NOT NULL,
    "penulis" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatatanLtk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagihanKomunitas" (
    "id" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "klien" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "catatan" TEXT,
    "tautanBukti" TEXT,
    "ditagihPada" TIMESTAMP(3),
    "lunasPada" TIMESTAMP(3),
    "dibuatOlehId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagihanKomunitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagihanKomunitasItem" (
    "id" TEXT NOT NULL,
    "tagihanId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TagihanKomunitasItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KasusLtk_kode_key" ON "KasusLtk"("kode");

-- CreateIndex
CREATE INDEX "KasusLtk_studioId_status_idx" ON "KasusLtk"("studioId", "status");

-- CreateIndex
CREATE INDEX "KasusLtk_arah_status_idx" ON "KasusLtk"("arah", "status");

-- CreateIndex
CREATE INDEX "CatatanLtk_kasusId_idx" ON "CatatanLtk"("kasusId");

-- CreateIndex
CREATE UNIQUE INDEX "TagihanKomunitas_nomor_key" ON "TagihanKomunitas"("nomor");

-- CreateIndex
CREATE INDEX "TagihanKomunitas_studioId_status_idx" ON "TagihanKomunitas"("studioId", "status");

-- CreateIndex
CREATE INDEX "TagihanKomunitasItem_tagihanId_idx" ON "TagihanKomunitasItem"("tagihanId");

-- CreateIndex
CREATE INDEX "TagihanKomunitasItem_orderId_idx" ON "TagihanKomunitasItem"("orderId");

-- AddForeignKey
ALTER TABLE "CatatanLtk" ADD CONSTRAINT "CatatanLtk_kasusId_fkey" FOREIGN KEY ("kasusId") REFERENCES "KasusLtk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagihanKomunitasItem" ADD CONSTRAINT "TagihanKomunitasItem_tagihanId_fkey" FOREIGN KEY ("tagihanId") REFERENCES "TagihanKomunitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

