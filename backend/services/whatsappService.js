const https = require('https');
const querystring = require('querystring');

const sendWhatsAppMessage = (phone, message) => {

  console.log('[WhatsApp DEBUG] ULTRAMSG_API_URL:', process.env.ULTRAMSG_API_URL ? 'SET' : 'NOT SET');
  console.log('[WhatsApp DEBUG] ULTRAMSG_TOKEN:', process.env.ULTRAMSG_TOKEN ? 'SET (length: ' + process.env.ULTRAMSG_TOKEN.length + ')' : 'NOT SET');
  
  if (!process.env.ULTRAMSG_API_URL || !process.env.ULTRAMSG_TOKEN) {
    console.log('WhatsApp service not configured. Skipping WhatsApp send.');
    console.log('[WhatsApp DEBUG] Missing:', !process.env.ULTRAMSG_API_URL ? 'ULTRAMSG_API_URL' : '', !process.env.ULTRAMSG_TOKEN ? 'ULTRAMSG_TOKEN' : '');
    return Promise.resolve({ success: false, message: 'WhatsApp service not configured' });
  }

  return new Promise((resolve, reject) => {
    try {

      let instanceId = process.env.ULTRAMSG_API_URL;
      if (instanceId.includes('ultramsg.com')) {

        const match = instanceId.match(/\/instance\d+/);
        if (match) {
          instanceId = match[0].substring(1);
        }
      }

      const path = `/${instanceId}/messages/chat`;
      

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

            let responseData;
            try {
              responseData = JSON.parse(body);
            } catch (e) {
              responseData = { body: body };
            }

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
