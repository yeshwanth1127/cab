import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LocationInput from '../components/LocationInput';
import Icon from '../components/Icon';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import MainNavbar from '../components/MainNavbar';
import './CorporateBookingPage.css';

// Helper function to open calendar picker when clicking anywhere on date/time inputs
const handleDateInputClick = (e) => {
  // Ensure calendar opens when clicking anywhere on the input
  if (e.target.showPicker) {
    e.target.showPicker();
  } else {
    e.target.focus();
  }
};

const CorporateBookingPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    company_name: '',
    pickup_point: '',
    travel_date: '',
    travel_time: '',
    time_period: 'AM',
    notes: '',
  });
  const [pickupLocation, setPickupLocation] = useState(null); // {address, lat, lng}
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [errors, setErrors] = useState({});

  // Request user location on mount
  React.useEffect(() => {
    const consent = localStorage.getItem('locationConsent');
    if (!consent || consent === 'granted') {
      requestUserLocation();
    }
  }, []);

  const requestUserLocation = async () => {
    try {
      if (!navigator.geolocation) {
        return;
      }
      
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
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
            const locObj = {
              address: results[0].formatted_address,
              lat,
              lng
            };
            setPickupLocation(locObj);
            setFormData(prev => ({ ...prev, pickup_point: results[0].formatted_address }));
          } else {
            const locObj = {
              address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              lat,
              lng
            };
            setPickupLocation(locObj);
            setFormData(prev => ({ ...prev, pickup_point: locObj.address }));
          }
        });
      } else {
        const locObj = {
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat,
          lng
        };
        setPickupLocation(locObj);
        setFormData(prev => ({ ...prev, pickup_point: locObj.address }));
      }
      
      localStorage.setItem('locationConsent', 'granted');
    } catch (error) {
      console.error('Error getting location:', error);
      if (error.code === 1) {
        localStorage.setItem('locationConsent', 'denied');
      } else if (error.code === 3) {
        alert('Location timeout. Please select location manually.');
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required';
    }
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }
    if (!pickupLocation || !pickupLocation.address) {
      newErrors.pickup_point = 'Pickup point is required';
    }
    if (!formData.travel_date) {
      newErrors.travel_date = 'Travel date is required';
    }
    if (!formData.travel_time) {
      newErrors.travel_time = 'Travel time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const formatTimeForAPI = (hhmm) => {
        if (!hhmm) return '';
        const [h, m] = hhmm.split(':').map(Number);
        const h12 = h % 12 || 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      };
      const formattedTime = formatTimeForAPI(formData.travel_time);
      const payload = {
        ...formData,
        service_type: 'local',
        pickup_lat: pickupLocation ? pickupLocation.lat : null,
        pickup_lng: pickupLocation ? pickupLocation.lng : null,
        travel_time: formattedTime,
      };
      delete payload.time_period;
      
      const response = await api.post('/corporate/bookings', payload);
      
      setBookingSuccess(true);
      setBookingId(response.data.id);
      
      // Reset form
      setFormData({
        name: '',
        phone_number: '',
        company_name: '',
        pickup_point: '',
        travel_date: '',
        travel_time: '',
        time_period: 'AM',
        notes: '',
      });
      setPickupLocation(null);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errors?.[0]?.msg || 
                          'Error submitting booking. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="corporate-booking-page">
      <MainNavbar logoOnly />
      
      <div className="flowing-banner">
        <div className="flowing-banner-content">
          <span>For immediate bookings, call +91 5547444589</span>
          <span>For immediate bookings, call +91 5547444589</span>
          <span>For immediate bookings, call +91 5547444589</span>
        </div>
      </div>

      <div className="container">
        <div className="corporate-booking-container">
          <div className="booking-map-wrapper">
            <AnimatedMapBackground />
          </div>
          <h2 className="corporate-booking-title" style={{ color: '#000000' }}>Corporate Booking Request</h2>
          <p className="corporate-booking-subtitle" style={{ color: '#000000' }}>
            Fill out the form below to submit your corporate booking request. Our team will contact you shortly.
          </p>
          
          <div className="card corporate-booking-card">
            {bookingSuccess && (
              <div className="success-banner">
                <h3><Icon name="checkCircle" size={24} className="corporate-success-icon" /> Booking Request Submitted Successfully!</h3>
                <p>Your booking request ID is: <strong>{bookingId}</strong></p>
                <p>We'll contact you soon to confirm your corporate booking.</p>
                <div className="success-actions">
                  <button 
                    onClick={() => {
                      setBookingSuccess(false);
                      setBookingId(null);
                    }} 
                    className="btn btn-primary"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            )}

            {!bookingSuccess && (
              <form onSubmit={handleSubmit} className="corporate-booking-form">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                    className={errors.name ? 'error' : ''}
                  />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                    className={errors.phone_number ? 'error' : ''}
                  />
                  {errors.phone_number && <span className="error-message">{errors.phone_number}</span>}
                </div>

                <div className="form-group">
                  <label>Company Name *</label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    placeholder="Enter your company name"
                    className={errors.company_name ? 'error' : ''}
                  />
                  {errors.company_name && <span className="error-message">{errors.company_name}</span>}
                </div>

                <div className="form-group">
                  <label>Pickup Point *</label>
                  <LocationInput
                    value={pickupLocation}
                    onSelect={(location) => {
                      setPickupLocation(location);
                      setFormData(prev => ({ ...prev, pickup_point: location ? location.address : '' }));
                      if (errors.pickup_point) {
                        setErrors(prev => ({ ...prev, pickup_point: '' }));
                      }
                    }}
                    placeholder="Enter pickup location or click the location icon for current location"
                    showCurrentLocation={true}
                    userLocation={userLocation}
                  />
                  {errors.pickup_point && <span className="error-message">{errors.pickup_point}</span>}
                </div>

                <div className="form-group">
                  <label>Date and Time *</label>
                  <div className="corporate-datetime-row">
                    <input
                      type="date"
                      name="travel_date"
                      value={formData.travel_date}
                      onChange={handleChange}
                      onClick={handleDateInputClick}
                      min={new Date().toISOString().split('T')[0]}
                      className={errors.travel_date ? 'error' : ''}
                      placeholder="Date"
                    />
                    <input
                      type="time"
                      name="travel_time"
                      value={formData.travel_time}
                      onChange={handleChange}
                      onClick={handleDateInputClick}
                      className={errors.travel_time ? 'error' : ''}
                    />
                  </div>
                  {(errors.travel_date || errors.travel_time) && (
                    <span className="error-message">{errors.travel_date || errors.travel_time}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>Additional Notes (Optional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Any special requirements or instructions..."
                    rows="4"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-block"
                  style={{ color: '#000' }}
                >
                  {loading ? 'Submitting...' : 'Submit Booking Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorporateBookingPage;


