#!/data/data/com.termux/files/usr/bin/bash

# Load .env
source .env 2>/dev/null

if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_REPO" ]; then
  echo "❌ GITHUB_TOKEN atau GITHUB_REPO kosong"
  exit 1
fi

# Set remote
git remote set-url origin https://onyxdrake:$GITHUB_TOKEN@github.com/$GITHUB_REPO.git

# Push ke master
git add -A
git commit -m "Auto-push: $(date +%Y-%m-%d_%H:%M:%S)" 2>/dev/null
git push origin master

echo "✅ Push ke master"
