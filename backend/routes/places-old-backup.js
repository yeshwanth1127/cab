const express = require('express');
const axios = require('axios');
const { normalizeQuery, generateQueryVariations, fuzzyMatch } = require('../utils/spellCheck');

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE__MAPS_BACKEND_KEY_NEW || process.env.GOOGLE_MAPS_BACKEND_KEY;
const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY;

// In-memory cache with TTL (1 hour) - increased size
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_CACHE_SIZE = 5000; // Increased from 1000

// API timeout constants (in milliseconds) - Reduced for faster response
const API_TIMEOUT_FAST = 1500; // 1.5 seconds for primary APIs (reduced from 2s)
const API_TIMEOUT_SLOW = 2000; // 2 seconds for fallback APIs (reduced from 3s)
const MIN_RESULTS_THRESHOLD = 8; // Minimum results before trying next API (increased for faster returns)

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
 * Check if a Google Places result is in India (STRICT FILTERING)
 * @param {Object} place - Google Places API result
 * @returns {boolean} True if location is in India
 */
function isIndianLocationGoogle(place) {
  // Check address_components for country code (most reliable)
  if (place.address_components) {
    const countryComponent = place.address_components.find(
      (component) => component.types && component.types.includes('country')
    );
    if (countryComponent && countryComponent.short_name === 'IN') {
      return true;
    }
    // If we have country component but it's not IN, it's not India
    if (countryComponent && countryComponent.short_name !== 'IN') {
      return false;
    }
  }

  // Check formatted_address for "India"
  if (place.formatted_address) {
    const addressLower = place.formatted_address.toLowerCase();
    if (addressLower.includes('india')) {
      return true;
    }
    // Check for common non-India countries
    const nonIndiaCountries = ['usa', 'united states', 'uk', 'united kingdom', 'canada', 'australia', 'uae', 'dubai', 'singapore'];
    if (nonIndiaCountries.some(country => addressLower.includes(country))) {
      return false;
    }
  }

  // Check plus_code for India indicator
  if (place.plus_code && place.plus_code.compound_code) {
    const compoundCode = place.plus_code.compound_code.toLowerCase();
    if (compoundCode.includes('india')) {
      return true;
    }
  }

  // If we can't verify it's in India, filter it out (strict filtering)
  return false;
}

/**
 * Check if a MapmyIndia result is in India (MapmyIndia is India-focused)
 * @param {Object} place - MapmyIndia API result
 * @returns {boolean} True (MapmyIndia only returns India results)
 */
function isIndianLocationMapmyIndia(place) {
  // MapmyIndia is India-focused, so accept all their results
  // But double-check if needed
  const country = place.country || place.placeLocation?.country || '';
  const region = place.region || place.placeLocation?.region || '';
  
  if (
    country.toLowerCase() === 'india' ||
    country.toLowerCase() === 'in' ||
    region.toUpperCase() === 'IND'
  ) {
    return true;
  }

  // MapmyIndia should always return India, but if unsure, check address
  const address = place.placeAddress || place.placeName || place.description || '';
  if (address.toLowerCase().includes('india')) {
    return true;
  }

  // Default to accepting MapmyIndia results (they're India-focused)
  return true;
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
async function fetchGoogleAutocomplete(query, lat, lng, timeout = API_TIMEOUT_FAST) {
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
      components: 'country:in', // STRICT: India only
      // No types filter to allow all place types (organizations, POIs, etc.)
    };

    // Add location bias for better proximity results
    if (lat && lng) {
      params.location = `${searchLat},${searchLng}`;
      params.radius = 50000; // 50km radius
    }

    const response = await axios.get(url, {
      params: params,
      timeout: timeout,
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
    if (error.code === 'ECONNABORTED') {
      console.log('[Places API] Google Autocomplete timeout');
    }
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
async function fetchGoogleTextSearch(query, lat, lng, timeout = API_TIMEOUT_FAST) {
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
      region: 'in', // STRICT: India region only
    };

    // Add location and radius if user location provided
    if (lat && lng) {
      params.location = `${searchLat},${searchLng}`;
      params.radius = 20000; // 20km radius
    }

    const response = await axios.get(url, {
      params: params,
      timeout: timeout,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return [];
    }

    const results = response.data.results || [];
    const normalizedResults = [];

    for (const place of results) {
      // STRICT: Only accept India locations
      if (!isIndianLocationGoogle(place)) {
        continue; // Skip non-India locations
      }
      
      const normalized = normalizeGooglePlace(place, searchLat, searchLng, 'google_text');
      if (normalized) {
        normalizedResults.push(normalized);
      }
    }

    return normalizedResults;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('[Places API] Google Text Search timeout');
    }
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
async function fetchGoogleNearbySearch(query, lat, lng, timeout = API_TIMEOUT_FAST) {
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
      // No type restrictions - show all organizations
    };

    const response = await axios.get(url, {
      params: params,
      timeout: timeout,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      return [];
    }

    const results = response.data.results || [];
    const normalizedResults = [];

    for (const place of results) {
      // STRICT: Only accept India locations
      if (!isIndianLocationGoogle(place)) {
        continue; // Skip non-India locations
      }
      
      const normalized = normalizeGooglePlace(place, lat, lng, 'google_nearby');
      if (normalized) {
        normalizedResults.push(normalized);
      }
    }

    return normalizedResults;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('[Places API] Google Nearby Search timeout');
    }
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
async function fetchMapmyIndiaPlaces(query, lat, lng, timeout = API_TIMEOUT_FAST) {
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
      // Keep region: 'IND' for MapmyIndia (India-focused service)
    };

    const response = await axios.get(url, {
      params: params,
      headers: {
        'Authorization': `Bearer ${MAPMYINDIA_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: timeout,
    });

    const results = response.data.suggestedLocations || response.data.results || [];
    const normalizedResults = [];

    for (const place of results) {
      // Accept all results
      const normalized = normalizeMapmyIndiaPlace(place, searchLat, searchLng);
      if (normalized) {
        normalizedResults.push(normalized);
      }
    }

    return normalizedResults;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('[Places API] MapmyIndia timeout');
    }
    return [];
  }
}

/**
 * Fallback: Fetch places from OpenStreetMap Nominatim (free, no API key needed)
 */
async function fetchNominatimPlaces(query, lat, lng, timeout = API_TIMEOUT_SLOW) {
  try {
    const searchLat = lat || 12.9716;
    const searchLng = lng || 77.5946;

    // STRICT: India only with countrycodes=in
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=in`;
    
    if (lat && lng) {
      url += `&lat=${searchLat}&lon=${searchLng}&bounded=1`;
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'NammaCabs/1.0',
      },
      timeout: timeout,
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
    if (error.code === 'ECONNABORTED') {
      console.log('[Places API] Nominatim timeout');
    } else {
      console.error('[Places API] Nominatim error:', error.message);
    }
    return [];
  }
}

/**
 * Generate cache key from query and location (normalized)
 * @param {string} query - Search query
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {string} Cache key
 */
function getCacheKey(query, lat, lng) {
  // Normalize query for better cache hits
  const normalizedQuery = normalizeQuery(query);
  // Round coordinates to 2 decimal places for cache key (~1km precision)
  const roundedLat = lat ? Math.round(lat * 100) / 100 : 0;
  const roundedLng = lng ? Math.round(lng * 100) / 100 : 0;
  return `${normalizedQuery}|${roundedLat}|${roundedLng}`;
}

/**
 * Check cache for query variations
 * @param {string} query - Search query
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Array|null} Cached results or null
 */
function getCachedResults(query, lat, lng) {
  // Check exact match first
  const exactKey = getCacheKey(query, lat, lng);
  const exactCached = cache.get(exactKey);
  if (exactCached) {
    const { data, timestamp } = exactCached;
    const age = Date.now() - timestamp;
    if (age < CACHE_TTL) {
      return data;
    }
    cache.delete(exactKey);
  }

  // Check query variations
  const variations = generateQueryVariations(query);
  for (const variation of variations) {
    const varKey = getCacheKey(variation, lat, lng);
    const varCached = cache.get(varKey);
    if (varCached) {
      const { data, timestamp } = varCached;
      const age = Date.now() - timestamp;
      if (age < CACHE_TTL && data && data.length > 0) {
        return data;
      }
    }
  }

  return null;
}

/**
 * Deduplicate results by place_id or (name + lat + lng) with fuzzy matching
 * @param {Array} results - Array of place results
 * @param {string} query - Original query for fuzzy matching
 * @returns {Array} Deduplicated array
 */
function deduplicateResults(results, query = '') {
  const seen = new Map();
  const normalizedQuery = normalizeQuery(query);
  
  for (const result of results) {
    // Use place_id if available, otherwise use name + lat + lng
    let key = result.place_id || `${result.name}|${result.lat}|${result.lng}`;
    
    // Check for fuzzy duplicates (similar names at same location)
    if (!result.place_id && result.name && result.lat && result.lng) {
      // Check if we already have a similar result at this location
      let isDuplicate = false;
      for (const [existingKey, existingResult] of seen.entries()) {
        if (existingResult.lat === result.lat && existingResult.lng === result.lng) {
          // Same location - check name similarity
          const nameSimilarity = fuzzyMatch(normalizedQuery, existingResult.name);
          const newNameSimilarity = fuzzyMatch(normalizedQuery, result.name);
          
          // If names are very similar (>90%), keep the one with better match
          if (nameSimilarity > 0.9 && newNameSimilarity > 0.9) {
            if (newNameSimilarity > nameSimilarity) {
              seen.delete(existingKey);
              // Use the better match
            } else {
              isDuplicate = true;
            }
            break;
          }
        }
      }
      
      if (isDuplicate) {
        continue;
      }
    }
    
    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * GET /api/places/search
 * Optimized autocomplete endpoint with sequential API calls and spell checking
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

    // Check cache first (including query variations)
    const cachedResults = getCachedResults(query, userLat, userLng);
    if (cachedResults) {
      return res.json(cachedResults);
    }

    // Generate query variations for spell checking
    const queryVariations = generateQueryVariations(query);
    const allResults = [];
    const sourcesUsed = [];

    // Optimized sequential API calls with early exit
    // Strategy: Use Promise.race for fastest results, exit early if we have enough

    // 1. Try Google Autocomplete first (fastest, most accurate) - use Promise.race for speed
    const apiPromises = [];
    
    // Primary: Google Autocomplete
    const googleAutoPromise = fetchGoogleAutocomplete(query, userLat, userLng, API_TIMEOUT_FAST);
    apiPromises.push(googleAutoPromise);

    // Also try Google Text Search in parallel if query is long enough
    if (query.length >= 3) {
      const googleTextPromise = fetchGoogleTextSearch(query, userLat, userLng, API_TIMEOUT_FAST);
      apiPromises.push(googleTextPromise);
    }

    // Try Google Nearby if we have location
    if (userLat && userLng) {
      const googleNearbyPromise = fetchGoogleNearbySearch(query, userLat, userLng, API_TIMEOUT_FAST);
      apiPromises.push(googleNearbyPromise);
    }

    // Execute primary APIs in parallel (faster than sequential)
    const primaryResults = await Promise.allSettled(apiPromises);
    
    // Collect results from primary APIs
    for (const result of primaryResults) {
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        allResults.push(...result.value);
        sourcesUsed.push('google_primary');
      }
    }

    // Early exit if we have enough results from primary APIs
    if (allResults.length >= MIN_RESULTS_THRESHOLD) {
      // We have enough, skip fallback APIs
    } else {
      // 2. Try MapmyIndia if we need more results (only if primary didn't give enough)
      try {
        const mapmyIndiaResults = await fetchMapmyIndiaPlaces(query, userLat, userLng, API_TIMEOUT_FAST);
        if (mapmyIndiaResults && mapmyIndiaResults.length > 0) {
          allResults.push(...mapmyIndiaResults);
          sourcesUsed.push('mapmyindia');
        }
      } catch (error) {
        console.log('[Places API] MapmyIndia failed:', error.message);
      }

      // 3. Last resort: Nominatim (only if we still don't have enough)
      if (allResults.length < MIN_RESULTS_THRESHOLD) {
        try {
          const nominatimResults = await fetchNominatimPlaces(query, userLat, userLng, API_TIMEOUT_SLOW);
          if (nominatimResults && nominatimResults.length > 0) {
            allResults.push(...nominatimResults);
            sourcesUsed.push('nominatim');
          }
        } catch (error) {
          console.log('[Places API] Nominatim failed:', error.message);
        }
      }
    }

    // Debug logging
    console.log('[Places API] Search completed:', {
      query: query,
      sources: sourcesUsed,
      totalResults: allResults.length,
      time: new Date().toISOString()
    });

    // Deduplicate with fuzzy matching
    const uniquePlaces = deduplicateResults(allResults, query);

    // Sort: distance first, then confidence, then source priority
    uniquePlaces.sort((a, b) => {
      // Distance priority (if available)
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

    // Limit to top 20 results (increased from 12) to show more organizations
    const finalResults = uniquePlaces
      .slice(0, 20)
      .map(({ distance, ...place }) => place);

    // Cache the result (cache all query variations for faster future lookups)
    const cacheKey = getCacheKey(query, userLat, userLng);
    cache.set(cacheKey, {
      data: finalResults,
      timestamp: Date.now(),
    });

    // Also cache query variations
    for (const variation of queryVariations.slice(0, 3)) {
      if (variation !== query) {
        const varKey = getCacheKey(variation, userLat, userLng);
        cache.set(varKey, {
          data: finalResults,
          timestamp: Date.now(),
        });
      }
    }

    // Cleanup old cache entries (increased threshold)
    if (cache.size > MAX_CACHE_SIZE) {
      const now = Date.now();
      const entriesToDelete = [];
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          entriesToDelete.push(key);
        }
      }
      entriesToDelete.forEach(key => cache.delete(key));
      
      // If still too large, remove oldest 20%
      if (cache.size > MAX_CACHE_SIZE) {
        const sortedEntries = Array.from(cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = Math.floor(cache.size * 0.2);
        for (let i = 0; i < toRemove; i++) {
          cache.delete(sortedEntries[i][0]);
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

