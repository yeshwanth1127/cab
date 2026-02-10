const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db/database');

const router = express.Router();

const carOptionsUploadDir = path.join(__dirname, '../uploads/car-options');
if (!fs.existsSync(carOptionsUploadDir)) {
  fs.mkdirSync(carOptionsUploadDir, { recursive: true });
}
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, carOptionsUploadDir),
    filename: (_req, file, cb) => {
      const safe = (file.originalname || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
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

const LOCAL_RATE_METER_CAB_NAMES = ['Innova Crysta', 'SUV', 'Sedan'];
const INNOVA_CRYSTA_NAME = 'Innova Crysta';

function isInnovaCrysta(name) {
  return (name || '').trim().toLowerCase() === INNOVA_CRYSTA_NAME.trim().toLowerCase();
}

async function ensureCabTypesImageUrlColumn() {
  try {
    await db.runAsync('ALTER TABLE cab_types ADD COLUMN image_url TEXT');
  } catch (e) {
    // column may already exist
  }
}

router.get(
  '/rate-meter/cab-types',
  query('service_type').isIn(['local', 'airport', 'outstation']).withMessage('service_type must be local, airport, or outstation'),
  async (req, res) => {
    try {
      await ensureCabTypesImageUrlColumn();
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { service_type } = req.query;
      const rows = await db.allAsync(
        `SELECT ct.id, ct.name, ct.description, ct.service_type, ct.base_fare, ct.per_km_rate, ct.image_url,
                (SELECT COUNT(*) FROM cabs c WHERE c.cab_type_id = ct.id AND c.is_active = 1) as cab_count
         FROM cab_types ct
         WHERE ct.service_type = ? AND ct.is_active = 1
         ORDER BY ct.name`,
        [service_type]
      );
      let result = rows || [];
      if (service_type === 'local') {
        result = result.filter((row) =>
          LOCAL_RATE_METER_CAB_NAMES.some(
            (allowed) => (row.name || '').trim().toLowerCase() === allowed.trim().toLowerCase()
          )
        );
      } else if (service_type === 'airport' || service_type === 'outstation') {
        result = result.filter((row) => (row.name || '').trim().toLowerCase() !== 'innova');
      }
      // Deduplicate by name (case-insensitive): keep one row per name (prefer lowest id), sum cab_count
      const byKey = new Map();
      for (const row of result) {
        const key = (row.name || '').trim().toLowerCase();
        const cabCount = (row.cab_count != null ? Number(row.cab_count) : 0) || 0;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, { ...row, cab_count: cabCount });
        } else if (row.id < existing.id) {
          byKey.set(key, { ...row, cab_count: (existing.cab_count != null ? Number(existing.cab_count) : 0) + cabCount });
        } else {
          existing.cab_count = (existing.cab_count != null ? Number(existing.cab_count) : 0) + cabCount;
        }
      }
      result = Array.from(byKey.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      res.json(result);
    } catch (error) {
      console.error('Error fetching rate-meter cab types:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/rate-meter/cab-types',
  [
    body('name').notEmpty().trim().withMessage('name is required'),
    body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('service_type must be local, airport, or outstation'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { name, description, service_type } = req.body;
      const existing = await db.getAsync(
        'SELECT id FROM cab_types WHERE name = ? AND service_type = ?',
        [name.trim(), service_type]
      );
      if (existing) return res.status(400).json({ error: 'Cab type with this name already exists for this service type' });
      const r = await db.runAsync(
        `INSERT INTO cab_types (name, description, service_type, base_fare, per_km_rate) VALUES (?, ?, ?, 0, 0)`,
        [name.trim(), description || null, service_type]
      );
      const row = await db.getAsync('SELECT id, name, description, service_type FROM cab_types WHERE id = ?', [r.lastID]);
      res.status(201).json(row);
    } catch (error) {
      console.error('Error creating cab type:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put(
  '/rate-meter/cab-types/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty(),
  body('description').optional(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { id } = req.params;
      const { name, description } = req.body;
      const existing = await db.getAsync('SELECT id, name, service_type FROM cab_types WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Cab type not found' });
      const updates = [];
      const values = [];
      if (name !== undefined) {
        const conflict = await db.getAsync('SELECT id FROM cab_types WHERE name = ? AND service_type = ? AND id != ?', [name, existing.service_type, id]);
        if (conflict) return res.status(400).json({ error: 'Cab type with this name already exists for this service type' });
        updates.push('name = ?');
        values.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
      }
      if (updates.length === 0) return res.json(existing);
      values.push(id);
      await db.runAsync(`UPDATE cab_types SET ${updates.join(', ')} WHERE id = ?`, values);
      const row = await db.getAsync('SELECT id, name, description, service_type FROM cab_types WHERE id = ?', [id]);
      res.json(row);
    } catch (error) {
      console.error('Error updating cab type:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete(
  '/rate-meter/cab-types/:id',
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.getAsync('SELECT id FROM cab_types WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Cab type not found' });
      const cabCount = await db.getAsync('SELECT COUNT(*) as c FROM cabs WHERE cab_type_id = ? AND is_active = 1', [id]);
      if (cabCount && cabCount.c > 0) return res.status(400).json({ error: 'Cannot delete cab type with active cabs' });
      await db.runAsync('UPDATE cab_types SET is_active = 0 WHERE id = ?', [id]);
      res.json({ message: 'Cab type deactivated' });
    } catch (error) {
      console.error('Error deleting cab type:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/rate-meter/cab-types/:id/upload',
  param('id').isInt({ min: 1 }),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be under 5MB' });
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file || !req.file.filename) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      const existing = await db.getAsync('SELECT id, name FROM cab_types WHERE id = ? AND is_active = 1', [id]);
      if (!existing) return res.status(404).json({ error: 'Cab type not found' });
      const imagePath = `car-options/${req.file.filename}`;
      await db.runAsync('UPDATE cab_types SET image_url = ? WHERE id = ?', [imagePath, id]);
      const row = await db.getAsync('SELECT id, name, description, service_type, image_url FROM cab_types WHERE id = ?', [id]);
      res.json(row);
    } catch (error) {
      console.error('Error uploading cab type image:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get(
  '/rate-meter/cabs',
  query('cab_type_id').isInt({ min: 1 }).withMessage('cab_type_id is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { cab_type_id } = req.query;
      const ct = await db.getAsync('SELECT id, name, service_type FROM cab_types WHERE id = ? AND is_active = 1', [cab_type_id]);
      if (!ct) return res.json([]);
      const sameNameIds = await db.allAsync(
        `SELECT id FROM cab_types WHERE is_active = 1 AND service_type = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`,
        [ct.service_type, ct.name]
      );
      const ids = (sameNameIds || []).map((r) => r.id);
      if (ids.length === 0) return res.json([]);
      const placeholders = ids.map(() => '?').join(',');
      const rows = await db.allAsync(
        `SELECT id, cab_type_id, vehicle_number, driver_name, driver_phone, name, description, image_url, is_available, is_active
         FROM cabs WHERE cab_type_id IN (${placeholders}) AND is_active = 1 ORDER BY vehicle_number`,
        ids
      );
      res.json(rows || []);
    } catch (error) {
      console.error('Error fetching rate-meter cabs:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/rate-meter/cabs/assign',
  [
    body('cab_id').isInt({ min: 1 }).withMessage('cab_id is required'),
    body('cab_type_id').isInt({ min: 1 }).withMessage('cab_type_id is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { cab_id, cab_type_id } = req.body;
      const ct = await db.getAsync('SELECT id FROM cab_types WHERE id = ? AND is_active = 1', [cab_type_id]);
      if (!ct) return res.status(400).json({ error: 'Cab type not found' });
      const cab = await db.getAsync('SELECT id FROM cabs WHERE id = ? AND is_active = 1', [cab_id]);
      if (!cab) return res.status(400).json({ error: 'Cab not found' });
      await db.runAsync('UPDATE cabs SET cab_type_id = ? WHERE id = ?', [cab_type_id, cab_id]);
      const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [cab_id]);
      res.json(row);
    } catch (error) {
      console.error('Error assigning cab:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/rate-meter/cabs',
  [
    body('cab_type_id').isInt({ min: 1 }).withMessage('cab_type_id is required'),
    body('vehicle_number').notEmpty().trim().withMessage('vehicle_number is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { cab_type_id, vehicle_number, driver_name, driver_phone, name, description, image_url, create_only } = req.body;
      const ct = await db.getAsync('SELECT id FROM cab_types WHERE id = ? AND is_active = 1', [cab_type_id]);
      if (!ct) return res.status(400).json({ error: 'Cab type not found' });
      const vn = vehicle_number.trim();
      const existing = await db.getAsync('SELECT id FROM cabs WHERE vehicle_number = ?', [vn]);
      if (existing) {
        if (create_only) {
          return res.status(400).json({ error: 'This vehicle number is already used. Use a different number or assign that cab via "Assign existing cab".' });
        }
        await db.runAsync(
          `UPDATE cabs SET cab_type_id = ?, driver_name = ?, driver_phone = ?, name = ?, description = ?, image_url = ?, is_active = 1 WHERE id = ?`,
          [cab_type_id, driver_name || null, driver_phone || null, name || null, description || null, image_url || null, existing.id]
        );
        const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [existing.id]);
        return res.json(row);
      }
      const r = await db.runAsync(
        `INSERT INTO cabs (cab_type_id, vehicle_number, driver_name, driver_phone, name, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cab_type_id, vn, driver_name || null, driver_phone || null, name || null, description || null, image_url || null]
      );
      const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [r.lastID]);
      res.status(201).json(row);
    } catch (error) {
      console.error('Error creating cab:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put(
  '/rate-meter/cabs/:id',
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { cab_type_id, vehicle_number, driver_name, driver_phone, name, description, image_url, is_available } = req.body;
      const existing = await db.getAsync('SELECT id FROM cabs WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Cab not found' });
      const updates = [];
      const values = [];
      if (cab_type_id !== undefined) {
        const ct = await db.getAsync('SELECT id FROM cab_types WHERE id = ? AND is_active = 1', [cab_type_id]);
        if (!ct) return res.status(400).json({ error: 'Cab type not found' });
        updates.push('cab_type_id = ?');
        values.push(cab_type_id);
      }
      if (vehicle_number !== undefined) {
        const dup = await db.getAsync('SELECT id FROM cabs WHERE vehicle_number = ? AND id != ?', [vehicle_number.trim(), id]);
        if (dup) return res.status(400).json({ error: 'Vehicle number already exists' });
        updates.push('vehicle_number = ?');
        values.push(vehicle_number.trim());
      }
      if (driver_name !== undefined) { updates.push('driver_name = ?'); values.push(driver_name); }
      if (driver_phone !== undefined) { updates.push('driver_phone = ?'); values.push(driver_phone); }
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      if (image_url !== undefined) { updates.push('image_url = ?'); values.push(image_url); }
      if (is_available !== undefined) { updates.push('is_available = ?'); values.push(is_available ? 1 : 0); }
      if (updates.length === 0) {
        const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [id]);
        return res.json(row);
      }
      values.push(id);
      await db.runAsync(`UPDATE cabs SET ${updates.join(', ')} WHERE id = ?`, values);
      const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [id]);
      res.json(row);
    } catch (error) {
      console.error('Error updating cab:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post(
  '/rate-meter/cabs/:id/upload',
  param('id').isInt({ min: 1 }),
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be under 5MB' });
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file || !req.file.filename) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      const existing = await db.getAsync('SELECT id FROM cabs WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Cab not found' });
      const imagePath = `car-options/${req.file.filename}`;
      await db.runAsync('UPDATE cabs SET image_url = ? WHERE id = ?', [imagePath, id]);
      const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [id]);
      res.json(row);
    } catch (error) {
      console.error('Error uploading cab image:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete(
  '/rate-meter/cabs/:id',
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.getAsync('SELECT id FROM cabs WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Cab not found' });
      await db.runAsync('UPDATE cabs SET is_active = 0 WHERE id = ?', [id]);
      res.json({ message: 'Cab deactivated' });
    } catch (error) {
      console.error('Error deleting cab:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/rate-meter/local/:cabTypeId', param('cabTypeId').isInt({ min: 1 }), async (req, res) => {
  try {
    const { cabTypeId } = req.params;
    const ct = await db.getAsync('SELECT id, name, base_fare FROM cab_types WHERE id = ? AND service_type = \'local\'', [cabTypeId]);
    if (!ct) return res.status(404).json({ error: 'Cab type not found' });
    const rates = await db.allAsync(
      'SELECT hours, package_fare, extra_hour_rate FROM local_package_rates WHERE cab_type_id = ? ORDER BY hours',
      [cabTypeId]
    );
    const extraHourRow = (rates || []).find((r) => r.extra_hour_rate != null && r.extra_hour_rate !== '');
    const packageRates = {};
    (rates || []).forEach((r) => {
      if (r.hours != null) packageRates[r.hours] = r.package_fare != null ? Number(r.package_fare) : null;
    });
    res.json({
      cab_type_id: ct.id,
      base_fare: ct.base_fare != null ? Number(ct.base_fare) : 0,
      package_4h: packageRates[4] ?? null,
      package_8h: packageRates[8] ?? null,
      package_12h: packageRates[12] ?? null,
      extra_hour_rate: extraHourRow ? Number(extraHourRow.extra_hour_rate) : null,
    });
  } catch (error) {
    console.error('Error fetching local rates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put(
  '/rate-meter/local/:cabTypeId',
  param('cabTypeId').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { cabTypeId } = req.params;
      const { base_fare, package_4h, package_8h, package_12h, extra_hour_rate } = req.body;
      const ct = await db.getAsync('SELECT id, name FROM cab_types WHERE id = ? AND service_type = \'local\'', [cabTypeId]);
      if (!ct) return res.status(404).json({ error: 'Cab type not found' });
      if (base_fare !== undefined) await db.runAsync('UPDATE cab_types SET base_fare = ? WHERE id = ?', [Number(base_fare) || 0, cabTypeId]);
      const extraRate = extra_hour_rate != null ? Number(extra_hour_rate) : null;
      await db.runAsync('DELETE FROM local_package_rates WHERE cab_type_id = ?', [cabTypeId]);
      await db.runAsync(
        'INSERT INTO local_package_rates (cab_type_id, hours, package_fare, extra_hour_rate) VALUES (?, 4, ?, ?)',
        [cabTypeId, package_4h != null ? Number(package_4h) : null, extraRate]
      );
      await db.runAsync(
        'INSERT INTO local_package_rates (cab_type_id, hours, package_fare, extra_hour_rate) VALUES (?, 8, ?, ?)',
        [cabTypeId, package_8h != null ? Number(package_8h) : null, extraRate]
      );
      await db.runAsync(
        'INSERT INTO local_package_rates (cab_type_id, hours, package_fare, extra_hour_rate) VALUES (?, 12, ?, ?)',
        [cabTypeId, package_12h != null ? Number(package_12h) : null, extraRate]
      );
      const updated = await db.getAsync('SELECT base_fare FROM cab_types WHERE id = ?', [cabTypeId]);
      const rates = await db.allAsync('SELECT hours, package_fare, extra_hour_rate FROM local_package_rates WHERE cab_type_id = ? ORDER BY hours', [cabTypeId]);
      const packageRates = {};
      const extraRow = (rates || []).find((r) => r.extra_hour_rate != null);
      (rates || []).forEach((r) => { if (r.hours != null) packageRates[r.hours] = r.package_fare != null ? Number(r.package_fare) : null; });
      res.json({
        cab_type_id: Number(cabTypeId),
        base_fare: updated ? Number(updated.base_fare) : 0,
        package_4h: packageRates[4] ?? null,
        package_8h: packageRates[8] ?? null,
        package_12h: packageRates[12] ?? null,
        extra_hour_rate: extraRow ? Number(extraRow.extra_hour_rate) : null,
      });
    } catch (error) {
      console.error('Error updating local rates:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/rate-meter/airport/:cabTypeId', param('cabTypeId').isInt({ min: 1 }), async (req, res) => {
  try {
    const { cabTypeId } = req.params;
    const ct = await db.getAsync('SELECT id, name FROM cab_types WHERE id = ? AND service_type = \'airport\'', [cabTypeId]);
    if (!ct) return res.status(404).json({ error: 'Cab type not found' });
    const row = await db.getAsync(
      `SELECT id, base_fare, per_km_rate, driver_charges, night_charges FROM rate_meters
       WHERE service_type = 'airport' AND car_category = ? AND (trip_type IS NULL OR trip_type = '') AND is_active = 1 LIMIT 1`,
      [ct.name]
    );
    res.json({
      cab_type_id: ct.id,
      base_fare: row ? getNum(row, 'base_fare') : 0,
      per_km_rate: row ? getNum(row, 'per_km_rate') : 0,
      driver_charges: row ? getNum(row, 'driver_charges') : 0,
      night_charges: row ? getNum(row, 'night_charges') : 0,
    });
  } catch (error) {
    console.error('Error fetching airport rates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put(
  '/rate-meter/airport/:cabTypeId',
  param('cabTypeId').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { cabTypeId } = req.params;
      const { base_fare, per_km_rate, driver_charges, night_charges } = req.body;
      const ct = await db.getAsync('SELECT id, name FROM cab_types WHERE id = ? AND service_type = \'airport\'', [cabTypeId]);
      if (!ct) return res.status(404).json({ error: 'Cab type not found' });
      const existing = await db.getAsync(
        `SELECT id FROM rate_meters WHERE service_type = 'airport' AND car_category = ? AND (trip_type IS NULL OR trip_type = '')`,
        [ct.name]
      );
      const bf = base_fare != null ? Number(base_fare) : 0;
      const pkm = per_km_rate != null ? Number(per_km_rate) : 0;
      const dc = driver_charges != null ? Number(driver_charges) : 0;
      const nc = night_charges != null ? Number(night_charges) : 0;
      if (existing) {
        await db.runAsync(
          'UPDATE rate_meters SET base_fare = ?, per_km_rate = ?, driver_charges = ?, night_charges = ? WHERE id = ?',
          [bf, pkm, dc, nc, existing.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO rate_meters (service_type, car_category, trip_type, base_fare, per_km_rate, driver_charges, night_charges) VALUES ('airport', ?, '', ?, ?, ?, ?)`,
          [ct.name, bf, pkm, dc, nc]
        );
      }
      const row = await db.getAsync(
        `SELECT base_fare, per_km_rate, driver_charges, night_charges FROM rate_meters
         WHERE service_type = 'airport' AND car_category = ? AND (trip_type IS NULL OR trip_type = '') LIMIT 1`,
        [ct.name]
      );
      res.json({
        cab_type_id: Number(cabTypeId),
        base_fare: getNum(row, 'base_fare'),
        per_km_rate: getNum(row, 'per_km_rate'),
        driver_charges: getNum(row, 'driver_charges'),
        night_charges: getNum(row, 'night_charges'),
      });
    } catch (error) {
      console.error('Error updating airport rates:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/rate-meter/outstation/:cabTypeId', param('cabTypeId').isInt({ min: 1 }), async (req, res) => {
  try {
    const { cabTypeId } = req.params;
    const ct = await db.getAsync('SELECT id, name FROM cab_types WHERE id = ? AND service_type = \'outstation\'', [cabTypeId]);
    if (!ct) return res.status(404).json({ error: 'Cab type not found' });
    const [oneWay, roundTrip, multiStop] = await Promise.all([
      db.getAsync(`SELECT min_km, base_fare, extra_km_rate, driver_charges, night_charges FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'one_way' AND is_active = 1 LIMIT 1`, [ct.name]),
      db.getAsync(`SELECT base_km_per_day, per_km_rate, extra_km_rate, driver_charges, night_charges FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'round_trip' AND is_active = 1 LIMIT 1`, [ct.name]),
      db.getAsync(`SELECT base_fare, per_km_rate, driver_charges, night_charges FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'multiple_stops' AND is_active = 1 LIMIT 1`, [ct.name]),
    ]);
    res.json({
      cab_type_id: ct.id,
      oneWay: oneWay ? { minKm: getInt(oneWay, 'min_km', 130), baseFare: getNum(oneWay, 'base_fare'), extraKmRate: getNum(oneWay, 'extra_km_rate'), driverCharges: getNum(oneWay, 'driver_charges'), nightCharges: getNum(oneWay, 'night_charges') } : null,
      roundTrip: roundTrip ? { baseKmPerDay: getInt(roundTrip, 'base_km_per_day', 300), perKmRate: getNum(roundTrip, 'per_km_rate'), extraKmRate: getNum(roundTrip, 'extra_km_rate'), driverCharges: getNum(roundTrip, 'driver_charges'), nightCharges: getNum(roundTrip, 'night_charges') } : null,
      multipleStops: multiStop ? { baseFare: getNum(multiStop, 'base_fare'), perKmRate: getNum(multiStop, 'per_km_rate'), driverCharges: getNum(multiStop, 'driver_charges'), nightCharges: getNum(multiStop, 'night_charges') } : null,
    });
  } catch (error) {
    console.error('Error fetching outstation rates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put(
  '/rate-meter/outstation/:cabTypeId',
  param('cabTypeId').isInt({ min: 1 }),
  async (req, res) => {
    try {
      const { cabTypeId } = req.params;
      const { oneWay, roundTrip, multipleStops } = req.body;
      const ct = await db.getAsync('SELECT id, name FROM cab_types WHERE id = ? AND service_type = \'outstation\'', [cabTypeId]);
      if (!ct) return res.status(404).json({ error: 'Cab type not found' });
      const cat = ct.name;

      const upsert = async (tripType, fields) => {
        const existing = await db.getAsync(
          `SELECT id FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = ?`,
          [cat, tripType]
        );
        if (existing) {
          const set = Object.entries(fields).map(([k]) => `${k} = ?`).join(', ');
          await db.runAsync(`UPDATE rate_meters SET ${set} WHERE id = ?`, [...Object.values(fields), existing.id]);
        } else {
          const cols = ['service_type', 'car_category', 'trip_type', ...Object.keys(fields)];
          const placeholders = cols.map(() => '?').join(', ');
          await db.runAsync(`INSERT INTO rate_meters (${cols.join(', ')}) VALUES (${placeholders})`, ['outstation', cat, tripType, ...Object.values(fields)]);
        }
      };

      if (oneWay && typeof oneWay === 'object') {
        await upsert('one_way', {
          min_km: oneWay.minKm != null ? Number(oneWay.minKm) : 130,
          base_fare: getNum(oneWay, 'baseFare'),
          extra_km_rate: getNum(oneWay, 'extraKmRate'),
          driver_charges: getNum(oneWay, 'driverCharges'),
          night_charges: getNum(oneWay, 'nightCharges'),
        });
      }
      if (roundTrip && typeof roundTrip === 'object') {
        await upsert('round_trip', {
          base_km_per_day: roundTrip.baseKmPerDay != null ? Number(roundTrip.baseKmPerDay) : 300,
          per_km_rate: getNum(roundTrip, 'perKmRate'),
          extra_km_rate: getNum(roundTrip, 'extraKmRate'),
          driver_charges: getNum(roundTrip, 'driverCharges'),
          night_charges: getNum(roundTrip, 'nightCharges'),
        });
      }
      if (multipleStops && typeof multipleStops === 'object') {
        await upsert('multiple_stops', {
          base_fare: getNum(multipleStops, 'baseFare'),
          per_km_rate: getNum(multipleStops, 'perKmRate'),
          driver_charges: getNum(multipleStops, 'driverCharges'),
          night_charges: getNum(multipleStops, 'nightCharges'),
        });
      }

      const [oneWayRow, roundTripRow, multiStopRow] = await Promise.all([
        db.getAsync(`SELECT min_km, base_fare, extra_km_rate, driver_charges, night_charges FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'one_way' LIMIT 1`, [cat]),
        db.getAsync(`SELECT base_km_per_day, per_km_rate, extra_km_rate, driver_charges, night_charges FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'round_trip' LIMIT 1`, [cat]),
        db.getAsync(`SELECT base_fare, per_km_rate, driver_charges, night_charges FROM rate_meters WHERE service_type = 'outstation' AND car_category = ? AND trip_type = 'multiple_stops' LIMIT 1`, [cat]),
      ]);
      res.json({
        cab_type_id: Number(cabTypeId),
        oneWay: oneWayRow ? { minKm: getInt(oneWayRow, 'min_km', 130), baseFare: getNum(oneWayRow, 'base_fare'), extraKmRate: getNum(oneWayRow, 'extra_km_rate'), driverCharges: getNum(oneWayRow, 'driver_charges'), nightCharges: getNum(oneWayRow, 'night_charges') } : null,
        roundTrip: roundTripRow ? { baseKmPerDay: getInt(roundTripRow, 'base_km_per_day', 300), perKmRate: getNum(roundTripRow, 'per_km_rate'), extraKmRate: getNum(roundTripRow, 'extra_km_rate'), driverCharges: getNum(roundTripRow, 'driver_charges'), nightCharges: getNum(roundTripRow, 'night_charges') } : null,
        multipleStops: multiStopRow ? { baseFare: getNum(multiStopRow, 'base_fare'), perKmRate: getNum(multiStopRow, 'per_km_rate'), driverCharges: getNum(multiStopRow, 'driver_charges'), nightCharges: getNum(multiStopRow, 'night_charges') } : null,
      });
    } catch (error) {
      console.error('Error updating outstation rates:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
