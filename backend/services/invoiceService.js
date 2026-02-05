const PDFDocument = require('pdfkit');

/**
 * Generate invoice PDF for a booking. Matches the format used in invoice emails
 * (service type, fare, with/without GST). Works for local, airport, outstation.
 * @param {Object} booking - Booking record (id, passenger_name, passenger_email?, from_location, to_location, fare_amount, service_type, number_of_hours?, booking_date?)
 * @param {boolean} withGST - Include GST in invoice type label
 * @returns {Promise<Buffer>} PDF buffer
 */
function generateInvoicePDF(booking, withGST = true) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const brandGreen = '#16a34a';
    const labelGray = '#444';

    // Header
    doc.fontSize(24).fillColor(brandGreen).text('Namma', 50, 50);
    doc.fillColor('black').text(' Cabs', { continued: true });
    doc.fontSize(14).fillColor(labelGray).text(' – Invoice', 50, 78);

    doc.moveDown();
    doc.fontSize(10).fillColor('black');
    doc.text(`Booking ID: ${booking.id}`, 50, 110);
    doc.text(`Date: ${booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, 50, 125);

    doc.moveDown();
    doc.fontSize(12).fillColor(labelGray).text('Bill To', 50, 155);
    doc.fontSize(11).fillColor('black');
    doc.text(booking.passenger_name || '—', 50, 172);
    if (booking.passenger_phone) doc.text(booking.passenger_phone, 50, 186);
    if (booking.passenger_email) doc.text(booking.passenger_email, 50, 200);

    doc.moveDown();
    doc.fontSize(11).fillColor(labelGray).text('Trip Details', 50, 235);
    doc.fillColor('black');
    const fromLoc = booking.from_location || '—';
    const toLoc = booking.to_location || '—';
    const isRoundTrip = booking.service_type === 'outstation' && booking.trip_type === 'round_trip';
    const isMultipleStops = booking.service_type === 'outstation' && booking.trip_type === 'multiple_stops';
    if (isRoundTrip) {
      doc.text(`Location (from & to): ${fromLoc}`, 50, 252);
    } else if (isMultipleStops && toLoc && toLoc !== '—') {
      const stops = [fromLoc, ...toLoc.split(',').map((s) => s.trim()).filter(Boolean)];
      doc.text(`Stops: ${stops.join(' → ')}`, 50, 252);
    } else {
      doc.text(`From: ${fromLoc}`, 50, 252);
      doc.text(`To: ${toLoc}`, 50, 266);
    }

    const serviceLabel = booking.service_type === 'local'
      ? 'Local'
      : booking.service_type === 'airport'
        ? 'Airport'
        : 'Outstation';
    const tripTypeLabel = booking.service_type === 'outstation' && booking.trip_type
      ? (booking.trip_type === 'one_way' ? 'One Way' : booking.trip_type === 'round_trip' ? 'Round Trip' : booking.trip_type === 'multiple_stops' ? 'Multiple Stops' : booking.trip_type)
      : null;
    doc.text(`Service: ${serviceLabel}${tripTypeLabel ? ` (${tripTypeLabel})` : ''}`, 50, 280);
    if (booking.service_type === 'local' && booking.number_of_hours != null) {
      doc.text(`Hours: ${booking.number_of_hours}`, 50, 294);
    }

    doc.moveDown();
    doc.fontSize(11).fillColor(labelGray).text('Amount', 50, 320);
    doc.fontSize(14).fillColor('black');
    doc.text(`Total Fare: ₹${Number(booking.fare_amount).toFixed(2)}`, 50, 338);
    if (withGST) {
      doc.fontSize(10).fillColor(labelGray).text('Invoice Type: With GST', 50, 358);
    } else {
      doc.fontSize(10).fillColor(labelGray).text('Invoice Type: Without GST', 50, 358);
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor(labelGray)
      .text('Thank you for choosing Namma Cabs.', 50, 400)
      .text('This is a computer-generated invoice.', 50, 412);

    doc.end();
  });
}

/**
 * Generate invoice PDF for a corporate booking.
 * @param {Object} booking - Corporate booking (id, name, company_name, phone_number, pickup_point, drop_point, service_type, fare_amount, travel_date?, created_at?)
 * @param {boolean} withGST - Include GST in invoice type label
 * @returns {Promise<Buffer>} PDF buffer
 */
function generateCorporateInvoicePDF(booking, withGST = true) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const brandGreen = '#16a34a';
    const labelGray = '#444';

    doc.fontSize(24).fillColor(brandGreen).text('Namma', 50, 50);
    doc.fillColor('black').text(' Cabs', { continued: true });
    doc.fontSize(14).fillColor(labelGray).text(' – Corporate Invoice', 50, 78);

    doc.moveDown();
    doc.fontSize(10).fillColor('black');
    doc.text(`Corporate Booking ID: ${booking.id}`, 50, 110);
    doc.text(`Date: ${booking.created_at ? new Date(booking.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, 50, 125);

    doc.moveDown();
    doc.fontSize(12).fillColor(labelGray).text('Bill To', 50, 155);
    doc.fontSize(11).fillColor('black');
    doc.text(booking.company_name || '—', 50, 172);
    doc.text(booking.name || '—', 50, 186);
    if (booking.phone_number) doc.text(booking.phone_number, 50, 200);

    doc.moveDown();
    doc.fontSize(11).fillColor(labelGray).text('Trip Details', 50, 235);
    doc.fillColor('black');
    doc.text(`From: ${booking.pickup_point || '—'}`, 50, 252);
    doc.text(`To: ${booking.drop_point || '—'}`, 50, 266);
    const serviceLabel = booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation';
    doc.text(`Service: ${serviceLabel}`, 50, 280);
    if (booking.travel_date) doc.text(`Travel: ${booking.travel_date}${booking.travel_time ? ` ${booking.travel_time}` : ''}`, 50, 294);

    doc.moveDown();
    doc.fontSize(11).fillColor(labelGray).text('Amount', 50, 320);
    doc.fontSize(14).fillColor('black');
    const amount = Number(booking.fare_amount);
    doc.text(`Total Fare: ₹${(isNaN(amount) ? 0 : amount).toFixed(2)}`, 50, 338);
    if (withGST) {
      doc.fontSize(10).fillColor(labelGray).text('Invoice Type: With GST', 50, 358);
    } else {
      doc.fontSize(10).fillColor(labelGray).text('Invoice Type: Without GST', 50, 358);
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor(labelGray)
      .text('Thank you for choosing Namma Cabs.', 50, 400)
      .text('This is a computer-generated corporate invoice.', 50, 412);

    doc.end();
  });
}

module.exports = {
  generateInvoicePDF,
  generateCorporateInvoicePDF,
};
