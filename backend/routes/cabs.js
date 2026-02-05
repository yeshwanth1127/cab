const express = require('express');
const db = require('../db/database');

const router = express.Router();

// Get all active cab types (public)
router.get('/types', async (req, res) => {
  try {
    const result = await db.allAsync(
      'SELECT * FROM cab_types WHERE is_active = 1 ORDER BY base_fare ASC'
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching cab types:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public helper: get rate meters for displaying basic package info on booking cards
// This is read-only and safe to expose. It lets the frontend show things like base fare and per-km rate.
router.get('/rate-meters-public', async (req, res) => {
  try {
    const { service_type } = req.query;

    if (!service_type || !['local', 'airport', 'outstation'].includes(service_type)) {
      return res.status(400).json({
        error: 'service_type query param is required and must be local, airport, or outstation',
      });
    }

    const rows = await db.allAsync(
      `SELECT *
       FROM rate_meters
       WHERE service_type = ?
         AND is_active = 1
       ORDER BY car_category, hours, trip_type`,
      [service_type]
    );

    res.json(rows || []);
  } catch (error) {
    console.error('Error fetching public rate meters:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available cabs for a specific cab type
router.get('/available/:cabTypeId', async (req, res) => {
  try {
    const { cabTypeId } = req.params;
    const result = await db.allAsync(
      `SELECT c.*, ct.name as cab_type_name
       FROM cabs c
       JOIN cab_types ct ON c.cab_type_id = ct.id
       WHERE c.cab_type_id = ? AND c.is_available = 1 AND c.is_active = 1`,
      [cabTypeId]
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching available cabs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: local cab types with package rates and cabs — same data as admin dashboard (Rate meters → Local).
// Reads cab_types (service_type=local), local_package_rates (4h, 8h, 12h, extra hour), and cabs (is_available=1).
router.get('/local-offers', async (req, res) => {
  try {
    const cabTypes = await db.allAsync(
      "SELECT id, name, description FROM cab_types WHERE service_type = 'local' AND is_active = 1 ORDER BY name"
    );
    const result = [];
    for (const ct of cabTypes || []) {
      const rates = await db.allAsync(
        `SELECT hours, package_fare, extra_hour_rate FROM local_package_rates WHERE cab_type_id = ? ORDER BY hours`,
        [ct.id]
      );
      const extraHourRow = rates.find((r) => r.extra_hour_rate != null && r.extra_hour_rate !== '');
      const extraHourRate = extraHourRow ? Number(extraHourRow.extra_hour_rate) : null;
      const packageRates = {};
      (rates || []).forEach((r) => {
        if (r.hours != null) packageRates[r.hours] = r.package_fare != null ? Number(r.package_fare) : null;
      });
      const cabs = await db.allAsync(
        `SELECT id, vehicle_number, name, description, image_url, driver_name, driver_phone
         FROM cabs WHERE cab_type_id = ? AND is_active = 1 AND is_available = 1 ORDER BY vehicle_number`,
        [ct.id]
      );
      result.push({
        id: ct.id,
        name: ct.name,
        description: ct.description || '',
        packageRates,
        extraHourRate,
        cabs: cabs || [],
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching local offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: airport cab types with rate_meters (base_fare, per_km_rate, driver_charges, night_charges) and cabs.
// Frontend uses distance_km to compute fare = base_fare + (distance_km * per_km_rate) + driver_charges + night_charges.
router.get('/airport-offers', async (req, res) => {
  try {
    const cabTypes = await db.allAsync(
      "SELECT id, name, description FROM cab_types WHERE service_type = 'airport' AND is_active = 1 ORDER BY name"
    );
    const result = [];
    for (const ct of cabTypes || []) {
      const rateRow = await db.getAsync(
        `SELECT id, base_fare, per_km_rate, driver_charges, night_charges
         FROM rate_meters
         WHERE service_type = 'airport' AND car_category = ? AND (trip_type IS NULL OR trip_type = '')
         AND is_active = 1
         LIMIT 1`,
        [ct.name]
      );
      const cabs = await db.allAsync(
        `SELECT id, vehicle_number, name, description, image_url, driver_name, driver_phone
         FROM cabs WHERE cab_type_id = ? AND is_active = 1 AND is_available = 1 ORDER BY vehicle_number`,
        [ct.id]
      );
      result.push({
        id: ct.id,
        name: ct.name,
        description: ct.description || '',
        baseFare: rateRow ? Number(rateRow.base_fare) : 0,
        perKmRate: rateRow ? Number(rateRow.per_km_rate) : 0,
        driverCharges: rateRow ? Number(rateRow.driver_charges || 0) : 0,
        nightCharges: rateRow ? Number(rateRow.night_charges || 0) : 0,
        cabs: cabs || [],
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching airport offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: read number from row with any key case (SQLite may return different casing)
function getNum(row, key, defaultVal = 0) {
  if (!row) return defaultVal;
  const val = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (val == null || val === '') return defaultVal;
  const n = Number(val);
  return Number.isNaN(n) ? defaultVal : n;
}
function getInt(row, key, defaultVal = null) {
  if (!row) return defaultVal;
  const val = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
  if (val == null || val === '') return defaultVal;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? defaultVal : n;
}

// Public: outstation cab types with rate_meters for one_way, round_trip, multiple_stops and cabs.
// Frontend computes fare per trip_type: one_way (min_km, base_fare, extra_km_rate), round_trip (base_km_per_day, per_km_rate, extra_km_rate), multiple_stops (base_fare, per_km_rate).
router.get('/outstation-offers', async (req, res) => {
  try {
    const cabTypes = await db.allAsync(
      "SELECT id, name, description FROM cab_types WHERE service_type = 'outstation' AND is_active = 1 ORDER BY name"
    );
    const result = [];
    for (const ct of cabTypes || []) {
      const [oneWay, roundTrip, multiStop] = await Promise.all([
        db.getAsync(
          `SELECT id, min_km, base_fare, extra_km_rate, driver_charges, night_charges
           FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'one_way' AND is_active = 1 LIMIT 1`,
          [ct.name]
        ),
        db.getAsync(
          `SELECT id, base_km_per_day, per_km_rate, extra_km_rate, driver_charges, night_charges
           FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'round_trip' AND is_active = 1 LIMIT 1`,
          [ct.name]
        ),
        db.getAsync(
          `SELECT id, base_fare, per_km_rate, driver_charges, night_charges
           FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'multiple_stops' AND is_active = 1 LIMIT 1`,
          [ct.name]
        ),
      ]);
      const cabs = await db.allAsync(
        `SELECT id, vehicle_number, name, description, image_url, driver_name, driver_phone
         FROM cabs WHERE cab_type_id = ? AND is_active = 1 AND is_available = 1 ORDER BY vehicle_number`,
        [ct.id]
      );
      result.push({
        id: ct.id,
        name: ct.name,
        description: ct.description || '',
        oneWay: oneWay ? {
          minKm: getInt(oneWay, 'min_km') ?? 130,
          baseFare: getNum(oneWay, 'base_fare'),
          extraKmRate: getNum(oneWay, 'extra_km_rate'),
          driverCharges: getNum(oneWay, 'driver_charges'),
          nightCharges: getNum(oneWay, 'night_charges'),
        } : null,
        roundTrip: roundTrip ? {
          baseKmPerDay: getInt(roundTrip, 'base_km_per_day') ?? 300,
          perKmRate: getNum(roundTrip, 'per_km_rate'),
          extraKmRate: getNum(roundTrip, 'extra_km_rate'),
          driverCharges: getNum(roundTrip, 'driver_charges'),
          nightCharges: getNum(roundTrip, 'night_charges'),
        } : null,
        multipleStops: multiStop ? {
          baseFare: getNum(multiStop, 'base_fare'),
          perKmRate: getNum(multiStop, 'per_km_rate'),
          driverCharges: getNum(multiStop, 'driver_charges'),
          nightCharges: getNum(multiStop, 'night_charges'),
        } : null,
        cabs: cabs || [],
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching outstation offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
