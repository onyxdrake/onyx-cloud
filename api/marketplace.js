const express = require('express');
const router = express.Router();
const market = require('../core/marketplace');

// List seller
router.get('/market/sellers', (req, res) => {
  const { category } = req.query;
  const sellers = market.listSellers(category);
  res.json({ ok: true, sellers });
});

// AI recommend
router.get('/market/recommend', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ error: 'Query wajib' });
  const recommended = market.recommendSellers(q);
  res.json({ ok: true, query: q, recommended });
});

// Register seller
router.post('/market/register-seller', (req, res) => {
  const { userId, name, category, description, price, portfolio } = req.body;
  if (!userId || !name || !category || !price) {
    return res.json({ error: 'Data kurang' });
  }
  const result = market.registerSeller(userId, { name, category, description, price, portfolio });
  res.json(result);
});

// Bikin order
router.post('/market/order', (req, res) => {
  const { buyerId, sellerId, service, amount } = req.body;
  if (!buyerId || !sellerId || !amount) return res.json({ error: 'Data kurang' });

  const order = market.createOrder(buyerId, sellerId, service, amount);

  // QR untuk payment
  const qrData = `solana:${order.escrowWallet}?amount=${order.amount}&spl-token=${process.env.USDC_MINT}&memo=${order.memo}`;

  res.json({ ok: true, order, qrData });
});

// Mark delivered
router.post('/market/order/:orderId/deliver', (req, res) => {
  const { deliveryUrl } = req.body;
  const result = market.markDelivered(req.params.orderId, deliveryUrl);
  res.json(result);
});

// Buyer ACC
router.post('/market/order/:orderId/accept', (req, res) => {
  const { buyerId } = req.body;
  const result = market.releaseFunds(req.params.orderId, buyerId);
  res.json(result);
});

// Buyer dispute
router.post('/market/order/:orderId/dispute', (req, res) => {
  const { buyerId, reason } = req.body;
  const result = market.dispute(req.params.orderId, buyerId, reason);
  res.json(result);
});

module.exports = router;
