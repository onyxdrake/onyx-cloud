// core/marketplace.js
// Marketplace + Escrow + AI Recommendation

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SELLERS_FILE = path.join(__dirname, '..', 'data', 'sellers.json');
const ORDERS_FILE = path.join(__dirname, '..', 'data', 'market-orders.json');
const ESCROW_FILE = path.join(__dirname, '..', 'data', 'escrow.json');

function loadJSON(file, def = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== SELLER MANAGEMENT =====

// Register seller
function registerSeller(userId, data) {
  const sellers = loadJSON(SELLERS_FILE);
  if (!sellers[userId]) {
    sellers[userId] = {
      userId,
      name: data.name,
      category: data.category, // 'coding', 'design', 'writing', dll
      description: data.description,
      price: parseFloat(data.price),
      portfolio: data.portfolio || [],
      rating: 0,
      totalOrders: 0,
      totalEarned: 0,
      status: 'pending', // pending, active, suspended
      createdAt: Date.now()
    };
    saveJSON(SELLERS_FILE, sellers);
    return { ok: true, seller: sellers[userId] };
  }
  return { ok: false, error: 'Seller udah terdaftar' };
}

// List seller
function listSellers(category = null) {
  const sellers = loadJSON(SELLERS_FILE);
  let list = Object.values(sellers).filter(s => s.status === 'active');
  if (category) list = list.filter(s => s.category === category);
  // Sort by rating
  list.sort((a, b) => b.rating - a.rating);
  return list;
}

// AI Recommendation — cari seller berdasarkan query
function recommendSellers(query) {
  const sellers = listSellers();
  const q = query.toLowerCase();

  // Filter by keyword
  const matched = sellers.filter(s => {
    return s.name.toLowerCase().includes(q) ||
           s.description.toLowerCase().includes(q) ||
           s.category.toLowerCase().includes(q);
  });

  // Top 5 by rating
  return matched.slice(0, 5);
}

// ===== ORDER + ESCROW =====

// Bikin order
function createOrder(buyerId, sellerId, service, amountUsdc) {
  const orders = loadJSON(ORDERS_FILE);
  const orderId = 'mo_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

  orders[orderId] = {
    orderId,
    buyerId,
    sellerId,
    service,
    amount: parseFloat(amountUsdc),
    fee: parseFloat(amountUsdc) * 0.05, // 5% fee
    sellerReceive: parseFloat(amountUsdc) * 0.95,
    status: 'pending_payment', // pending_payment → funded → delivered → completed → disputed → refunded
    createdAt: Date.now(),
    deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 hari
    escrowWallet: process.env.WALLET_ADDRESS,
    memo: 'ONYX-ORDER-' + orderId.slice(-8).toUpperCase()
  };

  saveJSON(ORDERS_FILE, orders);
  return orders[orderId];
}

// Mark funded (setelah payment verified)
function markFunded(orderId) {
  const orders = loadJSON(ORDERS_FILE);
  if (!orders[orderId]) return { ok: false };
  orders[orderId].status = 'funded';
  orders[orderId].fundedAt = Date.now();
  saveJSON(ORDERS_FILE, orders);
  return { ok: true, order: orders[orderId] };
}

// Mark delivered (seller upload hasil)
function markDelivered(orderId, deliveryUrl) {
  const orders = loadJSON(ORDERS_FILE);
  if (!orders[orderId]) return { ok: false };
  orders[orderId].status = 'delivered';
  orders[orderId].deliveredAt = Date.now();
  orders[orderId].deliveryUrl = deliveryUrl;
  saveJSON(ORDERS_FILE, orders);
  return { ok: true, order: orders[orderId] };
}

// Buyer ACC → release funds ke seller
function releaseFunds(orderId, buyerId) {
  const orders = loadJSON(ORDERS_FILE);
  const order = orders[orderId];
  if (!order) return { ok: false, error: 'Order gak ada' };
  if (order.buyerId !== buyerId) return { ok: false, error: 'Bukan pembeli' };
  if (order.status !== 'delivered') return { ok: false, error: 'Status harus delivered' };

  order.status = 'completed';
  order.completedAt = Date.now();

  // Update seller stats
  const sellers = loadJSON(SELLERS_FILE);
  if (sellers[order.sellerId]) {
    sellers[order.sellerId].totalOrders++;
    sellers[order.sellerId].totalEarned += order.sellerReceive;
  }
  saveJSON(SELLERS_FILE, sellers);
  saveJSON(ORDERS_FILE, orders);

  return { ok: true, order, released: order.sellerReceive };
}

// Buyer komplain → dispute
function dispute(orderId, buyerId, reason) {
  const orders = loadJSON(ORDERS_FILE);
  const order = orders[orderId];
  if (!order) return { ok: false };
  if (order.buyerId !== buyerId) return { ok: false };

  order.status = 'disputed';
  order.disputedAt = Date.now();
  order.disputeReason = reason;
  saveJSON(ORDERS_FILE, orders);

  return { ok: true, order };
}

// AI Mediator — putuskan dispute
function mediateDispute(orderId, decision, notes) {
  const orders = loadJSON(ORDERS_FILE);
  const order = orders[orderId];
  if (!order) return { ok: false };

  order.status = decision; // 'refunded' atau 'completed'
  order.mediatedAt = Date.now();
  order.mediationNotes = notes;
  saveJSON(ORDERS_FILE, orders);

  return { ok: true, order };
}

module.exports = {
  registerSeller,
  listSellers,
  recommendSellers,
  createOrder,
  markFunded,
  markDelivered,
  releaseFunds,
  dispute,
  mediateDispute
};
