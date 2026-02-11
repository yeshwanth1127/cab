const https = require('https');

/** Normalize phone for WhatsApp (e.g. Indian: 91 + 10 digits). E.164-style for Meta API. */
function normalizePhoneForWhatsApp(phone) {
  if (phone == null || String(phone).trim() === '') return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 10) return `91${digits}`;
  return digits;
}

function formatTravelDateForMessage(travelDate) {
  if (!travelDate) return '';
  const d = new Date(travelDate);
  if (Number.isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = String(mins).padStart(2, '0');
  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${dateStr}, ${h}:${m} ${ampm}`;
}

/**
 * Send booking confirmation to customer via WhatsApp.
 * Booking object: passenger_phone, passenger_name, from_location, to_location, fare_amount, travel_date, id, invoice_number.
 * Skips if WhatsApp not configured or SEND_WHATSAPP_ON_BOOKING=0.
 */
function sendBookingConfirmation(booking) {
  const enabled = process.env.SEND_WHATSAPP_ON_BOOKING !== '0';
  if (!enabled) return Promise.resolve({ success: false, message: 'WhatsApp booking messages disabled' });
  const phone = (booking.passenger_phone || booking.PASSENGER_PHONE || '').trim();
  if (!phone) {
    console.log('[WhatsApp] No passenger_phone for booking confirmation, skipping.');
    return Promise.resolve({ success: false, message: 'No passenger phone' });
  }
  const num = normalizePhoneForWhatsApp(phone);
  const name = (booking.passenger_name || booking.PASSENGER_NAME || '').trim() || 'Customer';
  const from = (booking.from_location || booking.FROM_LOCATION || '').trim() || '—';
  const to = (booking.to_location || booking.TO_LOCATION || '').trim() || '—';
  const fare = booking.fare_amount != null ? booking.fare_amount : (booking.FARE_AMOUNT != null ? booking.FARE_AMOUNT : '');
  const timeStr = formatTravelDateForMessage(booking.travel_date || booking.TRAVEL_DATE);
  const bookingId = 'NC' + (booking.id ?? booking.ID);
  const invoice = (booking.invoice_number || booking.INVOICE_NUMBER || '').trim() || bookingId;
  const message = [
    `Hi ${name}!`,
    '',
    `Your cab booking is confirmed.`,
    '',
    `Booking ID: ${bookingId}`,
    `Invoice: ${invoice}`,
    `From: ${from}`,
    `To: ${to}`,
    timeStr ? `Date & Time: ${timeStr}` : '',
    fare !== '' ? `Fare: ₹${fare}` : '',
    '',
    'Thank you for choosing Namma Cabs!',
  ].filter(Boolean).join('\n');
  return sendWhatsAppMessage(num, message);
}

/**
 * Send driver info to customer via WhatsApp when admin assigns a driver.
 * Payload: { bookingId, driverName, driverPhone, cabNumber, pickup, drop, pickupTime }.
 * Skips if WhatsApp not configured or SEND_WHATSAPP_DRIVER_INFO=0.
 */
function sendDriverInfoToCustomerWhatsApp(customerPhone, payload) {
  const enabled = process.env.SEND_WHATSAPP_DRIVER_INFO !== '0';
  if (!enabled) return Promise.resolve({ success: false, message: 'WhatsApp driver info disabled' });
  const phone = (customerPhone || '').trim();
  if (!phone) {
    console.log('[WhatsApp] No customer phone for driver info, skipping.');
    return Promise.resolve({ success: false, message: 'No customer phone' });
  }
  const num = normalizePhoneForWhatsApp(phone);
  const bookingId = payload.bookingId || 'NC';
  const driverName = (payload.driverName || '').trim() || 'Driver';
  const driverPhone = (payload.driverPhone || '').trim();
  const cabNumber = (payload.cabNumber || '').trim();
  const pickup = (payload.pickup || '').trim() || '—';
  const drop = (payload.drop || '').trim() || '—';
  let pickupTime = (payload.pickupTime || '').trim();
  if (pickupTime && /^\d{4}-\d{2}-\d{2}/.test(pickupTime)) {
    pickupTime = formatTravelDateForMessage(pickupTime);
  }
  const message = [
    'Your driver has been assigned!',
    '',
    `Booking ID: ${bookingId}`,
    `Driver: ${driverName}`,
    driverPhone ? `Driver contact: ${driverPhone}` : '',
    cabNumber ? `Vehicle: ${cabNumber}` : '',
    `Pickup: ${pickup}`,
    `Drop: ${drop}`,
    pickupTime ? `Time: ${pickupTime}` : '',
    '',
    'Thank you, Namma Cabs',
  ].filter(Boolean).join('\n');
  return sendWhatsAppMessage(num, message);
}

/** Check if WhatsApp Business API (Meta) is configured. */
function isWhatsAppConfigured() {
  const id = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  return id && token;
}

/**
 * Send a text message via Meta WhatsApp Business Cloud API.
 * https://developers.facebook.com/docs/whatsapp/cloud-api
 * Requires: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN.
 * Optional: WHATSAPP_API_VERSION (default v21.0).
 */
function sendWhatsAppMessage(phone, message) {
  if (!phone || !String(message).trim()) {
    return Promise.resolve({ success: false, message: 'Missing phone or message' });
  }

  if (!isWhatsAppConfigured()) {
    console.log('WhatsApp Business API not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    return Promise.resolve({ success: false, message: 'WhatsApp not configured' });
  }

  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  let version = (process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  if (!version.startsWith('v')) version = 'v' + version;

  const postData = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone.replace(/\D/g, ''),
    type: 'text',
    text: {
      body: message,
      preview_url: false,
    },
  });

  const path = `/${version}/${phoneNumberId}/messages`;
  const options = {
    method: 'POST',
    hostname: 'graph.facebook.com',
    path,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData, 'utf8'),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        if (process.env.DEBUG_WHATSAPP === '1') console.log('[WhatsApp Business API] response:', body);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = { body };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`WhatsApp message sent to ${phone}`);
          resolve({ success: true, message: 'WhatsApp message sent', response: parsed });
        } else {
          console.error(`WhatsApp Business API error (${res.statusCode}):`, body);
          resolve({ success: false, error: `API ${res.statusCode}`, response: parsed });
        }
      });
    });
    req.on('error', (err) => {
      console.error('WhatsApp Business API request error:', err.message);
      resolve({ success: false, error: err.message });
    });
    req.write(postData, 'utf8');
    req.end();
  });
}

module.exports = {
  sendWhatsAppMessage,
  normalizePhoneForWhatsApp,
  sendBookingConfirmation,
  sendDriverInfoToCustomerWhatsApp,
};
