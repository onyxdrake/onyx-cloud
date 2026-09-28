#!/data/data/com.termux/files/usr/bin/bash

source .env 2>/dev/null

if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_REPO" ]; then
  echo "❌ GITHUB_TOKEN atau GITHUB_REPO kosong"
  exit 1
fi

git remote set-url origin https://onyxdrake:$GITHUB_TOKEN@github.com/$GITHUB_REPO.git

# Copy file ke root
cp public/age-check.html ./age-check.html 2>/dev/null
cp public/tos.html ./tos.html 2>/dev/null
cp public/security.html ./security.html 2>/dev/null
cp public/global.html ./global.html 2>/dev/null
cp public/search.html ./search.html 2>/dev/null
cp public/index.html ./index.html 2>/dev/null
cp public/install.html ./install.html 2>/dev/null
cp public/onyx.html ./onyx.html 2>/dev/null
cp public/docs.html ./docs.html 2>/dev/null
cp public/disclaimer.html ./disclaimer.html 2>/dev/null

# Push
git add -A
git commit -m "Auto-push: $(date +%Y-%m-%d_%H:%M:%S)" 2>/dev/null
git push origin master

echo "✅ Push ke master"
