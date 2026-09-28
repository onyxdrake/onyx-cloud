const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts' }
});

router.use(limiter);
router.use('/login', authLimiter);
router.use('/register', authLimiter);

router.use('/', require('./chat'));
router.use('/', require('./chats'));
router.use('/', require('./tools'));
router.use('/', require('./system'));
router.use('/', require('./limits'));
router.use('/', require('./payments'));
router.use('/', require('./execute'));
router.use('/', require('./verify'));
router.use('/', require('./account'));
router.use('/', require('./oauth'));
router.use('/', require('./work'));
router.use('/', require('./search'));

module.exports = router;
