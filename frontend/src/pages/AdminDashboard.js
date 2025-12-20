import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  
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
  const [stats, setStats] = useState(null);
  const [cabTypes, setCabTypes] = useState([]);
  const [cabs, setCabs] = useState([]);
  const [carOptions, setCarOptions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingFilters, setBookingFilters] = useState({
    status: 'all',
    serviceType: 'all',
    search: '',
    fromDate: '',
    toDate: '',
  });
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
  const [assignSelections, setAssignSelections] = useState({});
  const [driverPhotoFile, setDriverPhotoFile] = useState(null);
  const [reassigning, setReassigning] = useState({});
  const [recentBookings, setRecentBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [receiptWithGST, setReceiptWithGST] = useState(true);
  
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
    car_option_id: '',
    notes: '',
  });
  const [calculatingFare, setCalculatingFare] = useState(false);
  const [estimatedFare, setEstimatedFare] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

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

  const fetchDashboardData = async () => {
    setLoading(true);
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
        // Load rate meters and derive car categories dynamically from assigned cars
        const [ratesRes, carsRes] = await Promise.all([
          api.get('/admin/rate-meters'),
          api.get('/admin/car-options'),
        ]);
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
        const response = await api.get('/admin/bookings');
        setBookings(response.data);
      } else if (activeTab === 'bills-invoices') {
        const response = await api.get('/admin/bookings');
        setBookings(response.data);
      } else if (activeTab === 'car-options') {
        const response = await api.get('/admin/car-options');
        setCarOptions(response.data);
      } else if (activeTab === 'drivers') {
        const response = await api.get('/admin/drivers');
        setDrivers(response.data);
      } else if (activeTab === 'corporate-all' || activeTab === 'corporate-assign') {
        const [bookingsRes, driversRes, cabsRes] = await Promise.all([
          api.get('/admin/corporate-bookings'),
          api.get('/admin/drivers'),
          api.get('/admin/cabs'),
        ]);
        setCorporateBookings(bookingsRes.data || []);
        setDrivers(driversRes.data || []);
        setCabs(cabsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error fetching data');
    } finally {
      setLoading(false);
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
      if (activeTab === 'drivers') {
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
      } else if (activeTab === 'car-options') {
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
        if (editingItem) {
          await api.put(`/admin/${activeTab}/${editingItem.id}`, formData);
          alert('Updated successfully');
        } else {
          await api.post(`/admin/${activeTab}`, formData);
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
      alert(error.response?.data?.error || 'Error saving item');
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setFormData(item);
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

  const calculateFareForAdmin = async () => {
    if (!newBooking.service_type) {
      alert('Please select a service type');
      return;
    }

    if (newBooking.service_type === 'local' && !newBooking.number_of_hours) {
      alert('Please select number of hours for local booking');
      return;
    }

    if (newBooking.service_type === 'outstation' && newBooking.trip_type === 'round_trip' && !newBooking.number_of_days) {
      alert('Please select number of days for round trip');
      return;
    }

    setCalculatingFare(true);
    try {
      const payload = {
        service_type: newBooking.service_type,
        from_location: newBooking.from_location,
        to_location: newBooking.to_location,
      };

      if (newBooking.service_type === 'local') {
        payload.number_of_hours = newBooking.number_of_hours;
      }

      if (newBooking.service_type === 'outstation') {
        payload.trip_type = newBooking.trip_type;
        if (newBooking.trip_type === 'round_trip') {
          payload.number_of_days = newBooking.number_of_days;
        }
      }

      if (newBooking.car_option_id) {
        payload.car_option_id = newBooking.car_option_id;
      }

      const response = await api.post('/bookings/calculate-fare', payload);
      setEstimatedFare(response.data);
    } catch (error) {
      console.error('Error calculating fare:', error);
      alert(error.response?.data?.error || 'Error calculating fare');
    } finally {
      setCalculatingFare(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    
    if (!estimatedFare) {
      alert('Please calculate fare first');
      return;
    }

    setLoading(true);
    try {
      const bookingPayload = {
        service_type: newBooking.service_type,
        trip_type: newBooking.trip_type || null,
        from_location: newBooking.from_location,
        to_location: newBooking.to_location,
        passenger_name: newBooking.passenger_name,
        passenger_phone: newBooking.passenger_phone,
        passenger_email: newBooking.passenger_email,
        travel_date: newBooking.travel_date,
        pickup_time: newBooking.pickup_time || null,
        number_of_hours: newBooking.number_of_hours || null,
        number_of_days: newBooking.number_of_days || null,
        cab_type_id: estimatedFare.cab_type_id,
        car_option_id: newBooking.car_option_id || null,
        fare_amount: estimatedFare.fare,
        distance_km: estimatedFare.distance_km || 0,
        notes: newBooking.notes || '',
      };

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
        car_option_id: '',
        notes: '',
      });
      setEstimatedFare(null);
      
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
            <h3 className="sidebar-heading">Overview</h3>
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
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Bookings</h3>
            <button
              className={activeTab === 'create-booking' ? 'active' : ''}
              onClick={() => {
                setActiveTab('create-booking');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">➕</span>
              <span className="sidebar-text">Create Booking</span>
              <span className="sidebar-subtext">New Booking</span>
            </button>
            <button
              className={activeTab === 'bookings' ? 'active' : ''}
              onClick={() => {
                setActiveTab('bookings');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">📋</span>
              <span className="sidebar-text">All Bookings</span>
              <span className="sidebar-subtext">View & Manage</span>
            </button>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Billing</h3>
            <button
              className={activeTab === 'bills-invoices' ? 'active' : ''}
              onClick={() => {
                setActiveTab('bills-invoices');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">🧾</span>
              <span className="sidebar-text">Bills and Invoices</span>
              <span className="sidebar-subtext">Generate Invoices</span>
            </button>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Corporate Bookings</h3>
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
            <button
              className={activeTab === 'corporate-assign' ? 'active' : ''}
              onClick={() => {
                setActiveTab('corporate-assign');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">🧭</span>
              <span className="sidebar-text">Assign Drivers</span>
              <span className="sidebar-subtext">Drivers & Cabs</span>
            </button>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">People</h3>
            <button
              className={activeTab === 'drivers' ? 'active' : ''}
              onClick={() => {
                setActiveTab('drivers');
                if (isMobile) setSidebarOpen(false);
                setShowForm(false);
              }}
            >
              <span className="sidebar-icon">👤</span>
              <span className="sidebar-text">Register Drivers</span>
              <span className="sidebar-subtext">Manage drivers</span>
            </button>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Fleet Management</h3>
            <button
              className={activeTab === 'rate-meters' ? 'active' : ''}
              onClick={() => {
                setActiveTab('rate-meters');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">💰</span>
              <span className="sidebar-text">Rate Meter</span>
              <span className="sidebar-subtext">Fare Rates</span>
            </button>
            <button
              className={activeTab === 'cab-types' ? 'active' : ''}
              onClick={() => {
                setActiveTab('cab-types');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">🚗</span>
              <span className="sidebar-text">Cab Types</span>
              <span className="sidebar-subtext">Categories & Pricing</span>
            </button>
            <button
              className={activeTab === 'car-options' ? 'active' : ''}
              onClick={() => {
                setActiveTab('car-options');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">🚘</span>
              <span className="sidebar-text">Car Options</span>
              <span className="sidebar-subtext">Vehicle Models</span>
            </button>
            <button
              className={activeTab === 'cabs' ? 'active' : ''}
              onClick={() => {
                setActiveTab('cabs');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">🚕</span>
              <span className="sidebar-text">Cab Details</span>
              <span className="sidebar-subtext">Drivers & Vehicles</span>
            </button>
          </div>
        </div>

        <div className="main-content">
          {loading && <div className="loading">Loading...</div>}

          {activeTab === 'dashboard' && stats && (
            <div className="dashboard-layout">
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Bookings</h3>
                  <p className="stat-number">{stats.totalBookings}</p>
                </div>
                <div className="stat-card">
                  <h3>Active Cabs</h3>
                  <p className="stat-number">{stats.totalCabs}</p>
                </div>
                <div className="stat-card">
                  <h3>Cab Types</h3>
                  <p className="stat-number">{stats.totalCabTypes}</p>
                </div>
                <div className="stat-card">
                  <h3>Recent Bookings (7 days)</h3>
                  <p className="stat-number">{stats.recentBookings}</p>
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
                      <div className="detail-heading">Car Option</div>
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

          {activeTab === 'create-booking' && (
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
                          setNewBooking({ ...newBooking, service_type: e.target.value, trip_type: '', number_of_hours: '', number_of_days: '' });
                          setEstimatedFare(null);
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
                            setNewBooking({ ...newBooking, trip_type: e.target.value, number_of_days: '' });
                            setEstimatedFare(null);
                          }}
                          required
                        >
                          <option value="">Select Trip Type</option>
                          <option value="one_way">One Way</option>
                          <option value="round_trip">Round Trip</option>
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
                            setEstimatedFare(null);
                          }}
                          required
                        >
                          <option value="">Select Hours</option>
                          <option value="2">2 hours</option>
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
                            setEstimatedFare(null);
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div className="form-group">
                      <label>From Location *</label>
                      <input
                        type="text"
                        value={newBooking.from_location}
                        onChange={(e) => {
                          setNewBooking({ ...newBooking, from_location: e.target.value });
                          setEstimatedFare(null);
                        }}
                        placeholder="Enter pickup location"
                        required
                      />
                    </div>

                    {newBooking.service_type !== 'local' && (
                      <div className="form-group">
                        <label>To Location *</label>
                        <input
                          type="text"
                          value={newBooking.to_location}
                          onChange={(e) => {
                            setNewBooking({ ...newBooking, to_location: e.target.value });
                            setEstimatedFare(null);
                          }}
                          placeholder="Enter drop location"
                          required={newBooking.service_type !== 'local'}
                        />
                      </div>
                    )}
                  </div>

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
                      <label>Car Option (Optional)</label>
                      <select
                        value={newBooking.car_option_id}
                        onChange={(e) => {
                          setNewBooking({ ...newBooking, car_option_id: e.target.value });
                          setEstimatedFare(null);
                        }}
                      >
                        <option value="">Select Car (Optional)</option>
                        {carOptions.map((car) => (
                          <option key={car.id} value={car.id}>
                            {car.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label>Notes (Optional)</label>
                    <textarea
                      value={newBooking.notes}
                      onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                      placeholder="Any special requirements or notes"
                      rows="3"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginTop: '30px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={calculateFareForAdmin}
                      className="btn btn-secondary"
                      disabled={calculatingFare}
                    >
                      {calculatingFare ? 'Calculating...' : '💰 Calculate Fare'}
                    </button>

                    {estimatedFare && (
                      <div style={{ 
                        padding: '15px 25px', 
                        background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '18px',
                        color: '#000',
                        boxShadow: '0 4px 12px rgba(250, 204, 21, 0.3)'
                      }}>
                        Estimated Fare: ₹{estimatedFare.fare}
                      </div>
                    )}

                    {estimatedFare && (
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ marginLeft: 'auto' }}
                      >
                        {loading ? 'Creating...' : '✓ Create Booking'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'cab-types' && (
            <div>
              <div className="section-header">
                <h2>Cab Types</h2>
                <button onClick={openCreateForm} className="btn btn-primary">
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
                                        <img src={car.image_url} alt={car.name} className="car-card-image" />
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

          {activeTab === 'cabs' && (
            <div>
              <div className="section-header">
                <h2>Cab Details</h2>
                <button onClick={openCreateForm} className="btn btn-primary" style={{ color: '#000' }}>
                  + Add Cab
                </button>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                <thead>
                  <tr>
                    <th>Vehicle Number</th>
                    <th>Cab Type</th>
                    <th>Driver Name</th>
                    <th>Driver Phone</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cabs.map((cab) => (
                    <tr key={cab.id}>
                      <td>{cab.vehicle_number}</td>
                      <td>{cab.cab_type_name}</td>
                      <td>{cab.driver_name || '-'}</td>
                      <td>{cab.driver_phone || '-'}</td>
                      <td>{cab.is_available ? 'Yes' : 'No'}</td>
                      <td>{cab.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
                        <button
                          onClick={() => openEditForm(cab)}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete('cabs', cab.id)}
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

          {activeTab === 'rate-meters' && (
            <div>
              <div className="section-header">
                <h2>Rate Meter Management</h2>
              </div>

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
                                    base_fare: 0,
                                    per_km_rate: 0,
                                    per_minute_rate: 0,
                                    per_hour_rate: 0,
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
                                          <span className="rate-label">Base Fare:</span>
                                          <span className="rate-value">₹{rate.base_fare}</span>
                                        </div>
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Per Hour:</span>
                                          <span className="rate-value">₹{rate.per_hour_rate}</span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
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
                      <th>Car Option</th>
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
                            <td data-label="Car Option">{booking.car_option_name || '-'}</td>
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

          {activeTab === 'bills-invoices' && (
            <div>
              <div className="section-header">
                <h2>Bills and Invoices</h2>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Passenger</th>
                      <th>Service Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Fare (₹)</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                          <p className="text-muted">No bookings found</p>
                        </td>
                      </tr>
                    ) : (
                      bookings.map((booking) => (
                        <tr key={booking.id} className="booking-table-row">
                          <td>
                            <strong style={{ color: '#facc15' }}>#{booking.id}</strong>
                          </td>
                          <td>
                            <div>
                              <strong>{booking.passenger_name || '-'}</strong>
                              <br />
                              <small style={{ color: '#6b7280' }}>{booking.passenger_phone || '-'}</small>
                            </div>
                          </td>
                          <td>
                            <span className={`service-badge ${booking.service_type || 'local'}`}>
                              {booking.service_type === 'local' ? 'Local' : 
                               booking.service_type === 'airport' ? 'Airport' : 
                               booking.service_type === 'outstation' ? 'Outstation' : 'Local'}
                            </span>
                          </td>
                          <td>{booking.from_location || 'N/A'}</td>
                          <td>{booking.to_location || 'N/A'}</td>
                          <td>
                            <strong style={{ color: '#facc15', fontSize: '16px' }}>
                              ₹{parseFloat(booking.fare_amount || 0).toFixed(2)}
                            </strong>
                          </td>
                          <td>
                            <span className={`status-badge ${booking.booking_status || 'pending'}`}>
                              {booking.booking_status || 'pending'}
                            </span>
                          </td>
                          <td>
                            {booking.booking_date 
                              ? new Date(booking.booking_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateInvoice(booking.id, false);
                                }}
                                className="btn btn-secondary btn-sm"
                                title="Generate Invoice without GST"
                              >
                                Invoice (No GST)
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateInvoice(booking.id, true);
                                }}
                                className="btn btn-primary btn-sm"
                                title="Generate Invoice with GST"
                              >
                                Invoice (GST)
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'corporate-all' && (
            <div>
              <div className="section-header">
                <h2>Corporate Bookings</h2>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Company</th>
                      <th>Pickup</th>
                      <th>Drop</th>
                      <th>Status</th>
                      <th>Driver</th>
                      <th>Cab</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corporateBookings.map((cb) => (
                      <tr key={cb.id}>
                        <td>{cb.id}</td>
                        <td>{cb.name}</td>
                        <td>{cb.phone_number}</td>
                        <td>{cb.company_name}</td>
                        <td>{cb.pickup_point}</td>
                        <td>{cb.drop_point}</td>
                        <td>{cb.status}</td>
                        <td>{cb.driver_name || cb.driver_name_ref || '-'}</td>
                        <td>{cb.vehicle_number || '-'}</td>
                        <td>{new Date(cb.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'corporate-assign' && (
            <div>
              <div className="section-header">
                <h2>Assign / Reassign Drivers</h2>
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
                          <td>{cb.drop_point}</td>
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
                                    [cb.id]: { ...prev[cb.id], driver_id: null },
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

          {activeTab === 'drivers' && (
            <div>
              <div className="section-header">
                <h2>Drivers</h2>
                <button onClick={openCreateForm} className="btn btn-primary" style={{ color: '#000' }}>
                  + Register Driver
                </button>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>License</th>
                      <th>Emergency Contact</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td>{d.phone}</td>
                        <td>{d.license_number || '-'}</td>
                        <td>
                          {d.emergency_contact_name ? `${d.emergency_contact_name} (${d.emergency_contact_phone || '-'})` : '-'}
                        </td>
                        <td>{d.is_active ? 'Active' : 'Inactive'}</td>
                        <td>
                          <button onClick={() => openEditForm(d)} className="btn btn-secondary btn-sm">
                            Edit
                          </button>
                          <button onClick={() => handleDelete('drivers', d.id)} className="btn btn-danger btn-sm">
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


          {activeTab === 'car-options' && (
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
                              src={opt.image_url}
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

          {showForm && (
            <div className="modal-overlay" onClick={() => setShowForm(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{editingItem ? 'Edit' : 'Create'} {activeTab.replace('-', ' ')}</h3>
                <form onSubmit={handleSubmit}>
                  {activeTab === 'cab-types' && (
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
                        <label>Base Fare *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.base_fare || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, base_fare: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Per KM Rate *</label>
                        <input
                          type="number"
                          step="0.01"
                          required
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

                  {activeTab === 'rate-meters' && (
                    <>
                      <div className="form-group">
                        <label>Service Type *</label>
                        <select
                          required
                          value={formData.service_type || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, service_type: e.target.value })
                          }
                        >
                          <option value="">Select service type</option>
                          <option value="local">Local</option>
                          <option value="airport">Airport</option>
                          <option value="outstation">Outstation</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Car Category *</label>
                        <select
                          required
                          value={formData.car_category || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, car_category: e.target.value })
                          }
                        >
                          <option value="">Select car category</option>
                          {rateMeterCategories.length === 0 ? (
                            <option value="" disabled>
                              No assigned car categories found. Assign cars to cab types first.
                            </option>
                          ) : (
                            rateMeterCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Base Fare (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formData.base_fare || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, base_fare: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      {formData.service_type === 'local' ? (
                        <div className="form-group">
                          <label>Per Hour Rate (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={formData.per_hour_rate || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, per_hour_rate: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
                      ) : (
                        <>
                          <div className="form-group">
                            <label>Per KM Rate (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.per_km_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, per_km_rate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                        </>
                      )}
                      {formData.service_type !== 'local' && (
                        <div className="form-group">
                          <label>Per Hour Rate (₹) (Optional, for local override)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.per_hour_rate || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, per_hour_rate: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
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

                  {activeTab === 'car-options' && (
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
                                src={editingItem.image_url}
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

                  {activeTab === 'cabs' && (
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

