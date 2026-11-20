-- Rumah Usaha jadi unit organisasi sejajar/independen dari Circle (bukan bertingkat di
-- dalamnya) -- Studio milik SALAH SATU (circleId ATAU rumahUsahaId), divalidasi di controller.
--
-- CATATAN PENTING: enum value baru RoleType.KEPALA_RUMAH_USAHA TIDAK ada di migration ini --
-- itu harus dijalankan MANUAL lewat migrate-add-kepala-rumah-usaha.js SEBELUM
-- `prisma migrate deploy`, karena Postgres tidak izinkan ALTER TYPE ... ADD VALUE dalam
-- transaction yang sama dengan DDL lain.

-- 1. Studio.circleId jadi nullable (studio boleh gak punya circle kalau dia di Rumah Usaha).
--    FK lama dibuat waktu circleId masih wajib (ON DELETE RESTRICT) -- direcreate ON DELETE
--    SET NULL supaya konsisten sama semantik "opsional" yang baru (walau saat ini belum ada
--    endpoint hapus circle, ini menghindari drift diam-diam dari schema.prisma).
ALTER TABLE "Studio" DROP CONSTRAINT "Studio_circleId_fkey";
ALTER TABLE "Studio" ALTER COLUMN "circleId" DROP NOT NULL;
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_circleId_fkey"
  FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Studio.rumahUsahaId (baru, nullable)
ALTER TABLE "Studio" ADD COLUMN "rumahUsahaId" TEXT;
ALTER TABLE "Studio" ADD CONSTRAINT "Studio_rumahUsahaId_fkey"
  FOREIGN KEY ("rumahUsahaId") REFERENCES "RumahUsaha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. UserRole.rumahUsahaId (baru, nullable) -- paralel circleId, buat scoping role
--    KEPALA_RUMAH_USAHA
ALTER TABLE "UserRole" ADD COLUMN "rumahUsahaId" TEXT;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_rumahUsahaId_fkey"
  FOREIGN KEY ("rumahUsahaId") REFERENCES "RumahUsaha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. RumahUsaha dapat kepalId + colorHex (dulu cuma nama/deskripsi, sekarang jadi unit
--    organisasi beneran, bukan cuma entitas pencatatan dana flat)
ALTER TABLE "RumahUsaha" ADD COLUMN "kepalId" TEXT;
ALTER TABLE "RumahUsaha" ADD COLUMN "colorHex" TEXT;
