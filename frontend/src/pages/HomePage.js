import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { getImageUrl } from '../services/api';
import MainNavbar from '../components/MainNavbar';
import LocationInput from '../components/LocationInput';
import './HomePage.css';

const HOURS_OPTIONS = [4, 8, 12];

const HomePage = () => {
  const navigate = useNavigate();
  const [serviceChoice, setServiceChoice] = useState(null);
  const [fromLocation, setFromLocation] = useState(null);
  const [numberOfHours, setNumberOfHours] = useState(null);
  const [airportDirection, setAirportDirection] = useState(null);
  const [airportLocation, setAirportLocation] = useState(null);
  const [outstationTripType, setOutstationTripType] = useState('one_way');
  const [outstationFrom, setOutstationFrom] = useState(null);
  const [outstationTo, setOutstationTo] = useState(null);
  const [outstationRoundTripDays, setOutstationRoundTripDays] = useState('');
  const [outstationMultiStops, setOutstationMultiStops] = useState([null, null]);
  const [localOffers, setLocalOffers] = useState([]);
  const [localOffersLoading, setLocalOffersLoading] = useState(false);
  const [localOffersError, setLocalOffersError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmPassengerName, setConfirmPassengerName] = useState('');
  const [confirmPassengerPhone, setConfirmPassengerPhone] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [successBookingId, setSuccessBookingId] = useState(null);

  const fromAddress = fromLocation?.address || '';

  const handleBackToServices = () => {
    setServiceChoice(null);
    setFromLocation(null);
    setNumberOfHours(null);
    setAirportDirection(null);
    setAirportLocation(null);
    setOutstationTripType('one_way');
    setOutstationFrom(null);
    setOutstationTo(null);
    setOutstationRoundTripDays('');
    setOutstationMultiStops([null, null]);
    setLocalOffers([]);
    setLocalOffersError('');
  };

  const airportLocationAddress = airportLocation?.address || '';

  const handleContinueToOutstationCabSelection = () => {
    if (outstationTripType === 'one_way') {
      const fromAddr = outstationFrom?.address || '';
      const toAddr = outstationTo?.address || '';
      if (!fromAddr.trim() || !toAddr.trim()) return;
      navigate('/car-options', {
        state: {
          service_type: 'outstation',
          trip_type: 'one_way',
          from_location: fromAddr,
          to_location: toAddr,
          from_lat: outstationFrom?.lat ?? null,
          from_lng: outstationFrom?.lng ?? null,
          to_lat: outstationTo?.lat ?? null,
          to_lng: outstationTo?.lng ?? null,
        },
      });
    } else if (outstationTripType === 'round_trip') {
      const pickupAddr = outstationFrom?.address || '';
      const days = Number(outstationRoundTripDays);
      if (!pickupAddr.trim() || !(days >= 1)) return;
      navigate('/car-options', {
        state: {
          service_type: 'outstation',
          trip_type: 'round_trip',
          from_location: pickupAddr,
          to_location: pickupAddr,
          number_of_days: days,
        },
      });
    } else {
      const stops = outstationMultiStops.map((s) => s?.address || '').filter(Boolean);
      if (stops.length < 1) return;
      navigate('/car-options', {
        state: {
          service_type: 'outstation',
          trip_type: 'multiple_stops',
          from_location: stops[0],
          to_location: stops.length > 1 ? stops[stops.length - 1] : stops[0],
          stops: stops,
        },
      });
    }
  };

  const BANGALORE_AIRPORT_NAME = 'Bangalore International Airport';
  const KIA_LAT = 13.1989;
  const KIA_LNG = 77.7068;

  const handleContinueToAirportCabSelection = () => {
    if (!airportLocationAddress.trim()) return;
    const isToAirport = (airportDirection || 'to_airport') === 'to_airport';
    const fromAddress = isToAirport ? airportLocationAddress : BANGALORE_AIRPORT_NAME;
    const toAddress = isToAirport ? BANGALORE_AIRPORT_NAME : airportLocationAddress;
    const fromLat = isToAirport ? (airportLocation?.lat ?? null) : KIA_LAT;
    const fromLng = isToAirport ? (airportLocation?.lng ?? null) : KIA_LNG;
    const toLat = isToAirport ? KIA_LAT : (airportLocation?.lat ?? null);
    const toLng = isToAirport ? KIA_LNG : (airportLocation?.lng ?? null);
    navigate('/car-options', {
      state: {
        service_type: 'airport',
        airport_direction: airportDirection,
        from_location: fromAddress,
        to_location: toAddress,
        from_lat: fromLat,
        from_lng: fromLng,
        to_lat: toLat,
        to_lng: toLng,
      },
    });
  };

  const handleContinueToCabSelection = () => {
    if (!fromAddress.trim()) return;
    if (!numberOfHours) return;
    setLocalOffersError('');
    setLocalOffersLoading(true);
    api
      .get('/cabs/local-offers')
      .then((res) => {
        setLocalOffers(res.data || []);
      })
      .catch((err) => {
        console.error(err);
        setLocalOffersError('Unable to load cab types. Please try again.');
        setLocalOffers([]);
      })
      .finally(() => {
        setLocalOffersLoading(false);
      });
  };

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
    const baseFare = Number(confirmModal.cabType.baseFare) || 0;
    const packageRate = confirmModal.cabType.packageRates?.[numberOfHours] != null
      ? Number(confirmModal.cabType.packageRates[numberOfHours])
      : 0;
    const fareAmount = baseFare + packageRate;
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      const res = await api.post('/bookings', {
        service_type: 'local',
        from_location: fromAddress,
        to_location: 'Local package',
        passenger_name: name,
        passenger_phone: phone,
        fare_amount: fareAmount,
        number_of_hours: numberOfHours,
        cab_id: confirmModal.cab.id,
        cab_type_id: confirmModal.cabType.id,
        pickup_lat: fromLocation?.lat ?? null,
        pickup_lng: fromLocation?.lng ?? null,
      });
      setSuccessBookingId(res.data?.id);
      setConfirmModal(null);
    } catch (err) {
      console.error(err);
      setConfirmError(
        err.response?.data?.error || 'Failed to create booking. Please try again.'
      );
    } finally {
      setConfirmSubmitting(false);
    }
  };

  return (
    <div className="home-page">
      <MainNavbar />
      <section className="home-hero-section">
        <div className="home-hero-inner">
          {serviceChoice === null && (
            <>
              <h1 className="home-hero-title">
                <span className="home-hero-namma">Namma</span>{' '}
                <span className="home-hero-cabs">Cabs</span>
              </h1>
              <p className="home-hero-tagline">
                Book reliable local, airport, and outstation cabs. Safe and
                comfortable rides at transparent prices.
              </p>
              <div className="home-service-options">
                <button
                  type="button"
                  className="home-service-option"
                  onClick={() => setServiceChoice('local')}
                >
                  <span className="home-service-icon">🚗</span>
                  <span className="home-service-label">Local</span>
                  <span className="home-service-desc">Hourly packages</span>
                </button>
                <button
                  type="button"
                  className="home-service-option"
                  onClick={() => setServiceChoice('airport')}
                >
                  <span className="home-service-icon">✈️</span>
                  <span className="home-service-label">Airport</span>
                  <span className="home-service-desc">Pickup & drop</span>
                </button>
                <button
                  type="button"
                  className="home-service-option"
                  onClick={() => setServiceChoice('outstation')}
                >
                  <span className="home-service-icon">🛣️</span>
                  <span className="home-service-label">Outstation</span>
                  <span className="home-service-desc">One-way & round trip</span>
                </button>
              </div>
            </>
          )}

          {serviceChoice === 'airport' && (
            <>
              <div className="home-flow-header">
                <button
                  type="button"
                  className="home-back-link"
                  onClick={handleBackToServices}
                >
                  ← Back to services
                </button>
                <h2 className="home-flow-title">Airport cab</h2>
                <p className="home-flow-desc">
                  Choose direction and enter your location.
                </p>
              </div>
              <div className="home-local-form">
                <div className="home-form-group">
                  <label className="home-form-label">Trip direction</label>
                  <div className="home-airport-toggle">
                    <button
                      type="button"
                      className={`home-airport-toggle-btn ${(airportDirection || 'to_airport') === 'to_airport' ? 'home-airport-toggle-btn-selected' : ''}`}
                      onClick={() => setAirportDirection('to_airport')}
                    >
                      Going to airport
                    </button>
                    <button
                      type="button"
                      className={`home-airport-toggle-btn ${airportDirection === 'from_airport' ? 'home-airport-toggle-btn-selected' : ''}`}
                      onClick={() => setAirportDirection('from_airport')}
                    >
                      Coming from airport
                    </button>
                  </div>
                </div>
                <div className="home-form-group">
                  <label className="home-form-label">
                    {(airportDirection || 'to_airport') === 'to_airport' ? 'Pickup location' : 'Drop location'}
                  </label>
                  <LocationInput
                    placeholder={(airportDirection || 'to_airport') === 'to_airport' ? 'Enter your pickup address' : 'Enter your drop address'}
                    value={airportLocation}
                    onSelect={setAirportLocation}
                    label={(airportDirection || 'to_airport') === 'to_airport' ? 'From' : 'To'}
                  />
                </div>
                {(airportDirection || 'to_airport') === 'to_airport' && (
                  <p className="home-airport-destination-hint">Destination: Bangalore International Airport (distance & fare will be calculated automatically)</p>
                )}
                <button
                  type="button"
                  className="home-continue-btn"
                  disabled={!airportLocationAddress.trim()}
                  onClick={handleContinueToAirportCabSelection}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {serviceChoice === 'outstation' && (
            <>
              <div className="home-flow-header">
                <button
                  type="button"
                  className="home-back-link"
                  onClick={handleBackToServices}
                >
                  ← Back to services
                </button>
                <h2 className="home-flow-title">Outstation cab</h2>
                <p className="home-flow-desc">
                  Select trip type and enter your locations.
                </p>
              </div>
              <div className="home-local-form">
                <div className="home-form-group">
                  <label className="home-form-label">Select type</label>
                  <select
                    className="home-outstation-select"
                    value={outstationTripType}
                    onChange={(e) => setOutstationTripType(e.target.value)}
                  >
                    <option value="one_way">One way</option>
                    <option value="round_trip">Round trip</option>
                    <option value="multiple_stops">Multi way</option>
                  </select>
                </div>

                {outstationTripType === 'one_way' && (
                  <>
                    <div className="home-form-group">
                      <label className="home-form-label">From</label>
                      <LocationInput
                        placeholder="Enter pickup location"
                        value={outstationFrom}
                        onSelect={setOutstationFrom}
                        label="From"
                      />
                    </div>
                    <div className="home-form-group">
                      <label className="home-form-label">To</label>
                      <LocationInput
                        placeholder="Enter drop location"
                        value={outstationTo}
                        onSelect={setOutstationTo}
                        label="To"
                      />
                    </div>
                  </>
                )}

                {outstationTripType === 'round_trip' && (
                  <>
                    <div className="home-form-group">
                      <label className="home-form-label">Pickup point</label>
                      <LocationInput
                        placeholder="Enter pickup location"
                        value={outstationFrom}
                        onSelect={setOutstationFrom}
                        label="Pickup"
                      />
                    </div>
                    <div className="home-form-group">
                      <label className="home-form-label">Number of days</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        className="home-outstation-days-input"
                        placeholder="e.g. 2"
                        value={outstationRoundTripDays}
                        onChange={(e) => setOutstationRoundTripDays(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {outstationTripType === 'multiple_stops' && (
                  <>
                    <div className="home-form-group">
                      <label className="home-form-label">Destination 1</label>
                      <LocationInput
                        placeholder="Enter first destination"
                        value={outstationMultiStops[0] || null}
                        onSelect={(loc) => setOutstationMultiStops((prev) => {
                          const next = [...prev];
                          next[0] = loc;
                          return next;
                        })}
                        label="Stop 1"
                      />
                    </div>
                    <div className="home-form-group">
                      <label className="home-form-label">Destination 2 (optional)</label>
                      <LocationInput
                        placeholder="Enter second destination"
                        value={outstationMultiStops[1] || null}
                        onSelect={(loc) => setOutstationMultiStops((prev) => {
                          const next = [...prev];
                          next[1] = loc;
                          return next;
                        })}
                        label="Stop 2"
                      />
                    </div>
                    {outstationMultiStops.slice(2).map((stop, idx) => (
                      <div key={idx} className="home-form-group">
                        <label className="home-form-label">Stop {idx + 3}</label>
                        <LocationInput
                          placeholder="Enter destination"
                          value={stop || null}
                          onSelect={(loc) => setOutstationMultiStops((prev) => {
                            const next = [...prev];
                            next[idx + 2] = loc;
                            return next;
                          })}
                          label={`Stop ${idx + 3}`}
                        />
                      </div>
                    ))}
                    <div className="home-form-group home-add-stop-wrap">
                      <button
                        type="button"
                        className="home-add-stop-btn"
                        onClick={() => setOutstationMultiStops((prev) => [...prev, null])}
                      >
                        + Add stop
                      </button>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="home-continue-btn"
                  disabled={
                    outstationTripType === 'one_way'
                      ? !(outstationFrom?.address || '').trim() || !(outstationTo?.address || '').trim()
                      : outstationTripType === 'round_trip'
                        ? !(outstationFrom?.address || '').trim() || !(Number(outstationRoundTripDays) >= 1)
                        : !(outstationMultiStops[0]?.address || '').trim()
                  }
                  onClick={handleContinueToOutstationCabSelection}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {serviceChoice === 'local' && (
            <>
              <div className="home-flow-header">
                <button
                  type="button"
                  className="home-back-link"
                  onClick={handleBackToServices}
                >
                  ← Back to services
                </button>
                <h2 className="home-flow-title">Local cab</h2>
                <p className="home-flow-desc">
                  Enter pickup location and choose your package hours.
                </p>
              </div>

              {localOffers.length === 0 && (
                <div className="home-local-form">
                  <div className="home-form-group">
                    <label className="home-form-label">Pickup location</label>
                    <LocationInput
                      placeholder="Enter pickup address"
                      value={fromLocation}
                      onSelect={setFromLocation}
                      label="From"
                    />
                  </div>
                  <div className="home-form-group">
                    <label className="home-form-label">Package (hours)</label>
                    <div className="home-hours-options">
                      {HOURS_OPTIONS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`home-hour-btn ${
                            numberOfHours === h ? 'home-hour-btn-selected' : ''
                          }`}
                          onClick={() => setNumberOfHours(h)}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="home-continue-btn"
                    disabled={!fromAddress.trim() || !numberOfHours}
                    onClick={handleContinueToCabSelection}
                  >
                    Continue
                  </button>
                </div>
              )}

              {localOffersLoading && (
                <p className="home-hero-tagline">Loading cab options…</p>
              )}
              {localOffersError && (
                <p className="home-local-offers-error">{localOffersError}</p>
              )}

              {!localOffersLoading && localOffers.length > 0 && (
                <div className="home-local-cab-types-wrap">
                  <div className="home-flow-header">
                    <button
                      type="button"
                      className="home-back-link"
                      onClick={() => {
                        setLocalOffers([]);
                        setLocalOffersError('');
                      }}
                    >
                      ← Change location or hours
                    </button>
                    <h2 className="home-flow-title">Choose your cab</h2>
                    <p className="home-flow-desc">
                      From: {fromAddress} · {numberOfHours}h package
                    </p>
                  </div>
                  <div className="home-local-cab-types">
                    {localOffers.map((ct) => {
                      const baseFare = Number(ct.baseFare) || 0;
                      const packageForHours =
                        numberOfHours && ct.packageRates?.[numberOfHours] != null
                          ? Number(ct.packageRates[numberOfHours])
                          : null;
                      const rateForSelected =
                        packageForHours != null ? baseFare + packageForHours : null;
                      const firstCarImage =
                        ct.cabs?.length > 0 && ct.cabs[0].image_url
                          ? getImageUrl(ct.cabs[0].image_url)
                          : null;
                      return (
                        <div key={ct.id} className="home-local-cab-type-card">
                          <div className="home-local-cab-type-header">
                            <div className="home-local-cab-type-image-wrap">
                              {firstCarImage ? (
                                <img
                                  src={firstCarImage}
                                  alt={ct.name}
                                  className="home-local-cab-type-image"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="home-local-cab-type-image-placeholder">
                                  🚗
                                </div>
                              )}
                            </div>
                            <div className="home-local-cab-type-info">
                              <h3 className="home-local-cab-type-name">
                                {ct.name}
                              </h3>
                              {ct.description && (
                                <p className="home-local-cab-type-desc">
                                  {ct.description}
                                </p>
                              )}
                              <div className="home-local-cab-type-rates">
                                <span className="home-local-rate-label">
                                  Packages:
                                </span>
                                {[4, 8, 12].map((h) => (
                                  <span
                                    key={h}
                                    className={`home-local-rate-pill ${
                                      numberOfHours === h
                                        ? 'home-local-rate-pill-selected'
                                        : ''
                                    }`}
                                  >
                                    {h}h: ₹
                                    {ct.packageRates?.[h] != null
                                      ? ct.packageRates[h]
                                      : '—'}
                                  </span>
                                ))}
                                {ct.extraHourRate != null && (
                                  <span className="home-local-rate-extra">
                                    Extra hr: ₹{ct.extraHourRate}
                                  </span>
                                )}
                              </div>
                              {baseFare > 0 && (
                                <div className="home-local-cab-type-base-fare">
                                  Base fare: ₹{baseFare}
                                </div>
                              )}
                              {rateForSelected != null && (
                                <div className="home-local-cab-type-selected-rate">
                                  Your {numberOfHours}h rate:{' '}
                                  <strong>₹{rateForSelected}</strong>
                                  {baseFare > 0 && <span className="home-local-rate-includes-base"> (incl. base fare)</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="home-local-cabs-list">
                            <h4 className="home-local-cabs-list-title">
                              Cabs
                            </h4>
                            {ct.cabs?.length > 0 ? (
                              <div className="home-local-cabs-grid">
                                {ct.cabs.map((cab) => {
                                  const cabImageUrl = cab.image_url
                                    ? getImageUrl(cab.image_url)
                                    : null;
                                  return (
                                    <div
                                      key={cab.id}
                                      className="home-local-cab-card"
                                    >
                                      <div className="home-local-cab-image-wrap">
                                        {cabImageUrl ? (
                                          <img
                                            src={cabImageUrl}
                                            alt={
                                              cab.name || cab.vehicle_number
                                            }
                                            className="home-local-cab-image"
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div className="home-local-cab-image-placeholder">
                                            🚙
                                          </div>
                                        )}
                                      </div>
                                      <div className="home-local-cab-details">
                                        <div className="home-local-cab-vehicle">
                                          {cab.vehicle_number}
                                        </div>
                                        {cab.name && (
                                          <div className="home-local-cab-name">
                                            {cab.name}
                                          </div>
                                        )}
                                        {cab.driver_name && (
                                          <div className="home-local-cab-driver">
                                            Driver: {cab.driver_name}
                                          </div>
                                        )}
                                        {cab.driver_phone && (
                                          <div className="home-local-cab-phone">
                                            {cab.driver_phone}
                                          </div>
                                        )}
                                        {rateForSelected != null && (
                                          <div className="home-local-cab-type-selected-rate">
                                            ₹{rateForSelected} ({numberOfHours}
                                            h)
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          className="home-continue-btn"
                                          onClick={() =>
                                            handleBookNow(cab, ct)
                                          }
                                        >
                                          Book Now
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="home-local-cabs-empty">
                                No cabs added for this type.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {serviceChoice === null && (
        <div className="home-secondary-links">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/check-booking">Check booking</Link>
          <Link to="/corporate">Corporate</Link>
          <Link to="/events">Events</Link>
        </div>
      )}

      {confirmModal?.cab && confirmModal?.cabType && (
        <div
          className="home-confirm-overlay"
          onClick={handleCloseConfirm}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseConfirm()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="home-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="home-confirm-header">
              <h3>Re-confirm booking</h3>
              <button
                type="button"
                className="home-confirm-close"
                onClick={handleCloseConfirm}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="home-confirm-fare">
              <div className="home-confirm-row">
                <span>From</span>
                <span>{fromAddress || '—'}</span>
              </div>
              <div className="home-confirm-row">
                <span>Package</span>
                <span>{numberOfHours}h</span>
              </div>
              <div className="home-confirm-row">
                <span>Cab type</span>
                <span>{confirmModal.cabType.name}</span>
              </div>
              <div className="home-confirm-row">
                <span>Vehicle</span>
                <span>{confirmModal.cab.vehicle_number}</span>
              </div>
              {(Number(confirmModal.cabType.baseFare) || 0) > 0 && (
                <div className="home-confirm-row">
                  <span>Base fare</span>
                  <span>₹{confirmModal.cabType.baseFare}</span>
                </div>
              )}
              <div className="home-confirm-row">
                <span>Package ({numberOfHours}h)</span>
                <span>
                  ₹
                  {confirmModal.cabType.packageRates?.[numberOfHours] != null
                    ? confirmModal.cabType.packageRates[numberOfHours]
                    : '—'}
                </span>
              </div>
              {confirmModal.cabType.extraHourRate != null && (
                <div className="home-confirm-row">
                  <span>Extra hour</span>
                  <span>₹{confirmModal.cabType.extraHourRate}/hr</span>
                </div>
              )}
              <div className="home-confirm-row home-confirm-total">
                <span>Total</span>
                <span>
                  ₹
                  {(Number(confirmModal.cabType.baseFare) || 0) +
                    (confirmModal.cabType.packageRates?.[numberOfHours] != null
                      ? Number(confirmModal.cabType.packageRates[numberOfHours])
                      : 0)}
                </span>
              </div>
            </div>
            <form onSubmit={handleConfirmBooking} className="home-confirm-form">
              <div className="home-confirm-field">
                <label htmlFor="home-confirm-name">Your name</label>
                <input
                  id="home-confirm-name"
                  type="text"
                  value={confirmPassengerName}
                  onChange={(e) => setConfirmPassengerName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className="home-confirm-field">
                <label htmlFor="home-confirm-phone">Phone number</label>
                <input
                  id="home-confirm-phone"
                  type="tel"
                  value={confirmPassengerPhone}
                  onChange={(e) => setConfirmPassengerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              {confirmError && (
                <p className="home-confirm-error">{confirmError}</p>
              )}
              <div className="home-confirm-actions">
                <button
                  type="button"
                  className="home-confirm-cancel"
                  onClick={handleCloseConfirm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="home-confirm-submit"
                  disabled={confirmSubmitting}
                >
                  {confirmSubmitting ? 'Booking…' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {successBookingId && (
        <div
          className="home-success-overlay"
          onClick={() => setSuccessBookingId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="home-success-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="home-success-dismiss"
              onClick={() => setSuccessBookingId(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
            <h3 className="home-success-title">Booking confirmed!</h3>
            <p className="home-success-id">
              Your booking ID is <strong>#{successBookingId}</strong>
            </p>
            <Link
              to="/check-booking"
              className="home-success-link"
              onClick={() => setSuccessBookingId(null)}
            >
              Check booking
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
