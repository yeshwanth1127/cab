const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateCorporateInvoicePDF } = require('../services/invoiceService');

const router = express.Router();

async function ensureCorporateBookingsFareColumn() {
  try {
    await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN fare_amount REAL');
  } catch (e) {
    // Column already exists, ignore
  }
}

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
       LEFT JOIN cabs c ON c.id = cb.cab_id
       LEFT JOIN cab_types ct ON ct.id = c.cab_type_id
       ORDER BY cb.created_at DESC`
    );
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching corporate bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single corporate booking invoice PDF (must be before /bookings/:id)
router.get('/bookings/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const withGst = req.query.withGst !== 'false';
    const booking = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [id]);
    if (!booking) return res.status(404).json({ error: 'Corporate booking not found' });
    const pdfBuffer = await generateCorporateInvoicePDF(booking, withGst);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="corporate-invoice-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating corporate invoice:', error);
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

// Create corporate invoice: create corporate booking + return PDF
router.post('/invoice/create', [
  body('company_name').notEmpty().withMessage('company_name is required'),
  body('name').notEmpty().withMessage('name is required'),
  body('phone_number').notEmpty().withMessage('phone_number is required'),
  body('pickup_point').notEmpty().withMessage('pickup_point is required'),
  body('drop_point').notEmpty().withMessage('drop_point is required'),
  body('fare_amount').isFloat({ min: 0 }).withMessage('fare_amount must be a positive number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    await ensureCorporateBookingsFareColumn();

    const { company_name, name, phone_number, pickup_point, drop_point, service_type, fare_amount, travel_date, travel_time, with_gst } = req.body;

    const result = await db.runAsync(
      `INSERT INTO corporate_bookings (name, phone_number, company_name, pickup_point, drop_point, service_type, travel_date, travel_time, fare_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        name,
        phone_number,
        company_name,
        pickup_point,
        drop_point || 'N/A',
        service_type || 'local',
        travel_date || null,
        travel_time || null,
        Number(fare_amount),
      ]
    );
    const booking = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [result.lastID]);
    const withGST = with_gst !== false;
    const pdfBuffer = await generateCorporateInvoicePDF(booking, withGST);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="corporate-invoice-${booking.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error creating corporate invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download all corporate invoices as ZIP
router.get('/invoices/download-all', async (req, res) => {
  try {
    const withGst = req.query.withGst !== 'false';
    const bookings = await db.allAsync('SELECT * FROM corporate_bookings ORDER BY id ASC');
    if (bookings.length === 0) {
      return res.status(404).json({ error: 'No corporate bookings to export' });
    }

    let archiver;
    try {
      archiver = require('archiver');
    } catch (e) {
      return res.status(503).json({ error: 'Download all requires archiver. Run: npm install archiver' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="corporate-invoices.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to create ZIP' });
    });
    archive.pipe(res);

    for (const booking of bookings) {
      const pdfBuffer = await generateCorporateInvoicePDF(booking, withGst);
      archive.append(pdfBuffer, { name: `corporate-invoice-${booking.id}.pdf` });
    }
    await archive.finalize();
  } catch (error) {
    console.error('Error downloading all corporate invoices:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
