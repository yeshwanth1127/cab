const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateCorporateInvoicePDF } = require('../services/invoiceService');
const { triggerDriverInfo } = require('../services/n8nWebhooks');

const router = express.Router();

async function ensureCorporateBookingsFareColumn() {
  try {
    await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN fare_amount REAL');
  } catch (e) {

  }
}

async function ensureCorporateBookingsInvoiceNumberColumn() {
  try {
    await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN invoice_number TEXT');
  } catch (e) {

  }
}

async function ensureCorporateBookingsCabIdColumn() {
  try {
    await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN cab_id INTEGER');
  } catch (e) {

  }
}

async function ensureCabsCorporateOnlyColumn() {
  try {
    await db.runAsync('ALTER TABLE cabs ADD COLUMN corporate_only INTEGER DEFAULT 0');
  } catch (e) {

  }
}

async function generateCorporateInvoiceNumber() {
  await ensureCorporateBookingsInvoiceNumberColumn();
  const today = new Date();
  const prefix = 'crp' + today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
  const row = await db.getAsync(
    "SELECT invoice_number FROM corporate_bookings WHERE invoice_number IS NOT NULL AND invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1",
    [prefix + '%']
  );
  let next = 1;
  if (row && row.invoice_number) {
    const match = row.invoice_number.slice(prefix.length);
    const num = parseInt(match, 10);
    if (!Number.isNaN(num)) next = num + 1;
  }
  return prefix + String(next).padStart(4, '0');
}

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

    try {
      await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN service_type TEXT');
    } catch (e) {

    }
    try {
      await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN travel_date TEXT');
    } catch (e) {

    }
    try {
      await db.runAsync('ALTER TABLE corporate_bookings ADD COLUMN travel_time TEXT');
    } catch (e) {

    }
    

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

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/cabs', async (req, res) => {
  try {
    await ensureCabsCorporateOnlyColumn();
    const rows = await db.allAsync(
      `SELECT c.id, c.vehicle_number, c.name, c.driver_id, c.driver_name, c.driver_phone, c.cab_type_id
       FROM cabs c
       WHERE c.is_active = 1 AND COALESCE(c.corporate_only, 0) = 1
       ORDER BY c.vehicle_number`
    );
    const cabs = (rows || []).map((r) => ({
      id: r.id,
      vehicle_number: r.vehicle_number ?? '',
      name: r.name ?? null,
      driver_id: r.driver_id ?? null,
      driver_name: r.driver_name ?? '',
      driver_phone: r.driver_phone ?? '',
      cab_type_id: r.cab_type_id ?? null,
    }));
    res.json(cabs);
  } catch (error) {
    console.error('Error fetching corporate cabs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/cabs', [
  body('vehicle_number').notEmpty().trim().withMessage('Vehicle number is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    await ensureCabsCorporateOnlyColumn();
    const { vehicle_number, name, driver_name, driver_phone } = req.body;
    const vn = String(vehicle_number).trim();
    const existing = await db.getAsync('SELECT id FROM cabs WHERE vehicle_number = ?', [vn]);
    if (existing) return res.status(400).json({ error: 'This vehicle number is already used.' });
    const firstType = await db.getAsync('SELECT id FROM cab_types WHERE is_active = 1 LIMIT 1');
    const cabTypeId = firstType ? firstType.id : null;
    const r = await db.runAsync(
      `INSERT INTO cabs (cab_type_id, vehicle_number, driver_name, driver_phone, name, corporate_only) VALUES (?, ?, ?, ?, ?, 1)`,
      [cabTypeId, vn, driver_name || null, driver_phone || null, name || null]
    );
    const row = await db.getAsync('SELECT * FROM cabs WHERE id = ?', [r.lastID]);
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creating corporate cab:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/bookings', async (req, res) => {
  try {
    await ensureCorporateBookingsCabIdColumn();
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

router.get('/bookings/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const withGst = req.query.withGst !== 'false';
    await ensureCorporateBookingsInvoiceNumberColumn();
    await ensureCorporateBookingsFareColumn();
    let booking = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [id]);
    if (!booking) return res.status(404).json({ error: 'Corporate booking not found' });
    if (!booking.invoice_number) {
      const invNum = await generateCorporateInvoiceNumber();
      await db.runAsync('UPDATE corporate_bookings SET invoice_number = ? WHERE id = ?', [invNum, id]);
      booking = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [id]);
    }
    const pdfBuffer = await generateCorporateInvoicePDF(booking, withGst);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="corporate-invoice-${booking.invoice_number || id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating corporate invoice:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Server error' });
  }
});

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
    if (req.body.invoice_number !== undefined) {
      updates.push('invoice_number = ?');
      values.push(req.body.invoice_number === '' ? null : req.body.invoice_number);
    }
    if (req.body.cab_id !== undefined) {
      updates.push('cab_id = ?');
      values.push(req.body.cab_id ? Number(req.body.cab_id) : null);
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

    if (req.body.cab_id) {
      const cab = await db.getAsync('SELECT vehicle_number, driver_name, driver_phone FROM cabs WHERE id = ?', [req.body.cab_id]);
      if (cab) {
        triggerDriverInfo({
          bookingId: 'CRP' + id,
          customerEmail: '',
          driverEmail: '',
          driverName: cab.driver_name || '',
          driverPhone: cab.driver_phone || '',
          cabNumber: cab.vehicle_number || '',
        });
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating corporate booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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
    await ensureCorporateBookingsInvoiceNumberColumn();

    const { company_name, name, phone_number, pickup_point, drop_point, service_type, fare_amount, travel_date, travel_time, with_gst, invoice_number: bodyInvoiceNumber } = req.body;
    const invoice_number = (bodyInvoiceNumber && String(bodyInvoiceNumber).trim()) ? String(bodyInvoiceNumber).trim() : await generateCorporateInvoiceNumber();

    const result = await db.runAsync(
      `INSERT INTO corporate_bookings (name, phone_number, company_name, pickup_point, drop_point, service_type, travel_date, travel_time, fare_amount, invoice_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
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
        invoice_number,
      ]
    );
    const booking = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [result.lastID]);
    const withGST = with_gst !== false;
    const pdfBuffer = await generateCorporateInvoicePDF(booking, withGST);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="corporate-invoice-${booking.invoice_number || booking.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error creating corporate invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

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

    await ensureCorporateBookingsInvoiceNumberColumn();

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to create ZIP' });
    });
    archive.pipe(res);

    for (const booking of bookings) {
      let b = booking;
      if (!b.invoice_number) {
        const invNum = await generateCorporateInvoiceNumber();
        await db.runAsync('UPDATE corporate_bookings SET invoice_number = ? WHERE id = ?', [invNum, b.id]);
        b = await db.getAsync('SELECT * FROM corporate_bookings WHERE id = ?', [b.id]);
      }
      const pdfBuffer = await generateCorporateInvoicePDF(b, withGst);
      archive.append(pdfBuffer, { name: `corporate-invoice-${b.invoice_number || b.id}.pdf` });
    }
    await archive.finalize();
  } catch (error) {
    console.error('Error downloading all corporate invoices:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
