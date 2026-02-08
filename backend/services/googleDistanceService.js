const axios = require('axios');

async function getDistanceAndTime(from, to) {
  console.log('[GOOGLE API] getDistanceAndTime called with:', { from, to });
  
  if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
    console.error('[GOOGLE API] Invalid coordinates:', { from, to });
    throw new Error('Invalid coordinates: from and to must have lat and lng');
  }

  const apiKey = process.env.GOOGLE__MAPS_BACKEND_KEY_NEW;
  if (!apiKey) {
    console.error('[GOOGLE API] GOOGLE__MAPS_BACKEND_KEY_NEW environment variable is not set');
    throw new Error('GOOGLE__MAPS_BACKEND_KEY_NEW environment variable is not set');
  }

  console.log('[GOOGLE API] Calling Distance Matrix API...');
  console.log('[GOOGLE API] Origins:', `${from.lat},${from.lng}`);
  console.log('[GOOGLE API] Destinations:', `${to.lat},${to.lng}`);

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: `${from.lat},${from.lng}`,
          destinations: `${to.lat},${to.lng}`,
          units: 'metric',
          departure_time: 'now',
          key: apiKey,
        },
        timeout: 10000,
      }
    );

    console.log('[GOOGLE API] Response status:', response.data.status);
    console.log('[GOOGLE API] Response data:', JSON.stringify(response.data, null, 2));

    if (response.data.status !== 'OK') {
      throw new Error(`Google Distance Matrix API error: ${response.data.status}`);
    }

    const element = response.data.rows[0]?.elements[0];

    if (!element) {
      throw new Error('No route found between the specified locations');
    }

    if (element.status !== 'OK') {
      throw new Error(`Distance Matrix element status: ${element.status}`);
    }

    const result = {
      distance_km: element.distance.value / 1000,
      duration_min: Math.round(element.duration.value / 60),
    };
    
    console.log('[GOOGLE API] Success! Distance:', result.distance_km, 'km, Time:', result.duration_min, 'min');
    return result;
  } catch (error) {
    console.error('[GOOGLE API] Error occurred:', error.message);
    if (error.response) {
      console.error('[GOOGLE API] Response error:', error.response.data);

      throw new Error(`Google Distance Matrix API error: ${error.response.data?.error_message || error.message}`);
    } else if (error.request) {
      console.error('[GOOGLE API] No response received');

      throw new Error('No response from Google Distance Matrix API');
    } else {
      console.error('[GOOGLE API] Request setup error:', error.message);

      throw new Error(`Error calling Google Distance Matrix API: ${error.message}`);
    }
  }
}

module.exports = {
  getDistanceAndTime,
};
