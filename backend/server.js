const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env before database so DATABASE_PATH is set when db/database.js runs
dotenv.config({ path: path.join(__dirname, '.env') });

const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/api/uploads', express.static(uploadsDir));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/cabs', require('./routes/cabs'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/car-options', require('./routes/carOptions'));
app.use('/api/corporate', require('./routes/corporate'));
app.use('/api/events', require('./routes/events'));
app.use('/api/address', require('./routes/address'));
app.use('/api/places', require('./routes/places'));
app.use('/api/invoices', require('./routes/invoices'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/api/debug/n8n-webhooks', (req, res) => {
  const base = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();
  const bookingSuccess = (process.env.N8N_WEBHOOK_BOOKING_SUCCESS_URL || '').trim() || (base ? `${base.replace(/\/$/, '')}/booking-success` : '');
  const driverInfo = (process.env.N8N_WEBHOOK_DRIVER_INFO_URL || '').trim() || (base ? `${base.replace(/\/$/, '')}/driver-info` : '');
  const invoiceGenerated = (process.env.N8N_WEBHOOK_INVOICE_GENERATED_URL || '').trim() || (base ? `${base.replace(/\/$/, '')}/invoice-generated` : '');
  res.json({
    configured: true,
    urls: {
      bookingSuccess: bookingSuccess || '(not set)',
      driverInfo: driverInfo || '(not set)',
      invoiceGenerated: invoiceGenerated || '(not set)',
    },
  });
});

// POST to driver-info webhook and return n8n response (for debugging 500 / no execution)
app.post('/api/debug/n8n-driver-info-test', async (req, res) => {
  const base = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();
  const url = (process.env.N8N_WEBHOOK_DRIVER_INFO_URL || '').trim() || (base ? `${base.replace(/\/$/, '')}/driver-info` : '');
  if (!url) {
    return res.status(400).json({ error: 'N8N_WEBHOOK_DRIVER_INFO_URL not set' });
  }
  const axios = require('axios');
  const payload = {
    bookingId: 'NC-debug',
    customerEmail: '',
    driverEmail: 'driver@example.com',
    driverName: 'Test Driver',
    driverPhone: '9999999999',
    cabNumber: 'KA01AB1234',
    pickup: 'Test Pickup',
    drop: 'Test Drop',
    pickupTime: new Date().toISOString(),
    sendDriverInfoToCustomer: false,
    sendTripToDriver: true,
  };
  try {
    const webhookRes = await axios.post(url, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
    res.json({
      url,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
      headers: webhookRes.headers ? { 'content-type': webhookRes.headers['content-type'] } : {},
      body: webhookRes.data,
    });
  } catch (err) {
    res.status(502).json({
      url,
      error: err.message,
      code: err.code || null,
    });
  }
});

const frontendBuild = process.env.FRONTEND_BUILD_PATH
  ? path.resolve(process.env.FRONTEND_BUILD_PATH)
  : path.join(__dirname, '../frontend/build');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  const n8nBase = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();
  const n8nDriver = (process.env.N8N_WEBHOOK_DRIVER_INFO_URL || '').trim() || (n8nBase ? `${n8nBase.replace(/\/$/, '')}/driver-info` : '');
  const n8nInvoice = (process.env.N8N_WEBHOOK_INVOICE_GENERATED_URL || '').trim() || (n8nBase ? `${n8nBase.replace(/\/$/, '')}/invoice-generated` : '');
  if (n8nBase || n8nDriver || n8nInvoice) {
    console.log('[n8n] Webhooks:', n8nDriver ? 'driver-info ✓' : 'driver-info ✗', n8nInvoice ? 'invoice-generated ✓' : 'invoice-generated ✗');
    if (n8nDriver) console.log('[n8n] driver-info URL:', n8nDriver);
  }
});

process.on('SIGINT', async () => {
  try {
    if (typeof db.close === 'function') {
      await db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
      });
    } else if (db.pool) {

      await db.pool.end();
      console.log('MySQL connection pool closed');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;
