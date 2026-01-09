import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import LocationInput from '../components/LocationInput';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import MainNavbar from '../components/MainNavbar';
import './EventsPage.css';

const EventsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventTypeFromUrl = searchParams.get('type');
  const [activeTab, setActiveTab] = useState(eventTypeFromUrl || 'weddings');
  
  // Update active tab when URL parameter changes
  useEffect(() => {
    if (eventTypeFromUrl && ['weddings', 'birthdays', 'others'].includes(eventTypeFromUrl)) {
      setActiveTab(eventTypeFromUrl);
    }
  }, [eventTypeFromUrl]);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    event_type: 'weddings',
    pickup_point: '',
    drop_point: '',
    pickup_date: '',
    pickup_time: '',
    number_of_cars: '1',
    notes: '',
  });
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropLocation, setDropLocation] = useState(null);
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

  // Reset form when tab changes
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      event_type: activeTab,
      pickup_point: '',
      drop_point: '',
      pickup_date: '',
      pickup_time: '',
      number_of_cars: '1',
      notes: ''
    }));
    setPickupLocation(null);
    setDropLocation(null);
    setBookingSuccess(false);
    setBookingId(null);
    setErrors({});
  }, [activeTab]);

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
    if (!pickupLocation || !pickupLocation.address) {
      newErrors.pickup_point = 'Pickup point is required';
    }
    if (!dropLocation || !dropLocation.address) {
      newErrors.drop_point = 'Drop point is required';
    }
    if (!formData.pickup_date.trim()) {
      newErrors.pickup_date = 'Pickup date is required';
    }
    if (!formData.pickup_time.trim()) {
      newErrors.pickup_time = 'Pickup time is required';
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
      const payload = {
        ...formData,
        event_type: activeTab,
        pickup_lat: pickupLocation ? pickupLocation.lat : null,
        pickup_lng: pickupLocation ? pickupLocation.lng : null,
        drop_lat: dropLocation ? dropLocation.lat : null,
        drop_lng: dropLocation ? dropLocation.lng : null,
      };
      
      const response = await api.post('/events/bookings', payload);
      
      setBookingSuccess(true);
      setBookingId(response.data.id);
      
      // Reset form
      setFormData({
        name: '',
        phone_number: '',
        event_type: activeTab,
        pickup_point: '',
        drop_point: '',
        pickup_date: '',
        pickup_time: '',
        number_of_cars: '1',
        notes: '',
      });
      setPickupLocation(null);
      setDropLocation(null);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errors?.[0]?.msg || 
                          'Error submitting booking. Please try again.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getEventTitle = () => {
    switch(activeTab) {
      case 'weddings':
        return 'Wedding Event Booking';
      case 'birthdays':
        return 'Birthday Event Booking';
      case 'others':
        return 'Other Event Booking';
      default:
        return 'Event Booking';
    }
  };

  const getEventSubtitle = () => {
    switch(activeTab) {
      case 'weddings':
        return 'Fill out the form below to book transportation for your wedding event. Our team will contact you shortly.';
      case 'birthdays':
        return 'Fill out the form below to book transportation for your birthday celebration. Our team will contact you shortly.';
      case 'others':
        return 'Fill out the form below to book transportation for your event. Our team will contact you shortly.';
      default:
        return 'Fill out the form below to submit your event booking request.';
    }
  };

  return (
    <div className="events-page">
      <MainNavbar />
      
      <div className="flowing-banner">
        <div className="flowing-banner-content">
          <span>For immediate bookings, call +91 5547444589</span>
          <span>For immediate bookings, call +91 5547444589</span>
          <span>For immediate bookings, call +91 5547444589</span>
        </div>
      </div>

      <div className="container">
        <div className="events-container">
          <div className="booking-map-wrapper">
            <AnimatedMapBackground />
          </div>
          <h2 className="events-title" style={{ color: '#000000' }}>Event Bookings</h2>
          <p className="events-subtitle" style={{ color: '#000000' }}>
            Select an event type and fill out the form to book transportation for your special occasion.
          </p>
          
          <div className="events-tabs">
            <button
              className={`event-tab ${activeTab === 'weddings' ? 'active' : ''}`}
              onClick={() => setActiveTab('weddings')}
            >
              💒 Weddings
            </button>
            <button
              className={`event-tab ${activeTab === 'birthdays' ? 'active' : ''}`}
              onClick={() => setActiveTab('birthdays')}
            >
              🎂 Birthdays
            </button>
            <button
              className={`event-tab ${activeTab === 'others' ? 'active' : ''}`}
              onClick={() => setActiveTab('others')}
            >
              🎉 Others
            </button>
          </div>

          <div className="card events-card">
            {bookingSuccess && (
              <div className="success-banner">
                <h3>✅ Booking Request Submitted Successfully!</h3>
                <p>Your booking request ID is: <strong>{bookingId}</strong></p>
                <p>We'll contact you soon to confirm your event booking.</p>
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
              <>
                <h3 className="event-form-title">{getEventTitle()}</h3>
                <p className="event-form-subtitle">{getEventSubtitle()}</p>
                
                <form onSubmit={handleSubmit} className="events-form">
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
                      placeholder="Enter pickup location or click 📍 for current location"
                      showCurrentLocation={true}
                      userLocation={userLocation}
                    />
                    {errors.pickup_point && <span className="error-message">{errors.pickup_point}</span>}
                  </div>

                  <div className="form-group">
                    <label>Drop Point *</label>
                    <LocationInput
                      value={dropLocation}
                      onSelect={(location) => {
                        setDropLocation(location);
                        setFormData(prev => ({ ...prev, drop_point: location ? location.address : '' }));
                        if (errors.drop_point) {
                          setErrors(prev => ({ ...prev, drop_point: '' }));
                        }
                      }}
                      placeholder="Enter drop location"
                      showCurrentLocation={false}
                      userLocation={userLocation}
                    />
                    {errors.drop_point && <span className="error-message">{errors.drop_point}</span>}
                  </div>

                  <div className="form-group">
                    <label>Pickup Date *</label>
                    <input
                      type="date"
                      name="pickup_date"
                      value={formData.pickup_date}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={errors.pickup_date ? 'error' : ''}
                    />
                    {errors.pickup_date && <span className="error-message">{errors.pickup_date}</span>}
                  </div>

                  <div className="form-group">
                    <label>Pickup Time *</label>
                    <input
                      type="time"
                      name="pickup_time"
                      value={formData.pickup_time}
                      onChange={handleChange}
                      className={errors.pickup_time ? 'error' : ''}
                    />
                    {errors.pickup_time && <span className="error-message">{errors.pickup_time}</span>}
                  </div>

                  <div className="form-group">
                    <label>Number of Cars *</label>
                    <input
                      type="number"
                      name="number_of_cars"
                      value={formData.number_of_cars}
                      onChange={handleChange}
                      min="1"
                      max="50"
                      required
                      className={errors.number_of_cars ? 'error' : ''}
                    />
                    {errors.number_of_cars && <span className="error-message">{errors.number_of_cars}</span>}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventsPage;

