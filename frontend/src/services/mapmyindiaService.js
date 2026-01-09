// MapmyIndia Service - Calls backend API endpoints
// Uses backend API (not direct MapmyIndia API) to avoid exposing API key in frontend
import api from './api';

/**
 * Get address suggestions from MapmyIndia via backend API
 * @param {string} query - Search query
 * @param {Object} userLocation - {lat, lng} optional user location for better results
 * @returns {Promise<Array>} Array of suggestion objects
 */
export const searchAddresses = async (query, userLocation = null) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const params = {
      q: query.trim(),
    };

    if (userLocation && userLocation.lat && userLocation.lng) {
      params.lat = userLocation.lat;
      params.lng = userLocation.lng;
    }

    const response = await api.get('/address/suggest', { params });
    return response.data || [];
  } catch (error) {
    console.error('[MapmyIndia Service] Error fetching suggestions:', error);
    // Return empty array on error - fallback will be used
    return [];
  }
};

/**
 * Validate and get detailed address information for a place ID
 * @param {string} placeId - Place ID or eLoc from suggestion
 * @param {string} eLoc - eLoc (optional, alternative to placeId)
 * @returns {Promise<Object>} Validated address object with details
 */
export const validateAddress = async (placeId, eLoc = null) => {
  if (!placeId && !eLoc) {
    throw new Error('placeId or eLoc is required');
  }

  try {
    const response = await api.post('/address/validate', {
      placeId,
      eLoc,
    });

    return response.data;
  } catch (error) {
    console.error('[MapmyIndia Service] Error validating address:', error);
    throw error;
  }
};

/**
 * Reverse geocode: Get address from coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Address object with details
 */
export const reverseGeocode = async (lat, lng) => {
  if (!lat || !lng) {
    throw new Error('lat and lng are required');
  }

  try {
    const response = await api.post('/address/reverse', {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });

    return response.data;
  } catch (error) {
    console.error('[MapmyIndia Service] Error reverse geocoding:', error);
    throw error;
  }
};

