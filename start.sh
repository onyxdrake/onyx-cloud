#!/data/data/com.termux/files/usr/bin/bash
cd "$(dirname "$0")"
TMPDIR=/data/data/com.termux/files/usr/tmp
LOCK_FILE="$TMPDIR/onyx.lock"

if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "⚠️ Onyx udah jalan (PID: $OLD_PID)"
    exit 1
  fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

echo "🛑 Matiin proses lama..."
pkill -9 -f "node server.js" 2>/dev/null || true
pkill -9 -f "llama-server" 2>/dev/null || true
pkill -9 -f "ngrok" 2>/dev/null || true
sleep 3

echo "🧠 Jalanin model lokal..."
"$HOME/llama.cpp/build/bin/llama-server" -m "$HOME/models/qwen-unfettered.gguf" --host 127.0.0.1 --port 8080 -c 2048 --threads 4 > "$TMPDIR/onyx-llama.log" 2>&1 &
sleep 5

echo "🚀 Jalanin server Onyx..."
node server.js > "$TMPDIR/onyx-server.log" 2>&1 &
SERVER_PID=$!
sleep 5

echo "🚀 Jalanin ngrok..."
ngrok http 3000 > "$TMPDIR/onyx-ngrok.log" 2>&1 &
NGROK_PID=$!

# Tungguin Ngrok dapet URL (max 10 detik)
NGROK_URL=""
for i in {1..10}; do
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$NGROK_URL" ]; then break; fi
  sleep 1
done

echo ""
echo "════════════════════════════════════════"
echo "  ONYX CLOUD RUNNING"
echo "════════════════════════════════════════"
if [ -n "$NGROK_URL" ]; then
  echo "  🌐 URL PUBLIK: $NGROK_URL"
else
  echo "  ⚠️ Ngrok gagal start. Cek $TMPDIR/onyx-ngrok.log"
fi
echo "════════════════════════════════════════"
echo ""

# Deploy Netlify & Bot
node netlify-deploy.js 2>/dev/null &
if [ -f "bot/onyx-bot.js" ]; then node bot/onyx-bot.js > /dev/null 2>&1 & fi
if [ -f "bot/discord-welcome.js" ]; then node bot/discord-welcome.js > /dev/null 2>&1 & fi

tail -f "$TMPDIR/onyx-server.log" &
wait
