const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Rate limit: max 20 request per menit per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Terlalu banyak request. Coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit ketat buat auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi 15 menit.' }
});

router.use(limiter);
router.use('/login', authLimiter);
router.use('/register', authLimiter);
router.use('/verify/send', authLimiter);

router.use('/', require('./chat'));
router.use('/', require('./work'));
router.use('/', require('./chats'));
router.use('/', require('./tools'));
router.use('/', require('./system'));
router.use('/', require('./limits'));
router.use('/', require('./payments'));
router.use('/', require('./execute'));
router.use('/', require('./verify'));
router.use('/', require('./account'));
router.use('/', require('./oauth'));

module.exports = router;
