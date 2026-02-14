const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateInvoicePDF } = require('../services/invoiceService');
const { generateGoogleMapsLink } = require('../utils/mapsLink');
const { triggerDriverInfo, triggerInvoiceGenerated } = require('../services/n8nWebhooks');
const { sendDriverInfoToCustomerWhatsApp, sendBookingConfirmation } = require('../services/whatsappService');

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
    ['"return_date"', 'DATETIME'],
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
      `SELECT b.id, b.user_id, b.cab_id, b.cab_type_id, b.car_option_id, b.from_location, b.to_location,
              b.distance_km, b.estimated_time_minutes, b.fare_amount, b.booking_status, b.booking_date,
              b.travel_date, b.passenger_name, b.passenger_phone, b.passenger_email, b.notes,
              b.service_type, b.number_of_hours, b.trip_type, b.pickup_lat, b.pickup_lng,
              b.destination_lat, b.destination_lng, b.maps_link, b.maps_link_drop, b.assigned_at, b.invoice_number,
              b."return_date",
              c.vehicle_number,
              COALESCE(c.driver_name, d.name) as driver_name,
              COALESCE(c.driver_phone, d.phone) as driver_phone,
              ct.name as cab_type_name
       FROM bookings b
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN drivers d ON d.id = COALESCE(c.driver_id, (SELECT id FROM drivers d2 WHERE d2.email = c.driver_email LIMIT 1))
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
      passenger_email,
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
      return_date,
    } = req.body;

    const invoiceNumber = await generateDefaultInvoiceNumber();
    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, passenger_email, cab_id, cab_type_id,
        service_type, number_of_hours, pickup_lat, pickup_lng, destination_lat, destination_lng,
        invoice_number, travel_date, "return_date"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        from_location,
        to_location,
        0,
        null,
        Number(fare_amount),
        passenger_name,
        passenger_phone,
        passenger_email != null && String(passenger_email).trim() ? String(passenger_email).trim() : null,
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
        return_date || null,
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
    const { booking_status, cab_id, driver_id, invoice_number, passenger_email } = req.body;

    const existing = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await ensureBookingsColumns();

    // Record assignment history when cab_id changes (so previous drivers keep history)
    if (cab_id !== undefined) {
      await ensureBookingAssignmentHistoryTable();
      const prevCabId = existing.cab_id ?? existing.CAB_ID;
      const newCabId = cab_id || null;

      if (prevCabId) {
        const openRow = await db.getAsync(
          'SELECT id FROM booking_assignment_history WHERE booking_id = ? AND unassigned_at IS NULL',
          [id]
        );
        const prevDriverId = await getDriverIdForCab(prevCabId);
        const assignedAt = (existing.assigned_at ?? existing.ASSIGNED_AT) || new Date().toISOString();
        if (openRow) {
          await db.runAsync(
            'UPDATE booking_assignment_history SET unassigned_at = datetime(\'now\') WHERE booking_id = ? AND unassigned_at IS NULL',
            [id]
          );
        } else {
          await db.runAsync(
            `INSERT INTO booking_assignment_history (booking_id, cab_id, driver_id, assigned_at, unassigned_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [id, prevCabId, prevDriverId, assignedAt]
          );
        }
      }
      if (newCabId) {
        const newDriverId = await getDriverIdForCab(newCabId);
        await db.runAsync(
          `INSERT INTO booking_assignment_history (booking_id, cab_id, driver_id, assigned_at, unassigned_at)
           VALUES (?, ?, ?, datetime('now'), NULL)`,
          [id, newCabId, newDriverId]
        );
      }
    }

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
    if (passenger_email !== undefined) {
      updates.push('passenger_email = ?');
      values.push(passenger_email != null && String(passenger_email).trim() ? String(passenger_email).trim() : null);
    }

    if (updates.length === 0 && driver_id == null) {

      const updated = await db.getAsync(
        `SELECT b.*, c.vehicle_number,
         COALESCE(c.driver_name, d.name) as driver_name,
         COALESCE(c.driver_phone, d.phone) as driver_phone,
         ct.name as cab_type_name
         FROM bookings b
         LEFT JOIN cabs c ON b.cab_id = c.id
         LEFT JOIN drivers d ON d.id = COALESCE(c.driver_id, (SELECT id FROM drivers d2 WHERE d2.email = c.driver_email LIMIT 1))
         LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
         WHERE b.id = ?`,
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
    const effectiveCabId = cab_id !== undefined ? (cab_id || updated.cab_id) : updated.cab_id;
    if (effectiveCabId && driver_id != null && driver_id !== '') {
      const driver = await db.getAsync('SELECT id, name, phone, email FROM drivers WHERE id = ?', [driver_id]);
      if (driver) {
        await db.runAsync(
          `UPDATE cabs SET driver_id = ?, driver_name = ?, driver_phone = ?, driver_email = ? WHERE id = ?`,
          [driver_id, driver.name || null, driver.phone || null, driver.email || null, effectiveCabId]
        );
      }
    }
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

    await ensureDriversEmailColumn();
    await ensureCabsDriverEmailColumn();
    const withCab = await db.getAsync(
      `SELECT b.*, c.vehicle_number,
        COALESCE(c.driver_name, d.name) as driver_name,
        COALESCE(c.driver_phone, d.phone) as driver_phone,
        COALESCE(d.email, c.driver_email) as driver_email,
        ct.name as cab_type_name
       FROM bookings b
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN drivers d ON d.id = COALESCE(c.driver_id, (SELECT id FROM drivers d2 WHERE d2.email = c.driver_email LIMIT 1))
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       WHERE b.id = ?`,
      [id]
    );
    if (process.env.DEBUG_N8N_WARNINGS && withCab) {
      console.log('assign booking row keys:', Object.keys(withCab).sort().join(', '));
      console.log('assign driver_name/driver_phone/driver_email/vehicle_number:', [withCab.driver_name, withCab.driver_phone, withCab.driver_email, withCab.vehicle_number]);
    }
    const n8nWarnings = [];
    if (cab_id) {
      // Read from row by key; try exact keys then case-insensitive match (some DB drivers return different casing)
      const pick = (row, ...preferredKeys) => {
        if (!row || typeof row !== 'object') return '';
        for (const k of preferredKeys) {
          const v = row[k];
          if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        const target = preferredKeys[0].toLowerCase();
        for (const key of Object.keys(row)) {
          if (key.toLowerCase() === target) {
            const v = row[key];
            if (v != null && String(v).trim() !== '') return String(v).trim();
            break;
          }
        }
        return '';
      };
      const driverName = pick(withCab, 'driver_name', 'DRIVER_NAME');
      const driverPhone = pick(withCab, 'driver_phone', 'DRIVER_PHONE');
      const cabNumber = pick(withCab, 'vehicle_number', 'VEHICLE_NUMBER');
      const customerEmailVal = pick(withCab, 'passenger_email', 'PASSENGER_EMAIL');
      const driverEmail = pick(withCab, 'driver_email', 'DRIVER_EMAIL');
      const pickup = pick(withCab, 'from_location', 'FROM_LOCATION');
      const drop = pick(withCab, 'to_location', 'TO_LOCATION');
      const pickupTime = pick(withCab, 'travel_date', 'TRAVEL_DATE') || pick(withCab, 'booking_date', 'BOOKING_DATE');
      const customerName = pick(withCab, 'passenger_name', 'PASSENGER_NAME');
      const customerPhone = pick(withCab, 'passenger_phone', 'PASSENGER_PHONE');
      triggerDriverInfo({
        bookingId: 'NC' + id,
        customerEmail: customerEmailVal,
        email: customerEmailVal,
        customerName,
        customerPhone,
        customerEmail: customerEmailVal,
        driverEmail,
        driverName,
        driverPhone,
        cabNumber,
        pickup,
        drop,
        pickupTime,
        sendDriverInfoToCustomer: true,
        sendTripToDriver: false,
      });
      // WhatsApp: send driver info to customer when admin assigns driver
      if (customerPhone) {
        sendDriverInfoToCustomerWhatsApp(customerPhone, {
          bookingId: 'NC' + id,
          driverName,
          driverPhone,
          cabNumber,
          pickup,
          drop,
          pickupTime,
        }).catch((err) => console.error('[WhatsApp] Driver info to customer failed:', err));
      } else {
        n8nWarnings.push('Customer phone is missing — customer will not receive driver info via WhatsApp.');
      }
      if (!customerEmailVal) n8nWarnings.push('Customer email is missing — customer will not receive driver info email.');
      if (!cabNumber) n8nWarnings.push('Cab number is missing.');
    }
    res.json({ ...withCab, n8nWarnings: n8nWarnings.length ? n8nWarnings : undefined });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bookings/:id/send-driver-email', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureDriversEmailColumn();
    await ensureCabsDriverEmailColumn();
    const withCab = await db.getAsync(
      `SELECT b.*, c.vehicle_number,
        COALESCE(c.driver_name, d.name) as driver_name,
        COALESCE(c.driver_phone, d.phone) as driver_phone,
        COALESCE(d.email, c.driver_email) as driver_email
       FROM bookings b
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN drivers d ON d.email = c.driver_email
       WHERE b.id = ?`,
      [id]
    );
    if (!withCab) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!withCab.cab_id) {
      return res.status(400).json({ error: 'No cab assigned to this booking' });
    }
    const pick = (row, ...preferredKeys) => {
      if (!row || typeof row !== 'object') return '';
      for (const k of preferredKeys) {
        const v = row[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      const target = preferredKeys[0].toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === target) {
          const v = row[key];
          if (v != null && String(v).trim() !== '') return String(v).trim();
          break;
        }
      }
      return '';
    };
    const driverEmail = pick(withCab, 'driver_email', 'DRIVER_EMAIL');
    if (!driverEmail) {
      return res.json({ ok: true, message: 'No driver email configured on this cab; email not sent.' });
    }
    const driverName = pick(withCab, 'driver_name', 'DRIVER_NAME');
    const driverPhone = pick(withCab, 'driver_phone', 'DRIVER_PHONE');
    const cabNumber = pick(withCab, 'vehicle_number', 'VEHICLE_NUMBER');
    const pickup = pick(withCab, 'from_location', 'FROM_LOCATION');
    const drop = pick(withCab, 'to_location', 'TO_LOCATION');
    const pickupTime = pick(withCab, 'travel_date', 'TRAVEL_DATE') || pick(withCab, 'booking_date', 'BOOKING_DATE');
    const customerName = pick(withCab, 'passenger_name', 'PASSENGER_NAME');
    const customerPhone = pick(withCab, 'passenger_phone', 'PASSENGER_PHONE');
    const customerEmailVal = pick(withCab, 'passenger_email', 'PASSENGER_EMAIL');
    triggerDriverInfo({
      bookingId: 'NC' + id,
      customerEmail: '',
      customerName,
      customerPhone,
      customerEmail: customerEmailVal,
      driverEmail,
      driverName,
      driverPhone,
      cabNumber,
      pickup,
      drop,
      pickupTime,
      sendDriverInfoToCustomer: false,
      sendTripToDriver: true,
    });
    res.json({ ok: true, message: 'Trip email sent to driver' });
  } catch (error) {
    console.error('Error sending driver email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bookings/:id/send-customer-email', async (req, res) => {
  const { id } = req.params;
  try {
    await ensureDriversEmailColumn();
    await ensureCabsDriverEmailColumn();
    const withCab = await db.getAsync(
      `SELECT b.*, c.vehicle_number,
        COALESCE(c.driver_name, d.name) as driver_name,
        COALESCE(c.driver_phone, d.phone) as driver_phone,
        COALESCE(d.email, c.driver_email) as driver_email
       FROM bookings b
       LEFT JOIN cabs c ON b.cab_id = c.id
       LEFT JOIN drivers d ON d.email = c.driver_email
       WHERE b.id = ?`,
      [id]
    );
    if (!withCab) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (!withCab.cab_id) {
      return res.status(400).json({ error: 'No cab assigned to this booking' });
    }
    const pick = (row, ...preferredKeys) => {
      if (!row || typeof row !== 'object') return '';
      for (const k of preferredKeys) {
        const v = row[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      const target = preferredKeys[0].toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === target) {
          const v = row[key];
          if (v != null && String(v).trim() !== '') return String(v).trim();
          break;
        }
      }
      return '';
    };
    const customerEmailVal = pick(withCab, 'passenger_email', 'PASSENGER_EMAIL');
    if (!customerEmailVal) {
      return res.status(400).json({ error: 'Customer email is missing — add it in the booking details first.' });
    }
    const driverName = pick(withCab, 'driver_name', 'DRIVER_NAME');
    const driverPhone = pick(withCab, 'driver_phone', 'DRIVER_PHONE');
    const cabNumber = pick(withCab, 'vehicle_number', 'VEHICLE_NUMBER');
    const pickup = pick(withCab, 'from_location', 'FROM_LOCATION');
    const drop = pick(withCab, 'to_location', 'TO_LOCATION');
    const pickupTime = pick(withCab, 'travel_date', 'TRAVEL_DATE') || pick(withCab, 'booking_date', 'BOOKING_DATE');
    triggerDriverInfo({
      bookingId: 'NC' + id,
      customerEmail: customerEmailVal,
      email: customerEmailVal,
      driverEmail: pick(withCab, 'driver_email', 'DRIVER_EMAIL'),
      driverName,
      driverPhone,
      cabNumber,
      pickup,
      drop,
      pickupTime,
      sendDriverInfoToCustomer: true,
      sendTripToDriver: false,
    });
    const customerPhone = pick(withCab, 'passenger_phone', 'PASSENGER_PHONE');
    if (customerPhone) {
      sendDriverInfoToCustomerWhatsApp(customerPhone, {
        bookingId: 'NC' + id,
        driverName,
        driverPhone,
        cabNumber,
        pickup,
        drop,
        pickupTime,
      }).catch((err) => console.error('[WhatsApp] Driver info to customer failed:', err));
    }
    res.json({ ok: true, message: 'Driver info email sent to customer' });
  } catch (error) {
    console.error('Error sending customer email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/** Send booking details to customer via WhatsApp (Meta API). From number = WHATSAPP_PHONE_NUMBER_ID (e.g. 9620267516). */
router.post('/bookings/:id/send-whatsapp', async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await db.getAsync(
      `SELECT id, passenger_phone, passenger_name, from_location, to_location, fare_amount, travel_date, invoice_number
       FROM bookings WHERE id = ?`,
      [id]
    );
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const phone = (booking.passenger_phone || booking.PASSENGER_PHONE || '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'No passenger phone for this booking' });
    }
    const result = await sendBookingConfirmation({
      id: booking.id ?? booking.ID,
      passenger_phone: phone,
      passenger_name: booking.passenger_name ?? booking.PASSENGER_NAME,
      from_location: booking.from_location ?? booking.FROM_LOCATION,
      to_location: booking.to_location ?? booking.TO_LOCATION,
      fare_amount: booking.fare_amount ?? booking.FARE_AMOUNT,
      travel_date: booking.travel_date ?? booking.TRAVEL_DATE,
      invoice_number: booking.invoice_number ?? booking.INVOICE_NUMBER,
    }, { force: true });
    if (result.success) {
      return res.json({ ok: true, message: 'Booking details sent to customer via WhatsApp' });
    }
    return res.status(400).json({ error: result.message || result.error || 'WhatsApp send failed' });
  } catch (error) {
    console.error('Error sending WhatsApp to customer:', error);
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

async function ensureDriversEmailColumn() {
  try {
    await db.runAsync('ALTER TABLE drivers ADD COLUMN email TEXT');
  } catch (e) {
    // column may already exist
  }
}

async function ensureCabsDriverEmailColumn() {
  try {
    await db.runAsync('ALTER TABLE cabs ADD COLUMN driver_email TEXT');
  } catch (e) {
    // column may already exist
  }
}

async function ensureBookingAssignmentHistoryTable() {
  await ensureBookingsColumns();
  await ensureDriversEmailColumn();
  await ensureCabsDriverEmailColumn();
  try {
    await db.runAsync(
      `CREATE TABLE IF NOT EXISTS booking_assignment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        cab_id INTEGER,
        driver_id INTEGER,
        assigned_at DATETIME NOT NULL,
        unassigned_at DATETIME,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (cab_id) REFERENCES cabs(id) ON DELETE SET NULL,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
      )`
    );
    // Backfill: for bookings that have cab_id but no current assignment row, add one
    const withCab = await db.allAsync(
      `SELECT b.id as booking_id, b.cab_id, b.assigned_at
       FROM bookings b
       WHERE b.cab_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM booking_assignment_history h
         WHERE h.booking_id = b.id AND h.unassigned_at IS NULL
       )`
    );
    for (const row of withCab || []) {
      try {
        const cabId = row.cab_id ?? row.CAB_ID;
        const cab = await db.getAsync(
          'SELECT driver_id, driver_email FROM cabs WHERE id = ?',
          [cabId]
        );
        const driverId = cab
          ? (cab.driver_id ?? cab.DRIVER_ID ?? (cab.driver_email || cab.DRIVER_EMAIL
            ? (await db.getAsync('SELECT id FROM drivers WHERE email = ? LIMIT 1', [cab.driver_email || cab.DRIVER_EMAIL]))?.id
            : null))
          : null;
        const assignedAt = (row.assigned_at ?? row.ASSIGNED_AT) || new Date().toISOString();
        await db.runAsync(
          `INSERT INTO booking_assignment_history (booking_id, cab_id, driver_id, assigned_at, unassigned_at)
           VALUES (?, ?, ?, ?, NULL)`,
          [row.booking_id ?? row.BOOKING_ID, cabId, driverId, assignedAt]
        );
      } catch (rowErr) {
        console.warn('ensureBookingAssignmentHistoryTable: skip row', row?.booking_id, rowErr.message);
      }
    }
  } catch (e) {
    console.error('ensureBookingAssignmentHistoryTable:', e);
  }
}

/** Resolve driver_id for a cab (from cabs.driver_id or drivers.email = cabs.driver_email). */
async function getDriverIdForCab(cabId) {
  if (!cabId) return null;
  const cab = await db.getAsync('SELECT driver_id, driver_email FROM cabs WHERE id = ?', [cabId]);
  if (!cab) return null;
  const id = cab.driver_id ?? cab.DRIVER_ID;
  if (id != null) return id;
  const email = cab.driver_email ?? cab.DRIVER_EMAIL;
  if (!email) return null;
  const d = await db.getAsync('SELECT id FROM drivers WHERE email = ? LIMIT 1', [email]);
  return d ? (d.id ?? d.ID) : null;
}

router.get('/cabs', async (req, res) => {
  try {
    await ensureCabsCorporateOnlyColumn();
    await ensureCabsDriverEmailColumn();
    const rows = await db.allAsync(
      `SELECT c.id, c.vehicle_number, c.name, c.driver_id, c.driver_name, c.driver_phone, c.driver_email, c.cab_type_id, c.corporate_only, ct.name as cab_type_name, ct.service_type as cab_type_service_type
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
      driver_email: r.driver_email ?? r.DRIVER_EMAIL ?? '',
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
    await ensureDriversEmailColumn();
    const drivers = await db.allAsync(
      'SELECT * FROM drivers WHERE is_active = 1 ORDER BY name'
    );
    res.json(drivers || []);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const DRIVER_HISTORY_UNKNOWN_ID = 'unknown';

router.get('/driver-history', async (req, res) => {
  try {
    await ensureBookingAssignmentHistoryTable();
    const drivers = await db.allAsync(
      'SELECT * FROM drivers ORDER BY name'
    );
    const assignmentRows = await db.allAsync(
      `SELECT h.id as history_id, h.booking_id, h.cab_id, h.driver_id, h.assigned_at, h.unassigned_at,
              b.from_location, b.to_location, b.booking_status, b.travel_date, b.booking_date,
              b.passenger_name, b.passenger_phone, b.fare_amount, b.invoice_number,
              c.vehicle_number, ct.name as cab_type_name
       FROM booking_assignment_history h
       INNER JOIN bookings b ON b.id = h.booking_id
       LEFT JOIN cabs c ON c.id = h.cab_id
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       ORDER BY h.assigned_at DESC`
    );
    const driversById = {};
    for (const d of drivers || []) {
      const did = d.id ?? d.ID;
      driversById[did] = d;
    }
    const byDriverKey = {};
    const unknownDriver = { id: DRIVER_HISTORY_UNKNOWN_ID, name: 'Unknown / Cab only', phone: null, email: null };
    byDriverKey[DRIVER_HISTORY_UNKNOWN_ID] = { driver: unknownDriver, assignments: [] };
    for (const row of assignmentRows || []) {
      const driverId = row.driver_id ?? row.DRIVER_ID;
      const driverKey = (driverId != null && driversById[driverId]) ? driverId : DRIVER_HISTORY_UNKNOWN_ID;
      if (!byDriverKey[driverKey]) {
        byDriverKey[driverKey] = { driver: driversById[driverKey] || { id: driverKey, name: `Driver #${driverKey}`, phone: null, email: null }, assignments: [] };
      }
      byDriverKey[driverKey].assignments.push({
        history_id: row.history_id ?? row.HISTORY_ID,
        booking_id: row.booking_id ?? row.BOOKING_ID,
        from_location: row.from_location ?? row.FROM_LOCATION,
        to_location: row.to_location ?? row.TO_LOCATION,
        booking_status: row.booking_status ?? row.BOOKING_STATUS,
        travel_date: row.travel_date ?? row.TRAVEL_DATE,
        booking_date: row.booking_date ?? row.BOOKING_DATE,
        passenger_name: row.passenger_name ?? row.PASSENGER_NAME,
        passenger_phone: row.passenger_phone ?? row.PASSENGER_PHONE,
        fare_amount: row.fare_amount ?? row.FARE_AMOUNT,
        invoice_number: row.invoice_number ?? row.INVOICE_NUMBER,
        vehicle_number: row.vehicle_number ?? row.VEHICLE_NUMBER,
        cab_type_name: row.cab_type_name ?? row.CAB_TYPE_NAME,
        assigned_at: row.assigned_at ?? row.ASSIGNED_AT,
        unassigned_at: row.unassigned_at ?? row.UNASSIGNED_AT,
      });
    }
    res.json(Object.values(byDriverKey));
  } catch (error) {
    console.error('Error fetching driver history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/drivers', [
  body('name').notEmpty().trim().withMessage('name is required'),
  body('phone').notEmpty().trim().withMessage('phone is required'),
], async (req, res) => {
  try {
    await ensureDriversEmailColumn();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map((e) => e.msg).join('; ');
      return res.status(400).json({ error: msg, errors: errors.array() });
    }
    const { name, phone, license_number, emergency_contact_name, emergency_contact_phone, email } = req.body;
    const phoneTrim = String(phone).trim();
    const nameTrim = String(name).trim();
    const emailVal = (email != null && String(email).trim()) ? String(email).trim() : null;
    const existing = await db.getAsync('SELECT id FROM drivers WHERE phone = ?', [phoneTrim]);
    if (existing) {
      return res.status(400).json({ error: 'A driver with this phone number already exists.' });
    }
    const result = await db.runAsync(
      `INSERT INTO drivers (name, phone, license_number, emergency_contact_name, emergency_contact_phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nameTrim,
        phoneTrim,
        license_number != null ? String(license_number).trim() : null,
        emergency_contact_name != null ? String(emergency_contact_name).trim() : null,
        emergency_contact_phone != null ? String(emergency_contact_phone).trim() : null,
        emailVal,
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
    await ensureDriversEmailColumn();
    const { id } = req.params;
    const { name, phone, license_number, emergency_contact_name, emergency_contact_phone, email } = req.body;

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
    if (email !== undefined) {
      updates.push('email = ?');
      values.push((email != null && String(email).trim()) ? String(email).trim() : null);
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

    const pick = (row, ...keys) => {
      if (!row || typeof row !== 'object') return '';
      for (const k of keys) {
        const v = row[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      const target = (keys[0] || '').toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === target) {
          const v = row[key];
          if (v != null && String(v).trim() !== '') return String(v).trim();
          break;
        }
      }
      return '';
    };
    const customerEmailVal = pick(booking, 'passenger_email', 'PASSENGER_EMAIL');
    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
    const pdfSecret = process.env.INVOICE_PDF_SECRET || '';
    const pdfUrl = baseUrl && pdfSecret
      ? `${baseUrl}/api/invoices/${id}/pdf?token=${encodeURIComponent(pdfSecret)}&with_gst=${withGST}`
      : '';
    triggerInvoiceGenerated({
      customerEmail: customerEmailVal,
      email: customerEmailVal,
      invoiceId: bookingForPdf.invoice_number || 'INV' + id,
      amount: '₹' + Number(booking.fare_amount || 0),
      pdfUrl,
    });

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
    const customerEmailVal = passenger_email && String(passenger_email).trim() ? String(passenger_email).trim() : '';
    triggerInvoiceGenerated({
      customerEmail: customerEmailVal,
      email: customerEmailVal,
      invoiceId: newBooking.invoice_number || 'INV' + newBooking.id,
      amount: '₹' + Number(fare_amount),
      pdfUrl,
    });

    const invoiceWarnings = [];
    if (!customerEmailVal) {
      invoiceWarnings.push('Customer email is missing — invoice email will not be sent.');
    }
    if (!pdfUrl) {
      invoiceWarnings.push('PDF link not configured (set BASE_URL and INVOICE_PDF_SECRET) — invoice email may not include link.');
    }
    if (invoiceWarnings.length) {
      res.setHeader('X-N8n-Warnings', JSON.stringify(invoiceWarnings));
    }

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
