const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Get all active routes (public)
router.get('/', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM routes WHERE is_active = 1 ORDER BY from_location, to_location'
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search routes
router.get('/search', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'From and to parameters are required' });
    }

    const result = await db.allAsync(
      `SELECT * FROM routes 
       WHERE LOWER(from_location) LIKE LOWER(?) AND LOWER(to_location) LIKE LOWER(?) AND is_active = 1`,
      [`%${from}%`, `%${to}%`]
    );

    res.json(result);
  } catch (error) {
    console.error('Error searching routes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
