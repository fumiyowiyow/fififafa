-- AlterTable
ALTER TABLE "BiayaStudio" ADD COLUMN "assignmentId" TEXT;

-- CreateIndex
CREATE INDEX "BiayaStudio_assignmentId_idx" ON "BiayaStudio"("assignmentId");
