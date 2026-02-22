const express = require('express');
const db = require('../db/database');
const { generateGoogleMapsLink } = require('../utils/mapsLink');
const { triggerBookingSuccess } = require('../services/n8nWebhooks');
const { sendBookingConfirmation } = require('../services/whatsappService');

const router = express.Router();

function formatTimeForWebhook(travelDate) {
  if (!travelDate) return '';
  const d = new Date(travelDate);
  if (Number.isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = String(mins).padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

async function ensureBookingsColumns() {
  const columns = [
    ['service_type', 'TEXT'],
    ['number_of_hours', 'INTEGER'],
    ['number_of_days', 'INTEGER'],
    ['trip_type', 'TEXT'],
    ['pickup_lat', 'REAL'],
    ['pickup_lng', 'REAL'],
    ['destination_lat', 'REAL'],
    ['destination_lng', 'REAL'],
    ['maps_link', 'TEXT'],
    ['maps_link_drop', 'TEXT'],
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

async function generateDefaultInvoiceNumber() {
  const d = new Date();
  const prefix = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
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

router.post('/', async (req, res) => {
  try {
    await ensureBookingsColumns();

    const {
      service_type,
      from_location,
      to_location,
      passenger_name,
      passenger_phone,
      passenger_email,
      notes,
      fare_amount,
      number_of_hours,
      number_of_days,
      trip_type,
      cab_id,
      cab_type_id,
      pickup_lat,
      pickup_lng,
      destination_lat,
      destination_lng,
      distance_km,
      estimated_time_minutes,
      travel_date,
      return_date,
    } = req.body;

    if (!from_location || !to_location || !passenger_name || !passenger_phone || fare_amount == null) {
      return res.status(400).json({ error: 'from_location, to_location, passenger_name, passenger_phone, and fare_amount are required' });
    }

    const serviceType = service_type || 'local';
    const tripType = trip_type || null;

    const parseDate = (v) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const ceilDaysDiff = (start, end) => {
      if (!start || !end) return null;
      const diffMs = end.getTime() - start.getTime();
      if (diffMs <= 0) return null;
      return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    };

    const distanceKmVal = distance_km != null && distance_km !== '' ? Number(distance_km) : 0;
    const estimatedMinutesVal = estimated_time_minutes != null && estimated_time_minutes !== ''
      ? Number(estimated_time_minutes)
      : null;
    const numberOfDaysVal = number_of_days != null && number_of_days !== ''
      ? Math.max(1, parseInt(number_of_days, 10) || 1)
      : null;

    if (serviceType === 'outstation') {
      if (tripType === 'round_trip' || tripType === 'multiple_stops') {
        if (numberOfDaysVal == null) {
          return res.status(400).json({ error: 'number_of_days is required for outstation round trip / multi way bookings' });
        }
      }
      if (tripType === 'round_trip' && return_date) {
        const start = parseDate(travel_date);
        const end = parseDate(return_date);
        if (!start) {
          return res.status(400).json({ error: 'travel_date is required when return_date is provided' });
        }
        if (!end) {
          return res.status(400).json({ error: 'Invalid return_date' });
        }
        if (end <= start) {
          return res.status(400).json({ error: 'return_date must be after travel_date' });
        }
        const computed = ceilDaysDiff(start, end);
        if (computed != null && numberOfDaysVal != null && computed !== numberOfDaysVal) {
          return res.status(400).json({
            error: `number_of_days (${numberOfDaysVal}) does not match pickup/return dates (${computed} day(s))`,
          });
        }
      }
    }

    const invoiceNumber = await generateDefaultInvoiceNumber();
    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, passenger_email, notes, cab_id, cab_type_id,
        service_type, number_of_hours, trip_type, number_of_days, pickup_lat, pickup_lng, destination_lat, destination_lng,
        invoice_number, travel_date, "return_date"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        from_location,
        to_location,
        distanceKmVal,
        estimatedMinutesVal,
        Number(fare_amount),
        passenger_name,
        passenger_phone,
        passenger_email != null && String(passenger_email).trim() ? String(passenger_email).trim() : null,
        notes != null && String(notes).trim() ? String(notes).trim() : null,
        // Do not allow public booking flow to pre-assign a cab/driver; admin will assign.
        null,
        cab_type_id || null,
        serviceType,
        number_of_hours != null ? Number(number_of_hours) : null,
        tripType,
        numberOfDaysVal,
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
    const customerEmail = (newBooking.passenger_email || newBooking.PASSENGER_EMAIL || '').trim();
    triggerBookingSuccess({
      customerEmail,
      email: customerEmail,
      bookingId: 'NC' + newBooking.id,
      pickup: newBooking.from_location || '',
      drop: newBooking.to_location || '',
      time: formatTimeForWebhook(newBooking.travel_date),
    });
    // WhatsApp: send booking confirmation to customer (fire-and-forget)
    sendBookingConfirmation(newBooking).catch((err) => console.error('[WhatsApp] Booking confirmation send failed:', err));
    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
