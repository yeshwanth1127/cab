const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Helper to normalize image_url column into array + primary URL
// Also strips protocol/host to avoid mixed-content issues, keeping /uploads/... paths
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

  const normalizeUrl = (url) => {
    if (!url) return url;

    // If it's an absolute URL, strip protocol/host and keep the /uploads/... path
    try {
      const u = new URL(url);
      if (u.pathname && u.pathname.startsWith('/uploads/')) {
        return u.pathname;
      }
    } catch {
      // Not a full URL, fall through
    }

    // Fallback: look for /uploads/ segment in the string
    const idx = url.indexOf('/uploads/');
    if (idx !== -1) {
      return url.substring(idx);
    }

    return url;
  };

  const normalizedUrls = imageUrls.map(normalizeUrl);

  return {
    ...row,
    image_urls: normalizedUrls,
    image_url: normalizedUrls[0] || null,
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


