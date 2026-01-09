const express = require('express');
const axios = require('axios');

const router = express.Router();

const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY;

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

/**
 * GET /api/address/suggest
 * Get address suggestions from MapmyIndia
 * Query params: q (required), lat (optional), lng (optional)
 */
router.get('/suggest', async (req, res) => {
  try {
    const { q, lat, lng } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query parameter "q" is required (minimum 2 characters)' });
    }

    // If no MapmyIndia API key, return empty results (frontend will use fallback)
    if (!MAPMYINDIA_KEY) {
      console.warn('[Address API] MAPMYINDIA_API_KEY not configured, returning empty results');
      return res.json([]);
    }

    console.log(`[Address API] Searching MapmyIndia for: "${q}"`);

    // Default to Bangalore coordinates if not provided
    const searchLat = parseFloat(lat) || 12.9716;
    const searchLng = parseFloat(lng) || 77.5946;

    // Call MapmyIndia Autosuggest API
    // Using Atlas API (newer) with Bearer token authentication
    try {
      const response = await axios.get(
        'https://atlas.mapmyindia.com/api/places/autocomplete',
        {
          params: {
            input: q.trim(),
            location: `${searchLat},${searchLng}`,
            region: 'IND',
          },
          headers: {
            'Authorization': `Bearer ${MAPMYINDIA_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let suggestions = [];
      
      // Handle different response formats
      if (response.data && response.data.suggestedLocations) {
        suggestions = response.data.suggestedLocations.map((location) => {
          const loc = location.placeLocation || {};
          const coords = loc.coordinates || {};
          
          return {
            id: location.eLoc || location.placeId || `map_${Date.now()}_${Math.random()}`,
            description: location.placeName || location.placeAddress || '',
            address: location.placeAddress || location.placeName || '',
            lat: parseFloat(coords.latitude || coords.lat || loc.latitude || 0),
            lng: parseFloat(coords.longitude || coords.lng || loc.longitude || 0),
            distance_km: 0,
            confidence: 0.9,
            placeId: location.placeId,
            eLoc: location.eLoc,
            type: location.type || 'address',
            _source: 'mapmyindia',
          };
        }).filter(item => item.lat !== 0 && item.lng !== 0);
      } else if (response.data && response.data.results) {
        // Legacy format
        suggestions = response.data.results.map((result) => ({
          id: result.eLoc || result.placeId || `map_${Date.now()}_${Math.random()}`,
          description: result.displayName || result.formatted_address || '',
          address: result.formatted_address || result.displayName || '',
          lat: parseFloat(result.geometry?.location?.lat || result.lat || 0),
          lng: parseFloat(result.geometry?.location?.lng || result.lng || 0),
          distance_km: 0,
          confidence: 0.9,
          placeId: result.placeId,
          eLoc: result.eLoc,
          type: result.type || 'address',
          _source: 'mapmyindia',
        })).filter(item => item.lat !== 0 && item.lng !== 0);
      }

      if (suggestions.length === 0) {
        return res.json([]);
      }

      // Calculate distance and sort
      const withDistance = suggestions.map((s) => ({
        ...s,
        distance_km: calculateDistance(searchLat, searchLng, s.lat, s.lng),
      }));

      // Sort by distance (closest first)
      withDistance.sort((a, b) => a.distance_km - b.distance_km);

      // Return top 10 suggestions
      return res.json(withDistance.slice(0, 10));
    } catch (apiError) {
      console.error('[Address API] MapmyIndia API error:', apiError.message);
      if (apiError.response) {
        console.error('[Address API] Response status:', apiError.response.status);
        console.error('[Address API] Response data:', apiError.response.data);
      }
      // Return empty array on error (frontend will use fallback)
      return res.json([]);
    }
  } catch (error) {
    console.error('[Address API] Error fetching suggestions:', error.message);
    // Return empty array on error (frontend will use fallback)
    res.json([]);
  }
});

/**
 * POST /api/address/validate
 * Get detailed address information for a place ID
 * Body: { placeId: "string", eLoc: "string" (optional) }
 */
router.post('/validate', async (req, res) => {
  try {
    const { placeId, eLoc } = req.body;

    if (!placeId && !eLoc) {
      return res.status(400).json({ error: 'placeId or eLoc is required' });
    }

    if (!MAPMYINDIA_KEY) {
      console.warn('[Address API] MAPMYINDIA_API_KEY not configured');
      return res.status(503).json({ error: 'Address validation service not configured' });
    }

    console.log(`[Address API] Getting details for: "${placeId || eLoc}"`);

    const identifier = eLoc || placeId;

    try {
      // Use Atlas API Geocode endpoint
      const response = await axios.get(
        'https://atlas.mapmyindia.com/api/places/geocode',
        {
          params: {
            address: identifier,
            region: 'IND',
            itemCount: 1,
          },
          headers: {
            'Authorization': `Bearer ${MAPMYINDIA_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let result;
      if (response.data && response.data.copResults && response.data.copResults.length) {
        result = response.data.copResults[0];
      } else if (response.data && response.data.results && response.data.results.length) {
        result = response.data.results[0];
      } else {
        return res.status(404).json({ error: 'Address not found' });
      }

      const location = result.placeLocation || result.geometry?.location || {};
      const coordinates = location.coordinates || location || {};

      // Extract address components
      const addressComponents = {
        house_number: result.houseNumber || result.house_number || '',
        street: result.street || result.streetName || '',
        locality: result.locality || result.subLocality || '',
        city: result.city || result.placeCity || '',
        state: result.state || result.placeState || '',
        pincode: result.pincode || result.postalCode || '',
        district: result.district || '',
      };

      // Build formatted address
      const addressParts = [];
      if (addressComponents.house_number) addressParts.push(addressComponents.house_number);
      if (addressComponents.street) addressParts.push(addressComponents.street);
      if (addressComponents.locality) addressParts.push(addressComponents.locality);
      if (addressComponents.city) addressParts.push(addressComponents.city);
      if (addressComponents.pincode) addressParts.push(addressComponents.pincode);

      const formattedAddress = result.formattedAddress || result.placeAddress || addressParts.join(', ');

      return res.json({
        success: true,
        address: formattedAddress,
        components: addressComponents,
        geocode: {
          lat: parseFloat(coordinates.latitude || coordinates.lat || location.latitude || 0),
          lng: parseFloat(coordinates.longitude || coordinates.lng || location.longitude || 0),
        },
        confidence: 0.9,
        placeId: result.placeId || placeId,
        eLoc: result.eLoc || eLoc,
      });
    } catch (apiError) {
      console.error('[Address API] MapmyIndia validation error:', apiError.message);
      return res.status(500).json({ error: 'Failed to validate address' });
    }
  } catch (error) {
    console.error('[Address API] Error validating address:', error.message);
    res.status(500).json({ error: 'Failed to validate address' });
  }
});

/**
 * POST /api/address/reverse
 * Reverse geocode: Get address from coordinates
 * Body: { lat: number, lng: number }
 */
router.post('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    if (!MAPMYINDIA_KEY) {
      console.warn('[Address API] MAPMYINDIA_API_KEY not configured');
      return res.status(503).json({ error: 'Reverse geocoding service not configured' });
    }

    console.log(`[Address API] Reverse geocoding: ${lat}, ${lng}`);

    try {
      // Use Atlas API Reverse Geocode
      const response = await axios.get(
        'https://atlas.mapmyindia.com/api/places/reverse_geocode',
        {
          params: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            region: 'IND',
          },
          headers: {
            'Authorization': `Bearer ${MAPMYINDIA_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let result;
      if (response.data && response.data.results && response.data.results.length) {
        result = response.data.results[0];
      } else if (response.data && response.data.copResults && response.data.copResults.length) {
        result = response.data.copResults[0];
      } else {
        return res.status(404).json({ error: 'Address not found for coordinates' });
      }

      const location = result.placeLocation || {};
      const coordinates = location.coordinates || location || {};

      // Extract address components
      const addressComponents = {
        house_number: result.houseNumber || result.house_number || '',
        street: result.street || result.streetName || '',
        locality: result.locality || result.subLocality || '',
        city: result.city || result.placeCity || '',
        state: result.state || result.placeState || '',
        pincode: result.pincode || result.postalCode || '',
      };

      // Build formatted address
      const addressParts = [];
      if (addressComponents.house_number) addressParts.push(addressComponents.house_number);
      if (addressComponents.street) addressParts.push(addressComponents.street);
      if (addressComponents.locality) addressParts.push(addressComponents.locality);
      if (addressComponents.city) addressParts.push(addressComponents.city);
      if (addressComponents.pincode) addressParts.push(addressComponents.pincode);

      const formattedAddress = result.formattedAddress || result.placeAddress || addressParts.join(', ') || `${lat}, ${lng}`;

      return res.json({
        success: true,
        address: formattedAddress,
        components: addressComponents,
        geocode: {
          lat: parseFloat(coordinates.latitude || coordinates.lat || location.latitude || lat),
          lng: parseFloat(coordinates.longitude || coordinates.lng || location.longitude || lng),
        },
        confidence: 0.9,
      });
    } catch (apiError) {
      console.error('[Address API] MapmyIndia reverse geocode error:', apiError.message);
      return res.status(500).json({ error: 'Failed to reverse geocode' });
    }
  } catch (error) {
    console.error('[Address API] Error reverse geocoding:', error.message);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

module.exports = router;
