import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import './LocationInput.css';
import MapPicker from './MapPicker';
import Icon from './Icon';
import api from '../services/api';

const localCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000;

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
  return `ac|${normalizedQuery}|${roundedLat}|${roundedLng}`;
}

function isKIAQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return q === 'kia' || q.startsWith('kia ') || q.endsWith(' kia') || q === '560300' || q.replace(/\s/g, '') === '560300';
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
  const sessionTokenRef = useRef(null);

  const getOrCreateSessionToken = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = uuidv4();
    }
    return sessionTokenRef.current;
  };

  const resetSessionToken = () => {
    sessionTokenRef.current = null;
  };

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

    if (query.length < 2) {
      setResults([]);
      selectedAddressRef.current = null;
      return;
    }

    if (selectedAddressRef.current && query === selectedAddressRef.current) {
      setResults([]);
      return;
    }

    setResults([]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {

      const cacheKey = getCacheKey(query, userLocation);
      

      const skipCache = isKIAQuery(query);
      if (!skipCache) {
        const cached = localCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
          localCache.delete(cacheKey);
          localCache.set(cacheKey, cached);
          setResults(cached.data);
          return;
        }
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {

        const sessionToken = getOrCreateSessionToken();

        const params = {
          q: query.trim(),
          sessionToken,
        };

        if (userLocation && userLocation.lat && userLocation.lng) {
          params.lat = userLocation.lat;
          params.lng = userLocation.lng;
        }

        const response = await api.get('/places/autocomplete', {
          params,
          signal,
          timeout: 1500,
        });

        if (signal.aborted) {
          return;
        }

        const predictions = response.data || [];

        if (localCache.size >= MAX_CACHE_SIZE) {

          const entriesToDelete = Math.floor(MAX_CACHE_SIZE * 0.2);
          const keys = Array.from(localCache.keys());
          for (let i = 0; i < entriesToDelete; i++) {
            localCache.delete(keys[i]);
          }
        }
        localCache.set(cacheKey, {
          data: predictions,
          timestamp: Date.now(),
        });

        setResults(predictions);
      } catch (error) {

        if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
          return;
        }
        
        console.warn('[LocationInput] Search failed:', error.message);
        setResults([]);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, userLocation]);

  const handleSelect = async (place) => {

    const sessionToken = sessionTokenRef.current;

    try {
      const response = await api.post('/places/details', {
        placeId: place.place_id,
        sessionToken,
      });

      const details = response.data;
      

      if (!details.lat || !details.lng) {
        throw new Error('Place details missing coordinates');
      }

      const location = {
        address: details.formatted || details.address,
        lat: details.lat,
        lng: details.lng,
      };

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      resetSessionToken();

      selectedAddressRef.current = location.address;
      setQuery(location.address);
      setResults([]);

      if (onSelect) {
        onSelect(location);
      }
    } catch (error) {
      console.error('[LocationInput] Failed to fetch place details:', error);
      

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      resetSessionToken();
      

      alert('Failed to get location details. Please try selecting the location again or use the map picker.');
      

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
        const response = await api.post('/places/reverse', {
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

          resetSessionToken();
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

      resetSessionToken();
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
              resetSessionToken();
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
              {isRequestingLocation ? <Icon name="loading" size={20} className="location-button-icon" /> : <Icon name="pin" size={20} className="location-button-icon" />}
            </button>
          )}
        </div>
        {results.length > 0 && (
          <ul className="location-dropdown">
            {results.map((place, index) => {
              const placeId = place.place_id || `place-${index}`;

              const mainText = place.main_text || place.description || 'Unknown location';
              const secondaryText = place.secondary_text || '';

              return (
                <li
                  key={placeId}
                  onClick={() => handleSelect(place)}
                  className="suggestion-item"
                >
                  <div className="suggestion-name">{mainText}</div>
                  {secondaryText && secondaryText !== mainText && (
                    <div className="suggestion-type"><Icon name="pin" size={14} className="suggestion-type-icon" /> {secondaryText}</div>
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
          resetSessionToken();
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
