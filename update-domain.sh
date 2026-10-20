#!/data/data/com.termux/files/usr/bin/bash

# Jalanin tunnel di background
cloudflared tunnel --url http://localhost:3000 > tunnel.log 2>&1 &
TUNNEL_PID=$!

echo "Tunnel PID: $TUNNEL_PID"
echo "Nunggu URL muncul..."

# Tunggu URL, exclude api.trycloudflare.com
for i in {1..30}; do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' tunnel.log | grep -v '^https://api\.' | head -1)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Gagal dapet URL. Cek tunnel.log"
  cat tunnel.log
  exit 1
fi

echo "URL: $URL"
echo "$URL" > domain.txt

# Git
git add -A
git commit -m "Update domain: $URL"
git push -u origin master

echo "Domain di GitHub: $URL"
echo "Tunnel PID: $TUNNEL_PID"
echo "Matikan: kill $TUNNEL_PID"
