const express = require('express');
const db = require('../db/database');
const { generateInvoicePDF } = require('../services/invoiceService');

const router = express.Router();

router.get('/:id/pdf', async (req, res) => {
  try {
    const token = req.query.token;
    const secret = process.env.INVOICE_PDF_SECRET;
    if (!secret || token !== secret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.params;
    const withGST = req.query.with_gst !== 'false';
    const booking = await db.getAsync(
      `SELECT b.*, ct.name as cab_type_name
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       WHERE b.id = ?`,
      [id]
    );
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const pdfBuffer = await generateInvoicePDF(booking, withGST);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}${withGST ? '-with-gst' : ''}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error serving invoice PDF:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
