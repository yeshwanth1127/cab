const express = require('express');
const axios = require('axios');
const { normalizeQuery, generateQueryVariations, fuzzyMatch } = require('../utils/spellCheck');

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE__MAPS_BACKEND_KEY_NEW || process.env.GOOGLE_MAPS_BACKEND_KEY;
const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY;

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 5000;

const API_TIMEOUT_FAST = 1500;
const API_TIMEOUT_SLOW = 2000;
const MIN_RESULTS_THRESHOLD = 8;

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
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

function isIndianLocationGoogle(place) {

  if (place.address_components) {
    const countryComponent = place.address_components.find(
      (component) => component.types && component.types.includes('country')
    );
    if (countryComponent && countryComponent.short_name === 'IN') {
      return true;
    }

    if (countryComponent && countryComponent.short_name !== 'IN') {
      return false;
    }
  }

  if (place.formatted_address) {
    const addressLower = place.formatted_address.toLowerCase();
    if (addressLower.includes('india')) {
      return true;
    }

    const nonIndiaCountries = ['usa', 'united states', 'uk', 'united kingdom', 'canada', 'australia', 'uae', 'dubai', 'singapore'];
    if (nonIndiaCountries.some(country => addressLower.includes(country))) {
      return false;
    }
  }

  if (place.plus_code && place.plus_code.compound_code) {
    const compoundCode = place.plus_code.compound_code.toLowerCase();
    if (compoundCode.includes('india')) {
      return true;
    }
  }

  return false;
}

function isIndianLocationMapmyIndia(place) {

  const country = place.country || place.placeLocation?.country || '';
  const region = place.region || place.placeLocation?.region || '';
  
  if (
    country.toLowerCase() === 'india' ||
    country.toLowerCase() === 'in' ||
    region.toUpperCase() === 'IND'
  ) {
    return true;
  }

  const address = place.placeAddress || place.placeName || place.description || '';
  if (address.toLowerCase().includes('india')) {
    return true;
  }

  return true;
}

function normalizeGooglePlace(place, userLat, userLng, sourceType = 'google') {
  if (!place || !place.geometry || !place.geometry.location) {
    return null;
  }

  const location = place.geometry.location;
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

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

  const address = place.formatted_address || place.vicinity || place.name || '';

  const distance = userLat && userLng ? calculateDistance(userLat, userLng, lat, lng) : null;

  let confidence = 0.6;
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

function normalizeMapmyIndiaPlace(place, userLat, userLng) {
  if (!place) {
    return null;
  }

  const placeLocation = place.placeLocation || {};
  const coordinates = placeLocation.coordinates || {};
  const lat = parseFloat(coordinates.latitude || coordinates.lat || placeLocation.latitude || 0);
  const lng = parseFloat(coordinates.longitude || coordinates.lng || placeLocation.longitude || 0);

  if (!lat || !lng || lat === 0 || lng === 0) {
    return null;
  }

  const name = place.placeName || place.name || '';
  const address = place.placeAddress || place.formatted_address || place.description || '';
  const locality = placeLocation.locality || place.locality || '';
  const city = placeLocation.city || place.city || place.placeCity || '';
  const state = placeLocation.state || place.state || place.placeState || '';

  const distance = userLat && userLng ? calculateDistance(userLat, userLng, lat, lng) : null;

  let confidence = 0.75;
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
      components: 'country:in',

    };

    if (lat && lng) {
      params.location = `${searchLat},${searchLng}`;
      params.radius = 50000;
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
      region: 'in',
    };

    if (lat && lng) {
      params.location = `${searchLat},${searchLng}`;
      params.radius = 20000;
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

      if (!isIndianLocationGoogle(place)) {
        continue;
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

async function fetchGoogleNearbySearch(query, lat, lng, timeout = API_TIMEOUT_FAST) {
  if (!GOOGLE_API_KEY || !lat || !lng) {
    return [];
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const params = {
      location: `${lat},${lng}`,
      radius: 15000,
      keyword: query,
      key: GOOGLE_API_KEY,

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

      if (!isIndianLocationGoogle(place)) {
        continue;
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

async function fetchMapmyIndiaPlaces(query, lat, lng, timeout = API_TIMEOUT_FAST) {
  if (!MAPMYINDIA_KEY) {
    return [];
  }

  try {
    const searchLat = lat || 12.9716;
    const searchLng = lng || 77.5946;

    const url = 'https://atlas.mapmyindia.com/api/places/search';
    const params = {
      query: query,
      location: `${searchLat},${searchLng}`,

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

async function fetchNominatimPlaces(query, lat, lng, timeout = API_TIMEOUT_SLOW) {
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

function getCacheKey(query, lat, lng) {

  const normalizedQuery = normalizeQuery(query);

  const roundedLat = lat ? Math.round(lat * 100) / 100 : 0;
  const roundedLng = lng ? Math.round(lng * 100) / 100 : 0;
  return `${normalizedQuery}|${roundedLat}|${roundedLng}`;
}

function getCachedResults(query, lat, lng) {

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

function deduplicateResults(results, query = '') {
  const seen = new Map();
  const normalizedQuery = normalizeQuery(query);
  
  for (const result of results) {

    let key = result.place_id || `${result.name}|${result.lat}|${result.lng}`;
    

    if (!result.place_id && result.name && result.lat && result.lng) {

      let isDuplicate = false;
      for (const [existingKey, existingResult] of seen.entries()) {
        if (existingResult.lat === result.lat && existingResult.lng === result.lng) {

          const nameSimilarity = fuzzyMatch(normalizedQuery, existingResult.name);
          const newNameSimilarity = fuzzyMatch(normalizedQuery, result.name);
          

          if (nameSimilarity > 0.9 && newNameSimilarity > 0.9) {
            if (newNameSimilarity > nameSimilarity) {
              seen.delete(existingKey);

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

    const cachedResults = getCachedResults(query, userLat, userLng);
    if (cachedResults) {
      return res.json(cachedResults);
    }

    const queryVariations = generateQueryVariations(query);
    const allResults = [];
    const sourcesUsed = [];

    const apiPromises = [];
    

    const googleAutoPromise = fetchGoogleAutocomplete(query, userLat, userLng, API_TIMEOUT_FAST);
    apiPromises.push(googleAutoPromise);

    if (query.length >= 3) {
      const googleTextPromise = fetchGoogleTextSearch(query, userLat, userLng, API_TIMEOUT_FAST);
      apiPromises.push(googleTextPromise);
    }

    if (userLat && userLng) {
      const googleNearbyPromise = fetchGoogleNearbySearch(query, userLat, userLng, API_TIMEOUT_FAST);
      apiPromises.push(googleNearbyPromise);
    }

    const primaryResults = await Promise.allSettled(apiPromises);
    

    for (const result of primaryResults) {
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        allResults.push(...result.value);
        sourcesUsed.push('google_primary');
      }
    }

    if (allResults.length >= MIN_RESULTS_THRESHOLD) {

    } else {

      try {
        const mapmyIndiaResults = await fetchMapmyIndiaPlaces(query, userLat, userLng, API_TIMEOUT_FAST);
        if (mapmyIndiaResults && mapmyIndiaResults.length > 0) {
          allResults.push(...mapmyIndiaResults);
          sourcesUsed.push('mapmyindia');
        }
      } catch (error) {
        console.log('[Places API] MapmyIndia failed:', error.message);
      }

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

    console.log('[Places API] Search completed:', {
      query: query,
      sources: sourcesUsed,
      totalResults: allResults.length,
      time: new Date().toISOString()
    });

    const uniquePlaces = deduplicateResults(allResults, query);

    uniquePlaces.sort((a, b) => {

      if (a.distance != null && b.distance != null) {
        return a.distance - b.distance;
      }
      if (a.distance != null) return -1;
      if (b.distance != null) return 1;

      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      const sourcePriority = {
        google_autocomplete: 1,
        google_text: 2,
        google_nearby: 3,
        mapmyindia: 4,
        nominatim: 5
      };
      return (sourcePriority[a.source] || 10) - (sourcePriority[b.source] || 10);
    });

    const finalResults = uniquePlaces
      .slice(0, 20)
      .map(({ distance, ...place }) => place);

    const cacheKey = getCacheKey(query, userLat, userLng);
    cache.set(cacheKey, {
      data: finalResults,
      timestamp: Date.now(),
    });

    for (const variation of queryVariations.slice(0, 3)) {
      if (variation !== query) {
        const varKey = getCacheKey(variation, userLat, userLng);
        cache.set(varKey, {
          data: finalResults,
          timestamp: Date.now(),
        });
      }
    }

    if (cache.size > MAX_CACHE_SIZE) {
      const now = Date.now();
      const entriesToDelete = [];
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          entriesToDelete.push(key);
        }
      }
      entriesToDelete.forEach(key => cache.delete(key));
      

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

router.get('/expand', async (req, res) => {

  req.url = req.url.replace('/expand', '/search');
  return router.handle(req, res);
});

module.exports = router;
