import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LocationInput from '../components/LocationInput';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import LightRays from '../components/LightRays';
import MainNavbar from '../components/MainNavbar';
import './BookingPage.css';

const BookingPage = () => {
  const navigate = useNavigate();
  const [serviceType, setServiceType] = useState(null); // 'local', 'airport', 'outstation'
  const [fromLocation, setFromLocation] = useState(null); // {address, lat, lng}
  const [toLocation, setToLocation] = useState(null); // {address, lat, lng}
  const [tripType, setTripType] = useState(''); // For outstation: 'one_way', 'round_trip', 'multiple_way'
  // For outstation multiple way trips
  const [pickupLocation, setPickupLocation] = useState(null); // {address, lat, lng}
  const [stopA, setStopA] = useState(null); // {address, lat, lng}
  const [stopB, setStopB] = useState(null); // {address, lat, lng}
  const [dropLocation, setDropLocation] = useState(null); // {address, lat, lng}
  const [additionalStops, setAdditionalStops] = useState([]); // Array of location objects
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCarOptionId, setSelectedCarOptionId] = useState(null);
  const [numberOfHours, setNumberOfHours] = useState(''); // For local bookings only
  const [numberOfDays, setNumberOfDays] = useState(''); // For outstation round trips
  const [fare, setFare] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [bookingData, setBookingData] = useState({
    passenger_name: '',
    passenger_phone: '',
    passenger_email: '',
    travel_date: '',
    notes: '',
  });
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [expandedCarKey, setExpandedCarKey] = useState(null);
  const [carOptionCards, setCarOptionCards] = useState([]);
  const [allCarOptions, setAllCarOptions] = useState([]); // All cars for the Available Car Options section
  const [carImageIndices, setCarImageIndices] = useState({}); // Track image index per car
  const [showConfirmation, setShowConfirmation] = useState(false);

  const formatDuration = (minutes) => {
    if (!minutes || isNaN(minutes)) return null;
    const totalMinutes = Math.round(Number(minutes));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours <= 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min`;
  };

  // Initial load: optional geolocation prompt and fetch all car options
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Only try to use location once, and remember the choice in localStorage
    const consent = localStorage.getItem('locationConsent');
    if (!consent || consent === 'granted') {
      requestUserLocation();
    }
  }, []);

  // Fetch car options when service type is selected
  useEffect(() => {
    if (serviceType) {
      fetchCarOptions(serviceType);
      // Reset selected car when service type changes
      setSelectedCarOptionId(null);
      setCarImageIndices({});
      setNumberOfHours(''); // Reset hours when service type changes
      setTripType(''); // Reset trip type when service type changes
      setPickupLocation(null);
      setStopA(null);
      setStopB(null);
      setDropLocation(null);
      setAdditionalStops([]);
    } else {
      // If no service type selected, show all cars (or empty)
      setCarOptionCards([]);
      setSelectedCarOptionId(null);
      setNumberOfHours('');
      setTripType('');
      setPickupLocation(null);
      setStopA(null);
      setStopB(null);
      setDropLocation(null);
      setAdditionalStops([]);
    }
  }, [serviceType]);

  const requestUserLocation = async () => {
    try {
      if (!navigator.geolocation) {
        return;
      }
      
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const location = { lat, lng };
      
      setUserLocation(location);
      
      // Use Google Geocoding if available, otherwise use coordinates
      if (window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            setFromLocation({
              address: results[0].formatted_address,
              lat,
              lng
            });
          } else {
            setFromLocation({
              address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              lat,
              lng
            });
          }
        });
      } else {
        setFromLocation({
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng
        });
      }
      
      localStorage.setItem('locationConsent', 'granted');
    } catch (error) {
      console.error('Error getting location:', error);
      // Remember that user denied or location is unavailable so we don't ask again
      if (error.code === 1) { // PERMISSION_DENIED
        localStorage.setItem('locationConsent', 'denied');
      }
    }
  };

  const fetchCarOptions = async (serviceTypeFilter = null) => {
    try {
      const url = serviceTypeFilter 
        ? `/car-options?service_type=${serviceTypeFilter}`
        : '/car-options';
      const response = await api.get(url);
      // Ensure we always set an array
      const data = response.data;
      setCarOptionCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching public car options:', error);
      // Ensure we always have an array even on error
      setCarOptionCards([]);
    }
  };

  const fetchAllCarOptions = async () => {
    try {
      const response = await api.get('/car-options');
      // Ensure we always set an array
      const data = response.data;
      setAllCarOptions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching all car options:', error);
      // Ensure we always have an array even on error
      setAllCarOptions([]);
    }
  };

  const calculateFare = async () => {
    // Validation based on service type
    if (serviceType === 'local') {
      if (!serviceType || !fromLocation || !numberOfHours || !selectedCarOptionId) {
        alert('Please fill in all fields');
        return;
      }
    } else if (serviceType === 'outstation') {
      if (!serviceType || !tripType || !selectedCarOptionId) {
        alert('Please fill in all fields');
        return;
      }
      // Validate based on trip type
      if (tripType === 'one_way') {
        if (!pickupLocation || !dropLocation) {
          alert('Please fill in pickup and drop locations');
          return;
        }
      } else if (tripType === 'round_trip') {
        if (!pickupLocation || !numberOfDays) {
          alert('Please fill in pickup location and number of days');
          return;
        }
      } else if (tripType === 'multiple_way') {
        if (!pickupLocation || !stopA || !stopB || !dropLocation) {
          alert('Please fill in all required locations (Pickup, Stop A, Stop B, and Drop)');
          return;
        }
      }
    } else {
      // airport
      if (!serviceType || !fromLocation || !toLocation || !selectedCarOptionId) {
        alert('Please fill in all fields');
        return;
      }
    }

    setCalculating(true);
    try {
      const requestData = {
        service_type: serviceType,
        cab_type_id: selectedCarOptionId, // Pass selected car option ID for rate meter lookup
      };

      if (serviceType === 'local') {
        requestData.from = fromLocation ? { lat: fromLocation.lat, lng: fromLocation.lng } : null;
        requestData.from_location = fromLocation ? fromLocation.address : '';
        requestData.number_of_hours = parseInt(numberOfHours);
      } else if (serviceType === 'outstation') {
        requestData.trip_type = tripType;
        if (tripType === 'one_way') {
          requestData.from = pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null;
          requestData.to = dropLocation ? { lat: dropLocation.lat, lng: dropLocation.lng } : null;
          requestData.from_location = pickupLocation ? pickupLocation.address : '';
          requestData.to_location = dropLocation ? dropLocation.address : '';
        } else if (tripType === 'round_trip') {
          requestData.from = pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null;
          requestData.to = pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null; // Round trip returns to pickup
          requestData.from_location = pickupLocation ? pickupLocation.address : '';
          requestData.to_location = pickupLocation ? pickupLocation.address : '';
          requestData.number_of_days = parseInt(numberOfDays, 10);
        } else if (tripType === 'multiple_way') {
          requestData.from = pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null;
          requestData.from_location = pickupLocation ? pickupLocation.address : '';
          // For multiple way, we'll use the final drop location for distance calculation
          requestData.to = dropLocation ? { lat: dropLocation.lat, lng: dropLocation.lng } : null;
          requestData.to_location = dropLocation ? dropLocation.address : '';
          // Combine all stops and drop location for display
          const allStops = [stopA, stopB, ...additionalStops, dropLocation].filter(Boolean);
          requestData.stops = allStops.map(s => s.address || s);
        }
      } else {
        // airport
        requestData.from = fromLocation ? { lat: fromLocation.lat, lng: fromLocation.lng } : null;
        requestData.to = toLocation ? { lat: toLocation.lat, lng: toLocation.lng } : null;
        requestData.from_location = fromLocation ? fromLocation.address : '';
        requestData.to_location = toLocation ? toLocation.address : '';
      }

      console.log('[FRONTEND DEBUG] Sending calculate-fare request:', JSON.stringify(requestData, null, 2));
      
      const response = await api.post('/bookings/calculate-fare', requestData);
      
      console.log('[FRONTEND DEBUG] Received response:', JSON.stringify(response.data, null, 2));
      console.log('[FRONTEND DEBUG] Distance in response:', response.data.distance_km);
      console.log('[FRONTEND DEBUG] Time in response:', response.data.estimated_time_minutes);

      setFare(response.data);
      setShowBookingForm(true);
    } catch (error) {
      alert(error.response?.data?.error || 'Error calculating fare');
    } finally {
      setCalculating(false);
    }
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    // Show confirmation step instead of submitting directly
    setShowConfirmation(true);
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    setShowConfirmation(false);

    try {
      const bookingPayload = {
        service_type: serviceType,
        car_option_id: selectedCarOptionId,
        passenger_name: bookingData.passenger_name,
        passenger_phone: bookingData.passenger_phone,
        passenger_email: bookingData.passenger_email,
        travel_date: bookingData.travel_date,
        notes: bookingData.notes,
        fare_amount: fare.fare,
      };

      if (serviceType === 'local') {
        // Local: hours-based only, ignore distance from Google
        bookingPayload.from_location = fromLocation ? fromLocation.address : '';
        bookingPayload.from_lat = fromLocation ? fromLocation.lat : null;
        bookingPayload.from_lng = fromLocation ? fromLocation.lng : null;
        bookingPayload.number_of_hours = parseInt(numberOfHours);
        bookingPayload.distance_km = 0;
        bookingPayload.estimated_time_minutes = parseInt(numberOfHours) * 60;
      } else if (serviceType === 'outstation') {
        bookingPayload.trip_type = tripType;
        if (tripType === 'one_way') {
          bookingPayload.from_location = pickupLocation ? pickupLocation.address : '';
          bookingPayload.to_location = dropLocation ? dropLocation.address : '';
          bookingPayload.from_lat = pickupLocation ? pickupLocation.lat : null;
          bookingPayload.from_lng = pickupLocation ? pickupLocation.lng : null;
          bookingPayload.to_lat = dropLocation ? dropLocation.lat : null;
          bookingPayload.to_lng = dropLocation ? dropLocation.lng : null;
        } else if (tripType === 'round_trip') {
          bookingPayload.from_location = pickupLocation ? pickupLocation.address : '';
          bookingPayload.to_location = pickupLocation ? pickupLocation.address : ''; // Round trip returns to pickup
          bookingPayload.from_lat = pickupLocation ? pickupLocation.lat : null;
          bookingPayload.from_lng = pickupLocation ? pickupLocation.lng : null;
          bookingPayload.to_lat = pickupLocation ? pickupLocation.lat : null;
          bookingPayload.to_lng = pickupLocation ? pickupLocation.lng : null;
        } else if (tripType === 'multiple_way') {
          bookingPayload.from_location = pickupLocation ? pickupLocation.address : '';
          bookingPayload.from_lat = pickupLocation ? pickupLocation.lat : null;
          bookingPayload.from_lng = pickupLocation ? pickupLocation.lng : null;
          const allStops = [stopA, stopB, ...additionalStops, dropLocation].filter(Boolean);
          bookingPayload.to_location = allStops.map(s => s.address || s).join(' → ');
          bookingPayload.to_lat = dropLocation ? dropLocation.lat : null;
          bookingPayload.to_lng = dropLocation ? dropLocation.lng : null;
          bookingPayload.stops = JSON.stringify(allStops.map(s => s.address || s));
        }
        bookingPayload.distance_km = fare.distance_km || 0;
        bookingPayload.estimated_time_minutes = fare.estimated_time_minutes || 0;
      } else {
        // airport
        bookingPayload.from_location = fromLocation ? fromLocation.address : '';
        bookingPayload.to_location = toLocation ? toLocation.address : '';
        bookingPayload.from_lat = fromLocation ? fromLocation.lat : null;
        bookingPayload.from_lng = fromLocation ? fromLocation.lng : null;
        bookingPayload.to_lat = toLocation ? toLocation.lat : null;
        bookingPayload.to_lng = toLocation ? toLocation.lng : null;
        bookingPayload.distance_km = fare.distance_km;
        bookingPayload.estimated_time_minutes = fare.estimated_time_minutes;
      }

      const response = await api.post('/bookings', bookingPayload);

      setBookingSuccess(true);
      setBookingId(response.data.id);
      setShowBookingForm(false);
      
      // Reset form
      setFromLocation(null);
      setToLocation(null);
      setTripType('');
      setPickupLocation(null);
      setStopA(null);
      setStopB(null);
      setDropLocation(null);
      setAdditionalStops([]);
      setSelectedCarOptionId(null);
      setNumberOfHours('');
      setFare(null);
      setCarImageIndices({});
      setBookingData({
        passenger_name: '',
        passenger_phone: '',
        passenger_email: '',
        travel_date: '',
        notes: '',
      });
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating booking');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationUpdate = (location) => {
    if (location && location.lat && location.lng) {
      setUserLocation({ lat: location.lat, lng: location.lng });
    }
  };

  const toggleCarImages = (key) => {
    setExpandedCarKey((current) => (current === key ? null : key));
  };

  const getSelectedCarOption = () => {
    return carOptionCards.find(opt => opt.id === selectedCarOptionId);
  };

  const handleCarSelection = (carId) => {
    if (selectedCarOptionId !== carId) {
      setSelectedCarOptionId(carId);
      if (!carImageIndices[carId]) {
        setCarImageIndices({ ...carImageIndices, [carId]: 0 });
      }
    }
  };

  const updateCarImageIndex = (carId, newIndex) => {
    setCarImageIndices({ ...carImageIndices, [carId]: newIndex });
  };

  return (
    <div className="booking-page">
      <MainNavbar />
      
      <div className="flowing-banner">
        <div className="flowing-banner-content">
          <span>For immediate bookings, call +91 5547444589</span>
          <span>For immediate bookings, call +91 5547444589</span>
          <span>For immediate bookings, call +91 5547444589</span>
        </div>
      </div>

      <div className="container">
        <div className="booking-container">
          <div className="booking-map-wrapper">
            <AnimatedMapBackground />
          </div>
          <h2 className="booking-title">Book Your Cab @ Namma Cabs</h2>
          <div className="card booking-card">
            {bookingSuccess && (
              <div className="success-banner">
                <h3>✅ Booking Successful!</h3>
                <p>Your booking ID is: <strong>{bookingId}</strong></p>
                <p>We'll contact you soon to confirm your ride.</p>
                <div className="success-actions">
                  <a href={`/check-booking?id=${bookingId}`} className="btn btn-primary">
                    View Booking Details
                  </a>
                  <button onClick={() => setBookingSuccess(false)} className="btn btn-secondary">
                    Book Another Ride
                  </button>
                </div>
              </div>
            )}

            {!bookingSuccess && (
              <>
                <div className="form-group">
                  <label>Select Service Type *</label>
                  <div className="service-types-grid">
                    <button
                      type="button"
                      className={`service-type-button ${serviceType === 'local' ? 'selected' : ''}`}
                      onClick={() => setServiceType('local')}
                    >
                      <h3>Local</h3>
                      <p>Within city rides</p>
                    </button>
                    <button
                      type="button"
                      className={`service-type-button ${serviceType === 'airport' ? 'selected' : ''}`}
                      onClick={() => setServiceType('airport')}
                    >
                      <h3>Airport</h3>
                      <p>Airport pickup & drop</p>
                    </button>
                    <button
                      type="button"
                      className={`service-type-button ${serviceType === 'outstation' ? 'selected' : ''}`}
                      onClick={() => setServiceType('outstation')}
                    >
                      <h3>Outstation</h3>
                      <p>Inter-city travel</p>
                    </button>
                  </div>
                </div>

                {serviceType && (
                  <>
                    {serviceType === 'local' ? (
                      <>
                        <LocationInput
                          label="Pickup Location"
                          value={fromLocation}
                          onSelect={setFromLocation}
                          placeholder="Enter pickup location or click 📍 for current location"
                          showCurrentLocation={true}
                          userLocation={userLocation}
                        />

                        <div className="form-group">
                          <label>Number of Hours *</label>
                          <select
                            value={numberOfHours}
                            onChange={(e) => setNumberOfHours(e.target.value)}
                            required
                            className="hours-select"
                          >
                            <option value="">Select hours</option>
                            <option value="2">2 hours</option>
                            <option value="4">4 hours</option>
                            <option value="8">8 hours</option>
                            <option value="12">12 hours</option>
                          </select>
                        </div>
                      </>
                    ) : serviceType === 'outstation' ? (
                      <>
                        <div className="form-group">
                          <label>Trip Type *</label>
                          <select
                            value={tripType}
                            onChange={(e) => {
                              setTripType(e.target.value);
                              // Reset locations when trip type changes
                              setPickupLocation(null);
                              setStopA(null);
                              setStopB(null);
                              setDropLocation(null);
                              setAdditionalStops([]);
                            }}
                            required
                            className="hours-select"
                          >
                            <option value="">Select trip type</option>
                            <option value="one_way">One Way Trip</option>
                            <option value="round_trip">Round Trip</option>
                            <option value="multiple_way">Multiple Way</option>
                          </select>
                        </div>

                        {tripType === 'one_way' && (
                          <>
                            <LocationInput
                              label="Pickup Location *"
                              value={pickupLocation}
                              onSelect={setPickupLocation}
                              placeholder="Enter pickup location or click 📍 for current location"
                              showCurrentLocation={true}
                              userLocation={userLocation}
                            />
                            <LocationInput
                              label="Drop Location *"
                              value={dropLocation}
                              onSelect={setDropLocation}
                              placeholder="Enter drop location"
                              showCurrentLocation={false}
                              userLocation={userLocation}
                            />
                          </>
                        )}

                        {tripType === 'round_trip' && (
                          <>
                            <LocationInput
                              label="Pickup Location *"
                              value={pickupLocation}
                              onSelect={setPickupLocation}
                              placeholder="Enter pickup location or click 📍 for current location"
                              showCurrentLocation={true}
                              userLocation={userLocation}
                            />
                            <div className="form-group">
                              <label>Number of Days *</label>
                              <select
                                value={numberOfDays}
                                onChange={(e) => setNumberOfDays(e.target.value)}
                                required
                                className="hours-select"
                              >
                                <option value="">Select days</option>
                                <option value="1">1 day (300 km)</option>
                                <option value="2">2 days (600 km)</option>
                                <option value="3">3 days (900 km)</option>
                                <option value="4">4 days (1200 km)</option>
                                <option value="5">5 days (1500 km)</option>
                                <option value="6">6 days (1800 km)</option>
                                <option value="7">7 days (2100 km)</option>
                              </select>
                            </div>
                          </>
                        )}

                        {tripType === 'multiple_way' && (
                          <>
                            <LocationInput
                              label="Pickup Location *"
                              value={pickupLocation}
                              onSelect={setPickupLocation}
                              placeholder="Enter pickup location or click 📍 for current location"
                              showCurrentLocation={true}
                              userLocation={userLocation}
                            />
                            <LocationInput
                              label="Stop A *"
                              value={stopA}
                              onSelect={setStopA}
                              placeholder="Enter first stop location"
                              showCurrentLocation={false}
                              userLocation={userLocation}
                            />
                            <LocationInput
                              label="Stop B *"
                              value={stopB}
                              onSelect={setStopB}
                              placeholder="Enter second stop location"
                              showCurrentLocation={false}
                              userLocation={userLocation}
                            />
                            {additionalStops.map((stop, index) => (
                              <LocationInput
                                key={index}
                                label={`Stop ${String.fromCharCode(67 + index)} *`}
                                value={stop}
                                onSelect={(value) => {
                                  const newStops = [...additionalStops];
                                  newStops[index] = value;
                                  setAdditionalStops(newStops);
                                }}
                                placeholder={`Enter stop ${String.fromCharCode(67 + index)} location`}
                                showCurrentLocation={false}
                                userLocation={userLocation}
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => setAdditionalStops([...additionalStops, null])}
                              className="btn btn-secondary"
                              style={{ marginBottom: '10px' }}
                            >
                              + Add Another Stop
                            </button>
                            {additionalStops.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setAdditionalStops(additionalStops.slice(0, -1))}
                                className="btn btn-secondary"
                                style={{ marginBottom: '10px', marginLeft: '10px' }}
                              >
                                - Remove Last Stop
                              </button>
                            )}
                            <LocationInput
                              label="Drop Location *"
                              value={dropLocation}
                              onSelect={setDropLocation}
                              placeholder="Enter final drop location"
                              showCurrentLocation={false}
                              userLocation={userLocation}
                            />

                            <div className="form-group" style={{ 
                              marginTop: '20px', 
                              padding: '15px', 
                              backgroundColor: 'rgba(250, 204, 21, 0.1)', 
                              borderRadius: '8px',
                              border: '1px solid rgba(250, 204, 21, 0.3)'
                            }}>
                              <p style={{ margin: 0, fontWeight: 600, color: '#ffffff' }}>
                                📞 Need assistance? Contact us at: <a href="tel:+915547444589" style={{ color: '#facc15', textDecoration: 'none' }}>+91 5547444589</a>
                              </p>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <LocationInput
                          label="From Location"
                          value={fromLocation}
                          onSelect={setFromLocation}
                          placeholder="Enter pickup location or click 📍 for current location"
                          showCurrentLocation={true}
                          userLocation={userLocation}
                        />

                        <LocationInput
                          label="To Location"
                          value={toLocation}
                          onSelect={setToLocation}
                          placeholder="Enter destination"
                          showCurrentLocation={false}
                          userLocation={userLocation}
                        />
                      </>
                    )}

                    <div className="form-group">
                      <label>Select Car *</label>
                      <div className="booking-car-options-grid">
                        {Array.isArray(carOptionCards) && carOptionCards.map((opt) => {
                          const isSelected = selectedCarOptionId === opt.id;
                          const carImageIndex = carImageIndices[opt.id] || 0;
                          const carImages = Array.isArray(opt.image_urls) 
                            ? opt.image_urls 
                            : (opt.image_url ? [opt.image_url] : []);
                          
                          return (
                            <div
                              key={opt.id}
                              className={`booking-car-option-card ${
                                isSelected ? 'selected' : ''
                              }`}
                              onClick={() => handleCarSelection(opt.id)}
                            >
                              {Array.isArray(carImages) && carImages.length > 0 && (
                                <div className="booking-car-option-image-wrapper">
                                  {carImages.length > 1 ? (
                                    <div className="booking-car-image-gallery">
                                      {carImages.map((url, index) => (
                                        <div
                                          key={index}
                                          className={`booking-car-image-slide ${
                                            index === carImageIndex ? 'active' : ''
                                          }`}
                                        >
                                          <img
                                            src={url}
                                            alt={opt.name}
                                            className="booking-car-option-image"
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        className="booking-car-image-nav prev"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newIndex = carImageIndex > 0 
                                            ? carImageIndex - 1 
                                            : carImages.length - 1;
                                          updateCarImageIndex(opt.id, newIndex);
                                        }}
                                        aria-label="Previous image"
                                      >
                                        ‹
                                      </button>
                                      <button
                                        type="button"
                                        className="booking-car-image-nav next"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newIndex = carImageIndex < carImages.length - 1 
                                            ? carImageIndex + 1 
                                            : 0;
                                          updateCarImageIndex(opt.id, newIndex);
                                        }}
                                        aria-label="Next image"
                                      >
                                        ›
                                      </button>
                                      {carImages.length > 1 && (
                                        <div className="booking-car-image-indicators">
                                          {carImages.map((_, index) => (
                                            <button
                                              key={index}
                                              type="button"
                                              className={`booking-car-image-indicator ${
                                                index === carImageIndex ? 'active' : ''
                                              }`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateCarImageIndex(opt.id, index);
                                              }}
                                              aria-label={`Go to image ${index + 1}`}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <img
                                      src={carImages[0]}
                                      alt={opt.name}
                                      className="booking-car-option-image"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                              <div className="booking-car-option-content">
                                <h3>{opt.name}</h3>
                                {opt.description && <p>{opt.description}</p>}
                              </div>
                            </div>
                          );
                        })}
                        {carOptionCards.length === 0 && (
                          <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                            No car options configured yet. Please try again later.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {serviceType && (
                  <button
                    onClick={calculateFare}
                    disabled={
                      calculating || 
                      !selectedCarOptionId ||
                      (serviceType === 'local' ? (!fromLocation || !numberOfHours) : 
                       serviceType === 'outstation' ? (
                         !tripType || 
                         (tripType === 'one_way' && (!pickupLocation || !dropLocation)) ||
                         (tripType === 'round_trip' && !pickupLocation) ||
                         (tripType === 'multiple_way' && (!pickupLocation || !stopA || !stopB || !dropLocation))
                       ) :
                       (!fromLocation || !toLocation))
                    }
                    className="btn btn-primary btn-block"
                  >
                    {calculating ? 'Calculating...' : 'Check Price'}
                  </button>
                )}

                {fare && (
                  <div className="fare-display">
                    <h3>Fare Details</h3>
                    <div className="fare-breakdown">
                      <div className="fare-item">
                        <span>Service Type:</span>
                        <span>{fare.breakdown.service_type === 'local' ? 'Local' : fare.breakdown.service_type === 'airport' ? 'Airport' : 'Outstation'}</span>
                      </div>
                      <div className="fare-item">
                        <span>Base Fare:</span>
                        <span>₹{fare.breakdown.base_fare}</span>
                      </div>
                    {fare.distance_km > 0 && (
                      <div className="fare-item">
                        <span>Distance ({fare.distance_km} km):</span>
                        <span>₹{fare.breakdown.distance_charge.toFixed(2)}</span>
                      </div>
                    )}
                    {serviceType === 'local' && fare.breakdown.number_of_hours && (
                      <div className="fare-item">
                        <span>Duration ({fare.breakdown.number_of_hours} hours):</span>
                        <span>₹{fare.breakdown.time_charge.toFixed(2)}</span>
                      </div>
                    )}
                    {serviceType !== 'local' && fare.breakdown.time_charge > 0 && (
                      <div className="fare-item">
                        <span>Time ({formatDuration(fare.estimated_time_minutes)}):</span>
                        <span>₹{fare.breakdown.time_charge.toFixed(2)}</span>
                      </div>
                    )}
                      {fare.breakdown.service_multiplier > 1 && (
                        <div className="fare-item">
                          <span>Service Charge ({((fare.breakdown.service_multiplier - 1) * 100).toFixed(0)}%):</span>
                          <span>₹{((fare.breakdown.base_fare + fare.breakdown.distance_charge + fare.breakdown.time_charge) * (fare.breakdown.service_multiplier - 1)).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="fare-item total">
                        <span>Total Fare:</span>
                        <span>₹{fare.fare}</span>
                      </div>
                    </div>
                    {serviceType === 'local' && fare.breakdown.number_of_hours && (
                      <p className="estimated-time">
                        ⏱️ Duration: {fare.breakdown.number_of_hours} hours
                      </p>
                    )}
                    {fare.estimated_time_minutes > 0 && (
                      <p className="estimated-time">
                        ⏱️ Estimated Time: {formatDuration(fare.estimated_time_minutes)}
                      </p>
                    )}
                    {fare.distance_km > 0 && (
                      <p className="estimated-time">
                        📍 Distance: {fare.distance_km} km
                      </p>
                    )}
                  </div>
                )}

                {showBookingForm && fare && !showConfirmation && (
                  <form onSubmit={handleBooking} className="booking-form">
                    <h3>Complete Your Booking</h3>
                    
                    <div className="form-group">
                      <label>Passenger Name *</label>
                      <input
                        type="text"
                        required
                        value={bookingData.passenger_name}
                        onChange={(e) =>
                          setBookingData({ ...bookingData, passenger_name: e.target.value })
                        }
                        placeholder="Enter your name"
                      />
                    </div>

                    <div className="form-group">
                      <label>Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={bookingData.passenger_phone}
                        onChange={(e) =>
                          setBookingData({ ...bookingData, passenger_phone: e.target.value })
                        }
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div className="form-group">
                      <label>Email *</label>
                      <input
                        type="email"
                        required
                        value={bookingData.passenger_email}
                        onChange={(e) =>
                          setBookingData({ ...bookingData, passenger_email: e.target.value })
                        }
                        placeholder="Enter your email"
                      />
                    </div>

                    <div className="form-group">
                      <label>Travel Date & Time (Optional)</label>
                      <input
                        type="datetime-local"
                        value={bookingData.travel_date}
                        onChange={(e) =>
                          setBookingData({ ...bookingData, travel_date: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Special Instructions (Optional)</label>
                      <textarea
                        value={bookingData.notes}
                        onChange={(e) =>
                          setBookingData({ ...bookingData, notes: e.target.value })
                        }
                        placeholder="Any special instructions..."
                        rows="3"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-success btn-block"
                    >
                      {loading ? 'Processing...' : `Proceed to Confirm - ₹${fare.fare}`}
                    </button>
                  </form>
                )}

                {showConfirmation && fare && (
                  <div className="booking-confirmation-summary">
                    <h3>Confirm Your Booking</h3>
                    <p style={{ color: '#9ca3af', marginBottom: '20px', textAlign: 'center' }}>
                      Please review your booking details before confirming
                    </p>
                    
                    <div className="booking-summary-item">
                      <span className="booking-summary-label">Service Type:</span>
                      <span className="booking-summary-value">
                        {serviceType === 'local' ? 'Local' : serviceType === 'airport' ? 'Airport' : 'Outstation'}
                      </span>
                    </div>
                    
                    {serviceType === 'local' && (
                      <>
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">Pickup Location:</span>
                          <span className="booking-summary-value">{fromLocation ? fromLocation.address : ''}</span>
                        </div>
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">Number of Hours:</span>
                          <span className="booking-summary-value">{numberOfHours} hours</span>
                        </div>
                      </>
                    )}
                    
                    {serviceType === 'airport' && (
                      <>
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">From:</span>
                          <span className="booking-summary-value">{fromLocation ? fromLocation.address : ''}</span>
                        </div>
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">To:</span>
                          <span className="booking-summary-value">{toLocation ? toLocation.address : ''}</span>
                        </div>
                      </>
                    )}

                    {serviceType === 'outstation' && (
                      <>
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">Trip Type:</span>
                          <span className="booking-summary-value">
                            {tripType === 'one_way' ? 'One Way Trip' :
                             tripType === 'round_trip' ? 'Round Trip' :
                             tripType === 'multiple_way' ? 'Multiple Way' : tripType}
                          </span>
                        </div>
                        {tripType === 'one_way' && (
                          <>
                            <div className="booking-summary-item">
                              <span className="booking-summary-label">Pickup:</span>
                              <span className="booking-summary-value">{pickupLocation ? pickupLocation.address : ''}</span>
                            </div>
                            <div className="booking-summary-item">
                              <span className="booking-summary-label">Drop:</span>
                              <span className="booking-summary-value">{dropLocation ? dropLocation.address : ''}</span>
                            </div>
                          </>
                        )}
                        {tripType === 'round_trip' && (
                          <div className="booking-summary-item">
                            <span className="booking-summary-label">Pickup (Round Trip):</span>
                            <span className="booking-summary-value">{pickupLocation ? pickupLocation.address : ''}</span>
                          </div>
                        )}
                        {tripType === 'multiple_way' && (
                          <>
                            <div className="booking-summary-item">
                              <span className="booking-summary-label">Pickup:</span>
                              <span className="booking-summary-value">{pickupLocation ? pickupLocation.address : ''}</span>
                            </div>
                            <div className="booking-summary-item">
                              <span className="booking-summary-label">Stop A:</span>
                              <span className="booking-summary-value">{stopA ? stopA.address : ''}</span>
                            </div>
                            <div className="booking-summary-item">
                              <span className="booking-summary-label">Stop B:</span>
                              <span className="booking-summary-value">{stopB ? stopB.address : ''}</span>
                            </div>
                            {additionalStops.map((stop, index) => (
                              <div key={index} className="booking-summary-item">
                                <span className="booking-summary-label">
                                  Stop {String.fromCharCode(67 + index)}:
                                </span>
                                <span className="booking-summary-value">{stop ? (stop.address || stop) : ''}</span>
                              </div>
                            ))}
                            <div className="booking-summary-item">
                              <span className="booking-summary-label">Drop:</span>
                              <span className="booking-summary-value">{dropLocation ? dropLocation.address : ''}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    
                    {(() => {
                      const selectedCar = getSelectedCarOption();
                      return selectedCar ? (
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">Car:</span>
                          <span className="booking-summary-value">{selectedCar.name}</span>
                        </div>
                      ) : null;
                    })()}
                    
                    {serviceType === 'local' && fare.breakdown.number_of_hours && (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">Number of Hours:</span>
                        <span className="booking-summary-value">{numberOfHours} hours</span>
                      </div>
                    )}
                    {fare.distance_km > 0 && (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">Distance:</span>
                        <span className="booking-summary-value">{fare.distance_km} km</span>
                      </div>
                    )}
                    {fare.estimated_time_minutes > 0 && (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">Estimated Time:</span>
                        <span className="booking-summary-value">{formatDuration(fare.estimated_time_minutes)}</span>
                      </div>
                    )}
                    
                    <div className="booking-summary-item">
                      <span className="booking-summary-label">Passenger Name:</span>
                      <span className="booking-summary-value">{bookingData.passenger_name}</span>
                    </div>
                    
                    <div className="booking-summary-item">
                      <span className="booking-summary-label">Phone:</span>
                      <span className="booking-summary-value">{bookingData.passenger_phone}</span>
                    </div>
                    
                    <div className="booking-summary-item">
                      <span className="booking-summary-label">Email:</span>
                      <span className="booking-summary-value">{bookingData.passenger_email}</span>
                    </div>
                    
                    {bookingData.travel_date && (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">Travel Date:</span>
                        <span className="booking-summary-value">
                          {new Date(bookingData.travel_date).toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="booking-summary-item" style={{ 
                      borderTop: '2px solid rgba(250, 204, 21, 0.3)', 
                      marginTop: '16px', 
                      paddingTop: '16px',
                      fontSize: '20px',
                      fontWeight: '700'
                    }}>
                      <span className="booking-summary-label" style={{ color: '#facc15' }}>Total Fare:</span>
                      <span className="booking-summary-value" style={{ color: '#facc15' }}>₹{fare.fare}</span>
                    </div>
                    
                    <div className="booking-confirmation-actions">
                      <button
                        type="button"
                        onClick={() => setShowConfirmation(false)}
                        className="btn btn-secondary"
                        disabled={loading}
                      >
                        Go Back
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmBooking}
                        className="btn btn-success"
                        disabled={loading}
                      >
                        {loading ? 'Booking...' : `Confirm Booking - ₹${fare.fare}`}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* About Us section */}
      <section id="about" className="home-section about-section">
        <div className="about-light-wrapper">
          <LightRays
            raysOrigin="top-center"
            raysColor="#00ffff"
            raysSpeed={1.5}
            lightSpread={0.8}
            rayLength={1.2}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0.1}
            distortion={0.05}
          />
        </div>
        <div className="home-section-inner">
          <h2>About Us</h2>
          <h3>Airport Taxi Service, Local Cars, Outstation Taxi & Corporate Cab Solutions</h3>
          <p>
            Welcome to <strong>Namma Cabs</strong>! We offer affordable taxi services in
            Bangalore, Karnataka with no hidden charges. Choose from a wide array of
            airport taxi services &mdash; from well-maintained older models at budget
            prices to the latest model cars with all the new features.
          </p>
          <p>
            Whether you&apos;re looking for a comfortable family car or compact city
            rides, we match you with the perfect vehicle for your trip. Our seamless
            online cab booking experience helps travellers quickly find the right cab
            with transparent pricing and reliable service.
          </p>
          <p>
            Along with airport pickups and drops, <strong>Namma Cabs</strong> also
            provides trusted outstation taxi and local cab booking services so you can
            move around Bangalore and beyond with complete peace of mind.
          </p>
          
          {/* Corporate Services Section */}
          <div className="corporate-services-highlight">
            <h3 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: '#facc15', 
              marginTop: '40px', 
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              🏢 Corporate Cab Services – Your Business Travel Partner
            </h3>
            <p style={{ 
              fontSize: '18px', 
              lineHeight: '1.8', 
              marginBottom: '20px',
              textAlign: 'center',
              color: '#e5e7eb'
            }}>
              <strong>Elevate your company&apos;s transportation with Namma Cabs Corporate Solutions!</strong>
            </p>
            <p style={{ 
              fontSize: '16px', 
              lineHeight: '1.8', 
              marginBottom: '16px',
              color: '#cbd5e1'
            }}>
              We understand that businesses need more than just rides – they need <strong>reliability, 
              accountability, and seamless employee transportation</strong>. That&apos;s why Namma Cabs 
              offers dedicated corporate cab services designed specifically for companies, startups, 
              and organizations across Bangalore.
            </p>
            <p style={{ 
              fontSize: '16px', 
              lineHeight: '1.8', 
              marginBottom: '16px',
              color: '#cbd5e1'
            }}>
              Our corporate fleet management ensures your employees arrive on time, every time. 
              From <strong>daily office commutes</strong> to <strong>client meetings, airport transfers, 
              and team outings</strong>, we provide professional drivers, well-maintained vehicles, 
              and dedicated account management for hassle-free business travel.
            </p>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.15) 0%, rgba(234, 179, 8, 0.1) 100%)',
              border: '2px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '16px',
              padding: '30px',
              marginTop: '30px',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                fontSize: '22px', 
                fontWeight: '700', 
                color: '#facc15', 
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Why Choose Our Corporate Services?
              </h4>
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                fontSize: '16px',
                lineHeight: '2',
                color: '#e5e7eb'
              }}>
                <li style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#facc15' }}>✓</strong> <strong>Dedicated Fleet Management</strong> – 
                  Assigned vehicles and drivers for consistent, reliable service
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#facc15' }}>✓</strong> <strong>Flexible Billing & Invoicing</strong> – 
                  Monthly billing cycles, GST-compliant invoices, and detailed usage reports
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#facc15' }}>✓</strong> <strong>Cost-Effective Solutions</strong> – 
                  Volume discounts, fixed monthly rates, and transparent pricing with no hidden charges
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#facc15' }}>✓</strong> <strong>Employee Safety First</strong> – 
                  Verified drivers, insured vehicles, and comprehensive safety protocols
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#facc15' }}>✓</strong> <strong>Customized Routes & Schedules</strong> – 
                  Tailored transportation plans for shift-based employees and regular commutes
                </li>
              </ul>
            </div>
            <p style={{ 
              fontSize: '17px', 
              lineHeight: '1.8', 
              marginTop: '30px',
              textAlign: 'center',
              color: '#facc15',
              fontWeight: '600'
            }}>
              Ready to streamline your company&apos;s transportation? 
              <a href="/corporate" style={{ 
                color: '#facc15', 
                textDecoration: 'underline',
                marginLeft: '8px',
                fontWeight: '700'
              }}>
                Get Started with Corporate Booking →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Outstation Routes Section */}
      <section className="outstation-routes-section">
        <div className="outstation-routes-wrapper">
          <AnimatedMapBackground />
        </div>
        <div className="outstation-routes-inner">
          <div className="outstation-routes-header">
            <h2 className="outstation-routes-title">
              Our Common Routes
            </h2>
            <div className="routes-title-underline"></div>
            <p className="outstation-routes-subtitle">
              Choose your destination and book your journey in seconds
            </p>
          </div>
          
          <div className="outstation-routes-grid">
            {[
              'Mysore', 'Salem', 'Coorg', 'Chikmagalur', 'Mangalore', 
              'Dharwad', 'Shivamogga', 'Chennai', 'Madurai', 'Coimbatore',
              'Krishnagiri', 'Tirupati', 'Hyderabad', 'Hubli', 'Munnar', 'Vellore',
              'Pondicherry', 'Hassan', 'Ooty'
            ].map((destination, index) => (
              <button
                key={destination}
                className="route-button"
                onClick={() => {
                  setServiceType('outstation');
                  setFromLocation({ address: 'Bangalore' });
                  setToLocation({ address: destination });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="route-button-text">
                  Bangalore To {destination}
                </span>
                <span className="route-button-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews section */}
      <section id="reviews" className="reviews-section">
        <div className="reviews-map-wrapper">
          <AnimatedMapBackground />
        </div>
        <div className="reviews-section-inner">
          <h2>Customer Reviews</h2>
          <p className="section-subtitle">What our customers say about us</p>
          <div className="reviews-grid">
            <div className="review-card">
              <div className="review-header">
                <div className="review-stars">⭐⭐⭐⭐⭐</div>
                <div className="review-author">
                  <strong>Rajesh Kumar</strong>
                  <span className="review-date">2 weeks ago</span>
                </div>
              </div>
              <p className="review-text">
                "Excellent service! The driver was on time and very professional. The car was clean and comfortable. Highly recommend Namma Cabs for airport transfers."
              </p>
            </div>

            <div className="review-card">
              <div className="review-header">
                <div className="review-stars">⭐⭐⭐⭐⭐</div>
                <div className="review-author">
                  <strong>Priya Sharma</strong>
                  <span className="review-date">1 month ago</span>
                </div>
              </div>
              <p className="review-text">
                "Used their outstation service for a family trip. Very reliable and safe. The driver was courteous and the pricing was transparent. Will definitely book again!"
              </p>
            </div>

            <div className="review-card">
              <div className="review-header">
                <div className="review-stars">⭐⭐⭐⭐⭐</div>
                <div className="review-author">
                  <strong>Mohammed Ali</strong>
                  <span className="review-date">3 weeks ago</span>
                </div>
              </div>
              <p className="review-text">
                "Best cab service in Bangalore! Prompt response, good vehicles, and reasonable rates. The round trip option is very convenient for day trips."
              </p>
            </div>

            <div className="review-card">
              <div className="review-header">
                <div className="review-stars">⭐⭐⭐⭐⭐</div>
                <div className="review-author">
                  <strong>Anjali Reddy</strong>
                  <span className="review-date">1 week ago</span>
                </div>
              </div>
              <p className="review-text">
                "Great experience with Namma Cabs! Booked for local sightseeing and they were very flexible with timing. The car was in excellent condition."
              </p>
            </div>

            <div className="review-card">
              <div className="review-header">
                <div className="review-stars">⭐⭐⭐⭐⭐</div>
                <div className="review-author">
                  <strong>Vikram Singh</strong>
                  <span className="review-date">2 months ago</span>
                </div>
              </div>
              <p className="review-text">
                "Multiple way trip was handled perfectly. They accommodated all our stops without any issues. Professional service from start to finish!"
              </p>
            </div>

            <div className="review-card">
              <div className="review-header">
                <div className="review-stars">⭐⭐⭐⭐⭐</div>
                <div className="review-author">
                  <strong>Sneha Patel</strong>
                  <span className="review-date">3 days ago</span>
                </div>
              </div>
              <p className="review-text">
                "Affordable pricing and reliable service. Used for airport pickup at early morning hours and they were punctual. Highly satisfied!"
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default BookingPage;
