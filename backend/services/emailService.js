const nodemailer = require('nodemailer');

// Create transporter based on environment variables
const createTransporter = () => {
  // Clean email password (remove spaces, trim whitespace)
  // Gmail app passwords are 16 characters without spaces, even though Google displays them with spaces
  const emailPassword = process.env.EMAIL_PASSWORD ? 
    process.env.EMAIL_PASSWORD.trim().replace(/\s+/g, '') : null;
  
  const emailUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;

  // For Gmail
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword, // Use App Password for Gmail
      },
    });
  }

  // For SMTP (generic)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

const sendBookingConfirmationEmail = async (booking) => {
  // Don't send email if email service is not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email service not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  // Validate booking email
  if (!booking.passenger_email) {
    console.log('Booking has no passenger email. Skipping email send.');
    return { success: false, message: 'No passenger email provided' };
  }

  try {
    const transporter = createTransporter();
    console.log(`Attempting to send booking confirmation email to ${booking.passenger_email}`);

    const statusMessages = {
      pending: 'Your booking is pending confirmation.',
      confirmed: 'Your booking has been confirmed!',
      in_progress: 'Your cab is on the way!',
      completed: 'Your ride has been completed. Thank you!',
      cancelled: 'Your booking has been cancelled.',
    };

    const statusMessage = statusMessages[booking.booking_status] || statusMessages.pending;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Namma Cabs'}" <${process.env.EMAIL_USER}>`,
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
              <h1>🚕 <span style="color: #16a34a;">Namma</span> <span style="color: #000;">Cabs</span> Booking Confirmation</h1>
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
              
              <p>Best regards,<br><span style="color: #16a34a;">Namma</span> <span style="color: #000;">Cabs</span></p>
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
        Namma Cabs
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${booking.passenger_email}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending email to ${booking.passenger_email}:`, error.message);
    console.error('Full error:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message;
    if (error.message && error.message.includes('Invalid login')) {
      errorMessage = 'Gmail authentication failed. Please check your EMAIL_USER and EMAIL_PASSWORD in .env file. Make sure you\'re using an App Password, not your regular Gmail password.';
    } else if (error.message && error.message.includes('EENOTFOUND')) {
      errorMessage = 'Could not connect to email server. Please check your SMTP settings.';
    }
    
    return { success: false, error: errorMessage };
  }
};

const sendInvoiceEmail = async (booking, pdfBuffer, withGST = true) => {
  // Don't send email if email service is not configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email service not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Namma Cabs'}" <${process.env.EMAIL_USER}>`,
      to: booking.passenger_email,
      subject: `Invoice - Booking ID: ${booking.id} ${withGST ? '(With GST)' : '(Without GST)'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .invoice-id { font-size: 24px; font-weight: bold; color: #16a34a; margin: 20px 0; }
            .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📄 <span style="color: #16a34a;">Namma</span> <span style="color: #000;">Cabs</span> Invoice - Booking #${booking.id}</h1>
            </div>
            <div class="content">
              <p>Dear ${booking.passenger_name},</p>
              <p>Please find attached the invoice for your booking.</p>
              <div class="invoice-id">Booking ID: ${booking.id}</div>
              <div class="info-row">
                <span class="label">Service Type:</span>
                <span class="value">${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}</span>
              </div>
              <div class="info-row">
                <span class="label">Total Fare:</span>
                <span class="value">₹${booking.fare_amount}</span>
              </div>
              ${withGST ? '<div class="info-row"><span class="label">Invoice Type:</span><span class="value">With GST</span></div>' : ''}
              <p style="margin-top: 30px;">Thank you for choosing our service!</p>
              <p>Best regards,<br><span style="color: #16a34a;">Namma</span> <span style="color: #000;">Cabs</span></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Invoice - Booking #${booking.id}
        
        Dear ${booking.passenger_name},
        
        Please find attached the invoice for your booking.
        
        Booking ID: ${booking.id}
        Service Type: ${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}
        Total Fare: ₹${booking.fare_amount}
        ${withGST ? 'Invoice Type: With GST' : ''}
        
        Thank you for choosing our service!
        
        Best regards,
        Namma Cabs
      `,
      attachments: [
        {
          filename: `invoice-${booking.id}${withGST ? '-with-gst' : ''}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Invoice email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return { success: false, error: error.message };
  }
};

const sendDriverAssignmentEmail = async (driver, booking) => {
  // Don't send email if email service is not configured or driver has no email
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('Email service not configured. Skipping email send.');
    return { success: false, message: 'Email service not configured' };
  }

  if (!driver.email) {
    console.log('Driver has no email address. Skipping email send.');
    return { success: false, message: 'Driver has no email address' };
  }

  try {
    const transporter = createTransporter();

    // Format date/time for email
    let dateTimeStr = 'N/A';
    if (booking.travel_date) {
      try {
        const travelDate = new Date(booking.travel_date);
        dateTimeStr = travelDate.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } catch (e) {
        dateTimeStr = booking.travel_date;
      }
    }

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Namma Cabs'}" <${process.env.EMAIL_USER}>`,
      to: driver.email,
      subject: `New Ride Assignment - Booking ID: ${booking.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-id { font-size: 24px; font-weight: bold; color: #16a34a; margin: 20px 0; }
            .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚕 <span style="color: #16a34a;">Namma</span> <span style="color: #000;">Cabs</span> - New Ride Assignment</h1>
            </div>
            <div class="content">
              <p>Dear ${driver.name},</p>
              <p>You have been assigned a new ride. Please find the details below:</p>
              
              <div style="text-align: center;">
                <div class="booking-id">Booking ID: ${booking.id}</div>
              </div>
              
              <div class="info-row">
                <span class="label">Service Type:</span>
                <span class="value">${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Pickup Location:</span>
                <span class="value">${booking.from_location || 'N/A'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Drop Location:</span>
                <span class="value">${booking.to_location || 'N/A'}</span>
              </div>
              
              ${booking.travel_date ? `
              <div class="info-row">
                <span class="label">Travel Date & Time:</span>
                <span class="value">${dateTimeStr}</span>
              </div>
              ` : ''}
              
              <div class="info-row">
                <span class="label">Passenger Name:</span>
                <span class="value">${booking.passenger_name || 'N/A'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Passenger Phone:</span>
                <span class="value">${booking.passenger_phone || 'N/A'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Distance:</span>
                <span class="value">${booking.distance_km || 0} km</span>
              </div>
              
              <div class="info-row">
                <span class="label">Fare Amount:</span>
                <span class="value" style="color: #16a34a; font-weight: bold;">₹${booking.fare_amount || 0}</span>
              </div>
              
              ${booking.vehicle_number ? `
              <div class="info-row">
                <span class="label">Vehicle Number:</span>
                <span class="value">${booking.vehicle_number}</span>
              </div>
              ` : ''}
              
              <p style="margin-top: 30px;">Please ensure you arrive on time and provide excellent service to the passenger.</p>
              
              <p>Best regards,<br><span style="color: #16a34a;">Namma</span> <span style="color: #000;">Cabs</span></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Ride Assignment - Booking ID: ${booking.id}
        
        Dear ${driver.name},
        
        You have been assigned a new ride. Please find the details below:
        
        Booking ID: ${booking.id}
        Service Type: ${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}
        Pickup Location: ${booking.from_location || 'N/A'}
        Drop Location: ${booking.to_location || 'N/A'}
        ${booking.travel_date ? `Travel Date & Time: ${dateTimeStr}` : ''}
        Passenger Name: ${booking.passenger_name || 'N/A'}
        Passenger Phone: ${booking.passenger_phone || 'N/A'}
        Distance: ${booking.distance_km || 0} km
        Fare Amount: ₹${booking.fare_amount || 0}
        ${booking.vehicle_number ? `Vehicle Number: ${booking.vehicle_number}` : ''}
        
        Please ensure you arrive on time and provide excellent service to the passenger.
        
        Best regards,
        Namma Cabs
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Driver assignment email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending driver assignment email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendBookingConfirmationEmail,
  sendInvoiceEmail,
  sendDriverAssignmentEmail,
};

