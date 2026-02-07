import React, { useEffect, useRef, useState } from 'react';
import './MapPicker.css';
import Icon from './Icon';
import { loadGoogleMaps } from '../utils/googleMapsLoader';

const MapPicker = ({ isOpen, onClose, onSelect, userLocation, initialLocation, title = "Select Location" }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY_NEW;
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (!googleKey) {
      setError('Google Maps API key is not configured. Please set REACT_APP_GOOGLE_MAPS_API_KEY_NEW in your environment variables.');
      return;
    }

    // Helper function to check if Google Maps is fully loaded
    const isGoogleMapsReady = () => {
      return window.google && 
             window.google.maps && 
             window.google.maps.Map &&
             typeof window.google.maps.Map === 'function';
    };

    // Helper function to wait for Google Maps to be ready
    const waitForGoogleMaps = (callback, maxAttempts = 50) => {
      let attempts = 0;
      const checkReady = () => {
        attempts++;
        if (isGoogleMapsReady()) {
          callback();
        } else if (attempts < maxAttempts) {
          setTimeout(checkReady, 100);
        } else {
          setError('Google Maps failed to load. Please refresh the page.');
        }
      };
      checkReady();
    };

    loadGoogleMaps(googleKey)
      .then(() => {
        setMapsLoaded(true);
        setTimeout(initializeMap, 100);
      })
      .catch((err) => {
        setError('Failed to load Google Maps. Please check your API key and network connection.');
      });

    return () => {
      // Cleanup
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [isOpen, googleKey, userLocation]);

  const initializeMap = () => {
    // Verify Google Maps API is fully loaded
    if (!mapRef.current) {
      console.error('[MapPicker] Map container not available');
      return;
    }

    if (!window.google || !window.google.maps) {
      console.error('[MapPicker] Google Maps API not loaded');
      setError('Google Maps API failed to load. Please refresh the page.');
      return;
    }

    if (typeof window.google.maps.Map !== 'function') {
      console.error('[MapPicker] Google Maps Map constructor not available');
      setError('Google Maps API is not fully loaded. Please wait a moment and try again.');
      // Retry after a short delay
      setTimeout(() => {
        if (typeof window.google.maps.Map === 'function') {
          initializeMap();
        }
      }, 500);
      return;
    }

    const defaultCenter = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: 12.9716, lng: 77.5946 }; // Default to Bangalore, India

    try {
      // Initialize map
      const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: userLocation ? 15 : 12,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;

    // Add marker for user location if available
    if (userLocation) {
      new window.google.maps.Marker({
        position: defaultCenter,
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        title: 'Your Location',
        zIndex: 1,
      });
    }

    // If initial location is provided, set it up after map is ready
    if (initialLocation && initialLocation.lat && initialLocation.lng) {
      setTimeout(() => {
        map.setCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
        map.setZoom(17);
        handleLocationSelect(initialLocation);
      }, 100);
    }

    // Initialize autocomplete
    if (searchInputRef.current && window.google.maps.places) {
      try {
        const autocomplete = new window.google.maps.places.Autocomplete(
          searchInputRef.current,
          {
            types: ['address', 'establishment'], // Addresses + establishments, India only
            componentRestrictions: { country: 'in' },
            fields: ['geometry', 'formatted_address', 'address_components', 'place_id', 'name'],
          }
        );

        autocompleteRef.current = autocomplete;

        // Bind autocomplete to map bounds for better suggestions
        autocomplete.bindTo('bounds', map);

        // When place is selected from autocomplete
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            const loc = place.geometry.location;
            // Pan map to selected place
            map.panTo(loc);
            map.setZoom(16);
            
            handleLocationSelect({
              lat: loc.lat(),
              lng: loc.lng(),
              address: place.formatted_address,
              place_id: place.place_id,
              name: place.name,
              address_components: place.address_components,
            });
          }
        });
      } catch (error) {
        console.error('[MapPicker] Error initializing autocomplete:', error);
      }
    }

    // Add click listener to map - follows Google's recommended pattern
    // Using MapMouseEvent.latLng as per Google Maps documentation
    map.addListener('click', (event) => {
      // event.latLng is the recommended way to get coordinates from click
      const latLng = event.latLng;
      if (!latLng) return;
      
      const lat = latLng.lat();
      const lng = latLng.lng();
      
      // Reverse geocode to get address (TOS-compliant: only for user-selected locations)
      setIsGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();
      
      // Restrict geocoding to India for better results
      geocoder.geocode({ 
        location: { lat, lng },
        region: 'in' // Bias results to India
      }, (results, status) => {
        setIsGeocoding(false);
        if (status === 'OK' && results && results[0]) {
          // Filter to ensure result is in India (additional safety check)
          const result = results.find(r => {
            const components = r.address_components || [];
            return components.some(comp => 
              comp.types.includes('country') && comp.short_name === 'IN'
            );
          }) || results[0]; // Fallback to first result if no India match
          
          handleLocationSelect({
            lat,
            lng,
            address: result.formatted_address,
            place_id: result.place_id,
            address_components: result.address_components,
          });
        } else {
          // Fallback: use coordinates as address
          handleLocationSelect({
            lat,
            lng,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
        }
      });
    });
    } catch (error) {
      console.error('[MapPicker] Error initializing map:', error);
      setError(`Failed to initialize map: ${error.message}. Please refresh the page.`);
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    
    // Update marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    if (mapInstanceRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapInstanceRef.current,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
      });

      // Center map on selected location
      mapInstanceRef.current.setCenter({ lat: location.lat, lng: location.lng });
      mapInstanceRef.current.setZoom(17);

      // Update location when marker is dragged
      markerRef.current.addListener('dragend', (event) => {
        const latLng = event.latLng;
        if (!latLng) return;
        
        const lat = latLng.lat();
        const lng = latLng.lng();
        
        setIsGeocoding(true);
        const geocoder = new window.google.maps.Geocoder();
        // Restrict geocoding to India
        geocoder.geocode({ 
          location: { lat, lng },
          region: 'in' // Bias results to India
        }, (results, status) => {
          setIsGeocoding(false);
          if (status === 'OK' && results && results[0]) {
            // Filter to ensure result is in India
            const result = results.find(r => {
              const components = r.address_components || [];
              return components.some(comp => 
                comp.types.includes('country') && comp.short_name === 'IN'
              );
            }) || results[0];
            
            const newLocation = {
              lat,
              lng,
              address: result.formatted_address,
              place_id: result.place_id,
              address_components: result.address_components,
            };
            setSelectedLocation(newLocation);
          }
        });
      });
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      // Ensure we return the location in the expected format: {address, lat, lng}
      const locationData = {
        address: selectedLocation.address,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng
      };
      onSelect(locationData);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedLocation(initialLocation || null);
    setSearchQuery('');
    setError(null);
    onClose();
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(17);
          
          // Trigger reverse geocoding
          setIsGeocoding(true);
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            setIsGeocoding(false);
            setIsLoading(false);
            if (status === 'OK' && results[0]) {
              handleLocationSelect({
                lat,
                lng,
                address: results[0].formatted_address,
                place_id: results[0].place_id,
                address_components: results[0].address_components,
              });
            } else {
              handleLocationSelect({
                lat,
                lng,
                address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              });
            }
          });
        }
      },
      (error) => {
        setIsLoading(false);
        setError('Unable to get your location. Please enable location access.');
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  if (!isOpen) return null;

  if (error) {
    return (
      <div className="map-picker-overlay" onClick={handleClose}>
        <div className="map-picker-modal" onClick={(e) => e.stopPropagation()}>
          <div className="map-picker-error">
            <h3>Error Loading Map</h3>
            <p>{error}</p>
            <button onClick={handleClose} className="btn-close">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!googleKey) {
    return (
      <div className="map-picker-overlay" onClick={handleClose}>
        <div className="map-picker-modal" onClick={(e) => e.stopPropagation()}>
          <div className="map-picker-error">
            <h3>Google Maps API Key Required</h3>
            <p>Please set REACT_APP_GOOGLE_MAPS_API_KEY_NEW in your environment variables.</p>
            <button onClick={handleClose} className="btn-close">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-picker-overlay" onClick={handleClose}>
      <div className="map-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="map-picker-header">
          <h3>{title}</h3>
          <button onClick={handleClose} className="btn-close">×</button>
        </div>
        
        <div className="map-picker-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="map-picker-search-input"
          />
          {(isLoading || isGeocoding) && <div className="map-picker-loading">Loading...</div>}
        </div>

        <div className="map-picker-map-container">
          {!mapsLoaded && (
            <div className="map-picker-loading-overlay">
              <div className="map-picker-spinner"></div>
              <p>Loading map...</p>
            </div>
          )}
          <div ref={mapRef} className="map-picker-map" style={{ display: mapsLoaded ? 'block' : 'none' }} />
        </div>

        {selectedLocation && (
          <div className="map-picker-selected">
            <div className="selected-location-info">
              <strong>Selected:</strong>
              <p>{selectedLocation.address}</p>
            </div>
            <div className="map-picker-actions">
              <button onClick={handleUseCurrentLocation} className="btn-current-location" disabled={isLoading}>
                {isLoading ? <Icon name="loading" size={18} className="map-picker-btn-icon" /> : <Icon name="pin" size={18} className="map-picker-btn-icon" />} Use Current Location
              </button>
              <button onClick={handleConfirm} className="btn-confirm">
                Confirm Location
              </button>
            </div>
          </div>
        )}

        {!selectedLocation && (
          <div className="map-picker-instructions">
            <p className="map-picker-instructions-text"><Icon name="pin" size={18} className="map-picker-instructions-icon" /> Search for a location, click on the map, or use your current location</p>
            <button onClick={handleUseCurrentLocation} className="btn-current-location-inline" disabled={isLoading}>
              {isLoading ? <><Icon name="loading" size={18} className="map-picker-btn-icon" /> Loading...</> : <><Icon name="pin" size={18} className="map-picker-btn-icon" /> Use Current Location</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPicker;

