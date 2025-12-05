const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Helper to normalize image_url column into array + primary URL
const normalizeCarOptionImages = (row) => {
  let imageUrls = [];

  if (row.image_url) {
    try {
      const parsed = JSON.parse(row.image_url);
      if (Array.isArray(parsed)) {
        imageUrls = parsed;
      } else if (typeof parsed === 'string') {
        imageUrls = [parsed];
      }
    } catch {
      // Not JSON, treat as single URL string
      imageUrls = [row.image_url];
    }
  }

  return {
    ...row,
    image_urls: imageUrls,
    image_url: imageUrls[0] || null,
  };
};

// Get all active car options (public)
router.get('/', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM car_options WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC'
    );
    const normalized = result.map(normalizeCarOptionImages);
    res.json(normalized);
  } catch (error) {
    console.error('Error fetching car options:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


