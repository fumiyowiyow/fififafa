-- CreateTable: PortfolioKarya — portofolio karya individu anggota (v3.4)
CREATE TABLE IF NOT EXISTS "PortfolioKarya" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "judul"     TEXT NOT NULL,
  "deskripsi" TEXT,
  "linkFile"  TEXT,
  "kategori"  TEXT,
  "tanggal"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioKarya_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PortfolioKarya"
  ADD CONSTRAINT "PortfolioKarya_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
