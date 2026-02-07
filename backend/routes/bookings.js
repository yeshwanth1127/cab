const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Ensure optional columns exist on bookings table (migration)
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
  ];
  for (const [col, type] of columns) {
    try {
      await db.runAsync(`ALTER TABLE bookings ADD COLUMN ${col} ${type}`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
}

// POST / - Create booking (public, used by HomePage and CarOptions)
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
    } = req.body;

    if (!from_location || !to_location || !passenger_name || !passenger_phone || fare_amount == null) {
      return res.status(400).json({ error: 'from_location, to_location, passenger_name, passenger_phone, and fare_amount are required' });
    }

    const distance_km = 0;
    const estimated_time_minutes = null;
    const result = await db.runAsync(
      `INSERT INTO bookings (
        from_location, to_location, distance_km, estimated_time_minutes, fare_amount,
        passenger_name, passenger_phone, cab_id, cab_type_id,
        service_type, number_of_hours, trip_type, pickup_lat, pickup_lng, destination_lat, destination_lng
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );

    const newBooking = await db.getAsync('SELECT * FROM bookings WHERE id = ?', [result.lastID]);
    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /:id - Get single booking (public, used by CheckBooking)
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
