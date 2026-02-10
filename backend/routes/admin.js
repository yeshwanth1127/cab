const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/invoiceService');
const { generateGoogleMapsLink } = require('../utils/mapsLink');
const { triggerDriverInfo, triggerInvoiceGenerated } = require('../services/n8nWebhooks');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

async function ensureBookingsColumns() {
  const columns = [
    ['service_type', 'TEXT'],
    ['number_of_hours', 'INTEGER'],
    ['pickup_lat', 'REAL'],
    ['pickup_lng', 'REAL'],
    ['destination_lat', 'REAL'],
    ['destination_lng', 'REAL'],
    ['maps_link', 'TEXT'],
    ['maps_link_drop', 'TEXT'],
    ['assigned_at', 'DATETIME'],
    ['trip_type', 'TEXT'],
    ['invoice_number', 'TEXT'],
    ['travel_date', 'DATETIME'],
  ];
  for (const [col, type] of columns) {
    try {
      await db.runAsync(`ALTER TABLE bookings ADD COLUMN ${col} ${type}`);
    } catch (e) {

    }
  }
}

async function generateDefaultInvoiceNumber(date) {
  const d = date ? new Date(date) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const prefix = `${y}${m}${day}`;
  const rows = await db.allAsync(
    "SELECT invoice_number FROM bookings WHERE invoice_number IS NOT NULL AND invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1",
    [prefix + '%']
  );
  let seq = 1;
  if (rows && rows.length > 0 && rows[0].invoice_number) {
    const last = String(rows[0].invoice_number);
    if (last.length >= 12) {
      const num = parseInt(last.slice(-4), 10);
      if (!Number.isNaN(num)) seq = num + 1;
    }
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

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
      travel_date,
    } = req.body;

    const invoiceNumber = await generateDefaultInvoiceNumber();
    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, cab_id, cab_type_id,
        service_type, number_of_hours, pickup_lat, pickup_lng, destination_lat, destination_lng,
        invoice_number, travel_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        invoiceNumber,
        travel_date || null,
      ]
    );
    let newBooking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    const { pickup, drop: dropLink } = generateGoogleMapsLink(newBooking);
    try {
      if (pickup) await db.runAsync('UPDATE bookings SET maps_link = ? WHERE id = ?', [pickup, newBooking.id]);
      await db.runAsync('UPDATE bookings SET maps_link_drop = ? WHERE id = ?', [dropLink || null, newBooking.id]);
      newBooking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [newBooking.id]);
    } catch (e) {

    }
    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating admin booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { booking_status, cab_id, invoice_number } = req.body;

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
    if (invoice_number !== undefined) {
      updates.push('invoice_number = ?');
      values.push(invoice_number ? String(invoice_number).trim() : null);
    }

    if (updates.length === 0) {

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
    const { pickup, drop: dropLink } = generateGoogleMapsLink(updated);
    try {
      if (pickup) {
        await db.runAsync('UPDATE bookings SET maps_link = ? WHERE id = ?', [pickup, id]);
        updated.maps_link = pickup;
      }
      await db.runAsync('UPDATE bookings SET maps_link_drop = ? WHERE id = ?', [dropLink || null, id]);
      updated.maps_link_drop = dropLink || null;
    } catch (e) {

    }

    const withCab = await db.getAsync(
      `SELECT b.*, c.vehicle_number, c.driver_name as driver_name, c.driver_phone as driver_phone, ct.name as cab_type_name
       FROM bookings b LEFT JOIN cabs c ON b.cab_id = c.id LEFT JOIN cab_types ct ON b.cab_type_id = ct.id WHERE b.id = ?`,
      [id]
    );
    if (cab_id) {
      triggerDriverInfo({
        bookingId: 'NC' + id,
        customerEmail: withCab.passenger_email || '',
        driverEmail: withCab.driver_email || '',
        driverName: withCab.driver_name || '',
        driverPhone: withCab.driver_phone || '',
        cabNumber: withCab.vehicle_number || '',
      });
    }
    res.json(withCab);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

async function ensureCabsCorporateOnlyColumn() {
  try {
    await db.runAsync('ALTER TABLE cabs ADD COLUMN corporate_only INTEGER DEFAULT 0');
  } catch (e) {
    // column may already exist
  }
}

router.get('/cabs', async (req, res) => {
  try {
    await ensureCabsCorporateOnlyColumn();
    const rows = await db.allAsync(
      `SELECT c.id, c.vehicle_number, c.name, c.driver_id, c.driver_name, c.driver_phone, c.cab_type_id, c.corporate_only, ct.name as cab_type_name, ct.service_type as cab_type_service_type
       FROM cabs c
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       WHERE c.is_active = 1
       ORDER BY c.vehicle_number`
    );
    const cabs = (rows || []).map((r) => ({
      id: r.id,
      vehicle_number: r.vehicle_number ?? r.VEHICLE_NUMBER ?? '',
      name: r.name ?? r.NAME ?? null,
      driver_id: r.driver_id ?? r.DRIVER_ID ?? null,
      driver_name: r.driver_name ?? r.DRIVER_NAME ?? '',
      driver_phone: r.driver_phone ?? r.DRIVER_PHONE ?? '',
      cab_type_id: r.cab_type_id ?? r.CAB_TYPE_ID,
      cab_type_name: r.cab_type_name ?? r.CAB_TYPE_NAME ?? '—',
      cab_type_service_type: r.cab_type_service_type ?? r.CAB_TYPE_SERVICE_TYPE ?? null,
      corporate_only: !!(r.corporate_only ?? r.CORPORATE_ONLY),
    }));
    res.json(cabs);
  } catch (error) {
    console.error('Error fetching cabs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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

router.get('/bookings/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const withGST = req.query.with_gst !== 'false';
    const invoiceNumberOverride = req.query.invoice_number != null && String(req.query.invoice_number).trim() !== ''
      ? String(req.query.invoice_number).trim()
      : null;
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
    const bookingForPdf = invoiceNumberOverride
      ? { ...booking, invoice_number: invoiceNumberOverride }
      : booking;
    const pdfBuffer = await generateInvoicePDF(bookingForPdf, withGST);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}${withGST ? '-with-gst' : ''}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating booking invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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

    const invoiceNumber = await generateDefaultInvoiceNumber();
    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, passenger_email, cab_id, cab_type_id,
        service_type, number_of_hours, trip_type, pickup_lat, pickup_lng, destination_lat, destination_lng,
        invoice_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        from_location,
        to_location,
        0,
        null,
        Number(fare_amount),
        passenger_name,
        passenger_phone,
        passenger_email != null && String(passenger_email).trim() ? String(passenger_email).trim() : null,
        null,
        null,
        svcType,
        number_of_hours != null ? Number(number_of_hours) : null,
        outstationTripType,
        null,
        null,
        null,
        null,
        invoiceNumber,
      ]
    );
    let newBooking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    const { pickup, drop: dropLink } = generateGoogleMapsLink(newBooking);
    try {
      if (pickup) await db.runAsync('UPDATE bookings SET maps_link = ? WHERE id = ?', [pickup, newBooking.id]);
      await db.runAsync('UPDATE bookings SET maps_link_drop = ? WHERE id = ?', [dropLink || null, newBooking.id]);
    } catch (e) {

    }
    const bookingForPdf = { ...newBooking, passenger_email: passenger_email || null, trip_type: outstationTripType || newBooking.trip_type };
    const withGST = with_gst !== false;
    const pdfBuffer = await generateInvoicePDF(bookingForPdf, withGST);

    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
    const pdfSecret = process.env.INVOICE_PDF_SECRET || '';
    const pdfUrl = baseUrl && pdfSecret
      ? `${baseUrl}/api/invoices/${newBooking.id}/pdf?token=${encodeURIComponent(pdfSecret)}&with_gst=${withGST}`
      : '';
    triggerInvoiceGenerated({
      customerEmail: passenger_email && String(passenger_email).trim() ? String(passenger_email).trim() : '',
      invoiceId: newBooking.invoice_number || 'INV' + newBooking.id,
      amount: '₹' + Number(fare_amount),
      pdfUrl,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${newBooking.id}${withGST ? '-with-gst' : ''}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.use(require('./rateMeter'));

module.exports = router;
