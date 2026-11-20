-- CreateTable
CREATE TABLE "ProduksiSuperOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduksiSuperOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProduksiSuperOverride_userId_key" ON "ProduksiSuperOverride"("userId");

-- AddForeignKey
ALTER TABLE "ProduksiSuperOverride" ADD CONSTRAINT "ProduksiSuperOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
