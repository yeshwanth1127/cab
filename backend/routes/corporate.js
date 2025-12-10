const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Create corporate booking (public endpoint)
router.post('/bookings', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone_number').notEmpty().withMessage('Phone number is required'),
  body('company_name').notEmpty().withMessage('Company name is required'),
  body('pickup_point').notEmpty().withMessage('Pickup point is required'),
  body('drop_point').notEmpty().withMessage('Drop point is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone_number, company_name, pickup_point, drop_point, notes } = req.body;

    const result = await db.runAsync(
      `INSERT INTO corporate_bookings (name, phone_number, company_name, pickup_point, drop_point, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [name, phone_number, company_name, pickup_point, drop_point, notes || null]
    );

    const newBooking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all corporate bookings (admin only)
router.get('/bookings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const bookings = await db.allAsync(
      'SELECT * FROM corporate_bookings ORDER BY created_at DESC'
    );
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching corporate bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single corporate booking (admin only)
router.get('/bookings/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// Update corporate booking (admin only)
router.put('/bookings/:id', [
  authenticateToken,
  requireAdmin,
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

    // Check if booking exists
    const existing = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    // Build update query dynamically
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
    if (drop_point !== undefined) {
      updates.push('drop_point = ?');
      values.push(drop_point);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
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

// Delete corporate booking (admin only)
router.delete('/bookings/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// Get available drivers based on pickup and drop locations (admin only)
router.post('/bookings/available-drivers', [
  authenticateToken,
  requireAdmin,
  body('pickup_point').notEmpty().withMessage('Pickup point is required'),
  body('drop_point').notEmpty().withMessage('Drop point is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickup_point, drop_point } = req.body;

    // Get all available registered drivers that are active
    const availableDrivers = await db.allAsync(
      `SELECT d.*
       FROM drivers d
       WHERE d.is_active = 1
       AND (d.id NOT IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1 AND is_available = 0
       ) OR d.id IN (
         SELECT DISTINCT driver_id 
         FROM cabs 
         WHERE driver_id IS NOT NULL AND is_active = 1 AND is_available = 1
       ))
       ORDER BY d.name ASC`
    );

    // For now, return all available drivers
    // In a production system, you could filter by proximity to pickup_point
    // using geocoding APIs (Google Maps, etc.)
    res.json({
      pickup_point,
      drop_point,
      available_drivers: availableDrivers,
      count: availableDrivers.length
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign driver to corporate booking (admin only)
router.post('/bookings/:id/assign-driver', [
  authenticateToken,
  requireAdmin,
  body('driver_id').isInt().withMessage('Driver ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { driver_id } = req.body;

    // Check if corporate booking exists
    const booking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    // Check if driver exists and is active
    const driver = await db.getAsync(
      'SELECT * FROM drivers WHERE id = ? AND is_active = 1',
      [driver_id]
    );

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found or inactive' });
    }

    // Update corporate booking with driver assignment
    await db.runAsync(
      `UPDATE corporate_bookings 
       SET driver_name = ?, driver_phone = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [driver.name, driver.phone, id]
    );

    // Get updated booking
    const updatedBooking = await db.getAsync(
      `SELECT cb.*, d.name as driver_name, d.phone as driver_phone
       FROM corporate_bookings cb
       LEFT JOIN drivers d ON cb.driver_name = d.name AND cb.driver_phone = d.phone
       WHERE cb.id = ?`,
      [id]
    );

    res.json({
      message: 'Driver assigned successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unassign driver from corporate booking (admin only)
router.post('/bookings/:id/unassign-driver', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Corporate booking not found' });
    }

    // Unassign driver
    await db.runAsync(
      `UPDATE corporate_bookings 
       SET cab_id = NULL, driver_name = NULL, driver_phone = NULL, assigned_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    // Mark cab as available again (if it was marked unavailable)
    if (booking.cab_id) {
      await db.runAsync('UPDATE cabs SET is_available = 1 WHERE id = ?', [booking.cab_id]);
    }

    const updatedBooking = await db.getAsync(
      'SELECT * FROM corporate_bookings WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Driver unassigned successfully',
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error unassigning driver:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


