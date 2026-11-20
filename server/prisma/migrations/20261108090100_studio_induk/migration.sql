-- Unit di bawah Korporasi: Studio.indukId -> Studio.id
ALTER TABLE "Studio" ADD COLUMN "indukId" TEXT;
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_indukId_fkey" FOREIGN KEY ("indukId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
