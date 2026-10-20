const express = require('express');
const router = express.Router();
const solpay = require('../core/solana-payment');

// Bikin order baru
router.post('/topup/create', (req, res) => {
  const { userId, email, paket } = req.body;
  if (!userId || !paket) return res.json({ error: 'userId & paket wajib' });

  const order = solpay.buatOrder(userId, email, paket);
  if (order.error) return res.json({ error: order.error });

  res.json({
    ok: true,
    orderId: order.orderId,
    amount: order.amountUsdc,
    wallet: order.wallet,
    usdcMint: order.usdcMint,
    memo: order.memo,
    expiresAt: order.expiresAt,
    qrData: `solana:${order.wallet}?amount=${order.amountUsdc}&spl-token=${order.usdcMint}&memo=${order.memo}`
  });
});

// Cek status order
router.get('/topup/status', (req, res) => {
  const { orderId } = req.query;
  if (!orderId) return res.json({ error: 'orderId wajib' });

  const order = solpay.cekOrder(orderId);
  if (!order) return res.json({ error: 'Order gak ditemukan' });

  res.json({
    ok: true,
    orderId: order.orderId,
    status: order.status,
    paket: order.paket,
    amount: order.amountUsdc,
    paidAt: order.paidAt || null,
    signature: order.signature || null
  });
});

// Cek wallet lo (buat admin)
router.get('/topup/wallet', (req, res) => {
  res.json({
    ok: true,
    wallet: process.env.WALLET_ADDRESS,
    usdcMint: process.env.USDC_MINT,
    rpc: process.env.SOLANA_RPC
  });
});

module.exports = router;
