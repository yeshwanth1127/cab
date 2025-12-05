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

    const { vehicle_number, cab_type_id, driver_name, driver_phone } = req.body;

    const result = await db.runAsync(
      `INSERT INTO cabs (vehicle_number, cab_type_id, driver_name, driver_phone)
       VALUES (?, ?, ?, ?)`,
      [vehicle_number, cab_type_id, driver_name || null, driver_phone || null]
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
    const { vehicle_number, cab_type_id, driver_name, driver_phone, is_available, is_active } = req.body;

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
    if (driver_name !== undefined) {
      updates.push('driver_name = ?');
      values.push(driver_name);
    }
    if (driver_phone !== undefined) {
      updates.push('driver_phone = ?');
      values.push(driver_phone);
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
    const result = await db.allAsync(
      `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name, c.driver_phone
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       ORDER BY b.booking_date DESC`
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
  [body('name').notEmpty().withMessage('Name is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, sort_order } = req.body;

      let imageUrls = [];
      if (req.files && req.files.length > 0) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        imageUrls = req.files.map(
          (file) => `${baseUrl}/uploads/car-options/${file.filename}`
        );
      }

      const result = await db.runAsync(
        `INSERT INTO car_options (name, description, image_url, sort_order)
         VALUES (?, ?, ?, ?)`,
        [name, description || null, imageUrls.length ? JSON.stringify(imageUrls) : null, sort_order || 0]
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
    const { name, description, image_url, sort_order, is_active } = req.body;

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

module.exports = router;
