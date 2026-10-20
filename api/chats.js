const express = require('express');
const memory = require('../core/memory');
const router = express.Router();

router.get('/chats', (req, res) => {
  const userId = req.query.userId;
  res.json(memory.listChats(userId));
});

router.get('/chat/:id', (req, res) => {
  const c = memory.getChat(req.params.id);
  if (!c) return res.status(404).json({ error: 'Gak ada' });
  res.json(c);
});

router.delete('/chat/:id', (req, res) => {
  memory.deleteChat(req.params.id);
  res.json({ ok: true });
});

router.post('/chat/new', (req, res) => {
  const userId = req.body.userId || 'anon';
  res.json(memory.newChat('Obrolan Baru', userId));
});

module.exports = router;
