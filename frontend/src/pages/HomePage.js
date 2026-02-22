import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { getImageUrl } from '../services/api';
import MainNavbar from '../components/MainNavbar';
import LocationInput from '../components/LocationInput';
import DateTimePicker from '../components/DateTimePicker';
import Icon from '../components/Icon';
import './HomePage.css';

const HOURS_OPTIONS = [4, 8, 12];

const COMMON_ROUTES = [
  'Mysore', 'Salem', 'Coorg', 'Chikmagalur', 'Mangalore', 'Anantapur', 'Hospete', 'Dharwad', 'Shivamogga',
  'Chennai', 'Madurai', 'Coimbatore', 'Krishnagiri', 'Tirupati', 'Hyderabad', 'Hubli', 'Munnar',
  'Vellore', 'Pondicherry', 'Hassan', 'Ooty', 'Chittor', 'Chitradurga', 'Tiruvannamalai', 'Dharmasthala',
];

const TESTIMONIALS = [
  { name: 'Priya S.', role: 'Frequent traveller', text: 'Used Namma Cabs for airport drops multiple times. Always on time, clean cars and no surge pricing. Highly recommend!', rating: 5 },
  { name: 'Rahul M.', role: 'Corporate', text: 'We use them for our team outstation trips. Professional drivers and transparent billing. Best cab service in Bangalore.', rating: 5 },
  { name: 'Anitha K.', role: 'Family trips', text: 'Booked Bangalore to Mysore for a family wedding. Comfortable ride, fair price. Will book again for Coorg.', rating: 5 },
  { name: 'Vikram R.', role: 'Airport transfer', text: 'Early morning KIA pickup was seamless. Driver was waiting with a placard. No hassle at all.', rating: 5 },
  { name: 'Deepa N.', role: 'Local rides', text: 'Hourly packages for city errands work great. Fixed rate, no meter confusion. Simple and reliable.', rating: 5 },
];

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
  const [outstationMultiwayDays, setOutstationMultiwayDays] = useState('');
  const [outstationPickup, setOutstationPickup] = useState(null);
  const [outstationStops, setOutstationStops] = useState([]);
  const [outstationFinalDrop, setOutstationFinalDrop] = useState(null);
  const [localOffers, setLocalOffers] = useState([]);
  const [localOffersLoading, setLocalOffersLoading] = useState(false);
  const [localOffersError, setLocalOffersError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmPassengerName, setConfirmPassengerName] = useState('');
  const [confirmPassengerPhone, setConfirmPassengerPhone] = useState('');
  const [confirmPassengerEmail, setConfirmPassengerEmail] = useState('');
  const [confirmTravelDatetime, setConfirmTravelDatetime] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [successBookingId, setSuccessBookingId] = useState(null);
  const [localLocationError, setLocalLocationError] = useState('');
  const [travelDatetime, setTravelDatetime] = useState('');
  const [outstationReturnDatetime, setOutstationReturnDatetime] = useState('');
  const [outstationNonPickupError, setOutstationNonPickupError] = useState('');

  const fromAddress = fromLocation?.address || '';

  const getCeilDaysDiff = (startIso, endIso) => {
    try {
      if (!startIso || !endIso) return null;
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      const diffMs = end.getTime() - start.getTime();
      if (diffMs <= 0) return null;
      return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    } catch {
      return null;
    }
  };

  // Minimum pickup = now (no dates/times before today/current moment)
  const minPickupDatetime = () => new Date().toISOString().slice(0, 16);

  // Return date cannot be before pickup; when pickup changes, clear return if it becomes invalid
  useEffect(() => {
    if (outstationTripType !== 'round_trip') return;
    if (!travelDatetime || !outstationReturnDatetime) return;
    if (new Date(outstationReturnDatetime) <= new Date(travelDatetime)) setOutstationReturnDatetime('');
  }, [travelDatetime]);

  const isPickupInPast = travelDatetime && new Date(travelDatetime) <= new Date();
  const isReturnBeforePickup = outstationTripType === 'round_trip' && travelDatetime && outstationReturnDatetime && new Date(outstationReturnDatetime) <= new Date(travelDatetime);
  const computedRoundTripDays = outstationTripType === 'round_trip' ? getCeilDaysDiff(travelDatetime, outstationReturnDatetime) : null;
  const selectedRoundTripDays = outstationTripType === 'round_trip' ? Number(outstationRoundTripDays) : null;
  const isRoundTripDaysMismatch = outstationTripType === 'round_trip'
    && computedRoundTripDays != null
    && selectedRoundTripDays != null
    && Number.isFinite(selectedRoundTripDays)
    && selectedRoundTripDays >= 1
    && computedRoundTripDays !== selectedRoundTripDays;

  // Local service is only available within Bangalore; outstation destinations/stops must be outside Bangalore
  const BANGALORE_BOUNDS = { latMin: 12.77, latMax: 13.22, lngMin: 77.38, lngMax: 77.82 };
  const isWithinBangalore = (location) => {
    if (!location) return false;
    if (location.lat != null && location.lng != null) {
      const { latMin, latMax, lngMin, lngMax } = BANGALORE_BOUNDS;
      return location.lat >= latMin && location.lat <= latMax && location.lng >= lngMin && location.lng <= lngMax;
    }
    const addr = (location.address || '').toLowerCase();
    return addr.includes('bangalore') || addr.includes('bengaluru');
  };
  const isOutsideBangalore = (location) => location && !isWithinBangalore(location);

  const handleBackToServices = () => {
    setServiceChoice(null);
    setFromLocation(null);
    setLocalLocationError('');
    setNumberOfHours(null);
    setAirportDirection(null);
    setAirportLocation(null);
    setOutstationTripType('one_way');
    setOutstationFrom(null);
    setOutstationTo(null);
    setOutstationRoundTripDays('');
    setOutstationMultiStops([null, null]);
    setOutstationMultiwayDays('');
    setOutstationPickup(null);
    setOutstationStops([]);
    setOutstationFinalDrop(null);
    setOutstationReturnDatetime('');
    setOutstationNonPickupError('');
    setLocalOffers([]);
    setLocalOffersError('');
    setTravelDatetime('');
  };

  const airportLocationAddress = airportLocation?.address || '';

  const handleContinueToOutstationCabSelection = () => {
    if (isPickupInPast || isReturnBeforePickup) return;
    setOutstationNonPickupError('');
    if (outstationTripType === 'one_way') {
      const fromAddr = outstationFrom?.address || '';
      const toAddr = outstationTo?.address || '';
      if (!fromAddr.trim() || !toAddr.trim()) return;
      if (!isOutsideBangalore(outstationTo)) {
        setOutstationNonPickupError('Destination must be outside Bangalore for outstation trips.');
        return;
      }
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
          travel_datetime: travelDatetime || null,
          return_datetime: null,
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
          travel_datetime: travelDatetime || null,
          return_datetime: outstationReturnDatetime || null,
        },
      });
    } else {
      const pickupAddr = (outstationPickup?.address || '').trim();
      const days = Number(outstationMultiwayDays);
      const finalDropAddr = (outstationFinalDrop?.address || '').trim();
      const stopLocations = outstationStops.filter((s) => s && (s.address || '').trim());
      if (!pickupAddr || !finalDropAddr || !(days >= 1)) return;
      const invalidStop = [...stopLocations, outstationFinalDrop].find((s) => isWithinBangalore(s));
      if (invalidStop) {
        setOutstationNonPickupError('Stops and destination must be outside Bangalore for outstation trips.');
        return;
      }
      const allStops = [outstationPickup, ...stopLocations, outstationFinalDrop];
      const stopAddresses = allStops.map((loc) => (loc?.address || '').trim());
      navigate('/car-options', {
        state: {
          service_type: 'outstation',
          trip_type: 'multiple_stops',
          from_location: stopAddresses[0],
          to_location: stopAddresses[stopAddresses.length - 1],
          stops: stopAddresses,
          stop_points: allStops,
          number_of_days: days,
          travel_datetime: travelDatetime || null,
          return_datetime: null,
        },
      });
    }
  };

  const AIRPORT_DROP_NAME = 'Kempegowda International Airport';
  const KIA_LAT = 13.1989;
  const KIA_LNG = 77.7068;

  const handleContinueToAirportCabSelection = () => {
    if (!airportLocationAddress.trim()) return;
    const isToAirport = (airportDirection || 'to_airport') === 'to_airport';
    const fromAddress = isToAirport ? airportLocationAddress : AIRPORT_DROP_NAME;
    const toAddress = isToAirport ? AIRPORT_DROP_NAME : airportLocationAddress;
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
        travel_datetime: travelDatetime || null,
      },
    });
  };

  const handleContinueToCabSelection = () => {
    if (!fromAddress.trim()) return;
    if (!numberOfHours) return;
    if (!isWithinBangalore(fromLocation)) {
      setLocalLocationError('Local cab service is only available within Bangalore. Please choose a pickup location in Bangalore.');
      return;
    }
    setLocalLocationError('');
    navigate('/car-options', {
      state: {
        service_type: 'local',
        from_location: fromAddress,
        number_of_hours: numberOfHours,
        from_lat: fromLocation?.lat ?? null,
        from_lng: fromLocation?.lng ?? null,
        travel_datetime: travelDatetime || null,
      },
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
    setConfirmTravelDatetime('');
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
        passenger_email: (confirmPassengerEmail || '').trim() || undefined,
        fare_amount: fareAmount,
        number_of_hours: numberOfHours,
        // Do not pre-assign a cab/driver from the customer flow; admin will assign.
        cab_id: null,
        cab_type_id: confirmModal.cabType.id,
        pickup_lat: fromLocation?.lat ?? null,
        pickup_lng: fromLocation?.lng ?? null,
        travel_date: confirmTravelDatetime || null,
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
                  <Icon name="car" size={28} className="home-service-icon" />
                  <span className="home-service-label">Local</span>
                  <span className="home-service-desc">Hourly packages</span>
                </button>
                <button
                  type="button"
                  className="home-service-option"
                  onClick={() => setServiceChoice('airport')}
                >
                  <Icon name="plane" size={28} className="home-service-icon" />
                  <span className="home-service-label">Airport</span>
                  <span className="home-service-desc">Pickup & drop</span>
                </button>
                <button
                  type="button"
                  className="home-service-option"
                  onClick={() => setServiceChoice('outstation')}
                >
                  <Icon name="road" size={28} className="home-service-icon" />
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
                  <Icon name="arrowBack" size={18} className="home-back-link-icon" /> Back to services
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
                    {(airportDirection || 'to_airport') === 'to_airport' ? 'Pickup location' : 'Pickup (airport)'}
                  </label>
                  <LocationInput
                    placeholder={(airportDirection || 'to_airport') === 'to_airport' ? 'Enter your pickup address' : 'Enter your drop address'}
                    value={airportLocation}
                    onSelect={setAirportLocation}
                    label={(airportDirection || 'to_airport') === 'to_airport' ? 'From' : 'To'}
                  />
                </div>
                {(airportDirection || 'to_airport') === 'to_airport' && (
                  <div className="home-form-group">
                    <label className="home-form-label">Drop location</label>
                    <div className="home-airport-drop-display">
                      <span className="home-airport-drop-name">{AIRPORT_DROP_NAME}</span>
                      <p className="home-airport-destination-hint">Distance & fare will be calculated automatically</p>
                    </div>
                  </div>
                )}
                <div className="home-form-group">
                  <label className="home-form-label">Date and time</label>
                  <DateTimePicker
                    value={travelDatetime}
                    onChange={setTravelDatetime}
                    placeholder="Select pickup date and time"
                    min={minPickupDatetime()}
                    className="home-flow-datetime-picker"
                  />
                  {isPickupInPast && (
                    <p className="home-form-error" role="alert">Pickup date and time must be in the future.</p>
                  )}
                </div>
                <button
                  type="button"
                  className="home-continue-btn"
                  disabled={!airportLocationAddress.trim() || isPickupInPast}
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
                  <Icon name="arrowBack" size={18} className="home-back-link-icon" /> Back to services
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
                    onChange={(e) => {
                      const next = e.target.value;
                      setOutstationTripType(next);
                      setOutstationNonPickupError('');
                      if (next !== 'round_trip') setOutstationReturnDatetime('');
                      if (next !== 'multiple_stops') {
                        setOutstationMultiwayDays('');
                        setOutstationPickup(null);
                        setOutstationStops([]);
                        setOutstationFinalDrop(null);
                      }
                    }}
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
                        placeholder="Enter drop location (outside Bangalore)"
                        value={outstationTo}
                        onSelect={(loc) => {
                          if (isWithinBangalore(loc)) {
                            setOutstationTo(null);
                            setOutstationNonPickupError('Destination must be outside Bangalore for outstation trips.');
                          } else {
                            setOutstationTo(loc);
                            setOutstationNonPickupError('');
                          }
                        }}
                        label="To"
                      />
                      {outstationNonPickupError && (
                        <p className="home-form-error" role="alert">{outstationNonPickupError}</p>
                      )}
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
                      <label className="home-form-label">Pickup location</label>
                      <LocationInput
                        placeholder="Enter pickup location"
                        value={outstationPickup}
                        onSelect={setOutstationPickup}
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
                        value={outstationMultiwayDays}
                        onChange={(e) => setOutstationMultiwayDays(e.target.value)}
                      />
                    </div>
                    {outstationNonPickupError && (
                      <p className="home-form-error" role="alert">{outstationNonPickupError}</p>
                    )}
                    {outstationStops.map((stop, idx) => (
                      <div key={idx} className="home-form-group">
                        <div className="home-stop-row-head">
                          <label className="home-form-label">Stop {idx + 1} (optional)</label>
                          <button
                            type="button"
                            className="home-remove-stop-btn"
                            onClick={() => setOutstationStops((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                        <LocationInput
                          placeholder="Enter stop (outside Bangalore)"
                          value={stop || null}
                          onSelect={(loc) => {
                            if (isWithinBangalore(loc)) {
                              setOutstationStops((prev) => {
                                const n = [...prev];
                                n[idx] = null;
                                return n;
                              });
                              setOutstationNonPickupError('Stops and destination must be outside Bangalore for outstation trips.');
                            } else {
                              setOutstationStops((prev) => {
                                const n = [...prev];
                                n[idx] = loc;
                                return n;
                              });
                              setOutstationNonPickupError('');
                            }
                          }}
                          label={`Stop ${idx + 1}`}
                        />
                      </div>
                    ))}
                    <div className="home-form-group home-add-stop-wrap">
                      <button
                        type="button"
                        className="home-add-stop-btn"
                        onClick={() => setOutstationStops((prev) => [...prev, null])}
                      >
                        + Add stop
                      </button>
                    </div>
                    <div className="home-form-group">
                      <label className="home-form-label">Final drop point</label>
                      <LocationInput
                        placeholder="Enter final destination (outside Bangalore)"
                        value={outstationFinalDrop}
                        onSelect={(loc) => {
                          if (isWithinBangalore(loc)) {
                            setOutstationFinalDrop(null);
                            setOutstationNonPickupError('Stops and destination must be outside Bangalore for outstation trips.');
                          } else {
                            setOutstationFinalDrop(loc);
                            setOutstationNonPickupError('');
                          }
                        }}
                        label="Final drop"
                      />
                    </div>
                  </>
                )}

                <div className="home-form-group">
                  <label className="home-form-label">Date and time</label>
                  <DateTimePicker
                    value={travelDatetime}
                    onChange={setTravelDatetime}
                    placeholder="Select pickup date and time"
                    min={minPickupDatetime()}
                    className="home-flow-datetime-picker"
                  />
                  {isPickupInPast && (
                    <p className="home-form-error" role="alert">Pickup date and time must be in the future.</p>
                  )}
                </div>
                {outstationTripType === 'round_trip' && (
                  <div className="home-form-group">
                    <label className="home-form-label">Return date (optional)</label>
                    <DateTimePicker
                      value={outstationReturnDatetime}
                      onChange={setOutstationReturnDatetime}
                      placeholder="Select return date and time"
                      min={travelDatetime || minPickupDatetime()}
                      className="home-flow-datetime-picker"
                    />
                    {isReturnBeforePickup && (
                      <p className="home-form-error" role="alert">Return date must be after pickup date.</p>
                    )}
                    {isRoundTripDaysMismatch && (
                      <p className="home-form-error" role="alert">
                        Number of days ({selectedRoundTripDays}) does not match pickup/return dates ({computedRoundTripDays} day(s)). Please correct it.
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="home-continue-btn"
                  disabled={
                    outstationTripType === 'one_way'
                      ? !(outstationFrom?.address || '').trim() || !(outstationTo?.address || '').trim() || isPickupInPast
                      : outstationTripType === 'round_trip'
                        ? !(outstationFrom?.address || '').trim() || !(Number(outstationRoundTripDays) >= 1) || isPickupInPast || isReturnBeforePickup || isRoundTripDaysMismatch
                        : !(outstationPickup?.address || '').trim() || !(outstationFinalDrop?.address || '').trim() || !(Number(outstationMultiwayDays) >= 1) || isPickupInPast
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
                  <Icon name="arrowBack" size={18} className="home-back-link-icon" /> Back to services
                </button>
                <h2 className="home-flow-title">Local cab</h2>
                <p className="home-flow-desc">
                  Enter pickup location and choose your package hours.
                </p>
              </div>

              <div className="home-local-form">
                  <div className="home-form-group">
                    <label className="home-form-label">Pickup location</label>
                    <LocationInput
                      placeholder="Enter pickup address"
                      value={fromLocation}
                      onSelect={(loc) => {
                        setFromLocation(loc);
                        setLocalLocationError('');
                      }}
                      label="From"
                    />
                    {localLocationError && (
                      <p className="home-form-error" role="alert">{localLocationError}</p>
                    )}
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
                  <div className="home-form-group">
                    <label className="home-form-label">Date and time</label>
                    <DateTimePicker
                      value={travelDatetime}
                      onChange={setTravelDatetime}
                      placeholder="Select pickup date and time"
                      min={minPickupDatetime()}
                      className="home-flow-datetime-picker"
                    />
                    {isPickupInPast && (
                      <p className="home-form-error" role="alert">Pickup date and time must be in the future.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="home-continue-btn"
                    disabled={!fromAddress.trim() || !numberOfHours || isPickupInPast}
                    onClick={handleContinueToCabSelection}
                  >
                    Continue
                  </button>
                </div>
            </>
          )}
        </div>
      </section>

      {serviceChoice === null && (
        <>
          <section className="home-about-section">
            <div className="home-about-accent" aria-hidden="true" />
            <div className="home-about-inner">
              <h2 className="home-about-title">About Namma Cabs</h2>
              <p className="home-about-subtitle">
                Your trusted airport, local, outstation & corporate cab partner in Bangalore
              </p>
              <p className="home-about-summary">
                <strong>Namma Cabs</strong> was born in Bangalore with one simple idea:
                give people clean, reliable cars with honest pricing and zero drama.
                From early morning airport drops to last–minute outstation plans,
                we&apos;ve been moving families, executives and travellers across Karnataka
                for years.
              </p>
              <p className="home-about-summary">
                We focus on the details that matter – well–maintained cars, verified
                drivers, transparent fares and real human support on the phone when you
                need it. No hidden surge, no confusing add–ons, just clear point–to–point
                service.
              </p>
              <Link to="/about" className="home-about-link">Read more about us <Icon name="arrowForward" size={16} className="home-about-link-arrow" /></Link>
            </div>
          </section>

          <section className="home-routes-section">
            <div className="home-routes-accent" aria-hidden="true" />
            <div className="home-routes-inner">
              <h2 className="home-routes-title">Common Routes</h2>
              <p className="home-routes-desc">Popular destinations we serve.</p>
              <div className="home-routes-grid">
                <div className="home-route-card home-route-airport">
                  <Icon name="plane" size={28} className="home-route-icon" />
                  <span className="home-route-label">Bangalore Airport ↔ City</span>
                  <span className="home-route-hint">Pickup or drop at KIA</span>
                </div>
                {COMMON_ROUTES.map((dest) => (
                  <div key={dest} className="home-route-card">
                    <Icon name="road" size={28} className="home-route-icon" />
                    <span className="home-route-label">Bangalore To {dest} Cabs</span>
                    <span className="home-route-hint">One-way or round trip</span>
                  </div>
                ))}
              </div>
              <h3 className="home-routes-pages-title">Our pages</h3>
              <p className="home-routes-pages-desc">Quick links to book, check status, and learn more.</p>
              <div className="home-routes-links">
                <Link to="/" className="home-routes-link">Home</Link>
                <Link to="/car-options" className="home-routes-link">Car options</Link>
                <Link to="/check-booking" className="home-routes-link">Check booking</Link>
                <Link to="/about" className="home-routes-link">About</Link>
                <Link to="/contact" className="home-routes-link">Contact</Link>
                <Link to="/corporate" className="home-routes-link">Corporate</Link>
                <Link to="/events" className="home-routes-link">Events</Link>
                <Link to="/privacy-policy" className="home-routes-link">Privacy policy</Link>
                <Link to="/terms-of-service" className="home-routes-link">Terms of service</Link>
                <Link to="/login" className="home-routes-link">Login</Link>
                <Link to="/account" className="home-routes-link">Account</Link>
              </div>
            </div>
          </section>

          <section className="home-testimonials-section">
            <div className="home-testimonials-inner">
              <h2 className="home-testimonials-title">What our customers say</h2>
              <p className="home-testimonials-desc">Trusted by travellers and corporates across Bangalore and beyond</p>
              <div className="home-testimonials-track-wrap">
                <div className="home-testimonials-track">
                  {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                    <div key={i} className="home-testimonial-card">
                      <div className="home-testimonial-stars" aria-hidden="true">
                        {Array.from({ length: t.rating }, (_, j) => <span key={j} className="home-testimonial-star">★</span>)}
                      </div>
                      <p className="home-testimonial-text">&ldquo;{t.text}&rdquo;</p>
                      <p className="home-testimonial-meta"><strong>{t.name}</strong> · {t.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
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
              <div className="home-confirm-field">
                <label htmlFor="home-confirm-email">Email</label>
                <input
                  id="home-confirm-email"
                  type="email"
                  value={confirmPassengerEmail}
                  onChange={(e) => setConfirmPassengerEmail(e.target.value)}
                  placeholder="Enter email for confirmation and updates"
                />
              </div>
              <div className="home-confirm-field">
                <label>Date and time</label>
                <DateTimePicker
                  value={confirmTravelDatetime}
                  onChange={setConfirmTravelDatetime}
                  placeholder="Select pickup date and time"
                  min={minPickupDatetime()}
                  className="home-datetime-picker"
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
