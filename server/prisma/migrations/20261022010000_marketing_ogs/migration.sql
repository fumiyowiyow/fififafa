-- Marketing (adaptasi OGS) di atas entitas Ekosistem. Tidak menyentuh keuangan/omset.
ALTER TABLE "MarketingLead" ADD COLUMN "platform" TEXT, ADD COLUMN "akunId" TEXT;

CREATE TABLE "PenugasanAkunMarketer" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "akunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PenugasanAkunMarketer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AktivitasMarketer" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "studioId" TEXT NOT NULL, "tanggal" DATE NOT NULL,
    "jenis" TEXT NOT NULL, "akunId" TEXT, "judul" TEXT, "platform" TEXT, "jamPosting" TEXT, "link" TEXT,
    "targetAkun" TEXT, "pengikut" INTEGER, "hasil" TEXT, "jumlah" INTEGER NOT NULL DEFAULT 1,
    "selesai" BOOLEAN NOT NULL DEFAULT false, "selesaiPada" TIMESTAMP(3), "catatan" TEXT, "dibuatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AktivitasMarketer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TargetMarketing" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "akunId" TEXT NOT NULL, "bulan" INTEGER NOT NULL, "tahun" INTEGER NOT NULL,
    "post" INTEGER NOT NULL DEFAULT 0, "reply" INTEGER NOT NULL DEFAULT 0, "update" INTEGER NOT NULL DEFAULT 0, "seo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TargetMarketing_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProfilSosialMarketer" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "platform" TEXT NOT NULL, "link" TEXT NOT NULL, "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfilSosialMarketer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LogHarianMarketer" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tanggal" DATE NOT NULL, "mood" TEXT NOT NULL, "catatan" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogHarianMarketer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PenugasanAkunMarketer_userId_akunId_key" ON "PenugasanAkunMarketer"("userId", "akunId");
CREATE INDEX "AktivitasMarketer_userId_tanggal_idx" ON "AktivitasMarketer"("userId", "tanggal");
CREATE INDEX "AktivitasMarketer_studioId_tanggal_idx" ON "AktivitasMarketer"("studioId", "tanggal");
CREATE INDEX "AktivitasMarketer_akunId_tanggal_idx" ON "AktivitasMarketer"("akunId", "tanggal");
CREATE UNIQUE INDEX "TargetMarketing_userId_akunId_bulan_tahun_key" ON "TargetMarketing"("userId", "akunId", "bulan", "tahun");
CREATE INDEX "ProfilSosialMarketer_userId_idx" ON "ProfilSosialMarketer"("userId");
CREATE UNIQUE INDEX "LogHarianMarketer_userId_tanggal_key" ON "LogHarianMarketer"("userId", "tanggal");

ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_akunId_fkey" FOREIGN KEY ("akunId") REFERENCES "AkunProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PenugasanAkunMarketer" ADD CONSTRAINT "PenugasanAkunMarketer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PenugasanAkunMarketer" ADD CONSTRAINT "PenugasanAkunMarketer_akunId_fkey" FOREIGN KEY ("akunId") REFERENCES "AkunProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AktivitasMarketer" ADD CONSTRAINT "AktivitasMarketer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AktivitasMarketer" ADD CONSTRAINT "AktivitasMarketer_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AktivitasMarketer" ADD CONSTRAINT "AktivitasMarketer_akunId_fkey" FOREIGN KEY ("akunId") REFERENCES "AkunProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TargetMarketing" ADD CONSTRAINT "TargetMarketing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TargetMarketing" ADD CONSTRAINT "TargetMarketing_akunId_fkey" FOREIGN KEY ("akunId") REFERENCES "AkunProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfilSosialMarketer" ADD CONSTRAINT "ProfilSosialMarketer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogHarianMarketer" ADD CONSTRAINT "LogHarianMarketer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
