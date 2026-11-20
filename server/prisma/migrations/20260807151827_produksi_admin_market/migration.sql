-- CreateTable
CREATE TABLE "ProduksiAdminMarket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduksiAdminMarket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProduksiAdminMarket_userId_studioId_key" ON "ProduksiAdminMarket"("userId", "studioId");

-- AddForeignKey
ALTER TABLE "ProduksiAdminMarket" ADD CONSTRAINT "ProduksiAdminMarket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduksiAdminMarket" ADD CONSTRAINT "ProduksiAdminMarket_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
