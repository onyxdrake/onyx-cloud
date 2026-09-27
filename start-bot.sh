#!/data/data/com.termux/files/usr/bin/bash

# Kill bot lama
pkill -f solana-bot.js 2>/dev/null

# Jalanin bot di background
cd ~/pardus-clone
nohup node bot/solana-bot.js > bot/bot.log 2>&1 &

echo "✅ Bot jalan di background. Log: ~/pardus-clone/bot/bot.log"
