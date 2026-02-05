// MapmyIndia Service - COMMENTED OUT (use Google only: /api/places/autocomplete, /places/details, /places/reverse)
// Kept for reference; app uses only Google Maps for suggestions and places (India only).
// import api from './api';

/**
 * Get address suggestions - MapmyIndia COMMENTED OUT (use Google: /api/places/autocomplete)
 */
export const searchAddresses = async (query, userLocation = null) => {
  return []; // Use Google only
  // if (!query || query.trim().length < 2) return [];
  // const params = { q: query.trim() };
  // if (userLocation?.lat && userLocation?.lng) { params.lat = userLocation.lat; params.lng = userLocation.lng; }
  // const response = await api.get('/address/suggest', { params });
  // return response.data || [];
};

/**
 * Validate address - MapmyIndia COMMENTED OUT (use Google: /api/places/details)
 */
export const validateAddress = async (placeId, eLoc = null) => {
  throw new Error('Use Google only: /api/places/details');
  // const response = await api.post('/address/validate', { placeId, eLoc });
  // return response.data;
};

/**
 * Reverse geocode - MapmyIndia COMMENTED OUT (use Google: /api/places/reverse)
 */
export const reverseGeocode = async (lat, lng) => {
  throw new Error('Use Google only: /api/places/reverse');
  // const response = await api.post('/address/reverse', { lat: parseFloat(lat), lng: parseFloat(lng) });
  // return response.data;
};

