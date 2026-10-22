const express = require('express');
const { generateSignature } = require('../core/signature');
const router = express.Router();

router.get('/server-signature', (req, res) => {
  const payload = {
    server: 'Onyx Cloud Real',
    timestamp: Date.now(),
    version: '1.0.0'
  };
  
  res.json({
    ok: true,
    payload,
    signature: generateSignature(payload)
  });
});

module.exports = router;
