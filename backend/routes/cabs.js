const express = require('express');
const db = require('../db/database');

const router = express.Router();

const KIA_AIRPORT_LAT = 13.1989;
const KIA_AIRPORT_LNG = 77.7068;

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

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

function normalizeImageUrl(url) {
  if (url == null || String(url).trim() === '') return null;
  const s = String(url).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/uploads/')) return s;
  if (s.startsWith('uploads/')) return `/${s}`;
  if (s.indexOf('/uploads/') !== -1) return s.substring(s.indexOf('/uploads/'));
  if (!s.includes('/')) return `/uploads/car-options/${s}`;
  return s.startsWith('/') ? `/uploads${s}` : `/uploads/${s}`;
}

async function getDefaultImageForCabType(cabTypeId) {
  const row = await db.getAsync(
    'SELECT image_url FROM car_options WHERE cab_type_id = ? AND is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 1',
    [cabTypeId]
  );
  if (!row || !row.image_url) return null;
  let firstUrl = null;
  try {
    const parsed = JSON.parse(row.image_url);
    firstUrl = Array.isArray(parsed) ? parsed[0] : (typeof parsed === 'string' ? parsed : null);
  } catch {
    firstUrl = row.image_url;
  }
  if (!firstUrl || typeof firstUrl !== 'string') return null;
  return normalizeImageUrl(firstUrl.trim());
}

const LOCAL_OFFER_CAB_TYPE_NAMES = ['Innova Crysta', 'SUV', 'Sedan'];

router.get('/local-offers', async (req, res) => {
  try {
    const cabTypes = await db.allAsync(
      "SELECT id, name, description, base_fare, capacity FROM cab_types WHERE service_type = 'local' AND is_active = 1 ORDER BY name"
    );
    const result = [];
    for (const ct of cabTypes || []) {
      const nameAllowed = LOCAL_OFFER_CAB_TYPE_NAMES.some(
        (allowed) => (ct.name || '').trim().toLowerCase() === allowed.trim().toLowerCase()
      );
      if (!nameAllowed) continue;

      const cabsRaw = await db.allAsync(
        `SELECT id, vehicle_number, name, description, image_url, driver_name, driver_phone
         FROM cabs WHERE cab_type_id = ? AND is_active = 1 AND is_available = 1 ORDER BY vehicle_number`,
        [ct.id]
      );
      const defaultCabTypeImage = await getDefaultImageForCabType(ct.id).catch(() => null);
      const cabs = (cabsRaw || []).map((c) => {
        const normalized = normalizeImageUrl(c.image_url) || c.image_url;
        return { ...c, image_url: normalized || defaultCabTypeImage };
      });
      if (cabs.length === 0) continue;

      let rates = await db.allAsync(
        `SELECT hours, package_fare, extra_hour_rate FROM local_package_rates WHERE cab_type_id = ? ORDER BY hours`,
        [ct.id]
      );
      if (!rates || rates.length === 0) {
        await db.runAsync(
          'INSERT INTO local_package_rates (cab_type_id, hours, package_fare, extra_hour_rate) VALUES (?, 4, 0, 0)',
          [ct.id]
        );
        await db.runAsync(
          'INSERT INTO local_package_rates (cab_type_id, hours, package_fare, extra_hour_rate) VALUES (?, 8, 0, 0)',
          [ct.id]
        );
        await db.runAsync(
          'INSERT INTO local_package_rates (cab_type_id, hours, package_fare, extra_hour_rate) VALUES (?, 12, 0, 0)',
          [ct.id]
        );
        rates = await db.allAsync(
          'SELECT hours, package_fare, extra_hour_rate FROM local_package_rates WHERE cab_type_id = ? ORDER BY hours',
          [ct.id]
        );
      }
      const extraHourRow = (rates || []).find((r) => r.extra_hour_rate != null && r.extra_hour_rate !== '');
      const extraHourRate = extraHourRow ? Number(extraHourRow.extra_hour_rate) : null;
      const packageRates = {};
      (rates || []).forEach((r) => {
        if (r.hours != null) packageRates[r.hours] = r.package_fare != null ? Number(r.package_fare) : null;
      });

      const baseFare = ct.base_fare != null ? Number(ct.base_fare) : 0;
      const capacity = ct.capacity != null ? Number(ct.capacity) : 4;
      result.push({
        id: ct.id,
        name: ct.name,
        description: ct.description || '',
        baseFare,
        packageRates,
        extraHourRate,
        seatingCapacity: capacity + 1,
        luggageCapacity: ct.luggage_capacity != null ? Number(ct.luggage_capacity) : null,
        hasAc: ct.has_ac != null ? !!ct.has_ac : null,
        includedKm: null,
        extraPerKm: null,
        gstIncluded: ct.gst_included != null ? !!ct.gst_included : true,
        cabs,
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching local offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/airport-offers', async (req, res) => {
  try {
    const cabTypes = await db.allAsync(
      "SELECT id, name, description, capacity FROM cab_types WHERE service_type = 'airport' AND is_active = 1 ORDER BY name"
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
      const cabsRaw = await db.allAsync(
        `SELECT id, vehicle_number, name, description, image_url, driver_name, driver_phone
         FROM cabs WHERE cab_type_id = ? AND is_active = 1 AND is_available = 1 ORDER BY vehicle_number`,
        [ct.id]
      );
      const defaultCabTypeImage = await getDefaultImageForCabType(ct.id).catch(() => null);
      const cabs = (cabsRaw || []).map((c) => {
        const normalized = normalizeImageUrl(c.image_url) || c.image_url;
        return { ...c, image_url: normalized || defaultCabTypeImage };
      });
      const capacity = ct.capacity != null ? Number(ct.capacity) : 4;
      result.push({
        id: ct.id,
        name: ct.name,
        description: ct.description || '',
        baseFare: rateRow ? Number(rateRow.base_fare) : 0,
        perKmRate: rateRow ? Number(rateRow.per_km_rate) : 0,
        driverCharges: rateRow ? Number(rateRow.driver_charges || 0) : 0,
        nightCharges: rateRow ? Number(rateRow.night_charges || 0) : 0,
        seatingCapacity: capacity + 1,
        luggageCapacity: ct.luggage_capacity != null ? Number(ct.luggage_capacity) : null,
        hasAc: ct.has_ac != null ? !!ct.has_ac : null,
        includedKm: null,
        extraPerKm: rateRow ? Number(rateRow.per_km_rate) : null,
        gstIncluded: ct.gst_included != null ? !!ct.gst_included : true,
        cabs,
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching airport offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/airport-fare-estimate', async (req, res) => {
  try {
    const fromLat = parseFloat(req.query.from_lat);
    const fromLng = parseFloat(req.query.from_lng);
    const toLat = parseFloat(req.query.to_lat);
    const toLng = parseFloat(req.query.to_lng);
    if (Number.isNaN(fromLat) || Number.isNaN(fromLng) || Number.isNaN(toLat) || Number.isNaN(toLng)) {
      return res.status(400).json({ error: 'from_lat, from_lng, to_lat, to_lng are required' });
    }
    const distance_km = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
    const cabTypes = await db.allAsync(
      "SELECT id, name FROM cab_types WHERE service_type = 'airport' AND is_active = 1 ORDER BY name"
    );
    const fares = [];
    for (const ct of cabTypes || []) {
      const rateRow = await db.getAsync(
        `SELECT base_fare, per_km_rate, driver_charges, night_charges
         FROM rate_meters
         WHERE service_type = 'airport' AND car_category = ? AND (trip_type IS NULL OR trip_type = '') AND is_active = 1 LIMIT 1`,
        [ct.name]
      );
      const baseFare = rateRow ? Number(rateRow.base_fare) || 0 : 0;
      const perKm = rateRow ? Number(rateRow.per_km_rate) || 0 : 0;
      const driverCharges = rateRow ? Number(rateRow.driver_charges) || 0 : 0;
      const nightCharges = rateRow ? Number(rateRow.night_charges) || 0 : 0;
      const fare_amount = Math.round(baseFare + distance_km * perKm + driverCharges + nightCharges);
      fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount });
    }
    res.json({ distance_km, fares });
  } catch (error) {
    console.error('Error airport fare estimate:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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

router.get('/outstation-offers', async (req, res) => {
  try {
    const cabTypes = await db.allAsync(
      "SELECT id, name, description, capacity FROM cab_types WHERE service_type = 'outstation' AND is_active = 1 ORDER BY name"
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
      const cabsRaw = await db.allAsync(
        `SELECT id, vehicle_number, name, description, image_url, driver_name, driver_phone
         FROM cabs WHERE cab_type_id = ? AND is_active = 1 AND is_available = 1 ORDER BY vehicle_number`,
        [ct.id]
      );
      const defaultCabTypeImage = await getDefaultImageForCabType(ct.id).catch(() => null);
      const cabs = (cabsRaw || []).map((c) => {
        const normalized = normalizeImageUrl(c.image_url) || c.image_url;
        return { ...c, image_url: normalized || defaultCabTypeImage };
      });
      const capacity = ct.capacity != null ? Number(ct.capacity) : 4;
      const firstRate = oneWay || roundTrip || multiStop;
      result.push({
        id: ct.id,
        name: ct.name,
        description: ct.description || '',
        seatingCapacity: capacity + 1,
        luggageCapacity: ct.luggage_capacity != null ? Number(ct.luggage_capacity) : null,
        hasAc: ct.has_ac != null ? !!ct.has_ac : null,
        gstIncluded: ct.gst_included != null ? !!ct.gst_included : true,
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
        baseFare: firstRate ? getNum(firstRate, 'base_fare') : 0,
        perKmRate: firstRate ? getNum(firstRate, 'per_km_rate') : 0,
        driverCharges: firstRate ? getNum(firstRate, 'driver_charges') : 0,
        nightCharges: firstRate ? getNum(firstRate, 'night_charges') : 0,
        includedKm: oneWay ? (getInt(oneWay, 'min_km') ?? 130) : (roundTrip ? getInt(roundTrip, 'base_km_per_day') ?? 300 : null),
        extraPerKm: oneWay ? getNum(oneWay, 'extra_km_rate') : (roundTrip ? getNum(roundTrip, 'extra_km_rate') : (multiStop ? getNum(multiStop, 'per_km_rate') : null)),
        cabs,
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching outstation offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/outstation-fare-estimate', async (req, res) => {
  try {
    const tripType = req.query.trip_type || 'one_way';
    const offers = await db.allAsync(
      "SELECT id, name FROM cab_types WHERE service_type = 'outstation' AND is_active = 1 ORDER BY name"
    );
    const fares = [];

    if (tripType === 'one_way') {
      const fromLat = parseFloat(req.query.from_lat);
      const fromLng = parseFloat(req.query.from_lng);
      const toLat = parseFloat(req.query.to_lat);
      const toLng = parseFloat(req.query.to_lng);
      const hasCoords = !Number.isNaN(fromLat) && !Number.isNaN(fromLng) && !Number.isNaN(toLat) && !Number.isNaN(toLng);
      const distance_km = hasCoords ? haversineDistanceKm(fromLat, fromLng, toLat, toLng) : 0;

      for (const ct of offers || []) {
        const row = await db.getAsync(
          `SELECT min_km, base_fare, extra_km_rate, driver_charges, night_charges
           FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'one_way' AND is_active = 1 LIMIT 1`,
          [ct.name]
        );
        if (!row) { fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount: 0 }); continue; }
        const minKm = getInt(row, 'min_km') ?? 130;
        const baseFare = getNum(row, 'base_fare');
        const extraKmRate = getNum(row, 'extra_km_rate');
        const driverCharges = getNum(row, 'driver_charges');
        const nightCharges = getNum(row, 'night_charges');
        const extraKm = Math.max(0, distance_km - minKm);
        const fare_amount = Math.round(baseFare + extraKm * extraKmRate + driverCharges + nightCharges);
        fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount });
      }
      return res.json({ distance_km, fares });
    }

    if (tripType === 'round_trip') {
      const days = Math.max(1, parseInt(req.query.number_of_days, 10) || 1);
      const defaultKmPerDay = 250;

      for (const ct of offers || []) {
        const row = await db.getAsync(
          `SELECT base_km_per_day, per_km_rate, extra_km_rate, driver_charges, night_charges
           FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'round_trip' AND is_active = 1 LIMIT 1`,
          [ct.name]
        );
        if (!row) { fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount: 0 }); continue; }
        const baseKmPerDay = getInt(row, 'base_km_per_day') ?? 300;
        const perKmRate = getNum(row, 'per_km_rate');
        const extraKmRate = getNum(row, 'extra_km_rate');
        const driverCharges = getNum(row, 'driver_charges');
        const nightCharges = getNum(row, 'night_charges');
        const totalKm = defaultKmPerDay * days;
        const includedKm = baseKmPerDay * days;
        const extraKm = Math.max(0, totalKm - includedKm);
        const fare_amount = Math.round(includedKm * perKmRate + extraKm * extraKmRate + (driverCharges + nightCharges) * days);
        fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount });
      }
      return res.json({ number_of_days: days, fares });
    }

    if (tripType === 'multiple_stops') {
      for (const ct of offers || []) {
        const row = await db.getAsync(
          `SELECT base_fare, per_km_rate, driver_charges, night_charges
           FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'multiple_stops' AND is_active = 1 LIMIT 1`,
          [ct.name]
        );
        if (!row) { fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount: 0 }); continue; }
        const baseFare = getNum(row, 'base_fare');
        const driverCharges = getNum(row, 'driver_charges');
        const nightCharges = getNum(row, 'night_charges');
        const fare_amount = Math.round(baseFare + driverCharges + nightCharges);
        fares.push({ cab_type_id: ct.id, cab_type_name: ct.name, fare_amount });
      }
      return res.json({ fares });
    }

    return res.json({ fares: [] });
  } catch (error) {
    console.error('Error outstation fare estimate:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
