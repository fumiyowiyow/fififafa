-- Satu siswa bisa punya beberapa mentor (13 Okt 2026): User.mentorId -> tabel MentorSiswa.
-- Mentor yang sudah ditunjuk dipindahkan dulu, baru kolom lamanya dihapus.

-- CreateTable
CREATE TABLE "MentorSiswa" (
    "siswaId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorSiswa_pkey" PRIMARY KEY ("siswaId","mentorId")
);

-- CreateIndex
CREATE INDEX "MentorSiswa_mentorId_idx" ON "MentorSiswa"("mentorId");

-- AddForeignKey
ALTER TABLE "MentorSiswa" ADD CONSTRAINT "MentorSiswa_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorSiswa" ADD CONSTRAINT "MentorSiswa_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pindahkan mentor lama
INSERT INTO "MentorSiswa" ("siswaId", "mentorId")
SELECT "id", "mentorId" FROM "User" WHERE "mentorId" IS NOT NULL;

-- DropForeignKey + kolom lama
ALTER TABLE "User" DROP CONSTRAINT "User_mentorId_fkey";
ALTER TABLE "User" DROP COLUMN "mentorId";
