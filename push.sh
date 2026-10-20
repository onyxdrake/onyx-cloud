#!/data/data/com.termux/files/usr/bin/bash

cd "$(dirname "$0")"

echo "📦 Add semua file..."
git add -A

# Cek kalau ada perubahan
if git diff --cached --quiet; then
  echo "⚠️  Gak ada perubahan buat di-push."
  exit 0
fi

echo "💾 Commit..."
git commit -m "Auto-push: $(date +%Y-%m-%d_%H:%M:%S)"

echo "🚀 Push ke master..."
git push origin master

echo "✅ Selesai!"
