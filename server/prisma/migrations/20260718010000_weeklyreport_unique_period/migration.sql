-- Tutup race condition: 2 request submit laporan mingguan nyaris bersamaan (double-klik,
-- retry jaringan) bisa sama-sama lolos cek findFirst di controller dan menghasilkan 2 baris
-- WeeklyReport untuk studio+periode yang sama, bikin omset/pengeluaran bulanan ke-double-count
-- diam-diam. Unique index ini adalah penjaga terakhir di level database.
--
-- PENTING kalau migration ini gagal jalan (constraint violation): berarti SUDAH ADA data
-- duplikat di production untuk kombinasi studioId+periodeAwal yang sama. JANGAN dihapus
-- otomatis - cek dulu manual mana yang benar datanya, baru migration ini dijalankan ulang.
-- Query buat cek duplikat sebelum deploy:
--   SELECT "studioId", "periodeAwal", COUNT(*) FROM "WeeklyReport"
--   GROUP BY "studioId", "periodeAwal" HAVING COUNT(*) > 1;

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_studioId_periodeAwal_key" ON "WeeklyReport"("studioId", "periodeAwal");
