/**
 * Production-grade Places API
 * 
 * Architecture:
 * - Google Places Autocomplete ONLY (no multi-provider aggregation)
 * - Session tokens for cost optimization
 * - Redis caching (with in-memory fallback)
 * - Simple, fast, maintainable
 */

const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const redis = require('../utils/redis');

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE__MAPS_BACKEND_KEY_NEW || process.env.GOOGLE_MAPS_BACKEND_KEY;

if (!GOOGLE_API_KEY) {
  console.warn('[Places API] WARNING: Google Maps API key not configured');
}

// Cache TTL: 10 minutes (short for freshness)
const CACHE_TTL = 600; // seconds

/**
 * Normalize query for cache key
 */
function normalizeQuery(query) {
  if (!query) return '';
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

/**
 * Generate cache key
 */
function getCacheKey(query, lat, lng) {
  const normalizedQuery = normalizeQuery(query);
  // Round coordinates to 2 decimal places (~1km precision)
  const roundedLat = lat ? Math.round(parseFloat(lat) * 100) / 100 : 0;
  const roundedLng = lng ? Math.round(parseFloat(lng) * 100) / 100 : 0;
  return `ac|${normalizedQuery}|${roundedLat}|${roundedLng}`;
}

/**
 * Round coordinates for location bias
 */
function roundCoordinate(coord) {
  return coord ? Math.round(parseFloat(coord) * 100) / 100 : null;
}

/**
 * GET /api/places/autocomplete
 * 
 * Fast autocomplete using Google Places Autocomplete API
 * 
 * Query params:
 * - q (required): Search query (min 2 chars)
 * - lat (optional): User latitude for location bias
 * - lng (optional): User longitude for location bias
 * - sessionToken (optional): Session token for cost optimization
 * 
 * Response: Array of predictions (Google's format, slightly normalized)
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const { q, lat, lng, sessionToken } = req.query;

    // Validation
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    if (!GOOGLE_API_KEY) {
      console.warn('[Places API] Google API key not configured');
      return res.json([]);
    }

    const query = q.trim();
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    // Check cache
    const cacheKey = getCacheKey(query, userLat, userLng);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Build Google Autocomplete request
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
      input: query,
      key: GOOGLE_API_KEY,
      components: 'country:in', // India only
      types: 'geocode|establishment', // Addresses + establishments
    };

    // Add location bias if user location provided
    if (userLat && userLng) {
      params.location = `${roundCoordinate(userLat)},${roundCoordinate(userLng)}`;
      params.radius = 50000; // 50km radius
    }

    // Add session token if provided (for cost optimization)
    if (sessionToken) {
      params.sessiontoken = sessionToken;
    }

    // Call Google Autocomplete API
    const response = await axios.get(url, {
      params,
      timeout: 2000, // 2 second timeout
    });

    // Handle Google API response
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.warn('[Places API] Google Autocomplete error:', response.data.status);
      return res.json([]);
    }

    const predictions = response.data.predictions || [];

    // Normalize predictions (minimal transformation)
    const normalized = predictions.map((prediction) => ({
      place_id: prediction.place_id,
      description: prediction.description,
      main_text: prediction.structured_formatting?.main_text || prediction.description,
      secondary_text: prediction.structured_formatting?.secondary_text || '',
      types: prediction.types || [],
    }));

    // Cache results
    await redis.set(cacheKey, normalized, CACHE_TTL);

    return res.json(normalized);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.warn('[Places API] Google Autocomplete timeout');
    } else {
      console.error('[Places API] Error:', error.message);
    }
    return res.json([]);
  }
});

/**
 * POST /api/places/details
 * 
 * Get full place details (lat/lng + address) for a selected place
 * 
 * Body:
 * - placeId (required): Google Place ID
 * - sessionToken (optional): Session token from autocomplete session
 * 
 * Response: Full place details
 */
router.post('/details', async (req, res) => {
  try {
    const { placeId, sessionToken } = req.body;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    // Build Google Place Details request
    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = {
      place_id: placeId,
      key: GOOGLE_API_KEY,
      fields: 'geometry,formatted_address,address_components,place_id,name',
    };

    // Add session token if provided (reduces cost)
    if (sessionToken) {
      params.sessiontoken = sessionToken;
    }

    // Call Google Place Details API
    const response = await axios.get(url, {
      params,
      timeout: 2000,
    });

    if (response.data.status !== 'OK') {
      console.warn('[Places API] Google Details error:', response.data.status);
      return res.status(404).json({ error: 'Place not found' });
    }

    const place = response.data.result;

    // Extract location
    const location = place.geometry?.location;
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

    // Extract address components
    const addressComponents = place.address_components || [];
    const getComponent = (type) => {
      const component = addressComponents.find(
        (comp) => comp.types && comp.types.includes(type)
      );
      return component ? component.long_name : '';
    };

    const locality = getComponent('locality') || getComponent('sublocality') || '';
    const city = getComponent('administrative_area_level_2') || getComponent('locality') || '';
    const state = getComponent('administrative_area_level_1') || '';

    // Return normalized response
    return res.json({
      place_id: place.place_id,
      name: place.name || '',
      address: place.formatted_address || '',
      formatted: place.formatted_address || '',
      locality,
      city,
      state,
      lat,
      lng,
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.warn('[Places API] Google Details timeout');
    } else {
      console.error('[Places API] Error:', error.message);
    }
    return res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

module.exports = router;
