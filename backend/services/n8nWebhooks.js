const axios = require('axios');

const BASE = process.env.N8N_WEBHOOK_BASE_URL || '';

function post(path, payload) {
  if (!BASE || typeof BASE !== 'string' || !BASE.trim()) return;
  const url = `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  axios
    .post(url, payload, { timeout: 5000 })
    .catch((err) => console.error('n8n webhook error', url, err.message));
}

function triggerBookingSuccess(payload) {
  post('booking-success', payload);
}

function triggerDriverInfo(payload) {
  post('driver-info', payload);
}

function triggerInvoiceGenerated(payload) {
  post('invoice-generated', payload);
}

module.exports = {
  triggerBookingSuccess,
  triggerDriverInfo,
  triggerInvoiceGenerated,
};
