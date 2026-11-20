-- Tautan Telegram lewat kode sekali pakai (14 Okt 2026), menggantikan "/daftar email" yang bisa
-- dipakai siapa pun untuk mengambil alih akun. Hanya hash kode + waktu kedaluwarsa yang disimpan.
ALTER TABLE "User" ADD COLUMN "telegramKodeHash" TEXT,
ADD COLUMN "telegramKodeKadaluarsa" TIMESTAMP(3);
