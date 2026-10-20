#!/data/data/com.termux/files/usr/bin/bash

# Load .env
export $(grep -v '^#' .env | xargs) 2>/dev/null

echo "💼 Wallet: $WALLET_ADDRESS"
echo "📏 Length: ${#WALLET_ADDRESS}"
echo "🌐 RPC: $SOLANA_RPC"
echo ""

if [ ${#WALLET_ADDRESS} -lt 40 ]; then
  echo "❌ Wallet address invalid (terlalu pendek)"
  exit 1
fi

# Cek SOL
echo "=== SOL Balance ==="
curl -s -X POST "$SOLANA_RPC" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$WALLET_ADDRESS\"]}" \
  | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'result' in d:
        lamports = d['result']['value']
        sol = lamports / 1_000_000_000
        print(f'  {sol} SOL (~\${sol * 180:.2f})')
    else:
        print('  Error:', d.get('error', {}).get('message', 'unknown'))
except Exception as e:
    print('  Parse error:', e)
"

echo ""

# Cek USDC
echo "=== USDC Balance ==="
curl -s -X POST "$SOLANA_RPC" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTokenAccountsByOwner\",\"params\":[\"$WALLET_ADDRESS\",{\"mint\":\"$USDC_MINT\"},{\"encoding\":\"jsonParsed\"}]}" \
  | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'result' in d and d['result']['value']:
        for acc in d['result']['value']:
            amount = acc['account']['data']['parsed']['info']['tokenAmount']
            print(f'  {amount[\"uiAmount\"]} USDC')
    else:
        print('  0 USDC')
except Exception as e:
    print('  Parse error:', e)
"
