#!/usr/bin/env node
/**
 * Test the driver-info n8n webhook: POST once and print response.
 * Run from backend: node scripts/test-driver-info-webhook.js
 * Use to debug 500 / no execution when workflow is active.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const base = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();
const url = (process.env.N8N_WEBHOOK_DRIVER_INFO_URL || '').trim() || (base ? `${base.replace(/\/$/, '')}/driver-info` : '');

if (!url) {
  console.error('N8N_WEBHOOK_DRIVER_INFO_URL (or N8N_WEBHOOK_BASE_URL) not set in .env');
  process.exit(1);
}

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

console.log('POST', url);
axios
  .post(url, payload, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  })
  .then((res) => {
    console.log('Status:', res.status, res.statusText);
    console.log('Body:', typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : res.data);
    if (res.status >= 400) {
      console.log('\nIf workflow is active and URL matches n8n Production URL, check n8n Executions and WEBHOOK_URL / proxy.');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Error:', err.message);
    if (err.code) console.error('Code:', err.code);
    process.exit(1);
  });
