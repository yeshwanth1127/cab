const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Get all active cab types (public)
router.get('/types', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM cab_types WHERE is_active = 1 ORDER BY base_fare ASC'
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching cab types:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available cabs for a specific cab type
router.get('/available/:cabTypeId', async (req, res) => {
  try {
    const { cabTypeId } = req.params;
    const result = await db.allAsync(
      `SELECT c.*, ct.name as cab_type_name
       FROM cabs c
       JOIN cab_types ct ON c.cab_type_id = ct.id
       WHERE c.cab_type_id = ? AND c.is_available = 1 AND c.is_active = 1`,
      [cabTypeId]
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching available cabs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
