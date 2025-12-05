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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const response = await api.get('/admin/dashboard/stats');
        setStats(response.data);
      } else if (activeTab === 'cab-types') {
        const response = await api.get('/admin/cab-types');
        setCabTypes(response.data);
      } else if (activeTab === 'cabs') {
        const response = await api.get('/admin/cabs');
        setCabs(response.data);
      } else if (activeTab === 'bookings') {
        const response = await api.get('/admin/bookings');
        setBookings(response.data);
      } else if (activeTab === 'car-options') {
        const response = await api.get('/admin/car-options');
        setCarOptions(response.data);
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
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    return Object.entries(groups);
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
      <nav className="admin-navbar">
        <div className="container">
          <h1>Namma Cabs – Admin Dashboard</h1>
          <div className="nav-right">
            <span>Welcome, {user?.username}</span>
            <button onClick={logout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="admin-container">
        <div className="sidebar">
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={activeTab === 'cab-types' ? 'active' : ''}
            onClick={() => setActiveTab('cab-types')}
          >
            🚗 Cab Types
          </button>
          <button
            className={activeTab === 'car-options' ? 'active' : ''}
            onClick={() => setActiveTab('car-options')}
          >
            🚘 Car Options
          </button>
          <button
            className={activeTab === 'bookings' ? 'active' : ''}
            onClick={() => setActiveTab('bookings')}
          >
            📋 Bookings
          </button>
          <button
            className={activeTab === 'cabs' ? 'active' : ''}
            onClick={() => setActiveTab('cabs')}
          >
            🚕 Cab Details
          </button>
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Base Fare</th>
                    <th>Per KM Rate</th>
                    <th>Per Min Rate</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cabTypes.map((ct) => (
                    <tr key={ct.id}>
                      <td>{ct.name}</td>
                      <td>₹{ct.base_fare}</td>
                      <td>₹{ct.per_km_rate}</td>
                      <td>₹{ct.per_minute_rate}</td>
                      <td>{ct.capacity}</td>
                      <td>{ct.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
                        <button
                          onClick={() => openEditForm(ct)}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete('cab-types', ct.id)}
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
          )}

          {activeTab === 'cabs' && (
            <div>
              <div className="section-header">
                <h2>Cab Details</h2>
                <button onClick={openCreateForm} className="btn btn-primary">
                  + Add Cab
                </button>
              </div>
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>From</th>
                    <th>To</th>
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
                          <td colSpan="10">
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
                            <td>{booking.id}</td>
                            <td>{booking.from_location}</td>
                            <td>{booking.to_location}</td>
                            <td>{booking.cab_type_name}</td>
                            <td>{booking.car_option_name || '-'}</td>
                            <td>{booking.passenger_name}</td>
                            <td>{booking.passenger_phone}</td>
                            <td>₹{booking.fare_amount}</td>
                            <td>
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
                            <td>
                              {new Date(
                                booking.booking_date
                              ).toLocaleString()}
                            </td>
                            <td>
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
          )}

          {activeTab === 'car-options' && (
            <div>
              <div className="section-header">
                <h2>Car Options</h2>
                <button onClick={openCreateForm} className="btn btn-primary">
                  + Add Car Option
                </button>
              </div>
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
                      <td>{opt.name}</td>
                      <td>
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
                      <td style={{ maxWidth: '320px' }}>
                        <span style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                          {opt.description || '-'}
                        </span>
                      </td>
                      <td>{opt.sort_order ?? 0}</td>
                      <td>{opt.is_active ? 'Active' : 'Inactive'}</td>
                      <td>
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
                        <label>Cab Type *</label>
                        <select
                          required
                          value={formData.cab_type_id || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, cab_type_id: parseInt(e.target.value) })
                          }
                        >
                          <option value="">Select Cab Type</option>
                          {cabTypes.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.name}
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
    </div>
  );
};

export default AdminDashboard;

