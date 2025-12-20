import React, { useEffect, useRef, useState } from 'react';
import './MapPicker.css';

const MapPicker = ({ isOpen, onClose, onSelect, userLocation, title = "Select Location" }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Google Maps API service commented out for testing Geoapify
  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    // Google Maps functionality commented out for testing
    /*
    if (!isOpen || !googleKey) return;

    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', initializeMap);
        if (window.google && window.google.maps) {
          initializeMap();
        }
      } else {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = initializeMap;
        document.head.appendChild(script);
      }
    } else {
      // Small delay to ensure DOM is ready
      setTimeout(initializeMap, 100);
    }

    return () => {
      // Cleanup
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
    */
  }, [isOpen, googleKey, userLocation]);

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const defaultCenter = userLocation 
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: 28.6139, lng: 77.2090 }; // Default to Delhi, India

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
      setIsLoading(true);
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
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
        
        setIsLoading(true);
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setIsLoading(false);
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
      onSelect(selectedLocation);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedLocation(null);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  // Google Maps functionality temporarily disabled for testing Geoapify
  if (!googleKey || true) {
    return (
      <div className="map-picker-overlay" onClick={handleClose}>
        <div className="map-picker-modal" onClick={(e) => e.stopPropagation()}>
          <div className="map-picker-error">
            <h3>Map Picker Temporarily Disabled</h3>
            <p>Google Maps API service is commented out for testing Geoapify autocomplete. Map picker will be re-enabled with an alternative map provider.</p>
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
          {isLoading && <div className="map-picker-loading">Loading...</div>}
        </div>

        <div className="map-picker-map-container">
          <div ref={mapRef} className="map-picker-map" />
        </div>

        {selectedLocation && (
          <div className="map-picker-selected">
            <div className="selected-location-info">
              <strong>Selected:</strong>
              <p>{selectedLocation.address}</p>
            </div>
            <button onClick={handleConfirm} className="btn-confirm">
              Confirm Location
            </button>
          </div>
        )}

        <div className="map-picker-instructions">
          <p>💡 Search for a location or click on the map to select</p>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;

