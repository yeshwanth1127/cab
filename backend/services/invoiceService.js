const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo_final.jpeg');

const COMPANY = {
  name: process.env.INVOICE_COMPANY_NAME || 'Namma Cabs',
  nameFirst: process.env.INVOICE_COMPANY_NAME_FIRST || 'Namma',
  nameSecond: process.env.INVOICE_COMPANY_NAME_SECOND || ' Cabs',
  tagline: process.env.INVOICE_TAGLINE || 'Recognized by Govt. of Karnataka',
  address: process.env.INVOICE_ADDRESS || '#105, Sri Ranganatha Building, Behind New RTO, KR Puram 3rd Main, Bangalore 560049',
  supportPhone: process.env.INVOICE_SUPPORT_PHONE || '+91-6364778844',
  email: process.env.INVOICE_EMAIL || 'help@nammacabs.com',
  gstin: process.env.INVOICE_GSTIN || '29CLTPR6253AIZN',
  hsnSac: '998555',
  customerState: process.env.INVOICE_CUSTOMER_STATE || 'KARNATAKA',
};

const BLUE_HEADER = '#2563eb';
const YELLOW_TEXT = '#ca8a04';
const GREEN_TEXT = '#16a34a';

function numberToWords(n) {
  const num = Math.floor(Number(n) || 0);
  if (num === 0) return 'Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function toWordsLessThanThousand(x) {
    if (x === 0) return '';
    if (x < 20) return ones[x];
    if (x < 100) return (tens[Math.floor(x / 10)] + ' ' + ones[x % 10]).trim();
    return (ones[Math.floor(x / 100)] + ' Hundred ' + toWordsLessThanThousand(x % 100)).trim();
  }
  if (num < 1000) return toWordsLessThanThousand(num) + ' Only';
  if (num < 100000) return (toWordsLessThanThousand(Math.floor(num / 1000)) + ' Thousand ' + toWordsLessThanThousand(num % 1000)).trim() + ' Only';
  if (num < 10000000) return (toWordsLessThanThousand(Math.floor(num / 100000)) + ' Lakh ' + numberToWords(num % 100000).replace(' Only', '')).trim() + ' Only';
  return (toWordsLessThanThousand(Math.floor(num / 10000000)) + ' Crore ' + numberToWords(num % 10000000).replace(' Only', '')).trim() + ' Only';
}

function generateInvoicePDF(booking, withGST = true) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const margin = 50;
    const rightColX = pageWidth - margin - 180;

    // Header layout: logo/tagline on left, address on right; all must sit above the blue INVOICE bar
    const headerTop = 42;
    const logoWidth = 150;
    const logoHeight = 66; // larger logo so it doesn't look shrunk
    const lineY = headerTop + logoHeight + 2;
    const taglineY = lineY + 6;
    const blueBarTop = taglineY + 10; // gap below tagline before bar
    const blueBarHeight = 28;
    const contentTop = blueBarTop + blueBarHeight + 10; // content below blue bar

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margin, headerTop, { width: logoWidth, height: logoHeight });
      doc.strokeColor('#16a34a').lineWidth(1).moveTo(margin, lineY).lineTo(margin + 180, lineY).stroke();
      doc.fontSize(9).fillColor('#374151').text(COMPANY.tagline, margin, taglineY);
    } else {
      doc.fontSize(22).fillColor(YELLOW_TEXT).text(COMPANY.nameFirst, margin, headerTop);
      const nammaWidth = doc.widthOfString(COMPANY.nameFirst);
      const logoGap = 6;
      doc.fillColor(GREEN_TEXT).text(COMPANY.nameSecond.trim(), margin + nammaWidth + logoGap, headerTop);
      const cabsWidth = doc.widthOfString(COMPANY.nameSecond.trim());
      const totalLogoWidth = nammaWidth + logoGap + cabsWidth;
      doc.strokeColor('#16a34a').lineWidth(1).moveTo(margin, headerTop + 36).lineTo(margin + Math.min(totalLogoWidth, 180), headerTop + 36).stroke();
      doc.fontSize(9).fillColor('#374151').text(COMPANY.tagline, margin, headerTop + 44);
    }

    doc.fontSize(9).fillColor('black');
    const addrLines = COMPANY.address.split(',').map((s) => s.trim()).filter(Boolean);
    let addrY = headerTop;
    addrLines.forEach((line, i) => {
      doc.text(line + (i < addrLines.length - 1 ? ',' : ''), rightColX, addrY, { width: 175, align: 'left' });
      addrY += 10;
    });
    addrY += 2;
    doc.text(`Phone: ${COMPANY.supportPhone}`, rightColX, addrY);
    doc.text(`Email ID: ${COMPANY.email}`, rightColX, addrY + 14);

    doc.rect(0, blueBarTop, pageWidth, blueBarHeight).fill(BLUE_HEADER);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('INVOICE', 0, blueBarTop + 6, { width: pageWidth, align: 'center' });
    doc.fillColor('black').font('Helvetica');

    let y = contentTop;
    doc.fontSize(11).font('Helvetica-Bold').text(`M/s ${(booking.passenger_name || '—').toUpperCase()}`, margin, y);
    doc.font('Helvetica').fontSize(9);
    y += 16;
    const custAddr = booking.from_location || '—';
    const addrStr = `Address: ${custAddr}`;
    doc.text(addrStr, margin, y, { width: 260, lineGap: 2 });
    y += doc.heightOfString(addrStr, { width: 260 }) + 8;

    const emailVal = booking.passenger_email && String(booking.passenger_email).trim() ? String(booking.passenger_email).trim() : '—';
    const emailStr = `Email: ${emailVal}`;
    doc.text(emailStr, margin, y, { width: 260, lineGap: 2 });
    y += doc.heightOfString(emailStr, { width: 260 }) + 10;

    doc.text(`State: ${COMPANY.customerState}`, margin, y);
    y += 12;
    doc.text(`Phone: ${booking.passenger_phone || '—'}`, margin, y);
    const customerBlockBottom = y + 14;

    y = contentTop;
    doc.fontSize(9);
    doc.text(`Invoice No: ${booking.invoice_number || booking.id}`, rightColX, y);
    y += 12;
    const invDate = booking.booking_date ? new Date(booking.booking_date) : new Date();
    const dateStr = invDate.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    doc.text(`Date: ${dateStr}`, rightColX, y);
    y += 12;
    if (withGST) {
      doc.text(`OUR GSTIN: ${COMPANY.gstin}`, rightColX, y);
      y += 12;
    }
    doc.text(`HSN/SAC - ${COMPANY.hsnSac}`, rightColX, y);

    const tableTop = Math.max(225, customerBlockBottom + 12);
    const tableWidth = pageWidth - 2 * margin;
    const colW = { sl: 30, desc: 209, kms: 56, days: 58, rate: 58, amount: 84 };
    const colSl = margin;
    const colDesc = colSl + colW.sl;
    const colKms = colDesc + colW.desc;
    const colDays = colKms + colW.kms;
    const colRate = colDays + colW.days;
    const colAmount = colRate + colW.rate;
    const rowH = 20;
    const headerH = 24;
    const cellPad = 6;

    doc.rect(margin, tableTop, tableWidth, headerH).fill(BLUE_HEADER);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('SI No', colSl + cellPad, tableTop + 7, { width: colW.sl - cellPad });
    doc.text('Description', colDesc + cellPad, tableTop + 7, { width: colW.desc - cellPad });
    doc.text('Total Kms', colKms + cellPad, tableTop + 7, { width: colW.kms - cellPad });
    doc.text('No Of Days', colDays + cellPad, tableTop + 7, { width: colW.days - cellPad });
    doc.text('Rate Details', colRate + cellPad, tableTop + 7, { width: colW.rate - cellPad });
    doc.text('Amount(Rs)', colAmount + cellPad, tableTop + 7, { width: colW.amount - cellPad, align: 'right' });
    doc.fillColor('black').font('Helvetica');

    const serviceLabel = booking.service_type === 'local' ? 'LOCAL' : booking.service_type === 'airport' ? 'AIRPORT TRANS' : 'OUTSTATION';
    const tripLabel = booking.service_type === 'outstation' && booking.trip_type
      ? (booking.trip_type === 'one_way' ? 'One Way' : booking.trip_type === 'round_trip' ? 'Round Trip' : 'Multiple Stops')
      : '';
    const dateForDesc = booking.booking_date ? new Date(booking.booking_date).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : (new Date()).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    const descLines = [
      serviceLabel + (tripLabel ? ` - ${tripLabel.toUpperCase()}` : ''),
      `DATE - ${dateForDesc}`,
      `PICKUP- ${(booking.from_location || '—').substring(0, 45)}`,
      `DROP- ${(booking.to_location || '—').substring(0, 45)}`,
      `CAB - ${(booking.cab_type_name || 'AC').toUpperCase()}`,
    ];
    const totalKms = booking.distance_km != null ? Number(booking.distance_km) : 0;
    const noOfDays = booking.number_of_days != null ? Number(booking.number_of_days) : 1;
    const amount = Number(booking.fare_amount) || 0;

    let rowY = tableTop + headerH;
    const firstRowH = rowH * 5;
    doc.strokeColor('#d1d5db');
    doc.rect(margin, tableTop + headerH, tableWidth, firstRowH).stroke();
    [colDesc, colKms, colDays, colRate, colAmount].forEach((x) => {
      doc.moveTo(x, tableTop + headerH).lineTo(x, tableTop + headerH + firstRowH).stroke();
    });
    doc.fontSize(8).fillColor('black');
    doc.text('1', colSl + cellPad, rowY + 4, { width: colW.sl - cellPad });
    doc.text(descLines.join('\n'), colDesc + cellPad, rowY + 2, { width: colW.desc - cellPad, lineGap: 2 });
    doc.text(String(totalKms || '0'), colKms + cellPad, rowY + 4, { width: colW.kms - cellPad });
    doc.text(String(noOfDays), colDays + cellPad, rowY + 4, { width: colW.days - cellPad });
    doc.text('NA', colRate + cellPad, rowY + 4, { width: colW.rate - cellPad });
    doc.text(String(Math.round(amount)), colAmount + cellPad, rowY + 4, { width: colW.amount - cellPad, align: 'right' });

    const extraRows = [
      { label: 'Toll tax', val: 0 },
      { label: 'State Tax', val: 0 },
      { label: 'Driver Batta', val: 0 },
      { label: 'Parking Charges', val: 0 },
      { label: 'Placard Charges', val: 0 },
      { label: 'Extras', val: 0 },
    ];
    rowY += firstRowH;
    extraRows.forEach((r) => {
      const h = rowH;
      doc.rect(margin, rowY, tableWidth, h).stroke();
      [colDesc, colKms, colDays, colRate, colAmount].forEach((x) => {
        doc.moveTo(x, rowY).lineTo(x, rowY + h).stroke();
      });
      doc.text(r.label, colDesc + cellPad, rowY + 5, { width: colW.desc - cellPad });
      doc.text(String(r.val), colAmount + cellPad, rowY + 5, { width: colW.amount - cellPad, align: 'right' });
      rowY += h;
    });

    doc.rect(margin, rowY, tableWidth, rowH).stroke();
    [colDesc, colKms, colDays, colRate, colAmount].forEach((x) => {
      doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke();
    });
    doc.font('Helvetica-Bold').text('Sub Total', colDesc + cellPad, rowY + 5, { width: colW.desc - cellPad });
    doc.text(String(Math.round(amount)), colAmount + cellPad, rowY + 5, { width: colW.amount - cellPad, align: 'right' });
    rowY += rowH;
    doc.rect(margin, rowY, tableWidth, rowH).stroke();
    [colDesc, colKms, colDays, colRate, colAmount].forEach((x) => {
      doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke();
    });
    doc.text('Grand Total', colDesc + cellPad, rowY + 5, { width: colW.desc - cellPad });
    doc.text(amount.toFixed(2), colAmount + cellPad, rowY + 5, { width: colW.amount - cellPad, align: 'right' });
    doc.moveTo(colAmount + cellPad, rowY + rowH - 4).lineTo(colAmount + colW.amount - cellPad, rowY + rowH - 4).stroke();
    doc.moveTo(colAmount + cellPad, rowY + rowH - 2).lineTo(colAmount + colW.amount - cellPad, rowY + rowH - 2).stroke();
    doc.font('Helvetica');

    rowY += rowH + 14;
    doc.fontSize(9).fillColor('#374151');
    doc.text(`Amount in Words (Rs): ${numberToWords(amount)}`, margin, rowY);

    let termsY = rowY + 36;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('black').text('Terms & Conditions', margin, termsY);
    termsY += 16;
    doc.font('Helvetica').fontSize(8).fillColor('#374151');
    const termsWidth = pageWidth - 2 * margin - 12;
    const terms = [
      'Your Trip has a KM limit and in case of certain special packages may even contain Hours limit. If your usage exceeds these limits, you will be charged for the excess KM used (and/or hour if applicable).',
      'All road toll fees, parking charges, state taxes etc. are charged extra and need to be paid to the concerned authorities as per actuals.',
      'For driving between 10:00 PM to 06:00 AM on any of the nights, an additional allowance will be applicable and is to be paid to the driver.',
      'Please ensure you have covered all cities you plan to visit in your itinerary. This will help our driver prepare accordingly. Adding city to the itinerary during trip may not be possible.',
      'If your Trip has Hill climbs, cab AC may be switched off during such climbs.',
    ];
    terms.forEach((t) => {
      termsY += 4;
      doc.text(`• ${t}`, margin + 6, termsY, { width: termsWidth, lineGap: 2 });
      termsY += doc.heightOfString(`• ${t}`, { width: termsWidth }) + 2;
    });

    const footerY = 820;
    doc.fontSize(8).fillColor('#6b7280').text('This is computer generated Invoice hence no signature and seal is required.', margin, footerY, { width: pageWidth - 2 * margin, align: 'center' });

    doc.end();
  });
}

function generateCorporateInvoicePDF(booking, withGST = true) {
  let bookingDate = null;
  if (booking.travel_date) {
    const d = new Date(booking.travel_date + (booking.travel_time ? `T${booking.travel_time}` : ''));
    bookingDate = Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (!bookingDate && booking.created_at) {
    const d = new Date(booking.created_at);
    bookingDate = Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (!bookingDate) bookingDate = new Date().toISOString();

  const asBooking = {
    id: booking.id,
    invoice_number: booking.invoice_number || null,
    passenger_name: booking.name,
    passenger_email: null,
    passenger_phone: booking.phone_number || null,
    from_location: booking.pickup_point || '—',
    to_location: booking.drop_point || '—',
    fare_amount: Number(booking.fare_amount) || 0,
    service_type: booking.service_type || 'local',
    booking_date: bookingDate,
    cab_type_name: 'AC',
    distance_km: 0,
    number_of_days: 1,
  };
  return generateInvoicePDF(asBooking, withGST);
}

function generateEventInvoicePDF(eventBooking) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageWidth = 595.28;
    const margin = 50;
    const headerTop = 42;
    const logoWidth = 150;
    const logoHeight = 66;
    const lineY = headerTop + logoHeight + 2;
    const taglineY = lineY + 6;
    const blueBarTop = taglineY + 10;
    const blueBarHeight = 28;
    const contentTop = blueBarTop + blueBarHeight + 10;
    const rightColX = pageWidth - margin - 180;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, margin, headerTop, { width: logoWidth, height: logoHeight });
      doc.strokeColor('#16a34a').lineWidth(1).moveTo(margin, lineY).lineTo(margin + 180, lineY).stroke();
      doc.fontSize(9).fillColor('#374151').text(COMPANY.tagline, margin, taglineY);
    } else {
      doc.fontSize(22).fillColor(YELLOW_TEXT).text(COMPANY.nameFirst, margin, headerTop);
      const nammaWidth = doc.widthOfString(COMPANY.nameFirst);
      doc.fillColor(GREEN_TEXT).text(COMPANY.nameSecond.trim(), margin + nammaWidth + 6, headerTop);
      doc.strokeColor('#16a34a').lineWidth(1).moveTo(margin, headerTop + 36).lineTo(margin + 180, headerTop + 36).stroke();
      doc.fontSize(9).fillColor('#374151').text(COMPANY.tagline, margin, headerTop + 44);
    }

    doc.fontSize(9).fillColor('black');
    const addrLines = COMPANY.address.split(',').map((s) => s.trim()).filter(Boolean);
    let addrY = headerTop;
    addrLines.forEach((line, i) => {
      doc.text(line + (i < addrLines.length - 1 ? ',' : ''), rightColX, addrY, { width: 175, align: 'left' });
      addrY += 10;
    });
    addrY += 2;
    doc.text(`Phone: ${COMPANY.supportPhone}`, rightColX, addrY);
    doc.text(`Email ID: ${COMPANY.email}`, rightColX, addrY + 14);

    doc.rect(0, blueBarTop, pageWidth, blueBarHeight).fill(BLUE_HEADER);
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold').text('EVENT BOOKING INVOICE', 0, blueBarTop + 6, { width: pageWidth, align: 'center' });
    doc.fillColor('black').font('Helvetica');

    const eventTypeLabel = (eventBooking.event_type === 'weddings' ? 'Wedding' : eventBooking.event_type === 'birthdays' ? 'Birthday' : 'Event').toUpperCase();
    let y = contentTop;
    doc.fontSize(11).font('Helvetica-Bold').text(`Booking #${eventBooking.id}  |  ${eventTypeLabel}`, margin, y);
    doc.font('Helvetica').fontSize(9);
    y += 18;
    doc.text(`Customer: ${(eventBooking.name || '—').toUpperCase()}`, margin, y);
    y += 14;
    doc.text(`Phone: ${eventBooking.phone_number || '—'}`, margin, y);
    y += 14;
    doc.text(`Pickup: ${eventBooking.pickup_point || '—'}`, margin, y);
    y += 12;
    doc.text(`Drop: ${eventBooking.drop_point || '—'}`, margin, y);
    y += 14;
    const pickupDt = eventBooking.pickup_date && eventBooking.pickup_time
      ? `${String(eventBooking.pickup_date).trim()} at ${String(eventBooking.pickup_time).trim()}`
      : (eventBooking.pickup_date || eventBooking.pickup_time || '—');
    doc.text(`Date & Time: ${pickupDt}`, margin, y);
    y += 12;
    doc.text(`Number of cars: ${eventBooking.number_of_cars != null ? eventBooking.number_of_cars : 1}`, margin, y);
    y += 16;

    const assignments = eventBooking.assignments || [];
    if (assignments.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Assigned vehicles', margin, y);
      y += 18;
      const tableTop = y;
      const colW = { sl: 28, vehicle: 120, driver: 140, phone: 120 };
      const tableWidth = pageWidth - 2 * margin;
      const rowH = 22;
      doc.rect(margin, tableTop, tableWidth, rowH).fill(BLUE_HEADER);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
      doc.text('No', margin + 6, tableTop + 6, { width: colW.sl });
      doc.text('Vehicle', margin + colW.sl + 6, tableTop + 6, { width: colW.vehicle });
      doc.text('Driver', margin + colW.sl + colW.vehicle + 6, tableTop + 6, { width: colW.driver });
      doc.text('Phone', margin + colW.sl + colW.vehicle + colW.driver + 6, tableTop + 6, { width: colW.phone });
      doc.fillColor('black').font('Helvetica');
      let rowY = tableTop + rowH;
      assignments.forEach((a, i) => {
        doc.rect(margin, rowY, tableWidth, rowH).stroke();
        doc.fontSize(9).text(String(i + 1), margin + 6, rowY + 6, { width: colW.sl });
        doc.text(a.vehicle_number || a.cab_driver_name || '—', margin + colW.sl + 6, rowY + 6, { width: colW.vehicle });
        doc.text(a.driver_name || a.cab_driver_name || '—', margin + colW.sl + colW.vehicle + 6, rowY + 6, { width: colW.driver });
        doc.text(a.driver_phone || a.cab_driver_phone || '—', margin + colW.sl + colW.vehicle + colW.driver + 6, rowY + 6, { width: colW.phone });
        rowY += rowH;
      });
      y = rowY + 16;
    }

    if (eventBooking.notes && String(eventBooking.notes).trim()) {
      doc.fontSize(9).fillColor('#374151').text(`Notes: ${String(eventBooking.notes).trim()}`, margin, y, { width: pageWidth - 2 * margin });
      y += 20;
    }

    doc.fontSize(8).fillColor('#6b7280').text('This is a computer-generated event booking invoice.', margin, 800, { width: pageWidth - 2 * margin, align: 'center' });
    doc.end();
  });
}

module.exports = {
  generateInvoicePDF,
  generateCorporateInvoicePDF,
  generateEventInvoicePDF,
};
