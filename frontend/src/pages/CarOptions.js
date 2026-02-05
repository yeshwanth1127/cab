import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api, { getImageUrl } from '../services/api';
import MainNavbar from '../components/MainNavbar';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import './CarOptions.css';

const CarOptions = () => {
  const location = useLocation();
  const bookingState = location.state || {};
  const isLocalFlow = bookingState.service_type === 'local' && bookingState.number_of_hours;

  const [options, setOptions] = useState([]);
  const [localOffers, setLocalOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmPassengerName, setConfirmPassengerName] = useState('');
  const [confirmPassengerPhone, setConfirmPassengerPhone] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [successBookingId, setSuccessBookingId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        if (isLocalFlow) {
          const response = await api.get('/cabs/local-offers');
          setLocalOffers(response.data || []);
          setOptions([]);
        } else {
          const response = await api.get('/car-options');
          setOptions(response.data || []);
          setLocalOffers([]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(isLocalFlow ? 'Unable to load cab types. Please try again.' : 'Unable to load car options. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLocalFlow]);

  const selectedHours = bookingState.number_of_hours ? Number(bookingState.number_of_hours) : null;
  const fromLocation = bookingState.from_location || '';

  const handleBookNow = (cab, cabType) => {
    setConfirmError('');
    setConfirmPassengerName('');
    setConfirmPassengerPhone('');
    setConfirmModal({ cab, cabType });
  };

  const handleCloseConfirm = () => {
    setConfirmModal(null);
    setConfirmError('');
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!confirmModal?.cab || !confirmModal?.cabType) return;
    const name = (confirmPassengerName || '').trim();
    const phone = (confirmPassengerPhone || '').trim();
    if (!name || !phone) {
      setConfirmError('Please enter your name and phone number.');
      return;
    }
    const fareAmount = confirmModal.cabType.packageRates?.[selectedHours] != null
      ? Number(confirmModal.cabType.packageRates[selectedHours])
      : 0;
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      const res = await api.post('/bookings', {
        service_type: 'local',
        from_location: fromLocation,
        to_location: 'Local package',
        passenger_name: name,
        passenger_phone: phone,
        fare_amount: fareAmount,
        number_of_hours: selectedHours,
        cab_id: confirmModal.cab.id,
        cab_type_id: confirmModal.cabType.id,
      });
      setSuccessBookingId(res.data?.id);
      setConfirmModal(null);
    } catch (err) {
      console.error('Error creating booking:', err);
      setConfirmError(err.response?.data?.error || 'Failed to create booking. Please try again.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  return (
    <div className="car-options-page">
      <MainNavbar />
      <div className="car-options-map-wrapper">
        <AnimatedMapBackground />
      </div>
      <div className="container">
        <div className="car-options-container">
          <div className="card car-options-card">
            <h2>{isLocalFlow ? 'Choose your cab' : 'Car Options'}</h2>
            {isLocalFlow && bookingState.from_location && (
              <div className="car-options-booking-summary">
                <span className="car-options-badge">Local</span>
                <span>From: {bookingState.from_location}</span>
                {selectedHours && (
                  <span>{selectedHours}h package</span>
                )}
              </div>
            )}
            <p className="subtitle">
              {isLocalFlow
                ? 'Select a cab type. Rates shown for your chosen package.'
                : 'Explore our different ride options curated for your comfort and budget.'}
            </p>

            {loading && <div className="loading">Loading...</div>}
            {error && !loading && <div className="error-message">{error}</div>}

            {/* Local flow: cab types with rates and cabs */}
            {!loading && !error && isLocalFlow && localOffers.length > 0 && (
              <div className="local-cab-types">
                {localOffers.map((ct) => {
                  const rateForSelected = selectedHours && ct.packageRates && ct.packageRates[selectedHours] != null
                    ? Number(ct.packageRates[selectedHours])
                    : null;
                  const firstCarImage = ct.cabs && ct.cabs.length > 0 && ct.cabs[0].image_url
                    ? getImageUrl(ct.cabs[0].image_url)
                    : null;
                  return (
                    <div key={ct.id} className="local-cab-type-card">
                      <div className="local-cab-type-header">
                        <div className="local-cab-type-image-wrap">
                          {firstCarImage ? (
                            <img src={firstCarImage} alt={ct.name} className="local-cab-type-image" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="local-cab-type-image-placeholder">🚗</div>
                          )}
                        </div>
                        <div className="local-cab-type-info">
                          <h3 className="local-cab-type-name">{ct.name}</h3>
                          {ct.description && <p className="local-cab-type-desc">{ct.description}</p>}
                          <div className="local-cab-type-rates">
                            <span className="local-rate-label">Packages:</span>
                            {[4, 8, 12].map((h) => (
                              <span key={h} className={`local-rate-pill ${selectedHours === h ? 'local-rate-pill-selected' : ''}`}>
                                {h}h: ₹{ct.packageRates && ct.packageRates[h] != null ? ct.packageRates[h] : '—'}
                              </span>
                            ))}
                            {ct.extraHourRate != null && (
                              <span className="local-rate-extra">Extra hr: ₹{ct.extraHourRate}</span>
                            )}
                          </div>
                          {rateForSelected != null && (
                            <div className="local-cab-type-selected-rate">
                              Your {selectedHours}h rate: <strong>₹{rateForSelected}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="local-cabs-list">
                        <h4 className="local-cabs-list-title">Cabs</h4>
                        {ct.cabs && ct.cabs.length > 0 ? (
                          <div className="local-cabs-grid">
                            {ct.cabs.map((cab) => {
                              const cabImageUrl = cab.image_url ? getImageUrl(cab.image_url) : null;
                              return (
                                <div key={cab.id} className="local-cab-card">
                                  <div className="local-cab-image-wrap">
                                    {cabImageUrl ? (
                                      <img src={cabImageUrl} alt={cab.name || cab.vehicle_number} className="local-cab-image" onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                      <div className="local-cab-image-placeholder">🚙</div>
                                    )}
                                  </div>
                                  <div className="local-cab-details">
                                    <div className="local-cab-vehicle">{cab.vehicle_number}</div>
                                    {cab.name && <div className="local-cab-name">{cab.name}</div>}
                                    {cab.driver_name && <div className="local-cab-driver">Driver: {cab.driver_name}</div>}
                                    {cab.driver_phone && <div className="local-cab-phone">{cab.driver_phone}</div>}
                                    {rateForSelected != null && (
                                      <div className="local-cab-rate">₹{rateForSelected} ({selectedHours}h)</div>
                                    )}
                                    <button
                                      type="button"
                                      className="local-cab-book-btn"
                                      onClick={() => handleBookNow(cab, ct)}
                                    >
                                      Book Now
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="local-cabs-empty">No cabs added for this type.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Default: marketing car options */}
            {!loading && !error && !isLocalFlow && options.length === 0 && localOffers.length === 0 && (
              <div className="empty-state">
                <p>No car options available yet. Please check back soon.</p>
              </div>
            )}

            {successBookingId && (
              <div className="car-options-success-banner">
                <p className="car-options-success-title">Booking confirmed!</p>
                <p className="car-options-success-id">Your booking ID is <strong>#{successBookingId}</strong></p>
                <Link to="/check-booking" className="car-options-success-link">Check booking</Link>
                <button
                  type="button"
                  className="car-options-success-dismiss"
                  onClick={() => setSuccessBookingId(null)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            {!loading && !error && !isLocalFlow && options.length > 0 && (
              <div className="car-options-grid">
                {options.map((opt) => {
                  const relativeImageUrl = (opt.image_urls && opt.image_urls.length > 0)
                    ? opt.image_urls[0]
                    : (opt.image_url || null);
                  const imageUrl = getImageUrl(relativeImageUrl);
                  return (
                    <div key={opt.id} className="car-option-card">
                      {imageUrl ? (
                        <div className="car-option-image-wrapper">
                          <img
                            src={imageUrl}
                            alt={opt.name}
                            className="car-option-image"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <div className="car-option-image-wrapper" style={{ background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#9ca3af' }}>No Image</span>
                        </div>
                      )}
                      <div className="car-option-content">
                        <h3>{opt.name}</h3>
                        {opt.description && <p>{opt.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmModal?.cab && confirmModal?.cabType && (
        <div className="car-options-confirm-overlay" onClick={handleCloseConfirm}>
          <div className="car-options-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="car-options-confirm-header">
              <h3>Re-confirm booking</h3>
              <button type="button" className="car-options-confirm-close" onClick={handleCloseConfirm} aria-label="Close">×</button>
            </div>
            <div className="car-options-confirm-fare">
              <div className="car-options-confirm-row">
                <span>From</span>
                <span>{fromLocation || '—'}</span>
              </div>
              <div className="car-options-confirm-row">
                <span>Package</span>
                <span>{selectedHours}h</span>
              </div>
              <div className="car-options-confirm-row">
                <span>Cab type</span>
                <span>{confirmModal.cabType.name}</span>
              </div>
              <div className="car-options-confirm-row">
                <span>Vehicle</span>
                <span>{confirmModal.cab.vehicle_number}</span>
              </div>
              <div className="car-options-confirm-row">
                <span>Package ({selectedHours}h)</span>
                <span>₹{confirmModal.cabType.packageRates?.[selectedHours] != null ? confirmModal.cabType.packageRates[selectedHours] : '—'}</span>
              </div>
              {confirmModal.cabType.extraHourRate != null && (
                <div className="car-options-confirm-row">
                  <span>Extra hour</span>
                  <span>₹{confirmModal.cabType.extraHourRate}/hr</span>
                </div>
              )}
              <div className="car-options-confirm-row car-options-confirm-total">
                <span>Total</span>
                <span>₹{confirmModal.cabType.packageRates?.[selectedHours] != null ? confirmModal.cabType.packageRates[selectedHours] : '—'}</span>
              </div>
            </div>
            <form onSubmit={handleConfirmBooking} className="car-options-confirm-form">
              <div className="car-options-confirm-field">
                <label htmlFor="car-confirm-name">Your name</label>
                <input
                  id="car-confirm-name"
                  type="text"
                  value={confirmPassengerName}
                  onChange={(e) => setConfirmPassengerName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className="car-options-confirm-field">
                <label htmlFor="car-confirm-phone">Phone number</label>
                <input
                  id="car-confirm-phone"
                  type="tel"
                  value={confirmPassengerPhone}
                  onChange={(e) => setConfirmPassengerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              {confirmError && <p className="car-options-confirm-error">{confirmError}</p>}
              <div className="car-options-confirm-actions">
                <button type="button" className="car-options-confirm-cancel" onClick={handleCloseConfirm}>
                  Cancel
                </button>
                <button type="submit" className="car-options-confirm-submit" disabled={confirmSubmitting}>
                  {confirmSubmitting ? 'Booking…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarOptions;
