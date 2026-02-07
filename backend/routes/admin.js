const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/invoiceService');

const router = express.Router();

// All admin routes require authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Ensure optional columns exist on bookings table (migration)
async function ensureBookingsColumns() {
  const columns = [
    ['service_type', 'TEXT'],
    ['number_of_hours', 'INTEGER'],
    ['pickup_lat', 'REAL'],
    ['pickup_lng', 'REAL'],
    ['destination_lat', 'REAL'],
    ['destination_lng', 'REAL'],
    ['maps_link', 'TEXT'],
    ['assigned_at', 'DATETIME'],
    ['trip_type', 'TEXT'],
  ];
  for (const [col, type] of columns) {
    try {
      await db.runAsync(`ALTER TABLE bookings ADD COLUMN ${col} ${type}`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
}

// Build Google Maps directions URL from booking (address or lat/lng)
function generateGoogleMapsLink(booking) {
  let origin = null;
  let destination = null;
  if (booking.pickup_lat != null && booking.pickup_lng != null) {
    origin = `${booking.pickup_lat},${booking.pickup_lng}`;
  } else if (booking.from_location) {
    origin = encodeURIComponent(booking.from_location);
  }
  if (booking.destination_lat != null && booking.destination_lng != null) {
    destination = `${booking.destination_lat},${booking.destination_lng}`;
  } else if (booking.to_location) {
    destination = encodeURIComponent(booking.to_location);
  }
  if (!origin && !destination) return null;
  if (origin && destination) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  }
  const point = origin || destination;
  return `https://www.google.com/maps/search/?api=1&query=${point}`;
}

// GET /dashboard/stats - Dashboard statistics (Enquiries=pending, Assigned=has cab, Completed, Cancelled)
router.get('/dashboard/stats', async (req, res) => {
  try {
    await ensureBookingsColumns();
    const totalRow = await db.getAsync('SELECT COUNT(*) as count FROM bookings');
    const pendingRow = await db.getAsync(
      "SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'pending'"
    );
    const confirmedRow = await db.getAsync(
      "SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'confirmed'"
    );
    const completedRow = await db.getAsync(
      "SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'completed'"
    );
    const cancelledRow = await db.getAsync(
      "SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'cancelled'"
    );
    const assignedRow = await db.getAsync(
      'SELECT COUNT(*) as count FROM bookings WHERE cab_id IS NOT NULL'
    );
    res.json({
      totalBookings: totalRow?.count ?? 0,
      pending: pendingRow?.count ?? 0,
      confirmed: confirmedRow?.count ?? 0,
      completed: completedRow?.count ?? 0,
      cancelled: cancelledRow?.count ?? 0,
      assigned: assignedRow?.count ?? 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /bookings - List all bookings with cab/driver info and cab type name
router.get('/bookings', async (req, res) => {
  try {
    await ensureBookingsColumns();
    const bookings = await db.allAsync(
      `SELECT b.*, c.vehicle_number, c.driver_name as driver_name, c.driver_phone as driver_phone,
              ct.name as cab_type_name
       FROM bookings b
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       ORDER BY b.id DESC`
    );
    res.json(bookings || []);
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /bookings - Create booking (admin)
router.post('/bookings', [
  body('from_location').notEmpty().withMessage('from_location is required'),
  body('to_location').notEmpty().withMessage('to_location is required'),
  body('passenger_name').notEmpty().withMessage('passenger_name is required'),
  body('passenger_phone').notEmpty().withMessage('passenger_phone is required'),
  body('fare_amount').isFloat({ min: 0 }).withMessage('fare_amount must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    await ensureBookingsColumns();
    const {
      from_location,
      to_location,
      passenger_name,
      passenger_phone,
      fare_amount,
      service_type,
      number_of_hours,
      cab_id,
      cab_type_id,
      pickup_lat,
      pickup_lng,
      destination_lat,
      destination_lng,
    } = req.body;

    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, cab_id, cab_type_id,
        service_type, number_of_hours, pickup_lat, pickup_lng, destination_lat, destination_lng
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        from_location,
        to_location,
        0,
        null,
        Number(fare_amount),
        passenger_name,
        passenger_phone,
        cab_id || null,
        cab_type_id || null,
        service_type || 'local',
        number_of_hours != null ? Number(number_of_hours) : null,
        pickup_lat != null ? Number(pickup_lat) : null,
        pickup_lng != null ? Number(pickup_lng) : null,
        destination_lat != null ? Number(destination_lat) : null,
        destination_lng != null ? Number(destination_lng) : null,
      ]
    );
    const newBooking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating admin booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /bookings/:id - Update booking (assign cab, status; generate maps_link)
router.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { booking_status, cab_id } = req.body;

    const existing = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await ensureBookingsColumns();

    const updates = [];
    const values = [];

    if (booking_status !== undefined) {
      const valid = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!valid.includes(booking_status)) {
        return res.status(400).json({ error: 'Invalid booking_status' });
      }
      updates.push('booking_status = ?');
      values.push(booking_status);
    }
    if (cab_id !== undefined) {
      updates.push('cab_id = ?');
      values.push(cab_id || null);
      if (cab_id) {
        updates.push("assigned_at = datetime('now')");
      } else {
        updates.push('assigned_at = ?');
        values.push(null);
      }
    }

    if (updates.length === 0) {
      // Still return current booking; may want to regenerate maps_link
      const updated = await db.getAsync(
        `SELECT b.*, c.vehicle_number, c.driver_name as driver_name, c.driver_phone as driver_phone, ct.name as cab_type_name
         FROM bookings b LEFT JOIN cabs c ON b.cab_id = c.id LEFT JOIN cab_types ct ON b.cab_type_id = ct.id WHERE b.id = ?`,
        [id]
      );
      return res.json(updated);
    }

    values.push(id);
    await db.runAsync(
      `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [id]);
    const mapsLink = generateGoogleMapsLink(updated);
    if (mapsLink) {
      try {
        await db.runAsync('UPDATE bookings SET maps_link = ? WHERE id = ?', [mapsLink, id]);
        updated.maps_link = mapsLink;
      } catch (e) {
        // maps_link column might not exist on very old DBs
      }
    }

    const withCab = await db.getAsync(
      `SELECT b.*, c.vehicle_number, c.driver_name as driver_name, c.driver_phone as driver_phone, ct.name as cab_type_name
       FROM bookings b LEFT JOIN cabs c ON b.cab_id = c.id LEFT JOIN cab_types ct ON b.cab_type_id = ct.id WHERE b.id = ?`,
      [id]
    );
    res.json(withCab);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /cabs - List all cabs with driver and cab type info (for assign dropdown, rate-meter modal, Others tab)
router.get('/cabs', async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT c.id, c.vehicle_number, c.driver_id, c.driver_name, c.driver_phone, c.cab_type_id, ct.name as cab_type_name
       FROM cabs c
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       WHERE c.is_active = 1
       ORDER BY c.vehicle_number`
    );
    const cabs = (rows || []).map((r) => ({
      id: r.id,
      vehicle_number: r.vehicle_number ?? r.VEHICLE_NUMBER ?? '',
      driver_id: r.driver_id ?? r.DRIVER_ID ?? null,
      driver_name: r.driver_name ?? r.DRIVER_NAME ?? '',
      driver_phone: r.driver_phone ?? r.DRIVER_PHONE ?? '',
      cab_type_id: r.cab_type_id ?? r.CAB_TYPE_ID,
      cab_type_name: r.cab_type_name ?? r.CAB_TYPE_NAME ?? '—',
    }));
    res.json(cabs);
  } catch (error) {
    console.error('Error fetching cabs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /drivers - List drivers (full row for Driver Status; rate-meter modal uses id, name, phone)
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await db.allAsync(
      'SELECT * FROM drivers WHERE is_active = 1 ORDER BY name'
    );
    res.json(drivers || []);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /drivers - Create driver
router.post('/drivers', [
  body('name').notEmpty().trim().withMessage('name is required'),
  body('phone').notEmpty().trim().withMessage('phone is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e) => e.msg).join('; ');
      return res.status(400).json({ error: msg, errors: errors.array() });
    }
    const { name, phone, license_number, emergency_contact_name, emergency_contact_phone } = req.body;
    const phoneTrim = String(phone).trim();
    const nameTrim = String(name).trim();
    const existing = await db.getAsync('SELECT id FROM drivers WHERE phone = ?', [phoneTrim]);
    if (existing) {
      return res.status(400).json({ error: 'A driver with this phone number already exists.' });
    }
    const result = await db.runAsync(
      `INSERT INTO drivers (name, phone, license_number, emergency_contact_name, emergency_contact_phone)
       VALUES (?, ?, ?, ?, ?)`,
      [
        nameTrim,
        phoneTrim,
        license_number != null ? String(license_number).trim() : null,
        emergency_contact_name != null ? String(emergency_contact_name).trim() : null,
        emergency_contact_phone != null ? String(emergency_contact_phone).trim() : null,
      ]
    );
    const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [result.lastID]);
    res.status(201).json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// PUT /drivers/:id - Update driver
router.put('/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, emergency_contact_name, emergency_contact_phone } = req.body;

    const existing = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Driver not found' });
    }

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
    if (license_number !== undefined) {
      updates.push('license_number = ?');
      values.push(license_number);
    }
    if (emergency_contact_name !== undefined) {
      updates.push('emergency_contact_name = ?');
      values.push(emergency_contact_name);
    }
    if (emergency_contact_phone !== undefined) {
      updates.push('emergency_contact_phone = ?');
      values.push(emergency_contact_phone);
    }
    if (updates.length === 0) {
      return res.json(existing);
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await db.runAsync(
      `UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    const updated = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /drivers/:id - Soft-delete driver
router.delete('/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    await db.runAsync('UPDATE drivers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    res.json({ message: 'Driver deactivated successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /bookings/:id/invoice - Download invoice PDF for an existing booking (with_gst=true|false)
router.get('/bookings/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const withGST = req.query.with_gst !== 'false';
    const booking = await db.getAsync(
      `SELECT b.*, ct.name as cab_type_name
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       WHERE b.id = ?`,
      [id]
    );
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const pdfBuffer = await generateInvoicePDF(booking, withGST);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}${withGST ? '-with-gst' : ''}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating booking invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /invoice/create - Create a booking and return invoice PDF (for Billing → Create Invoice)
router.post('/invoice/create', [
  body('from_location').notEmpty().withMessage('from_location is required'),
  body('to_location').notEmpty().withMessage('to_location is required'),
  body('passenger_name').notEmpty().withMessage('passenger_name is required'),
  body('passenger_phone').notEmpty().withMessage('passenger_phone is required'),
  body('fare_amount').isFloat({ min: 0 }).withMessage('fare_amount must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    await ensureBookingsColumns();
    const {
      from_location,
      to_location,
      passenger_name,
      passenger_phone,
      passenger_email,
      fare_amount,
      service_type,
      number_of_hours,
      trip_type,
      with_gst,
    } = req.body;

    const svcType = service_type || 'local';
    const outstationTripType = svcType === 'outstation' && trip_type && ['one_way', 'round_trip', 'multiple_stops'].includes(trip_type) ? trip_type : null;

    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, cab_id, cab_type_id,
        service_type, number_of_hours, trip_type, pickup_lat, pickup_lng, destination_lat, destination_lng
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        from_location,
        to_location,
        0,
        null,
        Number(fare_amount),
        passenger_name,
        passenger_phone,
        null,
        null,
        svcType,
        number_of_hours != null ? Number(number_of_hours) : null,
        outstationTripType,
        null,
        null,
        null,
        null,
      ]
    );
    const newBooking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    const bookingForPdf = { ...newBooking, passenger_email: passenger_email || null, trip_type: outstationTripType || newBooking.trip_type };
    const withGST = with_gst !== false;
    const pdfBuffer = await generateInvoicePDF(bookingForPdf, withGST);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${newBooking.id}${withGST ? '-with-gst' : ''}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Rate Meter (cab types, cabs, local/airport/outstation rates) – mount last so /drivers, /cabs etc. match first
router.use(require('./rateMeter'));

module.exports = router;
