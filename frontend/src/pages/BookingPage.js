import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LocationInput from '../components/LocationInput';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import LightRays from '../components/LightRays';
import MainNavbar from '../components/MainNavbar';
import { getCurrentLocation, getAddressFromCoordinates } from '../services/locationService';
import './BookingPage.css';

const BookingPage = () => {
  const navigate = useNavigate();
  const [serviceType, setServiceType] = useState(null); // 'local', 'airport', 'outstation'
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCarOptionId, setSelectedCarOptionId] = useState(null);
  const [numberOfHours, setNumberOfHours] = useState(''); // For local bookings only
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
  const [carImageIndices, setCarImageIndices] = useState({}); // Track image index per car
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initial load: optional geolocation prompt
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
    } else {
      // If no service type selected, show all cars (or empty)
      setCarOptionCards([]);
      setSelectedCarOptionId(null);
      setNumberOfHours('');
    }
  }, [serviceType]);

  const requestUserLocation = async () => {
    try {
      const location = await getCurrentLocation();
      const address = await getAddressFromCoordinates(location.lat, location.lng);
      setUserLocation(location);
      setFromLocation(address);
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
      setCarOptionCards(response.data || []);
    } catch (error) {
      console.error('Error fetching public car options:', error);
    }
  };

  const calculateFare = async () => {
    // Validation based on service type
    if (serviceType === 'local') {
      if (!serviceType || !fromLocation || !numberOfHours || !selectedCarOptionId) {
        alert('Please fill in all fields');
        return;
      }
    } else {
      if (!serviceType || !fromLocation || !toLocation || !selectedCarOptionId) {
        alert('Please fill in all fields');
        return;
      }
    }

    setCalculating(true);
    try {
      const requestData = {
        from_location: fromLocation,
        service_type: serviceType,
        cab_type_id: selectedCarOptionId, // Pass selected car option ID for rate meter lookup
      };

      if (serviceType === 'local') {
        requestData.number_of_hours = parseInt(numberOfHours);
      } else {
        requestData.to_location = toLocation;
      }

      const response = await api.post('/bookings/calculate-fare', requestData);

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
        from_location: fromLocation,
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
        bookingPayload.number_of_hours = parseInt(numberOfHours);
        bookingPayload.distance_km = 0; // Local bookings don't use distance
        bookingPayload.estimated_time_minutes = parseInt(numberOfHours) * 60;
      } else {
        bookingPayload.to_location = toLocation;
        bookingPayload.distance_km = fare.distance_km;
        bookingPayload.estimated_time_minutes = fare.estimated_time_minutes;
      }

      const response = await api.post('/bookings', bookingPayload);

      setBookingSuccess(true);
      setBookingId(response.data.id);
      setShowBookingForm(false);
      
      // Reset form
      setFromLocation('');
      setToLocation('');
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
    setUserLocation(location);
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
                          onChange={setFromLocation}
                          placeholder="Enter pickup location or click 📍 for current location"
                          userLocation={userLocation}
                          onLocationRequest={handleLocationUpdate}
                          showCurrentLocation={true}
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
                    ) : (
                      <>
                        <LocationInput
                          label="From Location"
                          value={fromLocation}
                          onChange={setFromLocation}
                          placeholder="Enter pickup location or click 📍 for current location"
                          userLocation={userLocation}
                          onLocationRequest={handleLocationUpdate}
                          showCurrentLocation={true}
                        />

                        <LocationInput
                          label="To Location"
                          value={toLocation}
                          onChange={setToLocation}
                          placeholder="Enter destination"
                          userLocation={userLocation}
                          showCurrentLocation={false}
                        />
                      </>
                    )}

                    <div className="form-group">
                      <label>Select Car *</label>
                      <div className="booking-car-options-grid">
                        {carOptionCards.map((opt) => {
                          const isSelected = selectedCarOptionId === opt.id;
                          const carImageIndex = carImageIndices[opt.id] || 0;
                          const carImages = opt.image_urls || (opt.image_url ? [opt.image_url] : []);
                          
                          return (
                            <div
                              key={opt.id}
                              className={`booking-car-option-card ${
                                isSelected ? 'selected' : ''
                              }`}
                              onClick={() => handleCarSelection(opt.id)}
                            >
                              {carImages.length > 0 && (
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
                      !fromLocation || 
                      !selectedCarOptionId ||
                      (serviceType === 'local' ? !numberOfHours : !toLocation)
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
                    {serviceType !== 'local' && (
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
                        <span>Time ({fare.estimated_time_minutes} min):</span>
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
                    {serviceType === 'local' && fare.breakdown.number_of_hours ? (
                      <p className="estimated-time">
                        ⏱️ Duration: {fare.breakdown.number_of_hours} hours
                      </p>
                    ) : (
                      <p className="estimated-time">
                        ⏱️ Estimated Time: {fare.estimated_time_minutes} minutes
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
                    
                    <div className="booking-summary-item">
                      <span className="booking-summary-label">
                        {serviceType === 'local' ? 'Pickup Location:' : 'From:'}
                      </span>
                      <span className="booking-summary-value">{fromLocation}</span>
                    </div>
                    
                    {serviceType === 'local' ? (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">Number of Hours:</span>
                        <span className="booking-summary-value">{numberOfHours} hours</span>
                      </div>
                    ) : (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">To:</span>
                        <span className="booking-summary-value">{toLocation}</span>
                      </div>
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
                    
                    {serviceType === 'local' ? (
                      <div className="booking-summary-item">
                        <span className="booking-summary-label">Number of Hours:</span>
                        <span className="booking-summary-value">{numberOfHours} hours</span>
                      </div>
                    ) : (
                      <>
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">Distance:</span>
                          <span className="booking-summary-value">{fare.distance_km} km</span>
                        </div>
                        
                        <div className="booking-summary-item">
                          <span className="booking-summary-label">Estimated Time:</span>
                          <span className="booking-summary-value">{fare.estimated_time_minutes} minutes</span>
                        </div>
                      </>
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
          <h3>Airport Taxi Service, Local Cars and Outstation Taxi</h3>
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
        </div>
      </section>

      {/* Available Cars section */}
      <section id="cars" className="cars-section">
        <div className="cars-map-wrapper">
          <AnimatedMapBackground />
        </div>
        <div className="cars-section-inner">
          <h2>Available Car Options</h2>
          <p className="section-subtitle">These are the same options configured in the admin dashboard.</p>
          <div className="cars-grid">
            {carOptionCards.length === 0 && (
              <p className="section-subtitle">No car options available yet.</p>
            )}
            {carOptionCards.map((opt) => (
              <div key={opt.id} className="car-option-button">
                <div className="car-option-main">
                  <div>
                    <h3>{opt.name}</h3>
                    {opt.description && <p>{opt.description}</p>}
                  </div>
                  <div className="car-option-right">
                    <div className="car-option-actions">
                      {opt.image_urls && opt.image_urls.length > 0 && (
                        <button
                          className="btn btn-secondary car-option-cta"
                          type="button"
                          onClick={() => toggleCarImages(opt.id)}
                        >
                          {expandedCarKey === opt.id ? 'Hide images' : 'View images'}
                        </button>
                      )}
                      <button
                        className="btn btn-primary car-option-cta"
                        type="button"
                        onClick={() => navigate('/car-options')}
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
                {expandedCarKey === opt.id && opt.image_urls && opt.image_urls.length > 0 && (
                  <div className="car-option-image-wrap">
                    {opt.image_urls.map((url) => (
                      <img key={url} src={url} alt={opt.name} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default BookingPage;
