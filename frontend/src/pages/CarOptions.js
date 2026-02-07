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
  const isAirportFlow = bookingState.service_type === 'airport' && bookingState.from_location;
  const isOutstationFlow = bookingState.service_type === 'outstation' && bookingState.from_location;

  const [options, setOptions] = useState([]);
  const [localOffers, setLocalOffers] = useState([]);
  const [airportOffers, setAirportOffers] = useState([]);
  const [airportFares, setAirportFares] = useState({});
  const [outstationOffers, setOutstationOffers] = useState([]);
  const [outstationFares, setOutstationFares] = useState({});
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
          setAirportOffers([]);
        } else if (isAirportFlow) {
          const [offersRes, estimateRes] = await Promise.all([
            api.get('/cabs/airport-offers'),
            (bookingState.from_lat != null && bookingState.from_lng != null && bookingState.to_lat != null && bookingState.to_lng != null)
              ? api.get('/cabs/airport-fare-estimate', {
                  params: {
                    from_lat: bookingState.from_lat,
                    from_lng: bookingState.from_lng,
                    to_lat: bookingState.to_lat,
                    to_lng: bookingState.to_lng,
                  },
                })
              : Promise.resolve({ data: { fares: [] } }),
          ]);
          setAirportOffers(offersRes.data || []);
          const fareMap = {};
          (estimateRes.data?.fares || []).forEach((f) => { fareMap[f.cab_type_id] = f.fare_amount; });
          setAirportFares(fareMap);
          setLocalOffers([]);
          setOutstationOffers([]);
          setOptions([]);
        } else if (isOutstationFlow) {
          const tripType = bookingState.trip_type || 'one_way';
          const estimateParams = { trip_type: tripType };
          if (tripType === 'one_way' && bookingState.from_lat != null && bookingState.from_lng != null && bookingState.to_lat != null && bookingState.to_lng != null) {
            estimateParams.from_lat = bookingState.from_lat;
            estimateParams.from_lng = bookingState.from_lng;
            estimateParams.to_lat = bookingState.to_lat;
            estimateParams.to_lng = bookingState.to_lng;
          } else if (tripType === 'round_trip' && bookingState.number_of_days) {
            estimateParams.number_of_days = bookingState.number_of_days;
          }
          const [offersRes, estimateRes] = await Promise.all([
            api.get('/cabs/outstation-offers'),
            api.get('/cabs/outstation-fare-estimate', { params: estimateParams }),
          ]);
          setOutstationOffers(offersRes.data || []);
          const fareMap = {};
          (estimateRes.data?.fares || []).forEach((f) => { fareMap[f.cab_type_id] = f.fare_amount; });
          setOutstationFares(fareMap);
          setLocalOffers([]);
          setAirportOffers([]);
          setOptions([]);
        } else {
          const response = await api.get('/car-options');
          setOptions(response.data || []);
          setLocalOffers([]);
          setAirportOffers([]);
          setOutstationOffers([]);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(
          isLocalFlow ? 'Unable to load cab types. Please try again.' :
          isAirportFlow ? 'Unable to load airport cabs. Please try again.' :
          isOutstationFlow ? 'Unable to load outstation cabs. Please try again.' :
          'Unable to load car options. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isLocalFlow, isAirportFlow, isOutstationFlow, bookingState.from_lat, bookingState.from_lng, bookingState.to_lat, bookingState.to_lng, bookingState.trip_type, bookingState.number_of_days]);

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
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      if (isAirportFlow) {
        const fareAmount = airportFares[confirmModal.cabType.id] ?? (confirmModal.cabType.baseFare || 0);
        const res = await api.post('/bookings', {
          service_type: 'airport',
          from_location: bookingState.from_location,
          to_location: bookingState.to_location,
          passenger_name: name,
          passenger_phone: phone,
          fare_amount: fareAmount,
          cab_id: confirmModal.cab.id,
          cab_type_id: confirmModal.cabType.id,
        });
        setSuccessBookingId(res.data?.id);
        setConfirmModal(null);
      } else if (isOutstationFlow) {
        const fareAmount = outstationFares[confirmModal.cabType.id] ?? 0;
        const res = await api.post('/bookings', {
          service_type: 'outstation',
          trip_type: bookingState.trip_type || 'one_way',
          from_location: bookingState.from_location,
          to_location: bookingState.to_location,
          passenger_name: name,
          passenger_phone: phone,
          fare_amount: fareAmount,
          cab_id: confirmModal.cab.id,
          cab_type_id: confirmModal.cabType.id,
        });
        setSuccessBookingId(res.data?.id);
        setConfirmModal(null);
      } else {
        const baseFare = Number(confirmModal.cabType.baseFare) || 0;
        const packageRate = confirmModal.cabType.packageRates?.[selectedHours] != null
          ? Number(confirmModal.cabType.packageRates[selectedHours])
          : 0;
        const fareAmount = baseFare + packageRate;
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
      }
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
            <h2>{isLocalFlow || isAirportFlow || isOutstationFlow ? 'Choose your cab' : 'Car Options'}</h2>
            {isLocalFlow && bookingState.from_location && (
              <div className="car-options-booking-summary">
                <span className="car-options-badge">Local</span>
                <span>From: {bookingState.from_location}</span>
                {selectedHours && (
                  <span>{selectedHours}h package</span>
                )}
              </div>
            )}
            {isAirportFlow && bookingState.from_location && (
              <div className="car-options-booking-summary">
                <span className="car-options-badge">Airport</span>
                <span>{bookingState.airport_direction === 'to_airport' ? 'To airport' : 'From airport'}: {bookingState.from_location} → {bookingState.to_location}</span>
              </div>
            )}
            {isOutstationFlow && bookingState.from_location && (
              <div className="car-options-booking-summary">
                <span className="car-options-badge">Outstation</span>
                <span>
                  {bookingState.trip_type === 'one_way' && `${bookingState.from_location} → ${bookingState.to_location}`}
                  {bookingState.trip_type === 'round_trip' && `Round trip from ${bookingState.from_location} (${bookingState.number_of_days} day(s))`}
                  {bookingState.trip_type === 'multiple_stops' && (bookingState.stops && bookingState.stops.length > 1 ? `${bookingState.stops.length} stops` : bookingState.from_location)}
                </span>
              </div>
            )}
            <p className="subtitle">
              {isLocalFlow
                ? 'Select a cab type. Rates shown for your chosen package.'
                : isAirportFlow
                  ? 'Select a cab. Fare is estimated for your route.'
                  : isOutstationFlow
                    ? 'Select a cab. Fare is estimated from your trip details.'
                    : 'Explore our different ride options curated for your comfort and budget.'}
            </p>

            {loading && <div className="loading">Loading...</div>}
            {error && !loading && <div className="error-message">{error}</div>}

            {/* Local flow: cab types with rates and cabs */}
            {!loading && !error && isLocalFlow && localOffers.length > 0 && (
              <div className="local-cab-types">
                {localOffers.map((ct) => {
                  const baseFare = Number(ct.baseFare) || 0;
                  const packageForHours = selectedHours && ct.packageRates && ct.packageRates[selectedHours] != null
                    ? Number(ct.packageRates[selectedHours])
                    : null;
                  const rateForSelected = packageForHours != null ? baseFare + packageForHours : null;
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
                          {baseFare > 0 && (
                            <div className="local-cab-type-base-fare">
                              Base fare: ₹{baseFare}
                            </div>
                          )}
                          {rateForSelected != null && (
                            <div className="local-cab-type-selected-rate">
                              Your {selectedHours}h rate: <strong>₹{rateForSelected}</strong>
                              {baseFare > 0 && <span className="local-rate-includes-base"> (incl. base fare)</span>}
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

            {/* Airport flow: no cabs configured */}
            {!loading && !error && isAirportFlow && airportOffers.length === 0 && (
              <div className="empty-state">
                <p>No airport cabs configured yet. Please check back later.</p>
              </div>
            )}

            {/* Airport flow: cab types with rates and cabs */}
            {!loading && !error && isAirportFlow && airportOffers.length > 0 && (
              <div className="local-cab-types">
                {airportOffers.map((ct) => {
                  const estimatedFare = airportFares[ct.id];
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
                            <div className="local-cab-type-image-placeholder">✈️</div>
                          )}
                        </div>
                        <div className="local-cab-type-info">
                          <h3 className="local-cab-type-name">{ct.name}</h3>
                          {ct.description && <p className="local-cab-type-desc">{ct.description}</p>}
                          <div className="local-cab-type-rates">
                            <span className="local-rate-label">From ₹{ct.baseFare || 0}</span>
                            <span className="local-rate-extra">₹{ct.perKmRate || 0}/km</span>
                            {(ct.driverCharges || ct.nightCharges) ? (
                              <span className="local-rate-extra">+ driver/night charges</span>
                            ) : null}
                          </div>
                          {estimatedFare != null && (
                            <div className="local-cab-type-selected-rate">
                              Est. fare: <strong>₹{estimatedFare}</strong>
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
                                    {estimatedFare != null && (
                                      <div className="local-cab-rate">₹{estimatedFare}</div>
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

            {/* Outstation flow: no cabs configured */}
            {!loading && !error && isOutstationFlow && outstationOffers.length === 0 && (
              <div className="empty-state">
                <p>No outstation cabs configured yet. Please check back later.</p>
              </div>
            )}

            {/* Outstation flow: cab types with rates and cabs */}
            {!loading && !error && isOutstationFlow && outstationOffers.length > 0 && (
              <div className="local-cab-types">
                {outstationOffers.map((ct) => {
                  const tripType = bookingState.trip_type || 'one_way';
                  const rates = tripType === 'one_way' ? ct.oneWay : tripType === 'round_trip' ? ct.roundTrip : ct.multipleStops;
                  const estimatedFare = outstationFares[ct.id];
                  const firstCarImage = ct.cabs && ct.cabs.length > 0 && ct.cabs[0].image_url
                    ? getImageUrl(ct.cabs[0].image_url)
                    : null;
                  let rateSummary = '';
                  if (rates) {
                    if (tripType === 'one_way') {
                      rateSummary = `Base ₹${rates.baseFare || 0}, then ₹${rates.extraKmRate || 0}/km after ${rates.minKm || 0} km`;
                    } else if (tripType === 'round_trip') {
                      rateSummary = `${rates.baseKmPerDay || 0} km/day, ₹${rates.perKmRate || 0}/km, ₹${rates.extraKmRate || 0}/km extra`;
                    } else {
                      rateSummary = `Base ₹${rates.baseFare || 0}, ₹${rates.perKmRate || 0}/km`;
                    }
                  }
                  return (
                    <div key={ct.id} className="local-cab-type-card">
                      <div className="local-cab-type-header">
                        <div className="local-cab-type-image-wrap">
                          {firstCarImage ? (
                            <img src={firstCarImage} alt={ct.name} className="local-cab-type-image" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="local-cab-type-image-placeholder">🛣️</div>
                          )}
                        </div>
                        <div className="local-cab-type-info">
                          <h3 className="local-cab-type-name">{ct.name}</h3>
                          {ct.description && <p className="local-cab-type-desc">{ct.description}</p>}
                          {rateSummary && (
                            <div className="local-cab-type-rates">
                              <span className="local-rate-extra">{rateSummary}</span>
                            </div>
                          )}
                          {estimatedFare != null && estimatedFare > 0 && (
                            <div className="local-cab-type-selected-rate">
                              Est. fare: <strong>₹{estimatedFare}</strong>
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
                                    {estimatedFare != null && (
                                      <div className="local-cab-rate">₹{estimatedFare}</div>
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
            {!loading && !error && !isLocalFlow && !isAirportFlow && !isOutstationFlow && options.length === 0 && localOffers.length === 0 && (
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

            {!loading && !error && !isLocalFlow && !isAirportFlow && !isOutstationFlow && options.length > 0 && (
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
              {isAirportFlow ? (
                <>
                  <div className="car-options-confirm-row">
                    <span>From</span>
                    <span>{bookingState.from_location || '—'}</span>
                  </div>
                  <div className="car-options-confirm-row">
                    <span>To</span>
                    <span>{bookingState.to_location || '—'}</span>
                  </div>
                  <div className="car-options-confirm-row">
                    <span>Cab type</span>
                    <span>{confirmModal.cabType.name}</span>
                  </div>
                  <div className="car-options-confirm-row">
                    <span>Vehicle</span>
                    <span>{confirmModal.cab.vehicle_number}</span>
                  </div>
                  <div className="car-options-confirm-row car-options-confirm-total">
                    <span>Total</span>
                    <span>₹{airportFares[confirmModal.cabType.id] ?? (confirmModal.cabType.baseFare || 0)}</span>
                  </div>
                </>
              ) : isOutstationFlow ? (
                <>
                  <div className="car-options-confirm-row">
                    <span>From</span>
                    <span>{bookingState.from_location || '—'}</span>
                  </div>
                  <div className="car-options-confirm-row">
                    <span>To</span>
                    <span>{bookingState.to_location || '—'}</span>
                  </div>
                  {bookingState.trip_type === 'round_trip' && (
                    <div className="car-options-confirm-row">
                      <span>Days</span>
                      <span>{bookingState.number_of_days}</span>
                    </div>
                  )}
                  <div className="car-options-confirm-row">
                    <span>Cab type</span>
                    <span>{confirmModal.cabType.name}</span>
                  </div>
                  <div className="car-options-confirm-row">
                    <span>Vehicle</span>
                    <span>{confirmModal.cab.vehicle_number}</span>
                  </div>
                  <div className="car-options-confirm-row car-options-confirm-total">
                    <span>Total</span>
                    <span>₹{outstationFares[confirmModal.cabType.id] ?? 0}</span>
                  </div>
                </>
              ) : (
                <>
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
                  {(Number(confirmModal.cabType.baseFare) || 0) > 0 && (
                    <div className="car-options-confirm-row">
                      <span>Base fare</span>
                      <span>₹{confirmModal.cabType.baseFare}</span>
                    </div>
                  )}
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
                    <span>₹{(Number(confirmModal.cabType.baseFare) || 0) + (confirmModal.cabType.packageRates?.[selectedHours] != null ? Number(confirmModal.cabType.packageRates[selectedHours]) : 0)}</span>
                  </div>
                </>
              )}
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
