-- Freelancer per unit (13 Nov 2026, masukan tim): data freelancer milik unit pencatat; tampil ke unit lain di circle
-- HANYA bila "bagikan" dicentang (bawaan tidak — ada freelancer yang tidak mau dimunculkan ke studio lain).
ALTER TABLE "TalentEksternal" ADD COLUMN "studioId" TEXT;
ALTER TABLE "TalentEksternal" ADD COLUMN "bagikan" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "TalentEksternal_studioId_idx" ON "TalentEksternal"("studioId");
-- Data lama: unit pencatat = unit order pertama yang memakai freelancer itu (yang belum pernah dipakai order tetap kosong → diklaim unit yang pertama mengubahnya).
UPDATE "TalentEksternal" t SET "studioId" = x."studioId" FROM (
  SELECT DISTINCT ON (a."talentEksternalId") a."talentEksternalId" AS id, o."studioId"
  FROM "AssignmentProduksi" a JOIN "OrderProduksi" o ON o."id" = a."orderId"
  WHERE a."talentEksternalId" IS NOT NULL ORDER BY a."talentEksternalId", a."createdAt" ASC
) x WHERE t."id" = x.id;
