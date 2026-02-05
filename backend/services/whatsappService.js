const https = require('https');
const querystring = require('querystring');

/**
 * Send WhatsApp message using UltraMsg API
 * @param {string} phone - Phone number with country code (e.g., +919876543210)
 * @param {string} message - Message text to send
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
const sendWhatsAppMessage = (phone, message) => {
  // Don't send WhatsApp if service is not configured
  console.log('[WhatsApp DEBUG] ULTRAMSG_API_URL:', process.env.ULTRAMSG_API_URL ? 'SET' : 'NOT SET');
  console.log('[WhatsApp DEBUG] ULTRAMSG_TOKEN:', process.env.ULTRAMSG_TOKEN ? 'SET (length: ' + process.env.ULTRAMSG_TOKEN.length + ')' : 'NOT SET');
  
  if (!process.env.ULTRAMSG_API_URL || !process.env.ULTRAMSG_TOKEN) {
    console.log('WhatsApp service not configured. Skipping WhatsApp send.');
    console.log('[WhatsApp DEBUG] Missing:', !process.env.ULTRAMSG_API_URL ? 'ULTRAMSG_API_URL' : '', !process.env.ULTRAMSG_TOKEN ? 'ULTRAMSG_TOKEN' : '');
    return Promise.resolve({ success: false, message: 'WhatsApp service not configured' });
  }

  return new Promise((resolve, reject) => {
    try {
      // Extract instance ID from ULTRAMSG_API_URL
      // Supports both formats:
      // - https://api.ultramsg.com/instance158421
      // - instance158421
      let instanceId = process.env.ULTRAMSG_API_URL;
      if (instanceId.includes('ultramsg.com')) {
        // Extract instance ID from full URL
        const match = instanceId.match(/\/instance\d+/);
        if (match) {
          instanceId = match[0].substring(1); // Remove leading slash
        }
      }

      const path = `/${instanceId}/messages/chat`;
      
      // Prepare POST data
      const postData = querystring.stringify({
        token: process.env.ULTRAMSG_TOKEN,
        to: phone,
        body: message
      });

      const options = {
        method: 'POST',
        hostname: 'api.ultramsg.com',
        port: null,
        path: path,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString();
            console.log('WhatsApp API response:', body);

            // Parse response if it's JSON
            let responseData;
            try {
              responseData = JSON.parse(body);
            } catch (e) {
              responseData = { body: body };
            }

            // Check if request was successful (status 200-299)
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`WhatsApp message sent successfully to ${phone}`);
              resolve({ success: true, message: 'WhatsApp message sent successfully', response: responseData });
            } else {
              console.error(`WhatsApp API error (${res.statusCode}):`, body);
              resolve({ success: false, error: `API error: ${res.statusCode}`, response: responseData });
            }
          } catch (error) {
            console.error('Error parsing WhatsApp API response:', error);
            resolve({ success: false, error: error.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error sending WhatsApp message:', error.message);
        console.error('WhatsApp API network error:', error);
        resolve({ success: false, error: error.message });
      });

      // Write POST data
      req.write(postData);
      req.end();

    } catch (error) {
      console.error('Error in sendWhatsAppMessage:', error);
      resolve({ success: false, error: error.message });
    }
  });
};

module.exports = {
  sendWhatsAppMessage,
};

