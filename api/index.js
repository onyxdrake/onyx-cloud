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
router.use('/', require('./env'));
router.use('/', require('./safety'));

router.use('/', require('./health'));

router.use('/', require('./magic'));

router.use('/', require('./auth'));

router.use('/', require('./billing'));

router.use('/', require('./api-keys'));

router.use('/', require('./otp-service'));

router.use('/', require('./osint'));

router.use('/', require('./scraper'));


router.use('/', require('./otp'));

router.use('/', require('./image'));

router.use('/', require('./pricing'));

router.use('/', require('./account-manage'));

router.use('/', require('./register-phone'));

router.use('/', require('./topup'));

// // router.use('/', require('./marketplace'));

// router.use('/', require('./telegram-login'));

// router.use('/', require('./tanya-onyx'));

router.use('/', require('./magic-link'));

module.exports = router;
