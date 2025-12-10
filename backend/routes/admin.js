const express = require('express');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
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

// Receipts directory (shared with public bookings router)
const receiptsDir = path.join(__dirname, '..', 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, carOptionsUploadDir);
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

// Create cab type
router.post('/cab-types', [
  body('name').notEmpty().withMessage('Name is required'),
  body('base_fare').isNumeric().withMessage('Base fare must be a number'),
  body('per_km_rate').isNumeric().withMessage('Per km rate must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, base_fare, per_km_rate, per_minute_rate, capacity } = req.body;

    const result = await db.runAsync(
      `INSERT INTO cab_types (name, description, base_fare, per_km_rate, per_minute_rate, capacity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, base_fare, per_km_rate, per_minute_rate || 0, capacity || 4]
    );

    const newCabType = await db.getAsync('SELECT * FROM cab_types WHERE id = ?', [result.lastID]);
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

    const { vehicle_number, cab_type_id, driver_id, driver_name, driver_phone } = req.body;

    // If driver_id is provided, get driver details
    let finalDriverName = driver_name || null;
    let finalDriverPhone = driver_phone || null;
    
    if (driver_id) {
      const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (driver) {
        finalDriverName = driver.name;
        finalDriverPhone = driver.phone;
      }
    }

    const result = await db.runAsync(
      `INSERT INTO cabs (vehicle_number, cab_type_id, driver_id, driver_name, driver_phone)
       VALUES (?, ?, ?, ?, ?)`,
      [vehicle_number, cab_type_id, driver_id || null, finalDriverName, finalDriverPhone]
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
    const { vehicle_number, cab_type_id, driver_id, driver_name, driver_phone, is_available, is_active } = req.body;

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
      updates.push('driver_id = ?');
      values.push(driver_id);
      
      // If driver_id is provided, get driver details and update driver_name and driver_phone
      if (driver_id) {
        const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [driver_id]);
        if (driver) {
          updates.push('driver_name = ?');
          values.push(driver.name);
          updates.push('driver_phone = ?');
          values.push(driver.phone);
        }
      } else {
        // If driver_id is set to null, clear driver_name and driver_phone
        updates.push('driver_name = NULL');
        updates.push('driver_phone = NULL');
      }
    } else {
      // Only update driver_name and driver_phone if driver_id is not being changed
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

    const updated = await db.getAsync(
      `SELECT c.*, ct.name as cab_type_name,
              d.name as registered_driver_name, d.phone as registered_driver_phone
       FROM cabs c
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       LEFT JOIN drivers d ON c.driver_id = d.id
       WHERE c.id = ?`,
      [id]
    );
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
    const result = await db.allAsync(
      `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name, c.driver_phone
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       ORDER BY b.id DESC`
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download receipt PDF for a booking (admin-only)
router.get('/bookings/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;

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

    const doc = new PDFDocument({ margin: 50 });

    const filename = `booking-${booking.id}-receipt.pdf`;
    const filePath = path.join(receiptsDir, filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Save to disk and stream to client at the same time
    const fileStream = fs.createWriteStream(filePath);
    doc.pipe(fileStream);
    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .text('Namma Cabs – Booking Receipt', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .text(`Receipt ID: NC-${booking.id}`, { align: 'center' })
      .text(`Date: ${new Date(booking.booking_date).toLocaleString()}`, {
        align: 'center',
      })
      .moveDown(1.5);

    // Customer
    doc.fontSize(14).text('Customer Details', { underline: true }).moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Name: ${booking.passenger_name || booking.username || ''}`)
      .text(`Phone: ${booking.passenger_phone || '-'}`)
      .text(`Email: ${booking.passenger_email || booking.email || '-'}`)
      .moveDown(1);

    // Trip
    doc.fontSize(14).text('Trip Details', { underline: true }).moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `Service Type: ${
          booking.service_type === 'local'
            ? 'Local'
            : booking.service_type === 'airport'
            ? 'Airport'
            : 'Outstation'
        }`
      )
      .text(`From: ${booking.from_location}`)
      .text(`To: ${booking.to_location}`)
      .text(`Cab Type: ${booking.cab_type_name || 'Cab'}`)
      .text(`Car Option: ${booking.car_option_name || 'Not specified'}`)
      .text(`Distance: ${booking.distance_km} km`)
      .text(`Estimated Time: ${booking.estimated_time_minutes} minutes`)
      .text(
        `Travel Date: ${
          booking.travel_date
            ? new Date(booking.travel_date).toLocaleString()
            : 'Not specified'
        }`
      )
      .moveDown(1);

    // Fare
    doc.fontSize(14).text('Fare Summary', { underline: true }).moveDown(0.5);
    doc.fontSize(12).text(`Total Fare: ₹${booking.fare_amount.toFixed(2)}`);
    doc.text(`Status: ${booking.booking_status}`);
    if (booking.notes) {
      doc.moveDown(0.5).text(`Notes: ${booking.notes}`);
    }

    doc
      .moveDown(2)
      .fontSize(10)
      .text('Thank you for riding with Namma Cabs!', {
        align: 'center',
      });

    doc.end();
  } catch (error) {
    console.error('Error generating receipt PDF (admin):', error);
    res.status(500).json({ error: 'Error generating receipt' });
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
  body('per_km_rate').isFloat({ min: 0 }).withMessage('Per km rate must be a positive number'),
  body('per_minute_rate').isFloat({ min: 0 }).withMessage('Per minute rate must be a positive number'),
  body('per_hour_rate').isFloat({ min: 0 }).withMessage('Per hour rate must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate, is_active } = req.body;

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
        parseFloat(per_km_rate),
        parseFloat(per_minute_rate),
        parseFloat(per_hour_rate),
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
  body('per_minute_rate').optional().isFloat({ min: 0 }).withMessage('Per minute rate must be a positive number'),
  body('per_hour_rate').optional().isFloat({ min: 0 }).withMessage('Per hour rate must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { service_type, car_category, base_fare, per_km_rate, per_minute_rate, per_hour_rate, is_active } = req.body;

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
    if (per_minute_rate !== undefined) {
      updates.push('per_minute_rate = ?');
      values.push(parseFloat(per_minute_rate));
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

// Helper to normalize image_url column into array + primary URL
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

  return {
    ...row,
    image_urls: imageUrls,
    image_url: imageUrls[0] || null,
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
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('cab_type_id').isInt().withMessage('Cab type ID is required and must be an integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, sort_order, car_subtype, cab_type_id } = req.body;

      // Verify cab_type_id exists
      const cabType = await db.getAsync('SELECT id FROM cab_types WHERE id = ? AND is_active = 1', [cab_type_id]);
      if (!cabType) {
        return res.status(400).json({ error: 'Invalid cab type ID. Please select a valid cab type.' });
      }

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
        [name, description || null, imageUrls.length ? JSON.stringify(imageUrls) : null, sort_order || 0, car_subtype || null, cab_type_id]
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
      // Validate cab_type_id if provided
      if (cab_type_id !== null && cab_type_id !== '') {
        const cabType = await db.getAsync('SELECT id FROM cab_types WHERE id = ? AND is_active = 1', [cab_type_id]);
        if (!cabType) {
          return res.status(400).json({ error: 'Invalid cab type ID. Please select a valid cab type.' });
        }
        updates.push('cab_type_id = ?');
        values.push(cab_type_id);
      } else {
        return res.status(400).json({ error: 'Cab type ID is required. Every car must be assigned to a cab type.' });
      }
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

    // Update car option
    await db.runAsync(
      'UPDATE car_options SET cab_type_id = ?, car_subtype = ? WHERE id = ?',
      [cabTypeId, car_subtype || null, car_option_id]
    );

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

// ========== CORPORATE BOOKINGS MANAGEMENT ==========

// Get all corporate bookings
router.get('/corporate-bookings', async (req, res) => {
  try {
    const bookings = await db.allAsync(
      `SELECT cb.*, c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone, ct.name as cab_type_name
       FROM corporate_bookings cb
       LEFT JOIN cabs c ON cb.cab_id = c.id
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       ORDER BY cb.created_at DESC`
    );
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching corporate bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single corporate booking
router.get('/corporate-bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update corporate booking
router.put('/corporate-bookings/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone_number').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('company_name').optional().notEmpty().withMessage('Company name cannot be empty'),
  body('pickup_point').optional().notEmpty().withMessage('Pickup point cannot be empty'),
  body('drop_point').optional().notEmpty().withMessage('Drop point cannot be empty'),
  body('status').optional().isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, phone_number, company_name, pickup_point, drop_point, status, notes } = req.body;

    // Check if booking exists
    const existing = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (phone_number !== undefined) {
      updates.push('phone_number = ?');
      values.push(phone_number);
    }
    if (company_name !== undefined) {
      updates.push('company_name = ?');
      values.push(company_name);
    }
    if (pickup_point !== undefined) {
      updates.push('pickup_point = ?');
      values.push(pickup_point);
    }
    if (drop_point !== undefined) {
      updates.push('drop_point = ?');
      values.push(drop_point);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.runAsync(
      `UPDATE corporate_bookings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete corporate booking
router.delete('/corporate-bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    await db.runAsync('DELETE FROM corporate_bookings WHERE id = ?', [id]);

    res.json({ message: 'Corporate booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available drivers based on pickup and drop locations
router.post('/corporate-bookings/available-drivers', [
  body('pickup_point').notEmpty().withMessage('Pickup point is required'),
  body('drop_point').notEmpty().withMessage('Drop point is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickup_point, drop_point } = req.body;

    // Get all available registered drivers that are active
    const availableDrivers = await db.allAsync(
      `SELECT d.*
       FROM drivers d
       WHERE d.is_active = 1
       AND (d.id NOT IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1 AND is_available = 0
       ) OR d.id IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1 AND is_available = 1
       ))
       ORDER BY d.name ASC`
    );

    res.json({
      pickup_point,
      drop_point,
      available_drivers: availableDrivers,
      count: availableDrivers.length
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign driver to corporate booking
router.post('/corporate-bookings/:id/assign-driver', [
  body('driver_id').isInt().withMessage('Driver ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { driver_id } = req.body;

    // Check if corporate booking exists
    const booking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    // Check if driver exists and is active
    const driver = await db.getAsync(
      'SELECT * FROM drivers WHERE id = ? AND is_active = 1',
      [driver_id]
    );

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found or inactive' });
    }

    // Find an available cab with this driver, or create a new cab assignment
    // For now, we'll just assign the driver info to the booking
    // In a full implementation, you might want to assign a cab with this driver
    await db.runAsync(
      `UPDATE corporate_bookings 
       SET driver_name = ?, driver_phone = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [driver.name, driver.phone, id]
    );

    // Get updated booking
    const updatedBooking = await db.getAsync(
      `SELECT cb.*, d.name as driver_name, d.phone as driver_phone
       FROM corporate_bookings cb
       LEFT JOIN drivers d ON cb.driver_name = d.name AND cb.driver_phone = d.phone
       WHERE cb.id = ?`,
      [id]
    );

    res.json({
      message: 'Driver assigned successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unassign driver from corporate booking
router.post('/corporate-bookings/:id/unassign-driver', async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    // Unassign driver
    await db.runAsync(
      `UPDATE corporate_bookings 
       SET cab_id = NULL, driver_name = NULL, driver_phone = NULL, assigned_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    const updatedBooking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Driver unassigned successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error unassigning driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== DRIVERS MANAGEMENT ==========

// Get all drivers
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await db.allAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       ORDER BY d.created_at DESC`
    );
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single driver
router.get('/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await db.getAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       WHERE d.id = ?`,
      [id]
    );

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create driver
router.post('/drivers', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      phone,
      email,
      license_number,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      experience_years
    } = req.body;

    // Check if phone already exists
    const existing = await db.getAsync(
      'SELECT id FROM drivers WHERE phone = ?',
      [phone]
    );

    if (existing) {
      return res.status(400).json({ error: 'Driver with this phone number already exists' });
    }

    // Check if license number already exists (if provided)
    if (license_number) {
      const existingLicense = await db.getAsync(
        'SELECT id FROM drivers WHERE license_number = ?',
        [license_number]
      );

      if (existingLicense) {
        return res.status(400).json({ error: 'Driver with this license number already exists' });
      }
    }

    const result = await db.runAsync(
      `INSERT INTO drivers (
        name, phone, email, license_number, address, 
        emergency_contact_name, emergency_contact_phone, experience_years
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        phone,
        email || null,
        license_number || null,
        address || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        experience_years || null
      ]
    );

    const newDriver = await db.getAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       WHERE d.id = ?`,
      [result.lastID]
    );

    res.status(201).json(newDriver);
  } catch (error) {
    console.error('Error creating driver:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Driver with this phone or license number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update driver
router.put('/drivers/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      phone,
      email,
      license_number,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      experience_years,
      is_active
    } = req.body;

    // Check if driver exists
    const existing = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if phone is being changed and already exists
    if (phone && phone !== existing.phone) {
      const phoneExists = await db.getAsync(
        'SELECT id FROM drivers WHERE phone = ? AND id != ?',
        [phone, id]
      );
      if (phoneExists) {
        return res.status(400).json({ error: 'Driver with this phone number already exists' });
      }
    }

    // Check if license number is being changed and already exists
    if (license_number && license_number !== existing.license_number) {
      const licenseExists = await db.getAsync(
        'SELECT id FROM drivers WHERE license_number = ? AND id != ?',
        [license_number, id]
      );
      if (licenseExists) {
        return res.status(400).json({ error: 'Driver with this license number already exists' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (license_number !== undefined) {
      updates.push('license_number = ?');
      values.push(license_number);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (emergency_contact_name !== undefined) {
      updates.push('emergency_contact_name = ?');
      values.push(emergency_contact_name);
    }
    if (emergency_contact_phone !== undefined) {
      updates.push('emergency_contact_phone = ?');
      values.push(emergency_contact_phone);
    }
    if (experience_years !== undefined) {
      updates.push('experience_years = ?');
      values.push(experience_years);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
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

    const updated = await db.getAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       WHERE d.id = ?`,
      [id]
    );

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

    const existing = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if driver is assigned to any active cabs
    const assignedCabs = await db.getAsync(
      'SELECT COUNT(*) as count FROM cabs WHERE driver_id = ? AND is_active = 1',
      [id]
    );

    if (assignedCabs && assignedCabs.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete driver. Driver is assigned to active cabs. Please unassign first.' 
      });
    }

    await db.runAsync('DELETE FROM drivers WHERE id = ?', [id]);

    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available drivers (not assigned to any active cab or assigned to available cabs)
router.get('/drivers/available/list', async (req, res) => {
  try {
    const drivers = await db.allAsync(
      `SELECT d.*
       FROM drivers d
       WHERE d.is_active = 1
       AND (d.id NOT IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1
       ) OR d.id IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1 AND is_available = 1
       ))
       ORDER BY d.name ASC`
    );
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
