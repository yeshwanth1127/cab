import { useEffect, useRef, useState } from "react";
import './LocationInput.css';
import MapPicker from './MapPicker';

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
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Initialize query from value prop
  useEffect(() => {
    if (value && typeof value === 'object' && value.address) {
      setQuery(value.address);
    } else if (value && typeof value === 'string') {
      setQuery(value);
    } else if (!value) {
      setQuery('');
    }
  }, [value]);

  // Hybrid autocomplete: Try Geoapify first, fallback to Google Maps
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const geoapifyKey = process.env.REACT_APP_GEOAPIFY_KEY;
    const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

    if (!geoapifyKey && !googleKey) {
      console.error('[LocationInput] No API keys available! Set REACT_APP_GEOAPIFY_KEY or REACT_APP_GOOGLE_MAPS_API_KEY');
      setResults([]);
      return;
    }

    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      let suggestions = [];
      let source = '';

      // Check if query looks like coordinates (e.g., "12.9761, 77.7126")
      const coordPattern = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
      const isCoordinates = coordPattern.test(query.trim());

      // Try Geoapify first (skip if query is coordinates - Geoapify doesn't handle reverse geocoding well in autocomplete)
      if (geoapifyKey && !isCoordinates) {
      try {
        const params = new URLSearchParams({
          text: query,
            limit: 25,
            apiKey: geoapifyKey,
            format: "json",
            // Prioritize addresses but don't restrict too much
            layers: "address,street,venue",
            // Enable non-verified addresses for street-level suggestions
            allowNonVerifiedStreet: "true",
            allowNonVerifiedHouseNumber: "true"
          });

          // Optional: Add country filter only if user location suggests India
          // Removed strict country filter to get more results

        if (userLocation) {
            // Use circle bias for better proximity results
            params.append("bias", `circle:${userLocation.lng},${userLocation.lat},2000`);
        }

        const url = `https://api.geoapify.com/v1/geocode/autocomplete?${params}`;
          console.log('[LocationInput] Trying Geoapify for:', query.substring(0, 20) + '...');

        const res = await fetch(url);

          if (res.ok) {
            const data = await res.json();
            let geoapifyResults = data.results || data.features || [];
            
            // Score and prioritize street-level addresses with confidence
            geoapifyResults = geoapifyResults
              .map((place, index) => {
                const props = place.properties || place;
                const hasHouseNumber = props.housenumber || props.house_number;
                const hasStreet = props.street || props.road;
                const hasPostcode = props.postcode;
                
                // Get confidence scores from rank object
                const rank = props.rank || {};
                const confidence = rank.confidence || 0;
                const confidenceStreet = rank.confidence_street_level || 0;
                const confidenceBuilding = rank.confidence_building_level || 0;
                
                let score = 0;
                if (hasHouseNumber) score += 3;
                if (hasStreet) score += 2;
                if (hasPostcode) score += 1;
                if (props.category === 'building' || props.category === 'address') score += 2;
                // Boost score based on confidence
                score += confidenceBuilding * 2; // Building-level confidence is most important
                score += confidenceStreet * 1.5; // Street-level confidence is also important
                score += confidence * 0.5; // Overall confidence
                
                return { 
                  ...place, 
                  _score: score, 
                  _index: index, 
                  _source: 'geoapify',
                  _confidence: {
                    overall: confidence,
                    street: confidenceStreet,
                    building: confidenceBuilding
                  }
                };
              })
              .sort((a, b) => {
                if (b._score !== a._score) return b._score - a._score;
                return a._index - b._index;
              })
              .slice(0, 20)
              .map(({ _score, _index, _source, _confidence, ...place }) => ({ 
                ...place, 
                _source: _source,
                _confidence: _confidence
              }));
            
            if (geoapifyResults.length > 0) {
              suggestions = geoapifyResults;
              source = 'Geoapify';
              console.log('[LocationInput] Got', suggestions.length, 'results from Geoapify');
              // Log confidence scores for debugging
              suggestions.forEach((s, idx) => {
                const props = s.properties || s;
                const conf = s._confidence || {};
                console.log(`[LocationInput] Result ${idx + 1}: ${props.housenumber || ''} ${props.street || props.road || ''} - Confidence: building=${conf.building?.toFixed(2) || 'N/A'}, street=${conf.street?.toFixed(2) || 'N/A'}, overall=${conf.overall?.toFixed(2) || 'N/A'}`);
              });
            }
          }
        } catch (error) {
          console.warn('[LocationInput] Geoapify error:', error);
        }
      }

      // Google Maps API service commented out for testing Geoapify
      // Fallback to Google Maps if no results from Geoapify
      // Note: Google Maps Places Autocomplete REST API has CORS restrictions
      // We use the JavaScript API's Autocomplete service instead (loaded separately)
      /*
      if (suggestions.length === 0 && googleKey) {
        try {
          // Use Google Maps JavaScript API Autocomplete service (no CORS issues)
          if (!window.google || !window.google.maps || !window.google.maps.places) {
            // Load Google Maps script if not loaded
            await new Promise((resolve, reject) => {
              if (window.google && window.google.maps && window.google.maps.places) {
                resolve();
                return;
              }
              
              const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
              if (existingScript) {
                existingScript.addEventListener('load', resolve);
                if (window.google && window.google.maps && window.google.maps.places) {
                  resolve();
                }
                return;
              }
              
              const script = document.createElement('script');
              script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places&loading=async`;
              script.async = true;
              script.defer = true;
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
          }

          if (window.google && window.google.maps && window.google.maps.places) {
            const service = new window.google.maps.places.AutocompleteService();
            
            const request = {
              input: query,
              types: ['address'], // Prioritize addresses
            };
            
            if (userLocation) {
              // Use locationBias instead of deprecated location/radius
              request.locationBias = {
                center: new window.google.maps.LatLng(userLocation.lat, userLocation.lng),
                radius: 10000
              };
            }

            // Get predictions using JavaScript API (no CORS issues)
            service.getPlacePredictions(request, (predictions, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                // Filter to prioritize street addresses
                const filteredPredictions = predictions
                  .filter(prediction => {
                    const desc = prediction.description.toLowerCase();
                    const hasAddressIndicators = 
                      /\d/.test(desc) || 
                      desc.includes('street') || desc.includes('road') || 
                      desc.includes('avenue') || desc.includes('lane') ||
                      desc.includes('nagar') || desc.includes('colony') ||
                      desc.includes('sector') || desc.includes('block') ||
                      desc.includes('plot') || desc.includes('house');
                    
                    return hasAddressIndicators || 
                           prediction.types.includes('street_address') ||
                           prediction.types.includes('premise') ||
                           prediction.types.includes('subpremise');
                  })
                  .slice(0, 8);

                // Get place details for coordinates
                const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
                
                Promise.all(
                  filteredPredictions.map(prediction => {
                    return new Promise((resolve) => {
                      placesService.getDetails(
                        {
                          placeId: prediction.place_id,
                          fields: ['geometry', 'formatted_address', 'address_components']
                        },
                        (place, status) => {
                          if (status === window.google.maps.places.PlacesServiceStatus.OK && place && place.geometry) {
                            resolve({
                              _source: 'google',
                              place_id: prediction.place_id,
                              description: prediction.description,
                              formatted: prediction.description,
                              lat: place.geometry.location.lat(),
                              lng: place.geometry.location.lng(),
                              address_components: place.address_components || []
                            });
                          } else {
                            resolve(null);
                          }
                        }
                      );
                    });
                  })
                ).then(googleResults => {
                  const validResults = googleResults.filter(r => r !== null);
                  if (validResults.length > 0) {
                    suggestions = validResults;
                    source = 'Google Maps';
                    console.log('[LocationInput] Got', suggestions.length, 'results from Google Maps');
                    setResults(suggestions);
                  }
                });
              } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                // Try without type restriction
                const fallbackRequest = {
                  input: query,
                };
                
                if (userLocation) {
                  // Use locationBias instead of deprecated location/radius
                  fallbackRequest.locationBias = {
                    center: new window.google.maps.LatLng(userLocation.lat, userLocation.lng),
                    radius: 10000
                  };
                }

                service.getPlacePredictions(fallbackRequest, (fallbackPredictions, fallbackStatus) => {
                  if (fallbackStatus === window.google.maps.places.PlacesServiceStatus.OK && fallbackPredictions) {
                    const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
                    
                    Promise.all(
                      fallbackPredictions.slice(0, 8).map(prediction => {
                        return new Promise((resolve) => {
                          placesService.getDetails(
                            {
                              placeId: prediction.place_id,
                              fields: ['geometry', 'formatted_address', 'address_components']
                            },
                            (place, status) => {
                              if (status === window.google.maps.places.PlacesServiceStatus.OK && place && place.geometry) {
                                resolve({
                                  _source: 'google',
                                  place_id: prediction.place_id,
                                  description: prediction.description,
                                  formatted: prediction.description,
                                  lat: place.geometry.location.lat(),
                                  lng: place.geometry.location.lng(),
                                  address_components: place.address_components || []
                                });
                              } else {
                                resolve(null);
                              }
                            }
                          );
                        });
                      })
                    ).then(googleResults => {
                      const validResults = googleResults.filter(r => r !== null);
                      if (validResults.length > 0) {
                        suggestions = validResults;
                        source = 'Google Maps';
                        console.log('[LocationInput] Got', suggestions.length, 'results from Google Maps (fallback)');
        setResults(suggestions);
                      }
                    });
                  }
                });
              }
            });
          }
      } catch (error) {
          console.error('[LocationInput] Google Maps error:', error);
        }
      }
      */

      if (suggestions.length === 0) {
        console.warn('[LocationInput] No suggestions found from any source for:', query);
      } else {
        console.log('[LocationInput] Using', source, '-', suggestions.length, 'suggestions');
      }
      
      setResults(suggestions);
    }, 300); // debounce

    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [query, userLocation]);

  const handleSelect = (place) => {
    let location;
    
    // Handle Google Maps format
    if (place._source === 'google') {
      location = {
        address: place.formatted || place.description,
        lat: place.lat,
        lng: place.lng
      };
    }
    // Handle Geoapify formats
    else {
      const props = place.properties || place;
      
      if (place.lat !== undefined && place.lon !== undefined) {
        // Geoapify results format - build more complete address
        const addressParts = [];
        if (props.housenumber || props.house_number) {
          addressParts.push(props.housenumber || props.house_number);
        }
        if (props.street || props.road) {
          addressParts.push(props.street || props.road);
        }
        if (props.city || props.town || props.village) {
          addressParts.push(props.city || props.town || props.village);
        }
        if (props.postcode) {
          addressParts.push(props.postcode);
        }
        
        const formattedAddress = props.formatted || 
          (addressParts.length > 0 ? addressParts.join(', ') : place.address_line1) ||
          `${place.lat}, ${place.lon}`;
        
        location = {
          address: formattedAddress,
          lat: place.lat,
          lng: place.lon
      };
    } else if (place.properties && place.geometry) {
        // Geoapify features format (GeoJSON) - build more complete address
        const addressParts = [];
        if (props.housenumber || props.house_number) {
          addressParts.push(props.housenumber || props.house_number);
        }
        if (props.street || props.road) {
          addressParts.push(props.street || props.road);
        }
        if (props.city || props.town || props.village) {
          addressParts.push(props.city || props.town || props.village);
        }
        if (props.postcode) {
          addressParts.push(props.postcode);
        }
        
        const formattedAddress = props.formatted || 
          (addressParts.length > 0 ? addressParts.join(', ') : props.address_line1) ||
          `${place.geometry.coordinates[1]}, ${place.geometry.coordinates[0]}`;
        
      location = {
          address: formattedAddress,
        lat: place.geometry.coordinates[1],
        lng: place.geometry.coordinates[0]
      };
    } else {
      console.error('[LocationInput] Unknown place format:', place);
      return;
      }
    }

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
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Use Geoapify reverse geocoding to get address from coordinates
      try {
        const params = new URLSearchParams({
          lat: lat.toString(),
          lon: lng.toString(),
          apiKey: process.env.REACT_APP_GEOAPIFY_KEY,
          format: "json",
          // Request detailed address information
          addressdetails: "1"
        });

        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?${params}`
        );

        if (res.ok) {
          const data = await res.json();
          // Geoapify reverse geocoding returns 'results' array
          const results = data.results || data.features || [];
          if (results.length > 0) {
            const place = results[0];
            const props = place.properties || place;
            
            // Build complete address from components
            const addressParts = [];
            if (props.housenumber || props.house_number) {
              addressParts.push(props.housenumber || props.house_number);
            }
            if (props.street || props.road) {
              addressParts.push(props.street || props.road);
            }
            if (props.city || props.town || props.village) {
              addressParts.push(props.city || props.town || props.village);
            }
            if (props.postcode) {
              addressParts.push(props.postcode);
            }
            
            // Handle both formats: results (direct lat/lon) and features (geometry.coordinates)
            let location;
            if (place.lat !== undefined && place.lon !== undefined) {
              const formattedAddress = props.formatted || 
                (addressParts.length > 0 ? addressParts.join(', ') : props.address_line1) ||
                `${place.lat}, ${place.lon}`;
              location = {
                address: formattedAddress,
                lat: place.lat,
                lng: place.lon
              };
            } else if (place.properties && place.geometry) {
              const formattedAddress = props.formatted || 
                (addressParts.length > 0 ? addressParts.join(', ') : props.address_line1) ||
                `${place.geometry.coordinates[1]}, ${place.geometry.coordinates[0]}`;
              location = {
                address: formattedAddress,
                lat: place.geometry.coordinates[1],
                lng: place.geometry.coordinates[0]
              };
            } else {
              throw new Error('Unexpected response format');
            }
            setQuery(location.address);
            if (onSelect) {
              onSelect(location);
            }
            setIsRequestingLocation(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
      }

      // Fallback: use coordinates as address
      const location = {
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng
      };
      setQuery(location.address);
      if (onSelect) {
        onSelect(location);
      }
      setIsRequestingLocation(false);
    } catch (error) {
      setIsRequestingLocation(false);
      console.error('Error getting current location:', error);
      alert('Unable to get your location. Please enable location access in your browser settings.');
    }
  };

  // Check if API key is available (only log once)
  const geoapifyKey = process.env.REACT_APP_GEOAPIFY_KEY;
  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (!geoapifyKey && !googleKey && query.length >= 2) {
    console.warn('[LocationInput] No API keys available! Set REACT_APP_GEOAPIFY_KEY or REACT_APP_GOOGLE_MAPS_API_KEY in your .env file and rebuild the app.');
  }

  return (
    <div className="location-input-container">
      {label && <label>{label}</label>}
      <div className="location-input-wrapper">
        <input
          type="text"
          value={query}
          placeholder={placeholder || 'Enter location'}
          onChange={(e) => setQuery(e.target.value)}
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
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="location-button map-button"
            title="Pick on Map"
          >
            🗺️
          </button>
        </div>
        {results.length > 0 && (
          <ul className="location-dropdown">
            {results.map((place, index) => {
              // Handle Google Maps format
              if (place._source === 'google') {
                const placeId = place.place_id || `google-${index}`;
                return (
                  <li
                    key={placeId}
                    onClick={() => handleSelect(place)}
                    className="suggestion-item"
                  >
                    <div className="suggestion-name">{place.formatted || place.description}</div>
                  </li>
                );
              }
              
              // Handle Geoapify formats
              const placeId = place.place_id || place.properties?.place_id || `place-${index}`;
              const props = place.properties || place;
              
              // Build detailed address display
              const addressParts = [];
              if (props.housenumber || props.house_number) {
                addressParts.push(props.housenumber || props.house_number);
              }
              if (props.street || props.road) {
                addressParts.push(props.street || props.road);
              }
              if (props.city || props.town || props.village) {
                addressParts.push(props.city || props.town || props.village);
              }
              if (props.postcode) {
                addressParts.push(props.postcode);
              }
              
              const formatted = props.formatted || 
                (addressParts.length > 0 ? addressParts.join(', ') : props.address_line1) ||
                'Unknown location';
              
              // Show secondary info (city/area) if available
              const secondaryInfo = props.city || props.town || props.village || props.district || '';
              
              // Show confidence indicator if available
              const confidence = place._confidence;
              const confidenceLevel = confidence?.building || confidence?.street || confidence?.overall || 0;
              const isLowConfidence = confidenceLevel < 0.5;
              
              return (
                <li
                  key={placeId}
                  onClick={() => handleSelect(place)}
                  className={`suggestion-item ${isLowConfidence ? 'low-confidence' : ''}`}
                >
                  <div className="suggestion-name">
                    {formatted}
                    {isLowConfidence && (
                      <span className="confidence-warning" title="Unverified address - please confirm on map">
                        ⚠️
                      </span>
                    )}
                  </div>
                  {secondaryInfo && secondaryInfo !== formatted && (
                    <div className="suggestion-type">{secondaryInfo}</div>
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
          setQuery(locationData.address);
          if (onSelect) {
            onSelect(locationData);
          }
        }}
        userLocation={userLocation}
        title={label || "Select Location"}
      />
    </div>
  );
}

