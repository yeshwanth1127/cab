import React, { useState, useEffect } from 'react';
import api from '../services/api';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import './BookingPage.css';
import './CheckBooking.css';

const CheckBooking = () => {
  const [bookingId, setBookingId] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if booking ID is in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setBookingId(id);
      // Auto-check if ID is in URL
      checkBookingById(id);
    }
  }, []);

  const checkBookingById = async (id) => {
    if (!id || !id.trim()) return;

    setLoading(true);
    setError('');
    setBooking(null);

    try {
      const response = await api.get(`/bookings/${id}`);
      setBooking(response.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Booking not found. Please check your booking ID.');
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBooking = async (e) => {
    e.preventDefault();
    
    if (!bookingId.trim()) {
      setError('Please enter a booking ID');
      return;
    }

    await checkBookingById(bookingId);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      confirmed: '#28a745',
      in_progress: '#007bff',
      completed: '#6c757d',
      cancelled: '#dc3545',
    };
    return colors[status] || '#6c757d';
  };

  const formatStatus = (status) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="booking-page check-booking-page">
      <MainNavbar />
      <div className="booking-map-wrapper">
        <AnimatedMapBackground />
      </div>
      <div className="container">
        <div className="check-booking-container">
          <div className="card check-booking-card">
            <h2>Check Your Booking</h2>
            <p className="subtitle">Enter your booking ID to view booking details</p>

            <form onSubmit={handleCheckBooking} className="check-booking-form">
              <div className="form-group">
                <label>Booking ID</label>
                <input
                  type="text"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="Enter your booking ID"
                  className="booking-id-input"
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-block"
              >
                {loading ? 'Checking...' : 'Check Booking'}
              </button>
            </form>

            {booking && (
              <div className="booking-details">
                <div className="booking-header">
                  <h3>Booking Details</h3>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(booking.booking_status) }}
                  >
                    {formatStatus(booking.booking_status)}
                  </span>
                </div>

                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Booking ID:</span>
                    <span className="detail-value">{booking.id}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">From:</span>
                    <span className="detail-value">{booking.from_location}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">To:</span>
                    <span className="detail-value">{booking.to_location}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Cab Type:</span>
                    <span className="detail-value">{booking.cab_type_name || 'N/A'}</span>
                  </div>

                  {booking.car_option_name && (
                    <div className="detail-item">
                      <span className="detail-label">Category:</span>
                      <span className="detail-value">{booking.car_option_name}</span>
                    </div>
                  )}

                  <div className="detail-item">
                    <span className="detail-label">Passenger Name:</span>
                    <span className="detail-value">{booking.passenger_name}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{booking.passenger_phone}</span>
                  </div>

                  {booking.passenger_email && (
                    <div className="detail-item">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{booking.passenger_email}</span>
                    </div>
                  )}

                  <div className="detail-item">
                    <span className="detail-label">Distance:</span>
                    <span className="detail-value">{booking.distance_km} km</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Estimated Time:</span>
                    <span className="detail-value">{booking.estimated_time_minutes} minutes</span>
                  </div>

                  <div className="detail-item highlight">
                    <span className="detail-label">Total Fare:</span>
                    <span className="detail-value">₹{booking.fare_amount}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Booking Date:</span>
                    <span className="detail-value">
                      {new Date(booking.booking_date).toLocaleString()}
                    </span>
                  </div>

                  {booking.travel_date && (
                    <div className="detail-item">
                      <span className="detail-label">Travel Date:</span>
                      <span className="detail-value">
                        {new Date(booking.travel_date).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {booking.vehicle_number && (
                    <div className="detail-item">
                      <span className="detail-label">Vehicle Number:</span>
                      <span className="detail-value">{booking.vehicle_number}</span>
                    </div>
                  )}

                  {booking.driver_name && (
                    <div className="detail-item">
                      <span className="detail-label">Driver Name:</span>
                      <span className="detail-value">{booking.driver_name}</span>
                    </div>
                  )}

                  {booking.driver_phone && (
                    <div className="detail-item">
                      <span className="detail-label">Driver Phone:</span>
                      <span className="detail-value">{booking.driver_phone}</span>
                    </div>
                  )}

                  {booking.notes && (
                    <div className="detail-item full-width">
                      <span className="detail-label">Notes:</span>
                      <span className="detail-value">{booking.notes}</span>
                    </div>
                  )}
                </div>

                <div className="booking-actions">
                  <button
                    onClick={() => {
                      setBooking(null);
                      setBookingId('');
                      setError('');
                    }}
                    className="btn btn-secondary"
                  >
                    Check Another Booking
                  </button>
                  <a href="/" className="btn btn-primary">
                    Book Another Cab
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckBooking;

