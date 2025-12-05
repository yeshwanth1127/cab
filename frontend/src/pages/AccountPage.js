import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import MainNavbar from '../components/MainNavbar';
import './CheckBooking.css';

const AccountPage = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchBookings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/bookings/my');
        setBookings(response.data);
      } catch (err) {
        console.error('Error fetching user bookings:', err);
        setError('Unable to load your bookings right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  const downloadReceipt = async (bookingId) => {
    try {
      const response = await api.get(`/bookings/${bookingId}/receipt`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `booking-${bookingId}-receipt.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading receipt:', err);
      alert('Failed to download receipt. Please try again later.');
    }
  };

  if (!user) {
    return (
      <div className="check-booking-page">
        <MainNavbar />
        <div className="container">
          <div className="check-booking-container">
            <div className="card check-booking-card">
              <h2>My Account</h2>
              <p className="subtitle">
                Please log in to view your account details and booking history.
              </p>
              <a href="/login" className="btn btn-primary">
                Go to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="check-booking-page">
      <MainNavbar />
      <div className="container">
        <div className="check-booking-container">
          <div className="card check-booking-card">
            <h2>My Account</h2>
            <p className="subtitle">View your profile details and booking history.</p>

            <div className="booking-details" style={{ marginBottom: '24px' }}>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Username:</span>
                  <span className="detail-value">{user.username}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{user.email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role:</span>
                  <span className="detail-value">{user.role}</span>
                </div>
              </div>
            </div>

            <h3 style={{ marginBottom: '12px' }}>My Bookings</h3>

            {loading && <div className="loading">Loading your bookings...</div>}
            {error && !loading && <div className="error-message">{error}</div>}

            {!loading && !error && bookings.length === 0 && (
              <div className="empty-state">
                <p>You have no bookings yet.</p>
              </div>
            )}

            {!loading && !error && bookings.length > 0 && (
              <div className="booking-details">
                <div className="details-grid">
                  {bookings.map((b) => (
                    <div key={b.id} className="detail-item full-width">
                      <div className="detail-label">
                        #{b.id} &mdash; {b.from_location} → {b.to_location}
                      </div>
                      <div className="detail-value">
                        ₹{b.fare_amount} &nbsp;|&nbsp; {b.cab_type_name || 'Cab'} &nbsp;|&nbsp;
                        {new Date(b.booking_date).toLocaleString()}
                        &nbsp;|&nbsp;
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginLeft: '6px' }}
                          onClick={() => downloadReceipt(b.id)}
                        >
                          Download Receipt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;


