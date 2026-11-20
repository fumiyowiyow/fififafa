#!/bin/bash
set -o pipefail
# Backup folder server/uploads/ (kanban hasil karya + SKB studio) — jalankan via cron
# File ini disimpan lokal di VPS dan TIDAK ikut git, jadi tidak ter-backup lewat repo.
# Cron (setiap hari jam 02:05 WIB = 19:05 UTC, 5 menit setelah backup-db.sh):
#   5 19 * * * /var/www/management-dashboard/server/scripts/backup-uploads.sh

SRC_DIR="/var/www/management-dashboard/server/uploads"
BACKUP_DIR="/var/backups/management-dashboard-uploads"
KEEP_DAYS=14

# Enkripsi (22 Okt 2026 — docs/keamanan.md langkah 6, repo vokasi-dashboard): backup dikunci dengan kunci
# PUBLIK age sebelum disimpan & di-upload. Kunci pembukanya HANYA di laptop pemilik (+ salinan offline),
# jadi VPS/Google Drive yang bocor tidak membuka isinya. Tanpa berkas penerima → backup GAGAL (tidak
# pernah meng-upload versi terbuka). Membuka: age -d -i <kunci-rahasia> berkas.age > berkas
AGE_RECIPIENTS="/etc/backup-age/penerima.txt"
umask 077
GDRIVE_REMOTE="gdrive:management-dashboard-backups/uploads"

if [ ! -d "$SRC_DIR" ]; then
  echo "⚠️  $SRC_DIR tidak ditemukan, skip backup"
  exit 0
fi

if [ ! -s "$AGE_RECIPIENTS" ] || ! command -v age >/dev/null; then
  echo "❌ Enkripsi belum siap: $AGE_RECIPIENTS kosong/tidak ada atau age belum terpasang" >&2
  exit 1
fi
mkdir -p "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/uploads-$(date +%Y%m%d-%H%M%S).tar.gz.age"

tar -czf - -C "$(dirname "$SRC_DIR")" "$(basename "$SRC_DIR")" | age -R "$AGE_RECIPIENTS" > "$FILENAME"

if [ $? -eq 0 ]; then
  echo "✅ Backup berhasil: $FILENAME ($(du -sh $FILENAME | cut -f1))"
else
  echo "❌ Backup gagal" >&2
  exit 1
fi

# Hapus backup lebih dari KEEP_DAYS hari
find "$BACKUP_DIR" -name "uploads-*.tar.gz*" -mtime +$KEEP_DAYS -delete
echo "🗑️  Backup lama (>$KEEP_DAYS hari) dihapus"

# Push ke Google Drive (off-site, gak tergantung VPS)
if command -v rclone >/dev/null; then
  rclone copy "$FILENAME" "$GDRIVE_REMOTE" --quiet
  if [ $? -eq 0 ]; then
    echo "☁️  Ter-upload ke Google Drive: $GDRIVE_REMOTE"
  else
    echo "❌ Gagal upload ke Google Drive" >&2
  fi
  rclone delete "$GDRIVE_REMOTE" --min-age "${KEEP_DAYS}d" --quiet
fi
