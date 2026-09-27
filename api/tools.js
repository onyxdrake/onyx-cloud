const express = require('express');
const registry = require('../tools/registry');
const router = express.Router();

router.get('/tools', (req, res) => {
  const all = registry.getAll();
  res.json(Object.entries(all).map(([name, def]) => ({
    name, description: def.description, type: def.type
  })));
});

router.post('/tools/custom', (req, res) => {
  const { name, def } = req.body;
  registry.addCustom(name, def);
  res.json({ ok: true });
});

router.delete('/tools/custom/:name', (req, res) => {
  registry.removeCustom(req.params.name);
  res.json({ ok: true });
});

module.exports = router;
