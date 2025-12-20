import React, { useEffect, useRef, useState } from 'react';
import './MapPicker.css';

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

  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (!googleKey) {
      setError('Google Maps API key is not configured. Please set REACT_APP_GOOGLE_MAPS_API_KEY in your environment variables.');
      return;
    }

    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setMapsLoaded(true);
          setTimeout(initializeMap, 100);
        });
        if (window.google && window.google.maps) {
          setMapsLoaded(true);
          setTimeout(initializeMap, 100);
        }
      } else {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setMapsLoaded(true);
          setTimeout(initializeMap, 100);
        };
        script.onerror = () => {
          setError('Failed to load Google Maps. Please check your API key and network connection.');
        };
        document.head.appendChild(script);
      }
    } else {
      setMapsLoaded(true);
      setTimeout(initializeMap, 100);
    }

    return () => {
      // Cleanup
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [isOpen, googleKey, userLocation]);

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const defaultCenter = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: 12.9716, lng: 77.5946 }; // Default to Bangalore, India

    // Initialize map
    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: userLocation ? 15 : 12,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;

    // If initial location is provided, set it up
    if (initialLocation && initialLocation.lat && initialLocation.lng) {
      map.setCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
      map.setZoom(17);
      handleLocationSelect(initialLocation);
    }

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

    // Initialize autocomplete
    if (searchInputRef.current && window.google.maps.places) {
      try {
        const autocomplete = new window.google.maps.places.Autocomplete(
          searchInputRef.current,
          {
            types: ['address', 'establishment'],
            componentRestrictions: { country: 'in' }, // Restrict to India
            fields: ['geometry', 'formatted_address', 'address_components', 'place_id'],
          }
        );

        autocompleteRef.current = autocomplete;

        // When place is selected from autocomplete
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            handleLocationSelect({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              address: place.formatted_address,
              place_id: place.place_id,
              address_components: place.address_components,
            });
          }
        });
      } catch (error) {
        console.error('[MapPicker] Error initializing autocomplete:', error);
      }
    }

    // Add click listener to map
    map.addListener('click', (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      
      // Reverse geocode to get address
      setIsGeocoding(true);
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setIsGeocoding(false);
        if (status === 'OK' && results[0]) {
          handleLocationSelect({
            lat,
            lng,
            address: results[0].formatted_address,
            place_id: results[0].place_id,
            address_components: results[0].address_components,
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
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        setIsGeocoding(true);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setIsGeocoding(false);
          if (status === 'OK' && results[0]) {
            const newLocation = {
              lat,
              lng,
              address: results[0].formatted_address,
              place_id: results[0].place_id,
              address_components: results[0].address_components,
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
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
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
            <p>Please set REACT_APP_GOOGLE_MAPS_API_KEY in your environment variables.</p>
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
                {isLoading ? '⏳' : '📍'} Use Current Location
              </button>
              <button onClick={handleConfirm} className="btn-confirm">
                Confirm Location
              </button>
            </div>
          </div>
        )}

        {!selectedLocation && (
          <div className="map-picker-instructions">
            <p>💡 Search for a location, click on the map, or use your current location</p>
            <button onClick={handleUseCurrentLocation} className="btn-current-location-inline" disabled={isLoading}>
              {isLoading ? '⏳ Loading...' : '📍 Use Current Location'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPicker;

