// Location service for geolocation and place suggestions
// Uses browser geolocation API and OpenStreetMap Nominatim API (free, no key required)

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
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

// Get address from coordinates (reverse geocoding)
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

// Search for places (autocomplete suggestions)
export const searchPlaces = async (query, userLocation = null) => {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    
    // If user location is provided, prioritize nearby results
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

// Alternative: Google Maps Places API (requires API key)
export const searchPlacesGoogle = async (query, userLocation = null, apiKey) => {
  if (!apiKey || !query || query.length < 2) {
    return [];
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`;
    
    if (userLocation) {
      url += `&location=${userLocation.lat},${userLocation.lng}&radius=50000`;
    }

    const response = await fetch(url);
    const data = await response.json();
    
    if (data.predictions) {
      return data.predictions.map((prediction) => ({
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

