#!/bin/bash
# Backup PostgreSQL management-dashboard — jalankan via cron
# Cron (setiap hari jam 02:00 WIB = 19:00 UTC):
#   0 19 * * * /var/www/management-dashboard/server/scripts/backup-db.sh

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
BACKUP_DIR="/var/backups/management-dashboard"
KEEP_DAYS=14

# Enkripsi (22 Okt 2026 — docs/keamanan.md langkah 6, repo vokasi-dashboard): backup dikunci dengan kunci
# PUBLIK age sebelum disimpan & di-upload. Kunci pembukanya HANYA di laptop pemilik (+ salinan offline),
# jadi VPS/Google Drive yang bocor tidak membuka isinya. Tanpa berkas penerima → backup GAGAL (tidak
# pernah meng-upload versi terbuka). Membuka: age -d -i <kunci-rahasia> berkas.age > berkas
AGE_RECIPIENTS="/etc/backup-age/penerima.txt"
umask 077
GDRIVE_REMOTE="gdrive:management-dashboard-backups/db"

DATABASE_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2-)

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL tidak ditemukan di $ENV_FILE" >&2
  exit 1
fi

if [ ! -s "$AGE_RECIPIENTS" ] || ! command -v age >/dev/null; then
  echo "❌ Enkripsi belum siap: $AGE_RECIPIENTS kosong/tidak ada atau age belum terpasang" >&2
  exit 1
fi
mkdir -p "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz.age"

pg_dump "$DATABASE_URL" | gzip | age -R "$AGE_RECIPIENTS" > "$FILENAME"

if [ $? -eq 0 ] && [ -s "$FILENAME" ]; then
  echo "✅ Backup berhasil: $FILENAME ($(du -sh "$FILENAME" | cut -f1))"
else
  echo "❌ Backup gagal" >&2
  rm -f "$FILENAME"
  exit 1
fi

# Hapus backup lebih dari KEEP_DAYS hari
find "$BACKUP_DIR" -name "backup-*.sql.gz*" -mtime +$KEEP_DAYS -delete
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
