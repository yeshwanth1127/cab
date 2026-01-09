const express = require('express');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const { authenticateToken, requireAdmin, requireManagerPermission } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Helper function to convert boolean to integer for SQLite
const boolToInt = (val) => (val === true || val === 1 || val === 'true' ? 1 : 0);

// File upload configuration for car option images
const carOptionsUploadDir = path.join(__dirname, '..', 'uploads', 'car-options');
if (!fs.existsSync(carOptionsUploadDir)) {
  fs.mkdirSync(carOptionsUploadDir, { recursive: true });
}

// File upload dir for drivers
const driversUploadDir = path.join(__dirname, '..', 'uploads', 'drivers');
if (!fs.existsSync(driversUploadDir)) {
  fs.mkdirSync(driversUploadDir, { recursive: true });
}

// File upload dir for car documents
const carDocumentsUploadDir = path.join(__dirname, '..', 'uploads', 'car-documents');
if (!fs.existsSync(carDocumentsUploadDir)) {
  fs.mkdirSync(carDocumentsUploadDir, { recursive: true });
}

// Receipts directory (shared with public bookings router)
const receiptsDir = path.join(__dirname, '..', 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // decide folder based on route
    if (req.originalUrl.includes('/drivers')) {
      cb(null, driversUploadDir);
    } else if (req.originalUrl.includes('/cars') && req.originalUrl.includes('/register')) {
      cb(null, carDocumentsUploadDir);
    } else {
      cb(null, carOptionsUploadDir);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeOriginalName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${timestamp}-${safeOriginalName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ========== CAB TYPES MANAGEMENT ==========

// Get all cab types
router.get('/cab-types', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM cab_types ORDER BY created_at DESC'
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching cab types:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create cab type - NO VALIDATION ON OPTIONAL FIELDS
router.post('/cab-types', async (req, res) => {
  try {
    console.log('=== CREATE CAB TYPE REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Only validate name - everything else is optional
    let { name, description, base_fare, per_km_rate, per_minute_rate, capacity } = req.body;
    
    // Validate name
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Trim name
    name = name.trim();
    
    // All numeric fields are optional - convert to defaults if empty/invalid
    let sanitizedBaseFare = 0;
    if (base_fare !== '' && base_fare !== null && base_fare !== undefined) {
      const num = parseFloat(base_fare);
      if (!isNaN(num)) sanitizedBaseFare = num;
    }
    
    let sanitizedPerKmRate = 0;
    if (per_km_rate !== '' && per_km_rate !== null && per_km_rate !== undefined) {
      const num = parseFloat(per_km_rate);
      if (!isNaN(num)) sanitizedPerKmRate = num;
    }
    
    let sanitizedPerMinuteRate = 0;
    if (per_minute_rate !== '' && per_minute_rate !== null && per_minute_rate !== undefined) {
      const num = parseFloat(per_minute_rate);
      if (!isNaN(num)) sanitizedPerMinuteRate = num;
    }
    
    let sanitizedCapacity = 4; // default
    if (capacity !== '' && capacity !== null && capacity !== undefined) {
      const num = parseInt(capacity);
      if (!isNaN(num) && num >= 1) sanitizedCapacity = num;
    }

    console.log('Sanitized values:', {
      name,
      description: description || null,
      base_fare: sanitizedBaseFare,
      per_km_rate: sanitizedPerKmRate,
      per_minute_rate: sanitizedPerMinuteRate,
      capacity: sanitizedCapacity
    });

    const result = await db.runAsync(
      `INSERT INTO cab_types (name, description, base_fare, per_km_rate, per_minute_rate, capacity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, sanitizedBaseFare, sanitizedPerKmRate, sanitizedPerMinuteRate, sanitizedCapacity]
    );

    const newCabType = await db.getAsync('SELECT * FROM cab_types WHERE id = ?', [result.lastID]);
    console.log('Cab type created successfully:', newCabType);
    res.status(201).json(newCabType);
  } catch (error) {
    console.error('Error creating cab type:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Cab type with this name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update cab type
router.put('/cab-types/:id', [
  body('base_fare').optional().isNumeric().withMessage('Base fare must be a number'),
  body('per_km_rate').optional().isNumeric().withMessage('Per km rate must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, description, base_fare, per_km_rate, per_minute_rate, capacity, is_active } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (base_fare !== undefined) {
      updates.push('base_fare = ?');
      values.push(base_fare);
    }
    if (per_km_rate !== undefined) {
      updates.push('per_km_rate = ?');
      values.push(per_km_rate);
    }
    if (per_minute_rate !== undefined) {
      updates.push('per_minute_rate = ?');
      values.push(per_minute_rate);
    }
    if (capacity !== undefined) {
      updates.push('capacity = ?');
      values.push(capacity);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(boolToInt(is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.runAsync(
      `UPDATE cab_types SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM cab_types WHERE id = ?', [id]);
    if (!updated) {
      return res.status(404).json({ error: 'Cab type not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating cab type:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete cab type
router.delete('/cab-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.runAsync('DELETE FROM cab_types WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cab type not found' });
    }

    res.json({ message: 'Cab type deleted successfully' });
  } catch (error) {
    console.error('Error deleting cab type:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== CABS MANAGEMENT ==========

// Get all cabs
router.get('/cabs', async (req, res) => {
  try {
    const result = await db.allAsync(
      `SELECT c.*, ct.name as cab_type_name, ct.base_fare, ct.per_km_rate
       FROM cabs c
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       ORDER BY c.created_at DESC`
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching cabs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create cab
router.post('/cabs', [
  body('vehicle_number').notEmpty().withMessage('Vehicle number is required'),
  body('cab_type_id').isInt().withMessage('Cab type ID must be an integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicle_number, cab_type_id, driver_name, driver_phone, driver_id } = req.body;

    let resolvedDriverName = driver_name || null;
    let resolvedDriverPhone = driver_phone || null;
    let resolvedDriverId = driver_id || null;

    if (driver_id) {
      const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      resolvedDriverName = driver.name;
      resolvedDriverPhone = driver.phone;
      resolvedDriverId = driver.id;
    }

    const result = await db.runAsync(
      `INSERT INTO cabs (vehicle_number, cab_type_id, driver_name, driver_phone, driver_id)
       VALUES (?, ?, ?, ?, ?)`,
      [vehicle_number, cab_type_id, resolvedDriverName, resolvedDriverPhone, resolvedDriverId]
    );

    const newCab = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [result.lastID]);
    res.status(201).json(newCab);
  } catch (error) {
    console.error('Error creating cab:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Vehicle number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update cab
router.put('/cabs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_number, cab_type_id, driver_name, driver_phone, driver_id, is_available, is_active } = req.body;

    const updates = [];
    const values = [];

    if (vehicle_number !== undefined) {
      updates.push('vehicle_number = ?');
      values.push(vehicle_number);
    }
    if (cab_type_id !== undefined) {
      updates.push('cab_type_id = ?');
      values.push(cab_type_id);
    }
    if (driver_id !== undefined) {
      if (driver_id) {
        const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [driver_id]);
        if (!driver) return res.status(404).json({ error: 'Driver not found' });
        updates.push('driver_id = ?');
        values.push(driver.id);
        updates.push('driver_name = ?');
        values.push(driver.name);
        updates.push('driver_phone = ?');
        values.push(driver.phone);
      } else {
        updates.push('driver_id = ?');
        values.push(null);
        updates.push('driver_name = ?');
        values.push(null);
        updates.push('driver_phone = ?');
        values.push(null);
      }
    } else {
      if (driver_name !== undefined) {
        updates.push('driver_name = ?');
        values.push(driver_name);
      }
      if (driver_phone !== undefined) {
        updates.push('driver_phone = ?');
        values.push(driver_phone);
      }
    }
    if (is_available !== undefined) {
      updates.push('is_available = ?');
      values.push(boolToInt(is_available));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(boolToInt(is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.runAsync(
      `UPDATE cabs SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [id]);
    if (!updated) {
      return res.status(404).json({ error: 'Cab not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating cab:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete cab
router.delete('/cabs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.runAsync('DELETE FROM cabs WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cab not found' });
    }

    res.json({ message: 'Cab deleted successfully' });
  } catch (error) {
    console.error('Error deleting cab:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== ROUTES MANAGEMENT ==========

// Get all routes
router.get('/routes', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM routes ORDER BY created_at DESC'
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create route
router.post('/routes', [
  body('from_location').notEmpty().withMessage('From location is required'),
  body('to_location').notEmpty().withMessage('To location is required'),
  body('distance_km').isNumeric().withMessage('Distance must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { from_location, to_location, distance_km, estimated_time_minutes } = req.body;

    const result = await db.runAsync(
      `INSERT INTO routes (from_location, to_location, distance_km, estimated_time_minutes)
       VALUES (?, ?, ?, ?)`,
      [from_location, to_location, distance_km, estimated_time_minutes || null]
    );

    const newRoute = await db.getAsync('SELECT * FROM routes WHERE id = ?', [result.lastID]);
    res.status(201).json(newRoute);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update route
router.put('/routes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { from_location, to_location, distance_km, estimated_time_minutes, is_active } = req.body;

    const updates = [];
    const values = [];

    if (from_location !== undefined) {
      updates.push('from_location = ?');
      values.push(from_location);
    }
    if (to_location !== undefined) {
      updates.push('to_location = ?');
      values.push(to_location);
    }
    if (distance_km !== undefined) {
      updates.push('distance_km = ?');
      values.push(distance_km);
    }
    if (estimated_time_minutes !== undefined) {
      updates.push('estimated_time_minutes = ?');
      values.push(estimated_time_minutes);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(boolToInt(is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.runAsync(
      `UPDATE routes SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM routes WHERE id = ?', [id]);
    if (!updated) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete route
router.delete('/routes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.runAsync('DELETE FROM routes WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== BOOKINGS MANAGEMENT ==========

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const { limit } = req.query;
    let query = `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone,
              d.name as driver_name, d.phone as driver_phone
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN drivers d ON b.driver_id = d.id
       ORDER BY b.booking_date DESC, b.id DESC`;
    
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    const result = await db.allAsync(query);
    // Use driver from bookings table if available, otherwise fall back to cab driver
    const processedResult = result.map(booking => ({
      ...booking,
      driver_name: booking.driver_name || booking.cab_driver_name || null,
      driver_phone: booking.driver_phone || booking.cab_driver_phone || null
    }));
    res.json(processedResult);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export all bookings to CSV
router.get('/bookings/export/csv', async (req, res) => {
  try {
    const bookings = await db.allAsync(
      `SELECT b.*, 
              ct.name as cab_type_name, 
              co.name as car_option_name,
              c.vehicle_number, 
              c.driver_name, 
              c.driver_phone,
              u.username,
              u.email as user_email
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN users u ON b.user_id = u.id
       ORDER BY b.id DESC`
    );

    // CSV headers
    const headers = [
      'Booking ID',
      'Status',
      'Service Type',
      'Trip Type',
      'Passenger Name',
      'Passenger Phone',
      'Passenger Email',
      'From Location',
      'To Location',
      'Cab Type',
      'Car Option',
      'Vehicle Number',
      'Driver Name',
      'Driver Phone',
      'Distance (km)',
      'Number of Hours',
      'Number of Days',
      'Fare Amount',
      'Booking Date',
      'Travel Date',
      'Pickup Time',
      'Notes',
      'User ID',
      'Username',
      'User Email'
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // If value contains comma, quotes, or newlines, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Format date helper
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };

    // Build CSV rows
    const rows = bookings.map(booking => [
      booking.id,
      booking.booking_status,
      booking.service_type,
      booking.trip_type || '',
      booking.passenger_name,
      booking.passenger_phone,
      booking.passenger_email,
      booking.from_location || '',
      booking.to_location || '',
      booking.cab_type_name || '',
      booking.car_option_name || '',
      booking.vehicle_number || '',
      booking.driver_name || '',
      booking.driver_phone || '',
      booking.distance_km || '',
      booking.number_of_hours || '',
      booking.number_of_days || '',
      booking.fare_amount,
      formatDate(booking.booking_date),
      formatDate(booking.travel_date),
      booking.pickup_time || '',
      booking.notes || '',
      booking.user_id || '',
      booking.username || '',
      booking.user_email || ''
    ].map(escapeCSV));

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Set headers for CSV download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=nammacabs-bookings-${timestamp}.csv`);
    
    // Add UTF-8 BOM for proper Excel compatibility
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('Error exporting bookings to CSV:', error);
    res.status(500).json({ error: 'Error generating CSV export' });
  }
});

// Download GST-compliant fillable invoice PDF for a booking (admin-only)
router.get('/bookings/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const withGST = req.query.withGST === 'true' || req.query.withGST === true;

    const booking = await db.getAsync(
      `SELECT b.*, u.username, u.email, ct.name as cab_type_name, co.name as car_option_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       WHERE b.id = ?`,
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { generateInvoicePdf } = require('../services/invoiceService');
    const pdfBytes = await generateInvoicePdf(booking, { withGST });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking.id}${withGST ? '-with-gst' : ''}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error generating invoice PDF (admin):', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

// Update booking status
router.put('/bookings/:id/status', [
  body('status').isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    await db.runAsync(
      'UPDATE bookings SET booking_status = ? WHERE id = ?',
      [status, id]
    );

    const updated = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!updated) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign/reassign driver and car to booking
router.put('/bookings/:id/assign', [
  body('driver_id').optional({ nullable: true }).isInt().withMessage('driver_id must be int'),
  body('cab_id').optional({ nullable: true }).isInt().withMessage('cab_id must be int'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { driver_id, cab_id } = req.body;

    const booking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    let driverName = null;
    let driverPhone = null;
    if (driver_id) {
      const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      driverName = driver.name;
      driverPhone = driver.phone;
    }

    // Update both driver and cab if provided
    const updates = [];
    const values = [];
    
    if (driver_id !== undefined) {
      updates.push('driver_id = ?');
      updates.push('driver_name = ?');
      updates.push('driver_phone = ?');
      values.push(driver_id || null, driverName, driverPhone);
    }
    
    if (cab_id !== undefined) {
      updates.push('cab_id = ?');
      values.push(cab_id || null);
    }
    
    if (updates.length > 0) {
      values.push(id);
      await db.runAsync(
        `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const updated = await db.getAsync(
      `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone,
              d.name as driver_name, d.phone as driver_phone
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN drivers d ON b.driver_id = d.id
       WHERE b.id = ?`,
      [id]
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Use driver from bookings table if available, otherwise fall back to cab driver
    const processedResult = {
      ...updated,
      driver_name: updated.driver_name || updated.cab_driver_name || null,
      driver_phone: updated.driver_phone || updated.cab_driver_phone || null
    };

    res.json(processedResult);
  } catch (error) {
    console.error('Error assigning driver to booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send invoice email
router.post('/bookings/:id/send-invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const { withGST = true } = req.body;

    const booking = await db.getAsync(
      `SELECT b.*, u.username, u.email, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name, c.driver_phone
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       WHERE b.id = ?`,
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (!booking.passenger_email) {
      return res.status(400).json({ error: 'Passenger email not found' });
    }

    // Generate PDF
    const { generateInvoicePdf } = require('../services/invoiceService');
    const pdfBytes = await generateInvoicePdf(booking, { withGST });

    // Send email with PDF attachment
    const { sendInvoiceEmail } = require('../services/emailService');
    const emailResult = await sendInvoiceEmail(booking, pdfBytes, withGST);

    if (emailResult.success) {
      res.json({ message: 'Invoice email sent successfully', success: true });
    } else {
      res.status(500).json({ error: emailResult.message || 'Error sending email' });
    }
  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({ error: 'Error sending invoice email' });
  }
});

// ========== RATE METERS MANAGEMENT ==========

// Get all rate meters
router.get('/rate-meters', async (req, res) => {
  try {
    const result = await db.allAsync(
      `SELECT * FROM rate_meters ORDER BY service_type, car_category`
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching rate meters:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get rate meter by ID
router.get('/rate-meters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.getAsync(
      'SELECT * FROM rate_meters WHERE id = ?',
      [id]
    );
    if (!result) {
      return res.status(404).json({ error: 'Rate meter not found' });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching rate meter:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create rate meter
router.post('/rate-meters', [
  body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('car_category').notEmpty().withMessage('Car category is required'),
  body('base_fare').isFloat({ min: 0 }).withMessage('Base fare must be a positive number'),
  body('per_km_rate').optional().isFloat({ min: 0 }).withMessage('Per km rate must be a positive number'),
  body('per_hour_rate').optional().isFloat({ min: 0 }).withMessage('Per hour rate must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { service_type, car_category, base_fare, per_km_rate, per_hour_rate, is_active } = req.body;

    // Enforce per_hour_rate for local only
    if (service_type === 'local' && (per_hour_rate === undefined || per_hour_rate === '' || Number(per_hour_rate) < 0)) {
      return res.status(400).json({ error: 'Per hour rate is required and must be >= 0 for local service type' });
    }

    // Check if rate meter already exists for this service_type and car_category
    const existing = await db.getAsync(
      'SELECT * FROM rate_meters WHERE service_type = ? AND car_category = ?',
      [service_type, car_category]
    );

    if (existing) {
      return res.status(400).json({ error: 'Rate meter already exists for this service type and car category' });
    }

    const result = await db.runAsync(
      `INSERT INTO rate_meters (service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        service_type,
        car_category,
        parseFloat(base_fare),
        per_km_rate !== undefined && per_km_rate !== '' ? parseFloat(per_km_rate) : 0,
        0, // per_minute_rate no longer used
        per_hour_rate !== undefined && per_hour_rate !== '' ? parseFloat(per_hour_rate) : 0,
        boolToInt(is_active !== undefined ? is_active : true),
      ]
    );

    const newRateMeter = await db.getAsync('SELECT * FROM rate_meters WHERE id = ?', [result.lastID]);
    res.status(201).json(newRateMeter);
  } catch (error) {
    console.error('Error creating rate meter:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update rate meter
router.put('/rate-meters/:id', [
  body('service_type').optional().isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('car_category').optional().notEmpty().withMessage('Car category cannot be empty'),
  body('base_fare').optional().isFloat({ min: 0 }).withMessage('Base fare must be a positive number'),
  body('per_km_rate').optional().isFloat({ min: 0 }).withMessage('Per km rate must be a positive number'),
  body('per_hour_rate').optional().isFloat({ min: 0 }).withMessage('Per hour rate must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { service_type, car_category, base_fare, per_km_rate, per_hour_rate, is_active } = req.body;

    // Check if rate meter exists
    const existing = await db.getAsync('SELECT * FROM rate_meters WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Rate meter not found' });
    }

    // If service_type or car_category is being changed, check for duplicates
    if (service_type || car_category) {
      const newServiceType = service_type || existing.service_type;
      const newCarCategory = car_category || existing.car_category;
      
      if (newServiceType !== existing.service_type || newCarCategory !== existing.car_category) {
        const duplicate = await db.getAsync(
          'SELECT * FROM rate_meters WHERE service_type = ? AND car_category = ? AND id != ?',
          [newServiceType, newCarCategory, id]
        );
        if (duplicate) {
          return res.status(400).json({ error: 'Rate meter already exists for this service type and car category' });
        }
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (service_type !== undefined) {
      updates.push('service_type = ?');
      values.push(service_type);
    }
    if (car_category !== undefined) {
      updates.push('car_category = ?');
      values.push(car_category);
    }
    if (base_fare !== undefined) {
      updates.push('base_fare = ?');
      values.push(parseFloat(base_fare));
    }
    if (per_km_rate !== undefined) {
      updates.push('per_km_rate = ?');
      values.push(parseFloat(per_km_rate));
    }
    if (per_hour_rate !== undefined) {
      updates.push('per_hour_rate = ?');
      values.push(parseFloat(per_hour_rate));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(boolToInt(is_active));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.runAsync(
      `UPDATE rate_meters SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM rate_meters WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating rate meter:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete rate meter
router.delete('/rate-meters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getAsync('SELECT * FROM rate_meters WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Rate meter not found' });
    }

    await db.runAsync('DELETE FROM rate_meters WHERE id = ?', [id]);
    res.json({ message: 'Rate meter deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate meter:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== DASHBOARD STATS ==========

router.get('/dashboard/stats', async (req, res) => {
  try {
    const [totalBookings, totalCabs, totalCabTypes, recentBookings] = await Promise.all([
      db.getAsync('SELECT COUNT(*) as count FROM bookings'),
      db.getAsync('SELECT COUNT(*) as count FROM cabs WHERE is_active = 1'),
      db.getAsync('SELECT COUNT(*) as count FROM cab_types WHERE is_active = 1'),
      db.getAsync(
        `SELECT COUNT(*) as count FROM bookings WHERE booking_date >= datetime('now', '-7 days')`
      ),
    ]);

    res.json({
      totalBookings: totalBookings.count,
      totalCabs: totalCabs.count,
      totalCabTypes: totalCabTypes.count,
      recentBookings: recentBookings.count,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== CAR OPTIONS MANAGEMENT ==========

// Helper to normalize image URLs to be relative (avoid mixed content) and expose array + primary URL
const normalizeCarOptionImages = (row) => {
  let imageUrls = [];

  if (row.image_url) {
    try {
      const parsed = JSON.parse(row.image_url);
      if (Array.isArray(parsed)) {
        imageUrls = parsed;
      } else if (typeof parsed === 'string') {
        imageUrls = [parsed];
      }
    } catch {
      // Not JSON, treat as single URL string
      imageUrls = [row.image_url];
    }
  }

  const normalizeUrl = (url) => {
    if (!url) return url;

    // If it's an absolute URL, strip protocol/host and keep the /uploads/... path
    try {
      const u = new URL(url);
      if (u.pathname && u.pathname.startsWith('/uploads/')) {
        return u.pathname;
      }
    } catch {
      // Not a full URL, fall through
    }

    // Fallback: look for /uploads/ segment in the string
    const idx = url.indexOf('/uploads/');
    if (idx !== -1) {
      return url.substring(idx);
    }

    return url;
  };

  const normalizedUrls = imageUrls.map(normalizeUrl);

  return {
    ...row,
    image_urls: normalizedUrls,
    image_url: normalizedUrls[0] || null,
  };
};

// Get all car options
router.get('/car-options', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM car_options ORDER BY sort_order ASC, created_at DESC'
    );
    const normalized = result.map(normalizeCarOptionImages);
    res.json(normalized);
  } catch (error) {
    console.error('Error fetching car options:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create car option (supports multiple image uploads)
router.post(
  '/car-options',
  upload.array('images', 10),
  [body('name').notEmpty().withMessage('Name is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, sort_order, car_subtype, cab_type_id } = req.body;

      let imageUrls = [];
      if (req.files && req.files.length > 0) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        imageUrls = req.files.map(
          (file) => `${baseUrl}/uploads/car-options/${file.filename}`
        );
      }

      const result = await db.runAsync(
        `INSERT INTO car_options (name, description, image_url, sort_order, car_subtype, cab_type_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, description || null, imageUrls.length ? JSON.stringify(imageUrls) : null, sort_order || 0, car_subtype || null, cab_type_id || null]
      );

      const newOption = await db.getAsync('SELECT * FROM car_options WHERE id = ?', [result.lastID]);
      res.status(201).json(normalizeCarOptionImages(newOption));
    } catch (error) {
      console.error('Error creating car option:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Update car option (supports multiple image uploads)
router.put('/car-options/:id', upload.array('images', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, sort_order, is_active, car_subtype, cab_type_id } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    // Handle image uploads: append new images to any existing list
    if (req.files && req.files.length > 0) {
      const existing = await db.getAsync('SELECT image_url FROM car_options WHERE id = ?', [id]);
      let existingUrls = [];

      if (existing && existing.image_url) {
        try {
          const parsed = JSON.parse(existing.image_url);
          if (Array.isArray(parsed)) {
            existingUrls = parsed;
          } else if (typeof parsed === 'string') {
            existingUrls = [parsed];
          }
        } catch {
          existingUrls = [existing.image_url];
        }
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const newUrls = req.files.map(
        (file) => `${baseUrl}/uploads/car-options/${file.filename}`
      );

      const combined = [...existingUrls, ...newUrls];
      updates.push('image_url = ?');
      values.push(JSON.stringify(combined));
    } else if (image_url !== undefined) {
      // Allow clearing or manually updating image_url if explicitly provided
      updates.push('image_url = ?');
      values.push(image_url || null);
    }

    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(boolToInt(is_active));
    }
    if (car_subtype !== undefined) {
      updates.push('car_subtype = ?');
      values.push(car_subtype || null);
    }
    if (cab_type_id !== undefined) {
      updates.push('cab_type_id = ?');
      values.push(cab_type_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    await db.runAsync(
      `UPDATE car_options SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM car_options WHERE id = ?', [id]);
    if (!updated) {
      return res.status(404).json({ error: 'Car option not found' });
    }

    res.json(normalizeCarOptionImages(updated));
  } catch (error) {
    console.error('Error updating car option:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete car option
router.delete('/car-options/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.runAsync('DELETE FROM car_options WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Car option not found' });
    }

    res.json({ message: 'Car option deleted successfully' });
  } catch (error) {
    console.error('Error deleting car option:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get cars grouped by cab type and subtype
router.get('/cab-types/:cabTypeId/cars', async (req, res) => {
  try {
    const { cabTypeId } = req.params;
    const cars = await db.allAsync(
      `SELECT co.*, ct.name as cab_type_name
       FROM car_options co
       LEFT JOIN cab_types ct ON co.cab_type_id = ct.id
       WHERE co.cab_type_id = ? AND co.is_active = 1
       ORDER BY co.car_subtype, co.sort_order ASC`,
      [cabTypeId]
    );
    
    // Group by subtype
    const grouped = {};
    cars.forEach(car => {
      const subtype = car.car_subtype || 'Uncategorized';
      if (!grouped[subtype]) {
        grouped[subtype] = [];
      }
      grouped[subtype].push(normalizeCarOptionImages(car));
    });
    
    res.json(grouped);
  } catch (error) {
    console.error('Error fetching cars by cab type:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign car to cab type and subtype
router.post('/cab-types/:cabTypeId/assign-car', [
  body('car_option_id').isInt().withMessage('Car option ID is required'),
  body('car_subtype').optional().notEmpty().withMessage('Car subtype must not be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cabTypeId } = req.params;
    const { car_option_id, car_subtype } = req.body;

    // Verify cab type exists
    const cabType = await db.getAsync('SELECT id FROM cab_types WHERE id = ?', [cabTypeId]);
    if (!cabType) {
      return res.status(404).json({ error: 'Cab type not found' });
    }

    // Verify car option exists
    const carOption = await db.getAsync('SELECT id FROM car_options WHERE id = ?', [car_option_id]);
    if (!carOption) {
      return res.status(404).json({ error: 'Car option not found' });
    }

    // Update car option to reflect assignment
    await db.runAsync(
      'UPDATE car_options SET cab_type_id = ?, car_subtype = ? WHERE id = ?',
      [cabTypeId, car_subtype || null, car_option_id]
    );

    // Record assignment in assigned_cab_for_cab_type table (idempotent)
    await db.runAsync(
      `INSERT OR IGNORE INTO assigned_cab_for_cab_type (cab_type_id, car_option_id)
       VALUES (?, ?)`,
      [cabTypeId, car_option_id]
    );

    // Ensure a corresponding rate meter row exists, based on cab type name and car name
    const fullCabType = await db.getAsync('SELECT * FROM cab_types WHERE id = ?', [cabTypeId]);
    const fullCarOption = await db.getAsync('SELECT * FROM car_options WHERE id = ?', [car_option_id]);

    if (fullCabType && fullCarOption) {
      const nameLower = (fullCabType.name || '').toLowerCase();
      let serviceType = null;
      if (nameLower.includes('local')) serviceType = 'local';
      else if (nameLower.includes('airport')) serviceType = 'airport';
      else if (nameLower.includes('outstation')) serviceType = 'outstation';

      if (serviceType) {
        const carCategory = fullCarOption.name;
        const existingRate = await db.getAsync(
          'SELECT id FROM rate_meters WHERE service_type = ? AND car_category = ?',
          [serviceType, carCategory]
        );

        if (!existingRate) {
          await db.runAsync(
            `INSERT INTO rate_meters (service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
              serviceType,
              carCategory,
              0, // base_fare
              0, // per_km_rate
              0, // per_minute_rate (unused)
              0, // per_hour_rate
            ]
          );
        }
      }
    }

    const updated = await db.getAsync(
      `SELECT co.*, ct.name as cab_type_name
       FROM car_options co
       LEFT JOIN cab_types ct ON co.cab_type_id = ct.id
       WHERE co.id = ?`,
      [car_option_id]
    );

    res.json(normalizeCarOptionImages(updated));
  } catch (error) {
    console.error('Error assigning car to cab type:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all available car options (for dropdown/selection)
router.get('/car-options/available', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM car_options WHERE is_active = 1 ORDER BY name ASC'
    );
    const normalized = result.map(normalizeCarOptionImages);
    res.json(normalized);
  } catch (error) {
    console.error('Error fetching available car options:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== DRIVERS MANAGEMENT ==========

// List drivers
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await db.allAsync(
      `SELECT * FROM drivers ORDER BY created_at DESC`
    );
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create driver
router.post(
  '/drivers',
  upload.single('photo'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, phone, license_number, emergency_contact_name, emergency_contact_phone } = req.body;
      let photoUrl = null;
      if (req.file) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        photoUrl = `${baseUrl}/uploads/drivers/${req.file.filename}`;
      }

      const result = await db.runAsync(
        `INSERT INTO drivers (name, phone, license_number, photo_url, emergency_contact_name, emergency_contact_phone)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, phone, license_number || null, photoUrl, emergency_contact_name || null, emergency_contact_phone || null]
      );

      const newDriver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [result.lastID]);
      res.status(201).json(newDriver);
    } catch (error) {
      console.error('Error creating driver:', error);
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Driver phone or license already exists' });
      }
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Update driver
router.put('/drivers/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, emergency_contact_name, emergency_contact_phone, is_active } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (license_number !== undefined) { updates.push('license_number = ?'); values.push(license_number || null); }
    if (emergency_contact_name !== undefined) { updates.push('emergency_contact_name = ?'); values.push(emergency_contact_name || null); }
    if (emergency_contact_phone !== undefined) { updates.push('emergency_contact_phone = ?'); values.push(emergency_contact_phone || null); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(boolToInt(is_active)); }

    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const photoUrl = `${baseUrl}/uploads/drivers/${req.file.filename}`;
      updates.push('photo_url = ?');
      values.push(photoUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.runAsync(
      `UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!updated) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete driver
router.delete('/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.runAsync('DELETE FROM drivers WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== CORPORATE BOOKINGS (ADMIN) ==========
// Corporate bookings require 'event-bookings' permission

router.get('/corporate-bookings', requireManagerPermission('event-bookings'), async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT cb.*, 
              d.name as driver_name_ref, d.phone as driver_phone_ref,
              c.vehicle_number, ct.name as cab_type_name
       FROM corporate_bookings cb
       LEFT JOIN drivers d ON cb.driver_id = d.id
       LEFT JOIN cabs c ON cb.cab_id = c.id
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       ORDER BY cb.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching corporate bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export corporate bookings to Excel with GST
// Requires 'bills-invoices' permission
router.get('/corporate-bookings/export/excel', requireManagerPermission('bills-invoices'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    
    const bookings = await db.allAsync(
      `SELECT cb.*, 
              d.name as driver_name_ref, d.phone as driver_phone_ref,
              c.vehicle_number
       FROM corporate_bookings cb
       LEFT JOIN drivers d ON cb.driver_id = d.id
       LEFT JOIN cabs c ON cb.cab_id = c.id
       ORDER BY cb.created_at DESC`
    );
    
    // Ensure fare_amount is included (it should be in cb.* but explicitly check)

    // Helper function to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        });
      } catch {
        return dateStr;
      }
    };

    // Helper function to calculate GST (assuming 18% GST)
    const calculateGST = (amount) => {
      if (!amount || amount === 0) return { subTotal: 0, cgst: 0, sgst: 0, gst: 0, total: 0 };
      const subTotal = parseFloat(amount);
      const gst = subTotal * 0.18; // 18% GST
      const cgst = gst / 2; // 9% CGST
      const sgst = gst / 2; // 9% SGST
      const total = subTotal + gst;
      return { subTotal, cgst, sgst, gst, total };
    };

    // Prepare data for Excel
    const excelData = bookings.map((booking, index) => {
      // If fare_amount exists, use it; otherwise set to empty string (can be filled manually)
      const fareAmount = booking.fare_amount !== null && booking.fare_amount !== undefined ? booking.fare_amount : '';
      const numericFare = fareAmount && fareAmount !== '' ? parseFloat(fareAmount) : 0;
      const gstCalc = calculateGST(numericFare);
      
      return {
        'S.No': index + 1,
        'Booking ID': booking.id,
        'Name': booking.name || '',
        'Phone Number': booking.phone_number || '',
        'Company Name': booking.company_name || '',
        'Pickup Point': booking.pickup_point || '',
        'Drop Point': booking.drop_point || '',
        'Status': booking.status || '',
        'Driver Name': booking.driver_name || booking.driver_name_ref || '',
        'Driver Phone': booking.driver_phone || booking.driver_phone_ref || '',
        'Vehicle Number': booking.vehicle_number || '',
        'Fare Amount (₹)': fareAmount !== '' ? (typeof fareAmount === 'number' ? fareAmount.toFixed(2) : fareAmount) : '',
        'Sub Total (₹)': numericFare > 0 ? gstCalc.subTotal.toFixed(2) : '',
        'CGST @ 9% (₹)': numericFare > 0 ? gstCalc.cgst.toFixed(2) : '',
        'SGST @ 9% (₹)': numericFare > 0 ? gstCalc.sgst.toFixed(2) : '',
        'Total GST @ 18% (₹)': numericFare > 0 ? gstCalc.gst.toFixed(2) : '',
        'Grand Total (₹)': numericFare > 0 ? gstCalc.total.toFixed(2) : '',
        'Assigned At': formatDate(booking.assigned_at),
        'Created At': formatDate(booking.created_at),
        'Updated At': formatDate(booking.updated_at),
        'Notes': booking.notes || ''
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const columnWidths = [
      { wch: 6 },   // S.No
      { wch: 12 },  // Booking ID
      { wch: 20 },  // Name
      { wch: 15 },  // Phone Number
      { wch: 25 },  // Company Name
      { wch: 30 },  // Pickup Point
      { wch: 30 },  // Drop Point
      { wch: 12 },  // Status
      { wch: 20 },  // Driver Name
      { wch: 15 },  // Driver Phone
      { wch: 15 },  // Vehicle Number
      { wch: 15 },  // Fare Amount
      { wch: 15 },  // Sub Total
      { wch: 15 },  // CGST
      { wch: 15 },  // SGST
      { wch: 18 },  // Total GST
      { wch: 18 },  // Grand Total
      { wch: 20 },  // Assigned At
      { wch: 20 },  // Created At
      { wch: 20 },  // Updated At
      { wch: 40 }   // Notes
    ];
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Corporate Bookings');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellStyles: true
    });

    // Set response headers
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=corporate-bookings-invoices-${timestamp}.xlsx`);
    
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting corporate bookings to Excel:', error);
    res.status(500).json({ error: 'Error generating Excel export' });
  }
});

// Assign corporate booking - requires edit permission for event-bookings
router.put('/corporate-bookings/:id/assign', 
  requireManagerPermission('event-bookings', true), // true = requires edit permission
  [
    body('driver_id').optional({ nullable: true }).isInt().withMessage('driver_id must be int'),
    body('cab_id').optional({ nullable: true }).isInt().withMessage('cab_id must be int'),
  ], 
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { driver_id, cab_id } = req.body;

    const booking = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    let driverName = null;
    let driverPhone = null;
    if (driver_id) {
      const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      driverName = driver.name;
      driverPhone = driver.phone;
    }

    if (cab_id) {
      const cab = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [cab_id]);
      if (!cab) return res.status(404).json({ error: 'Cab not found' });
    }

    const updates = [];
    const values = [];

    if (driver_id !== undefined) {
      updates.push('driver_id = ?');
      values.push(driver_id || null);
      updates.push('driver_name = ?');
      values.push(driverName);
      updates.push('driver_phone = ?');
      values.push(driverPhone);
    }
    if (cab_id !== undefined) {
      updates.push('cab_id = ?');
      values.push(cab_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("assigned_at = CURRENT_TIMESTAMP");
    updates.push("status = 'confirmed'");

    const sql = `UPDATE corporate_bookings SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    await db.runAsync(sql, values);

    const updated = await db.getAsync(
      `SELECT cb.*, d.name as driver_name_ref, d.phone as driver_phone_ref, c.vehicle_number
       FROM corporate_bookings cb
       LEFT JOIN drivers d ON cb.driver_id = d.id
       LEFT JOIN cabs c ON cb.cab_id = c.id
       WHERE cb.id = ?`,
      [id]
    );
    res.json(updated);
  } catch (error) {
    console.error('Error assigning corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update corporate booking status
// Requires edit permission for event-bookings
router.put('/corporate-bookings/:id', 
  requireManagerPermission('event-bookings', true), // true = requires edit permission
  [
    body('status').optional().isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;

      const existing = await db.getAsync(
        'SELECT * FROM corporate_bookings WHERE id = ?',
        [id]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Corporate booking not found' });
      }

      if (status) {
        await db.runAsync(
          'UPDATE corporate_bookings SET status = ? WHERE id = ?',
          [status, id]
        );
      }

      const updated = await db.getAsync(
        `SELECT cb.*, 
                d.name as driver_name_ref, d.phone as driver_phone_ref,
                c.vehicle_number, ct.name as cab_type_name
         FROM corporate_bookings cb
         LEFT JOIN drivers d ON cb.driver_id = d.id
         LEFT JOIN cabs c ON cb.cab_id = c.id
         LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
         WHERE cb.id = ?`,
        [id]
      );

      res.json(updated);
    } catch (error) {
      console.error('Error updating corporate booking:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Register car with documents
router.post('/cars/register', upload.single('documents'), [
  body('name').notEmpty().withMessage('Car name is required'),
  body('category').isIn(['SUV', 'Sedan']).withMessage('Category must be SUV or Sedan'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category } = req.body;
    let documentsUrl = null;

    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      documentsUrl = `${baseUrl}/uploads/car-documents/${req.file.filename}`;
    }

    // Create registered_cars table if it doesn't exist
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS registered_cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('SUV', 'Sedan')),
        documents_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await db.runAsync(
      `INSERT INTO registered_cars (name, category, documents_url) VALUES (?, ?, ?)`,
      [name, category, documentsUrl]
    );

    const newCar = await db.getAsync(
      'SELECT * FROM registered_cars WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json(newCar);
  } catch (error) {
    console.error('Error registering car:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
