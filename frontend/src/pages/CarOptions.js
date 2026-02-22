import React, { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import api, { getImageUrl } from '../services/api';
import MainNavbar from '../components/MainNavbar';
import Icon from '../components/Icon';
import DateTimePicker from '../components/DateTimePicker';
import AnimatedMapBackground from '../components/AnimatedMapBackground';
import { getMultiLegDistance } from '../utils/distanceService';
import { getSeatLabel } from '../utils/seating';
import './CarOptions.css';

const CarOptions = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingState = location.state || {};
  const isLocalFlow = bookingState.service_type === 'local' && bookingState.number_of_hours;
  const isAirportFlow = bookingState.service_type === 'airport' && bookingState.from_location;
  const isOutstationFlow = bookingState.service_type === 'outstation' && bookingState.from_location;

  const [options, setOptions] = useState([]);
  const [localOffers, setLocalOffers] = useState([]);
  const [airportOffers, setAirportOffers] = useState([]);
  const [airportFares, setAirportFares] = useState({});
  const [airportDistanceKm, setAirportDistanceKm] = useState(null);
  const [outstationOffers, setOutstationOffers] = useState([]);
  const [outstationFares, setOutstationFares] = useState({});
  const [outstationDistanceKm, setOutstationDistanceKm] = useState(null);
  const [outstationEstimateMetaByCabType, setOutstationEstimateMetaByCabType] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmPassengerName, setConfirmPassengerName] = useState('');
  const [confirmPassengerPhone, setConfirmPassengerPhone] = useState('');
  const [confirmPassengerEmail, setConfirmPassengerEmail] = useState('');
  const [confirmTravelDatetime, setConfirmTravelDatetime] = useState('');
  const [confirmCrystaSeater, setConfirmCrystaSeater] = useState('7+1');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [reconfirmData, setReconfirmData] = useState(null);
  const [successBookingId, setSuccessBookingId] = useState(null);

  const ceilDaysDiff = (startIso, endIso) => {
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
          setAirportDistanceKm(
            estimateRes.data?.distance_km != null && estimateRes.data?.distance_km !== ''
              ? Number(estimateRes.data.distance_km)
              : null
          );
          // Helpful for debugging distance mismatches vs Google Maps
          if (estimateRes.data?.distance_source) {
            // eslint-disable-next-line no-console
            console.log('[airport] distance_source:', estimateRes.data.distance_source);
          }
          setLocalOffers([]);
          setOutstationOffers([]);
          setOptions([]);
        } else if (isOutstationFlow) {
          setAirportDistanceKm(null);
          const tripType = bookingState.trip_type || 'one_way';
          const estimateParams = { trip_type: tripType };
          let computedMultiStopDistanceKm = null;
          if (tripType === 'one_way' && bookingState.from_lat != null && bookingState.from_lng != null && bookingState.to_lat != null && bookingState.to_lng != null) {
            estimateParams.from_lat = bookingState.from_lat;
            estimateParams.from_lng = bookingState.from_lng;
            estimateParams.to_lat = bookingState.to_lat;
            estimateParams.to_lng = bookingState.to_lng;
          } else if (tripType === 'round_trip' && bookingState.number_of_days) {
            estimateParams.number_of_days = bookingState.number_of_days;
          } else if (tripType === 'multiple_stops') {
            if (bookingState.number_of_days) estimateParams.number_of_days = bookingState.number_of_days;
            const pts = Array.isArray(bookingState.stop_points) ? bookingState.stop_points : [];
            const hasPts = pts.length >= 2 && pts.every((p) => p && p.lat != null && p.lng != null);
            if (hasPts) {
              try {
                const dist = await getMultiLegDistance(pts);
                computedMultiStopDistanceKm = dist?.distance_km ?? null;
                if (computedMultiStopDistanceKm != null) {
                  estimateParams.distance_km = computedMultiStopDistanceKm;
                }
              } catch (e) {
                // Distance calc is best-effort; backend will still apply min km/day on 0km if needed.
                computedMultiStopDistanceKm = null;
              }
            }
          }
          const [offersRes, estimateRes] = await Promise.all([
            api.get('/cabs/outstation-offers'),
            api.get('/cabs/outstation-fare-estimate', { params: estimateParams }),
          ]);
          setOutstationOffers(offersRes.data || []);
          const fareMap = {};
          const metaMap = {};
          (estimateRes.data?.fares || []).forEach((f) => {
            fareMap[f.cab_type_id] = f.fare_amount;
            metaMap[f.cab_type_id] = {
              distance_km: f.distance_km,
              min_km: f.min_km,
              chargeable_km: f.chargeable_km,
              included_km: f.included_km,
              total_km: f.total_km,
              extra_km: f.extra_km,
            };
          });
          setOutstationFares(fareMap);
          setOutstationEstimateMetaByCabType(metaMap);
          setOutstationDistanceKm(
            tripType === 'multiple_stops'
              ? (estimateRes.data?.chargeable_km != null ? Number(estimateRes.data.chargeable_km) : computedMultiStopDistanceKm)
              : null
          );
          setLocalOffers([]);
          setAirportOffers([]);
          setOptions([]);
        } else {
          setAirportDistanceKm(null);
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
  }, [isLocalFlow, isAirportFlow, isOutstationFlow, bookingState.from_lat, bookingState.from_lng, bookingState.to_lat, bookingState.to_lng, bookingState.trip_type, bookingState.number_of_days, bookingState.stop_points]);

  const selectedHours = bookingState.number_of_hours ? Number(bookingState.number_of_hours) : null;
  const fromLocation = bookingState.from_location || '';
  const localIncludedKm = selectedHours === 4 ? 40 : selectedHours === 8 ? 80 : selectedHours === 12 ? 120 : null;
  const handleBackToBooking = () => {
    try {
      // Best-effort: if user lands on /car-options directly, keep minimal info for restoring on HomePage.
      const existing = sessionStorage.getItem('nm_booking_draft_v1');
      if (!existing) {
        const serviceType = bookingState.service_type;
        const travelDatetime = bookingState.travel_datetime || '';
        const draft = { serviceChoice: serviceType, travelDatetime };
        if (serviceType === 'local') {
          draft.fromLocation = bookingState.from_location ? { address: bookingState.from_location, lat: bookingState.from_lat, lng: bookingState.from_lng } : null;
          draft.numberOfHours = bookingState.number_of_hours ?? null;
        } else if (serviceType === 'airport') {
          draft.airportDirection = bookingState.airport_direction ?? null;
          const addr = bookingState.airport_direction === 'from_airport' ? bookingState.to_location : bookingState.from_location;
          const lat = bookingState.airport_direction === 'from_airport' ? bookingState.to_lat : bookingState.from_lat;
          const lng = bookingState.airport_direction === 'from_airport' ? bookingState.to_lng : bookingState.from_lng;
          draft.airportLocation = addr ? { address: addr, lat, lng } : null;
        } else if (serviceType === 'outstation') {
          draft.outstationTripType = bookingState.trip_type || 'one_way';
          draft.outstationFrom = bookingState.from_location ? { address: bookingState.from_location, lat: bookingState.from_lat, lng: bookingState.from_lng } : null;
          draft.outstationTo = bookingState.to_location ? { address: bookingState.to_location, lat: bookingState.to_lat, lng: bookingState.to_lng } : null;
          draft.outstationRoundTripDays = bookingState.number_of_days ?? '';
          draft.outstationMultiwayDays = bookingState.number_of_days ?? '';
          draft.outstationReturnDatetime = bookingState.return_datetime || '';
          if (Array.isArray(bookingState.stop_points)) {
            draft.outstationPickup = bookingState.stop_points[0] ?? null;
            draft.outstationFinalDrop = bookingState.stop_points[bookingState.stop_points.length - 1] ?? null;
            draft.outstationStops = bookingState.stop_points.slice(1, -1);
          }
        }
        sessionStorage.setItem('nm_booking_draft_v1', JSON.stringify(draft));
      }
    } catch {
      // ignore storage failures
    }
    navigate('/', { state: { restoreDraft: true } });
  };

  const renderUnifiedCabCard = (cab, ct, opts) => {
    const {
      displayFare,
      serviceLabel,
      includedKm,
      includedKmLabel,
      totalDistanceKm,
      totalDistanceLabel,
      billableDistanceKm,
      billableDistanceLabel,
      extraPerKm,
      extraPerHour,
      driverCharges,
      nightCharges,
      nightChargesLabel,
      extraNotes,
    } = opts;
    const imageUrl = (cab?.image_url ? getImageUrl(cab.image_url) : null) || (ct.image_url ? getImageUrl(ct.image_url) : null) || (ct.cabs?.[0]?.image_url ? getImageUrl(ct.cabs[0].image_url) : null);
    const gstText = ct.gstIncluded === true ? 'Includes GST' : ct.gstIncluded === false ? 'Excludes GST' : 'Includes GST';
    const driverText = driverCharges == null || Number(driverCharges) === 0 ? 'Included' : `₹${driverCharges}`;
    const nightText = nightCharges == null || Number(nightCharges) === 0 ? 'Included' : `₹${nightCharges}`;
    const extraKmText = extraPerKm != null && Number(extraPerKm) >= 0 ? `₹${extraPerKm}/KM` : '—';
    const extraHourText = extraPerHour != null && Number(extraPerHour) >= 0 ? `₹${extraPerHour}/Hr` : '—';
    const formatKm = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    const includedKmNum = includedKm != null && includedKm !== '' ? Number(includedKm) : null;
    const includedKmText =
      includedKmNum != null && Number.isFinite(includedKmNum)
        ? `${formatKm(includedKmNum)} KM`
        : (includedKm != null && includedKm !== '' ? `${includedKm} KM` : '—');
    const totalDistanceNum = totalDistanceKm != null && totalDistanceKm !== '' ? Number(totalDistanceKm) : null;
    const totalDistanceText =
      totalDistanceNum != null && Number.isFinite(totalDistanceNum)
        ? `${formatKm(totalDistanceNum)} KM`
        : (totalDistanceKm != null && totalDistanceKm !== '' ? `${totalDistanceKm} KM` : '—');
    const billableDistanceNum = billableDistanceKm != null && billableDistanceKm !== '' ? Number(billableDistanceKm) : null;
    const billableDistanceText =
      billableDistanceNum != null && Number.isFinite(billableDistanceNum)
        ? `${formatKm(billableDistanceNum)} KM`
        : (billableDistanceKm != null && billableDistanceKm !== '' ? `${billableDistanceKm} KM` : '—');

    return (
      <div key={cab?.id ?? ct.id} className="unified-cab-card">
        <div className="unified-cab-card-image-wrap">
          {imageUrl ? (
            <img src={imageUrl} alt={ct.name} className="unified-cab-card-image" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="unified-cab-card-image-placeholder"><Icon name="car" size={48} /></div>
          )}
        </div>
        <div className="unified-cab-card-fare">
          <span className="unified-cab-card-fare-amount">₹{displayFare != null ? displayFare : '—'}/-</span>
          <p className="unified-cab-card-gst">{gstText}</p>
          <p className="unified-cab-card-service-label">{ct.name}</p>
        </div>
        <div className="unified-cab-card-breakdown">
          <div className="unified-cab-card-breakdown-row">
            <span className="unified-cab-card-breakdown-label">{includedKmLabel || 'Included Km'}</span>
            <span className="unified-cab-card-breakdown-value">{includedKmText}</span>
          </div>
          {totalDistanceKm != null && (
            <div className="unified-cab-card-breakdown-row">
              <span className="unified-cab-card-breakdown-label">{totalDistanceLabel || 'Total distance'}</span>
              <span className="unified-cab-card-breakdown-value">{totalDistanceText}</span>
            </div>
          )}
          {billableDistanceKm != null && (
            <div className="unified-cab-card-breakdown-row">
              <span className="unified-cab-card-breakdown-label">{billableDistanceLabel || 'Billable distance'}</span>
              <span className="unified-cab-card-breakdown-value">{billableDistanceText}</span>
            </div>
          )}
          <div className="unified-cab-card-breakdown-row">
            <span className="unified-cab-card-breakdown-label">Extra fare/Km</span>
            <span className="unified-cab-card-breakdown-value">{extraKmText}</span>
          </div>
          {extraPerHour != null && (
            <div className="unified-cab-card-breakdown-row">
              <span className="unified-cab-card-breakdown-label">Extra fare/Hr</span>
              <span className="unified-cab-card-breakdown-value">{extraHourText}</span>
            </div>
          )}
          <div className="unified-cab-card-breakdown-row">
            <span className="unified-cab-card-breakdown-label">Driver Charges</span>
            <span className="unified-cab-card-breakdown-value">{driverText}</span>
          </div>
          <div className="unified-cab-card-breakdown-row">
            <span className="unified-cab-card-breakdown-label">{nightChargesLabel || 'Night Charges'}</span>
            <span className="unified-cab-card-breakdown-value">{nightText}</span>
          </div>
        </div>
        <div className="unified-cab-card-terms-block">
          <Link
            to="/terms-of-service"
            state={{ from: location.pathname, fromState: bookingState }}
            className="unified-cab-card-link"
          >
            Terms &amp; Conditions
          </Link>
          <span className="unified-cab-card-link-sep">|</span>
          <a href="/fare-details" className="unified-cab-card-link">Fare Details</a>
        </div>
        {(Array.isArray(extraNotes) && extraNotes.length > 0 ? extraNotes : ['Toll & State Tax Extra', 'Parking Extra, if Applicable']).map((line, i) => (
          <p key={i} className="unified-cab-card-extra">{line}</p>
        ))}
        <button type="button" className="unified-cab-card-book-btn" onClick={() => handleBookNow(cab, ct)}>
          Book Now
        </button>
      </div>
    );
  };

  const handleBookNow = (cab, cabType) => {
    setConfirmError('');
    setConfirmPassengerName('');
    setConfirmPassengerPhone('');
    setConfirmTravelDatetime(bookingState.travel_datetime || '');
    setConfirmCrystaSeater('7+1');
    setConfirmModal({ cab, cabType });
  };

  const handleCloseConfirm = () => {
    setConfirmModal(null);
    setReconfirmData(null);
    setConfirmError('');
    setConfirmTravelDatetime('');
    setConfirmCrystaSeater('7+1');
  };

  const handleConfirmBooking = (e) => {
    e.preventDefault();
    if (!confirmModal?.cab || !confirmModal?.cabType) return;
    const name = (confirmPassengerName || '').trim();
    const phone = (confirmPassengerPhone || '').trim();
    if (!name || !phone) {
      setConfirmError('Please enter your name and phone number.');
      return;
    }
    setConfirmError('');
    let fareAmount = 0;
    const summaryLines = [];
    if (isAirportFlow) {
      fareAmount = airportFares[confirmModal.cabType.id] ?? (confirmModal.cabType.baseFare || 0);
      summaryLines.push({ label: 'From', value: bookingState.from_location || '—' });
      summaryLines.push({ label: 'To', value: bookingState.to_location || '—' });
      if (airportDistanceKm != null && Number.isFinite(Number(airportDistanceKm))) {
        summaryLines.push({ label: 'Distance', value: `${Number(airportDistanceKm).toFixed(1)} km` });
      }
    } else if (isOutstationFlow) {
      fareAmount = outstationFares[confirmModal.cabType.id] ?? 0;
      summaryLines.push({ label: 'From', value: bookingState.from_location || '—' });
      summaryLines.push({ label: 'To', value: bookingState.to_location || '—' });
      if (bookingState.trip_type === 'round_trip') {
        summaryLines.push({ label: 'Days', value: String(bookingState.number_of_days || '—') });
      }
      if (bookingState.trip_type === 'multiple_stops') {
        summaryLines.push({ label: 'Days', value: String(bookingState.number_of_days || '—') });
        if (outstationDistanceKm != null) summaryLines.push({ label: 'Distance', value: `${outstationDistanceKm} km` });
      }
      if (bookingState.trip_type === 'one_way') {
        const meta = outstationEstimateMetaByCabType?.[confirmModal.cabType.id] || {};
        const actualKm = meta.distance_km != null ? Number(meta.distance_km) : null;
        const billKm = meta.chargeable_km != null ? Number(meta.chargeable_km) : null;
        if (actualKm != null && Number.isFinite(actualKm)) {
          summaryLines.push({ label: 'Distance (actual)', value: `${actualKm.toFixed(1)} km` });
        }
        if (billKm != null && Number.isFinite(billKm)) {
          if (actualKm != null && Number.isFinite(actualKm) && actualKm !== billKm) {
            summaryLines.push({ label: 'Distance (billable min applied)', value: `${billKm.toFixed(1)} km` });
          } else if (actualKm == null) {
            summaryLines.push({ label: 'Distance', value: `${billKm.toFixed(1)} km` });
          }
        }
      }
      if (bookingState.trip_type === 'round_trip' && bookingState.return_datetime) {
        try {
          const rd = new Date(bookingState.return_datetime);
          summaryLines.push({ label: 'Return date', value: rd.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) });
        } catch (_) {
          summaryLines.push({ label: 'Return date', value: bookingState.return_datetime });
        }
      }
    } else {
      const baseFare = Number(confirmModal.cabType.baseFare) || 0;
      const packageRate = confirmModal.cabType.packageRates?.[selectedHours] != null
        ? Number(confirmModal.cabType.packageRates[selectedHours])
        : 0;
      fareAmount = baseFare + packageRate;
      summaryLines.push({ label: 'From', value: fromLocation || '—' });
      summaryLines.push({ label: 'Package', value: `${selectedHours}h` });
    }
    const isCrystaSelected = /crysta/i.test(confirmModal.cabType.name || '');
    summaryLines.push({ label: 'Cab type', value: confirmModal.cabType.name });
    if (isCrystaSelected) {
      summaryLines.push({ label: 'Seater', value: confirmCrystaSeater });
    }
    const seatLabel = getSeatLabel({
      cabTypeName: confirmModal.cabType.name,
      seatingCapacity: confirmModal.cabType.seatingCapacity,
      crystaSeater: confirmCrystaSeater,
    });
    summaryLines.push({ label: 'Vehicle', value: seatLabel || '—' });
    summaryLines.push({ label: 'Name', value: name });
    summaryLines.push({ label: 'Phone', value: phone });
    if (confirmTravelDatetime) {
      try {
        const d = new Date(confirmTravelDatetime);
        summaryLines.push({ label: 'Date & time', value: d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) });
      } catch (_) {
        summaryLines.push({ label: 'Date & time', value: confirmTravelDatetime });
      }
    }
    summaryLines.push({ label: 'Total', value: `₹${fareAmount}`, isTotal: true });
    setReconfirmData({
      cab: confirmModal.cab,
      cabType: confirmModal.cabType,
      passengerName: name,
      passengerPhone: phone,
      passengerEmail: (confirmPassengerEmail || '').trim() || undefined,
      travelDatetime: confirmTravelDatetime,
      crystaSeater: isCrystaSelected ? confirmCrystaSeater : null,
      fareAmount,
      summaryLines,
    });
  };

  const handleReconfirmEdit = () => {
    setReconfirmData(null);
  };

  const handleReconfirmSubmit = async () => {
    if (!reconfirmData) return;
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      const { cab, cabType, passengerName, passengerPhone, passengerEmail, fareAmount, travelDatetime, crystaSeater } = reconfirmData;
      const isCrystaSelected = /crysta/i.test(cabType?.name || '');
      const notes = (isCrystaSelected && crystaSeater) ? `Crysta seater: ${crystaSeater}` : undefined;
      if (isAirportFlow) {
        const payload = {
          service_type: 'airport',
          from_location: bookingState.from_location,
          to_location: bookingState.to_location,
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
          passenger_email: passengerEmail,
          fare_amount: fareAmount,
          // Do not pre-assign a cab/driver from the customer flow; admin will assign.
          cab_id: null,
          cab_type_id: cabType.id,
          travel_date: travelDatetime || null,
          notes,
        };
        if (bookingState.from_lat != null && bookingState.from_lng != null) {
          payload.pickup_lat = bookingState.from_lat;
          payload.pickup_lng = bookingState.from_lng;
        }
        if (bookingState.to_lat != null && bookingState.to_lng != null) {
          payload.destination_lat = bookingState.to_lat;
          payload.destination_lng = bookingState.to_lng;
        }
        const res = await api.post('/bookings', payload);
        setSuccessBookingId(res.data?.id);
        setConfirmModal(null);
        setReconfirmData(null);
      } else if (isOutstationFlow) {
        if ((bookingState.trip_type === 'round_trip' || bookingState.trip_type === 'multiple_stops') && (bookingState.number_of_days == null || bookingState.number_of_days === '')) {
          setConfirmError('Number of days is missing. Please go back and re-enter booking details.');
          return;
        }
        if (bookingState.trip_type === 'round_trip' && bookingState.return_datetime) {
          const computedDays = ceilDaysDiff(travelDatetime, bookingState.return_datetime);
          const selectedDays = bookingState.number_of_days != null ? Number(bookingState.number_of_days) : null;
          if (computedDays != null && Number.isFinite(selectedDays) && selectedDays >= 1 && computedDays !== selectedDays) {
            setConfirmError(`Number of days (${selectedDays}) does not match pickup/return dates (${computedDays} day(s)). Please fix it.`);
            return;
          }
        }
        const payload = {
          service_type: 'outstation',
          trip_type: bookingState.trip_type || 'one_way',
          from_location: bookingState.from_location,
          to_location: bookingState.to_location,
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
          passenger_email: passengerEmail,
          fare_amount: fareAmount,
          // Do not pre-assign a cab/driver from the customer flow; admin will assign.
          cab_id: null,
          cab_type_id: cabType.id,
          travel_date: travelDatetime || null,
          return_date: bookingState.trip_type === 'round_trip' ? (bookingState.return_datetime || null) : null,
          notes,
        };
        if (bookingState.number_of_days != null) payload.number_of_days = bookingState.number_of_days;
        if (bookingState.trip_type === 'one_way') {
          const meta = outstationEstimateMetaByCabType?.[cabType.id] || {};
          const billKm = meta.chargeable_km != null ? Number(meta.chargeable_km) : (meta.distance_km != null ? Number(meta.distance_km) : null);
          if (billKm != null && Number.isFinite(billKm)) payload.distance_km = billKm;
        } else if (outstationDistanceKm != null) {
          payload.distance_km = outstationDistanceKm;
        }
        if (bookingState.from_lat != null && bookingState.from_lng != null) {
          payload.pickup_lat = bookingState.from_lat;
          payload.pickup_lng = bookingState.from_lng;
        }
        if (bookingState.to_lat != null && bookingState.to_lng != null) {
          payload.destination_lat = bookingState.to_lat;
          payload.destination_lng = bookingState.to_lng;
        }
        const res = await api.post('/bookings', payload);
        setSuccessBookingId(res.data?.id);
        setConfirmModal(null);
        setReconfirmData(null);
      } else {
        const res = await api.post('/bookings', {
          service_type: 'local',
          from_location: fromLocation,
          to_location: 'Local package',
          passenger_name: passengerName,
          passenger_phone: passengerPhone,
          passenger_email: passengerEmail,
          fare_amount: fareAmount,
          number_of_hours: selectedHours,
          // Do not pre-assign a cab/driver from the customer flow; admin will assign.
          cab_id: null,
          cab_type_id: cabType.id,
          pickup_lat: bookingState.from_lat ?? null,
          pickup_lng: bookingState.from_lng ?? null,
          travel_date: travelDatetime || null,
          notes,
        });
        setSuccessBookingId(res.data?.id);
        setConfirmModal(null);
        setReconfirmData(null);
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
            {(isLocalFlow || isAirportFlow || isOutstationFlow) && (
              <div className="car-options-header-row">
                <button type="button" className="car-options-back-btn" onClick={handleBackToBooking}>
                  <Icon name="arrowBack" size={18} /> Back
                </button>
              </div>
            )}
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
                <span className="car-options-badge">Airport transfer</span>
                <span>{bookingState.airport_direction === 'to_airport' ? 'To airport' : 'From airport'}: {bookingState.from_location} → {bookingState.to_location}</span>
                {airportDistanceKm != null && Number.isFinite(Number(airportDistanceKm)) && (
                  <span>Distance: {Number(airportDistanceKm).toFixed(1)} km</span>
                )}
              </div>
            )}
            {isOutstationFlow && bookingState.from_location && (
              <div className="car-options-booking-summary">
                <span className="car-options-badge">Outstation</span>
                <span>
                  {bookingState.trip_type === 'one_way' && `${bookingState.from_location} → ${bookingState.to_location}`}
                  {bookingState.trip_type === 'round_trip' && `Round trip from ${bookingState.from_location} (${bookingState.number_of_days} day(s))`}
                  {bookingState.trip_type === 'multiple_stops' && (() => {
                    const pts = Array.isArray(bookingState.stops) ? bookingState.stops : [];
                    const intermediateStops = Math.max(0, pts.length - 2);
                    const daysText = bookingState.number_of_days ? ` · ${bookingState.number_of_days} day(s)` : '';
                    if (bookingState.from_location && bookingState.to_location) {
                      return `Multi way: ${bookingState.from_location} → ${bookingState.to_location} (${intermediateStops} stop(s))${daysText}`;
                    }
                    return `Multi way (${intermediateStops} stop(s))${daysText}`;
                  })()}
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

            {
}
            {!loading && !error && isLocalFlow && localOffers.length > 0 && (() => {
              const localCards = localOffers.flatMap((ct) => (ct.cabs || []).map((cab) => {
                const baseFare = Number(ct.baseFare) || 0;
                const packageForHours = selectedHours && ct.packageRates?.[selectedHours] != null ? Number(ct.packageRates[selectedHours]) : null;
                const rateForSelected = packageForHours != null ? baseFare + packageForHours : null;
                return renderUnifiedCabCard(cab, ct, {
                  displayFare: rateForSelected,
                  serviceLabel: `${ct.name} (${selectedHours || 0} hours)`,
                  includedKm: localIncludedKm ?? (ct.includedKm ?? null),
                  extraPerKm: ct.extraPerKm ?? null,
                  extraPerHour: ct.extraHourRate ?? null,
                  driverCharges: 0,
                  nightCharges: 0,
                });
              }));
              return localCards.length > 0 ? (
                <div className="unified-cab-cards-grid">{localCards}</div>
              ) : (
                <p className="unified-cab-cards-empty">No cabs added for this service yet.</p>
              );
            })()}

            {
}
            {!loading && !error && isAirportFlow && airportOffers.length === 0 && (
              <div className="empty-state">
                <p>No airport cabs configured yet. Please check back later.</p>
              </div>
            )}

            {
}
            {!loading && !error && isAirportFlow && airportOffers.length > 0 && (() => {
              const airportCards = airportOffers.flatMap((ct) => (ct.cabs || []).map((cab) => renderUnifiedCabCard(cab, ct, {
                displayFare: airportFares[ct.id] ?? ct.baseFare ?? 0,
                serviceLabel: ct.name,
                includedKm: airportDistanceKm ?? null,
                includedKmLabel: 'Distance',
                extraPerKm: ct.perKmRate ?? null,
                driverCharges: ct.driverCharges ?? 0,
                nightCharges: ct.nightCharges ?? 0,
                nightChargesLabel: 'Toll Charges',
                extraNotes: ['Toll Included', 'Parking Extra, if Applicable'],
              })));
              return airportCards.length > 0 ? (
                <div className="unified-cab-cards-grid">{airportCards}</div>
              ) : (
                <p className="unified-cab-cards-empty">No cabs added for this service yet.</p>
              );
            })()}

            {
}
            {!loading && !error && isOutstationFlow && outstationOffers.length === 0 && (
              <div className="empty-state">
                <p>No outstation cabs configured yet. Please check back later.</p>
              </div>
            )}

            {
}
            {!loading && !error && isOutstationFlow && outstationOffers.length > 0 && (() => {
              const tripType = bookingState.trip_type || 'one_way';
              const outstationCards = outstationOffers.flatMap((ct) => (ct.cabs || []).map((cab) => {
                const meta = outstationEstimateMetaByCabType?.[ct.id] || {};
                const actualKm =
                  tripType === 'one_way'
                    ? meta.distance_km
                    : (tripType === 'round_trip' ? meta.total_km : meta.distance_km);
                const billableKm = meta.chargeable_km;
                const shouldShowBillable = billableKm != null && actualKm != null && Number(billableKm) !== Number(actualKm);
                return renderUnifiedCabCard(cab, ct, {
                  totalDistanceKm: actualKm ?? null,
                  totalDistanceLabel: 'Total distance',
                  billableDistanceKm: shouldShowBillable ? billableKm : null,
                  billableDistanceLabel: 'Billable distance (min applied)',
                  displayFare: outstationFares[ct.id] ?? ct.baseFare ?? 0,
                  serviceLabel: `${ct.name} (${(bookingState.trip_type || 'one_way').replace('_', ' ')})`,
                  includedKm: ct.includedKm ?? null,
                  extraPerKm: ct.extraPerKm ?? null,
                  // Customer booking flow requirement: always show Driver Charges as "Included" for outstation
                  // (do not display the admin-configured numeric value here).
                  driverCharges: null,
                  nightCharges: ct.nightCharges ?? 0,
                });
              }));
              return outstationCards.length > 0 ? (
                <div className="unified-cab-cards-grid">{outstationCards}</div>
              ) : (
                <p className="unified-cab-cards-empty">No cabs added for this service yet.</p>
              );
            })()}

            {
}
            {!loading && !error && !isLocalFlow && !isAirportFlow && !isOutstationFlow && options.length === 0 && localOffers.length === 0 && (
              <div className="empty-state">
                <p>No car options available yet. Please check back soon.</p>
              </div>
            )}

            {successBookingId && (
              <div
                className="car-options-success-overlay"
                onClick={() => setSuccessBookingId(null)}
                role="dialog"
                aria-modal="true"
              >
                <div className="car-options-success-popup" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="car-options-success-dismiss"
                    onClick={() => setSuccessBookingId(null)}
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                  <h3 className="car-options-success-title">Booking confirmed!</h3>
                  <p className="car-options-success-id">
                    Your booking ID is <strong>#{successBookingId}</strong>
                  </p>
                  <div className="car-options-success-actions">
                    <Link
                      to="/check-booking"
                      className="car-options-success-link"
                      onClick={() => setSuccessBookingId(null)}
                    >
                      Check booking
                    </Link>
                    <button
                      type="button"
                      className="car-options-success-back"
                      onClick={() => { setSuccessBookingId(null); navigate('/'); }}
                    >
                      Back to booking
                    </button>
                  </div>
                </div>
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
        <div className="car-options-confirm-overlay" onClick={reconfirmData ? undefined : handleCloseConfirm}>
          <div className="car-options-confirm-modal" onClick={(e) => e.stopPropagation()}>
            {reconfirmData ? (
              <>
                <div className="car-options-confirm-header">
                  <h3>Confirm your booking</h3>
                  <button type="button" className="car-options-confirm-close" onClick={handleCloseConfirm} aria-label="Close">×</button>
                </div>
                <p className="car-options-reconfirm-intro">Please verify all details before confirming.</p>
                <div className="car-options-confirm-fare car-options-reconfirm-details">
                  {reconfirmData.summaryLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`car-options-confirm-row ${line.isTotal ? 'car-options-confirm-total' : ''}`}
                    >
                      <span>{line.label}</span>
                      <span>{line.value}</span>
                    </div>
                  ))}
                </div>
                {confirmError && <p className="car-options-confirm-error">{confirmError}</p>}
                <div className="car-options-confirm-actions">
                  <button type="button" className="car-options-confirm-cancel" onClick={handleReconfirmEdit}>
                    Edit
                  </button>
                  <button type="button" className="car-options-confirm-submit" disabled={confirmSubmitting} onClick={handleReconfirmSubmit}>
                    {confirmSubmitting ? 'Booking…' : 'Confirm booking'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="car-options-confirm-header">
                  <h3>Enter your details</h3>
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
                        <span>
                          {getSeatLabel({
                            cabTypeName: confirmModal.cabType.name,
                            seatingCapacity: confirmModal.cabType.seatingCapacity,
                            crystaSeater: confirmCrystaSeater,
                          }) || '—'}
                        </span>
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
                        <span>
                          {getSeatLabel({
                            cabTypeName: confirmModal.cabType.name,
                            seatingCapacity: confirmModal.cabType.seatingCapacity,
                            crystaSeater: confirmCrystaSeater,
                          }) || '—'}
                        </span>
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
                        <span>
                          {getSeatLabel({
                            cabTypeName: confirmModal.cabType.name,
                            seatingCapacity: confirmModal.cabType.seatingCapacity,
                            crystaSeater: confirmCrystaSeater,
                          }) || '—'}
                        </span>
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
                  <div className="car-options-confirm-field">
                    <label htmlFor="car-confirm-email">Email</label>
                    <input
                      id="car-confirm-email"
                      type="email"
                      value={confirmPassengerEmail}
                      onChange={(e) => setConfirmPassengerEmail(e.target.value)}
                      placeholder="Enter email for confirmation and updates"
                    />
                  </div>
                  {/crysta/i.test(confirmModal.cabType.name || '') && (
                    <div className="car-options-confirm-field">
                      <label>Seater option (Crysta)</label>
                      <select value={confirmCrystaSeater} onChange={(e) => setConfirmCrystaSeater(e.target.value)}>
                        <option value="6+1">6+1 seater</option>
                        <option value="7+1">7+1 seater</option>
                      </select>
                    </div>
                  )}
                  <div className="car-options-confirm-field">
                    <label>Date and time</label>
                    <DateTimePicker
                      value={confirmTravelDatetime}
                      onChange={setConfirmTravelDatetime}
                      placeholder="Select pickup date and time"
                      min={new Date().toISOString().slice(0, 16)}
                      className="car-options-datetime-picker"
                    />
                  </div>
                  {confirmError && <p className="car-options-confirm-error">{confirmError}</p>}
                  <div className="car-options-confirm-actions">
                    <button type="button" className="car-options-confirm-cancel" onClick={handleCloseConfirm}>
                      Cancel
                    </button>
                    <button type="submit" className="car-options-confirm-submit" disabled={confirmSubmitting}>
                      Continue
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CarOptions;
