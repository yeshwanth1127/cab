import React, { useState, useEffect, useRef } from 'react';
import { searchPlaces, getCurrentLocation, getAddressFromCoordinates } from '../services/locationService';
import './LocationInput.css';

const LocationInput = ({ 
  value, 
  onChange, 
  placeholder, 
  label, 
  userLocation,
  onLocationRequest,
  showCurrentLocation = true 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = async (e) => {
    const inputValue = e.target.value;
    onChange(inputValue);

    if (inputValue.length >= 2) {
      setIsLoading(true);
      try {
        const results = await searchPlaces(inputValue, userLocation);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleUseCurrentLocation = async () => {
    setIsRequestingLocation(true);
    try {
      const location = await getCurrentLocation();
      const address = await getAddressFromCoordinates(location.lat, location.lng);
      onChange(address);
      if (onLocationRequest) {
        onLocationRequest(location);
      }
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      alert('Unable to get your location. Please enable location access in your browser settings.');
    } finally {
      setIsRequestingLocation(false);
    }
  };

  return (
    <div className="location-input-container">
      <label>{label}</label>
      <div className="location-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
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
            {isRequestingLocation ? '📍' : '📍'}
          </button>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="suggestions-dropdown">
          {isLoading && <div className="suggestion-item loading">Loading suggestions...</div>}
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="suggestion-name">{suggestion.name}</div>
              {suggestion.type && (
                <div className="suggestion-type">{suggestion.type}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationInput;

