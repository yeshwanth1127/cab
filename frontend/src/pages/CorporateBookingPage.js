import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LocationInput from '../components/LocationInput';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import MainNavbar from '../components/MainNavbar';
import { getCurrentLocation, getAddressFromCoordinates } from '../services/locationService';
import './CorporateBookingPage.css';

const CorporateBookingPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    company_name: '',
    pickup_point: '',
    drop_point: '',
    notes: '',
  });
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
      const location = await getCurrentLocation();
      const address = await getAddressFromCoordinates(location.lat, location.lng);
      setUserLocation(location);
      setFormData(prev => ({ ...prev, pickup_point: address }));
      localStorage.setItem('locationConsent', 'granted');
    } catch (error) {
      console.error('Error getting location:', error);
      if (error.code === 1) {
        localStorage.setItem('locationConsent', 'denied');
      }
    }
  };

  const handleLocationUpdate = (location) => {
    setUserLocation(location);
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
    if (!formData.pickup_point.trim()) {
      newErrors.pickup_point = 'Pickup point is required';
    }
    if (!formData.drop_point.trim()) {
      newErrors.drop_point = 'Drop point is required';
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
      const response = await api.post('/corporate/bookings', formData);
      
      setBookingSuccess(true);
      setBookingId(response.data.id);
      
      // Reset form
      setFormData({
        name: '',
        phone_number: '',
        company_name: '',
        pickup_point: '',
        drop_point: '',
        notes: '',
      });
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
      <MainNavbar />
      
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
          <h2 className="corporate-booking-title">Corporate Booking Request</h2>
          <p className="corporate-booking-subtitle">
            Fill out the form below to submit your corporate booking request. Our team will contact you shortly.
          </p>
          
          <div className="card corporate-booking-card">
            {bookingSuccess && (
              <div className="success-banner">
                <h3>✅ Booking Request Submitted Successfully!</h3>
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
                    value={formData.pickup_point}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, pickup_point: value }));
                      if (errors.pickup_point) {
                        setErrors(prev => ({ ...prev, pickup_point: '' }));
                      }
                    }}
                    placeholder="Enter pickup location or click 📍 for current location"
                    userLocation={userLocation}
                    onLocationRequest={handleLocationUpdate}
                    showCurrentLocation={true}
                  />
                  {errors.pickup_point && <span className="error-message">{errors.pickup_point}</span>}
                </div>

                <div className="form-group">
                  <label>Drop Point *</label>
                  <LocationInput
                    value={formData.drop_point}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, drop_point: value }));
                      if (errors.drop_point) {
                        setErrors(prev => ({ ...prev, drop_point: '' }));
                      }
                    }}
                    placeholder="Enter drop location"
                    userLocation={userLocation}
                    showCurrentLocation={false}
                  />
                  {errors.drop_point && <span className="error-message">{errors.drop_point}</span>}
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


