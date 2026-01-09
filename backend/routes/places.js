const express = require('express');
const axios = require('axios');

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE__MAPS_BACKEND_KEY_NEW || process.env.GOOGLE_MAPS_BACKEND_KEY;
const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY;

// In-memory cache with TTL (1 hour)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
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
 * Check if a Google Places result is in India
 * @param {Object} place - Google Places API result
 * @returns {boolean} True if location is in India
 */
function isIndianLocationGoogle(place) {
  // Check address_components for country code
  if (place.address_components) {
    const countryComponent = place.address_components.find(
      (component) => component.types && component.types.includes('country')
    );
    if (countryComponent && countryComponent.short_name === 'IN') {
      return true;
    }
  }

  // Check formatted_address for "India"
  if (place.formatted_address) {
    const addressLower = place.formatted_address.toLowerCase();
    if (addressLower.includes('india')) {
      return true;
    }
  }

  // Check plus_code for India indicator
  if (place.plus_code && place.plus_code.compound_code) {
    const compoundCode = place.plus_code.compound_code.toLowerCase();
    if (compoundCode.includes('india')) {
      return true;
    }
  }

  // If we can't verify, discard (strict filtering)
  return false;
}

/**
 * Check if a MapmyIndia result is in India
 * @param {Object} place - MapmyIndia API result
 * @returns {boolean} True if location is in India
 */
function isIndianLocationMapmyIndia(place) {
  // MapmyIndia results should have country or region
  const country = place.country || place.placeLocation?.country || '';
  const region = place.region || place.placeLocation?.region || '';

  if (
    country.toLowerCase() === 'india' ||
    country.toLowerCase() === 'in' ||
    region.toUpperCase() === 'IND'
  ) {
    return true;
  }

  // Check address string
  const address = place.placeAddress || place.placeName || place.description || '';
  if (address.toLowerCase().includes('india')) {
    return true;
  }

  // If we can't verify, discard (strict filtering)
  return false;
}

/**
 * Normalize Google Places API result to standard format
 * @param {Object} place - Google Places API result
 * @param {number} userLat - User latitude for distance calculation
 * @param {number} userLng - User longitude for distance calculation
 * @param {string} sourceType - Source type: 'google_text' or 'google_nearby'
 * @returns {Object|null} Normalized place object or null if invalid
 */
function normalizeGooglePlace(place, userLat, userLng, sourceType = 'google') {
  if (!place || !place.geometry || !place.geometry.location) {
    return null;
  }

  // Extract location
  const location = place.geometry.location;
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

  const locality = getComponent('locality') || getComponent('sublocality') || getComponent('sublocality_level_1') || '';
  const city = getComponent('administrative_area_level_2') || getComponent('locality') || '';
  const state = getComponent('administrative_area_level_1') || '';

  // Build formatted address
  const address = place.formatted_address || place.vicinity || place.name || '';

  // Calculate distance if user location provided
  const distance = userLat && userLng ? calculateDistance(userLat, userLng, lat, lng) : null;

  // Calculate confidence (accept results even without complete address, just lower confidence)
  let confidence = 0.6; // Base confidence (lowered to accept more results)
  if (place.formatted_address) confidence += 0.15;
  if (locality) confidence += 0.1;
  if (city) confidence += 0.1;
  if (state) confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  return {
    source: sourceType,
    place_id: place.place_id || `google_${Date.now()}_${Math.random()}`,
    name: place.name || '',
    address: address,
    formatted: address,
    locality: locality,
    city: city,
    state: state,
    lat: lat,
    lng: lng,
    confidence: confidence,
    distance: distance,
  };
}

/**
 * Normalize MapmyIndia API result to standard format
 * @param {Object} place - MapmyIndia API result
 * @param {number} userLat - User latitude for distance calculation
 * @param {number} userLng - User longitude for distance calculation
 * @returns {Object|null} Normalized place object or null if invalid
 */
function normalizeMapmyIndiaPlace(place, userLat, userLng) {
  if (!place) {
    return null;
  }

  // Extract location
  const placeLocation = place.placeLocation || {};
  const coordinates = placeLocation.coordinates || {};
  const lat = parseFloat(coordinates.latitude || coordinates.lat || placeLocation.latitude || 0);
  const lng = parseFloat(coordinates.longitude || coordinates.lng || placeLocation.longitude || 0);

  if (!lat || !lng || lat === 0 || lng === 0) {
    return null;
  }

  // Extract address components
  const name = place.placeName || place.name || '';
  const address = place.placeAddress || place.formatted_address || place.description || '';
  const locality = placeLocation.locality || place.locality || '';
  const city = placeLocation.city || place.city || place.placeCity || '';
  const state = placeLocation.state || place.state || place.placeState || '';

  // Calculate distance if user location provided
  const distance = userLat && userLng ? calculateDistance(userLat, userLng, lat, lng) : null;

  // Calculate confidence
  let confidence = 0.75; // MapmyIndia generally has good data
  if (address) confidence += 0.1;
  if (locality) confidence += 0.05;
  if (city) confidence += 0.1;
  confidence = Math.min(confidence, 1.0);

  return {
    source: 'mapmyindia',
    place_id: place.placeId || place.eLoc || place.id || `mapmyindia_${Date.now()}_${Math.random()}`,
    name: name,
    address: address,
    formatted: address,
    locality: locality,
    city: city,
    state: state,
    lat: lat,
    lng: lng,
    confidence: confidence,
    distance: distance,
  };
}

/**
 * Fetch places from Google Places Autocomplete API
 * @param {string} query - Search query
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Promise<Array>} Array of normalized places
 */
async function fetchGoogleAutocomplete(query, lat, lng) {
  if (!GOOGLE_API_KEY) {
    return [];
  }

  try {
    const searchLat = lat || 12.9716;
    const searchLng = lng || 77.5946;

    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
      input: query,
      key: GOOGLE_API_KEY,
      components: 'country:in',
      // REMOVED types=geocode filter to allow all place types
    };

    // Add location bias for better proximity results
    if (lat && lng) {
      params.location = `${searchLat},${searchLng}`;
      params.radius = 50000; // 50km radius
    }

    const response = await axios.get(url, {
      params: params,
      timeout: 5000,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return [];
    }

    const predictions = response.data.predictions || [];
    return predictions.map((prediction) => ({
      source: 'google_autocomplete',
      place_id: prediction.place_id,
      name: prediction.structured_formatting?.main_text || prediction.description,
      address: prediction.description,
      formatted: prediction.description,
      types: prediction.types || [],
      // Note: lat/lng will be fetched on selection via place details
      lat: null,
      lng: null,
      confidence: 0.9,
      distance: null,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Fetch places from Google Places Text Search API
 * @param {string} query - Search query
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Promise<Array>} Array of normalized places
 */
async function fetchGoogleTextSearch(query, lat, lng) {
  if (!GOOGLE_API_KEY) {
    return [];
  }

  try {
    const searchLat = lat || 12.9716;
    const searchLng = lng || 77.5946;

    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const params = {
      query: query,
      key: GOOGLE_API_KEY,
      region: 'in', // India region
    };

    // Add location and radius if user location provided
    if (lat && lng) {
      params.location = `${searchLat},${searchLng}`;
      params.radius = 20000; // 20km radius
    }

    const response = await axios.get(url, {
      params: params,
      timeout: 5000,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return [];
    }

    const results = response.data.results || [];
    const normalizedResults = [];

    for (const place of results) {
      // Less aggressive filtering - accept results even if India check fails (lower confidence)
      const normalized = normalizeGooglePlace(place, searchLat, searchLng, 'google_text');
      if (normalized) {
        // Lower confidence if not clearly in India
        if (!isIndianLocationGoogle(place)) {
          normalized.confidence = Math.max(0.5, normalized.confidence - 0.2);
        }
        normalizedResults.push(normalized);
      }
    }

    return normalizedResults;
  } catch (error) {
    return [];
  }
}

/**
 * Fetch places from Google Places Nearby Search API
 * @param {string} query - Search query (keyword)
 * @param {number} lat - User latitude (required)
 * @param {number} lng - User longitude (required)
 * @returns {Promise<Array>} Array of normalized places
 */
async function fetchGoogleNearbySearch(query, lat, lng) {
  if (!GOOGLE_API_KEY || !lat || !lng) {
    return [];
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const params = {
      location: `${lat},${lng}`,
      radius: 15000, // 15km radius
      keyword: query,
      key: GOOGLE_API_KEY,
    };

    const response = await axios.get(url, {
      params: params,
      timeout: 5000,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return [];
    }

    const results = response.data.results || [];
    const normalizedResults = [];

    for (const place of results) {
      // Less aggressive filtering - accept results even if India check fails (lower confidence)
      const normalized = normalizeGooglePlace(place, lat, lng, 'google_nearby');
      if (normalized) {
        // Lower confidence if not clearly in India
        if (!isIndianLocationGoogle(place)) {
          normalized.confidence = Math.max(0.5, normalized.confidence - 0.2);
        }
        normalizedResults.push(normalized);
      }
    }

    return normalizedResults;
  } catch (error) {
    return [];
  }
}

/**
 * Fetch places from MapmyIndia Places API
 * @param {string} query - Search query
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Promise<Array>} Array of normalized places
 */
async function fetchMapmyIndiaPlaces(query, lat, lng) {
  if (!MAPMYINDIA_KEY) {
    return [];
  }

  try {
    const searchLat = lat || 12.9716; // Default to Bangalore
    const searchLng = lng || 77.5946;

    // Use MapmyIndia Atlas Places Search API
    const url = 'https://atlas.mapmyindia.com/api/places/search';
    const params = {
      query: query,
      location: `${searchLat},${searchLng}`,
      region: 'IND', // India only
    };

    const response = await axios.get(url, {
      params: params,
      headers: {
        'Authorization': `Bearer ${MAPMYINDIA_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 second timeout
    });

    const results = response.data.suggestedLocations || response.data.results || [];
    const normalizedResults = [];

    for (const place of results) {
      // Less aggressive filtering - accept results even if India check fails (lower confidence)
      const normalized = normalizeMapmyIndiaPlace(place, searchLat, searchLng);
      if (normalized) {
        // Lower confidence if not clearly in India
        if (!isIndianLocationMapmyIndia(place)) {
          normalized.confidence = Math.max(0.5, normalized.confidence - 0.2);
        }
        normalizedResults.push(normalized);
      }
    }

    return normalizedResults;
  } catch (error) {
    return [];
  }
}

/**
 * Fallback: Fetch places from OpenStreetMap Nominatim (free, no API key needed)
 */
async function fetchNominatimPlaces(query, lat, lng) {
  try {
    const searchLat = lat || 12.9716;
    const searchLng = lng || 77.5946;

    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=in`;
    
    if (lat && lng) {
      url += `&lat=${searchLat}&lon=${searchLng}&bounded=1`;
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'NammaCabs/1.0',
      },
      timeout: 5000,
    });

    const results = response.data || [];
    
    return results.map((place) => ({
      source: 'nominatim',
      place_id: `nominatim_${place.place_id || place.osm_id}`,
      name: place.display_name.split(',')[0],
      address: place.display_name,
      formatted: place.display_name,
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      confidence: 0.7,
      distance: lat && lng ? calculateDistance(searchLat, searchLng, parseFloat(place.lat), parseFloat(place.lon)) : null,
    }));
  } catch (error) {
    console.error('[Places API] Nominatim error:', error.message);
    return [];
  }
}

/**
 * Generate cache key from query and location
 * @param {string} query - Search query
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {string} Cache key
 */
function getCacheKey(query, lat, lng) {
  // Round coordinates to 2 decimal places for cache key (~1km precision)
  const roundedLat = lat ? Math.round(lat * 100) / 100 : 0;
  const roundedLng = lng ? Math.round(lng * 100) / 100 : 0;
  return `${query.toLowerCase().trim()}|${roundedLat}|${roundedLng}`;
}

/**
 * Deduplicate results by place_id or (name + lat + lng)
 * @param {Array} results - Array of place results
 * @returns {Array} Deduplicated array
 */
function deduplicateResults(results) {
  const seen = new Map();
  
  for (const result of results) {
    // Use place_id if available, otherwise use name + lat + lng
    const key = result.place_id || `${result.name}|${result.lat}|${result.lng}`;
    
    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * GET /api/places/search
 * Unified autocomplete endpoint - handles both general queries and brand/POI expansion
 * Query params: q (required), lat (optional), lng (optional)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, lat, lng } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Query parameter "q" is required (minimum 2 characters)',
      });
    }

    const query = q.trim();
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    // Check cache first
    const cacheKey = getCacheKey(query, userLat, userLng);
    const cached = cache.get(cacheKey);

    if (cached) {
      const { data, timestamp } = cached;
      const age = Date.now() - timestamp;

      if (age < CACHE_TTL) {
        return res.json(data);
      } else {
        cache.delete(cacheKey);
      }
    }

    // Build promises array for parallel execution
    const promises = [];

    // 1. Always call Google Autocomplete (NO types=geocode filter)
    promises.push(fetchGoogleAutocomplete(query, userLat, userLng));

    // 2. Always call Google Text Search (if query length >= 3)
    if (query.length >= 3) {
      promises.push(fetchGoogleTextSearch(query, userLat, userLng));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 3. Call Google Nearby Search (if lat/lng exists)
    if (userLat && userLng) {
      promises.push(fetchGoogleNearbySearch(query, userLat, userLng));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 4. Always call MapmyIndia
    promises.push(fetchMapmyIndiaPlaces(query, userLat, userLng));

    // 5. Nominatim as last fallback
    promises.push(fetchNominatimPlaces(query, userLat, userLng));

    // Execute all in parallel
    const results = await Promise.allSettled(promises);

    // Extract results
    const googleAutocompleteResults = results[0].status === 'fulfilled' ? results[0].value : [];
    const googleTextResults = results[1].status === 'fulfilled' ? results[1].value : [];
    const googleNearbyResults = results[2].status === 'fulfilled' ? results[2].value : [];
    const mapmyIndiaResults = results[3].status === 'fulfilled' ? results[3].value : [];
    const nominatimResults = results[4].status === 'fulfilled' ? results[4].value : [];

    // Debug logging
    console.log('[Places API] Provider coverage:', {
      'Google Auto': googleAutocompleteResults.length,
      'Google Text': googleTextResults.length,
      'Google Nearby': googleNearbyResults.length,
      'MapmyIndia': mapmyIndiaResults.length,
      'Nominatim': nominatimResults.length,
      query: query
    });

    // Merge all results
    const allResults = [
      ...googleAutocompleteResults,
      ...googleTextResults,
      ...googleNearbyResults,
      ...mapmyIndiaResults,
      ...nominatimResults
    ];

    // Deduplicate by place_id or (name + lat + lng)
    const uniquePlaces = deduplicateResults(allResults);

    // Sort: distance first, then confidence, then source priority
    uniquePlaces.sort((a, b) => {
      // Distance priority
      if (a.distance != null && b.distance != null) {
        return a.distance - b.distance;
      }
      if (a.distance != null) return -1;
      if (b.distance != null) return 1;

      // Confidence priority
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      // Source priority: google_autocomplete > google_text > google_nearby > mapmyindia > nominatim
      const sourcePriority = {
        google_autocomplete: 1,
        google_text: 2,
        google_nearby: 3,
        mapmyindia: 4,
        nominatim: 5
      };
      return (sourcePriority[a.source] || 10) - (sourcePriority[b.source] || 10);
    });

    // Limit to top 12 results at the very end
    const finalResults = uniquePlaces
      .slice(0, 12)
      .map(({ distance, ...place }) => place);

    // Cache the result
    cache.set(cacheKey, {
      data: finalResults,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries
    if (cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return res.json(finalResults);
  } catch (error) {
    console.error('[Places API] Unexpected error:', error.message);
    return res.json([]);
  }
});

/**
 * GET /api/places/expand
 * Legacy endpoint - redirects to /search for backward compatibility
 */
router.get('/expand', async (req, res) => {
  // Redirect to search endpoint
  req.url = req.url.replace('/expand', '/search');
  return router.handle(req, res);
});

module.exports = router;

