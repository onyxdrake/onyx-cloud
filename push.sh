#!/data/data/com.termux/files/usr/bin/bash

# Load .env
source .env 2>/dev/null

# Cek token
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN gak ada di .env"
  exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
  echo "❌ GITHUB_REPO gak ada di .env"
  exit 1
fi

# Set remote pake token
git remote set-url origin https://onyxdrake:$GITHUB_TOKEN@github.com/$GITHUB_REPO.git

# Push ke branch gh-pages
git add -A
git commit -m "Auto-push: $(date +%Y-%m-%d_%H:%M:%S)" 2>/dev/null
git push origin gh-pages

echo "✅ Push berhasil ke gh-pages"
