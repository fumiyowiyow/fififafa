-- Tambah value RUMAH_USAHA ke enum AnnouncementTarget (sejajar CIRCLE) -- file ini SENGAJA
-- cuma isi ALTER TYPE ADD VALUE doang, gak dicampur DDL lain, supaya bisa jalan normal lewat
-- `prisma migrate deploy` tanpa perlu script standalone terpisah.
ALTER TYPE "AnnouncementTarget" ADD VALUE IF NOT EXISTS 'RUMAH_USAHA';
