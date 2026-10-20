#!/data/data/com.termux/files/usr/bin/bash
# Onyx Cloud — backup robust

set -e
cd "$(dirname "$0")"

BACKUP_NAME="onyx-backup-$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="backups/$BACKUP_NAME"

echo "📦 Backup ke $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Copy core files (pake rsync kalau ada, cp kalau gak)
copy_safe() {
  local src="$1"
  local dst="$2"
  if [ -e "$src" ]; then
    cp -r "$src" "$dst/" 2>/dev/null || true
  fi
}

copy_safe core "$BACKUP_DIR"
copy_safe api "$BACKUP_DIR"
copy_safe tools "$BACKUP_DIR"
copy_safe public "$BACKUP_DIR"
copy_safe js "$BACKUP_DIR"
copy_safe docs "$BACKUP_DIR"
copy_safe bot "$BACKUP_DIR"
copy_safe services "$BACKUP_DIR"
copy_safe games "$BACKUP_DIR"
copy_safe data "$BACKUP_DIR"

# Copy file root
for f in *.js *.sh *.html *.json *.md; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" 2>/dev/null || true
done

# Backup .env (hidden)
[ -f .env ] && cp .env "$BACKUP_DIR/.env.backup"

# Hapus backup > 7 hari, simpen max 5
find backups/ -maxdepth 1 -type d -name "onyx-backup-*" -mtime +7 -exec rm -rf {} \; 2>/dev/null

# Simpen max 5 backup
COUNT=$(ls backups/ | wc -l)
if [ "$COUNT" -gt 5 ]; then
  ls -t backups/ | tail -n +6 | while read dir; do
    rm -rf "backups/$dir"
  done
fi

SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
FILES=$(find "$BACKUP_DIR" -type f | wc -l)
echo "✅ Backup: $BACKUP_DIR"
echo "📊 Size: $SIZE | Files: $FILES"
