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
    const { service_type } = req.query;
    
    let query = 'SELECT co.* FROM car_options co WHERE co.is_active = 1';
    const params = [];
    
    // If service_type is provided, filter by cab_type_id
    if (service_type) {
      // Map service_type to cab_type name
      const cabTypeName = service_type.charAt(0).toUpperCase() + service_type.slice(1);
      query += ` AND co.cab_type_id IN (
        SELECT id FROM cab_types WHERE LOWER(name) = LOWER(?) AND is_active = 1
      )`;
      params.push(cabTypeName);
    }
    
    query += ' ORDER BY co.car_subtype, co.sort_order ASC, co.created_at DESC';
    
    const result = await db.allAsync(query, params);
    const normalized = result.map(normalizeCarOptionImages);
    res.json(normalized);
  } catch (error) {
    console.error('Error fetching car options:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


