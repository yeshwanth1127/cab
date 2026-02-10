const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateEventInvoicePDF } = require('../services/invoiceService');

const router = express.Router();

router.post('/bookings', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone_number').notEmpty().withMessage('Phone number is required'),
  body('event_type').isIn(['weddings', 'birthdays', 'others']).withMessage('Invalid event type'),
  body('pickup_point').notEmpty().withMessage('Pickup point is required'),
  body('drop_point').notEmpty().withMessage('Drop point is required'),
  body('pickup_date').notEmpty().withMessage('Pickup date is required'),
  body('pickup_time').notEmpty().withMessage('Pickup time is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone_number, event_type, pickup_point, drop_point, pickup_date, pickup_time, notes, pickup_lat, pickup_lng, drop_lat, drop_lng, number_of_cars } = req.body;

    const result = await db.runAsync(
      `INSERT INTO event_bookings (name, phone_number, event_type, pickup_point, drop_point, pickup_date, pickup_time, notes, pickup_lat, pickup_lng, drop_lat, drop_lng, number_of_cars)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone_number, event_type, pickup_point, drop_point, pickup_date, pickup_time, notes || null, pickup_lat || null, pickup_lng || null, drop_lat || null, drop_lng || null, number_of_cars || 1]
    );

    const newBooking = await db.getAsync(
      'SELECT * FROM event_bookings WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating event booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/bookings', async (req, res) => {
  try {
    const bookings = await db.allAsync(
      `SELECT eb.*, c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone, ct.name as cab_type_name
       FROM event_bookings eb
       LEFT JOIN cabs c ON eb.cab_id = c.id
       LEFT JOIN cab_types ct ON c.cab_type_id = ct.id
       ORDER BY eb.created_at DESC`
    );
    

    for (let booking of bookings) {
      const assignments = await db.allAsync(
        `SELECT eba.*, c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone,
                d.name as driver_name, d.phone as driver_phone
         FROM event_booking_assignments eba
         LEFT JOIN cabs c ON eba.cab_id = c.id
         LEFT JOIN drivers d ON eba.driver_id = d.id
         WHERE eba.event_booking_id = ?
         ORDER BY eba.id ASC`,
        [booking.id]
      );
      booking.assignments = assignments;
    }
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching event bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getAsync(
      'SELECT * FROM event_bookings WHERE id = ?',
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Event booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching event booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/bookings/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getAsync(
      'SELECT * FROM event_bookings WHERE id = ?',
      [id]
    );
    if (!booking) {
      return res.status(404).json({ error: 'Event booking not found' });
    }
    const assignments = await db.allAsync(
      `SELECT eba.*, c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone,
              d.name as driver_name, d.phone as driver_phone
       FROM event_booking_assignments eba
       LEFT JOIN cabs c ON eba.cab_id = c.id
       LEFT JOIN drivers d ON eba.driver_id = d.id
       WHERE eba.event_booking_id = ?
       ORDER BY eba.id ASC`,
      [id]
    );
    const eventBooking = { ...booking, assignments };
    const pdfBuffer = await generateEventInvoicePDF(eventBooking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="event-booking-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating event booking invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/bookings/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone_number').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('event_type').optional().isIn(['weddings', 'birthdays', 'others']).withMessage('Invalid event type'),
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
    const { name, phone_number, event_type, pickup_point, drop_point, status, notes } = req.body;

    const existing = await db.getAsync(
      'SELECT * FROM event_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Event booking not found' });
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
    if (event_type !== undefined) {
      updates.push('event_type = ?');
      values.push(event_type);
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
      `UPDATE event_bookings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.getAsync(
      'SELECT * FROM event_bookings WHERE id = ?',
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error updating event booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.getAsync(
      'SELECT * FROM event_bookings WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Event booking not found' });
    }

    await db.runAsync('DELETE FROM event_bookings WHERE id = ?', [id]);

    res.json({ message: 'Event booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting event booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bookings/:id/assign', [
  body('assignments').isArray().withMessage('Assignments must be an array'),
  body('assignments.*.cab_id').optional({ nullable: true }).isInt().withMessage('cab_id must be integer'),
  body('assignments.*.driver_id').optional({ nullable: true }).isInt().withMessage('driver_id must be integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { assignments } = req.body;

    const booking = await db.getAsync('SELECT * FROM event_bookings WHERE id = ?', [id]);
    if (!booking) {
      return res.status(404).json({ error: 'Event booking not found' });
    }

    await db.runAsync('DELETE FROM event_booking_assignments WHERE event_booking_id = ?', [id]);

    for (const assignment of assignments) {
      let driverName = null;
      let driverPhone = null;
      
      if (assignment.driver_id) {
        const driver = await db.getAsync('SELECT * FROM drivers WHERE id = ?', [assignment.driver_id]);
        if (!driver) {
          return res.status(404).json({ error: `Driver with id ${assignment.driver_id} not found` });
        }
        driverName = driver.name;
        driverPhone = driver.phone;
      }

      if (assignment.cab_id) {
        const cab = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [assignment.cab_id]);
        if (!cab) {
          return res.status(404).json({ error: `Cab with id ${assignment.cab_id} not found` });
        }
      }

      await db.runAsync(
        `INSERT INTO event_booking_assignments (event_booking_id, cab_id, driver_id, driver_name, driver_phone)
         VALUES (?, ?, ?, ?, ?)`,
        [id, assignment.cab_id || null, assignment.driver_id || null, driverName, driverPhone]
      );
    }

    await db.runAsync(
      `UPDATE event_bookings SET status = 'confirmed', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    const updated = await db.getAsync('SELECT * FROM event_bookings WHERE id = ?', [id]);
    const updatedAssignments = await db.allAsync(
      `SELECT eba.*, c.vehicle_number, c.driver_name as cab_driver_name, c.driver_phone as cab_driver_phone,
              d.name as driver_name, d.phone as driver_phone
       FROM event_booking_assignments eba
       LEFT JOIN cabs c ON eba.cab_id = c.id
       LEFT JOIN drivers d ON eba.driver_id = d.id
       WHERE eba.event_booking_id = ?
       ORDER BY eba.id ASC`,
      [id]
    );
    updated.assignments = updatedAssignments;

    res.json(updated);
  } catch (error) {
    console.error('Error assigning cars/drivers to event booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
