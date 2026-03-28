import { useEffect, useRef, useState } from "react";
import './LocationInput.css';
import MapPicker from './MapPicker';
import api from '../services/api';
import { loadGoogleMaps } from '../utils/googleMapsLoader';

const localCache = new Map();
const MAX_CACHE_SIZE = 100;

function normalizeQuery(query) {
  if (!query) return '';
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function getCacheKey(query, userLocation) {
  const normalizedQuery = normalizeQuery(query);
  const roundedLat = userLocation?.lat ? Math.round(userLocation.lat * 100) / 100 : 0;
  const roundedLng = userLocation?.lng ? Math.round(userLocation.lng * 100) / 100 : 0;
  return `${normalizedQuery}|${roundedLat}|${roundedLng}`;
}

export default function LocationInput({
  placeholder,
  onSelect,
  userLocation,
  value,
  label,
  showCurrentLocation = true
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const timeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const selectedAddressRef = useRef(null);

  useEffect(() => {
    if (value && typeof value === 'object' && value.address) {
      setQuery(value.address);
    } else if (value && typeof value === 'string') {
      setQuery(value);
    } else if (!value) {
      setQuery('');
    }
  }, [value]);

  useEffect(() => {

    if (selectedAddressRef.current && query === selectedAddressRef.current) {
      setResults([]);
      return;
    }

    if (!query || query.length < 2) {
      setResults([]);
      selectedAddressRef.current = null;
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      const normalizedQuery = normalizeQuery(query);
      const cacheKey = getCacheKey(normalizedQuery, userLocation);
      

      if (localCache.has(cacheKey)) {
        const cachedResults = localCache.get(cacheKey);
        setResults(cachedResults);
        return;
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {

        const params = {
          q: normalizedQuery,
        };

        if (userLocation && userLocation.lat && userLocation.lng) {
          params.lat = userLocation.lat;
          params.lng = userLocation.lng;
        }

        const response = await api.get('/places/search', {
          params,
          signal,
          timeout: 10000,
        });

        if (signal.aborted) {
          return;
        }

        const suggestions = response.data || [];

        if (localCache.size >= MAX_CACHE_SIZE) {

          const entriesToDelete = Math.floor(MAX_CACHE_SIZE * 0.2);
          const keys = Array.from(localCache.keys());
          for (let i = 0; i < entriesToDelete; i++) {
            localCache.delete(keys[i]);
          }
        }
        localCache.set(cacheKey, suggestions);

        setResults(suggestions);
      } catch (error) {

        if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
          return;
        }
        
        console.warn('[LocationInput] Search failed:', error.message);
        setResults([]);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, userLocation]);

  const handleSelect = async (place) => {
    let location;

    if (place.source === 'google_autocomplete') {

      if (place.lat && place.lng) {
        location = {
          address: place.formatted || place.address,
          lat: place.lat,
          lng: place.lng
        };
      } else if (place.place_id) {

        const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY_NEW;
        if (googleKey && window.google && window.google.maps && window.google.maps.places) {
          try {
            await loadGoogleMaps(googleKey);
            const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
            const placeDetails = await new Promise((resolve) => {
              placesService.getDetails(
                {
                  placeId: place.place_id,
                  fields: ['geometry', 'formatted_address']
                },
                (placeData, status) => {
                  if (status === window.google.maps.places.PlacesServiceStatus.OK && placeData?.geometry) {
                    resolve({
                      address: placeData.formatted_address || place.formatted || place.address,
                      lat: placeData.geometry.location.lat(),
                      lng: placeData.geometry.location.lng()
                    });
                  } else {
                    resolve({
                      address: place.formatted || place.address,
                      lat: null,
                      lng: null
                    });
                  }
                }
              );
            });
            location = placeDetails;
          } catch (error) {
            location = {
              address: place.formatted || place.address,
              lat: null,
              lng: null
            };
          }
        } else {
          location = {
            address: place.formatted || place.address,
            lat: null,
            lng: null
          };
        }
      } else {
        location = {
          address: place.formatted || place.address,
          lat: null,
          lng: null
        };
      }
    } else {

      location = {
        address: place.formatted || place.address || place.name,
        lat: place.lat,
        lng: place.lng
      };
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    selectedAddressRef.current = location.address;
    setQuery(location.address);
    setResults([]);

    if (onSelect) {
      onSelect(location);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsRequestingLocation(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      try {
        const response = await api.post('/address/reverse', {
          lat: lat.toString(),
          lng: lng.toString(),
        });

        if (response.data && response.data.address) {
          const location = {
            address: response.data.address,
            lat: response.data.geocode.lat,
            lng: response.data.geocode.lng
          };

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          selectedAddressRef.current = location.address;
          setQuery(location.address);
          setResults([]);
          if (onSelect) {
            onSelect(location);
          }
          setIsRequestingLocation(false);
          return;
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
      }

      const location = {
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng
      };

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      selectedAddressRef.current = location.address;
      setQuery(location.address);
      setResults([]);
      if (onSelect) {
        onSelect(location);
      }
      setIsRequestingLocation(false);
    } catch (error) {
      setIsRequestingLocation(false);
      console.error('Error getting current location:', error);
      if (error.code === 3) {
        alert('Location timeout. Please select location on map.');
      } else {
        alert('Unable to get your location. Please enable location access in your browser settings.');
      }
    }
  };

  return (
    <div className="location-input-container">
      {label && <label>{label}</label>}
      <div className="location-input-wrapper">
        <input
          type="text"
          value={query}
          placeholder={placeholder || 'Enter location'}
          onChange={(e) => {
            const newValue = e.target.value;

            if (selectedAddressRef.current && newValue !== selectedAddressRef.current) {
              selectedAddressRef.current = null;
            }
            setQuery(newValue);
          }}
          autoComplete="off"
          className="location-input"
        />
        <div className="location-buttons">
        {showCurrentLocation && (
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isRequestingLocation}
            className="location-button"
            title="Use current location"
          >
            {isRequestingLocation ? '⏳' : '📍'}
          </button>
        )}
        </div>
        {results.length > 0 && (
          <ul className="location-dropdown">
            {results.map((place, index) => {
              const placeId = place.place_id || `place-${index}`;
              const displayName = place.formatted || place.address || place.name || 'Unknown location';
              const secondaryInfo = place.locality || place.city || '';

              return (
                <li
                  key={placeId}
                  onClick={() => handleSelect(place)}
                  className="suggestion-item"
                >
                  <div className="suggestion-name">{displayName}</div>
                  {secondaryInfo && secondaryInfo !== displayName && (
                    <div className="suggestion-type">📍 {secondaryInfo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      <MapPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelect={(location) => {
          const locationData = {
            address: location.address,
            lat: location.lat,
            lng: location.lng
          };

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          selectedAddressRef.current = locationData.address;
          setQuery(locationData.address);
          setResults([]);
          if (onSelect) {
            onSelect(locationData);
          }
        }}
        userLocation={userLocation}
        initialLocation={value && typeof value === 'object' && value.lat && value.lng ? value : null}
        title={label || "Select Location"}
      />
    </div>
  );
}
