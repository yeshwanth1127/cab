const express = require('express');

const router = express.Router();

router.get('/suggest', async (req, res) => {

  return res.json([]);

});

router.post('/validate', async (req, res) => {
  return res.status(503).json({ error: 'Use Google only: /api/places/details' });

});

router.post('/reverse', async (req, res) => {
  return res.status(503).json({ error: 'Use Google only: /api/places/reverse' });

});

module.exports = router;
