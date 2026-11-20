-- Mesin alur v2 (acuan OGS: fase Klien, Finalisasi, Delivery). HANYA nilai enum di berkas ini.
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'MENUNGGU_KLIEN';
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'FINALISASI';
ALTER TYPE "JenisTahap" ADD VALUE IF NOT EXISTS 'DELIVERY';
