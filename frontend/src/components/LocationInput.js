import React, { useEffect, useRef, useState } from 'react';
import './LocationInput.css';

const LocationInput = ({ 
  value, 
  onSelect, 
  placeholder, 
  label,
  showCurrentLocation = true 
}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  // Check if Google Maps is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete) {
        setIsGoogleMapsLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGoogleMaps()) {
      return;
    }

    // Poll for Google Maps to load
    const interval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Initialize Google Places Autocomplete (legacy API - still works, just deprecated)
  useEffect(() => {
    if (!isGoogleMapsLoaded || !inputRef.current) return;

    // Clean up previous instance
    if (autocompleteRef.current) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }

    // Use legacy Autocomplete (works reliably, just shows deprecation warning)
    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ['geocode'],
        componentRestrictions: { country: 'in' },
        fields: ['formatted_address', 'geometry', 'name']
      }
    );

    // Handle place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry) {
        console.warn('No geometry found for selected place');
        return;
      }

      const location = {
        address: place.formatted_address || place.name || '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };

      if (onSelect) {
        onSelect(location);
      }
    });

    // Set initial value if provided
    if (value && typeof value === 'object' && value.address) {
      inputRef.current.value = value.address;
    } else if (value && typeof value === 'string') {
      inputRef.current.value = value;
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isGoogleMapsLoaded, onSelect, value]);

  // Update input value when value prop changes
  useEffect(() => {
    if (inputRef.current) {
      if (value && typeof value === 'object' && value.address) {
        inputRef.current.value = value.address;
      } else if (value && typeof value === 'string') {
        inputRef.current.value = value;
      } else if (!value) {
        inputRef.current.value = '';
      }
    }
  }, [value]);

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsRequestingLocation(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Use Google Geocoding API to get address from coordinates
      if (isGoogleMapsLoaded && window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setIsRequestingLocation(false);
          if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
            const location = {
              address: results[0].formatted_address,
              lat,
              lng
            };
            if (onSelect) {
              onSelect(location);
            }
            if (inputRef.current) {
              inputRef.current.value = results[0].formatted_address;
            }
          } else {
            // Fallback: use coordinates as address
            const location = {
              address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              lat,
              lng
            };
            if (onSelect) {
              onSelect(location);
            }
            if (inputRef.current) {
              inputRef.current.value = location.address;
            }
          }
        });
      } else {
        // Fallback: use coordinates as address
        setIsRequestingLocation(false);
        const location = {
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng
        };
        if (onSelect) {
          onSelect(location);
        }
        if (inputRef.current) {
          inputRef.current.value = location.address;
        }
      }
    } catch (error) {
      setIsRequestingLocation(false);
      console.error('Error getting current location:', error);
      alert('Unable to get your location. Please enable location access in your browser settings.');
    }
  };

  return (
    <div className="location-input-container">
      {label && <label>{label}</label>}
      <div className="location-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder || 'Enter location'}
          className="location-input"
        />
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
      {!isGoogleMapsLoaded && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          Loading location services...
        </div>
      )}
    </div>
  );
};

export default LocationInput;
