
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });
};

export const getAddressFromCoordinates = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CabBookingApp/1.0',
        },
      }
    );
    const data = await response.json();
    return data.display_name || `${lat}, ${lng}`;
  } catch (error) {
    console.error('Error getting address:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export const searchPlaces = async (query, userLocation = null) => {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    

    if (userLocation) {
      url += `&lat=${userLocation.lat}&lon=${userLocation.lng}&bounded=1&radius=50000`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CabBookingApp/1.0',
      },
    });
    
    const data = await response.json();
    
    return data.map((place) => ({
      id: place.place_id,
      name: place.display_name,
      address: place.display_name,
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      type: place.type,
    }));
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
};

export const searchPlacesGoogle = async (query, userLocation = null, apiKey) => {
  if (!apiKey || !query || query.length < 2) {
    return [];
  }

  try {

    const params = new URLSearchParams({
      input: query,
      key: apiKey,

      types: 'address',

      components: 'country:in'
    });
    
    if (userLocation) {

      params.append('location', `${userLocation.lat},${userLocation.lng}`);
      params.append('radius', '5000');
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.predictions) {
      return data.predictions
        .map(prediction => ({
          id: prediction.place_id,
          name: prediction.description,
          address: prediction.description,
        }));
    }
    
    return [];
  } catch (error) {
    console.error('Error searching places with Google:', error);
    return [];
  }
};
