const axios = require('axios');

const BASE = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();

function getUrl(fullUrlEnv, path) {
  const full = (process.env[fullUrlEnv] || '').trim();
  if (full && full.startsWith('http')) return full;
  if (!BASE) return '';
  return `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function post(fullUrlEnv, path, payload) {
  const url = getUrl(fullUrlEnv, path);
  if (!url) return;
  axios
    .post(url, payload, { timeout: 5000 })
    .catch((err) => console.error('n8n webhook error', url, err.message));
}

function triggerBookingSuccess(payload) {
  post('N8N_WEBHOOK_BOOKING_SUCCESS_URL', 'booking-success', payload);
}

// Payload may include sendDriverInfoToCustomer (true = email customer on assign) and sendTripToDriver (true = email driver when admin clicks "Send email to driver").
function triggerDriverInfo(payload) {
  post('N8N_WEBHOOK_DRIVER_INFO_URL', 'driver-info', payload);
}

function triggerInvoiceGenerated(payload) {
  post('N8N_WEBHOOK_INVOICE_GENERATED_URL', 'invoice-generated', payload);
}

module.exports = {
  triggerBookingSuccess,
  triggerDriverInfo,
  triggerInvoiceGenerated,
};
