import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { getImageUrl } from '../services/api';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import LocationInput from '../components/LocationInput';
import './AdminDashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  
  // Helper function to check if user has access to a section
  const hasAccess = (sectionKey, requireEdit = false) => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admins have full access
    if (user.role !== 'manager') return false;
    
    const permissions = user.permissions || [];
    const perm = permissions.find(p => p.section_key === sectionKey);
    if (!perm) return false;
    
    // Handle both boolean and integer (1/0) values from backend
    const canView = perm.can_view === true || perm.can_view === 1 || perm.can_view === '1';
    const canEdit = perm.can_edit === true || perm.can_edit === 1 || perm.can_edit === '1';
    
    if (requireEdit) {
      return canEdit && canView; // Edit requires view permission
    }
    return canView;
  };

  // Helper function to map tab names to section keys for permission checking
  const getSectionKeyForTab = (tab) => {
    const tabToSectionKey = {
      'corporate-all': 'event-bookings',
      'corporate-assign': 'event-bookings',
      'corporate-export': 'bills-invoices',
      'dashboard': 'dashboard',
      'enquiries': 'enquiries',
      'confirmed-bookings': 'confirmed-bookings',
      'driver-assigned': 'driver-assigned',
      'trip-end': 'trip-end',
      'cancelled-bookings': 'cancelled-bookings',
      'create-booking': 'create-booking',
      'car-availability': 'car-availability',
      'rate-meters': 'rate-meters',
      'cab-types': 'cab-types',
      'car-options': 'car-options',
      'cabs': 'cabs',
      'drivers': 'drivers',
      'event-bookings': 'event-bookings',
      'bills-invoices': 'bills-invoices'
    };
    return tabToSectionKey[tab] || tab;
  };
  
  // Helper function to format date and time in Indian timezone (IST)
  const formatIndianDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Helper function to format time only in Indian timezone (IST)
  const formatIndianTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Update activeTab when user loads and doesn't have access to current tab
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        // Admins can access everything, ensure dashboard is set
        if (activeTab === 'dashboard' || hasAccess(activeTab)) {
          return; // Current tab is fine
        }
      } else if (user.role === 'manager') {
        // Check if current tab is accessible
        if (!hasAccess(activeTab)) {
          // Find first accessible tab
          const accessibleTabs = [
            'dashboard', 'enquiries', 'confirmed-bookings', 'driver-assigned',
            'trip-end', 'cancelled-bookings', 'create-booking', 'car-availability',
            'rate-meters', 'cab-types', 'car-options', 'cabs', 'drivers',
            'event-bookings', 'bills-invoices'
          ];
          const permissions = user.permissions || [];
          for (const tab of accessibleTabs) {
            const tabPerm = permissions.find(p => p.section_key === tab);
            const canView = tabPerm && (tabPerm.can_view === true || tabPerm.can_view === 1 || tabPerm.can_view === '1');
            if (canView) {
              setActiveTab(tab);
              break;
            }
          }
        }
      }
    }
  }, [user]); // Only depend on user, not activeTab to avoid loops
  const [rateMeterSubsection, setRateMeterSubsection] = useState('rate-meters'); // Subsection within rate-meters: 'rate-meters', 'cab-types', 'car-options', 'cabs'
  const [stats, setStats] = useState(null);
  const [cabTypes, setCabTypes] = useState([]);
  const [cabs, setCabs] = useState([]);
  const [carOptions, setCarOptions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingFilters, setBookingFilters] = useState({
    status: 'all',
    serviceType: 'all',
    cabType: 'all',
    search: '',
    fromDate: '',
    toDate: '',
  });
  const [billsFilter, setBillsFilter] = useState('all'); // 'all', 'bookings', 'corporate', 'invoices'
  const [invoices, setInvoices] = useState([]);
  const [invoiceFormData, setInvoiceFormData] = useState({
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    company_gstin: '29AHYPC7622F1ZZ',
    hsn_sac: '996411',
    customer_name: '',
    customer_address: '',
    customer_phone: '',
    customer_email: '',
    customer_state: '',
    customer_gst: '',
    service_description: '',
    sl_no: '1',
    total_kms: '0',
    no_of_days: '-',
    rate_details: '',
    service_amount: '0',
    toll_tax: '0',
    state_tax: '0',
    driver_batta: '0',
    parking_charges: '0',
    placard_charges: '0',
    extras: '0',
    with_gst: false
  });
  const [corporateFilter, setCorporateFilter] = useState('all'); // 'all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  const [eventFilter, setEventFilter] = useState('all'); // 'all', 'weddings', 'birthdays', 'others'
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [carOptionImageFiles, setCarOptionImageFiles] = useState([]);
  const [cabTypeCars, setCabTypeCars] = useState({}); // { cabTypeId: { subtype: [cars] } }
  const [expandedCabTypes, setExpandedCabTypes] = useState({}); // { cabTypeId: true/false }
  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [selectedCabTypeForCar, setSelectedCabTypeForCar] = useState(null);
  const [availableCars, setAvailableCars] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [rateMeters, setRateMeters] = useState([]);
  const [rateMeterCategories, setRateMeterCategories] = useState([]);
  const [expandedServiceTypes, setExpandedServiceTypes] = useState({});
  const [drivers, setDrivers] = useState([]);
  const [corporateBookings, setCorporateBookings] = useState([]);
  const [eventBookings, setEventBookings] = useState([]);
  const [assignSelections, setAssignSelections] = useState({});
  const [eventAssignSelections, setEventAssignSelections] = useState({});
  const [driverPhotoFile, setDriverPhotoFile] = useState(null);
  const [reassigning, setReassigning] = useState({});
  const [carFormData, setCarFormData] = useState({ vehicle_number: '', cab_type_id: '', driver_id: '', driver_name: '', driver_phone: '' });
  const [adminFormData, setAdminFormData] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'admin' });
  const [managerPermissions, setManagerPermissions] = useState({});
  
  // Available dashboard sections for manager permissions
  const dashboardSections = [
    { key: 'dashboard', label: 'Dashboard', description: 'View dashboard statistics' },
    { key: 'enquiries', label: 'Enquiries', description: 'View and manage received bookings' },
    { key: 'confirmed-bookings', label: 'Confirmed Bookings', description: 'View and manage confirmed bookings' },
    { key: 'driver-assigned', label: 'Driver Assigned', description: 'View bookings with assigned drivers' },
    { key: 'trip-end', label: 'Trip End', description: 'View completed trips' },
    { key: 'cancelled-bookings', label: 'Cancelled Bookings', description: 'View cancelled bookings' },
    { key: 'create-booking', label: 'Create Booking', description: 'Create new bookings manually' },
    // Car Availability and standalone Cab Types / Car Options / Cabs sections have been removed from manager permissions
    { key: 'rate-meters', label: 'Rate Meters', description: 'Manage rate meters, cab types and pricing' },
    { key: 'drivers', label: 'Drivers', description: 'Manage drivers' },
    { key: 'event-bookings', label: 'Event Bookings', description: 'Manage event bookings' },
    { key: 'bills-invoices', label: 'Bills & Invoices', description: 'View and generate invoices' },
  ];
  const [recentBookings, setRecentBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [receiptWithGST, setReceiptWithGST] = useState(true);

  // Safety: prevent "stuck overlay" issues by closing mobile overlay when resizing to desktop
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Global escape-to-close for any open overlay/modal
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setSidebarOpen(false);
      setShowBookingModal(false);
      setShowAddCarModal(false);
      setShowForm(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  
  // Create Booking state
  const [newBooking, setNewBooking] = useState({
    service_type: '',
    trip_type: '',
    from_location: '',
    to_location: '',
    passenger_name: '',
    passenger_phone: '',
    passenger_email: '',
    travel_date: '',
    pickup_time: '',
    number_of_hours: '',
    number_of_days: '',
    cab_type_id: '',
    category: '',
    notes: '',
    fare_amount: '',
  });

  // Multiple way trip stops - store as location objects
  const [multipleWayStops, setMultipleWayStops] = useState({
    pickup: null,
    stopA: null,
    stopB: null,
    drop: null,
    additionalStops: [], // Array of location objects
  });
  
  // User location for LocationInput autocomplete
  const [userLocation, setUserLocation] = useState(null);
  
  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Silently fail if user denies location
        }
      );
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  // Real-time stats polling for dashboard
  useEffect(() => {
    if (activeTab === 'dashboard') {
      const interval = setInterval(() => {
        fetchDashboardData(false); // Don't show loading on polling updates
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Ensure to_location is set to KIA when service_type is airport
  useEffect(() => {
    if (newBooking.service_type === 'airport' && newBooking.to_location !== 'Kempegowda International Airport Bangalore') {
      setNewBooking(prev => ({
        ...prev,
        to_location: 'Kempegowda International Airport Bangalore'
      }));
    }
  }, [newBooking.service_type, newBooking.to_location]);

  // Initialize event booking assignments when event bookings are loaded
  useEffect(() => {
    if (activeTab === 'event-bookings' && eventBookings.length > 0) {
      setEventAssignSelections(prev => {
        const newSelections = { ...prev };
        eventBookings.forEach(eb => {
          const numCars = eb.number_of_cars || 1;
          const existingAssignments = eb.assignments || [];
          if (!newSelections[eb.id] || !newSelections[eb.id].assignments || newSelections[eb.id].assignments.length !== numCars) {
            const initAssignments = Array(numCars).fill(null).map((_, idx) => {
              const existing = existingAssignments[idx];
              return existing ? { cab_id: existing.cab_id || null, driver_id: existing.driver_id || null } : { cab_id: null, driver_id: null };
            });
            newSelections[eb.id] = { assignments: initAssignments };
          }
        });
        return newSelections;
      });
    }
  }, [eventBookings, activeTab]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchDashboardData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const [statsResponse, bookingsResponse] = await Promise.all([
          api.get('/admin/dashboard/stats'),
          api.get('/admin/bookings?limit=10')
        ]);
        setStats(statsResponse.data);
        // Sort bookings by most recent first
        const sortedBookings = bookingsResponse.data.sort((a, b) => 
          new Date(b.booking_date) - new Date(a.booking_date)
        );
        setRecentBookings(sortedBookings);
      } else if (activeTab === 'rate-meters') {
        // Load all fleet management data when rate-meters is active
        const [ratesRes, carsRes, cabTypesRes, cabsRes, driversRes] = await Promise.all([
          api.get('/admin/rate-meters'),
          api.get('/admin/car-options'),
          api.get('/admin/cab-types'),
          api.get('/admin/cabs'),
          api.get('/admin/drivers'),
        ]);
        
        // Set rate meters data
        setRateMeters(ratesRes.data);
        const allCars = carsRes.data || [];
        // Only consider cars that are assigned to a cab type
        const assignedCars = allCars.filter(car => car.cab_type_id);
        const categoriesSet = new Set();
        assignedCars.forEach(car => {
          // Use the car name as the category, so rate meters are per car (not per subtype)
          const cat = car.name;
          if (cat) categoriesSet.add(cat);
        });
        setRateMeterCategories(Array.from(categoriesSet));
        
        // Set cab types data
        setCabTypes(cabTypesRes.data);
        // Fetch cars for each cab type
        const carsData = {};
        for (const cabType of cabTypesRes.data) {
          try {
            const carsResponse = await api.get(`/admin/cab-types/${cabType.id}/cars`);
            carsData[cabType.id] = carsResponse.data;
          } catch (error) {
            console.error(`Error fetching cars for cab type ${cabType.id}:`, error);
            carsData[cabType.id] = {};
          }
        }
        setCabTypeCars(carsData);
        setAvailableCars(allCars);
        
        // Set car options data
        setCarOptions(allCars);
        
        // Set cabs data
        setCabs(cabsRes.data);
        setDrivers(driversRes.data || []);
      } else if (activeTab === 'cab-types') {
        const response = await api.get('/admin/cab-types');
        setCabTypes(response.data);
        // Fetch cars for each cab type
        const carsData = {};
        for (const cabType of response.data) {
          try {
            const carsResponse = await api.get(`/admin/cab-types/${cabType.id}/cars`);
            carsData[cabType.id] = carsResponse.data;
          } catch (error) {
            console.error(`Error fetching cars for cab type ${cabType.id}:`, error);
            carsData[cabType.id] = {};
          }
        }
        setCabTypeCars(carsData);
        // Also fetch all cars (including inactive) for the add car modal
        const allCarsResponse = await api.get('/admin/car-options');
        setAvailableCars(allCarsResponse.data || []);
      } else if (activeTab === 'cabs') {
        const [cabsRes, driversRes, carsRes] = await Promise.all([
          api.get('/admin/cabs'),
          api.get('/admin/drivers'),
          api.get('/admin/car-options'),
        ]);
        setCabs(cabsRes.data);
        setDrivers(driversRes.data || []);
        setAvailableCars(carsRes.data || []);
      } else if (activeTab === 'bookings') {
        const [bookingsRes, cabTypesRes] = await Promise.all([
          api.get('/admin/bookings'),
          api.get('/admin/cab-types'),
        ]);
        setBookings(bookingsRes.data);
        setCabTypes(cabTypesRes.data);
      } else if (activeTab === 'enquiries' || activeTab === 'confirmed-bookings' || 
                 activeTab === 'driver-assigned' || activeTab === 'trip-end' || 
                 activeTab === 'cancelled-bookings') {
        if (activeTab === 'confirmed-bookings') {
          const [bookingsRes, driversRes, cabsRes] = await Promise.all([
            api.get('/admin/bookings'),
            api.get('/admin/drivers'),
            api.get('/admin/cabs')
          ]);
          setBookings(bookingsRes.data);
          setDrivers(driversRes.data || []);
          setCabs(cabsRes.data || []);
        } else if (activeTab === 'enquiries') {
          const fetchPromises = [api.get('/admin/bookings')];
          // Only fetch corporate bookings if user has permission
          if (user?.role === 'admin' || hasAccess('event-bookings')) {
            fetchPromises.push(api.get('/admin/corporate-bookings').catch(err => {
              // If permission denied, return empty array
              if (err.response?.status === 403) {
                return { data: [] };
              }
              throw err;
            }));
          } else {
            fetchPromises.push(Promise.resolve({ data: [] }));
          }
          const [bookingsRes, corporateRes] = await Promise.all(fetchPromises);
          setBookings(bookingsRes.data);
          setCorporateBookings(corporateRes.data || []);
        } else {
          const response = await api.get('/admin/bookings');
          setBookings(response.data);
        }
      } else if (activeTab === 'driver-status') {
        const [driversRes, bookingsRes] = await Promise.all([
          api.get('/admin/drivers'),
          api.get('/admin/bookings')
        ]);
        setDrivers(driversRes.data || []);
        setBookings(bookingsRes.data || []);
      } else if (activeTab === 'bills-invoices') {
        const fetchPromises = [api.get('/admin/bookings')];
        // Only fetch corporate bookings and invoices if user has permission
        if (user?.role === 'admin' || hasAccess('bills-invoices')) {
          fetchPromises.push(api.get('/admin/corporate-bookings').catch(err => {
            // If permission denied, return empty array
            if (err.response?.status === 403) {
              console.warn('No permission to view corporate bookings');
              return { data: [] };
            }
            throw err;
          }));
          fetchPromises.push(api.get('/admin/invoices').catch(err => {
            if (err.response?.status === 403) {
              return { data: [] };
            }
            throw err;
          }));
        } else {
          fetchPromises.push(Promise.resolve({ data: [] }));
          fetchPromises.push(Promise.resolve({ data: [] }));
        }
        const results = await Promise.all(fetchPromises);
        const [bookingsRes, corporateRes, invoicesRes] = results;
        setBookings(bookingsRes.data);
        setCorporateBookings(corporateRes?.data || []);
        setInvoices(invoicesRes?.data || []);
      } else if (activeTab === 'car-options') {
        const response = await api.get('/admin/car-options');
        setCarOptions(response.data);
      } else if (activeTab === 'drivers') {
        const [driversRes, cabTypesRes] = await Promise.all([
          api.get('/admin/drivers'),
          api.get('/admin/cab-types'),
        ]);
        setDrivers(driversRes.data);
        setCabTypes(cabTypesRes.data);
      } else if (activeTab === 'car-availability') {
        const [cabsRes, cabTypesRes] = await Promise.all([
          api.get('/admin/cabs'),
          api.get('/admin/cab-types'),
        ]);
        setCabs(cabsRes.data);
        setCabTypes(cabTypesRes.data);
        
        // Set up polling for real-time updates every 5 seconds
        const interval = setInterval(async () => {
          try {
            const cabsUpdate = await api.get('/admin/cabs');
            setCabs(cabsUpdate.data);
          } catch (error) {
            console.error('Error updating car availability:', error);
          }
        }, 5000);
        
        return () => clearInterval(interval);
      } else if (activeTab === 'corporate-all' || activeTab === 'corporate-assign' || activeTab === 'corporate-export') {
        if (activeTab === 'corporate-export') {
          // No need to fetch data for export page
        } else {
          // Only fetch if user has permission (already checked in render, but double-check here)
          if (user?.role === 'admin' || hasAccess('event-bookings')) {
            const [bookingsRes, driversRes, cabsRes] = await Promise.all([
              api.get('/admin/corporate-bookings').catch(err => {
                if (err.response?.status === 403) {
                  return { data: [] };
                }
                throw err;
              }),
              api.get('/admin/drivers'),
              api.get('/admin/cabs'),
            ]);
            setCorporateBookings(bookingsRes.data || []);
            setDrivers(driversRes.data || []);
            setCabs(cabsRes.data || []);
          } else {
            setCorporateBookings([]);
            setDrivers([]);
            setCabs([]);
          }
        }
      } else if (activeTab === 'event-bookings') {
        const [bookingsRes, driversRes, cabsRes] = await Promise.all([
          api.get('/events/bookings'),
          api.get('/admin/drivers'),
          api.get('/admin/cabs'),
        ]);
        setEventBookings(bookingsRes.data || []);
        setDrivers(driversRes.data || []);
        setCabs(cabsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (showLoading) {
        alert('Error fetching data');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await api.delete(`/admin/${type}/${id}`);
      fetchDashboardData();
      alert('Deleted successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting item');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Determine the actual tab to use (subsection if rate-meters, otherwise activeTab)
      const actualTab = activeTab === 'rate-meters' ? rateMeterSubsection : activeTab;

      if (actualTab === 'drivers') {
        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) data.append(key, value);
        });
        if (driverPhotoFile) data.append('photo', driverPhotoFile);

        if (editingItem) {
          await api.put(`/admin/drivers/${editingItem.id}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          alert('Driver updated successfully');
        } else {
          await api.post('/admin/drivers', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          alert('Driver created successfully');
        }
      } else if (actualTab === 'car-options') {
        // Use multipart/form-data for car options to support image upload
        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            data.append(key, value);
          }
        });
        if (carOptionImageFiles && carOptionImageFiles.length > 0) {
          carOptionImageFiles.forEach((file) => {
            data.append('images', file);
          });
        }

        if (editingItem) {
          await api.put(`/admin/car-options/${editingItem.id}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          alert('Updated successfully');
        } else {
          await api.post('/admin/car-options', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          alert('Created successfully');
        }
      } else {
        // JSON body for all other tabs
        // Sanitize formData: convert empty strings to null for optional numeric fields
        const sanitizedData = { ...formData };
        if (actualTab === 'rate-meters') {
          // Handle rate meter specific fields
          if (sanitizedData.hours === '' || sanitizedData.hours === undefined) {
            sanitizedData.hours = null;
          } else if (sanitizedData.hours !== null) {
            sanitizedData.hours = parseInt(sanitizedData.hours);
          }
          if (sanitizedData.trip_type === '' || sanitizedData.trip_type === undefined) {
            sanitizedData.trip_type = null;
          }
          // Convert numeric fields
          const floatFields = ['base_fare', 'per_km_rate', 'per_hour_rate', 'extra_hour_rate', 'extra_km_rate'];
          floatFields.forEach(field => {
            if (sanitizedData[field] === '' || sanitizedData[field] === undefined) {
              sanitizedData[field] = 0;
            } else if (sanitizedData[field] !== null) {
              sanitizedData[field] = parseFloat(sanitizedData[field]) || 0;
            }
          });
        } else if (actualTab === 'cab-types') {
          // Convert empty strings to null for optional numeric fields
          const floatFields = ['base_fare', 'per_km_rate', 'per_minute_rate'];
          floatFields.forEach(field => {
            if (sanitizedData[field] === '' || sanitizedData[field] === undefined) {
              sanitizedData[field] = null;
            } else if (sanitizedData[field] !== null) {
              // Convert string numbers to actual numbers
              const numValue = parseFloat(sanitizedData[field]);
              sanitizedData[field] = isNaN(numValue) ? null : numValue;
            }
          });
          // Handle capacity separately as it should be an integer
          if (sanitizedData.capacity === '' || sanitizedData.capacity === undefined) {
            sanitizedData.capacity = null;
          } else if (sanitizedData.capacity !== null) {
            const intValue = parseInt(sanitizedData.capacity);
            sanitizedData.capacity = isNaN(intValue) ? null : intValue;
          }
          // Convert empty description to null
          if (sanitizedData.description === '') {
            sanitizedData.description = null;
          }
        }
        
        if (editingItem) {
          await api.put(`/admin/${actualTab}/${editingItem.id}`, sanitizedData);
          alert('Updated successfully');
        } else {
          await api.post(`/admin/${actualTab}`, sanitizedData);
          alert('Created successfully');
        }
      }
      setShowForm(false);
      setEditingItem(null);
      setFormData({});
      setDriverPhotoFile(null);
      setCarOptionImageFiles([]);
      fetchDashboardData();
      } catch (error) {
        console.error('Error saving item:', error);
        const errorMessage = error.response?.data?.errors 
          ? error.response.data.errors.map(e => e.msg || e.message).join(', ')
          : error.response?.data?.error || 'Error saving item';
        alert(errorMessage);
      } finally {
      setLoading(false);
    }
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    // Ensure all new fields are included
    const formDataWithDefaults = {
      ...item,
      hours: item.hours || undefined,
      extra_hour_rate: item.extra_hour_rate || 0,
      extra_km_rate: item.extra_km_rate || 0,
      trip_type: item.trip_type || undefined,
    };
    setFormData(formDataWithDefaults);
    setCarOptionImageFiles([]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCreateForm = () => {
    setEditingItem(null);
    setFormData({});
    setCarOptionImageFiles([]);
    setDriverPhotoFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleCabTypeExpansion = (cabTypeId) => {
    setExpandedCabTypes(prev => ({
      ...prev,
      [cabTypeId]: !prev[cabTypeId]
    }));
  };

  const openAddCarModal = (cabTypeId) => {
    setSelectedCabTypeForCar(cabTypeId);
    setFormData({ car_option_id: '', car_subtype: '' });
    setShowAddCarModal(true);
  };

  const handleAssignCar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { car_option_id, car_subtype } = formData;
      await api.post(`/admin/cab-types/${selectedCabTypeForCar}/assign-car`, {
        car_option_id,
        car_subtype
      });
      alert('Car assigned successfully');
      setShowAddCarModal(false);
      setFormData({ car_option_id: '', car_subtype: '' });
      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error assigning car');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCarFromCabType = async (carId) => {
    if (!window.confirm('Remove this car from this cab type?')) {
      return;
    }
    try {
      await api.put(`/admin/car-options/${carId}`, {
        cab_type_id: null,
        car_subtype: null
      });
      alert('Car removed successfully');
      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error removing car');
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      await api.put(`/admin/bookings/${bookingId}/status`, { status });
      // Update the selected booking in modal
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, booking_status: status });
      }
      fetchDashboardData();
      alert('Status updated successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating status');
    }
  };

  const handleAssignCorporate = async (bookingId) => {
    try {
      const sel = assignSelections[bookingId] || {};
      const payload = {};
      if (sel.driver_id) payload.driver_id = sel.driver_id;
      if (sel.cab_id) payload.cab_id = sel.cab_id;
      if (!payload.driver_id && !payload.cab_id) {
        alert('Please select a driver or a cab to assign.');
        return;
      }
      await api.put(`/admin/corporate-bookings/${bookingId}/assign`, payload);
      alert('Assignment updated');
      setReassigning((prev) => ({ ...prev, [bookingId]: false }));
      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error assigning driver/cab');
    }
  };

  const handleAssignEvent = async (bookingId) => {
    try {
      const sel = eventAssignSelections[bookingId] || { assignments: [] };
      const booking = eventBookings.find(b => b.id === bookingId);
      if (!booking) {
        alert('Booking not found');
        return;
      }

      const numCars = booking.number_of_cars || 1;
      const assignments = sel.assignments || [];
      
      // Validate that we have the right number of assignments
      if (assignments.length !== numCars) {
        alert(`Please assign exactly ${numCars} car(s) and driver(s) for this booking.`);
        return;
      }

      // Validate that each assignment has at least a driver or cab
      for (let i = 0; i < assignments.length; i++) {
        if (!assignments[i].driver_id && !assignments[i].cab_id) {
          alert(`Please assign at least a driver or cab for car ${i + 1}.`);
          return;
        }
      }

      await api.post(`/events/bookings/${bookingId}/assign`, { assignments });
      alert('Cars and drivers assigned successfully');
      setReassigning((prev) => ({ ...prev, [bookingId]: false }));
      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error assigning cars/drivers');
    }
  };

  const handleAssignDriver = async (bookingId) => {
    try {
      const sel = assignSelections[bookingId] || {};
      const payload = {};
      if (sel.driver_id) payload.driver_id = sel.driver_id;
      if (sel.cab_id) payload.cab_id = sel.cab_id;
      
      if (!payload.driver_id && !payload.cab_id) {
        alert('Please select a driver or car to assign.');
        return;
      }
      
      const response = await api.put(`/admin/bookings/${bookingId}/assign`, payload);
      alert('Assignment updated successfully');
      setReassigning((prev) => ({ ...prev, [bookingId]: false }));
      
      // Update selectedBooking if this is the currently selected booking
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking(response.data);
      }
      
      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error assigning driver/car');
    }
  };

  const filteredAndGroupedBookings = () => {
    const groups = {};

    const normalizedSearch = bookingFilters.search.trim().toLowerCase();

    bookings.forEach((booking) => {
      // Status filter
      if (
        bookingFilters.status !== 'all' &&
        booking.booking_status !== bookingFilters.status
      ) {
        return;
      }

      // Service type filter
      if (
        bookingFilters.serviceType !== 'all' &&
        booking.service_type !== bookingFilters.serviceType
      ) {
        return;
      }

      // Cab type filter
      if (
        bookingFilters.cabType !== 'all' &&
        (!booking.cab_type_id || booking.cab_type_id !== parseInt(bookingFilters.cabType))
      ) {
        return;
      }

      // Date range filter (based on booking_date)
      const bookingDate = new Date(booking.booking_date);
      if (bookingFilters.fromDate) {
        const from = new Date(bookingFilters.fromDate);
        if (bookingDate < from) return;
      }
      if (bookingFilters.toDate) {
        const to = new Date(bookingFilters.toDate);
        // include entire end day
        to.setHours(23, 59, 59, 999);
        if (bookingDate > to) return;
      }

      // Text search across key fields
      if (normalizedSearch) {
        const haystack = [
          booking.id,
          booking.passenger_name,
          booking.passenger_phone,
          booking.passenger_email,
          booking.from_location,
          booking.to_location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) {
          return;
        }
      }

      // Group key: prefer user_id, then passenger_email, then phone
      const groupKey =
        booking.user_id ||
        booking.passenger_email ||
        booking.passenger_phone ||
        'unknown';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          userLabel:
            booking.passenger_name ||
            booking.username ||
            booking.passenger_email ||
            booking.passenger_phone ||
            'Unknown user',
          bookings: [],
        };
      }

      groups[groupKey].bookings.push(booking);
    });

    // Sort bookings within each group by booking ID (descending - latest first)
    Object.values(groups).forEach((group) => {
      group.bookings.sort((a, b) => (b.id || 0) - (a.id || 0));
    });

    // Sort groups by highest booking ID in each group (descending - latest first)
    return Object.entries(groups).sort(([, groupA], [, groupB]) => {
      const maxIdA = Math.max(...groupA.bookings.map((b) => b.id || 0));
      const maxIdB = Math.max(...groupB.bookings.map((b) => b.id || 0));
      return maxIdB - maxIdA;
    });
  };

  const downloadReceipt = async (bookingId, withGST = true) => {
    try {
      const response = await api.get(`/admin/bookings/${bookingId}/receipt`, {
        params: { withGST: withGST },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `booking-${bookingId}-receipt${withGST ? '-with-gst' : ''}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert(error.response?.data?.error || 'Error downloading receipt');
    }
  };

  const handleGenerateInvoice = async (bookingId, withGST) => {
    try {
      await downloadReceipt(bookingId, withGST);
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Error generating invoice. Please try again.');
    }
  };

  const sendInvoiceEmail = async (bookingId, withGST = true) => {
    try {
      const response = await api.post(`/admin/bookings/${bookingId}/send-invoice`, {
        withGST: withGST
      });
      alert('Invoice email sent successfully!');
    } catch (error) {
      console.error('Error sending invoice email:', error);
      alert(error.response?.data?.error || 'Error sending invoice email');
    }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await updateBookingStatus(bookingId, 'confirmed');
      alert('Booking confirmed successfully!');
    } catch (error) {
      alert('Error confirming booking');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    try {
      await updateBookingStatus(bookingId, 'cancelled');
      alert('Booking cancelled successfully!');
    } catch (error) {
      alert('Error cancelling booking');
    }
  };

  const updateCorporateBookingStatus = async (bookingId, status) => {
    try {
      await api.put(`/admin/corporate-bookings/${bookingId}`, { status });
      fetchDashboardData();
    } catch (error) {
      throw error;
    }
  };

  // EditableFare component for inline fare editing
  const EditableFare = ({ bookingId, initialFare, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [fare, setFare] = useState(initialFare || 0);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
      setSaving(true);
      try {
        await api.put(`/corporate/bookings/${bookingId}`, { fare_amount: parseFloat(fare) || 0 });
        onUpdate(parseFloat(fare) || 0);
        setIsEditing(false);
      } catch (error) {
        alert(error.response?.data?.error || 'Error updating fare');
        setFare(initialFare);
      } finally {
        setSaving(false);
      }
    };

    const handleCancel = () => {
      setFare(initialFare);
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="number"
            value={fare}
            onChange={(e) => setFare(e.target.value)}
            style={{ width: '80px', padding: '4px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
            className="btn btn-primary btn-sm"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            style={{ padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
            className="btn btn-secondary btn-sm"
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={() => setIsEditing(true)}
        style={{
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          display: 'inline-block',
          minWidth: '60px',
          textAlign: 'center'
        }}
        title="Click to edit fare"
      >
        <strong style={{ color: '#16a34a' }}>₹{parseFloat(fare || 0).toFixed(2)}</strong>
      </div>
    );
  };

  const handleConfirmCorporateBooking = async (bookingId) => {
    try {
      await updateCorporateBookingStatus(bookingId, 'confirmed');
      alert('Corporate booking confirmed successfully!');
    } catch (error) {
      alert('Error confirming corporate booking');
    }
  };

  const handleCancelCorporateBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this corporate booking?')) {
      return;
    }
    try {
      await updateCorporateBookingStatus(bookingId, 'cancelled');
      alert('Corporate booking cancelled successfully!');
    } catch (error) {
      alert('Error cancelling corporate booking');
    }
  };

  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    setShowBookingModal(true);
  };

  const handlePrintReceipt = () => {
    if (selectedBooking) {
      downloadReceipt(selectedBooking.id, receiptWithGST);
    }
  };

  const exportBookingsToCSV = async () => {
    try {
      const response = await api.get('/admin/bookings/export/csv', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `nammacabs-bookings-${timestamp}.csv`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting bookings to CSV:', error);
      alert('Error exporting bookings. Please try again.');
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    
    if (!newBooking.fare_amount || parseFloat(newBooking.fare_amount) <= 0) {
      alert('Please enter a valid fare amount');
      return;
    }

    // Validate multiple way trip stops
    if (newBooking.service_type === 'outstation' && newBooking.trip_type === 'multiple_way') {
      const pickupAddr = multipleWayStops.pickup?.address || (typeof multipleWayStops.pickup === 'string' ? multipleWayStops.pickup : '');
      const stopAAddr = multipleWayStops.stopA?.address || (typeof multipleWayStops.stopA === 'string' ? multipleWayStops.stopA : '');
      const stopBAddr = multipleWayStops.stopB?.address || (typeof multipleWayStops.stopB === 'string' ? multipleWayStops.stopB : '');
      const dropAddr = multipleWayStops.drop?.address || (typeof multipleWayStops.drop === 'string' ? multipleWayStops.drop : '');
      
      if (!pickupAddr || !stopAAddr || !dropAddr) {
        alert('Please fill in all required locations for multiple way trip (Pickup, Stop A, and Final Drop). Stop B is optional.');
        return;
      }
    }

    setLoading(true);
    try {
      const bookingPayload = {
        service_type: newBooking.service_type,
        passenger_name: newBooking.passenger_name,
        passenger_phone: newBooking.passenger_phone,
        passenger_email: newBooking.passenger_email,
        travel_date: newBooking.travel_date,
        fare_amount: parseFloat(newBooking.fare_amount),
        distance_km: 0,
        notes: newBooking.notes || '',
      };

      // Only include trip_type for outstation bookings
      if (newBooking.service_type === 'outstation' && newBooking.trip_type && newBooking.trip_type.trim() !== '') {
        bookingPayload.trip_type = newBooking.trip_type;
      }

      // Handle multiple way trip stops
      if (newBooking.service_type === 'outstation' && newBooking.trip_type === 'multiple_way') {
        const pickupAddr = multipleWayStops.pickup?.address || (typeof multipleWayStops.pickup === 'string' ? multipleWayStops.pickup : '');
        const stopAAddr = multipleWayStops.stopA?.address || (typeof multipleWayStops.stopA === 'string' ? multipleWayStops.stopA : '');
        const stopBAddr = multipleWayStops.stopB?.address || (typeof multipleWayStops.stopB === 'string' ? multipleWayStops.stopB : '');
        const dropAddr = multipleWayStops.drop?.address || (typeof multipleWayStops.drop === 'string' ? multipleWayStops.drop : '');
        
        bookingPayload.from_location = pickupAddr;
        // Combine all stops: stopA, stopB (if provided), additional stops, and final drop
        const additionalStopsAddrs = multipleWayStops.additionalStops
          .map(s => s?.address || (typeof s === 'string' ? s : ''))
          .filter(addr => addr && addr.trim() !== '');
        
        // Only include stopB if it's provided
        const allStops = [stopAAddr];
        if (stopBAddr && stopBAddr.trim() !== '') {
          allStops.push(stopBAddr);
        }
        allStops.push(...additionalStopsAddrs, dropAddr);
        bookingPayload.to_location = allStops.join(' → ');
        bookingPayload.stops = JSON.stringify(allStops);
      } else {
        // For non-multiple way trips
        bookingPayload.from_location = newBooking.from_location;
        
        // For airport bookings, always include KIA as to_location
        if (newBooking.service_type === 'airport') {
          bookingPayload.to_location = 'Kempegowda International Airport Bangalore';
        } else if (newBooking.service_type !== 'local' && newBooking.to_location && newBooking.to_location.trim() !== '') {
          bookingPayload.to_location = newBooking.to_location;
        }
      }

      // Only include number_of_hours for local bookings
      if (newBooking.service_type === 'local' && newBooking.number_of_hours) {
        bookingPayload.number_of_hours = parseInt(newBooking.number_of_hours);
      }

      // Only include number_of_days for outstation round_trip bookings
      if (newBooking.service_type === 'outstation' && newBooking.trip_type === 'round_trip' && newBooking.number_of_days) {
        bookingPayload.number_of_days = parseInt(newBooking.number_of_days);
      }

      // Only include optional fields if they have values
      if (newBooking.pickup_time && newBooking.pickup_time.trim() !== '') {
        bookingPayload.pickup_time = newBooking.pickup_time;
      }

      if (newBooking.cab_type_id && newBooking.cab_type_id !== '') {
        bookingPayload.cab_type_id = parseInt(newBooking.cab_type_id);
      }

      if (newBooking.category && newBooking.category.trim() !== '') {
        bookingPayload.category = newBooking.category.trim();
      }

      const response = await api.post('/bookings', bookingPayload);
      
      alert(`Booking created successfully! Booking ID: ${response.data.id}`);
      
      // Reset form
      setNewBooking({
        service_type: '',
        trip_type: '',
        from_location: '',
        to_location: '',
        passenger_name: '',
        passenger_phone: '',
        passenger_email: '',
        travel_date: '',
        pickup_time: '',
        number_of_hours: '',
        number_of_days: '',
        cab_type_id: '',
        category: '',
        notes: '',
        fare_amount: '',
      });
      setMultipleWayStops({
        pickup: null,
        stopA: null,
        stopB: null,
        drop: null,
        additionalStops: [],
      });
      
      // Refresh dashboard data
      fetchDashboardData();
    } catch (error) {
      console.error('Error creating booking:', error);
      alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Error creating booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-dashboard">
      {/* Mobile hamburger menu button - fixed at top */}
      {isMobile && (
        <button 
          className="mobile-hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      )}

      {/* Mobile overlay when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div 
          className="mobile-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="admin-container">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2>Namma Cabs</h2>
                <p className="sidebar-subtitle">Admin Dashboard</p>
              </div>
              {isMobile && (
                <button 
                  className="mobile-menu-close-btn"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close menu"
                >
                  ✕
                </button>
              )}
            </div>
            <div style={{ paddingTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Welcome, {user?.username}</span>
              </div>
              <button 
                onClick={logout} 
                className="btn btn-secondary"
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  fontSize: '14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff'
                }}
              >
                Logout
              </button>
            </div>
          </div>
          
          <div className="sidebar-section">
            <h3 className="sidebar-heading">Dashboard</h3>
            {(user?.role === 'admin' || hasAccess('dashboard')) && (
              <button
                className={activeTab === 'dashboard' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('dashboard');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">📊</span>
                <span className="sidebar-text">Dashboard</span>
                <span className="sidebar-subtext">Statistics & Insights</span>
              </button>
            )}
            {hasAccess('drivers') && (
              <button
                className={activeTab === 'drivers' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('drivers');
                  if (isMobile) setSidebarOpen(false);
                  setShowForm(false);
                }}
              >
                <span className="sidebar-icon">👤</span>
                <span className="sidebar-text">Others</span>
                <span className="sidebar-subtext">Drivers & Cars</span>
              </button>
            )}
            {hasAccess('create-booking') && (
              <button
                className={activeTab === 'create-booking' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('create-booking');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">➕</span>
                <span className="sidebar-text">Booking Form</span>
                <span className="sidebar-subtext">New Booking</span>
              </button>
            )}
            {hasAccess('enquiries') && (
              <button
                className={activeTab === 'enquiries' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('enquiries');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">📥</span>
                <span className="sidebar-text">Enquiries</span>
                <span className="sidebar-subtext">Received Bookings</span>
              </button>
            )}
            {hasAccess('confirmed-bookings') && (
              <button
                className={activeTab === 'confirmed-bookings' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('confirmed-bookings');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">✅</span>
                <span className="sidebar-text">Confirmed Bookings</span>
                <span className="sidebar-subtext">Confirmed Only</span>
              </button>
            )}
            {hasAccess('driver-assigned') && (
              <button
                className={activeTab === 'driver-assigned' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('driver-assigned');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">🚗</span>
                <span className="sidebar-text">Driver Assigned</span>
                <span className="sidebar-subtext">With Driver Info</span>
              </button>
            )}
            {hasAccess('trip-end') && (
              <button
                className={activeTab === 'trip-end' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('trip-end');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">🏁</span>
                <span className="sidebar-text">Trip End</span>
                <span className="sidebar-subtext">Completed Trips</span>
              </button>
            )}
            {hasAccess('cancelled-bookings') && (
              <button
                className={activeTab === 'cancelled-bookings' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('cancelled-bookings');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">❌</span>
                <span className="sidebar-text">Cancelled Bookings</span>
                <span className="sidebar-subtext">Cancelled Only</span>
              </button>
            )}
            {hasAccess('driver-status') && (
              <button
                className={activeTab === 'driver-status' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('driver-status');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">📊</span>
                <span className="sidebar-text">Driver Status</span>
                <span className="sidebar-subtext">Availability & Rides</span>
              </button>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Billing</h3>
            {hasAccess('bills-invoices') && (
              <button
                className={activeTab === 'bills-invoices' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('bills-invoices');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">🧾</span>
                <span className="sidebar-text">Bills and Invoices</span>
                <span className="sidebar-subtext">View Invoices</span>
              </button>
            )}
            {hasAccess('bills-invoices') && (
              <button
                className={activeTab === 'create-invoice' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('create-invoice');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">➕</span>
                <span className="sidebar-text">Create Invoice</span>
                <span className="sidebar-subtext">New Invoice</span>
              </button>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Corporate Bookings</h3>
            {hasAccess('event-bookings') && (
              <button
                className={activeTab === 'corporate-all' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('corporate-all');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">🏢</span>
                <span className="sidebar-text">All Corporate Bookings</span>
                <span className="sidebar-subtext">Submissions</span>
              </button>
            )}
            {hasAccess('event-bookings', true) && (
              <button
                className={activeTab === 'corporate-assign' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('corporate-assign');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">🧭</span>
                <span className="sidebar-text">Assign Drivers and Cars</span>
                <span className="sidebar-subtext">Drivers & Cabs</span>
              </button>
            )}
            {hasAccess('bills-invoices') && (
              <button
                className={activeTab === 'corporate-export' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('corporate-export');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">📥</span>
                <span className="sidebar-text">Export Invoices</span>
                <span className="sidebar-subtext">Excel Export</span>
              </button>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Event Bookings</h3>
            {hasAccess('event-bookings') && (
              <button
                className={activeTab === 'event-bookings' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('event-bookings');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">🎉</span>
                <span className="sidebar-text">Event Bookings</span>
                <span className="sidebar-subtext">View & Assign</span>
              </button>
            )}
          </div>


          <div className="sidebar-section">
            <h3 className="sidebar-heading">Fleet Management</h3>
            {hasAccess('rate-meters') && (
              <button
                className={activeTab === 'rate-meters' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('rate-meters');
                  setRateMeterSubsection('rate-meters');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">💰</span>
                <span className="sidebar-text">Rate Meter & Cab Types</span>
                <span className="sidebar-subtext">Fleet Management</span>
              </button>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Admin Management</h3>
            {user?.role === 'admin' && (
              <button
                className={activeTab === 'admin-register' ? 'active' : ''}
                onClick={() => {
                  setActiveTab('admin-register');
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <span className="sidebar-icon">👨‍💼</span>
                <span className="sidebar-text">Register Admin</span>
                <span className="sidebar-subtext">Add Admin Users</span>
              </button>
            )}
          </div>
        </div>

        <div className="main-content">
          {loading && <div className="loading">Loading...</div>}

          {/* Redirect to first accessible tab if current tab is not accessible */}
          {user && user.role === 'manager' && !hasAccess(getSectionKeyForTab(activeTab)) && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p>You don't have access to this section.</p>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  // Find first accessible tab
                  const accessibleTabs = [
                    'dashboard', 'enquiries', 'confirmed-bookings', 'driver-assigned',
                    'trip-end', 'cancelled-bookings', 'create-booking',
                    'rate-meters', 'drivers',
                    'event-bookings', 'bills-invoices'
                  ];
                  const firstAccessible = accessibleTabs.find(tab => hasAccess(tab));
                  if (firstAccessible) {
                    setActiveTab(firstAccessible);
                  }
                }}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && hasAccess('dashboard') && stats && (
            <div className="dashboard-layout">
              <div className="pie-chart-container">
                <h3 className="chart-title">Dashboard Statistics</h3>
                <div className="pie-chart-wrapper">
                  <Pie
                    data={{
                      labels: ['Completed Bookings', 'Assigned Bookings', 'Cancelled Bookings', 'Enquiries'],
                      datasets: [
                        {
                          label: 'Count',
                          data: [
                            stats.completedBookings || 0,
                            stats.assignedBookings || 0,
                            stats.cancelledBookings || 0,
                            stats.enquiriesBookings || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',  // Completed - light green
                            'rgba(37, 99, 235, 0.8)',  // Assigned - light blue
                            'rgba(239, 68, 68, 0.8)',  // Cancelled - red
                            'rgba(245, 158, 11, 0.8)'  // Enquiries - amber
                          ],
                          borderColor: [
                            'rgba(34, 197, 94, 1)',
                            'rgba(37, 99, 235, 1)',
                            'rgba(239, 68, 68, 1)',
                            'rgba(245, 158, 11, 1)'
                          ],
                          borderWidth: 2
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            padding: 20,
                            font: {
                              size: 14,
                              weight: '600'
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                          }
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.parsed || 0;
                              const total = context.dataset.data.reduce((a, b) => a + b, 0);
                              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                              return `${label}: ${value} (${percentage}%)`;
                            }
                          }
                        }
                      },
                      animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000
                      }
                    }}
                  />
                </div>
                <div className="chart-stats-summary">
                  <div className="stat-summary-item">
                    <span className="stat-label">Completed:</span>
                    <span className="stat-value">{stats.completedBookings || 0}</span>
                  </div>
                  <div className="stat-summary-item">
                    <span className="stat-label">Assigned:</span>
                    <span className="stat-value">{stats.assignedBookings || 0}</span>
                  </div>
                  <div className="stat-summary-item">
                    <span className="stat-label">Cancelled:</span>
                    <span className="stat-value">{stats.cancelledBookings || 0}</span>
                  </div>
                  <div className="stat-summary-item">
                    <span className="stat-label">Enquiries:</span>
                    <span className="stat-value">{stats.enquiriesBookings || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="recent-bookings-panel">
                <h3 className="recent-bookings-title">Recent Bookings</h3>
                <div className="recent-bookings-list">
                  {recentBookings.length === 0 ? (
                    <p className="no-bookings">No recent bookings</p>
                  ) : (
                    recentBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="recent-booking-item"
                        onClick={() => handleBookingClick(booking)}
                      >
                        <div className="recent-booking-header">
                          <span className="recent-booking-id">#{booking.id}</span>
                          <span className={`recent-booking-status ${booking.booking_status}`}>
                            {booking.booking_status}
                          </span>
                        </div>
                        <div className="recent-booking-info">
                          <p className="recent-booking-passenger">{booking.passenger_name}</p>
                          <p className="recent-booking-service">
                            {booking.service_type === 'local' ? 'Local' : 
                             booking.service_type === 'airport' ? 'Airport' : 
                             booking.service_type === 'outstation' ? (
                               booking.trip_type ? (
                                 `Outstation - ${booking.trip_type === 'one_way' ? 'One Way' :
                                                booking.trip_type === 'round_trip' ? 'Round Trip' :
                                                booking.trip_type === 'multiple_way' ? 'Multiple Way' : booking.trip_type}${booking.from_location ? ` • ${booking.from_location}` : ''}`
                               ) : (
                                 `Outstation${booking.from_location ? ` • ${booking.from_location}` : ''}`
                               )
                             ) : booking.service_type}
                          </p>
                          <p className="recent-booking-date">
                            {formatIndianDateTime(booking.booking_date)}
                          </p>
                          <p className="recent-booking-time" style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '4px' }}>
                            Booked at: {formatIndianTime(booking.booking_date)}
                          </p>
                          <p className="recent-booking-fare">₹{booking.fare_amount}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking Details Modal */}
          {showBookingModal && selectedBooking && (
            <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
              <div className="booking-modal glass-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Booking Details - #{selectedBooking.id}</h2>
                  <button
                    className="modal-close"
                    onClick={() => setShowBookingModal(false)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="modal-content">
                  <div className="detail-item">
                    <div className="detail-heading">Booking ID</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">#{selectedBooking.id}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-heading">Status</div>
                    <div className="detail-divider"></div>
                    <select
                      value={selectedBooking.booking_status}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateBookingStatus(selectedBooking.id, e.target.value);
                      }}
                      className="detail-select"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="detail-item">
                    <div className="detail-heading">Service Type</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">
                      {selectedBooking.service_type === 'local' ? 'Local' : 
                       selectedBooking.service_type === 'airport' ? 'Airport' : 
                       selectedBooking.service_type === 'outstation' ? (
                         selectedBooking.trip_type ? (
                           <>
                             Outstation ({selectedBooking.trip_type === 'one_way' ? 'One Way' :
                              selectedBooking.trip_type === 'round_trip' ? 'Round Trip' :
                              selectedBooking.trip_type === 'multiple_way' ? 'Multiple Way' : selectedBooking.trip_type})
                           </>
                         ) : 'Outstation'
                       ) : selectedBooking.service_type}
                    </div>
                  </div>

                  {selectedBooking.service_type === 'local' ? (
                    <>
                      <div className="detail-item">
                        <div className="detail-heading">Pickup Location</div>
                        <div className="detail-divider"></div>
                        <div className="detail-text">{selectedBooking.from_location || 'N/A'}</div>
                      </div>
                      {selectedBooking.number_of_hours && (
                        <div className="detail-item">
                          <div className="detail-heading">Duration</div>
                          <div className="detail-divider"></div>
                          <div className="detail-text">{selectedBooking.number_of_hours} hours</div>
                        </div>
                      )}
                    </>
                  ) : selectedBooking.service_type === 'airport' ? (
                    <>
                      <div className="detail-item">
                        <div className="detail-heading">From</div>
                        <div className="detail-divider"></div>
                        <div className="detail-text">{selectedBooking.from_location || 'N/A'}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-heading">To</div>
                        <div className="detail-divider"></div>
                        <div className="detail-text">{selectedBooking.to_location && selectedBooking.to_location !== 'N/A' ? selectedBooking.to_location : 'N/A'}</div>
                      </div>
                    </>
                  ) : selectedBooking.service_type === 'outstation' && selectedBooking.trip_type === 'one_way' ? (
                    <>
                      <div className="detail-item">
                        <div className="detail-heading">From</div>
                        <div className="detail-divider"></div>
                        <div className="detail-text">{selectedBooking.from_location || 'N/A'}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-heading">To</div>
                        <div className="detail-divider"></div>
                        <div className="detail-text">{selectedBooking.to_location && selectedBooking.to_location !== 'N/A' ? selectedBooking.to_location : 'N/A'}</div>
                      </div>
                    </>
                  ) : selectedBooking.service_type === 'outstation' && selectedBooking.trip_type === 'round_trip' ? (
                    <>
                      <div className="detail-item">
                        <div className="detail-heading">Pickup Location</div>
                        <div className="detail-divider"></div>
                        <div className="detail-text">{selectedBooking.from_location || 'N/A'}</div>
                      </div>
                    </>
                  ) : selectedBooking.service_type === 'outstation' && selectedBooking.trip_type === 'multiple_way' ? (
                    <>
                      {selectedBooking.from_location && (
                        <div className="detail-item">
                          <div className="detail-heading">From</div>
                          <div className="detail-divider"></div>
                          <div className="detail-text">{selectedBooking.from_location}</div>
                        </div>
                      )}
                      {selectedBooking.to_location && selectedBooking.to_location !== 'N/A' && (
                        <div className="detail-item">
                          <div className="detail-heading">Route</div>
                          <div className="detail-divider"></div>
                          <div className="detail-text">{selectedBooking.to_location}</div>
                        </div>
                      )}
                    </>
                  ) : selectedBooking.service_type === 'outstation' ? (
                    <>
                      {selectedBooking.from_location && (
                        <div className="detail-item">
                          <div className="detail-heading">From</div>
                          <div className="detail-divider"></div>
                          <div className="detail-text">{selectedBooking.from_location}</div>
                        </div>
                      )}
                      {selectedBooking.to_location && selectedBooking.to_location !== 'N/A' && (
                        <div className="detail-item">
                          <div className="detail-heading">To</div>
                          <div className="detail-divider"></div>
                          <div className="detail-text">{selectedBooking.to_location}</div>
                        </div>
                      )}
                    </>
                  ) : null}

                  {selectedBooking.distance_km > 0 && (
                    <div className="detail-item">
                      <div className="detail-heading">Distance</div>
                      <div className="detail-divider"></div>
                      <div className="detail-text">{selectedBooking.distance_km} km</div>
                    </div>
                  )}

                  {selectedBooking.cab_type_name && (
                    <div className="detail-item">
                      <div className="detail-heading">Cab Type</div>
                      <div className="detail-divider"></div>
                      <div className="detail-text">{selectedBooking.cab_type_name}</div>
                    </div>
                  )}

                  {selectedBooking.car_option_name && (
                    <div className="detail-item">
                      <div className="detail-heading">Category</div>
                      <div className="detail-divider"></div>
                      <div className="detail-text">{selectedBooking.car_option_name}</div>
                    </div>
                  )}

                  <div className="detail-item">
                    <div className="detail-heading">Passenger Name</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">{selectedBooking.passenger_name}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-heading">Phone</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">{selectedBooking.passenger_phone}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-heading">Email</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">{selectedBooking.passenger_email}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-heading">Fare Amount</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">₹{selectedBooking.fare_amount}</div>
                  </div>

                  <div className="detail-item">
                    <div className="detail-heading">Booking Date & Time</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">
                      {formatIndianDateTime(selectedBooking.booking_date)}
                      <div style={{ fontSize: '0.9em', color: '#6b7280', marginTop: '4px' }}>
                        Time: {formatIndianTime(selectedBooking.booking_date)}
                      </div>
                    </div>
                  </div>

                  {selectedBooking.travel_date && (
                    <div className="detail-item">
                      <div className="detail-heading">Travel Date</div>
                      <div className="detail-divider"></div>
                      <div className="detail-text">{new Date(selectedBooking.travel_date).toLocaleString()}</div>
                    </div>
                  )}

                  {selectedBooking.notes && (
                    <div className="detail-item">
                      <div className="detail-heading">Notes</div>
                      <div className="detail-divider"></div>
                      <div className="detail-text">{selectedBooking.notes}</div>
                    </div>
                  )}

                  <div className="detail-item">
                    <div className="detail-heading">Driver Name</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">{selectedBooking.driver_name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not assigned</span>}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-heading">Driver Phone</div>
                    <div className="detail-divider"></div>
                    <div className="detail-text">{selectedBooking.driver_phone || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not assigned</span>}</div>
                  </div>

                  {selectedBooking.vehicle_number && (
                    <div className="detail-item">
                      <div className="detail-heading">Vehicle Number</div>
                      <div className="detail-divider"></div>
                      <div className="detail-text">{selectedBooking.vehicle_number}</div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <div className="receipt-options">
                    <label className="gst-option-label">
                      <input
                        type="radio"
                        checked={receiptWithGST}
                        onChange={() => setReceiptWithGST(true)}
                      />
                      <span>With GST</span>
                    </label>
                    <label className="gst-option-label">
                      <input
                        type="radio"
                        checked={!receiptWithGST}
                        onChange={() => setReceiptWithGST(false)}
                      />
                      <span>Without GST</span>
                    </label>
                  </div>
                  <div className="footer-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(selectedBooking.id);
                        alert('Booking ID copied!');
                      }}
                    >
                      Copy ID
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handlePrintReceipt}
                    >
                      Print Receipt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create-booking' && hasAccess('create-booking') && (
            <div>
              <div className="section-header">
                <h2>Create New Booking</h2>
              </div>

              <div className="booking-filters-box" style={{ maxWidth: '800px' }}>
                <form onSubmit={handleCreateBooking}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label>Service Type *</label>
                      <select
                        value={newBooking.service_type}
                        onChange={(e) => {
                          const newServiceType = e.target.value;
                          const updatedBooking = { 
                            ...newBooking, 
                            service_type: newServiceType, 
                            trip_type: '', 
                            number_of_hours: '', 
                            number_of_days: '',
                            to_location: newServiceType === 'airport' ? 'Kempegowda International Airport Bangalore' : ''
                          };
                          setNewBooking(updatedBooking);
                        }}
                        required
                      >
                        <option value="">Select Service Type</option>
                        <option value="local">Local</option>
                        <option value="airport">Airport</option>
                        <option value="outstation">Outstation</option>
                      </select>
                    </div>

                    {newBooking.service_type === 'outstation' && (
                      <div className="form-group">
                        <label>Trip Type *</label>
                        <select
                          value={newBooking.trip_type}
                          onChange={(e) => {
                            const newTripType = e.target.value;
                            setNewBooking({ ...newBooking, trip_type: newTripType, number_of_days: '' });
                            // Reset multiple way stops when changing trip type
                            if (newTripType !== 'multiple_way') {
                              setMultipleWayStops({
                                pickup: null,
                                stopA: null,
                                stopB: null,
                                drop: null,
                                additionalStops: [],
                              });
                            }
                          }}
                          required
                        >
                          <option value="">Select Trip Type</option>
                          <option value="one_way">One Way</option>
                          <option value="round_trip">Round Trip</option>
                          <option value="multiple_way">Multiple Way</option>
                        </select>
                      </div>
                    )}

                    {newBooking.service_type === 'local' && (
                      <div className="form-group">
                        <label>Number of Hours *</label>
                        <select
                          value={newBooking.number_of_hours}
                          onChange={(e) => {
                            setNewBooking({ ...newBooking, number_of_hours: e.target.value });
                          }}
                          required
                        >
                          <option value="">Select Hours</option>
                          <option value="4">4 hours</option>
                          <option value="8">8 hours</option>
                          <option value="12">12 hours</option>
                        </select>
                      </div>
                    )}

                    {newBooking.service_type === 'outstation' && newBooking.trip_type === 'round_trip' && (
                      <div className="form-group">
                        <label>Number of Days *</label>
                        <select
                          value={newBooking.number_of_days}
                          onChange={(e) => {
                            setNewBooking({ ...newBooking, number_of_days: e.target.value });
                          }}
                          required
                        >
                          <option value="">Select Days</option>
                          <option value="1">1 day (300 km)</option>
                          <option value="2">2 days (600 km)</option>
                          <option value="3">3 days (900 km)</option>
                          <option value="4">4 days (1200 km)</option>
                          <option value="5">5 days (1500 km)</option>
                          <option value="6">6 days (1800 km)</option>
                          <option value="7">7 days (2100 km)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Multiple Way Trip Stops */}
                  {newBooking.service_type === 'outstation' && newBooking.trip_type === 'multiple_way' ? (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <LocationInput
                          label="Pickup Location *"
                          value={multipleWayStops.pickup}
                          onSelect={(location) => {
                            setMultipleWayStops({ ...multipleWayStops, pickup: location });
                          }}
                          placeholder="Enter pickup location"
                          userLocation={userLocation}
                        />
                        <LocationInput
                          label="Stop A *"
                          value={multipleWayStops.stopA}
                          onSelect={(location) => {
                            setMultipleWayStops({ ...multipleWayStops, stopA: location });
                          }}
                          placeholder="Enter first stop location"
                          userLocation={userLocation}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <LocationInput
                          label="Stop B (Optional)"
                          value={multipleWayStops.stopB}
                          onSelect={(location) => {
                            setMultipleWayStops({ ...multipleWayStops, stopB: location });
                          }}
                          placeholder="Enter second stop location (optional)"
                          userLocation={userLocation}
                        />
                        <LocationInput
                          label="Final Drop Location *"
                          value={multipleWayStops.drop}
                          onSelect={(location) => {
                            setMultipleWayStops({ ...multipleWayStops, drop: location });
                          }}
                          placeholder="Enter final drop location"
                          userLocation={userLocation}
                        />
                      </div>

                      {/* Additional Stops */}
                      {multipleWayStops.additionalStops.map((stop, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
                          <LocationInput
                            label={`Stop ${String.fromCharCode(67 + index)} (Optional)`}
                            value={stop}
                            onSelect={(location) => {
                              const newStops = [...multipleWayStops.additionalStops];
                              newStops[index] = location;
                              setMultipleWayStops({ ...multipleWayStops, additionalStops: newStops });
                            }}
                            placeholder={`Enter stop ${String.fromCharCode(67 + index)} location`}
                            userLocation={userLocation}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newStops = multipleWayStops.additionalStops.filter((_, i) => i !== index);
                              setMultipleWayStops({ ...multipleWayStops, additionalStops: newStops });
                            }}
                            className="btn btn-danger btn-sm"
                            style={{ height: 'fit-content', marginBottom: '0' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setMultipleWayStops({
                              ...multipleWayStops,
                              additionalStops: [...multipleWayStops.additionalStops, null]
                            });
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          + Add Another Stop
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                      <LocationInput
                        label="From Location *"
                        value={newBooking.from_location ? (typeof newBooking.from_location === 'string' ? newBooking.from_location : newBooking.from_location) : null}
                        onSelect={(location) => {
                          setNewBooking({ ...newBooking, from_location: location?.address || '' });
                        }}
                        placeholder="Enter pickup location"
                        userLocation={userLocation}
                      />

                      {newBooking.service_type !== 'local' && (
                        <div className="form-group">
                          {newBooking.service_type === 'airport' ? (
                            <>
                              <label>To Location *</label>
                              <input
                                type="text"
                                value="Kempegowda International Airport Bangalore"
                                readOnly
                                disabled
                                style={{ 
                                  backgroundColor: '#e5e7eb', 
                                  cursor: 'not-allowed',
                                  color: '#111827',
                                  fontWeight: '600',
                                  border: '2px solid #d1d5db'
                                }}
                              />
                              <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                This field is automatically set to Kempegowda International Airport Bangalore for airport bookings
                              </small>
                            </>
                          ) : (
                            <LocationInput
                              label="To Location *"
                              value={newBooking.to_location ? (typeof newBooking.to_location === 'string' ? newBooking.to_location : newBooking.to_location) : null}
                              onSelect={(location) => {
                                setNewBooking({ ...newBooking, to_location: location?.address || '' });
                              }}
                              placeholder="Enter drop location"
                              userLocation={userLocation}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div className="form-group">
                      <label>Passenger Name *</label>
                      <input
                        type="text"
                        value={newBooking.passenger_name}
                        onChange={(e) => setNewBooking({ ...newBooking, passenger_name: e.target.value })}
                        placeholder="Enter passenger name"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Passenger Phone *</label>
                      <input
                        type="tel"
                        value={newBooking.passenger_phone}
                        onChange={(e) => setNewBooking({ ...newBooking, passenger_phone: e.target.value })}
                        placeholder="Enter phone number"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div className="form-group">
                      <label>Passenger Email *</label>
                      <input
                        type="email"
                        value={newBooking.passenger_email}
                        onChange={(e) => setNewBooking({ ...newBooking, passenger_email: e.target.value })}
                        placeholder="Enter email address"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Travel Date *</label>
                      <input
                        type="date"
                        value={newBooking.travel_date}
                        onChange={(e) => setNewBooking({ ...newBooking, travel_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div className="form-group">
                      <label>Pickup Time (Optional)</label>
                      <input
                        type="time"
                        value={newBooking.pickup_time}
                        onChange={(e) => setNewBooking({ ...newBooking, pickup_time: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Category (Optional)</label>
                      <input
                        type="text"
                        value={newBooking.category}
                        onChange={(e) => {
                          setNewBooking({ ...newBooking, category: e.target.value });
                        }}
                        placeholder="Enter category name"
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div className="form-group">
                      <label>Enter Amount *</label>
                      <input
                        type="number"
                        value={newBooking.fare_amount}
                        onChange={(e) => setNewBooking({ ...newBooking, fare_amount: e.target.value })}
                        placeholder="Enter fare amount"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Notes (Optional)</label>
                      <textarea
                        value={newBooking.notes}
                        onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                        placeholder="Any special requirements or notes"
                        rows="3"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '30px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                      style={{ marginLeft: 'auto', color: '#000' }}
                    >
                      {loading ? 'Creating...' : '✓ Create Booking'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'cab-types' && hasAccess('cab-types') && (
            <div>
              <div className="section-header">
                <h2>Cab Types</h2>
                <button onClick={openCreateForm} className="btn btn-primary" style={{ color: '#000' }}>
                  + Add Cab Type
                </button>
              </div>
              
              <div className="cab-types-hierarchical">
                {cabTypes.map((ct) => {
                  const isExpanded = expandedCabTypes[ct.id];
                  const carsBySubtype = cabTypeCars[ct.id] || {};
                  const subtypes = Object.keys(carsBySubtype).sort();
                  
                  return (
                    <div key={ct.id} className="cab-type-section">
                      <div className="cab-type-header" onClick={() => toggleCabTypeExpansion(ct.id)}>
                        <div className="cab-type-header-left">
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                          <h3>{ct.name}</h3>
                          <span className="cab-type-info">
                            ₹{ct.base_fare} base + ₹{ct.per_km_rate}/km
                            {ct.per_minute_rate > 0 && ` + ₹${ct.per_minute_rate}/min`}
                          </span>
                        </div>
                        <div className="cab-type-header-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditForm(ct);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete('cab-types', ct.id);
                            }}
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddCarModal(ct.id);
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            + Add Car
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="cab-type-content">
                          {subtypes.length === 0 ? (
                            <div className="no-cars-message">
                              <p>No cars assigned to this cab type yet.</p>
                              <button
                                onClick={() => openAddCarModal(ct.id)}
                                className="btn btn-primary btn-sm"
                              >
                                + Add Car
                              </button>
                            </div>
                          ) : (
                            subtypes.map((subtype) => (
                              <div key={subtype} className="car-subtype-section">
                                <h4 className="subtype-header">{subtype}</h4>
                                <div className="cars-grid">
                                  {carsBySubtype[subtype].map((car) => (
                                    <div key={car.id} className="car-card">
                                      {car.image_url && (
                                        <img src={getImageUrl(car.image_url)} alt={car.name} className="car-card-image" />
                                      )}
                                      <div className="car-card-content">
                                        <h5>{car.name}</h5>
                                        {car.description && <p>{car.description}</p>}
                                      </div>
                                      <button
                                        onClick={() => handleRemoveCarFromCabType(car.id)}
                                        className="btn btn-danger btn-sm car-remove-btn"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standalone Cabs tab has been removed; cab information is now managed under Rate Meter & Cab Types. */}

          {activeTab === 'rate-meters' && hasAccess('rate-meters') && (
            <div>
              <div className="section-header">
                <h2>Rate Meter Management</h2>
              </div>

              {/* Subsection Tabs (only Rate Meter now; Cab Types is shown inside this section) */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e5e7eb' }}>
                <button
                  onClick={() => setRateMeterSubsection('rate-meters')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: rateMeterSubsection === 'rate-meters' ? '#16a34a' : 'transparent',
                    color: rateMeterSubsection === 'rate-meters' ? 'white' : '#6b7280',
                    cursor: 'pointer',
                    borderBottom: rateMeterSubsection === 'rate-meters' ? '3px solid #16a34a' : '3px solid transparent',
                    fontWeight: rateMeterSubsection === 'rate-meters' ? '600' : '400',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Rate Meter
                </button>
              </div>

              {/* Rate Meter Subsection */}
              {rateMeterSubsection === 'rate-meters' && (
                <div className="rate-meters-container">
                {['local', 'airport', 'outstation'].map((serviceType) => {
                  const serviceRates = rateMeters.filter(rm => rm.service_type === serviceType);
                  const isExpanded = expandedServiceTypes[serviceType];
                  
                  return (
                    <div key={serviceType} className="rate-meter-service-section">
                      <div 
                        className="rate-meter-service-header"
                        onClick={() => setExpandedServiceTypes(prev => ({
                          ...prev,
                          [serviceType]: !prev[serviceType]
                        }))}
                      >
                        <div className="rate-meter-service-header-left">
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                          <h3 className="service-type-title">
                            {serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}
                          </h3>
                          <span className="rate-count">
                            {serviceRates.length} rate{serviceRates.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="rate-meter-service-content">
                          {serviceRates.length === 0 ? (
                            <div className="no-rates-message">
                              <p>No rates configured for {serviceType} service.</p>
                              <button
                                onClick={() => {
                                  setFormData({
                                    service_type: serviceType,
                                    car_category: '',
                                    base_fare: serviceType === 'airport' ? 0 : '',
                                    per_km_rate: 0,
                                    hours: serviceType === 'local' ? '' : undefined,
                                    extra_hour_rate: serviceType === 'local' ? 0 : undefined,
                                    extra_km_rate: serviceType === 'local' ? 0 : undefined,
                                    trip_type: serviceType === 'outstation' ? '' : undefined,
                                  });
                                  setEditingItem(null);
                                  setShowForm(true);
                                }}
                                className="btn btn-primary btn-sm"
                              >
                                + Add Rate
                              </button>
                            </div>
                          ) : (
                            <div className="rate-meters-grid">
                              {serviceRates.map((rate) => (
                                <div key={rate.id} className="rate-meter-card">
                                  <div className="rate-meter-card-header">
                                    <h4>{rate.car_category}</h4>
                                    <div className="rate-meter-actions">
                                      <button
                                        onClick={() => openEditForm(rate)}
                                        className="btn btn-secondary btn-sm"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDelete('rate-meters', rate.id)}
                                        className="btn btn-danger btn-sm"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                  <div className="rate-meter-details">
                                    {serviceType === 'local' ? (
                                      <>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Hours:</span>
                                          <span className="rate-value">{rate.hours || '-'} hrs</span>
                                        </div>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Base Fare:</span>
                                          <span className="rate-value">₹{rate.base_fare}</span>
                                        </div>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Extra Hour:</span>
                                          <span className="rate-value">₹{rate.extra_hour_rate || 0}</span>
                                        </div>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Extra KM:</span>
                                          <span className="rate-value">₹{rate.extra_km_rate || 0}</span>
                                        </div>
                                      </>
                                    ) : serviceType === 'airport' ? (
                                      <>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Per KM:</span>
                                          <span className="rate-value">₹{rate.per_km_rate}</span>
                                        </div>
                                        <div className="rate-detail-item" style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                          (Fare will be doubled)
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Trip Type:</span>
                                          <span className="rate-value">
                                            {rate.trip_type === 'one_way' ? 'One Way' : 
                                             rate.trip_type === 'round_trip' ? 'Round Trip' : 
                                             rate.trip_type === 'multiple_way' ? 'Multiple Way' : '-'}
                                          </span>
                                        </div>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Base Fare:</span>
                                          <span className="rate-value">₹{rate.base_fare}</span>
                                        </div>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Per KM:</span>
                                          <span className="rate-value">₹{rate.per_km_rate}</span>
                                        </div>
                                      </>
                                    )}
                                    <div className="rate-status">
                                      <span className={`status-badge ${rate.is_active ? 'active' : 'inactive'}`}>
                                        {rate.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}

              {/* Cab Types are now shown inside the Rate Meter section instead of a separate subsection */}
              {rateMeterSubsection === 'rate-meters' && (
                <div style={{ marginTop: '40px' }}>
                  <div className="section-header">
                    <h2>Cab Types</h2>
                    <button onClick={openCreateForm} className="btn btn-primary" style={{ color: '#000' }}>
                      + Add Cab Type
                    </button>
                  </div>
                  
                  <div className="cab-types-hierarchical">
                    {cabTypes.map((ct) => {
                      const isExpanded = expandedCabTypes[ct.id];
                      const carsBySubtype = cabTypeCars[ct.id] || {};
                      const subtypes = Object.keys(carsBySubtype).sort();
                      
                      return (
                        <div key={ct.id} className="cab-type-section">
                          <div className="cab-type-header" onClick={() => toggleCabTypeExpansion(ct.id)}>
                            <div className="cab-type-header-left">
                              <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                              <h3>{ct.name}</h3>
                              <span className="cab-type-info">
                                ₹{ct.base_fare} base + ₹{ct.per_km_rate}/km
                                {ct.per_minute_rate > 0 && ` + ₹${ct.per_minute_rate}/min`}
                              </span>
                            </div>
                            <div className="cab-type-header-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditForm(ct);
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete('cab-types', ct.id);
                                }}
                                className="btn btn-danger btn-sm"
                              >
                                Delete
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddCarModal(ct.id);
                                }}
                                className="btn btn-primary btn-sm"
                              >
                                + Add Car
                              </button>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="cab-type-content">
                              {subtypes.length === 0 ? (
                                <div className="no-cars-message">
                                  <p>No cars assigned to this cab type yet.</p>
                                  <button
                                    onClick={() => openAddCarModal(ct.id)}
                                    className="btn btn-primary btn-sm"
                                  >
                                    + Add Car
                                  </button>
                                </div>
                              ) : (
                                subtypes.map((subtype) => (
                                  <div key={subtype} className="car-subtype-section">
                                    <h4 className="subtype-header">{subtype}</h4>
                                    <div className="cars-grid">
                                      {carsBySubtype[subtype].map((car) => (
                                        <div key={car.id} className="car-card">
                                          {car.image_url && (
                                            <img src={getImageUrl(car.image_url)} alt={car.name} className="car-card-image" />
                                          )}
                                          <div className="car-card-content">
                                            <h5>{car.name}</h5>
                                            {car.description && <p>{car.description}</p>}
                                          </div>
                                          <button
                                            onClick={() => handleRemoveCarFromCabType(car.id)}
                                            className="btn btn-danger btn-sm car-remove-btn"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Car Options and standalone Cab Details subsections have been removed from Rate Meter.
                  Car models for marketing are still managed via existing data, but not as separate fleet tabs. */}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div>
              <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Bookings</h2>
                <button 
                  onClick={exportBookingsToCSV}
                  className="btn btn-primary"
                  style={{ 
                    color: '#000',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  📊 Export to CSV
                </button>
              </div>
              
              <div className="booking-filters-box">
                <div className="booking-filters">
                  <div className="filter-group filter-group-status-toggle">
                    <label>Status</label>
                    <div className="status-toggle-group">
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'confirmed' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'confirmed' ? 'all' : 'confirmed',
                          }))
                        }
                      >
                        Confirmed
                      </button>
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'cancelled' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'cancelled' ? 'all' : 'cancelled',
                          }))
                        }
                      >
                        Cancelled
                      </button>
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'completed' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'completed' ? 'all' : 'completed',
                          }))
                        }
                      >
                        Completed
                      </button>
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'pending' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'pending' ? 'all' : 'pending',
                          }))
                        }
                      >
                        Pending
                      </button>
                    </div>
                  </div>
                  <div className="filter-group">
                    <label>Service Type</label>
                    <select
                      value={bookingFilters.serviceType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          serviceType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Cab Type</label>
                    <select
                      value={bookingFilters.cabType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          cabType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      {cabTypes.filter(ct => ct.is_active).map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>From</label>
                    <input
                      type="date"
                      value={bookingFilters.fromDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group">
                    <label>To</label>
                    <input
                      type="date"
                      value={bookingFilters.toDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group filter-search">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Name, phone, email, locations, ID..."
                      value={bookingFilters.search}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Details</th>
                      <th>Cab Type</th>
                      <th>Category</th>
                      <th>Passenger</th>
                      <th>Phone</th>
                      <th>Fare</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {filteredAndGroupedBookings().map(
                    ([groupKey, group]) => (
                      <React.Fragment key={groupKey}>
                        <tr className="booking-group-row">
                          <td colSpan="11">
                            <div className="booking-group-header">
                              <span className="booking-group-title">
                                {group.userLabel}
                              </span>
                              <span className="booking-group-meta">
                                {group.bookings.length} booking
                                {group.bookings.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {group.bookings.map((booking) => (
                          <tr 
                            key={booking.id}
                            className="booking-table-row"
                            onClick={() => handleBookingClick(booking)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td data-label="ID">#{booking.id}</td>
                            <td data-label="Service">
                              <span className={`service-badge ${booking.service_type || 'local'}`}>
                                {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                              </span>
                            </td>
                            <td data-label="Details">
                              {booking.service_type === 'local' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>
                                    <strong>From:</strong> {booking.from_location || '-'}
                                  </div>
                                  {booking.number_of_hours && (
                                    <div>
                                      <strong>Hours:</strong> {booking.number_of_hours} hrs
                                    </div>
                                  )}
                                </div>
                              ) : booking.service_type === 'airport' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>
                                    <strong>From:</strong> {booking.from_location || '-'}
                                  </div>
                                  <div>
                                    <strong>To:</strong> {booking.to_location && booking.to_location !== 'N/A' ? booking.to_location : '-'}
                                  </div>
                                </div>
                              ) : booking.service_type === 'outstation' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {booking.trip_type ? (
                                    <>
                                      <div>
                                        <strong>Trip Type:</strong>{' '}
                                        {booking.trip_type === 'one_way' ? 'One Way' :
                                         booking.trip_type === 'round_trip' ? 'Round Trip' :
                                         booking.trip_type === 'multiple_way' ? 'Multiple Way' :
                                         booking.trip_type}
                                      </div>
                                      {booking.trip_type === 'one_way' && (
                                        <>
                                          {booking.from_location && (
                                            <div>
                                              <strong>From:</strong> {booking.from_location}
                                            </div>
                                          )}
                                          {booking.to_location && booking.to_location !== 'N/A' && (
                                            <div>
                                              <strong>To:</strong> {booking.to_location}
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {booking.trip_type === 'round_trip' && booking.from_location && (
                                        <div>
                                          <strong>Pickup:</strong> {booking.from_location}
                                        </div>
                                      )}
                                      {booking.trip_type === 'multiple_way' && (
                                        <>
                                          {booking.from_location && (
                                            <div>
                                              <strong>From:</strong> {booking.from_location}
                                            </div>
                                          )}
                                          {booking.to_location && booking.to_location !== 'N/A' && (
                                            <div>
                                              <strong>Route:</strong> {booking.to_location}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {booking.from_location && (
                                        <div>
                                          <strong>From:</strong> {booking.from_location}
                                        </div>
                                      )}
                                      {booking.to_location && booking.to_location !== 'N/A' && (
                                        <div>
                                          <strong>To:</strong> {booking.to_location}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td data-label="Cab Type">{booking.cab_type_name}</td>
                            <td data-label="Category">{booking.car_option_name || '-'}</td>
                            <td data-label="Passenger">{booking.passenger_name}</td>
                            <td data-label="Phone">{booking.passenger_phone}</td>
                            <td data-label="Fare">₹{booking.fare_amount}</td>
                            <td data-label="Status">
                              <select
                                value={booking.booking_status}
                                onChange={(e) =>
                                  updateBookingStatus(
                                    booking.id,
                                    e.target.value
                                  )
                                }
                                className="status-select"
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="in_progress">
                                  In Progress
                                </option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td data-label="Date">
                              <div>{formatIndianDateTime(booking.booking_date)}</div>
                              <div style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '4px' }}>
                                {formatIndianTime(booking.booking_date)}
                              </div>
                            </td>
                            <td data-label="Actions">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(booking.id);
                                  alert('Booking ID copied!');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Copy ID
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadReceipt(booking.id);
                                }}
                                className="btn btn-primary btn-sm"
                              >
                                Receipt
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Enquiries Section */}
          {activeTab === 'enquiries' && hasAccess('enquiries') && (
            <div>
              <div className="section-header">
                <h2>Enquiries - Received Bookings</h2>
              </div>
              
              <div className="booking-filters-box">
                <div className="booking-filters">
                  <div className="filter-group filter-group-status-toggle">
                    <label>Status</label>
                    <div className="status-toggle-group">
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'confirmed' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'confirmed' ? 'all' : 'confirmed',
                          }))
                        }
                      >
                        Confirmed
                      </button>
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'cancelled' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'cancelled' ? 'all' : 'cancelled',
                          }))
                        }
                      >
                        Cancelled
                      </button>
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'completed' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'completed' ? 'all' : 'completed',
                          }))
                        }
                      >
                        Completed
                      </button>
                      <button
                        type="button"
                        className={`status-toggle-btn ${bookingFilters.status === 'pending' ? 'active' : ''}`}
                        onClick={() =>
                          setBookingFilters((prev) => ({
                            ...prev,
                            status: prev.status === 'pending' ? 'all' : 'pending',
                          }))
                        }
                      >
                        Pending
                      </button>
                    </div>
                  </div>
                  <div className="filter-group">
                    <label>Service Type</label>
                    <select
                      value={bookingFilters.serviceType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          serviceType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Cab Type</label>
                    <select
                      value={bookingFilters.cabType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          cabType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      {cabTypes.filter(ct => ct.is_active).map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={bookingFilters.fromDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={bookingFilters.toDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group filter-search">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Name, phone, email, locations, ID..."
                      value={bookingFilters.search}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Details</th>
                      <th>Passenger</th>
                      <th>Phone</th>
                      <th>Fare</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Regular Bookings */}
                    {(() => {
                      // Apply filters
                      const filtered = bookings.filter((booking) => {
                        // Status filter
                        if (bookingFilters.status !== 'all' && booking.booking_status !== bookingFilters.status) {
                          return false;
                        }
                        // Service type filter
                        if (bookingFilters.serviceType !== 'all' && booking.service_type !== bookingFilters.serviceType) {
                          return false;
                        }
                        // Cab type filter
                        if (bookingFilters.cabType !== 'all' && (!booking.cab_type_id || booking.cab_type_id !== parseInt(bookingFilters.cabType))) {
                          return false;
                        }
                        // Date range filter
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(booking.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(booking.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        // Search filter
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            booking.id,
                            booking.passenger_name,
                            booking.passenger_phone,
                            booking.passenger_email,
                            booking.from_location,
                            booking.to_location,
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
                    })().map((booking) => (
                        <tr key={`booking-${booking.id}`}>
                          <td>#{booking.id}</td>
                          <td>
                            <span className={`service-badge ${booking.service_type || 'local'}`}>
                              {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                            </span>
                          </td>
                          <td>
                            {booking.from_location && <div><strong>From:</strong> {booking.from_location}</div>}
                            {booking.to_location && booking.to_location !== 'N/A' && <div><strong>To:</strong> {booking.to_location}</div>}
                          </td>
                          <td>{booking.passenger_name || '-'}</td>
                          <td>{booking.passenger_phone || '-'}</td>
                          <td>₹{booking.fare_amount || 0}</td>
                          <td>{formatIndianDateTime(booking.booking_date)}</td>
                          <td>
                            <span className={`status-badge ${booking.booking_status}`}>
                              {booking.booking_status}
                            </span>
                          </td>
                          <td>
                            {booking.booking_status !== 'confirmed' && (
                              <button
                                onClick={() => handleConfirmBooking(booking.id)}
                                className="btn btn-primary btn-sm"
                                style={{ marginRight: '8px' }}
                              >
                                Confirm
                              </button>
                            )}
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="btn btn-danger btn-sm"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    {/* Corporate Bookings - only show if user has permission */}
                    {(user?.role === 'admin' || hasAccess('event-bookings')) && corporateBookings
                      .sort((a, b) => new Date(b.created_at || b.booking_date) - new Date(a.created_at || a.booking_date))
                      .map((cb) => (
                        <tr key={`corporate-${cb.id}`}>
                          <td>#{cb.id} <span style={{ fontSize: '11px', color: '#6b7280' }}>(Corporate)</span></td>
                          <td>
                            <span className={`service-badge ${cb.service_type || 'local'}`}>
                              {(cb.service_type || 'local').charAt(0).toUpperCase() + (cb.service_type || 'local').slice(1)}
                            </span>
                          </td>
                          <td>
                            {cb.pickup_point && <div><strong>From:</strong> {cb.pickup_point}</div>}
                            {cb.company_name && <div><strong>Company:</strong> {cb.company_name}</div>}
                            {cb.travel_date && <div><strong>Travel Date:</strong> {cb.travel_date}</div>}
                            {cb.travel_time && <div><strong>Travel Time:</strong> {cb.travel_time}</div>}
                          </td>
                          <td>{cb.name || '-'}</td>
                          <td>{cb.phone_number || '-'}</td>
                          <td>₹{cb.fare_amount || 0}</td>
                          <td>{formatIndianDateTime(cb.created_at)}</td>
                          <td>
                            <span className={`status-badge ${cb.status || 'pending'}`}>
                              {cb.status || 'pending'}
                            </span>
                          </td>
                          <td>
                            {(cb.status || 'pending') !== 'confirmed' && (
                              <button
                                onClick={() => handleConfirmCorporateBooking(cb.id)}
                                className="btn btn-primary btn-sm"
                                style={{ marginRight: '8px' }}
                              >
                                Confirm
                              </button>
                            )}
                            <button
                              onClick={() => handleCancelCorporateBooking(cb.id)}
                              className="btn btn-danger btn-sm"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    {bookings.length === 0 && ((user?.role === 'admin' || hasAccess('event-bookings')) ? corporateBookings.length : 0) === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                          No enquiries found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirmed Bookings Section */}
          {activeTab === 'confirmed-bookings' && hasAccess('confirmed-bookings') && (
            <div>
              <div className="section-header">
                <h2>Confirmed Bookings</h2>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Details</th>
                      <th>Passenger</th>
                      <th>Phone</th>
                      <th>Driver</th>
                      <th>Car</th>
                      <th>Fare</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (b.booking_status !== 'confirmed') return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.cabType !== 'all' && (!b.cab_type_id || b.cab_type_id !== parseInt(bookingFilters.cabType))) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
                    })().map((booking) => {
                        const sel = assignSelections[booking.id] || {};
                        const alreadyAssigned = !!booking.driver_id || !!booking.driver_name;
                        const isReassigning = reassigning[booking.id];
                        return (
                          <tr key={booking.id} onClick={() => !isReassigning && handleBookingClick(booking)} style={{ cursor: isReassigning ? 'default' : 'pointer' }}>
                            <td>#{booking.id}</td>
                            <td>
                              <span className={`service-badge ${booking.service_type || 'local'}`}>
                                {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                              </span>
                            </td>
                            <td>
                              {booking.from_location && <div><strong>From:</strong> {booking.from_location}</div>}
                              {booking.to_location && booking.to_location !== 'N/A' && <div><strong>To:</strong> {booking.to_location}</div>}
                            </td>
                            <td>{booking.passenger_name || '-'}</td>
                            <td>{booking.passenger_phone || '-'}</td>
                            <td>
                              {booking.driver_name ? (
                                <div>
                                  <strong>{booking.driver_name}</strong>
                                  {booking.driver_phone && (
                                    <div style={{ fontSize: '0.85em', color: '#6b7280' }}>
                                      {booking.driver_phone}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not assigned</span>
                              )}
                            </td>
                            <td>
                              {booking.vehicle_number ? (
                                <div>
                                  <strong>{booking.vehicle_number}</strong>
                                  {booking.cab_type_name && (
                                    <div style={{ fontSize: '0.85em', color: '#6b7280' }}>
                                      {booking.cab_type_name}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not assigned</span>
                              )}
                            </td>
                            <td>₹{booking.fare_amount || 0}</td>
                            <td>{formatIndianDateTime(booking.booking_date)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {isReassigning ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                                  <select
                                    value={sel.driver_id || ''}
                                    onChange={(e) => {
                                      setAssignSelections((prev) => ({
                                        ...prev,
                                        [booking.id]: { ...prev[booking.id], driver_id: e.target.value ? parseInt(e.target.value) : null }
                                      }));
                                    }}
                                    style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ddd' }}
                                  >
                                    <option value="">Select Driver</option>
                                    {drivers.filter(d => d.is_active !== 0).map((driver) => (
                                      <option key={driver.id} value={driver.id}>
                                        {driver.name} - {driver.phone}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={sel.cab_id || ''}
                                    onChange={(e) => {
                                      setAssignSelections((prev) => ({
                                        ...prev,
                                        [booking.id]: { ...prev[booking.id], cab_id: e.target.value ? parseInt(e.target.value) : null }
                                      }));
                                    }}
                                    style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ddd' }}
                                  >
                                    <option value="">Select Car</option>
                                    {cabs.filter(c => c.is_active !== 0 && c.is_active !== false).map((cab) => (
                                      <option key={cab.id} value={cab.id}>
                                        {cab.vehicle_number} {cab.cab_type_name ? `(${cab.cab_type_name})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleAssignDriver(booking.id)}
                                      style={{ padding: '4px 8px', fontSize: '12px' }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => {
                                        setReassigning((prev) => ({ ...prev, [booking.id]: false }));
                                        setAssignSelections((prev) => {
                                          const newState = { ...prev };
                                          delete newState[booking.id];
                                          return newState;
                                        });
                                      }}
                                      style={{ padding: '4px 8px', fontSize: '12px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleBookingClick(booking)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReassigning((prev) => ({ ...prev, [booking.id]: true }));
                                      if (alreadyAssigned && booking.driver_id) {
                                        setAssignSelections((prev) => ({
                                          ...prev,
                                          [booking.id]: { driver_id: booking.driver_id }
                                        }));
                                      }
                                    }}
                                    className={alreadyAssigned ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                  >
                                    {alreadyAssigned ? 'Reassign' : 'Assign'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (b.booking_status !== 'confirmed') return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.cabType !== 'all' && (!b.cab_type_id || b.cab_type_id !== parseInt(bookingFilters.cabType))) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.length === 0;
                    })() && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                          No confirmed bookings found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Driver Assigned Section */}
          {activeTab === 'driver-assigned' && (
            <div>
              <div className="section-header">
                <h2>Driver Assigned Bookings</h2>
              </div>
              
              <div className="booking-filters-box">
                <div className="booking-filters">
                  <div className="filter-group">
                    <label>Service Type</label>
                    <select
                      value={bookingFilters.serviceType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          serviceType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={bookingFilters.fromDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={bookingFilters.toDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group filter-search">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Name, phone, email, locations, ID..."
                      value={bookingFilters.search}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Passenger</th>
                      <th>Driver Name</th>
                      <th>Driver Phone</th>
                      <th>Vehicle Number</th>
                      <th>Fare</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (!(b.driver_name || b.driver_phone || b.vehicle_number)) return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location, b.driver_name, b.driver_phone, b.vehicle_number
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
                    })().map((booking) => (
                        <tr key={booking.id} onClick={() => handleBookingClick(booking)} style={{ cursor: 'pointer' }}>
                          <td>#{booking.id}</td>
                          <td>
                            <span className={`service-badge ${booking.service_type || 'local'}`}>
                              {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                            </span>
                          </td>
                          <td>{booking.passenger_name || '-'}</td>
                          <td><strong>{booking.driver_name || '-'}</strong></td>
                          <td>{booking.driver_phone || '-'}</td>
                          <td>{booking.vehicle_number || '-'}</td>
                          <td>₹{booking.fare_amount || 0}</td>
                          <td>{formatIndianDateTime(booking.booking_date)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleBookingClick(booking)}
                              className="btn btn-secondary btn-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    {bookings.filter(b => b.driver_name || b.driver_phone || b.vehicle_number).length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                          No bookings with assigned drivers found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trip End Section */}
          {activeTab === 'trip-end' && hasAccess('trip-end') && (
            <div>
              <div className="section-header">
                <h2>Trip End - Completed Trips</h2>
              </div>
              
              <div className="booking-filters-box">
                <div className="booking-filters">
                  <div className="filter-group">
                    <label>Service Type</label>
                    <select
                      value={bookingFilters.serviceType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          serviceType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={bookingFilters.fromDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={bookingFilters.toDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group filter-search">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Name, phone, email, locations, ID..."
                      value={bookingFilters.search}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Passenger</th>
                      <th>Phone</th>
                      <th>Fare</th>
                      <th>Date</th>
                      <th>Invoice Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (b.booking_status !== 'completed') return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
                    })().map((booking) => (
                        <tr key={booking.id}>
                          <td>#{booking.id}</td>
                          <td>
                            <span className={`service-badge ${booking.service_type || 'local'}`}>
                              {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                            </span>
                          </td>
                          <td>{booking.passenger_name || '-'}</td>
                          <td>{booking.passenger_phone || '-'}</td>
                          <td>₹{booking.fare_amount || 0}</td>
                          <td>{formatIndianDateTime(booking.booking_date)}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button
                                onClick={() => downloadReceipt(booking.id, true)}
                                className="btn btn-primary btn-sm"
                                style={{ marginBottom: '4px' }}
                              >
                                📥 Download (With GST)
                              </button>
                              <button
                                onClick={() => downloadReceipt(booking.id, false)}
                                className="btn btn-secondary btn-sm"
                                style={{ marginBottom: '4px' }}
                              >
                                📥 Download (Without GST)
                              </button>
                              <button
                                onClick={() => sendInvoiceEmail(booking.id, true)}
                                className="btn btn-primary btn-sm"
                                style={{ marginBottom: '4px' }}
                              >
                                📧 Email (With GST)
                              </button>
                              <button
                                onClick={() => sendInvoiceEmail(booking.id, false)}
                                className="btn btn-secondary btn-sm"
                              >
                                📧 Email (Without GST)
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (b.booking_status !== 'completed') return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.length === 0;
                    })() && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                          No completed trips found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cancelled Bookings Section */}
          {activeTab === 'cancelled-bookings' && hasAccess('cancelled-bookings') && (
            <div>
              <div className="section-header">
                <h2>Cancelled Bookings</h2>
              </div>
              
              <div className="booking-filters-box">
                <div className="booking-filters">
                  <div className="filter-group">
                    <label>Service Type</label>
                    <select
                      value={bookingFilters.serviceType}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          serviceType: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="local">Local</option>
                      <option value="airport">Airport</option>
                      <option value="outstation">Outstation</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={bookingFilters.fromDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={bookingFilters.toDate}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="filter-group filter-search">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Name, phone, email, locations, ID..."
                      value={bookingFilters.search}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Details</th>
                      <th>Passenger</th>
                      <th>Phone</th>
                      <th>Fare</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (b.booking_status !== 'cancelled') return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
                    })().map((booking) => (
                        <tr key={booking.id} onClick={() => handleBookingClick(booking)} style={{ cursor: 'pointer' }}>
                          <td>#{booking.id}</td>
                          <td>
                            <span className={`service-badge ${booking.service_type || 'local'}`}>
                              {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                            </span>
                          </td>
                          <td>
                            {booking.from_location && <div><strong>From:</strong> {booking.from_location}</div>}
                            {booking.to_location && booking.to_location !== 'N/A' && <div><strong>To:</strong> {booking.to_location}</div>}
                          </td>
                          <td>{booking.passenger_name || '-'}</td>
                          <td>{booking.passenger_phone || '-'}</td>
                          <td>₹{booking.fare_amount || 0}</td>
                          <td>{formatIndianDateTime(booking.booking_date)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleBookingClick(booking)}
                              className="btn btn-secondary btn-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    {(() => {
                      const filtered = bookings.filter((b) => {
                        if (b.booking_status !== 'cancelled') return false;
                        if (bookingFilters.serviceType !== 'all' && b.service_type !== bookingFilters.serviceType) return false;
                        if (bookingFilters.fromDate) {
                          const bookingDate = new Date(b.booking_date);
                          const from = new Date(bookingFilters.fromDate);
                          if (bookingDate < from) return false;
                        }
                        if (bookingFilters.toDate) {
                          const bookingDate = new Date(b.booking_date);
                          const to = new Date(bookingFilters.toDate);
                          to.setHours(23, 59, 59, 999);
                          if (bookingDate > to) return false;
                        }
                        if (bookingFilters.search) {
                          const search = bookingFilters.search.toLowerCase();
                          const haystack = [
                            b.id, b.passenger_name, b.passenger_phone, b.passenger_email,
                            b.from_location, b.to_location
                          ].filter(Boolean).join(' ').toLowerCase();
                          if (!haystack.includes(search)) return false;
                        }
                        return true;
                      });
                      return filtered.length === 0;
                    })() && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                          No cancelled bookings found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Driver Status Section */}
          {activeTab === 'driver-status' && (
            <div>
              <div className="section-header">
                <h2>Driver Status - Availability & Rides</h2>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>License</th>
                      <th>Status</th>
                      <th>Total Rides</th>
                      <th>Current Assignment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => {
                      const driverBookings = bookings.filter(b => 
                        b.driver_id === driver.id || 
                        (b.driver_name && b.driver_name.toLowerCase() === driver.name.toLowerCase())
                      );
                      const activeBookings = driverBookings.filter(b => 
                        b.booking_status === 'confirmed' || b.booking_status === 'in_progress'
                      );
                      const totalRides = driverBookings.filter(b => 
                        b.booking_status === 'completed'
                      ).length;
                      
                      return (
                        <tr key={driver.id}>
                          <td><strong>{driver.name || '-'}</strong></td>
                          <td>{driver.phone || '-'}</td>
                          <td>{driver.email || '-'}</td>
                          <td>{driver.license_number || '-'}</td>
                          <td>
                            <span className={`status-badge ${activeBookings.length > 0 ? 'in_progress' : 'available'}`}>
                              {activeBookings.length > 0 ? 'Assigned' : 'Available'}
                            </span>
                          </td>
                          <td><strong>{totalRides}</strong></td>
                          <td>
                            {activeBookings.length > 0 ? (
                              <div>
                                {activeBookings.map(b => (
                                  <div key={b.id} style={{ marginBottom: '4px' }}>
                                    Booking #{b.id} - {b.passenger_name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#16a34a' }}>Available</span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                setEditingItem(driver);
                                setShowForm(true);
                              }}
                              className="btn btn-secondary btn-sm"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {drivers.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                          No drivers registered
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'create-invoice' && hasAccess('bills-invoices') && (
            <div>
              <div className="section-header">
                <h2>Create Invoice</h2>
              </div>
              <div className="card" style={{ padding: '30px', marginTop: '20px' }}>
                <h3 style={{ marginBottom: '20px' }}>Create New Invoice</h3>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      // Calculate totals
                      const serviceAmount = parseFloat(invoiceFormData.service_amount || 0);
                      const tollTax = parseFloat(invoiceFormData.toll_tax || 0);
                      const stateTax = parseFloat(invoiceFormData.state_tax || 0);
                      const driverBatta = parseFloat(invoiceFormData.driver_batta || 0);
                      const parkingCharges = parseFloat(invoiceFormData.parking_charges || 0);
                      const placardCharges = parseFloat(invoiceFormData.placard_charges || 0);
                      const extras = parseFloat(invoiceFormData.extras || 0);
                      const subTotal = serviceAmount + tollTax + stateTax + driverBatta + parkingCharges + placardCharges + extras;
                      const gstRate = 0.18;
                      const gstAmount = invoiceFormData.with_gst ? (subTotal * gstRate) : 0;
                      const cgstAmount = invoiceFormData.with_gst ? (gstAmount / 2) : 0;
                      const sgstAmount = invoiceFormData.with_gst ? (gstAmount / 2) : 0;
                      const grandTotal = subTotal + gstAmount;

                      const payload = {
                        ...invoiceFormData,
                        service_amount: serviceAmount,
                        toll_tax: tollTax,
                        state_tax: stateTax,
                        driver_batta: driverBatta,
                        parking_charges: parkingCharges,
                        placard_charges: placardCharges,
                        extras: extras,
                        sub_total: subTotal,
                        gst_amount: gstAmount,
                        cgst_amount: cgstAmount,
                        sgst_amount: sgstAmount,
                        grand_total: grandTotal,
                        with_gst: invoiceFormData.with_gst ? 1 : 0
                      };

                      await api.post('/admin/invoices', payload);
                      alert('Invoice created successfully!');
                      // Reset form
                      setInvoiceFormData({
                        invoice_no: '',
                        invoice_date: new Date().toISOString().split('T')[0],
                        company_gstin: '29AHYPC7622F1ZZ',
                        hsn_sac: '996411',
                        customer_name: '',
                        customer_address: '',
                        customer_phone: '',
                        customer_email: '',
                        customer_state: '',
                        customer_gst: '',
                        service_description: '',
                        sl_no: '1',
                        total_kms: '0',
                        no_of_days: '-',
                        rate_details: '',
                        service_amount: '0',
                        toll_tax: '0',
                        state_tax: '0',
                        driver_batta: '0',
                        parking_charges: '0',
                        placard_charges: '0',
                        extras: '0',
                        with_gst: false
                      });
                      // Refresh invoices list
                      const invoicesRes = await api.get('/admin/invoices');
                      setInvoices(invoicesRes.data);
                      // Switch to bills-invoices tab to view the new invoice
                      setActiveTab('bills-invoices');
                    } catch (error) {
                      console.error('Error creating invoice:', error);
                      alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Error creating invoice');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                      <div className="form-group">
                        <label>Invoice Number *</label>
                        <input
                          type="text"
                          value={invoiceFormData.invoice_no}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_no: e.target.value })}
                          required
                          placeholder="e.g., NC-001"
                        />
                      </div>
                      <div className="form-group">
                        <label>Invoice Date *</label>
                        <input
                          type="date"
                          value={invoiceFormData.invoice_date}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>With GST</label>
                        <select
                          value={invoiceFormData.with_gst ? 'yes' : 'no'}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, with_gst: e.target.value === 'yes' })}
                        >
                          <option value="no">Without GST</option>
                          <option value="yes">With GST</option>
                        </select>
                      </div>
                      {invoiceFormData.with_gst && (
                        <>
                          <div className="form-group">
                            <label>Company GSTIN</label>
                            <input
                              type="text"
                              value={invoiceFormData.company_gstin}
                              onChange={(e) => setInvoiceFormData({ ...invoiceFormData, company_gstin: e.target.value })}
                              placeholder="29AHYPC7622F1ZZ"
                            />
                          </div>
                          <div className="form-group">
                            <label>HSN/SAC</label>
                            <input
                              type="text"
                              value={invoiceFormData.hsn_sac}
                              onChange={(e) => setInvoiceFormData({ ...invoiceFormData, hsn_sac: e.target.value })}
                              placeholder="996411"
                            />
                          </div>
                        </>
                      )}
                      <div className="form-group">
                        <label>Customer Name *</label>
                        <input
                          type="text"
                          value={invoiceFormData.customer_name}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, customer_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Customer Address</label>
                        <textarea
                          value={invoiceFormData.customer_address}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, customer_address: e.target.value })}
                          rows="3"
                        />
                      </div>
                      <div className="form-group">
                        <label>Customer Phone</label>
                        <input
                          type="tel"
                          value={invoiceFormData.customer_phone}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, customer_phone: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Customer Email</label>
                        <input
                          type="email"
                          value={invoiceFormData.customer_email}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, customer_email: e.target.value })}
                        />
                      </div>
                      {invoiceFormData.with_gst && (
                        <>
                          <div className="form-group">
                            <label>Customer State</label>
                            <input
                              type="text"
                              value={invoiceFormData.customer_state}
                              onChange={(e) => setInvoiceFormData({ ...invoiceFormData, customer_state: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Customer GST</label>
                            <input
                              type="text"
                              value={invoiceFormData.customer_gst}
                              onChange={(e) => setInvoiceFormData({ ...invoiceFormData, customer_gst: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Service Description</label>
                        <textarea
                          value={invoiceFormData.service_description}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, service_description: e.target.value })}
                          rows="4"
                          placeholder="Service details, pickup/drop locations, etc."
                        />
                      </div>
                      <div className="form-group">
                        <label>SL No</label>
                        <input
                          type="text"
                          value={invoiceFormData.sl_no}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, sl_no: e.target.value })}
                          placeholder="1"
                        />
                      </div>
                      <div className="form-group">
                        <label>Total KMs</label>
                        <input
                          type="text"
                          value={invoiceFormData.total_kms}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, total_kms: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group">
                        <label>No. of Days</label>
                        <input
                          type="text"
                          value={invoiceFormData.no_of_days}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, no_of_days: e.target.value })}
                          placeholder="-"
                        />
                      </div>
                      <div className="form-group">
                        <label>Rate Details</label>
                        <input
                          type="text"
                          value={invoiceFormData.rate_details}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, rate_details: e.target.value })}
                          placeholder="Cab type, category, etc."
                        />
                      </div>
                      <div className="form-group">
                        <label>Service Amount (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.service_amount}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, service_amount: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Toll Tax (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.toll_tax}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, toll_tax: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>State Tax (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.state_tax}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, state_tax: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Driver Batta (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.driver_batta}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, driver_batta: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Parking Charges (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.parking_charges}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, parking_charges: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Placard Charges (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.placard_charges}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, placard_charges: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Extras (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={invoiceFormData.extras}
                          onChange={(e) => setInvoiceFormData({ ...invoiceFormData, extras: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Invoice'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setActiveTab('bills-invoices')}
                      >
                        Cancel
                      </button>
                    </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'bills-invoices' && hasAccess('bills-invoices') && (
            <div>
              <div className="section-header">
                <h2>Bills and Invoices</h2>
              </div>
              <div className="booking-filters-box" style={{ marginTop: '20px', marginBottom: '20px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '600' }}>Filter:</label>
                    <select
                      value={billsFilter}
                      onChange={(e) => setBillsFilter(e.target.value)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">All</option>
                      <option value="bookings">Regular Bookings</option>
                      <option value="corporate">Corporate Bookings</option>
                      <option value="invoices">Manual Invoices</option>
                    </select>
                  </div>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID/Invoice No</th>
                          <th>Type</th>
                          <th>Customer/Passenger</th>
                          <th>Service Type</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Amount (₹)</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let displayData = [];
                          const hasCorporateAccess = user?.role === 'admin' || hasAccess('bills-invoices');
                          if (billsFilter === 'all') {
                            displayData = [
                              ...bookings.map(b => ({ ...b, type: 'booking' })),
                              ...(hasCorporateAccess ? corporateBookings.map(cb => ({ ...cb, type: 'corporate', id: cb.id, passenger_name: cb.name, passenger_phone: cb.phone_number, service_type: cb.service_type || 'local', from_location: cb.pickup_point, to_location: cb.drop_point || '-', fare_amount: cb.fare_amount || 0, booking_status: cb.status, booking_date: cb.created_at })) : []),
                              ...invoices.map(inv => ({ ...inv, type: 'invoice', id: inv.id, passenger_name: inv.customer_name, passenger_phone: inv.customer_phone, service_type: 'local', from_location: inv.customer_address, to_location: 'N/A', fare_amount: inv.grand_total, booking_status: 'completed', booking_date: inv.invoice_date }))
                            ];
                          } else if (billsFilter === 'bookings') {
                            displayData = bookings.map(b => ({ ...b, type: 'booking' }));
                          } else if (billsFilter === 'corporate') {
                            displayData = hasCorporateAccess ? corporateBookings.map(cb => ({ ...cb, type: 'corporate', id: cb.id, passenger_name: cb.name, passenger_phone: cb.phone_number, service_type: cb.service_type || 'local', from_location: cb.pickup_point, to_location: cb.drop_point || '-', fare_amount: cb.fare_amount || 0, booking_status: cb.status, booking_date: cb.created_at })) : [];
                          } else if (billsFilter === 'invoices') {
                            displayData = invoices.map(inv => ({ ...inv, type: 'invoice', id: inv.id, passenger_name: inv.customer_name, passenger_phone: inv.customer_phone, service_type: 'local', from_location: inv.customer_address, to_location: 'N/A', fare_amount: inv.grand_total, booking_status: 'completed', booking_date: inv.invoice_date }));
                          }
                          
                          // Sort by date (most recent first)
                          displayData.sort((a, b) => {
                            const dateA = new Date(a.booking_date || a.created_at || a.invoice_date || 0);
                            const dateB = new Date(b.booking_date || b.created_at || b.invoice_date || 0);
                            return dateB - dateA;
                          });
                          
                          if (displayData.length === 0) {
                            return (
                              <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                                  <p className="text-muted">No records found</p>
                                </td>
                              </tr>
                            );
                          }
                          
                          return displayData.map((item) => (
                            <tr key={`${item.type}-${item.id}`} className="booking-table-row">
                              <td>
                                <strong style={{ color: '#16a34a' }}>
                                  {item.type === 'invoice' ? item.invoice_no : `#${item.id}`}
                                </strong>
                              </td>
                              <td>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  backgroundColor: item.type === 'corporate' ? '#dbeafe' : item.type === 'invoice' ? '#fef3c7' : '#f3f4f6',
                                  color: item.type === 'corporate' ? '#1e40af' : item.type === 'invoice' ? '#92400e' : '#374151'
                                }}>
                                  {item.type === 'corporate' ? 'Corporate' : item.type === 'invoice' ? 'Invoice' : 'Regular'}
                                </span>
                              </td>
                              <td>
                                <div>
                                  <strong>{item.passenger_name || item.customer_name || '-'}</strong>
                                  <br />
                                  <small style={{ color: '#6b7280' }}>{item.passenger_phone || item.customer_phone || '-'}</small>
                                </div>
                              </td>
                              <td>
                                <span className={`service-badge ${item.service_type || 'local'}`}>
                                  {item.service_type === 'local' ? 'Local' : 
                                   item.service_type === 'airport' ? 'Airport' : 
                                   item.service_type === 'outstation' ? 'Outstation' : 'Local'}
                                </span>
                              </td>
                              <td>{item.from_location || 'N/A'}</td>
                              <td>{item.to_location || 'N/A'}</td>
                              <td>
                                <strong style={{ color: '#16a34a', fontSize: '16px' }}>
                                  ₹{parseFloat(item.fare_amount || item.grand_total || 0).toFixed(2)}
                                </strong>
                              </td>
                              <td>
                                {item.type === 'invoice' ? (
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    backgroundColor: '#d1fae5',
                                    color: '#065f46'
                                  }}>
                                    {item.with_gst ? 'With GST' : 'No GST'}
                                  </span>
                                ) : (
                                  <span className={`status-badge ${item.booking_status || 'pending'}`}>
                                    {item.booking_status || 'pending'}
                                  </span>
                                )}
                              </td>
                              <td>
                                {(item.booking_date || item.invoice_date || item.created_at)
                                  ? new Date(item.booking_date || item.invoice_date || item.created_at).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : '-'}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {item.type === 'booking' ? (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGenerateInvoice(item.id, false);
                                        }}
                                        className="btn btn-secondary btn-sm"
                                        title="Generate Invoice without GST"
                                      >
                                        Invoice (No GST)
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGenerateInvoice(item.id, true);
                                        }}
                                        className="btn btn-primary btn-sm"
                                        title="Generate Invoice with GST"
                                      >
                                        Invoice (GST)
                                      </button>
                                    </>
                                  ) : (item.type === 'invoice' || item.invoice_no) ? (
                                    <>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const invoiceId = item.id || item.invoice_id;
                                            if (!invoiceId) {
                                              alert('Invoice ID not found');
                                              return;
                                            }
                                            const response = await api.get(`/admin/invoices/${invoiceId}/pdf`, {
                                              params: { withGST: false },
                                              responseType: 'blob'
                                            });
                                            const url = window.URL.createObjectURL(new Blob([response.data]));
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', `invoice-${item.invoice_no || invoiceId}-no-gst.pdf`);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                          } catch (error) {
                                            console.error('Error downloading invoice:', error);
                                            alert('Error downloading invoice: ' + (error.response?.data?.error || error.message));
                                          }
                                        }}
                                        className="btn btn-secondary btn-sm"
                                        title="Download Invoice without GST"
                                        style={{ marginRight: '4px' }}
                                      >
                                        Invoice (No GST)
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const invoiceId = item.id || item.invoice_id;
                                            if (!invoiceId) {
                                              alert('Invoice ID not found');
                                              return;
                                            }
                                            const response = await api.get(`/admin/invoices/${invoiceId}/pdf`, {
                                              params: { withGST: true },
                                              responseType: 'blob'
                                            });
                                            const url = window.URL.createObjectURL(new Blob([response.data]));
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', `invoice-${item.invoice_no || invoiceId}-with-gst.pdf`);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                          } catch (error) {
                                            console.error('Error downloading invoice:', error);
                                            alert('Error downloading invoice: ' + (error.response?.data?.error || error.message));
                                          }
                                        }}
                                        className="btn btn-primary btn-sm"
                                        title="Download Invoice with GST"
                                      >
                                        Invoice (GST)
                                      </button>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Corporate Booking</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
            </div>
          )}

          {activeTab === 'corporate-all' && hasAccess('event-bookings') && (
            <div>
              <div className="section-header">
                <h2>Corporate Bookings</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600' }}>Filter by Status:</label>
                  <select
                    value={corporateFilter}
                    onChange={(e) => setCorporateFilter(e.target.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Company</th>
                      <th>Type</th>
                      <th>Pickup</th>
                      <th>Drop</th>
                      <th>Fare (₹)</th>
                      <th>Status</th>
                      <th>Driver</th>
                      <th>Cab</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corporateBookings
                      .filter(cb => corporateFilter === 'all' || cb.status === corporateFilter)
                      .map((cb) => (
                        <tr key={cb.id}>
                          <td>{cb.id}</td>
                          <td>{cb.name}</td>
                          <td>{cb.phone_number}</td>
                          <td>{cb.company_name}</td>
                          <td>
                            <span className={`service-badge ${cb.service_type || 'local'}`}>
                              {cb.service_type === 'local' ? 'Local' : 
                               cb.service_type === 'airport' ? 'Airport' : 
                               cb.service_type === 'outstation' ? 'Outstation' : 'Local'}
                            </span>
                          </td>
                          <td>{cb.pickup_point}</td>
                          <td>{cb.drop_point || '-'}</td>
                          <td>
                            <EditableFare 
                              bookingId={cb.id} 
                              initialFare={cb.fare_amount || 0}
                              onUpdate={(newFare) => {
                                setCorporateBookings(prev => 
                                  prev.map(b => b.id === cb.id ? { ...b, fare_amount: newFare } : b)
                                );
                              }}
                            />
                          </td>
                          <td>
                            <span className={`status-badge ${cb.status || 'pending'}`}>
                              {cb.status || 'pending'}
                            </span>
                          </td>
                          <td>
                            {cb.driver_name || cb.driver_name_ref ? (
                              <div>
                                <div><strong>{cb.driver_name || cb.driver_name_ref}</strong></div>
                                {(cb.driver_phone || cb.driver_phone_ref) && (
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {cb.driver_phone || cb.driver_phone_ref}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>-</span>
                            )}
                          </td>
                          <td>
                            {cb.vehicle_number ? (
                              <div>
                                <strong>{cb.vehicle_number}</strong>
                                {cb.cab_type_name && (
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {cb.cab_type_name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>-</span>
                            )}
                          </td>
                          <td>{new Date(cb.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    {((user?.role === 'admin' || hasAccess('event-bookings')) ? corporateBookings.filter(cb => corporateFilter === 'all' || cb.status === corporateFilter).length : 0) === 0 && (
                      <tr>
                        <td colSpan="12" style={{ textAlign: 'center', padding: '40px' }}>
                          <p className="text-muted">No corporate bookings found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {activeTab === 'corporate-export' && hasAccess('bills-invoices') && (
            <div>
              <div className="section-header">
                <h2>Export Corporate Booking Invoices</h2>
              </div>
              <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ marginBottom: '30px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>📥</div>
                  <h3 style={{ marginBottom: '16px', color: '#111827' }}>Export All Corporate Booking Invoices</h3>
                  <p style={{ color: '#6b7280', fontSize: '16px', lineHeight: '1.6' }}>
                    Export all corporate booking invoices with complete details and GST breakdown to an Excel file.
                    The file will include all booking information, driver details, and calculated GST amounts.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const response = await api.get('/admin/corporate-bookings/export/excel', {
                        responseType: 'blob',
                      });

                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      
                      const timestamp = new Date().toISOString().split('T')[0];
                      link.setAttribute('download', `corporate-bookings-invoices-${timestamp}.xlsx`);
                      
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                      alert('Corporate bookings exported successfully!');
                    } catch (error) {
                      console.error('Error exporting corporate bookings:', error);
                      alert('Error exporting corporate bookings. Please try again.');
                    }
                  }}
                  className="btn btn-primary"
                  style={{ padding: '14px 40px', fontSize: '16px', fontWeight: '600' }}
                >
                  📥 Download Excel File
                </button>
              </div>
            </div>
          )}

          {activeTab === 'corporate-assign' && hasAccess('event-bookings', true) && (
            <div>
              <div className="section-header">
                <h2>Assign / Reassign Drivers and Cars</h2>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Rider</th>
                      <th>Company</th>
                      <th>Pickup</th>
                      <th>Drop</th>
                      <th>Driver</th>
                      <th>Car</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corporateBookings.map((cb) => {
                      const sel = assignSelections[cb.id] || {};
                      const alreadyAssigned = !!cb.driver_id || cb.status === 'confirmed';
                      const isReassigning = reassigning[cb.id];
                      return (
                        <tr key={cb.id}>
                          <td>{cb.id}</td>
                          <td>{cb.name} ({cb.phone_number})</td>
                          <td>{cb.company_name}</td>
                          <td>{cb.pickup_point}</td>
                          <td>{cb.drop_point || '-'}</td>
                          <td>
                            {alreadyAssigned && !isReassigning && (
                              <span>{cb.driver_name || cb.driver_name_ref || 'Assigned'}</span>
                            )}
                            {!alreadyAssigned || isReassigning ? (
                              <select
                                value={sel.driver_id || ''}
                                onChange={(e) =>
                                  setAssignSelections((prev) => ({
                                    ...prev,
                                    [cb.id]: { ...prev[cb.id], driver_id: e.target.value ? parseInt(e.target.value) : null },
                                  }))
                                }
                              >
                                <option value="">Select driver</option>
                                {drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} ({d.phone})
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </td>
                          <td>
                            {alreadyAssigned && !isReassigning && (
                              <span>{cb.vehicle_number || 'Not assigned'}</span>
                            )}
                            {!alreadyAssigned || isReassigning ? (
                              <select
                                value={sel.cab_id || ''}
                                onChange={(e) =>
                                  setAssignSelections((prev) => ({
                                    ...prev,
                                    [cb.id]: { ...prev[cb.id], cab_id: e.target.value ? parseInt(e.target.value) : null },
                                  }))
                                }
                              >
                                <option value="">Select car</option>
                                {cabs.filter(c => c.is_active).map((cab) => (
                                  <option key={cab.id} value={cab.id}>
                                    {cab.vehicle_number} {cab.cab_type_name ? `(${cab.cab_type_name})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </td>
                          <td>
                            {(!alreadyAssigned || isReassigning) && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleAssignCorporate(cb.id)}
                              >
                                Save
                              </button>
                            )}
                            {alreadyAssigned && !isReassigning && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setReassigning((prev) => ({ ...prev, [cb.id]: true }));
                                  setAssignSelections((prev) => ({
                                    ...prev,
                                    [cb.id]: { ...prev[cb.id], driver_id: cb.driver_id || null, cab_id: cb.cab_id || null },
                                  }));
                                }}
                              >
                                Reassign
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'event-bookings' && hasAccess('event-bookings') && (
            <div>
              <div className="section-header">
                <h2>Event Bookings</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600' }}>Filter by Event Type:</label>
                  <select
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All Events</option>
                    <option value="weddings">Weddings</option>
                    <option value="birthdays">Birthdays</option>
                    <option value="others">Others</option>
                  </select>
                </div>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Event Type</th>
                      <th>Pickup</th>
                      <th>Drop</th>
                      <th>Date & Time</th>
                      <th>No. of Cars</th>
                      <th>Status</th>
                      <th>Assignments</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventBookings
                      .filter(eb => eventFilter === 'all' || eb.event_type === eventFilter)
                      .map((eb) => {
                      const isReassigning = reassigning[eb.id];
                      const sel = eventAssignSelections[eb.id] || { assignments: [] };
                      const numCars = eb.number_of_cars || 1;
                      const existingAssignments = eb.assignments || [];
                      
                      return (
                        <tr key={eb.id}>
                          <td>{eb.id}</td>
                          <td>{eb.name}</td>
                          <td>{eb.phone_number}</td>
                          <td>
                            <span style={{ textTransform: 'capitalize' }}>{eb.event_type || 'N/A'}</span>
                          </td>
                          <td>{eb.pickup_point}</td>
                          <td>{eb.drop_point}</td>
                          <td>
                            <div>{eb.pickup_date || '-'}</div>
                            <div style={{ fontSize: '0.85em', color: '#6b7280' }}>{eb.pickup_time || '-'}</div>
                          </td>
                          <td>{numCars}</td>
                          <td>
                            <select
                              value={eb.status || 'pending'}
                              onChange={async (e) => {
                                try {
                                  await api.put(`/events/bookings/${eb.id}`, { status: e.target.value });
                                  fetchDashboardData();
                                } catch (error) {
                                  alert(error.response?.data?.error || 'Error updating status');
                                }
                              }}
                              className="status-select"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td style={{ minWidth: '320px', maxWidth: '450px', verticalAlign: 'top', position: 'relative', overflow: 'visible' }}>
                            {!isReassigning && existingAssignments.length > 0 && (
                              <div style={{ fontSize: '0.85em', lineHeight: '1.5' }}>
                                {existingAssignments.map((assign, idx) => (
                                  <div key={idx} style={{ marginBottom: '6px', padding: '6px', background: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '2px' }}>Car {idx + 1}:</div>
                                    {assign.vehicle_number && <div style={{ fontSize: '11px', color: '#4b5563' }}>Cab: {assign.vehicle_number}</div>}
                                    {assign.driver_name && <div style={{ fontSize: '11px', color: '#4b5563' }}>Driver: {assign.driver_name} ({assign.driver_phone})</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {(!existingAssignments.length || isReassigning) && (
                              <div style={{ width: '100%', overflow: 'visible' }}>
                                {Array(numCars).fill(null).map((_, idx) => {
                                  const assignment = sel.assignments?.[idx] || { cab_id: null, driver_id: null };
                                  return (
                                    <div key={idx} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#fafafa', width: '100%', minWidth: '280px', position: 'relative', overflow: 'visible' }}>
                                      <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '12px' }}>Car {idx + 1}:</div>
                                      <select
                                        value={assignment.cab_id || ''}
                                        onChange={(e) => {
                                          setEventAssignSelections(prev => {
                                            const current = prev[eb.id] || { assignments: [] };
                                            const newAssignments = [...(current.assignments || [])];
                                            while (newAssignments.length <= idx) newAssignments.push({ cab_id: null, driver_id: null });
                                            newAssignments[idx] = { ...newAssignments[idx], cab_id: e.target.value ? parseInt(e.target.value) : null };
                                            return { ...prev, [eb.id]: { assignments: newAssignments } };
                                          });
                                        }}
                                        style={{ width: '100%', marginBottom: '6px', padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                                      >
                                        <option value="">Select Cab</option>
                                        {cabs.filter(c => c.is_available !== 0 && c.is_available !== false).map((cab) => (
                                          <option key={cab.id} value={cab.id}>
                                            {cab.vehicle_number} - {cab.driver_name || 'No Driver'}
                                          </option>
                                        ))}
                                      </select>
                                      <div style={{ position: 'relative', width: '100%' }}>
                                        <select
                                          value={assignment.driver_id || ''}
                                          onChange={(e) => {
                                            setEventAssignSelections(prev => {
                                              const current = prev[eb.id] || { assignments: [] };
                                              const newAssignments = [...(current.assignments || [])];
                                              while (newAssignments.length <= idx) newAssignments.push({ cab_id: null, driver_id: null });
                                              newAssignments[idx] = { ...newAssignments[idx], driver_id: e.target.value ? parseInt(e.target.value) : null };
                                              return { ...prev, [eb.id]: { assignments: newAssignments } };
                                            });
                                          }}
                                          style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}
                                        >
                                          <option value="">Select Driver</option>
                                          {drivers.filter(d => d.is_active !== 0 && d.is_active !== false).map((driver) => (
                                            <option key={driver.id} value={driver.id}>
                                              {driver.name} ({driver.phone})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td style={{ minWidth: '150px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              {(!existingAssignments.length || isReassigning) && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleAssignEvent(eb.id)}
                                  style={{ fontSize: '11px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                                >
                                  Save Assignments
                                </button>
                              )}
                              {existingAssignments.length > 0 && !isReassigning && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setReassigning((prev) => ({ ...prev, [eb.id]: true }));
                                    setEventAssignSelections(prev => ({
                                      ...prev,
                                      [eb.id]: { assignments: existingAssignments.map(a => ({ cab_id: a.cab_id || null, driver_id: a.driver_id || null })) }
                                    }));
                                  }}
                                  style={{ fontSize: '11px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                                >
                                  Reassign
                                </button>
                              )}
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={async () => {
                                  if (!window.confirm('Are you sure you want to delete this event booking?')) return;
                                  try {
                                    await api.delete(`/events/bookings/${eb.id}`);
                                    fetchDashboardData();
                                    alert('Event booking deleted successfully');
                                  } catch (error) {
                                    alert(error.response?.data?.error || 'Error deleting event booking');
                                  }
                                }}
                                style={{ fontSize: '11px', padding: '4px 8px', whiteSpace: 'nowrap' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {eventBookings.length === 0 && (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '40px' }}>
                          No event bookings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'drivers' && hasAccess('drivers') && (
            <div>
              <div className="section-header">
                <h2>Others</h2>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px', 
                marginTop: '20px',
                maxWidth: '100%',
                overflow: 'hidden'
              }}>
                {/* Left Side - Drivers */}
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '18px', margin: 0 }}>Drivers</h3>
                    <button onClick={openCreateForm} className="btn btn-primary btn-sm" style={{ fontSize: '12px', padding: '6px 12px', color: '#000' }}>
                      + Register Driver
                    </button>
                  </div>
                  <div className="data-table-wrapper" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table className="data-table" style={{ fontSize: '13px', width: '100%', tableLayout: 'auto' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px', fontSize: '12px' }}>Name</th>
                          <th style={{ padding: '8px', fontSize: '12px' }}>Phone</th>
                          <th style={{ padding: '8px', fontSize: '12px' }}>License</th>
                          <th style={{ padding: '8px', fontSize: '12px' }}>Emergency</th>
                          <th style={{ padding: '8px', fontSize: '12px' }}>Status</th>
                          <th style={{ padding: '8px', fontSize: '12px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drivers.map((d) => (
                          <tr key={d.id}>
                            <td style={{ padding: '8px', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{d.name}</td>
                            <td style={{ padding: '8px', fontSize: '12px', whiteSpace: 'nowrap' }}>{d.phone}</td>
                            <td style={{ padding: '8px', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>{d.license_number || '-'}</td>
                            <td style={{ padding: '8px', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                              {d.emergency_contact_name ? `${d.emergency_contact_name} (${d.emergency_contact_phone || '-'})` : '-'}
                            </td>
                            <td style={{ padding: '8px', fontSize: '12px' }}>{d.is_active ? 'Active' : 'Inactive'}</td>
                            <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                              <button onClick={() => openEditForm(d)} className="btn btn-secondary btn-sm" style={{ fontSize: '11px', padding: '4px 8px', marginRight: '4px' }}>
                                Edit
                              </button>
                              <button onClick={() => handleDelete('drivers', d.id)} className="btn btn-danger btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Side - Add Cars */}
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '18px', margin: 0 }}>Add Cars</h3>
                    <small style={{ fontSize: '11px', color: '#6b7280' }}>For bookings & availability</small>
                  </div>
                  <div className="card" style={{ padding: '16px', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!carFormData.vehicle_number || !carFormData.cab_type_id) {
                        alert('Vehicle number and cab type are required');
                        return;
                      }
                      setLoading(true);
                      try {
                        await api.post('/admin/cabs', {
                          vehicle_number: carFormData.vehicle_number,
                          cab_type_id: carFormData.cab_type_id,
                          driver_id: carFormData.driver_id || null,
                          driver_name: carFormData.driver_name || null,
                          driver_phone: carFormData.driver_phone || null,
                        });
                        
                        alert('Car registered successfully!');
                        setCarFormData({ vehicle_number: '', cab_type_id: '', driver_id: '', driver_name: '', driver_phone: '' });
                        fetchDashboardData();
                      } catch (error) {
                        alert(error.response?.data?.error || 'Error registering car');
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '13px', marginBottom: '4px' }}>Vehicle Number *</label>
                        <input
                          type="text"
                          required
                          value={carFormData.vehicle_number || ''}
                          onChange={(e) => setCarFormData({ ...carFormData, vehicle_number: e.target.value })}
                          placeholder="e.g., KA-01-AB-1234"
                          style={{ fontSize: '13px', padding: '6px' }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '13px', marginBottom: '4px' }}>Cab Type *</label>
                        <select
                          required
                          value={carFormData.cab_type_id || ''}
                          onChange={(e) => setCarFormData({ ...carFormData, cab_type_id: e.target.value ? parseInt(e.target.value) : '' })}
                          style={{ fontSize: '13px', padding: '6px', width: '100%' }}
                        >
                          <option value="">Select cab type</option>
                          {(() => {
                            const filteredCabTypes = cabTypes.filter(ct => {
                              // Only show active cab types
                              if (!ct.is_active || ct.is_active === 0 || ct.is_active === false) {
                                return false;
                              }
                              // Normalize name: lowercase, trim whitespace
                              const nameLower = (ct.name || '').toLowerCase().trim();
                              // Only show exact matches for SUV and Sedan (case-insensitive)
                              return nameLower === 'suv' || nameLower === 'sedan';
                            });
                            
                            if (filteredCabTypes.length === 0) {
                              return <option value="" disabled>No SUV or Sedan cab types found. Please create them first.</option>;
                            }
                            
                            return filteredCabTypes.map((ct) => (
                              <option key={ct.id} value={ct.id}>
                                {ct.name}
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '13px', marginBottom: '4px' }}>Driver (Optional)</label>
                        <select
                          value={carFormData.driver_id || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : '';
                            const driver = drivers.find(d => d.id === val);
                            setCarFormData({ 
                              ...carFormData, 
                              driver_id: val,
                              driver_name: driver ? driver.name : '',
                              driver_phone: driver ? driver.phone : ''
                            });
                          }}
                          style={{ fontSize: '13px', padding: '6px', width: '100%' }}
                        >
                          <option value="">Select driver (optional)</option>
                          {drivers.filter(d => d.is_active).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.phone})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: '13px', padding: '8px 16px', width: '100%' }}>
                        {loading ? 'Registering...' : 'Register Car'}
                      </button>
                      <div style={{ marginTop: '12px', padding: '8px', background: '#f3f4f6', borderRadius: '4px', fontSize: '11px', color: '#6b7280' }}>
                        <strong>Note:</strong> This registers vehicles to the cabs table used in bookings and car availability. For car models with documents, use Rate Meter → Car Options.
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Standalone Car Availability section removed; availability is implied from cab configuration under Fleet Management. */}

          {activeTab === 'car-options' && hasAccess('car-options') && (
            <div>
              <div className="section-header">
                <h2>Car Options</h2>
                <button onClick={openCreateForm} className="btn btn-primary">
                  + Add Car Option
                </button>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Image</th>
                      <th>Description</th>
                      <th>Sort Order</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {carOptions.map((opt) => (
                    <tr key={opt.id}>
                      <td data-label="Name">{opt.name}</td>
                      <td data-label="Image">
                        {opt.image_url ? (
                          <div>
                            <img
                              src={getImageUrl(opt.image_url)}
                              alt={opt.name}
                              style={{ width: '80px', height: '48px', objectFit: 'cover', borderRadius: '6px' }}
                            />
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              {Array.isArray(opt.image_urls)
                                ? `${opt.image_urls.length} image${opt.image_urls.length === 1 ? '' : 's'} uploaded`
                                : '1 image uploaded'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>No image uploaded</span>
                        )}
                      </td>
                      <td data-label="Description" style={{ maxWidth: '320px' }}>
                        <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                          {opt.description || '-'}
                        </span>
                      </td>
                      <td data-label="Sort Order">{opt.sort_order ?? 0}</td>
                      <td data-label="Status">{opt.is_active ? 'Active' : 'Inactive'}</td>
                      <td data-label="Actions">
                        <button
                          onClick={() => openEditForm(opt)}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete('car-options', opt.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {activeTab === 'admin-register' && (
            <div>
              <div className="section-header">
                <h2>Register Admin/Manager User</h2>
              </div>
              <div className="card" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (adminFormData.password !== adminFormData.confirmPassword) {
                    alert('Passwords do not match');
                    return;
                  }
                  if (adminFormData.password.length < 6) {
                    alert('Password must be at least 6 characters');
                    return;
                  }
                  setLoading(true);
                  try {
                    const payload = {
                      username: adminFormData.username,
                      email: adminFormData.email,
                      password: adminFormData.password,
                      role: adminFormData.role
                    };
                    
                    // Add permissions if manager
                    if (adminFormData.role === 'manager') {
                      const permissions = [];
                      dashboardSections.forEach(section => {
                        const perm = managerPermissions[section.key];
                        if (perm && (perm.canView || perm.canEdit)) {
                          permissions.push({
                            section_key: section.key,
                            can_view: perm.canView || false,
                            can_edit: perm.canEdit || false
                          });
                        }
                      });
                      payload.permissions = permissions;
                    }
                    
                    await api.post('/auth/register-admin', payload);
                    alert(`${adminFormData.role === 'admin' ? 'Admin' : 'Manager'} user registered successfully!`);
                    setAdminFormData({ username: '', email: '', password: '', confirmPassword: '', role: 'admin' });
                    setManagerPermissions({});
                  } catch (error) {
                    alert(error.response?.data?.error || 'Error registering user');
                  } finally {
                    setLoading(false);
                  }
                }}>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      required
                      value={adminFormData.role}
                      onChange={(e) => {
                        setAdminFormData({ ...adminFormData, role: e.target.value });
                        if (e.target.value !== 'manager') {
                          setManagerPermissions({});
                        }
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      required
                      value={adminFormData.username}
                      onChange={(e) => setAdminFormData({ ...adminFormData, username: e.target.value })}
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      value={adminFormData.email}
                      onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      required
                      value={adminFormData.password}
                      onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                      placeholder="Enter password (min 6 characters)"
                      minLength="6"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={adminFormData.confirmPassword}
                      onChange={(e) => setAdminFormData({ ...adminFormData, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      minLength="6"
                    />
                  </div>

                  {adminFormData.role === 'manager' && (
                    <div className="form-group" style={{ marginTop: '30px' }}>
                      <label style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600' }}>
                        Manager Permissions *
                      </label>
                      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                        Select which sections this manager can view and/or edit:
                      </p>
                      <div style={{ 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px', 
                        padding: '20px',
                        maxHeight: '500px',
                        overflowY: 'auto'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Section</th>
                              <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600' }}>View</th>
                              <th style={{ textAlign: 'center', padding: '12px', fontWeight: '600' }}>Edit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardSections.map((section) => (
                              <tr key={section.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px' }}>
                                  <div style={{ fontWeight: '500' }}>{section.label}</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                    {section.description}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', padding: '12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={managerPermissions[section.key]?.canView || false}
                                    onChange={(e) => {
                                      setManagerPermissions(prev => ({
                                        ...prev,
                                        [section.key]: {
                                          ...prev[section.key],
                                          canView: e.target.checked,
                                          canEdit: e.target.checked ? (prev[section.key]?.canEdit || false) : false
                                        }
                                      }));
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center', padding: '12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={managerPermissions[section.key]?.canEdit || false}
                                    disabled={!managerPermissions[section.key]?.canView}
                                    onChange={(e) => {
                                      setManagerPermissions(prev => ({
                                        ...prev,
                                        [section.key]: {
                                          ...prev[section.key],
                                          canView: prev[section.key]?.canView || false,
                                          canEdit: e.target.checked
                                        }
                                      }));
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '10px', fontStyle: 'italic' }}>
                        Note: Edit permission requires View permission. Managers can only access sections they have View permission for.
                      </p>
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '20px' }}>
                    {loading ? 'Registering...' : `Register ${adminFormData.role === 'admin' ? 'Admin' : 'Manager'} User`}
                  </button>
                </form>
              </div>
            </div>
          )}

          {showForm && (
            <div className="modal-overlay" onClick={() => setShowForm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{editingItem ? 'Edit' : 'Create'} {(() => {
                  const actualTab = activeTab === 'rate-meters' ? rateMeterSubsection : activeTab;
                  return actualTab.replace('-', ' ');
                })()}</h3>
                <form onSubmit={handleSubmit}>
                  {(() => {
                    const actualTab = activeTab === 'rate-meters' ? rateMeterSubsection : activeTab;
                    return actualTab === 'cab-types';
                  })() && (
                    <>
                      <div className="form-group">
                        <label>Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          value={formData.description || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Base Fare</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.base_fare || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, base_fare: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Per KM Rate</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.per_km_rate || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, per_km_rate: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Per Minute Rate</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.per_minute_rate || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, per_minute_rate: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Capacity</label>
                        <input
                          type="number"
                          value={formData.capacity || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, capacity: e.target.value })
                          }
                        />
                      </div>
                      {editingItem && (
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={formData.is_active !== false}
                              onChange={(e) =>
                                setFormData({ ...formData, is_active: e.target.checked })
                              }
                            />
                            Active
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {(() => {
                    const actualTab = activeTab === 'rate-meters' ? rateMeterSubsection : activeTab;
                    return actualTab === 'rate-meters';
                  })() && (
                    <>
                      <div className="form-group">
                        <label>Service Type *</label>
                        <select
                          required
                          value={formData.service_type || ''}
                          onChange={(e) => {
                            const newServiceType = e.target.value;
                            // Reset form data when service type changes
                            setFormData({ 
                              ...formData, 
                              service_type: newServiceType,
                              car_category: '',
                              base_fare: newServiceType === 'airport' ? 0 : '',
                              hours: newServiceType === 'local' ? '' : undefined,
                              trip_type: newServiceType === 'outstation' ? '' : undefined,
                            });
                          }}
                        >
                          <option value="">Select service type</option>
                          <option value="local">Local</option>
                          <option value="airport">Airport</option>
                          <option value="outstation">Outstation</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Car Category</label>
                        <select
                          value={formData.car_category || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, car_category: e.target.value })
                          }
                        >
                          <option value="">Select car category</option>
                          {formData.service_type === 'local' || formData.service_type === 'airport' ? (
                            <>
                              <option value="Sedan">Sedan</option>
                              <option value="Any SUV">Any SUV</option>
                              <option value="Innova Crysta">Innova Crysta</option>
                            </>
                          ) : formData.service_type === 'outstation' ? (
                            <>
                              <option value="Sedan">Sedan</option>
                              <option value="Any SUV">Any SUV</option>
                              <option value="Innova Crysta">Innova Crysta</option>
                              <option value="TT">TT</option>
                              <option value="Mini Bus">Mini Bus</option>
                            </>
                          ) : null}
                        </select>
                      </div>
                      {formData.service_type === 'local' && (
                        <>
                          <div className="form-group">
                            <label>Hours</label>
                            <select
                              value={formData.hours || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, hours: parseInt(e.target.value) })
                              }
                            >
                              <option value="">Select hours</option>
                              <option value="4">4 hours</option>
                              <option value="8">8 hours</option>
                              <option value="12">12 hours</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Base Fare (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.base_fare || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, base_fare: parseFloat(e.target.value) || 0 })
                              }
                              placeholder="Base fare for selected hours package"
                            />
                          </div>
                          <div className="form-group">
                            <label>Extra Hour Rate (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.extra_hour_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, extra_hour_rate: parseFloat(e.target.value) || 0 })
                              }
                              placeholder="Rate per extra hour beyond package"
                            />
                          </div>
                          <div className="form-group">
                            <label>Extra KM Rate (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.extra_km_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, extra_km_rate: parseFloat(e.target.value) || 0 })
                              }
                              placeholder="Rate per extra kilometer"
                            />
                          </div>
                        </>
                      )}
                      {formData.service_type === 'airport' && (
                        <>
                          <div className="form-group">
                            <label>Per KM Rate (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.per_km_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, per_km_rate: parseFloat(e.target.value) || 0 })
                              }
                              placeholder="Rate per kilometer (fare will be doubled)"
                            />
                          </div>
                          <div style={{ padding: '10px', backgroundColor: '#fef3c7', borderRadius: '6px', marginBottom: '15px', fontSize: '13px' }}>
                            <strong>Note:</strong> Airport bookings are drop-only, so the fare will be automatically doubled (round trip calculation).
                          </div>
                        </>
                      )}
                      {formData.service_type === 'outstation' && (
                        <>
                          <div className="form-group">
                            <label>Trip Type</label>
                            <select
                              value={formData.trip_type || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, trip_type: e.target.value })
                              }
                            >
                              <option value="">Select trip type</option>
                              <option value="one_way">One Way</option>
                              <option value="round_trip">Round Trip</option>
                              <option value="multiple_way">Multiple Way</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Base Fare (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.base_fare || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, base_fare: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label>Per KM Rate (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.per_km_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, per_km_rate: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                        </>
                      )}
                      <div className="form-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={formData.is_active !== undefined ? formData.is_active : true}
                            onChange={(e) =>
                              setFormData({ ...formData, is_active: e.target.checked })
                            }
                          />
                          Active
                        </label>
                      </div>
                    </>
                  )}

                  {(() => {
                    const actualTab = activeTab === 'rate-meters' ? rateMeterSubsection : activeTab;
                    return actualTab === 'car-options';
                  })() && (
                    <>
                      <div className="form-group">
                        <label>Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Upload Images</label>
                        {editingItem && editingItem.image_url && (
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              Current:
                            </span>
                            <div>
                              <img
                                src={getImageUrl(editingItem.image_url)}
                                alt={editingItem.name}
                                style={{
                                  width: '120px',
                                  height: '70px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  marginTop: '4px',
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) =>
                            setCarOptionImageFiles(
                              e.target.files ? Array.from(e.target.files) : []
                            )
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          rows={4}
                          value={formData.description || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder="Describe this car option (comfort, luggage, ideal use, etc.)"
                        />
                      </div>
                      <div className="form-group">
                        <label>Sort Order</label>
                        <input
                          type="number"
                          value={formData.sort_order ?? ''}
                          onChange={(e) =>
                            setFormData({ ...formData, sort_order: parseInt(e.target.value || '0', 10) })
                          }
                        />
                      </div>
                      {editingItem && (
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={formData.is_active !== 0 && formData.is_active !== false}
                              onChange={(e) =>
                                setFormData({ ...formData, is_active: e.target.checked })
                              }
                            />
                            {' '}
                            Active
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'drivers' && (
                    <>
                      <div className="form-group">
                        <label>Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone *</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>License Number</label>
                        <input
                          type="text"
                          value={formData.license_number || ''}
                          onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact Name</label>
                        <input
                          type="text"
                          value={formData.emergency_contact_name || ''}
                          onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact Phone</label>
                        <input
                          type="tel"
                          value={formData.emergency_contact_phone || ''}
                          onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Upload ID Photo (optional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setDriverPhotoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                        />
                      </div>
                      {editingItem && (
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={formData.is_active !== false}
                              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            Active
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {(() => {
                    const actualTab = activeTab === 'rate-meters' ? rateMeterSubsection : activeTab;
                    return actualTab === 'cabs';
                  })() && (
                    <>
                      <div className="form-group">
                        <label>Vehicle Number *</label>
                        <input
                          type="text"
                          required
                          value={formData.vehicle_number || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, vehicle_number: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Select Car *</label>
                        <select
                          required
                          value={formData.car_option_id || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : '';
                            const car = availableCars.find((c) => c.id === val);
                            setFormData({
                              ...formData,
                              car_option_id: val || undefined,
                              cab_type_id: car ? car.cab_type_id || '' : '',
                            });
                          }}
                        >
                          <option value="">Select Car</option>
                          {availableCars.map((car) => (
                            <option key={car.id} value={car.id}>
                              {car.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Driver (optional)</label>
                        <select
                          value={formData.driver_id || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : null;
                            setFormData({
                              ...formData,
                              driver_id: val,
                              // clear manual fields when selecting from dropdown
                              driver_name: val ? undefined : formData.driver_name,
                              driver_phone: val ? undefined : formData.driver_phone,
                            });
                          }}
                        >
                          <option value="">Select Driver</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.phone})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Driver Name</label>
                        <input
                          type="text"
                          value={formData.driver_name || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, driver_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Driver Phone</label>
                        <input
                          type="tel"
                          value={formData.driver_phone || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, driver_phone: e.target.value })
                          }
                          disabled={!!formData.driver_id}
                        />
                      </div>
                      {editingItem && (
                        <>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={formData.is_available !== false}
                                onChange={(e) =>
                                  setFormData({ ...formData, is_available: e.target.checked })
                                }
                              />
                              Available
                            </label>
                          </div>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={formData.is_active !== false}
                                onChange={(e) =>
                                  setFormData({ ...formData, is_active: e.target.checked })
                                }
                              />
                              Active
                            </label>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingItem(null);
                        setFormData({});
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={loading} className="btn btn-primary">
                      {loading ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Car Modal */}
      {showAddCarModal && (
        <div className="modal-overlay" onClick={() => setShowAddCarModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Car to {cabTypes.find(ct => ct.id === selectedCabTypeForCar)?.name}</h3>
              <button
                className="modal-close"
                onClick={() => setShowAddCarModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignCar}>
              <div className="form-group">
                <label>Select Car *</label>
                <select
                  required
                  value={formData.car_option_id || ''}
                  onChange={(e) => setFormData({ ...formData, car_option_id: parseInt(e.target.value) })}
                >
                  <option value="">Choose a car...</option>
                  {availableCars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name} {car.description ? `- ${car.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Car Subtype (e.g., Sedan, SUV, Innova) *</label>
                <select
                  required
                  value={formData.car_subtype || ''}
                  onChange={(e) => setFormData({ ...formData, car_subtype: e.target.value })}
                >
                  <option value="">Choose subtype...</option>
                  <option value="Sedan">Sedan</option>
                  <option value="SUV">SUV</option>
                  <option value="Innova">Innova</option>
                  <option value="Innova Crysta">Innova Crysta</option>
                  <option value="Tempo">Tempo</option>
                  <option value="Urbenia">Urbenia</option>
                  <option value="Minibus">Minibus</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowAddCarModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Car'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

