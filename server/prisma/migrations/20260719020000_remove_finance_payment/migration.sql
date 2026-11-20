-- Fitur Matrix Status Setoran (tab "Finance Tracker") dihapus karena dinilai tidak efisien.
-- FinancePost (daftar pos + rekening) TETAP ada, cuma FinancePayment (status bayar per
-- studio/pos/bulan) yang dihapus.
ALTER TABLE "FinancePayment" DROP CONSTRAINT IF EXISTS "FinancePayment_postId_fkey";
DROP TABLE "FinancePayment";
