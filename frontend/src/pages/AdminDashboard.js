import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getImageUrl } from '../services/api';
import LocationInput from '../components/LocationInput';
import Icon from '../components/Icon';
import './AdminDashboard.css';

const TABS = {
  dashboard: 'dashboard',
  others: 'others',
  bookingForm: 'bookingForm',
  rateMeter: 'rateMeter',
  enquiries: 'enquiries',
  confirmedBookings: 'confirmedBookings',
  driverAssigned: 'driverAssigned',
  tripEnd: 'tripEnd',
  cancelledBookings: 'cancelledBookings',
  driverStatus: 'driverStatus',
  billing: 'billing',
  createInvoice: 'createInvoice',

  corporateBookings: 'corporateBookings',
  corporateInvoices: 'corporateInvoices',
  createCorporateInvoice: 'createCorporateInvoice',
};

const RATE_METER_CAB_NAMES = {
  local: ['Innova Crysta', 'SUV', 'Sedan'],
  airport: ['Innova', 'Crysta', 'SUV', 'Sedan'],
  outstation: ['Innova', 'Crysta', 'SUV', 'Sedan', 'TT', 'Minibus'],
};

function normalizePhoneForWhatsApp(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 10) return `91${digits}`;
  return digits;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.dashboard);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [cabs, setCabs] = useState([]);
  const [loading, setLoading] = useState({ dashboard: false, bookings: false, drivers: false });
  const [toast, setToast] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState('');
  const [invoiceNumberSaving, setInvoiceNumberSaving] = useState(false);
  const [assignBooking, setAssignBooking] = useState(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignCabId, setAssignCabId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [driverModal, setDriverModal] = useState(null);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', license_number: '', emergency_contact_name: '', emergency_contact_phone: '' });
  const [driverSubmitting, setDriverSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState({
    from_location: '',
    to_location: '',
    passenger_name: '',
    passenger_phone: '',
    fare_amount: '',
    service_type: 'local',
    number_of_hours: '',
    outstation_trip_type: 'one_way',
    extra_stops: [],
  });
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [rateMeterCabTypes, setRateMeterCabTypes] = useState({ local: [], airport: [], outstation: [] });
  const [rateMeterOpenSection, setRateMeterOpenSection] = useState('local');
  const [rateMeterExpandedId, setRateMeterExpandedId] = useState(null);
  const [rateMeterCabsByType, setRateMeterCabsByType] = useState({});
  const [rateMeterLocalRates, setRateMeterLocalRates] = useState({});
  const [rateMeterAirportRates, setRateMeterAirportRates] = useState({});
  const [rateMeterOutstationRates, setRateMeterOutstationRates] = useState({});
  const [rateMeterLoading, setRateMeterLoading] = useState({ cabTypes: false, cabs: false, rates: false });
  const [rateMeterSaving, setRateMeterSaving] = useState(false);
  const [rateMeterCabModal, setRateMeterCabModal] = useState({ open: false, cabTypeId: null });
  const [rateMeterAddCabMode, setRateMeterAddCabMode] = useState('assign'); // 'assign' | 'create'
  const [rateMeterNewCabForm, setRateMeterNewCabForm] = useState({ vehicle_number: '', name: '', driver_id: '' });
  const [rateMeterSelectedCabId, setRateMeterSelectedCabId] = useState('');
  const [rateMeterModalCabs, setRateMeterModalCabs] = useState([]);
  const [rateMeterModalOptionsLoading, setRateMeterModalOptionsLoading] = useState(false);
  const [rateMeterLocalForm, setRateMeterLocalForm] = useState({});
  const [rateMeterAirportForm, setRateMeterAirportForm] = useState({});
  const [rateMeterOutstationForm, setRateMeterOutstationForm] = useState({});
  const [uploadingCabId, setUploadingCabId] = useState(null);
  const cabImageUploadTarget = useRef({ cabId: null, cabTypeId: null });
  const cabImageInputRef = useRef(null);

  const [othersCabTypes, setOthersCabTypes] = useState([]);
  const [othersCabTypesLoading, setOthersCabTypesLoading] = useState(false);
  const [othersAddCabModalOpen, setOthersAddCabModalOpen] = useState(false);
  const [othersEditingCabId, setOthersEditingCabId] = useState(null);
  const [othersAddCabForm, setOthersAddCabForm] = useState({ cab_type_id: '', name: '', vehicle_number: '', driver_id: '' });
  const [othersAddCabSubmitting, setOthersAddCabSubmitting] = useState(false);

  const [invoiceForm, setInvoiceForm] = useState({
    from_location: '',
    to_location: '',
    passenger_name: '',
    passenger_phone: '',
    passenger_email: '',
    fare_amount: '',
    service_type: 'local',
    number_of_hours: '',
    outstation_trip_type: 'one_way',
    extra_stops: [],
    with_gst: true,
  });
  const [invoiceFromLocation, setInvoiceFromLocation] = useState(null);
  const [invoiceToLocation, setInvoiceToLocation] = useState(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);

  const [corporateBookings, setCorporateBookings] = useState([]);
  const [corporateBookingsLoading, setCorporateBookingsLoading] = useState(false);
  const [corporateInvoiceForm, setCorporateInvoiceForm] = useState({
    company_name: '',
    name: '',
    phone_number: '',
    pickup_point: '',
    drop_point: '',
    service_type: 'local',
    fare_amount: '',
    travel_date: '',
    travel_time: '',
    with_gst: true,
  });
  const [corporateInvoiceSubmitting, setCorporateInvoiceSubmitting] = useState(false);
  const [corporateDownloadAllLoading, setCorporateDownloadAllLoading] = useState(false);
  const [corporateEditingInvoiceId, setCorporateEditingInvoiceId] = useState(null);
  const [corporateEditingInvoiceValue, setCorporateEditingInvoiceValue] = useState('');
  const [corporateInvoiceNumberSaving, setCorporateInvoiceNumberSaving] = useState(false);
  const [corporateEditBooking, setCorporateEditBooking] = useState(null);
  const [corporateEditForm, setCorporateEditForm] = useState({
    company_name: '', name: '', phone_number: '', pickup_point: '', drop_point: '',
    service_type: 'local', travel_date: '', travel_time: '', fare_amount: '', notes: '', status: 'pending',
  });
  const [corporateEditSaving, setCorporateEditSaving] = useState(false);
  const [staleBookingsWarning, setStaleBookingsWarning] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading((l) => ({ ...l, dashboard: true }));
    try {
      const res = await api.get('/admin/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/admin/login');
        return;
      }
      showToast(err.response?.data?.error || 'Failed to load stats', 'error');
    } finally {
      setLoading((l) => ({ ...l, dashboard: false }));
    }
  }, [logout, navigate, showToast]);

  const fetchBookings = useCallback(async () => {
    setLoading((l) => ({ ...l, bookings: true }));
    try {
      const res = await api.get('/admin/bookings');
      setBookings(res.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/admin/login');
        return;
      }
      showToast(err.response?.data?.error || 'Failed to load bookings', 'error');
    } finally {
      setLoading((l) => ({ ...l, bookings: false }));
    }
  }, [logout, navigate, showToast]);

  const fetchCorporateBookings = useCallback(async () => {
    setCorporateBookingsLoading(true);
    try {
      const res = await api.get('/corporate/bookings');
      setCorporateBookings(res.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/admin/login');
        return;
      }
      showToast(err.response?.data?.error || 'Failed to load corporate bookings', 'error');
    } finally {
      setCorporateBookingsLoading(false);
    }
  }, [logout, navigate, showToast]);

  const fetchDrivers = useCallback(async () => {
    setLoading((l) => ({ ...l, drivers: true }));
    try {
      const [driversRes, cabsRes] = await Promise.all([
        api.get('/admin/drivers'),
        api.get('/admin/cabs'),
      ]);
      setDrivers(driversRes.data || []);
      setCabs(cabsRes.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/admin/login');
        return;
      }
      showToast(err.response?.data?.error || 'Failed to load drivers', 'error');
    } finally {
      setLoading((l) => ({ ...l, drivers: false }));
    }
  }, [logout, navigate, showToast]);

  const fetchRateMeterCabTypes = useCallback(async () => {
    setRateMeterLoading((l) => ({ ...l, cabTypes: true }));
    try {
      const [local, airport, outstation] = await Promise.all([
        api.get('/admin/rate-meter/cab-types?service_type=local'),
        api.get('/admin/rate-meter/cab-types?service_type=airport'),
        api.get('/admin/rate-meter/cab-types?service_type=outstation'),
      ]);
      setRateMeterCabTypes({
        local: local.data || [],
        airport: airport.data || [],
        outstation: outstation.data || [],
      });
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/admin/login');
        return;
      }
      showToast(err.response?.data?.error || 'Failed to load cab types', 'error');
    } finally {
      setRateMeterLoading((l) => ({ ...l, cabTypes: false }));
    }
  }, [logout, navigate, showToast]);

  const fetchRateMeterCabs = useCallback(async (cabTypeId) => {
    setRateMeterLoading((l) => ({ ...l, cabs: true }));
    try {
      const res = await api.get(`/admin/rate-meter/cabs?cab_type_id=${cabTypeId}`);
      setRateMeterCabsByType((prev) => ({ ...prev, [cabTypeId]: res.data || [] }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load cabs', 'error');
    } finally {
      setRateMeterLoading((l) => ({ ...l, cabs: false }));
    }
  }, [showToast]);

  const fetchRateMeterLocalRates = useCallback(async (cabTypeId) => {
    setRateMeterLoading((l) => ({ ...l, rates: true }));
    try {
      const res = await api.get(`/admin/rate-meter/local/${cabTypeId}`);
      const d = res.data || {};
      setRateMeterLocalRates((prev) => ({ ...prev, [cabTypeId]: d }));
      setRateMeterLocalForm((prev) => ({ ...prev, [cabTypeId]: { base_fare: d.base_fare ?? '', package_4h: d.package_4h ?? '', package_8h: d.package_8h ?? '', package_12h: d.package_12h ?? '', extra_hour_rate: d.extra_hour_rate ?? '' } }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load local rates', 'error');
    } finally {
      setRateMeterLoading((l) => ({ ...l, rates: false }));
    }
  }, [showToast]);

  const fetchRateMeterAirportRates = useCallback(async (cabTypeId) => {
    setRateMeterLoading((l) => ({ ...l, rates: true }));
    try {
      const res = await api.get(`/admin/rate-meter/airport/${cabTypeId}`);
      const d = res.data || {};
      setRateMeterAirportRates((prev) => ({ ...prev, [cabTypeId]: d }));
      setRateMeterAirportForm((prev) => ({ ...prev, [cabTypeId]: { base_fare: d.base_fare ?? '', per_km_rate: d.per_km_rate ?? '', driver_charges: d.driver_charges ?? '', night_charges: d.night_charges ?? '' } }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load airport rates', 'error');
    } finally {
      setRateMeterLoading((l) => ({ ...l, rates: false }));
    }
  }, [showToast]);

  const fetchRateMeterOutstationRates = useCallback(async (cabTypeId) => {
    setRateMeterLoading((l) => ({ ...l, rates: true }));
    try {
      const res = await api.get(`/admin/rate-meter/outstation/${cabTypeId}`);
      const d = res.data || {};
      setRateMeterOutstationRates((prev) => ({ ...prev, [cabTypeId]: d }));
      const ow = d.oneWay || {};
      const rt = d.roundTrip || {};
      const ms = d.multipleStops || {};
      setRateMeterOutstationForm((prev) => ({
        ...prev,
        [cabTypeId]: {
          oneWay: { minKm: ow.minKm ?? '', baseFare: ow.baseFare ?? '', extraKmRate: ow.extraKmRate ?? '', driverCharges: ow.driverCharges ?? '', nightCharges: ow.nightCharges ?? '' },
          roundTrip: { baseKmPerDay: rt.baseKmPerDay ?? '', perKmRate: rt.perKmRate ?? '', extraKmRate: rt.extraKmRate ?? '', driverCharges: rt.driverCharges ?? '', nightCharges: rt.nightCharges ?? '' },
          multipleStops: { baseFare: ms.baseFare ?? '', perKmRate: ms.perKmRate ?? '', driverCharges: ms.driverCharges ?? '', nightCharges: ms.nightCharges ?? '' },
        },
      }));
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load outstation rates', 'error');
    } finally {
      setRateMeterLoading((l) => ({ ...l, rates: false }));
    }
  }, [showToast]);

  const ensureRateMeterCabTypes = useCallback(async (serviceType) => {
    const names = RATE_METER_CAB_NAMES[serviceType] || [];
    const existing = rateMeterCabTypes[serviceType] || [];
    const existingNames = new Set((existing).map((ct) => ct.name));
    setRateMeterSaving(true);
    try {
      for (const name of names) {
        if (existingNames.has(name)) continue;
        await api.post('/admin/rate-meter/cab-types', { name, service_type: serviceType, description: '' });
        existingNames.add(name);
      }
      await fetchRateMeterCabTypes();
      showToast('Cab types created.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create cab types', 'error');
    } finally {
      setRateMeterSaving(false);
    }
  }, [rateMeterCabTypes, fetchRateMeterCabTypes, showToast]);

  useEffect(() => {
    if (activeTab === TABS.rateMeter) fetchRateMeterCabTypes();
  }, [activeTab, fetchRateMeterCabTypes]);

  const fetchOthersCabTypes = useCallback(async () => {
    setOthersCabTypesLoading(true);
    try {
      const [local, airport, outstation] = await Promise.all([
        api.get('/admin/rate-meter/cab-types?service_type=local'),
        api.get('/admin/rate-meter/cab-types?service_type=airport'),
        api.get('/admin/rate-meter/cab-types?service_type=outstation'),
      ]);
      const combined = [
        ...(Array.isArray(local?.data) ? local.data.map((ct) => ({ ...ct, service_type: 'local' })) : []),
        ...(Array.isArray(airport?.data) ? airport.data.map((ct) => ({ ...ct, service_type: 'airport' })) : []),
        ...(Array.isArray(outstation?.data) ? outstation.data.map((ct) => ({ ...ct, service_type: 'outstation' })) : []),
      ];
      setOthersCabTypes(combined);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load cab types', 'error');
      setOthersCabTypes([]);
    } finally {
      setOthersCabTypesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === TABS.dashboard) {
      fetchStats();
      fetchBookings();
    } else if ([TABS.enquiries, TABS.confirmedBookings, TABS.driverAssigned, TABS.tripEnd, TABS.cancelledBookings].includes(activeTab)) {
      fetchBookings();
    } else if (activeTab === TABS.driverStatus || activeTab === TABS.others) {
      fetchDrivers();
    } else if ([TABS.corporateBookings, TABS.corporateInvoices, TABS.createCorporateInvoice].includes(activeTab)) {
      fetchCorporateBookings();
    }
    if (activeTab === TABS.others) {
      if (!driverModal) setDriverForm({ name: '', phone: '', license_number: '', emergency_contact_name: '', emergency_contact_phone: '' });
      fetchOthersCabTypes();
    }
  }, [activeTab, fetchStats, fetchBookings, fetchDrivers, fetchOthersCabTypes, fetchCorporateBookings]);

  useEffect(() => {
    if (activeTab !== TABS.dashboard || !bookings || bookings.length === 0) {
      if (activeTab !== TABS.dashboard) setStaleBookingsWarning(null);
      return;
    }
    const terminal = ['completed', 'cancelled'];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const stale = bookings.filter((b) => {
      if (terminal.includes(b.booking_status)) return false;
      const t = b.booking_date ? new Date(b.booking_date).getTime() : 0;
      return t > 0 && t < cutoff;
    });
    setStaleBookingsWarning(stale.length ? stale : null);
  }, [activeTab, bookings]);

  useEffect(() => {
    if (assignBooking) {
      fetchDrivers();
    }
  }, [assignBooking]);

  useEffect(() => {
    if (assignBooking && cabs.length > 0 && assignBooking.cab_id) {
      const cab = cabs.find((c) => Number(c.id) === Number(assignBooking.cab_id));
      if (cab && cab.driver_id != null && assignDriverId === '') {
        setAssignDriverId(String(cab.driver_id));
      }
    }
  }, [assignBooking, cabs]);

  useEffect(() => {
    if (detailBooking) {
      setEditingInvoiceNumber(detailBooking.invoice_number || '');
    }
  }, [detailBooking]);

  const assignModalCabs = cabs || [];

  const handleSaveInvoiceNumber = async () => {
    if (!detailBooking) return;
    const val = (editingInvoiceNumber || '').trim();
    setInvoiceNumberSaving(true);
    try {
      await api.put(`/admin/bookings/${detailBooking.id}`, { invoice_number: val || null });
      setDetailBooking((prev) => (prev ? { ...prev, invoice_number: val || null } : null));
      setBookings((prev) => prev.map((b) => (b.id === detailBooking.id ? { ...b, invoice_number: val || null } : b)));
      showToast('Invoice number updated.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update invoice number', 'error');
    } finally {
      setInvoiceNumberSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignBooking || !assignCabId) return;
    setAssignSubmitting(true);
    try {
      await api.put(`/admin/bookings/${assignBooking.id}`, {
        cab_id: Number(assignCabId),
        booking_status: 'confirmed',
      });
      showToast('Driver & cab assigned.');
      setAssignBooking(null);
      setAssignDriverId('');
      setAssignCabId('');
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to assign', 'error');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    setStatusUpdatingId(bookingId);
    try {
      await api.put(`/admin/bookings/${bookingId}`, { booking_status: newStatus });
      showToast(newStatus === 'confirmed' ? 'Booking confirmed.' : newStatus === 'completed' ? 'Trip marked completed.' : 'Booking cancelled.');
      fetchBookings();
      if (detailBooking && detailBooking.id === bookingId) {
        setDetailBooking((prev) => (prev ? { ...prev, booking_status: newStatus } : null));
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleCopyMapLink = (mapsLink) => {
    if (!mapsLink) {
      showToast('No map link for this booking.', 'warning');
      return;
    }
    navigator.clipboard.writeText(mapsLink).then(() => showToast('Map link copied.')).catch(() => showToast('Failed to copy', 'error'));
  };

  const handleSendWhatsApp = (booking) => {
    const phone = booking.driver_phone;
    if (!phone) {
      showToast('No driver phone for this booking.', 'warning');
      return;
    }
    const link = booking.maps_link || '';
    const num = normalizePhoneForWhatsApp(phone);
    window.open(`https://wa.me/${num}${link ? `?text=${encodeURIComponent(link)}` : ''}`, '_blank');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const { service_type, outstation_trip_type, extra_stops } = createForm;
    const isOutstation = service_type === 'outstation';
    const roundTrip = isOutstation && outstation_trip_type === 'round_trip';
    const multipleStops = isOutstation && outstation_trip_type === 'multiple_stops';

    let fromAddress = (fromLocation?.address || createForm.from_location || '').trim();
    let toAddress = (toLocation?.address || createForm.to_location || '').trim();
    if (roundTrip) {
      if (!fromAddress) {
        showToast('Please select location (from & to).', 'error');
        return;
      }
      toAddress = fromAddress;
    } else if (multipleStops) {
      if (!fromAddress) {
        showToast('Please select From (first stop).', 'error');
        return;
      }
      const stops = (extra_stops || []).filter(Boolean).map((s) => (typeof s === 'string' ? s : s?.address || s).trim());
      toAddress = stops.length ? stops.join(', ') : fromAddress;
    } else if (service_type === 'local') {
      if (!fromAddress) {
        showToast('Please select From location.', 'error');
        return;
      }
      if (!toAddress) toAddress = 'Local package';
    } else {
      if (!fromAddress || !toAddress) {
        showToast('Please fill From and To locations.', 'error');
        return;
      }
    }
    if (!createForm.passenger_name?.trim() || !createForm.passenger_phone?.trim() || createForm.fare_amount === '' || Number(createForm.fare_amount) < 0) {
      showToast('Please fill passenger name, phone, and fare amount.', 'error');
      return;
    }
    setCreateSubmitting(true);
    try {
      await api.post('/admin/bookings', {
        from_location: fromAddress,
        to_location: toAddress,
        passenger_name: createForm.passenger_name.trim(),
        passenger_phone: createForm.passenger_phone.trim(),
        fare_amount: Number(createForm.fare_amount),
        service_type: createForm.service_type,
        number_of_hours: createForm.service_type === 'local' && createForm.number_of_hours ? Number(createForm.number_of_hours) : null,
        pickup_lat: fromLocation?.lat ?? null,
        pickup_lng: fromLocation?.lng ?? null,
        destination_lat: toLocation?.lat ?? null,
        destination_lng: toLocation?.lng ?? null,
      });
      showToast('Booking created.');
      setCreateForm({
        from_location: '',
        to_location: '',
        passenger_name: '',
        passenger_phone: '',
        fare_amount: '',
        service_type: 'local',
        number_of_hours: '',
        outstation_trip_type: 'one_way',
        extra_stops: [],
      });
      setFromLocation(null);
      setToLocation(null);
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create booking', 'error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleCreateInvoiceSubmit = async (e) => {
    e.preventDefault();
    const { from_location, to_location, passenger_name, passenger_phone, fare_amount, service_type, number_of_hours, outstation_trip_type, extra_stops, with_gst } = invoiceForm;
    const isOutstation = service_type === 'outstation';
    const roundTrip = isOutstation && outstation_trip_type === 'round_trip';
    const multipleStops = isOutstation && outstation_trip_type === 'multiple_stops';

    let fromVal = (invoiceFromLocation?.address || from_location?.trim() || '').trim();
    let toVal = (invoiceToLocation?.address || to_location?.trim() || '').trim();
    if (roundTrip) {
      if (!fromVal) {
        showToast('Please select Location (from & to) using the search.', 'error');
        return;
      }
      toVal = fromVal;
    } else if (multipleStops) {
      if (!fromVal) {
        showToast('Please select From (A) using the search.', 'error');
        return;
      }
      toVal = (extra_stops || []).filter(Boolean).map((s) => (typeof s === 'string' ? s : s?.address || s).trim()).join(', ');
    } else {
      if (!fromVal || !toVal) {
        showToast('Please select From and To locations using the search.', 'error');
        return;
      }
    }
    if (!passenger_name?.trim() || !passenger_phone?.trim() || fare_amount === '' || Number(fare_amount) < 0) {
      showToast('Please fill Passenger name, Phone, and Fare.', 'error');
      return;
    }
    setInvoiceSubmitting(true);
    try {
      const payload = {
        from_location: fromVal,
        to_location: toVal,
        passenger_name: passenger_name.trim(),
        passenger_phone: passenger_phone.trim(),
        passenger_email: invoiceForm.passenger_email?.trim() || undefined,
        fare_amount: Number(fare_amount),
        service_type: service_type || 'local',
        number_of_hours: service_type === 'local' && number_of_hours ? Number(number_of_hours) : undefined,
        with_gst: with_gst,
      };
      if (isOutstation) payload.trip_type = outstation_trip_type || 'one_way';
      const response = await api.post('/admin/invoice/create', payload, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = response.headers['content-disposition']?.split('filename=')?.[1]?.replace(/"/g, '') || 'invoice.pdf';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Invoice created and downloaded.');
      setInvoiceFromLocation(null);
      setInvoiceToLocation(null);
      setInvoiceForm((f) => ({ ...f, from_location: '', to_location: '', passenger_name: '', passenger_phone: '', passenger_email: '', fare_amount: '', number_of_hours: '', extra_stops: [] }));
      fetchBookings();
    } catch (err) {
      let msg = 'Failed to create invoice';
      if (err.response?.data) {
        const d = err.response.data;
        if (typeof d === 'string') {
          try {
            const parsed = JSON.parse(d);
            msg = parsed.error || (parsed.errors && parsed.errors.map((e) => e.msg).join('; ')) || msg;
          } catch (_) {
            msg = d.slice(0, 100) || msg;
          }
        } else if (d && typeof d.text === 'function') {
          try {
            const text = await d.text();
            const parsed = JSON.parse(text);
            msg = parsed.error || (parsed.errors && parsed.errors.map((e) => e.msg).join('; ')) || msg;
          } catch (_) {}
        } else if (typeof d === 'object' && d !== null) {
          msg = d.error || (d.errors && d.errors.map((e) => e.msg).join('; ')) || msg;
        }
      }
      showToast(msg, 'error');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const parseBlobError = async (data) => {
    if (data && typeof data.text === 'function') {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text);
        return parsed?.error || text || 'Request failed';
      } catch (_) {
        return 'Request failed';
      }
    }
    return typeof data?.error === 'string' ? data.error : 'Failed to download invoice';
  };

  const handleCorporateInvoiceDownload = async (bookingId) => {
    try {
      const response = await api.get(`/corporate/bookings/${bookingId}/invoice`, { responseType: 'blob' });
      if (response.data instanceof Blob && response.data.size > 0 && response.data.type === 'application/pdf') {
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `corporate-invoice-${bookingId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Invoice downloaded.');
      } else {
        const msg = await parseBlobError(response.data);
        showToast(msg || 'Invalid response', 'error');
      }
    } catch (err) {
      let msg = 'Failed to download corporate invoice';
      if (err.response?.data instanceof Blob) {
        msg = await parseBlobError(err.response.data);
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.message) {
        msg = err.message;
      }
      showToast(msg, 'error');
    }
  };

  const handleBookingInvoiceDownload = async (bookingId, withGst) => {
    try {
      const response = await api.get(`/admin/bookings/${bookingId}/invoice`, {
        params: { with_gst: withGst },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${bookingId}${withGst ? '-with-gst' : ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Invoice downloaded.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to download invoice', 'error');
    }
  };

  const handleCorporateDownloadAll = async () => {
    setCorporateDownloadAllLoading(true);
    try {
      const response = await api.get('/corporate/invoices/download-all', { responseType: 'blob' });
      if (response.data instanceof Blob && response.data.size > 0 && response.data.type === 'application/zip') {
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'corporate-invoices.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('All corporate invoices downloaded.');
      } else {
        const msg = await parseBlobError(response.data);
        showToast(msg || 'Invalid response', 'error');
      }
    } catch (err) {
      let msg = err.response?.status === 404 ? 'No corporate bookings to export' : 'Failed to download';
      if (err.response?.data instanceof Blob) {
        msg = await parseBlobError(err.response.data);
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      }
      showToast(msg, 'error');
    } finally {
      setCorporateDownloadAllLoading(false);
    }
  };

  const handleSaveCorporateInvoiceNumber = async (b, newValue) => {
    const val = (newValue ?? corporateEditingInvoiceValue).trim();
    setCorporateInvoiceNumberSaving(true);
    try {
      await api.put(`/corporate/bookings/${b.id}`, { invoice_number: val || null });
      setCorporateBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, invoice_number: val || null } : x)));
      setCorporateEditingInvoiceId(null);
      setCorporateEditingInvoiceValue('');
      showToast('Corporate invoice number updated.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update invoice number', 'error');
    } finally {
      setCorporateInvoiceNumberSaving(false);
    }
  };

  const handleOpenCorporateEdit = (b) => {
    setCorporateEditBooking(b);
    setCorporateEditForm({
      company_name: b.company_name || '',
      name: b.name || '',
      phone_number: b.phone_number || '',
      pickup_point: b.pickup_point || '',
      drop_point: b.drop_point || '',
      service_type: b.service_type || 'local',
      travel_date: b.travel_date || '',
      travel_time: b.travel_time || '',
      fare_amount: b.fare_amount != null && b.fare_amount !== '' ? String(b.fare_amount) : '',
      notes: b.notes || '',
      status: b.status || 'pending',
    });
  };

  const handleCorporateEditFormChange = (e) => {
    const { name, value } = e.target;
    setCorporateEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveCorporateEdit = async (e) => {
    e.preventDefault();
    if (!corporateEditBooking) return;
    setCorporateEditSaving(true);
    try {
      const payload = {
        company_name: corporateEditForm.company_name.trim() || undefined,
        name: corporateEditForm.name.trim() || undefined,
        phone_number: corporateEditForm.phone_number.trim() || undefined,
        pickup_point: corporateEditForm.pickup_point.trim() || undefined,
        drop_point: corporateEditForm.drop_point.trim() || undefined,
        service_type: corporateEditForm.service_type || undefined,
        travel_date: corporateEditForm.travel_date || undefined,
        travel_time: corporateEditForm.travel_time || undefined,
        notes: corporateEditForm.notes.trim() || undefined,
        status: corporateEditForm.status || undefined,
      };
      if (corporateEditForm.fare_amount !== '') {
        const num = parseFloat(corporateEditForm.fare_amount);
        payload.fare_amount = Number.isNaN(num) ? undefined : num;
      }
      const { data: updated } = await api.put(`/corporate/bookings/${corporateEditBooking.id}`, payload);
      setCorporateBookings((prev) => prev.map((x) => (x.id === corporateEditBooking.id ? updated : x)));
      setCorporateEditBooking(null);
      showToast('Corporate booking updated.');
    } catch (err) {
      showToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to update booking', 'error');
    } finally {
      setCorporateEditSaving(false);
    }
  };

  const handleCreateCorporateInvoiceSubmit = async (e) => {
    e.preventDefault();
    const { company_name, name, phone_number, pickup_point, drop_point, fare_amount, service_type, travel_date, travel_time, with_gst } = corporateInvoiceForm;
    if (!company_name?.trim() || !name?.trim() || !phone_number?.trim() || !pickup_point?.trim() || !drop_point?.trim() || fare_amount === '' || Number(fare_amount) < 0) {
      showToast('Please fill required fields.', 'error');
      return;
    }
    setCorporateInvoiceSubmitting(true);
    try {
      const response = await api.post('/corporate/invoice/create', {
        company_name: company_name.trim(),
        name: name.trim(),
        phone_number: phone_number.trim(),
        pickup_point: pickup_point.trim(),
        drop_point: drop_point.trim(),
        fare_amount: Number(fare_amount),
        service_type: service_type || 'local',
        travel_date: travel_date || undefined,
        travel_time: travel_time || undefined,
        with_gst: with_gst,
      }, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers['content-disposition']?.split('filename=')?.[1]?.replace(/"/g, '') || 'corporate-invoice.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Corporate invoice created and downloaded.');
      setCorporateInvoiceForm({ company_name: '', name: '', phone_number: '', pickup_point: '', drop_point: '', service_type: 'local', fare_amount: '', travel_date: '', travel_time: '', with_gst: true });
      fetchCorporateBookings();
    } catch (err) {
      const msg = err.response?.data?.error || (err.response?.data?.errors && err.response.data.errors.map((e) => e.msg).join('; ')) || 'Failed to create corporate invoice';
      showToast(typeof msg === 'string' ? msg : 'Failed to create corporate invoice', 'error');
    } finally {
      setCorporateInvoiceSubmitting(false);
    }
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    const { name, phone } = driverForm;
    if (!name?.trim() || !phone?.trim()) {
      showToast('Name and phone are required.', 'error');
      return;
    }
    setDriverSubmitting(true);
    try {
      if (driverModal?.id) {
        await api.put(`/admin/drivers/${driverModal.id}`, driverForm);
        showToast('Driver updated.');
      } else {
        await api.post('/admin/drivers', driverForm);
        showToast('Driver registered.');
      }
      setDriverModal(null);
      setDriverForm({ name: '', phone: '', license_number: '', emergency_contact_name: '', emergency_contact_phone: '' });
      fetchDrivers();
    } catch (err) {
      const msg = err.response?.data?.error || (err.response?.data?.errors && err.response.data.errors.map((e) => e.msg).join('; ')) || 'Failed to save driver';
      showToast(msg, 'error');
    } finally {
      setDriverSubmitting(false);
    }
  };

  const handleOthersAddCabSubmit = async (e) => {
    e.preventDefault();
    const { cab_type_id, name, vehicle_number, driver_id } = othersAddCabForm;
    if (!cab_type_id || !vehicle_number?.trim()) {
      showToast('Cab type and vehicle number are required.', 'error');
      return;
    }
    const driver = driver_id ? drivers.find((d) => Number(d.id) === Number(driver_id)) : null;
    setOthersAddCabSubmitting(true);
    try {
      if (othersEditingCabId) {
        await api.put(`/admin/rate-meter/cabs/${othersEditingCabId}`, {
          cab_type_id: Number(cab_type_id),
          vehicle_number: vehicle_number.trim(),
          name: (name || '').trim() || null,
          driver_name: driver?.name || '',
          driver_phone: driver?.phone || '',
        });
        showToast('Cab updated.');
      } else {
        await api.post('/admin/rate-meter/cabs', {
          cab_type_id: Number(cab_type_id),
          vehicle_number: vehicle_number.trim(),
          name: (name || '').trim() || null,
          driver_name: driver?.name || '',
          driver_phone: driver?.phone || '',
        });
        showToast('Cab added.');
      }
      setOthersAddCabModalOpen(false);
      setOthersEditingCabId(null);
      setOthersAddCabForm({ cab_type_id: '', name: '', vehicle_number: '', driver_id: '' });
      fetchDrivers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save cab', 'error');
    } finally {
      setOthersAddCabSubmitting(false);
    }
  };

  const deleteOthersCab = async (cabId) => {
    if (!window.confirm('Deactivate this cab?')) return;
    try {
      await api.delete(`/admin/rate-meter/cabs/${cabId}`);
      showToast('Cab deactivated.');
      fetchDrivers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to deactivate cab', 'error');
    }
  };

  const handleDeleteDriver = async (id) => {
    if (!window.confirm('Deactivate this driver?')) return;
    try {
      await api.delete(`/admin/drivers/${id}`);
      showToast('Driver deactivated.');
      fetchDrivers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to deactivate', 'error');
    }
  };

  const saveRateMeterLocal = async (cabTypeId, data) => {
    setRateMeterSaving(true);
    try {
      await api.put(`/admin/rate-meter/local/${cabTypeId}`, data);
      setRateMeterLocalRates((prev) => ({ ...prev, [cabTypeId]: { ...prev[cabTypeId], ...data } }));
      showToast('Local rates saved.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setRateMeterSaving(false);
    }
  };

  const saveRateMeterAirport = async (cabTypeId, data) => {
    setRateMeterSaving(true);
    try {
      await api.put(`/admin/rate-meter/airport/${cabTypeId}`, data);
      setRateMeterAirportRates((prev) => ({ ...prev, [cabTypeId]: { ...prev[cabTypeId], ...data } }));
      showToast('Airport rates saved.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setRateMeterSaving(false);
    }
  };

  const saveRateMeterOutstation = async (cabTypeId, data) => {
    setRateMeterSaving(true);
    try {
      await api.put(`/admin/rate-meter/outstation/${cabTypeId}`, data);
      setRateMeterOutstationRates((prev) => ({ ...prev, [cabTypeId]: { ...prev[cabTypeId], ...data } }));
      showToast('Outstation rates saved.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setRateMeterSaving(false);
    }
  };

  const fetchRateMeterModalOptions = useCallback(async () => {
    setRateMeterModalOptionsLoading(true);
    try {
      const cabsRes = await api.get('/admin/cabs');
      const cabsRaw = Array.isArray(cabsRes?.data) ? cabsRes.data : (cabsRes?.data?.cabs ?? []) || [];
      setRateMeterModalCabs(
        cabsRaw.map((c) => ({
          id: c.id ?? c.ID,
          vehicle_number: c.vehicle_number ?? c.VEHICLE_NUMBER ?? '',
          name: c.name ?? c.NAME ?? null,
          driver_name: c.driver_name ?? c.DRIVER_NAME ?? '',
        }))
      );
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load cabs', 'error');
      setRateMeterModalCabs([]);
    } finally {
      setRateMeterModalOptionsLoading(false);
    }
  }, [showToast]);

  const openRateMeterCabModal = (cabTypeId) => {
    setRateMeterCabModal({ open: true, cabTypeId });
    setRateMeterAddCabMode('create');
    setRateMeterNewCabForm({ vehicle_number: '', name: '', driver_id: '' });
    setRateMeterSelectedCabId('');
    fetchRateMeterModalOptions();
  };

  const closeRateMeterCabModal = () => {
    setRateMeterCabModal({ open: false, cabTypeId: null });
    setRateMeterAddCabMode('assign');
    setRateMeterNewCabForm({ vehicle_number: '', name: '', driver_id: '' });
    setRateMeterSelectedCabId('');
  };

  const handleRateMeterCabSubmit = async (e) => {
    e.preventDefault();
    const { cabTypeId } = rateMeterCabModal;
    if (rateMeterAddCabMode === 'create') {
      const { vehicle_number, name, driver_id } = rateMeterNewCabForm;
      if (!vehicle_number?.trim()) {
        showToast('Vehicle number is required.', 'error');
        return;
      }
      setRateMeterSaving(true);
      try {
        const driver = driver_id ? drivers.find((d) => Number(d.id) === Number(driver_id)) : null;
        await api.post('/admin/rate-meter/cabs', {
          cab_type_id: cabTypeId,
          vehicle_number: vehicle_number.trim(),
          name: (name || '').trim() || null,
          driver_name: driver?.name || '',
          driver_phone: driver?.phone || '',
          create_only: true,
        });
        showToast('Cab added.');
        closeRateMeterCabModal();
        if (cabTypeId) fetchRateMeterCabs(cabTypeId);
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to add cab', 'error');
      } finally {
        setRateMeterSaving(false);
      }
      return;
    }
    if (!rateMeterSelectedCabId) {
      showToast('Please select a car.', 'error');
      return;
    }
    setRateMeterSaving(true);
    try {
      await api.post('/admin/rate-meter/cabs/assign', { cab_id: Number(rateMeterSelectedCabId), cab_type_id: cabTypeId });
      showToast('Cab assigned.');
      closeRateMeterCabModal();
      if (cabTypeId) fetchRateMeterCabs(cabTypeId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to assign cab', 'error');
    } finally {
      setRateMeterSaving(false);
    }
  };

  const toggleRateMeterCabTypeExpand = (cabTypeId, serviceType) => {
    if (rateMeterExpandedId === cabTypeId) {
      setRateMeterExpandedId(null);
      return;
    }
    setRateMeterExpandedId(cabTypeId);
    fetchRateMeterCabs(cabTypeId);
    if (serviceType === 'local') fetchRateMeterLocalRates(cabTypeId);
    else if (serviceType === 'airport') fetchRateMeterAirportRates(cabTypeId);
    else if (serviceType === 'outstation') fetchRateMeterOutstationRates(cabTypeId);
  };

  const deleteRateMeterCab = async (cabTypeId, cabId) => {
    if (!window.confirm('Deactivate this cab?')) return;
    try {
      await api.delete(`/admin/rate-meter/cabs/${cabId}`);
      showToast('Cab deactivated.');
      fetchRateMeterCabs(cabTypeId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to deactivate cab', 'error');
    }
  };

  const triggerCabImageUpload = (cabId, cabTypeId) => {
    cabImageUploadTarget.current = { cabId, cabTypeId };
    cabImageInputRef.current?.click();
  };

  const handleCabImageSelect = async (e) => {
    const file = e.target.files?.[0];
    const { cabId, cabTypeId } = cabImageUploadTarget.current || {};
    if (!file || !cabId || !cabTypeId) {
      e.target.value = '';
      return;
    }
    setUploadingCabId(cabId);
    e.target.value = '';
    try {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/admin/rate-meter/cabs/${cabId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Image uploaded.');
      fetchRateMeterCabs(cabTypeId);
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploadingCabId(null);
      cabImageUploadTarget.current = { cabId: null, cabTypeId: null };
    }
  };

  

  const sortLatestFirst = (a, b) => (Number(b.id) || 0) - (Number(a.id) || 0);
  const enquiriesBookings = [...bookings].sort(sortLatestFirst);
  const confirmedBookingsList = bookings
    .filter((b) => b.booking_status === 'confirmed')
    .sort(sortLatestFirst);
  const driverAssignedBookings = bookings
    .filter((b) => b.cab_id != null)
    .sort(sortLatestFirst);
  const tripEndBookings = bookings
    .filter((b) => b.booking_status === 'completed')
    .sort(sortLatestFirst);
  const cancelledBookingsList = bookings
    .filter((b) => b.booking_status === 'cancelled')
    .sort(sortLatestFirst);

  const pieData = stats ? [
    { label: 'Completed', value: stats.completed ?? 0, color: '#16a34a' },
    { label: 'Assigned', value: stats.assigned ?? 0, color: '#2563eb' },
    { label: 'Cancelled', value: stats.cancelled ?? 0, color: '#dc2626' },
    { label: 'Enquiries', value: stats.pending ?? 0, color: '#ea580c' },
  ].filter((d) => d.value > 0) : [];
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0) || 1;

  const setTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const renderBookingsTable = (list, title, desc) => (
    <div className="admin-tab-section admin-dashboard-box">
      <h2 className="admin-dashboard-box-heading">{title}</h2>
      <p className="admin-bookings-desc">{desc}</p>
      {loading.bookings && <p className="admin-dashboard-list-loading">Loading…</p>}
      {!loading.bookings && list.length === 0 && <p className="admin-dashboard-list-empty">No entries.</p>}
      {!loading.bookings && list.length > 0 && (
        <div className="admin-entry-cards">
          {list.map((b) => (
            <div key={b.id} className="admin-entry-card">
              <div className="admin-entry-card-header">
                <span className="admin-entry-card-id">#{b.id}</span>
                <span className="admin-service-badge">{b.booking_status}</span>
              </div>
              <div className="admin-entry-card-rows">
                <div className="admin-entry-card-row"><span className="key">From</span><span className="value">{b.from_location || '—'}</span></div>
                <div className="admin-entry-card-row"><span className="key">To</span><span className="value">{b.to_location || '—'}</span></div>
                <div className="admin-entry-card-row"><span className="key">Passenger</span><span className="value">{b.passenger_name || '—'}</span></div>
                <div className="admin-entry-card-row"><span className="key">Driver / Cab</span><span className="value">{b.driver_name ? `${b.driver_name} / ${b.vehicle_number || '—'}` : '—'}</span></div>
              </div>
              <div className="admin-entry-card-actions">
                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setDetailBooking(b)}>View</button>
                {b.booking_status === 'pending' && (
                  <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')} disabled={statusUpdatingId === b.id}>
                    {statusUpdatingId === b.id ? '…' : 'Confirm'}
                  </button>
                )}
                {b.booking_status === 'confirmed' && (
                  <>
                    <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'completed')} disabled={statusUpdatingId === b.id}>
                      {statusUpdatingId === b.id ? '…' : 'Trip completed'}
                    </button>
                    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')} disabled={statusUpdatingId === b.id}>
                      {statusUpdatingId === b.id ? '…' : 'Cancel'}
                    </button>
                  </>
                )}
                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setAssignBooking(b); setAssignDriverId(''); setAssignCabId(b.cab_id || ''); }}>Assign</button>
                {b.maps_link && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleCopyMapLink(b.maps_link)}>Copy pickup map</button>}
                {b.maps_link_drop && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleCopyMapLink(b.maps_link_drop)}>Copy drop map</button>}
                {(b.driver_phone || b.driver_name) && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleSendWhatsApp(b)}>WhatsApp</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-dashboard-wrap">
      <header className="admin-dashboard-header">
        <button
          type="button"
          className="admin-dashboard-menu-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span className="admin-menu-toggle-bar" />
          <span className="admin-menu-toggle-bar" />
          <span className="admin-menu-toggle-bar" />
        </button>
        <h1>Admin</h1>
        <div className="admin-dashboard-header-actions">
          <span className="admin-header-user">{user?.username || 'Admin'}</span>
          <a href="/" className="admin-header-site-link">Site</a>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="admin-dashboard-body">
        <aside className={`admin-dashboard-sidebar ${sidebarOpen ? 'admin-dashboard-sidebar-open' : ''}`}>
          <div className="admin-sidebar-brand" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '1.1rem' }}>Namma Cabs</div>
            <div className="admin-sidebar-section-title" style={{ marginTop: 4 }}>ADMIN DASHBOARD</div>
            <div style={{ color: '#e4e8f4', fontSize: '0.9rem', marginTop: 8 }}>Welcome, {user?.username || 'admin'}</div>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={handleLogout}>Logout</button>
          </div>
          <div className="admin-sidebar-section">
            <div className="admin-sidebar-section-title">DASHBOARD</div>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.dashboard ? 'active' : ''}`} onClick={() => setTab(TABS.dashboard)}>
              <Icon name="chart" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Dashboard</span>
                <span className="admin-nav-btn-sublabel">Statistics & Insights</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.others ? 'active' : ''}`} onClick={() => setTab(TABS.others)}>
              <Icon name="user" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Others</span>
                <span className="admin-nav-btn-sublabel">Drivers & Cars</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.bookingForm ? 'active' : ''}`} onClick={() => setTab(TABS.bookingForm)}>
              <Icon name="plus" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Booking Form</span>
                <span className="admin-nav-btn-sublabel">New Booking</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.enquiries ? 'active' : ''}`} onClick={() => setTab(TABS.enquiries)}>
              <Icon name="document" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Enquiries</span>
                <span className="admin-nav-btn-sublabel">Received Bookings</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.confirmedBookings ? 'active' : ''}`} onClick={() => setTab(TABS.confirmedBookings)}>
              <Icon name="check" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Confirmed Bookings</span>
                <span className="admin-nav-btn-sublabel">Confirmed Only</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.driverAssigned ? 'active' : ''}`} onClick={() => setTab(TABS.driverAssigned)}>
              <Icon name="car" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Driver Assigned</span>
                <span className="admin-nav-btn-sublabel">With Driver Info</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.tripEnd ? 'active' : ''}`} onClick={() => setTab(TABS.tripEnd)}>
              <Icon name="star" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Trip End</span>
                <span className="admin-nav-btn-sublabel">Completed Trips</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.cancelledBookings ? 'active' : ''}`} onClick={() => setTab(TABS.cancelledBookings)}>
              <Icon name="close" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Cancelled Bookings</span>
                <span className="admin-nav-btn-sublabel">Cancelled Only</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.driverStatus ? 'active' : ''}`} onClick={() => setTab(TABS.driverStatus)}>
              <Icon name="clipboard" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Driver Status</span>
                <span className="admin-nav-btn-sublabel">Availability & Rides</span>
              </span>
            </button>
          </div>
          <div className="admin-sidebar-section">
            <div className="admin-sidebar-section-title">INVOICE</div>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.billing ? 'active' : ''}`} onClick={() => setTab(TABS.billing)}>
              <Icon name="wallet" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Invoice</span>
                <span className="admin-nav-btn-sublabel">Invoices & Reports</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.createInvoice ? 'active' : ''}`} onClick={() => setTab(TABS.createInvoice)}>
              <Icon name="document" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Create Invoice</span>
                <span className="admin-nav-btn-sublabel">Generate invoice directly</span>
              </span>
            </button>
          </div>
          <div className="admin-sidebar-section">
            <div className="admin-sidebar-section-title">RATE METER</div>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.rateMeter ? 'active' : ''}`} onClick={() => setTab(TABS.rateMeter)}>
              <Icon name="clipboard" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Rate Meter</span>
                <span className="admin-nav-btn-sublabel">Local, Airport, Outstation</span>
              </span>
            </button>
          </div>
          <div className="admin-sidebar-section">
            <div className="admin-sidebar-section-title">CORPORATE BOOKINGS</div>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.corporateBookings ? 'active' : ''}`} onClick={() => setTab(TABS.corporateBookings)}>
              <Icon name="building" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">All corporate bookings</span>
                <span className="admin-nav-btn-sublabel">View and manage</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.corporateInvoices ? 'active' : ''}`} onClick={() => setTab(TABS.corporateInvoices)}>
              <Icon name="clipboard" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">All corporate invoices</span>
                <span className="admin-nav-btn-sublabel">Download all</span>
              </span>
            </button>
            <button type="button" className={`admin-dashboard-nav-btn ${activeTab === TABS.createCorporateInvoice ? 'active' : ''}`} onClick={() => setTab(TABS.createCorporateInvoice)}>
              <Icon name="plus" size={20} className="admin-nav-btn-icon" />
              <span className="admin-nav-btn-content">
                <span className="admin-nav-btn-label">Create corporate invoice</span>
                <span className="admin-nav-btn-sublabel">New corporate invoice</span>
              </span>
            </button>
          </div>
        </aside>

        <main className="admin-dashboard-main">
          {activeTab === TABS.dashboard && (
            <div className="admin-dashboard-tab">
              {staleBookingsWarning && staleBookingsWarning.length > 0 && (
                <div className="admin-stale-warning-banner" role="alert">
                  <div className="admin-stale-warning-banner-header">
                    <Icon name="warning" size={24} className="admin-stale-warning-banner-icon" />
                    <h3 className="admin-stale-warning-banner-title">Booking status warning</h3>
                  </div>
                  <p className="admin-stale-warning-banner-text">
                    {staleBookingsWarning.length} booking{staleBookingsWarning.length !== 1 ? 's have' : ' has'} not been updated in more than 24 hours. Click a booking below to update its status.
                  </p>
                  <ul className="admin-stale-booking-list admin-stale-booking-list-inline">
                    {staleBookingsWarning.map((b) => (
                      <li
                        key={b.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailBooking(b)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailBooking(b); } }}
                        className="admin-stale-booking-item"
                      >
                        <span className="admin-stale-booking-id">#{b.id}</span>
                        {' '}
                        {b.from_location || '—'} → {b.to_location || '—'}
                        {' '}
                        <span className="admin-service-badge">{b.booking_status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="admin-dashboard-box">
                <h2 className="admin-dashboard-statistics-title">Dashboard Statistics</h2>
                <div className="admin-dashboard-statistics-line" />
                {loading.dashboard && <p className="admin-dashboard-list-loading">Loading…</p>}
                {!loading.dashboard && stats && (
                  <div className="admin-dashboard-stats-row">
                    <div className="admin-dashboard-box admin-dashboard-box-pie">
                      <h3 className="admin-dashboard-box-title">Status overview</h3>
                      {pieData.length > 0 ? (
                        <div className="admin-dashboard-pie-wrap admin-dashboard-pie-inner">
                          <div
                            className="admin-dashboard-pie-chart"
                            style={{
                              width: 200,
                              height: 200,
                              borderRadius: '50%',
                              background: `conic-gradient(${pieData.map((d, i) => {
                                const start = pieData.slice(0, i).reduce((s, x) => s + (x.value / pieTotal) * 360, 0);
                                const deg = (d.value / pieTotal) * 360;
                                return `${d.color} ${start}deg ${start + deg}deg`;
                              }).join(', ')})`,
                            }}
                          />
                          <div className="admin-dashboard-pie-legend">
                            {pieData.map((d) => (
                              <div key={d.label} className="admin-dashboard-pie-legend-item">
                                <span className="admin-dashboard-pie-legend-dot" style={{ background: d.color }} />
                                <span>{d.label}: {d.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="admin-dashboard-list-empty">No booking data yet.</p>
                      )}
                    </div>
                    <div className="admin-dashboard-box admin-dashboard-box-cards">
                      <h3 className="admin-dashboard-box-title">Counts</h3>
                      <div className="admin-stats-grid">
                        <div className="admin-stat-card admin-stat-card-animate">
                          <div className="label">Completed</div>
                          <div className="value">{stats.completed ?? 0}</div>
                        </div>
                        <div className="admin-stat-card admin-stat-card-animate">
                          <div className="label">Assigned</div>
                          <div className="value">{stats.assigned ?? 0}</div>
                        </div>
                        <div className="admin-stat-card admin-stat-card-animate">
                          <div className="label">Cancelled</div>
                          <div className="value">{stats.cancelled ?? 0}</div>
                        </div>
                        <div className="admin-stat-card admin-stat-card-animate">
                          <div className="label">Enquiries</div>
                          <div className="value">{stats.pending ?? 0}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-dashboard-box admin-dashboard-box-bookings">
                <h2 className="admin-dashboard-box-heading">All Bookings</h2>
                <p className="admin-dashboard-list-hint">Latest to oldest. View, assign driver, copy map link, or send via WhatsApp.</p>
                {loading.dashboard && <p className="admin-dashboard-list-loading">Loading…</p>}
                {!loading.dashboard && bookings.length === 0 && <p className="admin-dashboard-list-empty">No bookings yet.</p>}
                {!loading.dashboard && bookings.length > 0 && (
                  <div className="admin-entry-cards">
                    {bookings.map((b) => (
                      <div key={b.id} className="admin-entry-card">
                        <div className="admin-entry-card-header">
                          <span className="admin-entry-card-id">#{b.id}</span>
                          <span className="admin-service-badge">{b.booking_status}</span>
                        </div>
                        <div className="admin-entry-card-rows">
                          <div className="admin-entry-card-row"><span className="key">From</span><span className="value">{b.from_location || '—'}</span></div>
                          <div className="admin-entry-card-row"><span className="key">To</span><span className="value">{b.to_location || '—'}</span></div>
                          <div className="admin-entry-card-row"><span className="key">Passenger</span><span className="value">{b.passenger_name || '—'}</span></div>
                          <div className="admin-entry-card-row"><span className="key">Driver / Cab</span><span className="value">{b.driver_name ? `${b.driver_name} / ${b.vehicle_number || '—'}` : '—'}</span></div>
                        </div>
                        <div className="admin-entry-card-actions">
                          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setDetailBooking(b)}>View</button>
                          {b.booking_status === 'pending' && (
                            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')} disabled={statusUpdatingId === b.id}>
                              {statusUpdatingId === b.id ? '…' : 'Confirm'}
                            </button>
                          )}
                          {b.booking_status === 'confirmed' && (
                            <>
                              <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'completed')} disabled={statusUpdatingId === b.id}>
                                {statusUpdatingId === b.id ? '…' : 'Trip completed'}
                              </button>
                              <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')} disabled={statusUpdatingId === b.id}>
                                {statusUpdatingId === b.id ? '…' : 'Cancel'}
                              </button>
                            </>
                          )}
                          <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => { setAssignBooking(b); setAssignDriverId(''); setAssignCabId(b.cab_id || ''); }}>Assign</button>
                          {b.maps_link && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleCopyMapLink(b.maps_link)}>Copy pickup map</button>}
                          {b.maps_link_drop && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleCopyMapLink(b.maps_link_drop)}>Copy drop map</button>}
                          {(b.driver_phone || b.driver_name) && <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleSendWhatsApp(b)}>WhatsApp</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === TABS.enquiries && renderBookingsTable(enquiriesBookings, 'Enquiries', 'All received bookings, latest to oldest. View and assign driver & cab.')}
          {activeTab === TABS.confirmedBookings && renderBookingsTable(confirmedBookingsList, 'Confirmed Bookings', 'View and assign driver & cab.')}
          {activeTab === TABS.driverAssigned && renderBookingsTable(driverAssignedBookings, 'Driver Assigned', 'With driver info. View, copy map, WhatsApp.')}
          {activeTab === TABS.tripEnd && renderBookingsTable(tripEndBookings, 'Trip End', 'Completed trips.')}
          {activeTab === TABS.cancelledBookings && renderBookingsTable(cancelledBookingsList, 'Cancelled Bookings', 'Cancelled only.')}

          {activeTab === TABS.bookingForm && (
            <div className="admin-tab-section">
              <h2>Booking Form</h2>
              <p className="admin-bookings-desc">Create a new booking. Fields change by service type (Local / Airport / Outstation), similar to the invoice form.</p>
              <form onSubmit={handleCreateSubmit} className="admin-dashboard-box" style={{ maxWidth: 640, marginTop: 16 }}>
                <div className="admin-form-grid">
                  <div className="admin-form-group">
                    <label>Service type</label>
                    <select
                      value={createForm.service_type}
                      onChange={(e) => setCreateForm((f) => ({ ...f, service_type: e.target.value, outstation_trip_type: 'one_way', extra_stops: [] }))}
                    >
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  {createForm.service_type === 'outstation' && (
                    <div className="admin-form-group">
                      <label>Outstation trip type</label>
                      <select
                        value={createForm.outstation_trip_type}
                        onChange={(e) => setCreateForm((f) => ({ ...f, outstation_trip_type: e.target.value, extra_stops: [] }))}
                      >
                        <option value="one_way">One Way</option>
                        <option value="round_trip">Round Trip</option>
                        <option value="multiple_stops">Multiple Stops</option>
                      </select>
                    </div>
                  )}
                  {createForm.service_type === 'outstation' && createForm.outstation_trip_type === 'round_trip' ? (
                    <div className="admin-form-group full-width">
                      <label>Location (from &amp; to) *</label>
                      <LocationInput
                        placeholder="Round trip start and end"
                        value={fromLocation}
                        onSelect={(loc) => {
                          setFromLocation(loc);
                          setCreateForm((f) => ({ ...f, from_location: loc.address }));
                        }}
                      />
                    </div>
                  ) : createForm.service_type === 'outstation' && createForm.outstation_trip_type === 'multiple_stops' ? (
                    <>
                      <div className="admin-form-group full-width">
                        <label>From (A) *</label>
                        <LocationInput
                          placeholder="First stop"
                          value={fromLocation}
                          onSelect={(loc) => {
                            setFromLocation(loc);
                            setCreateForm((f) => ({ ...f, from_location: loc.address }));
                          }}
                        />
                      </div>
                      <div className="admin-form-group full-width">
                        <label>Stop 2 (B) – optional</label>
                        <LocationInput
                          placeholder="Second stop"
                          value={createForm.extra_stops?.[0] ?? ''}
                          onSelect={(loc) => setCreateForm((f) => ({
                            ...f,
                            extra_stops: [loc.address, ...(f.extra_stops || []).slice(1)],
                          }))}
                        />
                      </div>
                      {(createForm.extra_stops || []).slice(1).map((stop, idx) => (
                        <div key={idx} className="admin-form-group full-width" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <LocationInput
                              placeholder={`Stop ${idx + 3}`}
                              value={typeof stop === 'string' ? stop : (stop?.address ?? '')}
                              onSelect={(loc) => setCreateForm((f) => ({
                                ...f,
                                extra_stops: (f.extra_stops || []).map((s, i) => (i === idx + 1 ? loc.address : s)),
                              }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => setCreateForm((f) => ({ ...f, extra_stops: (f.extra_stops || []).filter((_, i) => i !== idx + 1) }))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="admin-form-group full-width">
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => setCreateForm((f) => ({ ...f, extra_stops: [...(f.extra_stops || []), ''] }))}
                        >
                          + Add stop
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="admin-form-group full-width">
                        <label>From location *</label>
                        <LocationInput
                          placeholder="Pickup address"
                          value={fromLocation}
                          onSelect={(loc) => {
                            setFromLocation(loc);
                            setCreateForm((f) => ({ ...f, from_location: loc.address }));
                          }}
                        />
                      </div>
                      <div className="admin-form-group full-width">
                        <label>{createForm.service_type === 'local' ? 'To (optional – defaults to Local package)' : 'To location *'}</label>
                        <LocationInput
                          placeholder={createForm.service_type === 'local' ? 'Leave blank for Local package' : 'Drop address'}
                          value={toLocation}
                          onSelect={(loc) => {
                            setToLocation(loc);
                            setCreateForm((f) => ({ ...f, to_location: loc.address }));
                          }}
                        />
                      </div>
                    </>
                  )}
                  <div className="admin-form-group">
                    <label>Passenger name *</label>
                    <input
                      type="text"
                      value={createForm.passenger_name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, passenger_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Passenger phone *</label>
                    <input
                      type="tel"
                      value={createForm.passenger_phone}
                      onChange={(e) => setCreateForm((f) => ({ ...f, passenger_phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Fare amount (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.fare_amount}
                      onChange={(e) => setCreateForm((f) => ({ ...f, fare_amount: e.target.value }))}
                      required
                    />
                  </div>
                  {createForm.service_type === 'local' && (
                    <div className="admin-form-group">
                      <label>Hours (optional)</label>
                      <input
                        type="number"
                        min="1"
                        value={createForm.number_of_hours}
                        onChange={(e) => setCreateForm((f) => ({ ...f, number_of_hours: e.target.value }))}
                        placeholder="4, 8, 12"
                      />
                    </div>
                  )}
                </div>
                <div className="admin-modal-actions" style={{ marginTop: 16 }}>
                  <button type="submit" className="admin-btn admin-btn-primary" disabled={createSubmitting}>
                    {createSubmitting ? 'Creating…' : 'Create booking'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === TABS.rateMeter && (
            <div className="admin-tab-section">
              <h2>Rate Meter</h2>
              <p className="admin-bookings-desc">Set fares and manage cabs for Local, Airport, and Outstation. Create missing cab types, then set rates and add cabs per type.</p>
              <input ref={cabImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCabImageSelect} aria-hidden="true" tabIndex={-1} />
              {rateMeterLoading.cabTypes && <p className="admin-dashboard-list-loading">Loading cab types…</p>}
              {!rateMeterLoading.cabTypes && (
                <>
                  {
}
                  <div className={`admin-rate-meters-block ${rateMeterOpenSection === 'local' ? 'open' : ''}`}>
                    <button type="button" className="admin-rate-meters-block-btn" onClick={() => setRateMeterOpenSection(rateMeterOpenSection === 'local' ? null : 'local')}>
                      <span>Local (4h / 8h / 12h packages + extra hour)</span>
                      <span className="admin-rate-meters-block-meta">Base + selected package + (extra hours × extra hour rate)</span>
                    </button>
                    {rateMeterOpenSection === 'local' && (
                      <div className="admin-rate-meters-block-body">
                        <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                          <button type="button" className="admin-btn admin-btn-primary" onClick={() => ensureRateMeterCabTypes('local')} disabled={rateMeterSaving}>Create missing cab types</button>
                        </div>
                        {(rateMeterCabTypes.local || []).map((ct) => (
                          <div key={ct.id} className="admin-rate-meters-card">
                            <button type="button" className="admin-form-block admin-form-block-title" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }} onClick={() => toggleRateMeterCabTypeExpand(ct.id, 'local')}>
                              {ct.name} {ct.cab_count != null ? `(${ct.cab_count} cab${Number(ct.cab_count) !== 1 ? 's' : ''})` : ''} {rateMeterExpandedId === ct.id ? '▼' : '▶'}
                            </button>
                            {rateMeterExpandedId === ct.id && (
                              <>
                                {rateMeterLoading.rates && <p className="admin-dashboard-list-loading">Loading rates…</p>}
                                {!rateMeterLoading.rates && (() => {
                                  const f = rateMeterLocalForm[ct.id] || {};
                                  return (
                                    <form onSubmit={(e) => { e.preventDefault(); saveRateMeterLocal(ct.id, f); }}>
                                      <div className="admin-form-grid" style={{ marginBottom: 12 }}>
                                        <div className="admin-form-group">
                                          <label>Base fare (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.base_fare} onChange={(e) => setRateMeterLocalForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], base_fare: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>4 hr package (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.package_4h} onChange={(e) => setRateMeterLocalForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], package_4h: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>8 hr package (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.package_8h} onChange={(e) => setRateMeterLocalForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], package_8h: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>12 hr package (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.package_12h} onChange={(e) => setRateMeterLocalForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], package_12h: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>Extra hour rate (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.extra_hour_rate} onChange={(e) => setRateMeterLocalForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], extra_hour_rate: e.target.value } }))} />
                                        </div>
                                      </div>
                                      <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                                        <button type="submit" className="admin-btn admin-btn-primary" disabled={rateMeterSaving}>Save local rates</button>
                                        <button type="button" className="admin-btn admin-btn-primary" onClick={() => openRateMeterCabModal(ct.id)}>Add cab</button>
                                      </div>
                                    </form>
                                  );
                                })()}
                                {rateMeterLoading.cabs && <p className="admin-dashboard-list-loading">Loading cabs…</p>}
                                <div className="admin-form-block">
                                  <div className="admin-form-block-title">Cabs</div>
                                  {(rateMeterCabsByType[ct.id] || []).length === 0 && !rateMeterLoading.cabs && <p className="admin-rate-meters-empty">No cabs. Add one above.</p>}
                                  {(rateMeterCabsByType[ct.id] || []).map((cab) => {
                                    const cabImageUrl = cab.image_url ? getImageUrl(cab.image_url) : null;
                                    return (
                                      <div key={cab.id} className="admin-cab-row">
                                        <div className="admin-cab-row-image-wrap">
                                          {cabImageUrl ? (
                                            <img src={cabImageUrl} alt={cab.vehicle_number || 'Cab'} className="admin-cab-row-image" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.add('visible'); }} />
                                          ) : null}
                                          <div className={`admin-cab-row-image-placeholder ${!cabImageUrl ? 'visible' : ''}`}><Icon name="car" size={24} /></div>
                                        </div>
                                        <div className="admin-cab-row-details">
                                          <span className="admin-cab-row-vehicle">{cab.vehicle_number}</span>
                                          {cab.name && <span className="admin-cab-row-name">{cab.name}</span>}
                                          {cab.driver_name && <span className="admin-cab-row-driver">Driver: {cab.driver_name}</span>}
                                          {cab.driver_phone && <span className="admin-cab-row-phone">{cab.driver_phone}</span>}
                                        </div>
                                        <div className="admin-cab-row-actions">
                                          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => triggerCabImageUpload(cab.id, ct.id)} disabled={uploadingCabId === cab.id}>{uploadingCabId === cab.id ? 'Uploading…' : 'Upload image'}</button>
                                          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteRateMeterCab(ct.id, cab.id)}>Remove</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {(rateMeterCabTypes.local || []).length === 0 && <p className="admin-rate-meters-empty">Click “Create missing cab types” to add Innova Crysta, SUV, Sedan.</p>}
                      </div>
                    )}
                  </div>

                  {
}
                  <div className={`admin-rate-meters-block ${rateMeterOpenSection === 'airport' ? 'open' : ''}`}>
                    <button type="button" className="admin-rate-meters-block-btn" onClick={() => setRateMeterOpenSection(rateMeterOpenSection === 'airport' ? null : 'airport')}>
                      <span>Airport (distance × per km + base + driver + night)</span>
                      <span className="admin-rate-meters-block-meta">(Distance × per km) + base fare + driver charges + night charges</span>
                    </button>
                    {rateMeterOpenSection === 'airport' && (
                      <div className="admin-rate-meters-block-body">
                        <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                          <button type="button" className="admin-btn admin-btn-primary" onClick={() => ensureRateMeterCabTypes('airport')} disabled={rateMeterSaving}>Create missing cab types</button>
                        </div>
                        {(rateMeterCabTypes.airport || []).map((ct) => (
                          <div key={ct.id} className="admin-rate-meters-card">
                            <button type="button" className="admin-form-block admin-form-block-title" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }} onClick={() => toggleRateMeterCabTypeExpand(ct.id, 'airport')}>
                              {ct.name} {ct.cab_count != null ? `(${ct.cab_count} cab${Number(ct.cab_count) !== 1 ? 's' : ''})` : ''} {rateMeterExpandedId === ct.id ? '▼' : '▶'}
                            </button>
                            {rateMeterExpandedId === ct.id && (
                              <>
                                {rateMeterLoading.rates && <p className="admin-dashboard-list-loading">Loading rates…</p>}
                                {!rateMeterLoading.rates && (() => {
                                  const f = rateMeterAirportForm[ct.id] || {};
                                  return (
                                    <form onSubmit={(e) => { e.preventDefault(); saveRateMeterAirport(ct.id, f); }}>
                                      <div className="admin-form-grid" style={{ marginBottom: 12 }}>
                                        <div className="admin-form-group">
                                          <label>Base fare (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.base_fare} onChange={(e) => setRateMeterAirportForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], base_fare: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>Per km rate (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.per_km_rate} onChange={(e) => setRateMeterAirportForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], per_km_rate: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>Driver charges (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.driver_charges} onChange={(e) => setRateMeterAirportForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], driver_charges: e.target.value } }))} />
                                        </div>
                                        <div className="admin-form-group">
                                          <label>Night charges (₹)</label>
                                          <input type="number" min="0" step="0.01" value={f.night_charges} onChange={(e) => setRateMeterAirportForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], night_charges: e.target.value } }))} />
                                        </div>
                                      </div>
                                      <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                                        <button type="submit" className="admin-btn admin-btn-primary" disabled={rateMeterSaving}>Save airport rates</button>
                                        <button type="button" className="admin-btn admin-btn-primary" onClick={() => openRateMeterCabModal(ct.id)}>Add cab</button>
                                      </div>
                                    </form>
                                  );
                                })()}
                                <div className="admin-form-block">
                                  <div className="admin-form-block-title">Cabs</div>
                                  {(rateMeterCabsByType[ct.id] || []).length === 0 && !rateMeterLoading.cabs && <p className="admin-rate-meters-empty">No cabs. Add one above.</p>}
                                  {(rateMeterCabsByType[ct.id] || []).map((cab) => {
                                    const cabImageUrl = cab.image_url ? getImageUrl(cab.image_url) : null;
                                    return (
                                      <div key={cab.id} className="admin-cab-row">
                                        <div className="admin-cab-row-image-wrap">
                                          {cabImageUrl ? (
                                            <img src={cabImageUrl} alt={cab.vehicle_number || 'Cab'} className="admin-cab-row-image" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.add('visible'); }} />
                                          ) : null}
                                          <div className={`admin-cab-row-image-placeholder ${!cabImageUrl ? 'visible' : ''}`}><Icon name="car" size={24} /></div>
                                        </div>
                                        <div className="admin-cab-row-details">
                                          <span className="admin-cab-row-vehicle">{cab.vehicle_number}</span>
                                          {cab.name && <span className="admin-cab-row-name">{cab.name}</span>}
                                          {cab.driver_name && <span className="admin-cab-row-driver">Driver: {cab.driver_name}</span>}
                                          {cab.driver_phone && <span className="admin-cab-row-phone">{cab.driver_phone}</span>}
                                        </div>
                                        <div className="admin-cab-row-actions">
                                          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => triggerCabImageUpload(cab.id, ct.id)} disabled={uploadingCabId === cab.id}>{uploadingCabId === cab.id ? 'Uploading…' : 'Upload image'}</button>
                                          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteRateMeterCab(ct.id, cab.id)}>Remove</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {(rateMeterCabTypes.airport || []).length === 0 && <p className="admin-rate-meters-empty">Click “Create missing cab types” to add Innova, Crysta, SUV, Sedan.</p>}
                      </div>
                    )}
                  </div>

                  {
}
                  <div className={`admin-rate-meters-block ${rateMeterOpenSection === 'outstation' ? 'open' : ''}`}>
                    <button type="button" className="admin-rate-meters-block-btn" onClick={() => setRateMeterOpenSection(rateMeterOpenSection === 'outstation' ? null : 'outstation')}>
                      <span>Outstation (one way / round trip / multiple stops)</span>
                      <span className="admin-rate-meters-block-meta">One way, round trip, and multiple stops rates per cab type</span>
                    </button>
                    {rateMeterOpenSection === 'outstation' && (
                      <div className="admin-rate-meters-block-body">
                        <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                          <button type="button" className="admin-btn admin-btn-primary" onClick={() => ensureRateMeterCabTypes('outstation')} disabled={rateMeterSaving}>Create missing cab types</button>
                        </div>
                        {(rateMeterCabTypes.outstation || []).map((ct) => (
                          <div key={ct.id} className="admin-rate-meters-card">
                            <button type="button" className="admin-form-block admin-form-block-title" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }} onClick={() => toggleRateMeterCabTypeExpand(ct.id, 'outstation')}>
                              {ct.name} {ct.cab_count != null ? `(${ct.cab_count} cab${Number(ct.cab_count) !== 1 ? 's' : ''})` : ''} {rateMeterExpandedId === ct.id ? '▼' : '▶'}
                            </button>
                            {rateMeterExpandedId === ct.id && (
                              <>
                                {rateMeterLoading.rates && <p className="admin-dashboard-list-loading">Loading rates…</p>}
                                {!rateMeterLoading.rates && (() => {
                                  const f = rateMeterOutstationForm[ct.id] || {};
                                  const ow = f.oneWay || {};
                                  const rt = f.roundTrip || {};
                                  const ms = f.multipleStops || {};
                                  return (
                                    <form onSubmit={(e) => {
                                      e.preventDefault();
                                      saveRateMeterOutstation(ct.id, { oneWay: ow, roundTrip: rt, multipleStops: ms });
                                    }}>
                                      <div className="admin-form-block" style={{ marginBottom: 12 }}>
                                        <div className="admin-form-block-title">One way</div>
                                        <div className="admin-form-grid">
                                          <div className="admin-form-group"><label>Min km</label><input type="number" min="0" value={ow.minKm} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], oneWay: { ...prev[ct.id]?.oneWay, minKm: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Base fare (₹)</label><input type="number" min="0" step="0.01" value={ow.baseFare} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], oneWay: { ...prev[ct.id]?.oneWay, baseFare: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Extra km rate (₹)</label><input type="number" min="0" step="0.01" value={ow.extraKmRate} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], oneWay: { ...prev[ct.id]?.oneWay, extraKmRate: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Driver charges (₹)</label><input type="number" min="0" step="0.01" value={ow.driverCharges} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], oneWay: { ...prev[ct.id]?.oneWay, driverCharges: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Night charges (₹)</label><input type="number" min="0" step="0.01" value={ow.nightCharges} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], oneWay: { ...prev[ct.id]?.oneWay, nightCharges: e.target.value } } }))} /></div>
                                        </div>
                                      </div>
                                      <div className="admin-form-block" style={{ marginBottom: 12 }}>
                                        <div className="admin-form-block-title">Round trip</div>
                                        <div className="admin-form-grid">
                                          <div className="admin-form-group"><label>Base km/day</label><input type="number" min="0" value={rt.baseKmPerDay} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], roundTrip: { ...prev[ct.id]?.roundTrip, baseKmPerDay: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Per km rate (₹)</label><input type="number" min="0" step="0.01" value={rt.perKmRate} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], roundTrip: { ...prev[ct.id]?.roundTrip, perKmRate: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Extra km rate (₹)</label><input type="number" min="0" step="0.01" value={rt.extraKmRate} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], roundTrip: { ...prev[ct.id]?.roundTrip, extraKmRate: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Driver charges (₹)</label><input type="number" min="0" step="0.01" value={rt.driverCharges} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], roundTrip: { ...prev[ct.id]?.roundTrip, driverCharges: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Night charges (₹)</label><input type="number" min="0" step="0.01" value={rt.nightCharges} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], roundTrip: { ...prev[ct.id]?.roundTrip, nightCharges: e.target.value } } }))} /></div>
                                        </div>
                                      </div>
                                      <div className="admin-form-block" style={{ marginBottom: 12 }}>
                                        <div className="admin-form-block-title">Multiple stops</div>
                                        <div className="admin-form-grid">
                                          <div className="admin-form-group"><label>Base fare (₹)</label><input type="number" min="0" step="0.01" value={ms.baseFare} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], multipleStops: { ...prev[ct.id]?.multipleStops, baseFare: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Per km rate (₹)</label><input type="number" min="0" step="0.01" value={ms.perKmRate} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], multipleStops: { ...prev[ct.id]?.multipleStops, perKmRate: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Driver charges (₹)</label><input type="number" min="0" step="0.01" value={ms.driverCharges} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], multipleStops: { ...prev[ct.id]?.multipleStops, driverCharges: e.target.value } } }))} /></div>
                                          <div className="admin-form-group"><label>Night charges (₹)</label><input type="number" min="0" step="0.01" value={ms.nightCharges} onChange={(e) => setRateMeterOutstationForm((prev) => ({ ...prev, [ct.id]: { ...prev[ct.id], multipleStops: { ...prev[ct.id]?.multipleStops, nightCharges: e.target.value } } }))} /></div>
                                        </div>
                                      </div>
                                      <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                                        <button type="submit" className="admin-btn admin-btn-primary" disabled={rateMeterSaving}>Save outstation rates</button>
                                        <button type="button" className="admin-btn admin-btn-primary" onClick={() => openRateMeterCabModal(ct.id)}>Add cab</button>
                                      </div>
                                    </form>
                                  );
                                })()}
                                <div className="admin-form-block">
                                  <div className="admin-form-block-title">Cabs</div>
                                  {(rateMeterCabsByType[ct.id] || []).length === 0 && !rateMeterLoading.cabs && <p className="admin-rate-meters-empty">No cabs. Add one above.</p>}
                                  {(rateMeterCabsByType[ct.id] || []).map((cab) => {
                                    const cabImageUrl = cab.image_url ? getImageUrl(cab.image_url) : null;
                                    return (
                                      <div key={cab.id} className="admin-cab-row">
                                        <div className="admin-cab-row-image-wrap">
                                          {cabImageUrl ? (
                                            <img src={cabImageUrl} alt={cab.vehicle_number || 'Cab'} className="admin-cab-row-image" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.add('visible'); }} />
                                          ) : null}
                                          <div className={`admin-cab-row-image-placeholder ${!cabImageUrl ? 'visible' : ''}`}><Icon name="car" size={24} /></div>
                                        </div>
                                        <div className="admin-cab-row-details">
                                          <span className="admin-cab-row-vehicle">{cab.vehicle_number}</span>
                                          {cab.name && <span className="admin-cab-row-name">{cab.name}</span>}
                                          {cab.driver_name && <span className="admin-cab-row-driver">Driver: {cab.driver_name}</span>}
                                          {cab.driver_phone && <span className="admin-cab-row-phone">{cab.driver_phone}</span>}
                                        </div>
                                        <div className="admin-cab-row-actions">
                                          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => triggerCabImageUpload(cab.id, ct.id)} disabled={uploadingCabId === cab.id}>{uploadingCabId === cab.id ? 'Uploading…' : 'Upload image'}</button>
                                          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteRateMeterCab(ct.id, cab.id)}>Remove</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {(rateMeterCabTypes.outstation || []).length === 0 && <p className="admin-rate-meters-empty">Click “Create missing cab types” to add Innova, Crysta, SUV, Sedan, TT, Minibus.</p>}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === TABS.driverStatus && (
            <div className="admin-tab-section">
              <h2>Driver Status</h2>
              <p className="admin-bookings-desc">Availability & rides – list and manage drivers.</p>
              <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => { setDriverModal({}); setDriverForm({ name: '', phone: '', license_number: '', emergency_contact_name: '', emergency_contact_phone: '' }); }}>Add driver</button>
              </div>
              {loading.drivers && <p className="admin-dashboard-list-loading">Loading…</p>}
              {!loading.drivers && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>License</th>
                        <th>Emergency</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d) => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          <td>{d.phone}</td>
                          <td>{d.license_number || '—'}</td>
                          <td>{d.emergency_contact_name || '—'}</td>
                          <td className="actions">
                            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setDriverModal(d); setDriverForm({ name: d.name, phone: d.phone, license_number: d.license_number || '', emergency_contact_name: d.emergency_contact_name || '', emergency_contact_phone: d.emergency_contact_phone || '' }); }}>Edit</button>
                            <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDeleteDriver(d.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === TABS.others && (
            <div className="admin-tab-section">
              <h2>Others – Drivers & Cabs</h2>
              <p className="admin-bookings-desc">This is the only source for drivers and cabs. Add them here; they appear in Rate Meter and booking assignment.</p>

              {
}
              <div className="admin-rate-meters-block open" style={{ marginTop: 24 }}>
                <button type="button" className="admin-rate-meters-block-btn" style={{ pointerEvents: 'none' }}>
                  <span>Register drivers</span>
                  <span className="admin-rate-meters-block-meta">Add and manage drivers</span>
                </button>
                <div className="admin-rate-meters-block-body">
                  <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                    <button type="button" className="admin-btn admin-btn-primary" onClick={() => { setDriverModal({}); setDriverForm({ name: '', phone: '', license_number: '', emergency_contact_name: '', emergency_contact_phone: '' }); }}>Add driver</button>
                  </div>
                  {loading.drivers && <p className="admin-dashboard-list-loading">Loading drivers…</p>}
                  {!loading.drivers && (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>License</th>
                            <th>Emergency</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(drivers || []).length === 0 && (
                            <tr><td colSpan={5} className="admin-dashboard-list-empty">No drivers yet. Click “Add driver” to register.</td></tr>
                          )}
                          {(drivers || []).map((d) => (
                            <tr key={d.id}>
                              <td>{d.name}</td>
                              <td>{d.phone}</td>
                              <td>{d.license_number || '—'}</td>
                              <td>{d.emergency_contact_name || '—'}</td>
                              <td className="actions">
                                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setDriverModal(d); setDriverForm({ name: d.name, phone: d.phone, license_number: d.license_number || '', emergency_contact_name: d.emergency_contact_name || '', emergency_contact_phone: d.emergency_contact_phone || '' }); }}>Edit</button>
                                <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDeleteDriver(d.id)}>Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {
}
              <div className="admin-rate-meters-block admin-others-col open">
                <button type="button" className="admin-rate-meters-block-btn" style={{ pointerEvents: 'none' }}>
                  <span>Add cabs</span>
                  <span className="admin-rate-meters-block-meta">Add and manage cabs; assign driver and cab type</span>
                </button>
                <div className="admin-rate-meters-block-body">
                  <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                    <button type="button" className="admin-btn admin-btn-primary" onClick={() => { setOthersEditingCabId(null); setOthersAddCabModalOpen(true); setOthersAddCabForm({ cab_type_id: '', name: '', vehicle_number: '', driver_id: '' }); }}>Add cab</button>
                  </div>
                  {loading.drivers && <p className="admin-dashboard-list-loading">Loading cabs…</p>}
                  {!loading.drivers && (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Vehicle number</th>
                            <th>Driver</th>
                            <th>Cab type</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cabs || []).length === 0 && (
                            <tr><td colSpan={4} className="admin-dashboard-list-empty">No cabs yet. Click "Add cab" and enter vehicle number and cab type (driver is optional).</td></tr>
                          )}
                          {(cabs || []).map((c) => (
                            <tr key={c.id}>
                              <td>{c.name?.trim() || c.vehicle_number}</td>
                              <td>{c.driver_name || '—'} {c.driver_phone ? `(${c.driver_phone})` : ''}</td>
                              <td>{c.cab_type_name || '—'}{c.cab_type_service_type ? ` (${(c.cab_type_service_type || '').charAt(0).toUpperCase() + (c.cab_type_service_type || '').slice(1).toLowerCase()})` : ''}</td>
                              <td className="actions">
                                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setOthersEditingCabId(c.id); setOthersAddCabForm({ cab_type_id: String(c.cab_type_id || ''), name: c.name || '', vehicle_number: c.vehicle_number || '', driver_id: String((drivers || []).find((d) => d.phone === c.driver_phone || d.name === c.driver_name)?.id || '') }); setOthersAddCabModalOpen(true); }}>Edit</button>
                                <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteOthersCab(c.id)}>Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

      {othersAddCabModalOpen && (
        <div className="admin-modal-overlay" onClick={() => { setOthersAddCabModalOpen(false); setOthersEditingCabId(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{othersEditingCabId ? 'Edit cab' : 'Add cab'}</h3>
              <button type="button" className="admin-modal-close" onClick={() => { setOthersAddCabModalOpen(false); setOthersEditingCabId(null); }} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleOthersAddCabSubmit} className="admin-modal-body">
              <div className="admin-form-grid">
                <div className="admin-form-group full-width">
                  <label>Cab type</label>
                  <select
                    value={othersAddCabForm.cab_type_id}
                    onChange={(e) => setOthersAddCabForm((f) => ({ ...f, cab_type_id: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 6 }}
                  >
                    <option value="">— Select cab type —</option>
                    {othersCabTypesLoading && <option disabled>Loading…</option>}
                    {othersCabTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.service_type} – {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Car name</label>
                  <input type="text" value={othersAddCabForm.name} onChange={(e) => setOthersAddCabForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Swift Dzire" />
                </div>
                <div className="admin-form-group">
                  <label>Vehicle number</label>
                  <input type="text" value={othersAddCabForm.vehicle_number} onChange={(e) => setOthersAddCabForm((f) => ({ ...f, vehicle_number: e.target.value }))} required />
                </div>
                <div className="admin-form-group full-width">
                  <label>Driver (optional)</label>
                  <select
                    value={othersAddCabForm.driver_id}
                    onChange={(e) => setOthersAddCabForm((f) => ({ ...f, driver_id: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 6 }}
                  >
                    <option value="">— Select driver (optional) —</option>
                    {(drivers || []).map((d) => (
                      <option key={d.id} value={d.id}>{d.name} {d.phone ? `— ${d.phone}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setOthersAddCabModalOpen(false)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={othersAddCabSubmitting}>{othersAddCabSubmitting ? (othersEditingCabId ? 'Saving…' : 'Adding…') : (othersEditingCabId ? 'Save' : 'Add cab')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

          {activeTab === TABS.billing && (
            <div className="admin-tab-section admin-dashboard-box">
              <h2 className="admin-dashboard-box-heading">Billing – Confirmed bookings</h2>
              <p className="admin-bookings-desc">View confirmed bookings and download invoices (with or without GST).</p>
              {loading.bookings && <p className="admin-dashboard-list-loading">Loading…</p>}
              {!loading.bookings && confirmedBookingsList.length === 0 && <p className="admin-dashboard-list-empty">No confirmed bookings.</p>}
              {!loading.bookings && confirmedBookingsList.length > 0 && (
                <div className="admin-entry-cards">
                  {confirmedBookingsList.map((b) => (
                    <div key={b.id} className="admin-entry-card">
                      <div className="admin-entry-card-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="admin-entry-card-id">#{b.id}</span>
                          <span className="admin-entry-card-invoice">Inv: {b.invoice_number || `#${b.id}`}</span>
                        </span>
                        <span className="admin-service-badge">{b.booking_status}</span>
                      </div>
                      <div className="admin-entry-card-rows">
                        <div className="admin-entry-card-row"><span className="key">From</span><span className="value">{b.from_location || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">To</span><span className="value">{b.to_location || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Passenger</span><span className="value">{b.passenger_name || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Driver / Cab</span><span className="value">{b.driver_name ? `${b.driver_name} / ${b.vehicle_number || '—'}` : '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Fare</span><span className="value">₹{b.fare_amount != null ? Number(b.fare_amount).toFixed(2) : '—'}</span></div>
                      </div>
                      <div className="admin-entry-card-actions">
                        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setDetailBooking(b)}>View</button>
                        {b.booking_status === 'confirmed' && (
                          <>
                            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'completed')} disabled={statusUpdatingId === b.id}>
                              {statusUpdatingId === b.id ? '…' : 'Trip completed'}
                            </button>
                            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')} disabled={statusUpdatingId === b.id}>
                              {statusUpdatingId === b.id ? '…' : 'Cancel'}
                            </button>
                          </>
                        )}
                        <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleBookingInvoiceDownload(b.id, true)}>Download (with GST)</button>
                        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleBookingInvoiceDownload(b.id, false)}>Download (without GST)</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TABS.createInvoice && (
            <div className="admin-tab-section">
              <h2>Create Invoice</h2>
              <p className="admin-bookings-desc">Generate an invoice directly. A booking record is created and the PDF is downloaded. Service type affects how the invoice is labelled (Local / Airport / Outstation).</p>
              <form onSubmit={handleCreateInvoiceSubmit} className="admin-dashboard-box" style={{ maxWidth: 640, marginTop: 16 }}>
                <div className="admin-form-grid">
                  {
}
                  {invoiceForm.service_type === 'outstation' && invoiceForm.outstation_trip_type === 'round_trip' ? (
                    <div className="admin-form-group full-width">
                      <label>Location (from & to) *</label>
                      <LocationInput
                        placeholder="Round trip start and end"
                        value={invoiceFromLocation}
                        onSelect={(loc) => {
                          setInvoiceFromLocation(loc);
                          setInvoiceForm((f) => ({ ...f, from_location: loc.address }));
                        }}
                      />
                    </div>
                  ) : invoiceForm.service_type === 'outstation' && invoiceForm.outstation_trip_type === 'multiple_stops' ? (
                    <>
                      <div className="admin-form-group full-width">
                        <label>From (A) *</label>
                        <LocationInput
                          placeholder="First stop"
                          value={invoiceFromLocation}
                          onSelect={(loc) => {
                            setInvoiceFromLocation(loc);
                            setInvoiceForm((f) => ({ ...f, from_location: loc.address }));
                          }}
                        />
                      </div>
                      <div className="admin-form-group full-width">
                        <label>Stop 2 (B) – optional</label>
                        <LocationInput
                          placeholder="Second stop"
                          value={invoiceForm.extra_stops?.[0] ?? ''}
                          onSelect={(loc) => setInvoiceForm((f) => ({
                            ...f,
                            extra_stops: [loc.address, ...(f.extra_stops || []).slice(1)],
                          }))}
                        />
                      </div>
                      {(invoiceForm.extra_stops || []).slice(1).map((stop, idx) => (
                        <div key={idx} className="admin-form-group full-width" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <LocationInput
                              placeholder={`Stop ${idx + 3}`}
                              value={typeof stop === 'string' ? stop : (stop?.address ?? '')}
                              onSelect={(loc) => setInvoiceForm((f) => ({
                                ...f,
                                extra_stops: (f.extra_stops || []).map((s, i) => (i === idx + 1 ? loc.address : s)),
                              }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            onClick={() => setInvoiceForm((f) => ({ ...f, extra_stops: (f.extra_stops || []).filter((_, i) => i !== idx + 1) }))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="admin-form-group full-width">
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          onClick={() => setInvoiceForm((f) => ({ ...f, extra_stops: [...(f.extra_stops || []), ''] }))}
                        >
                          + Add stop
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="admin-form-group full-width">
                        <label>From location *</label>
                        <LocationInput
                          placeholder="Pickup address"
                          value={invoiceFromLocation}
                          onSelect={(loc) => {
                            setInvoiceFromLocation(loc);
                            setInvoiceForm((f) => ({ ...f, from_location: loc.address }));
                          }}
                        />
                      </div>
                      <div className="admin-form-group full-width">
                        <label>To location *</label>
                        <LocationInput
                          placeholder="Drop address"
                          value={invoiceToLocation}
                          onSelect={(loc) => {
                            setInvoiceToLocation(loc);
                            setInvoiceForm((f) => ({ ...f, to_location: loc.address }));
                          }}
                        />
                      </div>
                    </>
                  )}
                  <div className="admin-form-group">
                    <label>Passenger name *</label>
                    <input
                      type="text"
                      value={invoiceForm.passenger_name}
                      onChange={(e) => setInvoiceForm((f) => ({ ...f, passenger_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Passenger phone *</label>
                    <input
                      type="tel"
                      value={invoiceForm.passenger_phone}
                      onChange={(e) => setInvoiceForm((f) => ({ ...f, passenger_phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Passenger email (optional)</label>
                    <input
                      type="email"
                      value={invoiceForm.passenger_email}
                      onChange={(e) => setInvoiceForm((f) => ({ ...f, passenger_email: e.target.value }))}
                      placeholder="For invoice copy"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Fare amount (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceForm.fare_amount}
                      onChange={(e) => setInvoiceForm((f) => ({ ...f, fare_amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Service type</label>
                    <select
                      value={invoiceForm.service_type}
                      onChange={(e) => setInvoiceForm((f) => ({ ...f, service_type: e.target.value }))}
                    >
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  {invoiceForm.service_type === 'outstation' && (
                    <div className="admin-form-group">
                      <label>Outstation trip type</label>
                      <select
                        value={invoiceForm.outstation_trip_type}
                        onChange={(e) => setInvoiceForm((f) => ({ ...f, outstation_trip_type: e.target.value }))}
                      >
                        <option value="one_way">One Way</option>
                        <option value="round_trip">Round Trip</option>
                        <option value="multiple_stops">Multiple Stops</option>
                      </select>
                    </div>
                  )}
                  {invoiceForm.service_type === 'local' && (
                    <div className="admin-form-group">
                      <label>Hours (optional)</label>
                      <input
                        type="number"
                        min="1"
                        value={invoiceForm.number_of_hours}
                        onChange={(e) => setInvoiceForm((f) => ({ ...f, number_of_hours: e.target.value }))}
                        placeholder="e.g. 4"
                      />
                    </div>
                  )}
                  <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="invoice-with-gst"
                      checked={invoiceForm.with_gst}
                      onChange={(e) => setInvoiceForm((f) => ({ ...f, with_gst: e.target.checked }))}
                    />
                    <label htmlFor="invoice-with-gst" style={{ marginBottom: 0 }}>Invoice with GST</label>
                  </div>
                </div>
                <div className="admin-modal-actions" style={{ marginTop: 16 }}>
                  <button type="submit" className="admin-btn admin-btn-primary" disabled={invoiceSubmitting}>
                    {invoiceSubmitting ? 'Creating…' : 'Create invoice & download PDF'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === TABS.corporateBookings && (
            <div className="admin-tab-section">
              <h2>All corporate bookings</h2>
              <p className="admin-bookings-desc">Corporate booking requests and assignments.</p>
              {corporateBookingsLoading && <p className="admin-dashboard-list-loading">Loading…</p>}
              {!corporateBookingsLoading && corporateBookings.length === 0 && <p className="admin-dashboard-list-empty">No corporate bookings yet.</p>}
              {!corporateBookingsLoading && corporateBookings.length > 0 && (
                <div className="admin-entry-cards">
                  {corporateBookings.map((b) => (
                    <div key={b.id} className="admin-entry-card">
                      <div className="admin-entry-card-header">
                        <span className="admin-entry-card-id">#{b.id}</span>
                        <span className="admin-entry-card-invoice">
                          {corporateEditingInvoiceId === b.id ? (
                            <>
                              <input
                                type="text"
                                className="admin-inline-invoice-input"
                                value={corporateEditingInvoiceValue}
                                onChange={(e) => setCorporateEditingInvoiceValue(e.target.value)}
                                placeholder="crpYYYYMMDD0001"
                              />
                              <button type="button" className="admin-btn admin-btn-sm" onClick={() => handleSaveCorporateInvoiceNumber(b)} disabled={corporateInvoiceNumberSaving}>
                                {corporateInvoiceNumberSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button type="button" className="admin-btn admin-btn-sm" onClick={() => { setCorporateEditingInvoiceId(null); setCorporateEditingInvoiceValue(''); }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              Inv: {b.invoice_number || `#${b.id}`}
                              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginLeft: 6 }} onClick={() => { setCorporateEditingInvoiceId(b.id); setCorporateEditingInvoiceValue(b.invoice_number || ''); }} title="Edit invoice number">Edit</button>
                            </>
                          )}
                        </span>
                        <span className="admin-service-badge">{b.service_type || '—'}</span>
                        <span className="admin-service-badge">{b.status}</span>
                      </div>
                      <div className="admin-entry-card-rows">
                        <div className="admin-entry-card-row"><span className="key">Company</span><span className="value">{b.company_name || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Name</span><span className="value">{b.name || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Phone</span><span className="value">{b.phone_number || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Pickup</span><span className="value">{b.pickup_point || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Drop</span><span className="value">{b.drop_point || '—'}</span></div>
                      </div>
                      <div className="admin-entry-card-actions">
                        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleOpenCorporateEdit(b)}>Edit booking</button>
                        <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleCorporateInvoiceDownload(b.id)}>Download invoice</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TABS.corporateInvoices && (
            <div className="admin-tab-section">
              <h2>All corporate invoices</h2>
              <p className="admin-bookings-desc">Download individual invoices or all as a ZIP.</p>
              <div className="admin-modal-actions" style={{ marginBottom: 16 }}>
                <button type="button" className="admin-btn admin-btn-primary" onClick={handleCorporateDownloadAll} disabled={corporateDownloadAllLoading || corporateBookings.length === 0}>
                  {corporateDownloadAllLoading ? 'Preparing…' : 'Download all invoices (ZIP)'}
                </button>
              </div>
              {corporateBookingsLoading && <p className="admin-dashboard-list-loading">Loading…</p>}
              {!corporateBookingsLoading && corporateBookings.length === 0 && <p className="admin-dashboard-list-empty">No corporate bookings. Create one in Create corporate invoice.</p>}
              {!corporateBookingsLoading && corporateBookings.length > 0 && (
                <div className="admin-entry-cards">
                  {corporateBookings.map((b) => (
                    <div key={b.id} className="admin-entry-card">
                      <div className="admin-entry-card-header">
                        <span className="admin-entry-card-id">#{b.id}</span>
                        <span className="admin-entry-card-invoice">
                          {corporateEditingInvoiceId === b.id ? (
                            <>
                              <input
                                type="text"
                                className="admin-inline-invoice-input"
                                value={corporateEditingInvoiceValue}
                                onChange={(e) => setCorporateEditingInvoiceValue(e.target.value)}
                                placeholder="crpYYYYMMDD0001"
                              />
                              <button type="button" className="admin-btn admin-btn-sm" onClick={() => handleSaveCorporateInvoiceNumber(b)} disabled={corporateInvoiceNumberSaving}>
                                {corporateInvoiceNumberSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button type="button" className="admin-btn admin-btn-sm" onClick={() => { setCorporateEditingInvoiceId(null); setCorporateEditingInvoiceValue(''); }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              Inv: {b.invoice_number || `#${b.id}`}
                              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginLeft: 6 }} onClick={() => { setCorporateEditingInvoiceId(b.id); setCorporateEditingInvoiceValue(b.invoice_number || ''); }} title="Edit invoice number">Edit</button>
                            </>
                          )}
                        </span>
                        <span className="value">{b.fare_amount != null ? `₹${Number(b.fare_amount).toFixed(2)}` : '—'}</span>
                      </div>
                      <div className="admin-entry-card-rows">
                        <div className="admin-entry-card-row"><span className="key">Company</span><span className="value">{b.company_name || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Name</span><span className="value">{b.name || '—'}</span></div>
                        <div className="admin-entry-card-row"><span className="key">Trip</span><span className="value">{b.pickup_point || '—'} → {b.drop_point || '—'}</span></div>
                      </div>
                      <div className="admin-entry-card-actions">
                        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleOpenCorporateEdit(b)}>Edit booking</button>
                        <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleCorporateInvoiceDownload(b.id)}>Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === TABS.createCorporateInvoice && (
            <div className="admin-tab-section">
              <h2>Create corporate invoice</h2>
              <p className="admin-bookings-desc">Create a corporate booking and download its invoice PDF.</p>
              <form onSubmit={handleCreateCorporateInvoiceSubmit} className="admin-dashboard-box" style={{ maxWidth: 640, marginTop: 16 }}>
                <div className="admin-form-grid">
                  <div className="admin-form-group full-width">
                    <label>Company name *</label>
                    <input type="text" value={corporateInvoiceForm.company_name} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, company_name: e.target.value }))} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Contact name *</label>
                    <input type="text" value={corporateInvoiceForm.name} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Phone *</label>
                    <input type="tel" value={corporateInvoiceForm.phone_number} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, phone_number: e.target.value }))} required />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Pickup point *</label>
                    <input type="text" value={corporateInvoiceForm.pickup_point} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, pickup_point: e.target.value }))} placeholder="Pickup address" required />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Drop point *</label>
                    <input type="text" value={corporateInvoiceForm.drop_point} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, drop_point: e.target.value }))} placeholder="Drop address" required />
                  </div>
                  <div className="admin-form-group">
                    <label>Service type</label>
                    <select value={corporateInvoiceForm.service_type} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, service_type: e.target.value }))}>
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  <div className="admin-form-group">
                    <label>Fare amount (₹) *</label>
                    <input type="number" min="0" step="0.01" value={corporateInvoiceForm.fare_amount} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, fare_amount: e.target.value }))} required />
                  </div>
                  <div className="admin-form-group">
                    <label>Travel date (optional)</label>
                    <input type="date" value={corporateInvoiceForm.travel_date} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, travel_date: e.target.value }))} />
                  </div>
                  <div className="admin-form-group">
                    <label>Travel time (optional)</label>
                    <input type="text" value={corporateInvoiceForm.travel_time} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, travel_time: e.target.value }))} placeholder="e.g. 09:00" />
                  </div>
                  <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="corp-invoice-gst" checked={corporateInvoiceForm.with_gst} onChange={(e) => setCorporateInvoiceForm((f) => ({ ...f, with_gst: e.target.checked }))} />
                    <label htmlFor="corp-invoice-gst" style={{ marginBottom: 0 }}>Invoice with GST</label>
                  </div>
                </div>
                <div className="admin-modal-actions" style={{ marginTop: 16 }}>
                  <button type="submit" className="admin-btn admin-btn-primary" disabled={corporateInvoiceSubmitting}>
                    {corporateInvoiceSubmitting ? 'Creating…' : 'Create corporate invoice & download PDF'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {sidebarOpen && <div className="admin-dashboard-sidebar-overlay" onClick={() => setSidebarOpen(false)} role="presentation" />}

      {detailBooking && (
        <div className="admin-modal-overlay admin-booking-detail-overlay" onClick={() => setDetailBooking(null)}>
          <div className="admin-modal admin-booking-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header admin-booking-detail-header">
              <h3>Booking #{detailBooking.id}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setDetailBooking(null)} aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body admin-booking-detail-body">
              <div className="admin-detail-row admin-detail-row-editable">
                <span className="key">Invoice number</span>
                <span className="value" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="admin-input admin-input-sm"
                    value={editingInvoiceNumber}
                    onChange={(e) => setEditingInvoiceNumber(e.target.value)}
                    placeholder="e.g. 202602070001"
                    style={{ width: 160 }}
                  />
                  <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleSaveInvoiceNumber} disabled={invoiceNumberSaving}>
                    {invoiceNumberSaving ? 'Saving…' : 'Save'}
                  </button>
                </span>
              </div>
              <div className="admin-detail-row"><span className="key">From</span><span className="value">{detailBooking.from_location}</span></div>
              <div className="admin-detail-row"><span className="key">To</span><span className="value">{detailBooking.to_location}</span></div>
              <div className="admin-detail-row"><span className="key">Passenger</span><span className="value">{detailBooking.passenger_name} / {detailBooking.passenger_phone}</span></div>
              <div className="admin-detail-row"><span className="key">Service type</span><span className="value">{detailBooking.service_type === 'local' ? 'Local' : detailBooking.service_type === 'airport' ? 'Airport' : detailBooking.service_type === 'outstation' ? 'Outstation' : detailBooking.service_type || '—'}</span></div>
              {detailBooking.service_type === 'local' && detailBooking.number_of_hours != null && (
                <div className="admin-detail-row"><span className="key">Hour package</span><span className="value">{detailBooking.number_of_hours} {Number(detailBooking.number_of_hours) === 1 ? 'hour' : 'hours'}</span></div>
              )}
              {detailBooking.service_type === 'outstation' && detailBooking.trip_type && (
                <div className="admin-detail-row"><span className="key">Trip type</span><span className="value">{detailBooking.trip_type === 'one_way' ? 'One Way' : detailBooking.trip_type === 'round_trip' ? 'Round Trip' : detailBooking.trip_type === 'multiple_stops' ? 'Multiple Stops' : detailBooking.trip_type}</span></div>
              )}
              {(detailBooking.cab_type_name || detailBooking.cab_type_id) && (
                <div className="admin-detail-row"><span className="key">Cab type</span><span className="value">{detailBooking.cab_type_name || '—'}</span></div>
              )}
              {detailBooking.booking_date && (
                <div className="admin-detail-row"><span className="key">Booking date</span><span className="value">{new Date(detailBooking.booking_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
              )}
              <div className="admin-detail-row"><span className="key">Status</span><span className="value">{detailBooking.booking_status}</span></div>
              <div className="admin-detail-row"><span className="key">Fare</span><span className="value">₹{detailBooking.fare_amount}</span></div>
              <div className="admin-detail-row"><span className="key">Driver / Cab</span><span className="value">{detailBooking.driver_name || '—'} / {detailBooking.vehicle_number || '—'}</span></div>
              <div className="admin-detail-row admin-detail-row-actions" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb', gap: 8, flexWrap: 'wrap' }}>
                <span className="key" style={{ width: '100%', marginBottom: 4 }}>Update status</span>
                <span className="value" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {detailBooking.booking_status === 'pending' && (
                    <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(detailBooking.id, 'confirmed')} disabled={statusUpdatingId === detailBooking.id}>
                      {statusUpdatingId === detailBooking.id ? 'Updating…' : 'Confirm'}
                    </button>
                  )}
                  {detailBooking.booking_status === 'confirmed' && (
                    <>
                      <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(detailBooking.id, 'completed')} disabled={statusUpdatingId === detailBooking.id}>
                        {statusUpdatingId === detailBooking.id ? 'Updating…' : 'Trip completed'}
                      </button>
                      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleUpdateBookingStatus(detailBooking.id, 'cancelled')} disabled={statusUpdatingId === detailBooking.id}>
                        Cancel
                      </button>
                    </>
                  )}
                  {detailBooking.booking_status === 'in_progress' && (
                    <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleUpdateBookingStatus(detailBooking.id, 'completed')} disabled={statusUpdatingId === detailBooking.id}>
                      {statusUpdatingId === detailBooking.id ? 'Updating…' : 'Trip completed'}
                    </button>
                  )}
                  {!['pending', 'confirmed', 'in_progress'].includes(detailBooking.booking_status) && (
                    <span style={{ color: '#6b7280', fontSize: 14 }}>No action (status: {detailBooking.booking_status})</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {corporateEditBooking && (
        <div className="admin-modal-overlay" onClick={() => setCorporateEditBooking(null)}>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="admin-modal-header">
              <h3>Edit corporate booking #{corporateEditBooking.id}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setCorporateEditBooking(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSaveCorporateEdit} className="admin-modal-body">
              <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="admin-form-group full-width">
                  <label>Company name</label>
                  <input type="text" name="company_name" value={corporateEditForm.company_name} onChange={handleCorporateEditFormChange} />
                </div>
                <div className="admin-form-group">
                  <label>Contact name</label>
                  <input type="text" name="name" value={corporateEditForm.name} onChange={handleCorporateEditFormChange} />
                </div>
                <div className="admin-form-group">
                  <label>Phone</label>
                  <input type="tel" name="phone_number" value={corporateEditForm.phone_number} onChange={handleCorporateEditFormChange} />
                </div>
                <div className="admin-form-group full-width">
                  <label>Pickup point</label>
                  <input type="text" name="pickup_point" value={corporateEditForm.pickup_point} onChange={handleCorporateEditFormChange} />
                </div>
                <div className="admin-form-group full-width">
                  <label>Drop point</label>
                  <input type="text" name="drop_point" value={corporateEditForm.drop_point} onChange={handleCorporateEditFormChange} />
                </div>
                <div className="admin-form-group">
                  <label>Service type</label>
                  <select name="service_type" value={corporateEditForm.service_type} onChange={handleCorporateEditFormChange}>
                    <option value="local">Local</option>
                    <option value="airport">Airport</option>
                    <option value="outstation">Outstation</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Travel date</label>
                  <input type="date" name="travel_date" value={corporateEditForm.travel_date} onChange={handleCorporateEditFormChange} />
                </div>
                <div className="admin-form-group">
                  <label>Travel time</label>
                  <input type="text" name="travel_time" value={corporateEditForm.travel_time} onChange={handleCorporateEditFormChange} placeholder="e.g. 09:00 AM" />
                </div>
                <div className="admin-form-group">
                  <label>Fare amount (₹)</label>
                  <input type="number" name="fare_amount" value={corporateEditForm.fare_amount} onChange={handleCorporateEditFormChange} min="0" step="0.01" placeholder="0" />
                </div>
                <div className="admin-form-group">
                  <label>Status</label>
                  <select name="status" value={corporateEditForm.status} onChange={handleCorporateEditFormChange}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="admin-form-group full-width">
                  <label>Notes</label>
                  <textarea name="notes" value={corporateEditForm.notes} onChange={handleCorporateEditFormChange} rows={3} placeholder="Optional notes" />
                </div>
              </div>
              <div className="admin-modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setCorporateEditBooking(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={corporateEditSaving}>{corporateEditSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignBooking && (
        <div className="admin-modal-overlay" onClick={() => { setAssignBooking(null); setAssignDriverId(''); setAssignCabId(''); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Assign driver & cab</h3>
              <button type="button" className="admin-modal-close" onClick={() => { setAssignBooking(null); setAssignDriverId(''); setAssignCabId(''); }} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleAssignSubmit} className="admin-modal-body">
              <p>Booking #{assignBooking.id}: {assignBooking.from_location} → {assignBooking.to_location}</p>
              <div className="admin-form-group">
                <label>Driver</label>
                <select
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                >
                  <option value="">Any driver</option>
                  {(drivers || []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name} {d.phone ? `(${d.phone})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group">
                <label>Cab</label>
                <select
                  value={assignCabId}
                  onChange={(e) => setAssignCabId(e.target.value)}
                  required
                >
                  <option value="">Select cab</option>
                  {assignModalCabs.map((c) => (
                    <option key={c.id} value={c.id}>{c.vehicle_number} {c.driver_name ? `(${c.driver_name})` : ''}</option>
                  ))}
                </select>
                {false && assignDriverId && assignModalCabs.length === 0 && (
                  <p className="admin-dashboard-list-loading" style={{ marginTop: 6 }}>No cab assigned to this driver. Select “Any driver” or assign a cab to this driver in Others.</p>
                )}
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => { setAssignBooking(null); setAssignDriverId(''); setAssignCabId(''); }}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={assignSubmitting || !assignCabId}>{assignSubmitting ? 'Assigning…' : 'Assign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rateMeterCabModal.open && (
        <div className="admin-modal-overlay" onClick={closeRateMeterCabModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Add cab</h3>
              <button type="button" className="admin-modal-close" onClick={closeRateMeterCabModal} aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body" style={{ marginBottom: 12 }}>
              <div className="admin-form-group" style={{ marginBottom: 16 }}>
                <span style={{ marginRight: 12 }}>
                  <button type="button" className={`admin-btn admin-btn-sm ${rateMeterAddCabMode === 'assign' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setRateMeterAddCabMode('assign')}>Assign existing cab</button>
                </span>
                <span>
                  <button type="button" className={`admin-btn admin-btn-sm ${rateMeterAddCabMode === 'create' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setRateMeterAddCabMode('create')}>Create new cab</button>
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                {rateMeterAddCabMode === 'assign' ? 'Choose a cab already in the database to show under this type (moves it from its current type).' : 'Add a new cab for this type only. Other types are unchanged.'}
              </p>
            </div>
            <form onSubmit={handleRateMeterCabSubmit} className="admin-modal-body">
              {rateMeterAddCabMode === 'assign' && (
                <>
                  {rateMeterModalOptionsLoading && <p className="admin-dashboard-list-loading" style={{ marginBottom: 12 }}>Loading cabs…</p>}
                  {!rateMeterModalOptionsLoading && (
                    <div className="admin-form-group" style={{ marginBottom: 16 }}>
                      <label>Select car</label>
                      <select
                        value={rateMeterSelectedCabId}
                        onChange={(e) => setRateMeterSelectedCabId(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 6 }}
                        required={rateMeterAddCabMode === 'assign'}
                      >
                        <option value="">
                          {rateMeterModalCabs.length === 0 ? 'No cabs in database. Add cabs in Others or create new below.' : '— Choose a car —'}
                        </option>
                        {rateMeterModalCabs.map((c) => (
                          <option key={String(c.id)} value={String(c.id)}>
                            {(c.name || c.vehicle_number || '').trim() || '—'} {c.driver_name ? ` (${c.driver_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              {rateMeterAddCabMode === 'create' && (
                <div className="admin-form-grid" style={{ marginBottom: 16 }}>
                  <div className="admin-form-group">
                    <label>Vehicle number *</label>
                    <input type="text" value={rateMeterNewCabForm.vehicle_number} onChange={(e) => setRateMeterNewCabForm((f) => ({ ...f, vehicle_number: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 6 }} required={rateMeterAddCabMode === 'create'} />
                  </div>
                  <div className="admin-form-group">
                    <label>Name (optional)</label>
                    <input type="text" value={rateMeterNewCabForm.name} onChange={(e) => setRateMeterNewCabForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Ertiga" style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 6 }} />
                  </div>
                  <div className="admin-form-group full-width">
                    <label>Driver (optional)</label>
                    <select value={rateMeterNewCabForm.driver_id} onChange={(e) => setRateMeterNewCabForm((f) => ({ ...f, driver_id: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                      <option value="">— Select driver (optional) —</option>
                      {(drivers || []).map((d) => (
                        <option key={d.id} value={d.id}>{d.name} {d.phone ? ` — ${d.phone}` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeRateMeterCabModal}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={rateMeterSaving || (rateMeterAddCabMode === 'assign' && !rateMeterSelectedCabId) || (rateMeterAddCabMode === 'create' && !rateMeterNewCabForm.vehicle_number?.trim())}>
                  {rateMeterSaving ? (rateMeterAddCabMode === 'create' ? 'Adding…' : 'Assigning…') : (rateMeterAddCabMode === 'create' ? 'Add cab' : 'Assign')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {driverModal && (
        <div className="admin-modal-overlay" onClick={() => setDriverModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>{driverModal.id ? 'Edit driver' : 'Add driver'}</h3>
              <button type="button" className="admin-modal-close" onClick={() => setDriverModal(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleDriverSubmit} className="admin-modal-body">
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label>Name</label>
                  <input type="text" value={driverForm.name} onChange={(e) => setDriverForm((f) => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="admin-form-group">
                  <label>Phone</label>
                  <input type="tel" value={driverForm.phone} onChange={(e) => setDriverForm((f) => ({ ...f, phone: e.target.value }))} required />
                </div>
                <div className="admin-form-group">
                  <label>License number</label>
                  <input type="text" value={driverForm.license_number} onChange={(e) => setDriverForm((f) => ({ ...f, license_number: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label>Emergency contact name</label>
                  <input type="text" value={driverForm.emergency_contact_name} onChange={(e) => setDriverForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
                </div>
                <div className="admin-form-group">
                  <label>Emergency contact phone</label>
                  <input type="tel" value={driverForm.emergency_contact_phone} onChange={(e) => setDriverForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} />
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setDriverModal(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={driverSubmitting}>{driverSubmitting ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-notification-toast ${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
