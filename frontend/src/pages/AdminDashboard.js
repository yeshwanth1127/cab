import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
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
  const [expandedServiceTypes, setExpandedServiceTypes] = useState({});
  const [corporateBookings, setCorporateBookings] = useState([]);
  const [corporateBookingFilters, setCorporateBookingFilters] = useState({
    status: 'all',
    search: '',
  });
  const [corporateBookingView, setCorporateBookingView] = useState('all'); // 'all' or 'assign-drivers'
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [selectedBookingForDriver, setSelectedBookingForDriver] = useState(null);
  const [showDriverAssignmentModal, setShowDriverAssignmentModal] = useState(false);
  const [drivers, setDrivers] = useState([]);

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
        const response = await api.get('/admin/dashboard/stats');
        setStats(response.data);
      } else if (activeTab === 'rate-meters') {
        const response = await api.get('/admin/rate-meters');
        setRateMeters(response.data);
      } else if (activeTab === 'rate-meters') {
        const response = await api.get('/admin/rate-meters');
        setRateMeters(response.data);
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
        // Also fetch all available cars for the add car modal
        const allCarsResponse = await api.get('/admin/car-options/available');
        setAvailableCars(allCarsResponse.data);
      } else if (activeTab === 'cabs') {
        const response = await api.get('/admin/cabs');
        setCabs(response.data);
        // Fetch drivers for driver selection
        try {
          const driversResponse = await api.get('/admin/drivers');
          setDrivers(driversResponse.data);
        } catch (error) {
          console.error('Error fetching drivers:', error);
        }
        // Fetch all car options for car selection
        try {
          const carOptionsResponse = await api.get('/admin/car-options');
          setCarOptions(carOptionsResponse.data);
        } catch (error) {
          console.error('Error fetching car options:', error);
        }
      } else if (activeTab === 'bookings') {
        const response = await api.get('/admin/bookings');
        setBookings(response.data);
      } else if (activeTab === 'car-options') {
        const response = await api.get('/admin/car-options');
        setCarOptions(response.data);
        // Also fetch cab types for the dropdown
        try {
          const cabTypesResponse = await api.get('/admin/cab-types');
          setCabTypes(cabTypesResponse.data);
        } catch (error) {
          console.error('Error fetching cab types:', error);
        }
      } else if (activeTab === 'corporate-bookings') {
        const response = await api.get('/admin/corporate-bookings');
        setCorporateBookings(response.data);
      } else if (activeTab === 'register-drivers') {
        const response = await api.get('/admin/drivers');
        setDrivers(response.data);
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
      if (activeTab === 'car-options') {
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
      } else if (activeTab === 'corporate-bookings') {
        // Corporate bookings - only edit, no create (created via public form)
        if (editingItem) {
          await api.put(`/admin/corporate-bookings/${editingItem.id}`, formData);
          alert('Updated successfully');
        } else {
          alert('Corporate bookings can only be created through the public form');
          return;
        }
      } else if (activeTab === 'register-drivers') {
        // Drivers management
        if (editingItem) {
          await api.put(`/admin/drivers/${editingItem.id}`, formData);
          alert('Driver updated successfully');
        } else {
          await api.post('/admin/drivers', formData);
          alert('Driver registered successfully');
        }
      } else {
        // JSON body for all other tabs
        let submitData = { ...formData };
        
        // For cabs, remove car_option_id and ensure cab_type_id is sent
        if (activeTab === 'cabs') {
          delete submitData.car_option_id;
          // Ensure cab_type_id is a valid integer
          if (!submitData.cab_type_id || isNaN(submitData.cab_type_id)) {
            alert('Please select a car. Each car must be associated with a cab type.');
            setLoading(false);
            return;
          }
          submitData.cab_type_id = parseInt(submitData.cab_type_id);
        }
        
        if (editingItem) {
          await api.put(`/admin/${activeTab}/${editingItem.id}`, submitData);
          alert('Updated successfully');
        } else {
          await api.post(`/admin/${activeTab}`, submitData);
          alert('Created successfully');
        }
      }
      setShowForm(false);
      setEditingItem(null);
      setFormData({});
      setCarOptionImageFiles([]);
      fetchDashboardData();
    } catch (error) {
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join('\n');
        alert(`Validation errors:\n${errorMessages}`);
      } else {
        alert(error.response?.data?.error || 'Error saving item');
      }
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    let formDataToSet = { ...item };
    
    // For cabs, if cab_type_id exists, find the first car with that cab_type_id and set car_option_id
    if (activeTab === 'cabs' && item.cab_type_id && carOptions.length > 0) {
      const matchingCar = carOptions.find(car => car.cab_type_id === item.cab_type_id && car.is_active);
      if (matchingCar) {
        formDataToSet.car_option_id = matchingCar.id;
      }
    }
    
    setFormData(formDataToSet);
    setCarOptionImageFiles([]);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCreateForm = () => {
    setEditingItem(null);
    setFormData({});
    setCarOptionImageFiles([]);
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
      fetchDashboardData();
      alert('Status updated successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating status');
    }
  };

  const updateCorporateBookingStatus = async (bookingId, status) => {
    try {
      await api.put(`/admin/corporate-bookings/${bookingId}`, { status });
      fetchDashboardData();
      alert('Status updated successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating status');
    }
  };

  const openEditCorporateBooking = (booking) => {
    setEditingItem(booking);
    setFormData(booking);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCorporateBooking = async (id) => {
    if (!window.confirm('Are you sure you want to delete this corporate booking?')) {
      return;
    }

    try {
      await api.delete(`/admin/corporate-bookings/${id}`);
      fetchDashboardData();
      alert('Corporate booking deleted successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting corporate booking');
    }
  };

  const openDriverAssignmentModal = async (booking) => {
    setSelectedBookingForDriver(booking);
    try {
      // Fetch available registered drivers
      const driversResponse = await api.get('/admin/drivers/available/list');
      setAvailableDrivers(driversResponse.data || []);
      
      // Fetch all vehicles/cabs
      const vehiclesResponse = await api.get('/admin/cabs');
      setAvailableVehicles(vehiclesResponse.data || []);
      
      setShowDriverAssignmentModal(true);
    } catch (error) {
      alert(error.response?.data?.error || 'Error fetching available drivers and vehicles');
    }
  };

  const handleAssignDriver = async (bookingId, driverId) => {
    try {
      await api.post(`/admin/corporate-bookings/${bookingId}/assign-driver`, {
        driver_id: driverId
      });
      setShowDriverAssignmentModal(false);
      setSelectedBookingForDriver(null);
      fetchDashboardData();
      alert('Driver assigned successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error assigning driver');
    }
  };

  const handleUnassignDriver = async (bookingId) => {
    if (!window.confirm('Are you sure you want to unassign the driver from this booking?')) {
      return;
    }

    try {
      await api.post(`/admin/corporate-bookings/${bookingId}/unassign-driver`);
      fetchDashboardData();
      alert('Driver unassigned successfully');
    } catch (error) {
      alert(error.response?.data?.error || 'Error unassigning driver');
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

  const downloadReceipt = async (bookingId) => {
    try {
      const response = await api.get(`/admin/bookings/${bookingId}/receipt`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `booking-${bookingId}-receipt.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert(error.response?.data?.error || 'Error downloading receipt');
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
            <button
              className={activeTab === 'corporate-bookings' && corporateBookingView === 'all' ? 'active' : ''}
              onClick={() => {
                setActiveTab('corporate-bookings');
                setCorporateBookingView('all');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">🏢</span>
              <span className="sidebar-text">Corporate Bookings</span>
              <span className="sidebar-subtext">Corporate Requests</span>
            </button>
            {activeTab === 'corporate-bookings' && (
              <>
                <button
                  className={corporateBookingView === 'all' ? 'active' : ''}
                  onClick={() => {
                    setCorporateBookingView('all');
                    if (isMobile) setSidebarOpen(false);
                  }}
                  style={{
                    marginLeft: '32px',
                    paddingLeft: '16px',
                    paddingRight: '32px',
                    borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '14px',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    width: 'calc(100% - 32px)',
                    minWidth: 'max-content'
                  }}
                >
                  <span className="sidebar-icon" style={{ fontSize: '16px' }}>📋</span>
                  <span className="sidebar-text">Show All Bookings</span>
                  <span className="sidebar-subtext">View All Requests</span>
                </button>
                <button
                  className={corporateBookingView === 'assign-drivers' ? 'active' : ''}
                  onClick={() => {
                    setCorporateBookingView('assign-drivers');
                    if (isMobile) setSidebarOpen(false);
                  }}
                  style={{
                    marginLeft: '32px',
                    paddingLeft: '16px',
                    paddingRight: '32px',
                    borderLeft: '3px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '14px',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    width: 'calc(100% - 32px)',
                    minWidth: 'max-content'
                  }}
                >
                  <span className="sidebar-icon" style={{ fontSize: '16px' }}>👤</span>
                  <span className="sidebar-text">Assign Drivers</span>
                  <span className="sidebar-subtext">Driver Assignment</span>
                </button>
              </>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-heading">Driver Management</h3>
            <button
              className={activeTab === 'register-drivers' ? 'active' : ''}
              onClick={() => {
                setActiveTab('register-drivers');
                if (isMobile) setSidebarOpen(false);
              }}
            >
              <span className="sidebar-icon">👨‍✈️</span>
              <span className="sidebar-text">Register Drivers</span>
              <span className="sidebar-subtext">Driver Registration</span>
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
                <button onClick={openCreateForm} className="btn btn-primary">
                  + Add Cab
                </button>
              </div>
              <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
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
                      <td>{cab.driver_name || cab.registered_driver_name || '-'}</td>
                      <td>{cab.driver_phone || cab.registered_driver_phone || '-'}</td>
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
                <button onClick={openCreateForm} className="btn btn-primary">
                  + Add Rate Meter
                </button>
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
                                        <div className="rate-detail-item">
                                          <span className="rate-label">Per Minute:</span>
                                          <span className="rate-value">₹{rate.per_minute_rate}</span>
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
              <div className="section-header bookings-header">
                <h2>Bookings</h2>
                <div className="booking-filters">
                  <div className="filter-group">
                    <label>Status</label>
                    <select
                      value={bookingFilters.status}
                      onChange={(e) =>
                        setBookingFilters((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
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
                      <th>From</th>
                      <th>To</th>
                      <th>Hours</th>
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
                          <td colSpan="13">
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
                          <tr key={booking.id}>
                            <td data-label="ID">{booking.id}</td>
                            <td data-label="Service">
                              <span className={`service-badge ${booking.service_type || 'local'}`}>
                                {(booking.service_type || 'local').charAt(0).toUpperCase() + (booking.service_type || 'local').slice(1)}
                              </span>
                            </td>
                            <td data-label="From">{booking.from_location}</td>
                            <td data-label="To">
                              {booking.service_type === 'local' || booking.to_location === 'N/A' 
                                ? <span className="text-muted">Local</span> 
                                : booking.to_location}
                            </td>
                            <td data-label="Hours">
                              {booking.service_type === 'local' ? (
                                booking.number_of_hours 
                                  ? <span style={{ fontWeight: 600, color: '#111827' }}>{booking.number_of_hours} hrs</span>
                                  : <span style={{ color: '#dc2626', fontStyle: 'italic', fontWeight: 600 }}>⚠ Missing</span>
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
                              {new Date(
                                booking.booking_date
                              ).toLocaleString()}
                            </td>
                            <td data-label="Actions">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(booking.id);
                                  alert('Booking ID copied!');
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Copy ID
                              </button>
                              <button
                                onClick={() =>
                                  downloadReceipt(booking.id)
                                }
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

          {activeTab === 'corporate-bookings' && (
            <div>
              <div className="section-header bookings-header">
                <h2>{corporateBookingView === 'assign-drivers' ? 'Assign Drivers' : 'Corporate Bookings'}</h2>
                {corporateBookingView === 'all' && (
                <div className="booking-filters">
                  <div className="filter-group">
                    <label>Status</label>
                    <select
                      value={corporateBookingFilters.status}
                      onChange={(e) =>
                        setCorporateBookingFilters((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="filter-group filter-search">
                    <label>Search</label>
                    <input
                      type="text"
                      placeholder="Name, phone, company, locations..."
                      value={corporateBookingFilters.search}
                      onChange={(e) =>
                        setCorporateBookingFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                )}
                {corporateBookingView === 'assign-drivers' && (
                  <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                    <p style={{ color: '#6b7280' }}>
                      Select a booking and assign an available driver based on pickup and drop locations
                    </p>
                  </div>
                )}
              </div>
              <div className="data-table-wrapper">
                {corporateBookingView === 'all' ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Company</th>
                        <th>Pickup Point</th>
                        <th>Drop Point</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corporateBookings
                        .filter((booking) => {
                          // Status filter
                          if (
                            corporateBookingFilters.status !== 'all' &&
                            booking.status !== corporateBookingFilters.status
                          ) {
                            return false;
                          }

                          // Search filter
                          if (corporateBookingFilters.search) {
                            const search = corporateBookingFilters.search.toLowerCase();
                            const searchable = [
                              booking.id,
                              booking.name,
                              booking.phone_number,
                              booking.company_name,
                              booking.pickup_point,
                              booking.drop_point,
                            ]
                              .filter(Boolean)
                              .join(' ')
                              .toLowerCase();

                            if (!searchable.includes(search)) {
                              return false;
                            }
                          }

                          return true;
                        })
                        .map((booking) => (
                          <tr key={booking.id}>
                            <td data-label="ID">{booking.id}</td>
                            <td data-label="Name">{booking.name}</td>
                            <td data-label="Phone">{booking.phone_number}</td>
                            <td data-label="Company">{booking.company_name}</td>
                            <td data-label="Pickup Point">{booking.pickup_point}</td>
                            <td data-label="Drop Point">{booking.drop_point}</td>
                            <td data-label="Status">
                              <select
                                value={booking.status}
                                onChange={(e) =>
                                  updateCorporateBookingStatus(
                                    booking.id,
                                    e.target.value
                                  )
                                }
                                className="status-select"
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td data-label="Date">
                              {new Date(booking.created_at).toLocaleString()}
                            </td>
                            <td data-label="Actions">
                              <button
                                onClick={() => openEditCorporateBooking(booking)}
                                className="btn btn-secondary btn-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCorporateBooking(booking.id)}
                                className="btn btn-danger btn-sm"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      {corporateBookings.filter((booking) => {
                        if (
                          corporateBookingFilters.status !== 'all' &&
                          booking.status !== corporateBookingFilters.status
                        ) {
                          return false;
                        }
                        if (corporateBookingFilters.search) {
                          const search = corporateBookingFilters.search.toLowerCase();
                          const searchable = [
                            booking.id,
                            booking.name,
                            booking.phone_number,
                            booking.company_name,
                            booking.pickup_point,
                            booking.drop_point,
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase();
                          if (!searchable.includes(search)) {
                            return false;
                          }
                        }
                        return true;
                      }).length === 0 && (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                            No corporate bookings found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Pickup Point</th>
                        <th>Drop Point</th>
                        <th>Assigned Driver</th>
                        <th>Vehicle</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corporateBookings.map((booking) => (
                        <tr key={booking.id}>
                          <td data-label="ID">{booking.id}</td>
                          <td data-label="Name">{booking.name}</td>
                          <td data-label="Company">{booking.company_name}</td>
                          <td data-label="Pickup Point">{booking.pickup_point}</td>
                          <td data-label="Drop Point">{booking.drop_point}</td>
                          <td data-label="Assigned Driver">
                            {booking.driver_name || booking.cab_driver_name ? (
                              <div>
                                <strong>{booking.driver_name || booking.cab_driver_name}</strong>
                                {(booking.driver_phone || booking.cab_driver_phone) && (
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {booking.driver_phone || booking.cab_driver_phone}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not assigned</span>
                            )}
                          </td>
                          <td data-label="Vehicle">
                            {booking.vehicle_number ? (
                              <div>
                                <strong>{booking.vehicle_number}</strong>
                                {booking.cab_type_name && (
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {booking.cab_type_name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td data-label="Status">
                            <span 
                              className="status-badge" 
                              style={{
                                background: booking.status === 'completed' ? '#10b981' :
                                           booking.status === 'confirmed' ? '#3b82f6' :
                                           booking.status === 'in_progress' ? '#f59e0b' :
                                           booking.status === 'cancelled' ? '#ef4444' :
                                           '#6b7280',
                                color: '#fff',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                textTransform: 'capitalize'
                              }}
                            >
                              {booking.status || 'pending'}
                            </span>
                          </td>
                          <td data-label="Actions">
                            {(!booking.driver_name && !booking.cab_driver_name) ? (
                              <button
                                onClick={() => openDriverAssignmentModal(booking)}
                                className="btn btn-primary btn-sm"
                              >
                                Assign Driver
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUnassignDriver(booking.id)}
                                className="btn btn-danger btn-sm"
                              >
                                Unassign
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {corporateBookings.length === 0 && (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                            No corporate bookings found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'register-drivers' && (
            <div>
              <div className="section-header">
                <h2>Register Drivers</h2>
                <button
                  onClick={openCreateForm}
                  className="btn btn-primary"
                  style={{ color: '#000' }}
                >
                  + Register New Driver
                </button>
              </div>
              <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>License Number</th>
                      <th>Experience</th>
                      <th>Assigned Cabs</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => (
                      <tr key={driver.id}>
                        <td data-label="ID">{driver.id}</td>
                        <td data-label="Name">{driver.name}</td>
                        <td data-label="Phone">{driver.phone}</td>
                        <td data-label="Email">{driver.email || '-'}</td>
                        <td data-label="License Number">{driver.license_number || '-'}</td>
                        <td data-label="Experience">
                          {driver.experience_years ? `${driver.experience_years} years` : '-'}
                        </td>
                        <td data-label="Assigned Cabs">
                          {driver.assigned_cabs_count || 0}
                        </td>
                        <td data-label="Status">
                          <span 
                            className="status-badge" 
                            style={{
                              background: driver.is_active ? '#10b981' : '#ef4444',
                              color: '#fff',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {driver.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <button
                            onClick={() => openEditForm(driver)}
                            className="btn btn-secondary btn-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete('drivers', driver.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {drivers.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                          No drivers registered yet
                        </td>
                      </tr>
                    )}
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
                <h3>{editingItem ? 'Edit' : 'Create'} {activeTab === 'corporate-bookings' ? 'Corporate Booking' : activeTab === 'register-drivers' ? 'Driver' : activeTab.replace('-', ' ')}</h3>
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
                          <option value="Sedan">Sedan</option>
                          <option value="SUV">SUV</option>
                          <option value="Innova">Innova</option>
                          <option value="Innova Crysta">Innova Crysta</option>
                          <option value="Tempo">Tempo</option>
                          <option value="Urbenia">Urbenia</option>
                          <option value="Minibus">Minibus</option>
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
                            <label>Per KM Rate (₹) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={formData.per_km_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, per_km_rate: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div className="form-group">
                            <label>Per Minute Rate (₹) *</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={formData.per_minute_rate || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, per_minute_rate: parseFloat(e.target.value) || 0 })
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
                        <label>Cab Type *</label>
                        <select
                          required
                          value={formData.cab_type_id || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, cab_type_id: e.target.value ? parseInt(e.target.value) : null })
                          }
                        >
                          <option value="">Select Cab Type</option>
                          {cabTypes.filter(ct => ct.is_active).map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.name}
                            </option>
                          ))}
                        </select>
                        <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          Every car must be assigned to a cab type
                        </small>
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
                            const selectedCarId = e.target.value ? parseInt(e.target.value) : null;
                            const selectedCar = carOptions.find(car => car.id === selectedCarId);
                            setFormData({ 
                              ...formData, 
                              car_option_id: selectedCarId,
                              cab_type_id: selectedCar && selectedCar.cab_type_id ? parseInt(selectedCar.cab_type_id) : null
                            });
                          }}
                        >
                          <option value="">Select Car</option>
                          {carOptions.filter(car => car.is_active && car.cab_type_id).map((car) => (
                            <option key={car.id} value={car.id}>
                              {car.name} {car.car_subtype ? `(${car.car_subtype})` : ''}
                            </option>
                          ))}
                        </select>
                        {carOptions.filter(car => car.is_active && !car.cab_type_id).length > 0 && (
                          <small style={{ color: '#f59e0b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Note: Some cars are not shown because they are not assigned to a cab type.
                          </small>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Select Driver</label>
                        <select
                          value={formData.driver_id || ''}
                          onChange={(e) => {
                            const selectedDriverId = e.target.value ? parseInt(e.target.value) : null;
                            const selectedDriver = drivers.find(d => d.id === selectedDriverId);
                            setFormData({ 
                              ...formData, 
                              driver_id: selectedDriverId,
                              driver_name: selectedDriver ? selectedDriver.name : '',
                              driver_phone: selectedDriver ? selectedDriver.phone : ''
                            });
                          }}
                        >
                          <option value="">Select a registered driver (optional)</option>
                          {drivers.filter(d => d.is_active).map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name} - {driver.phone} {driver.license_number ? `(${driver.license_number})` : ''}
                            </option>
                          ))}
                        </select>
                        <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          Or manually enter driver details below
                        </small>
                      </div>
                      <div className="form-group">
                        <label>Driver Name</label>
                        <input
                          type="text"
                          value={formData.driver_name || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, driver_name: e.target.value })
                          }
                          placeholder="Enter driver name if not selecting from list"
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
                          placeholder="Enter driver phone if not selecting from list"
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

                  {activeTab === 'corporate-bookings' && (
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
                        <label>Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone_number || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, phone_number: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Company Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.company_name || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, company_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Pickup Point *</label>
                        <input
                          type="text"
                          required
                          value={formData.pickup_point || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, pickup_point: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Drop Point *</label>
                        <input
                          type="text"
                          required
                          value={formData.drop_point || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, drop_point: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select
                          value={formData.status || 'pending'}
                          onChange={(e) =>
                            setFormData({ ...formData, status: e.target.value })
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Notes</label>
                        <textarea
                          value={formData.notes || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, notes: e.target.value })
                          }
                          rows="3"
                        />
                      </div>
                    </>
                  )}

                  {activeTab === 'register-drivers' && (
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
                        <label>Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>License Number</label>
                        <input
                          type="text"
                          value={formData.license_number || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, license_number: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Address</label>
                        <textarea
                          value={formData.address || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, address: e.target.value })
                          }
                          rows="3"
                        />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact Name</label>
                        <input
                          type="text"
                          value={formData.emergency_contact_name || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, emergency_contact_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact Phone</label>
                        <input
                          type="tel"
                          value={formData.emergency_contact_phone || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, emergency_contact_phone: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Experience (Years)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.experience_years || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, experience_years: parseInt(e.target.value) || null })
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
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="btn btn-primary"
                      style={activeTab === 'register-drivers' ? { color: '#000' } : {}}
                    >
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

      {/* Driver Assignment Modal */}
      {showDriverAssignmentModal && selectedBookingForDriver && (
        <div className="modal-overlay" onClick={() => {
          setShowDriverAssignmentModal(false);
          setSelectedBookingForDriver(null);
          setAvailableDrivers([]);
          setAvailableVehicles([]);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>Assign Driver to Booking #{selectedBookingForDriver.id}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowDriverAssignmentModal(false);
                  setSelectedBookingForDriver(null);
                  setAvailableDrivers([]);
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Pickup Point:</strong> {selectedBookingForDriver.pickup_point}
              </div>
              <div>
                <strong>Drop Point:</strong> {selectedBookingForDriver.drop_point}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px', color: '#374151' }}>Available Drivers ({availableDrivers.length})</h4>
              {availableDrivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
                  <p>No available drivers found.</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    Please register drivers in the "Register Drivers" section first.
                  </p>
                </div>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>License</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Experience</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableDrivers.map((driver) => (
                        <tr key={driver.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px' }}>
                            <strong>{driver.name || 'N/A'}</strong>
                          </td>
                          <td style={{ padding: '12px' }}>{driver.phone || '-'}</td>
                          <td style={{ padding: '12px' }}>{driver.email || '-'}</td>
                          <td style={{ padding: '12px' }}>{driver.license_number || '-'}</td>
                          <td style={{ padding: '12px' }}>
                            {driver.experience_years ? `${driver.experience_years} years` : '-'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleAssignDriver(selectedBookingForDriver.id, driver.id)}
                              className="btn btn-primary btn-sm"
                              disabled={loading}
                            >
                              {loading ? 'Assigning...' : 'Assign'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 style={{ marginBottom: '12px', color: '#374151' }}>All Vehicles ({availableVehicles.length})</h4>
              {availableVehicles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', background: '#f9fafb', borderRadius: '8px' }}>
                  <p>No vehicles found.</p>
                </div>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Vehicle Number</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Cab Type</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Driver Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Driver Phone</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Available</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableVehicles.map((vehicle) => (
                        <tr key={vehicle.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px' }}>
                            <strong>{vehicle.vehicle_number || 'N/A'}</strong>
                          </td>
                          <td style={{ padding: '12px' }}>{vehicle.cab_type_name || '-'}</td>
                          <td style={{ padding: '12px' }}>{vehicle.driver_name || vehicle.registered_driver_name || '-'}</td>
                          <td style={{ padding: '12px' }}>{vehicle.driver_phone || vehicle.registered_driver_phone || '-'}</td>
                          <td style={{ padding: '12px' }}>{vehicle.is_available ? 'Yes' : 'No'}</td>
                          <td style={{ padding: '12px' }}>{vehicle.is_active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowDriverAssignmentModal(false);
                  setSelectedBookingForDriver(null);
                  setAvailableDrivers([]);
                }}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

