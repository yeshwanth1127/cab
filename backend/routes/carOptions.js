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
    
    let query = `
      SELECT co.*, ct.name as cab_type_name, ct.service_type as cab_type_service_type
      FROM car_options co
      INNER JOIN cab_types ct ON co.cab_type_id = ct.id
      WHERE co.is_active = 1
    `;
    const params = [];
    
    // If service_type is provided, only show cars assigned to cab types with that service_type
    if (service_type) {
      query += ` AND ct.service_type = ? 
                 AND ct.is_active = 1`;
      params.push(service_type);
    } else {
      // If no service_type, only show cars that are assigned to any active cab type
      query += ` AND ct.is_active = 1`;
    }
    
    query += ' ORDER BY ct.name, co.car_subtype, co.sort_order ASC, co.created_at DESC';
    
    console.log('[Car Options API] Query:', query);
    console.log('[Car Options API] Params:', params);
    console.log('[Car Options API] Service Type:', service_type);
    
    // Debug: Always check what cab types exist for this service_type
    if (service_type) {
      const debugQuery = `SELECT ct.id, ct.name, ct.service_type, ct.is_active, COUNT(co.id) as car_count 
                         FROM cab_types ct 
                         LEFT JOIN car_options co ON co.cab_type_id = ct.id AND co.is_active = 1
                         WHERE ct.service_type = ? AND ct.is_active = 1
                         GROUP BY ct.id, ct.name, ct.service_type, ct.is_active`;
      const debugResult = await db.allAsync(debugQuery, [service_type]);
      console.log('[Car Options API] Debug - All cab types for service_type:', service_type, ':', debugResult);
      
      // Also check cars assigned to each cab type
      const carsDebugQuery = `SELECT co.id, co.name, co.cab_type_id, co.is_active, ct.name as cab_type_name, ct.service_type
                              FROM car_options co
                              LEFT JOIN cab_types ct ON co.cab_type_id = ct.id
                              WHERE ct.service_type = ? AND ct.is_active = 1
                              ORDER BY ct.name, co.name`;
      const carsDebugResult = await db.allAsync(carsDebugQuery, [service_type]);
      console.log('[Car Options API] Debug - All cars for service_type:', service_type, ':', carsDebugResult.map(c => ({
        id: c.id,
        name: c.name,
        cab_type_id: c.cab_type_id,
        cab_type_name: c.cab_type_name,
        is_active: c.is_active
      })));
      
      // Debug: Check ALL cab types and their service_type (not just for this service_type)
      const allCabTypesQuery = `SELECT ct.id, ct.name, ct.service_type, ct.is_active, COUNT(co.id) as car_count
                                FROM cab_types ct
                                LEFT JOIN car_options co ON co.cab_type_id = ct.id AND co.is_active = 1
                                WHERE ct.is_active = 1
                                GROUP BY ct.id, ct.name, ct.service_type, ct.is_active
                                ORDER BY ct.service_type, ct.name`;
      const allCabTypesResult = await db.allAsync(allCabTypesQuery, []);
      console.log('[Car Options API] Debug - ALL cab types in database:', allCabTypesResult);
    }
    
    const result = await db.allAsync(query, params);
    console.log('[Car Options API] Results count:', result.length);
    if (result.length > 0) {
      console.log('[Car Options API] All results:', result.map(r => ({
        id: r.id,
        name: r.name,
        cab_type_id: r.cab_type_id,
        cab_type_name: r.cab_type_name,
        cab_type_service_type: r.cab_type_service_type,
        is_active: r.is_active
      })));
    } else {
      console.log('[Car Options API] No results found. Query:', query, 'Params:', params);
    }
    
    const normalized = result.map(normalizeCarOptionImages);
    res.json(normalized);
  } catch (error) {
    console.error('Error fetching car options:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


