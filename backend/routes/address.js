const express = require('express');
// const axios = require('axios'); // MapmyIndia - commented out, use Google only

const router = express.Router();

// const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY; // MapmyIndia - commented out

// Helper function to calculate distance between two coordinates (Haversine formula)
// function calculateDistance(lat1, lng1, lat2, lng2) {
//   const R = 6371; // Radius of the Earth in km
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLng = ((lng2 - lng1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLng / 2) *
//       Math.sin(dLng / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return parseFloat((R * c).toFixed(2));
// }

/**
 * GET /api/address/suggest
 * MapmyIndia suggestions - COMMENTED OUT (use Google only: /api/places/autocomplete)
 */
router.get('/suggest', async (req, res) => {
  // Use Google only; MapmyIndia logic commented out below
  return res.json([]);
  // --- MapmyIndia (commented out):
  // try {
  //   const { q, lat, lng } = req.query;
  //   if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Query parameter "q" is required (minimum 2 characters)' });
  //   if (!MAPMYINDIA_KEY) { console.warn('[Address API] MAPMYINDIA_API_KEY not configured'); return res.json([]); }
  //   const searchLat = parseFloat(lat) || 12.9716;
  //   const searchLng = parseFloat(lng) || 77.5946;
  //   const response = await axios.get('https://atlas.mapmyindia.com/api/places/autocomplete', {
  //     params: { input: q.trim(), location: `${searchLat},${searchLng}`, region: 'IND' },
  //     headers: { 'Authorization': `Bearer ${MAPMYINDIA_KEY}`, 'Content-Type': 'application/json' },
  //   });
  //   let suggestions = [];
  //   if (response.data && response.data.suggestedLocations) {
  //     suggestions = response.data.suggestedLocations.map((location) => { ... }).filter(...);
  //   } else if (response.data && response.data.results) {
  //     suggestions = response.data.results.map((result) => ({ ... })).filter(...);
  //   }
  //   const withDistance = suggestions.map((s) => ({ ...s, distance_km: calculateDistance(...) }));
  //   withDistance.sort((a, b) => a.distance_km - b.distance_km);
  //   return res.json(withDistance.slice(0, 10));
  // } catch (error) { console.error('[Address API] Error:', error.message); return res.json([]); }
});

/**
 * POST /api/address/validate
 * MapmyIndia - COMMENTED OUT (use Google only: /api/places/details)
 */
router.post('/validate', async (req, res) => {
  return res.status(503).json({ error: 'Use Google only: /api/places/details' });
  // --- MapmyIndia (commented out): full validate logic with axios.get('https://atlas.mapmyindia.com/api/places/geocode', ...)
});

/**
 * POST /api/address/reverse
 * MapmyIndia - COMMENTED OUT (use Google only: /api/places/reverse)
 */
router.post('/reverse', async (req, res) => {
  return res.status(503).json({ error: 'Use Google only: /api/places/reverse' });
  // --- MapmyIndia (commented out): full reverse logic with axios.get('https://atlas.mapmyindia.com/api/places/reverse_geocode', ...)
});

module.exports = router;
