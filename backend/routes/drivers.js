const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await db.allAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       ORDER BY d.created_at DESC`
    );
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single driver
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await db.getAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       WHERE d.id = ?`,
      [id]
    );

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create driver
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('license_number').optional().notEmpty().withMessage('License number cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      phone,
      email,
      license_number,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      experience_years
    } = req.body;

    // Check if phone already exists
    const existing = await db.getAsync(
      'SELECT id FROM drivers WHERE phone = ?',
      [phone]
    );

    if (existing) {
      return res.status(400).json({ error: 'Driver with this phone number already exists' });
    }

    // Check if license number already exists (if provided)
    if (license_number) {
      const existingLicense = await db.getAsync(
        'SELECT id FROM drivers WHERE license_number = ?',
        [license_number]
      );

      if (existingLicense) {
        return res.status(400).json({ error: 'Driver with this license number already exists' });
      }
    }

    const result = await db.runAsync(
      `INSERT INTO drivers (
        name, phone, email, license_number, address, 
        emergency_contact_name, emergency_contact_phone, experience_years
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        phone,
        email || null,
        license_number || null,
        address || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        experience_years || null
      ]
    );

    const newDriver = await db.getAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       WHERE d.id = ?`,
      [result.lastID]
    );

    res.status(201).json(newDriver);
  } catch (error) {
    console.error('Error creating driver:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Driver with this phone or license number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update driver
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('license_number').optional().notEmpty().withMessage('License number cannot be empty'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      phone,
      email,
      license_number,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      experience_years,
      is_active
    } = req.body;

    // Check if driver exists
    const existing = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if phone is being changed and already exists
    if (phone && phone !== existing.phone) {
      const phoneExists = await db.getAsync(
        'SELECT id FROM drivers WHERE phone = ? AND id != ?',
        [phone, id]
      );
      if (phoneExists) {
        return res.status(400).json({ error: 'Driver with this phone number already exists' });
      }
    }

    // Check if license number is being changed and already exists
    if (license_number && license_number !== existing.license_number) {
      const licenseExists = await db.getAsync(
        'SELECT id FROM drivers WHERE license_number = ? AND id != ?',
        [license_number, id]
      );
      if (licenseExists) {
        return res.status(400).json({ error: 'Driver with this license number already exists' });
      }
    }

    // Build update query dynamically
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
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (license_number !== undefined) {
      updates.push('license_number = ?');
      values.push(license_number);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(address);
    }
    if (emergency_contact_name !== undefined) {
      updates.push('emergency_contact_name = ?');
      values.push(emergency_contact_name);
    }
    if (emergency_contact_phone !== undefined) {
      updates.push('emergency_contact_phone = ?');
      values.push(emergency_contact_phone);
    }
    if (experience_years !== undefined) {
      updates.push('experience_years = ?');
      values.push(experience_years);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.runAsync(
      `UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync(
      `SELECT d.*, 
       (SELECT COUNT(*) FROM cabs WHERE driver_id = d.id AND is_active = 1) as assigned_cabs_count
       FROM drivers d
       WHERE d.id = ?`,
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete driver
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Check if driver is assigned to any active cabs
    const assignedCabs = await db.getAsync(
      'SELECT COUNT(*) as count FROM cabs WHERE driver_id = ? AND is_active = 1',
      [id]
    );

    if (assignedCabs && assignedCabs.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete driver. Driver is assigned to active cabs. Please unassign first.' 
      });
    }

    await db.runAsync('DELETE FROM drivers WHERE id = ?', [id]);

    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available drivers (not assigned to any active cab)
router.get('/available/list', async (req, res) => {
  try {
    const drivers = await db.allAsync(
      `SELECT d.*
       FROM drivers d
       WHERE d.is_active = 1
       AND d.id NOT IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1
       )
       ORDER BY d.name ASC`
    );
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


