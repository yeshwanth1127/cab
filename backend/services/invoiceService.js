const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const LOGO_PATH = path.join(
  __dirname,
  '..',
  '..',
  'frontend',
  'public',
  'logo-namma-cabs.png'
);

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN');
}

function mapServiceType(serviceType) {
  if (serviceType === 'local') return 'Local';
  if (serviceType === 'airport') return 'Airport';
  if (serviceType === 'outstation') return 'Outstation';
  return serviceType || '';
}

/**
 * Build default invoice field values from a booking row
 */
function buildDefaultInvoiceData(booking, options = {}) {
  const {
    companyGSTIN = process.env.COMPANY_GSTIN || '',
    hsnSAC = process.env.COMPANY_HSN_SAC || '',
    gstRate = Number(process.env.COMPANY_GST_RATE || '0.05'),
  } = options;

  const baseFare = Number(booking.fare_amount || 0);
  const gstAmount = baseFare * gstRate;
  const grandTotal = baseFare + gstAmount;

  const pickup = booking.from_location || '';
  const drop = booking.to_location || '';
  const serviceTypeLabel = mapServiceType(booking.service_type);
  const travelDate = formatDate(booking.travel_date || booking.booking_date);

  const lines = [
    `Service: ${serviceTypeLabel}`,
    travelDate ? `Date: ${travelDate}` : '',
    booking.pickup_time ? `Time: ${booking.pickup_time}` : '',
    pickup ? `Pickup: ${pickup}` : '',
    drop ? `Drop: ${drop}` : '',
    booking.cab_type_name ? `Cab Type: ${booking.cab_type_name}` : '',
    booking.car_option_name ? `Car: ${booking.car_option_name}` : '',
  ].filter(Boolean);

  return {
    invoice_no: `NC-${booking.id}`,
    invoice_date: formatDate(booking.booking_date),
    company_gstin: companyGSTIN,
    hsn_sac: hsnSAC,

    customer_name: booking.passenger_name || booking.username || '',
    customer_address: pickup || '',
    customer_phone: booking.passenger_phone || '',
    customer_email: booking.passenger_email || booking.email || '',
    customer_state: '',
    customer_gst: '',

    service_description: lines.join('\n'),
    total_kms: booking.distance_km != null ? String(booking.distance_km) : '',
    no_of_days: booking.number_of_days ? String(booking.number_of_days) : '',
    rate_details: '',
    service_amount: baseFare.toFixed(2),

    toll_tax: '0.00',
    state_tax: '0.00',
    driver_batta: '0.00',
    parking_charges: '0.00',
    placard_charges: '0.00',
    extras: '0.00',

    sub_total: baseFare.toFixed(2),
    gst_amount: gstAmount.toFixed(2),
    grand_total: grandTotal.toFixed(2),
    amount_in_words: '',
  };
}

/**
 * Draw static layout and place AcroForm fields
 */
async function generateInvoicePdf(booking, overrides = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const form = pdfDoc.getForm();
  const fontHeading = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontBody = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = 56.7; // ~20mm
  const contentWidth = A4_WIDTH - margin * 2;

  // Colors
  const brand = rgb(0.11, 0.36, 0.80); // blue
  const textColor = rgb(0, 0, 0);
  const gray = rgb(0.6, 0.6, 0.6);

  // Try load logo
  let logoDims = null;
  try {
    const logoBytes = fs.readFileSync(LOGO_PATH);
    const logoImg = LOGO_PATH.toLowerCase().endsWith('.png')
      ? await pdfDoc.embedPng(logoBytes)
      : await pdfDoc.embedJpg(logoBytes);
    const logoWidth = 80;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    page.drawImage(logoImg, {
      x: margin,
      y: A4_HEIGHT - margin - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
    logoDims = { width: logoWidth, height: logoHeight };
  } catch {
    // no logo, ignore
  }

  // Header text (brand)
  // Place brand name slightly below top margin to give breathing room around logo
  const headerY = A4_HEIGHT - margin - 26;
  page.setFont(fontHeading);
  page.setFontSize(18);
  page.setFontColor(textColor);
  const brandText = 'Namma Cabs';
  page.drawText(brandText, {
    x: margin + (logoDims ? logoDims.width + 10 : 0),
    y: headerY,
  });

  // Company info right-aligned
  const rightX = margin + contentWidth;
  page.setFont(fontBody);
  page.setFontSize(9);
  const companyLines = [
    process.env.COMPANY_ADDRESS_LINE1 || 'Bengaluru, Karnataka, India',
    process.env.COMPANY_ADDRESS_LINE2 || '',
    `Phone: ${process.env.COMPANY_PHONE || '+91 00000 00000'}`,
    `Email: ${process.env.COMPANY_EMAIL || 'support@namma-cabs.com'}`,
  ].filter(Boolean);
  let infoY = A4_HEIGHT - margin - 10;
  companyLines.forEach((line) => {
    const w = fontBody.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: rightX - w, y: infoY });
    infoY -= 11;
  });

  // INVOICE bar
  // Invoice bar with comfortable spacing below header
  const barY = headerY - 40;
  page.drawRectangle({
    x: margin,
    y: barY,
    width: contentWidth,
    height: 20,
    color: brand,
  });
  page.setFont(fontHeading);
  page.setFontSize(12);
  page.setFontColor(rgb(1, 1, 1));
  const invoiceLabel = 'INVOICE';
  const invoiceLabelW = fontHeading.widthOfTextAtSize(invoiceLabel, 12);
  page.drawText(invoiceLabel, {
    x: margin + (contentWidth - invoiceLabelW) / 2,
    y: barY + 5,
  });

  // Prepare field values
  const defaults = buildDefaultInvoiceData(booking);
  const data = { ...defaults, ...overrides };

  // Helper to create a text field + label
  const createLabeledField = (opts) => {
    const {
      name,
      label,
      x,
      y,
      width,
      height = 14,
      fontSize = 8,
      value = '',
      multiline = false,
    } = opts;
    // label
    page.setFont(fontBody);
    page.setFontSize(8);
    page.setFontColor(gray);
    page.drawText(label, { x, y: y + height + 2 });

    const field = form.createTextField(name);
    field.setText(value || '');
    if (multiline && typeof field.enableMultiline === 'function') {
      field.enableMultiline();
    }
    // pdf-lib uses updateAppearances(font) to set visual font; setFont is not available on fields
    field.updateAppearances(fontBody);
    field.addToPage(page, { x, y, width, height });
  };

  // CUSTOMER & INVOICE META (two columns)
  // Push down customer/invoice blocks for better separation from the INVOICE bar
  let sectionTop = barY - 40;
  const colGap = 20;
  const colWidth = (contentWidth - colGap) / 2;

  // Left: Customer
  page.setFont(fontHeading);
  page.setFontSize(10);
  page.setFontColor(textColor);
  page.drawText('Customer Details', { x: margin, y: sectionTop });

  let cy = sectionTop - 18;
  const fieldHeight = 14;
  createLabeledField({
    name: 'customer_name',
    label: 'Customer Name',
    x: margin,
    y: cy,
    width: colWidth,
    height: fieldHeight,
    value: data.customer_name,
  });
  cy -= 22;
  createLabeledField({
    name: 'customer_address',
    label: 'Address',
    x: margin,
    y: cy - 20,
    width: colWidth,
    height: 36,
    value: data.customer_address,
    multiline: true,
  });
  cy -= 50;
  createLabeledField({
    name: 'customer_phone',
    label: 'Phone',
    x: margin,
    y: cy,
    width: colWidth / 2 - 5,
    value: data.customer_phone,
  });
  createLabeledField({
    name: 'customer_email',
    label: 'Email',
    x: margin + colWidth / 2 + 5,
    y: cy,
    width: colWidth / 2 - 5,
    value: data.customer_email,
  });
  cy -= 22;
  createLabeledField({
    name: 'customer_state',
    label: 'State',
    x: margin,
    y: cy,
    width: colWidth / 2 - 5,
    value: data.customer_state,
  });
  createLabeledField({
    name: 'customer_gst',
    label: 'Customer GST (Optional)',
    x: margin + colWidth / 2 + 5,
    y: cy,
    width: colWidth / 2 - 5,
    value: data.customer_gst,
  });

  // Right: Invoice meta
  const rightColX = margin + colWidth + colGap;
  page.setFont(fontHeading);
  page.setFontSize(10);
  page.drawText('Invoice Details', { x: rightColX, y: sectionTop });

  let ry = sectionTop - 18;
  createLabeledField({
    name: 'invoice_no',
    label: 'Invoice No',
    x: rightColX,
    y: ry,
    width: colWidth,
    value: data.invoice_no,
  });
  ry -= 22;
  createLabeledField({
    name: 'invoice_date',
    label: 'Invoice Date',
    x: rightColX,
    y: ry,
    width: colWidth,
    value: data.invoice_date,
  });
  ry -= 22;
  createLabeledField({
    name: 'company_gstin',
    label: 'Our GSTIN',
    x: rightColX,
    y: ry,
    width: colWidth,
    value: data.company_gstin,
  });
  ry -= 22;
  createLabeledField({
    name: 'hsn_sac',
    label: 'HSN / SAC',
    x: rightColX,
    y: ry,
    width: colWidth,
    value: data.hsn_sac,
  });

  // SERVICE DETAILS TABLE
  // Add extra gap below customer block before the table starts
  let tableTop = cy - 40;
  const tableLeft = margin;
  const tableRight = margin + contentWidth;
  const headerHeight = 16;

  const colSl = 30;
  const colDesc = 200;
  const colKms = 60;
  const colDays = 60;
  const colRate = 100;
  const colAmt = contentWidth - (colSl + colDesc + colKms + colDays + colRate);

  // Header background
  page.drawRectangle({
    x: tableLeft,
    y: tableTop - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: rgb(0.9, 0.93, 1),
  });

  page.setFont(fontHeading);
  page.setFontSize(8);
  page.setFontColor(textColor);
  const headerYText = tableTop - headerHeight + 4;
  page.drawText('Sl No', { x: tableLeft + 4, y: headerYText });
  page.drawText('Description', { x: tableLeft + colSl + 4, y: headerYText });
  page.drawText('Total Kms', { x: tableLeft + colSl + colDesc + 4, y: headerYText });
  page.drawText('No of Days', { x: tableLeft + colSl + colDesc + colKms + 4, y: headerYText });
  page.drawText('Rate Details', { x: tableLeft + colSl + colDesc + colKms + colDays + 4, y: headerYText });
  page.drawText('Amount (Rs)', { x: tableLeft + colSl + colDesc + colKms + colDays + colRate + 4, y: headerYText });

  // Table body (single row, but fillable fields)
  // Position the first service row with more vertical padding under header row
  const rowY = tableTop - headerHeight - 12 - 40;
  // Borders
  page.setFont(fontBody);
  page.setFontSize(8);
  page.setFontColor(textColor);
  page.drawRectangle({
    x: tableLeft,
    y: rowY - 6,
    width: contentWidth,
    height: 40,
    borderColor: gray,
    borderWidth: 0.5,
  });

  // Fields
  createLabeledField({
    name: 'service_description',
    label: '',
    x: tableLeft + colSl + 2,
    y: rowY,
    width: colDesc - 4,
    height: 32,
    value: data.service_description,
    multiline: true,
  });
  createLabeledField({
    name: 'total_kms',
    label: '',
    x: tableLeft + colSl + colDesc + 2,
    y: rowY + 8,
    width: colKms - 4,
    value: data.total_kms,
  });
  createLabeledField({
    name: 'no_of_days',
    label: '',
    x: tableLeft + colSl + colDesc + colKms + 2,
    y: rowY + 8,
    width: colDays - 4,
    value: data.no_of_days,
  });
  createLabeledField({
    name: 'rate_details',
    label: '',
    x: tableLeft + colSl + colDesc + colKms + colDays + 2,
    y: rowY,
    width: colRate - 4,
    height: 32,
    value: data.rate_details,
    multiline: true,
  });
  createLabeledField({
    name: 'service_amount',
    label: '',
    x: tableLeft + colSl + colDesc + colKms + colDays + colRate + 2,
    y: rowY + 8,
    width: colAmt - 4,
    value: data.service_amount,
  });

  // CHARGES BREAKDOWN (right aligned)
  // Add generous gap below the table for clarity
  let chargesTop = rowY - 70;
  const chargesX = margin + contentWidth / 2 + 40;
  const chargesWidth = contentWidth / 2 - 40;

  page.setFont(fontHeading);
  page.setFontSize(10);
  page.drawText('Charges Breakdown', { x: chargesX, y: chargesTop });
  chargesTop -= 16;

  const addChargeRow = (label, fieldName) => {
    page.setFont(fontBody);
    page.setFontSize(8);
    page.setFontColor(textColor);
    page.drawText(label, { x: chargesX, y: chargesTop });
    const fieldWidth = 100;
    createLabeledField({
      name: fieldName,
      label: '',
      x: chargesX + chargesWidth - fieldWidth,
      y: chargesTop - 2,
      width: fieldWidth,
      value: data[fieldName],
    });
    chargesTop -= 18;
  };

  addChargeRow('Toll Tax', 'toll_tax');
  addChargeRow('State Tax', 'state_tax');
  addChargeRow('Driver Batta', 'driver_batta');
  addChargeRow('Parking Charges', 'parking_charges');
  addChargeRow('Placard Charges', 'placard_charges');
  addChargeRow('Extras', 'extras');
  addChargeRow('Sub Total', 'sub_total');
  addChargeRow('GST Amount', 'gst_amount');
  addChargeRow('Grand Total', 'grand_total');

  // Amount in words
  const wordsY = chargesTop - 24;
  page.setFont(fontHeading);
  page.setFontSize(9);
  page.drawText('Amount in Words (Rs)', { x: margin, y: wordsY });
  createLabeledField({
    name: 'amount_in_words',
    label: '',
    x: margin,
    y: wordsY - 18,
    width: contentWidth,
    height: 18,
    value: data.amount_in_words,
  });

  // Terms & Conditions
  const termsY = wordsY - 50;
  page.setFont(fontHeading);
  page.setFontSize(9);
  page.drawText('Terms & Conditions', { x: margin, y: termsY });
  page.setFont(fontBody);
  page.setFontSize(7);
  const terms = [
    '1. All disputes are subject to Bengaluru jurisdiction only.',
    '2. Waiting and detentions will be charged as per company policy.',
    '3. Tolls, parking, and state taxes are extra unless specified.',
    '4. Please verify all details; no claims will be entertained after 7 days.',
  ];
  let ty = termsY - 12;
  terms.forEach((t) => {
    page.drawText(t, { x: margin, y: ty });
    ty -= 9;
  });

  // Footer
  page.setFont(fontBody);
  page.setFontSize(8);
  const footerText = 'This is a computer generated invoice. No signature required.';
  const ftWidth = fontBody.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: margin + (contentWidth - ftWidth) / 2,
    y: 30,
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = {
  buildDefaultInvoiceData,
  generateInvoicePdf,
};


