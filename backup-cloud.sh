#!/data/data/com.termux/files/usr/bin/bash
# Onyx Cloud — backup ke cloud

cd "$(dirname "$0")"

# Bikin backup lokal
./backup.sh

# Ambil backup terbaru
LATEST=$(ls -t backups/ | head -1)
TARBALL="/data/data/com.termux/files/usr/tmp/onyx-$LATEST.tar.gz"

echo "📦 Bikin tarball..."
tar -czf "$TARBALL" "backups/$LATEST" 2>/dev/null

SIZE=$(du -h "$TARBALL" 2>/dev/null | cut -f1)
echo "📊 Size: $SIZE"

echo "☁️  Upload ke cloud..."

# 1. transfer.sh (paling reliable)
URL=$(curl -s --max-time 60 --upload-file "$TARBALL" "https://transfer.sh/onyx-$LATEST.tar.gz" 2>/dev/null)
if [ -n "$URL" ] && echo "$URL" | grep -q "https://"; then
  echo "✅ Upload ke transfer.sh:"
  echo "$URL"
  echo ""
  echo "📝 Simpen URL ini! berlaku 14 hari."
  exit 0
fi

# 2. file.io (fallback — sekali download)
RESP=$(curl -s --max-time 60 -F "file=@$TARBALL" "https://file.io" 2>/dev/null)
URL=$(echo "$RESP" | grep -o '"link":"[^"]*"' | cut -d'"' -f4)
if [ -n "$URL" ]; then
  echo "✅ Upload ke file.io:"
  echo "$URL"
  echo ""
  echo "📝 Simpen URL ini! (sekali download doang)"
  exit 0
fi

# 3. 0x0.st (terakhir — butuh user-agent)
URL=$(curl -s --max-time 60 -A "Onyx-Backup/1.0" -F "file=@$TARBALL" "https://0x0.st" 2>/dev/null)
if [ -n "$URL" ] && echo "$URL" | grep -q "https://"; then
  echo "✅ Upload ke 0x0.st:"
  echo "$URL"
  echo ""
  echo "📝 Simpen URL ini!"
  exit 0
fi

echo "❌ Semua provider gagal. Backup lokal aja di:"
echo "$TARBALL"
