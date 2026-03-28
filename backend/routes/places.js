
const express = require('express');
const axios = require('axios');
const redis = require('../utils/redis');

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_BACKEND_KEY_NEW || process.env.GOOGLE_MAPS_BACKEND_KEY;

if (!GOOGLE_API_KEY) {
  console.warn('[Places API] WARNING: Google Maps API key not configured');
}

const KIA_PLACE_ID = 'KIA_BANGALORE';
const KIA_AUTOCOMPLETE = {
  place_id: KIA_PLACE_ID,
  description: 'Kempegowda International Airport (KIA), Bangalore',
  main_text: 'Kempegowda International Airport (KIA)',
  secondary_text: 'Bangalore',
  types: ['airport'],
};
const KIA_DETAILS = {
  place_id: KIA_PLACE_ID,
  name: 'Kempegowda International Airport',
  address: 'Kempegowda International Airport Bangalore',
  formatted: 'Kempegowda International Airport Bangalore',
  locality: 'Devanahalli',
  city: 'Bangalore',
  state: 'Karnataka',
  lat: 13.1986,
  lng: 77.7066,
};

function shouldInjectKIA(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return q === 'kia' || q.startsWith('kia ') || q.endsWith(' kia') || q.includes('kempegowda') ||
    (q.includes('bangalore') && q.includes('airport')) || (q.includes('airport') && q.includes('bangalore')) ||
    q === '560300' || q.replace(/\s/g, '') === '560300';
}

function isExactKIAQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();
  return q === 'kia' || q.replace(/\s/g, '') === 'kia';
}

function isPincode560300Result(pred) {
  if (!pred) return false;
  const d = (pred.description || '').toLowerCase();
  const main = (pred.main_text || '').toLowerCase();
  const sec = (pred.secondary_text || '').toLowerCase();
  return d.includes('560300') || main.includes('560300') || sec.includes('560300');
}

const CACHE_TTL = 600;

function normalizeQuery(query) {
  if (!query) return '';
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function getCacheKey(query, lat, lng) {
  const normalizedQuery = normalizeQuery(query);

  const roundedLat = lat ? Math.round(parseFloat(lat) * 100) / 100 : 0;
  const roundedLng = lng ? Math.round(parseFloat(lng) * 100) / 100 : 0;
  return `ac|${normalizedQuery}|${roundedLat}|${roundedLng}`;
}

function roundCoordinate(coord) {
  return coord ? Math.round(parseFloat(coord) * 100) / 100 : null;
}

router.get('/autocomplete', async (req, res) => {
  try {
    const { q, lat, lng, sessionToken } = req.query;

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

    const cacheKey = getCacheKey(query, userLat, userLng);
    const isKIAQuery = shouldInjectKIA(query);
    const exactKIA = isExactKIAQuery(query);

    if (exactKIA) {
      const kiaOnly = [{ ...KIA_AUTOCOMPLETE }];
      await redis.set(cacheKey, kiaOnly, CACHE_TTL);
      return res.json(kiaOnly);
    }

    if (!isKIAQuery) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = {
      input: query,
      key: GOOGLE_API_KEY,
      components: 'country:in',
    };

    if (userLat && userLng) {
      params.location = `${roundCoordinate(userLat)},${roundCoordinate(userLng)}`;
      params.radius = 50000;
    }

    if (sessionToken) {
      params.sessiontoken = sessionToken;
    }

    const response = await axios.get(url, {
      params,
      timeout: 2000,
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.warn('[Places API] Google Autocomplete:', response.data.status, response.data.error_message || '');
      return res.json([]);
    }

    const predictions = response.data.predictions || [];

    let normalized = predictions.map((prediction) => ({
      place_id: prediction.place_id,
      description: prediction.description,
      main_text: prediction.structured_formatting?.main_text || prediction.description,
      secondary_text: prediction.structured_formatting?.secondary_text || '',
      types: prediction.types || [],
    }));

    if (isKIAQuery) {
      const kiaEntry = { ...KIA_AUTOCOMPLETE };
      normalized = normalized.filter((p) => p.place_id !== KIA_PLACE_ID && !isPincode560300Result(p));
      normalized = [kiaEntry, ...normalized];
    }

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

router.post('/details', async (req, res) => {
  try {
    const { placeId, sessionToken } = req.body;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }

    if (placeId === KIA_PLACE_ID) {
      return res.json(KIA_DETAILS);
    }

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = {
      place_id: placeId,
      key: GOOGLE_API_KEY,
      fields: 'geometry,formatted_address,address_components,place_id,name',
    };

    if (sessionToken) {
      params.sessiontoken = sessionToken;
    }

    const response = await axios.get(url, {
      params,
      timeout: 2000,
    });

    if (response.data.status !== 'OK') {
      console.warn('[Places API] Google Details error:', response.data.status);
      return res.status(404).json({ error: 'Place not found' });
    }

    const place = response.data.result;

    const location = place.geometry?.location;
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

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

router.post('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: 'Invalid lat or lng' });
    }

    const url = 'https://maps.googleapis.com/maps/api/geocode/json';
    const response = await axios.get(url, {
      params: {
        latlng: `${latNum},${lngNum}`,
        key: GOOGLE_API_KEY,
        result_type: 'street_address|premise|subpremise|establishment|point_of_interest',
      },
      timeout: 2000,
    });

    if (response.data.status !== 'OK' || !response.data.results?.length) {
      return res.status(404).json({ error: 'No address found for coordinates' });
    }

    const results = response.data.results;
    const inIndia = (r) => {
      const comps = r.address_components || [];
      return comps.some(
        (c) => c.types && c.types.includes('country') && c.short_name === 'IN'
      );
    };
    const result = results.find(inIndia) || results[0];

    const location = result.geometry?.location || { lat: latNum, lng: lngNum };
    const resLat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const resLng = typeof location.lng === 'function' ? location.lng() : location.lng;

    return res.json({
      address: result.formatted_address || `${latNum}, ${lngNum}`,
      geocode: { lat: resLat, lng: resLng },
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.warn('[Places API] Google Reverse Geocode timeout');
    } else {
      console.error('[Places API] Error:', error.message);
    }
    return res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

module.exports = router;
