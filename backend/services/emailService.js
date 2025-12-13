const nodemailer = require('nodemailer');

// Create transporter based on environment variables
const createTransporter = () => {
  // For Gmail
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
      },
    });
  }

  // For SMTP (generic)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const sendBookingConfirmationEmail = async (booking) => {
  // Don't send email if email service is not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email service not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const transporter = createTransporter();

    const statusMessages = {
      pending: 'Your booking is pending confirmation.',
      confirmed: 'Your booking has been confirmed!',
      in_progress: 'Your cab is on the way!',
      completed: 'Your ride has been completed. Thank you!',
      cancelled: 'Your booking has been cancelled.',
    };

    const statusMessage = statusMessages[booking.booking_status] || statusMessages.pending;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Cab Booking System'}" <${process.env.EMAIL_USER}>`,
      to: booking.passenger_email,
      subject: `Booking Confirmation - Booking ID: ${booking.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-id { font-size: 24px; font-weight: bold; color: #007bff; margin: 20px 0; }
            .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .status { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; margin: 10px 0; }
            .status.pending { background: #ffc107; }
            .status.confirmed { background: #28a745; }
            .status.in_progress { background: #007bff; }
            .status.completed { background: #6c757d; }
            .status.cancelled { background: #dc3545; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚕 Cab Booking Confirmation</h1>
            </div>
            <div class="content">
              <p>Dear ${booking.passenger_name},</p>
              
              <p>Thank you for booking with us! Your booking has been confirmed.</p>
              
              <div style="text-align: center;">
                <div class="booking-id">Booking ID: ${booking.id}</div>
                <div class="status ${booking.booking_status}">
                  ${booking.booking_status.replace('_', ' ').toUpperCase()}
                </div>
              </div>
              
              <p><strong>${statusMessage}</strong></p>
              
              <h3>Booking Details:</h3>
              
              ${booking.service_type === 'outstation' ? (
                booking.trip_type ? `
              <div class="info-row">
                <span class="label">Trip Type:</span>
                <span class="value">${
                  booking.trip_type === 'one_way' ? 'One Way Trip' :
                  booking.trip_type === 'round_trip' ? 'Round Trip' :
                  booking.trip_type === 'multiple_way' ? 'Multiple Way' :
                  booking.trip_type
                }</span>
              </div>
              ` : ''
              ) : `
              <div class="info-row">
                <span class="label">From:</span>
                <span class="value">${booking.from_location || 'N/A'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">To:</span>
                <span class="value">${booking.to_location || 'N/A'}</span>
              </div>
              `}
              
              <div class="info-row">
                <span class="label">Service Type:</span>
                <span class="value">${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Cab Type:</span>
                <span class="value">${booking.cab_type_name || 'N/A'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Distance:</span>
                <span class="value">${booking.distance_km} km</span>
              </div>
              
              <div class="info-row">
                <span class="label">Estimated Time:</span>
                <span class="value">${booking.estimated_time_minutes} minutes</span>
              </div>
              
              <div class="info-row" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 18px;">
                <span class="label">Total Fare:</span>
                <span class="value" style="font-weight: bold;">₹${booking.fare_amount}</span>
              </div>
              
              ${booking.travel_date ? `
              <div class="info-row">
                <span class="label">Travel Date & Time:</span>
                <span class="value">${new Date(booking.travel_date).toLocaleString()}</span>
              </div>
              ` : ''}
              
              ${booking.vehicle_number ? `
              <div class="info-row">
                <span class="label">Vehicle Number:</span>
                <span class="value">${booking.vehicle_number}</span>
              </div>
              ` : ''}
              
              ${booking.driver_name ? `
              <div class="info-row">
                <span class="label">Driver Name:</span>
                <span class="value">${booking.driver_name}</span>
              </div>
              ` : ''}
              
              ${booking.driver_phone ? `
              <div class="info-row">
                <span class="label">Driver Phone:</span>
                <span class="value">${booking.driver_phone}</span>
              </div>
              ` : ''}
              
              ${booking.notes ? `
              <div class="info-row">
                <span class="label">Special Instructions:</span>
                <span class="value">${booking.notes}</span>
              </div>
              ` : ''}
              
              <p style="margin-top: 30px;">
                You can check your booking status anytime by visiting:<br>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/check-booking?id=${booking.id}" 
                   style="color: #007bff; text-decoration: none;">
                  ${process.env.FRONTEND_URL || 'http://localhost:3000'}/check-booking?id=${booking.id}
                </a>
              </p>
              
              <p>If you have any questions, please contact us.</p>
              
              <p>Best regards,<br>Cab Booking System</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Cab Booking Confirmation
        
        Dear ${booking.passenger_name},
        
        Thank you for booking with us! Your booking has been confirmed.
        
        Booking ID: ${booking.id}
        Status: ${booking.booking_status}
        
        ${statusMessage}
        
        Booking Details:
        Service Type: ${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}
        ${booking.service_type === 'outstation' && booking.trip_type ? 
          `Trip Type: ${
            booking.trip_type === 'one_way' ? 'One Way Trip' :
            booking.trip_type === 'round_trip' ? 'Round Trip' :
            booking.trip_type === 'multiple_way' ? 'Multiple Way' :
            booking.trip_type
          }` :
          `From: ${booking.from_location || 'N/A'}\n        To: ${booking.to_location || 'N/A'}`
        }
        Cab Type: ${booking.cab_type_name || 'N/A'}
        Distance: ${booking.distance_km} km
        Estimated Time: ${booking.estimated_time_minutes} minutes
        Total Fare: ₹${booking.fare_amount}
        ${booking.travel_date ? `Travel Date: ${new Date(booking.travel_date).toLocaleString()}` : ''}
        ${booking.vehicle_number ? `Vehicle Number: ${booking.vehicle_number}` : ''}
        ${booking.driver_name ? `Driver Name: ${booking.driver_name}` : ''}
        ${booking.driver_phone ? `Driver Phone: ${booking.driver_phone}` : ''}
        
        Check your booking: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/check-booking?id=${booking.id}
        
        Best regards,
        Cab Booking System
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendBookingConfirmationEmail,
};

