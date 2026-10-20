#!/data/data/com.termux/files/usr/bin/bash
# Onyx Cloud — start.sh v6

cd "$(dirname "$0")"
TMPDIR=/data/data/com.termux/files/usr/tmp
LOCK_FILE="$TMPDIR/onyx.lock"

# Lock
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "⚠️  Onyx udah jalan (PID: $OLD_PID)"
    echo "   Restart: pkill -9 -f node && rm $LOCK_FILE"
    exit 1
  fi
  rm -f "$LOCK_FILE"
fi

echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

echo "🛑 Matiin SEMUA proses..."
pkill -9 -f "node server.js" 2>/dev/null || true
pkill -9 -f "bot/onyx-bot" 2>/dev/null || true
pkill -9 -f "bot/onyx-server" 2>/dev/null || true
pkill -9 -f "bot/global-chat" 2>/dev/null || true
pkill -9 -f "bot/solana-bot" 2>/dev/null || true
pkill -9 -f "llama-server" 2>/dev/null || true
pkill -9 -f "ngrok" 2>/dev/null || true
sleep 4

# Kill port agresif
for PORT in 3000 4040 8080 8081 8082 8083 8091; do
  PIDS=$(ls /proc 2>/dev/null | grep -E '^[0-9]+$' | while read pid; do
    if [ -d "/proc/$pid/fd" ]; then
      if ls -la "/proc/$pid/fd" 2>/dev/null | grep -q "socket"; then
        cat "/proc/$pid/net/tcp" 2>/dev/null | grep -q ":$PORT " && echo $pid
      fi
    fi
  done | sort -u)
  if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
      CMD=$(cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ')
      if echo "$CMD" | grep -qE "node|llama|ngrok"; then
        kill -9 $PID 2>/dev/null || true
      fi
    done
  fi
done
sleep 3

# === 1. MODEL LOKAL ===
LLAMA_PID=""
if [ -f "$HOME/llama.cpp/build/bin/llama-server" ] && [ -f "$HOME/models/qwen-unfettered.gguf" ]; then
  echo "🧠 Jalanin model lokal..."
  "$HOME/llama.cpp/build/bin/llama-server" \
    -m "$HOME/models/qwen-unfettered.gguf" \
    --host 127.0.0.1 \
    --port 8080 \
    -c 2048 \
    --threads 4 \
    > "$TMPDIR/onyx-llama.log" 2>&1 &
  LLAMA_PID=$!
  sleep 8
  if curl -s -m 3 http://127.0.0.1:8080/v1/models > /dev/null 2>&1; then
    echo "✅ Model lokal jalan (PID: $LLAMA_PID)"
  fi
fi

# === 2. SERVER ONYX ===
echo "🚀 Jalanin server Onyx..."
node server.js > "$TMPDIR/onyx-server.log" 2>&1 &
SERVER_PID=$!
sleep 6

if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200\|301\|302\|404"; then
  echo "❌ Server gagal start:"
  tail -20 "$TMPDIR/onyx-server.log"
  exit 1
fi
echo "✅ Server jalan di http://localhost:3000"

# === 3. TELEGRAM BOT ===
BOT_PID=""
if [ -f "bot/onyx-bot.js" ]; then
  echo "🤖 Start Telegram bot..."
  node bot/onyx-bot.js > "$TMPDIR/onyx-bot.log" 2>&1 &
  BOT_PID=$!
  sleep 2
  echo "✅ Bot jalan (PID: $BOT_PID)"
fi

# === 4. NGROK ===
echo "🚀 Jalanin ngrok..."
ngrok http 3000 > "$TMPDIR/onyx-ngrok.log" 2>&1 &
NGROK_PID=$!
sleep 5

# Tunggu ngrok beneran siap (max 10 detik)
NGROK_URL=""
for i in {1..10}; do
  NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$NGROK_URL" ]; then
    break
  fi
  sleep 1
done

echo ""
echo "════════════════════════════════════════"
echo "  ONYX CLOUD — RUNNING (PID: $$)"
echo "════════════════════════════════════════"
[ -n "$NGROK_URL" ] && echo "  🌐 Ngrok: $NGROK_URL"
echo "  🖥️  Local: http://localhost:3000"
[ -n "$LLAMA_PID" ] && echo "  🧠 Model: ✅"
[ -n "$BOT_PID" ] && echo "  🤖 Bot: ✅"
echo ""
echo "  Tekan Ctrl+C buat stop."
echo "════════════════════════════════════════"

trap "echo ''; echo '🛑 Stopping...'; kill $SERVER_PID $NGROK_PID $LLAMA_PID $BOT_PID 2>/dev/null; rm -f $LOCK_FILE; exit 0" INT

tail -f "$TMPDIR/onyx-server.log" &
wait
