const express = require('express');
const db = require('../db/database');
const { generateGoogleMapsLink } = require('../utils/mapsLink');

const router = express.Router();

async function ensureBookingsColumns() {
  const columns = [
    ['service_type', 'TEXT'],
    ['number_of_hours', 'INTEGER'],
    ['trip_type', 'TEXT'],
    ['pickup_lat', 'REAL'],
    ['pickup_lng', 'REAL'],
    ['destination_lat', 'REAL'],
    ['destination_lng', 'REAL'],
    ['maps_link', 'TEXT'],
    ['maps_link_drop', 'TEXT'],
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
      fare_amount,
      number_of_hours,
      trip_type,
      cab_id,
      cab_type_id,
      pickup_lat,
      pickup_lng,
      destination_lat,
      destination_lng,
      travel_date,
    } = req.body;

    if (!from_location || !to_location || !passenger_name || !passenger_phone || fare_amount == null) {
      return res.status(400).json({ error: 'from_location, to_location, passenger_name, passenger_phone, and fare_amount are required' });
    }

    const distance_km = 0;
    const estimated_time_minutes = null;
    const invoiceNumber = await generateDefaultInvoiceNumber();
    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, cab_id, cab_type_id,
        service_type, number_of_hours, trip_type, pickup_lat, pickup_lng, destination_lat, destination_lng,
        invoice_number, travel_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        from_location,
        to_location,
        distance_km,
        estimated_time_minutes,
        Number(fare_amount),
        passenger_name,
        passenger_phone,
        cab_id || null,
        cab_type_id || null,
        service_type || 'local',
        number_of_hours != null ? Number(number_of_hours) : null,
        trip_type || null,
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
