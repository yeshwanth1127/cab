const axios = require('axios');

const DEBUG = process.env.DEBUG_N8N === '1' || process.env.DEBUG_N8N === 'true';

function getUrl(fullUrlEnv, path) {
  const base = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();
  const full = (process.env[fullUrlEnv] || '').trim();
  if (full && full.startsWith('http')) return full;
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function post(fullUrlEnv, path, payload) {
  const url = getUrl(fullUrlEnv, path);
  if (!url) {
    console.warn('[n8n] Webhook not configured:', fullUrlEnv, '- set', fullUrlEnv, 'or N8N_WEBHOOK_BASE_URL in .env');
    return;
  }
  if (DEBUG) console.log('[n8n] Triggering', path, '->', url, payload);
  axios
    .post(url, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    })
    .then((res) => {
      if (res && res.status >= 400) {
        const body = res.data;
        const bodyPreview = body != null && typeof body === 'object'
          ? JSON.stringify(body).slice(0, 500)
          : String(body).slice(0, 500);
        console.warn('[n8n] Webhook returned', res.status, url, '- check n8n workflow');
        if (res.status === 500 && bodyPreview) console.warn('[n8n] Response body:', bodyPreview);
      } else if (DEBUG) console.log('[n8n] Webhook OK:', url);
    })
    .catch((err) => console.error('[n8n] Webhook error', url, err.message));
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
