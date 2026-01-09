const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public endpoint: Create corporate booking
router.post('/bookings', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone_number').notEmpty().withMessage('Phone number is required'),
  body('company_name').notEmpty().withMessage('Company name is required'),
  body('pickup_point').notEmpty().withMessage('Pickup point is required'),
  body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('travel_date').notEmpty().withMessage('Travel date is required'),
  body('travel_time').notEmpty().withMessage('Travel time is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone_number, company_name, pickup_point, service_type, travel_date, travel_time, notes } = req.body;

    // Add columns if they don't exist (migration)
    try {
      await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN service_type TEXT');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN travel_date TEXT');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN travel_time TEXT');
    } catch (e) {
      // Column already exists, ignore
    }
    
    // Use 'N/A' as default for drop_point since it's required by schema but not in the form
    // (drop_point was removed from the form and replaced with service_type)
    const drop_point = 'N/A';

    const result = await db.runAsync(
      `INSERT INTO corporate_bookings (name, phone_number, company_name, pickup_point, drop_point, service_type, travel_date, travel_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone_number, company_name, pickup_point, drop_point, service_type, travel_date, travel_time, notes || null]
    );

    const newBooking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating corporate booking:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin endpoints (require authentication)
router.use(authenticateToken);
router.use(requireAdmin);

// Get all corporate bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await db.allAsync(
      `SELECT cb.*, c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone, ct.name as cab_type_name
       FROM corporate_bookings cb
       LEFT JOIN cabs c ON cb.cab_id = c.id
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       ORDER BY cb.created_at DESC`
    );
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching corporate bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single corporate booking
router.get('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update corporate booking
router.put('/bookings/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone_number').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('company_name').optional().notEmpty().withMessage('Company name cannot be empty'),
  body('pickup_point').optional().notEmpty().withMessage('Pickup point cannot be empty'),
  body('drop_point').optional().notEmpty().withMessage('Drop point cannot be empty'),
  body('status').optional().isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, phone_number, company_name, pickup_point, drop_point, status, notes } = req.body;

    const existing = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (phone_number !== undefined) {
      updates.push('phone_number = ?');
      values.push(phone_number);
    }
    if (company_name !== undefined) {
      updates.push('company_name = ?');
      values.push(company_name);
    }
    if (pickup_point !== undefined) {
      updates.push('pickup_point = ?');
      values.push(pickup_point);
    }
    if (req.body.service_type !== undefined) {
      updates.push('service_type = ?');
      values.push(req.body.service_type);
    }
    if (req.body.travel_date !== undefined) {
      updates.push('travel_date = ?');
      values.push(req.body.travel_date);
    }
    if (req.body.travel_time !== undefined) {
      updates.push('travel_time = ?');
      values.push(req.body.travel_time);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (req.body.fare_amount !== undefined) {
      updates.push('fare_amount = ?');
      values.push(req.body.fare_amount);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.runAsync(
      `UPDATE corporate_bookings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete corporate booking
router.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    await db.runAsync('DELETE FROM corporate_bookings WHERE id = ?', [id]);

    res.json({ message: 'Corporate booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
