const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Try to find the new logo first, then fallback to old logo
const getLogoPath = () => {
  const possibleLogos = [
    'logo.png',           // New logo (most common name)
    'namma-cabs-logo.png', // Alternative new logo name
    'logo-namma-cabs.png'  // Old logo (fallback)
  ];
  
  for (const logoName of possibleLogos) {
    const logoPath = path.join(__dirname, '..', '..', 'frontend', 'public', logoName);
    if (fs.existsSync(logoPath)) {
      return logoPath;
    }
  }
  
  // Return the old logo path as final fallback
  return path.join(__dirname, '..', '..', 'frontend', 'public', 'logo-namma-cabs.png');
};

const LOGO_PATH = getLogoPath();

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
    withGST = false,
    companyGSTIN = '29AHYPC7622F1ZZ',
    hsnSAC = process.env.COMPANY_HSN_SAC || '996411',
    gstRate = 0.18, // 18% GST
  } = options;

  const baseFare = Number(booking.fare_amount || 0);
  const gstAmount = withGST ? (baseFare * gstRate) : 0;
  const grandTotal = baseFare + gstAmount;

  const pickup = booking.from_location || '';
  const drop = booking.to_location || 'N/A';
  const serviceTypeLabel = mapServiceType(booking.service_type);
  const travelDate = formatDate(booking.travel_date || booking.booking_date);

  // Create a more organized description
  const lines = [];
  lines.push(`Service: ${serviceTypeLabel}`);
  if (travelDate) lines.push(`Date: ${travelDate}`);
  if (booking.pickup_time) lines.push(`Time: ${booking.pickup_time}`);
  if (pickup) lines.push(`Pickup: ${pickup}`);
  if (drop && drop !== 'N/A') lines.push(`Drop: ${drop}`);
  if (booking.cab_type_name) lines.push(`Cab Type: ${booking.cab_type_name}`);
  if (booking.car_option_name) lines.push(`Car: ${booking.car_option_name}`);

  return {
    invoice_no: `NC-${booking.id}`,
    invoice_date: formatDate(booking.booking_date),
    company_gstin: withGST ? companyGSTIN : '',
    hsn_sac: withGST ? hsnSAC : '',

    customer_name: booking.passenger_name || booking.username || '',
    customer_address: pickup || '',
    customer_phone: booking.passenger_phone || '',
    customer_email: booking.passenger_email || booking.email || '',
    customer_state: '',
    customer_gst: '',

    service_description: lines.join('\n'),
    sl_no: '1',
    total_kms: booking.distance_km != null ? String(booking.distance_km) : '0',
    no_of_days: booking.number_of_days ? String(booking.number_of_days) : '-',
    rate_details: booking.cab_type_name ? `${booking.cab_type_name}` : '-',
    service_amount: baseFare.toFixed(2),

    toll_tax: '0.00',
    state_tax: '0.00',
    driver_batta: '0.00',
    parking_charges: '0.00',
    placard_charges: '0.00',
    extras: '0.00',

    sub_total: baseFare.toFixed(2),
    gst_amount: gstAmount.toFixed(2),
    cgst_amount: withGST ? (gstAmount / 2).toFixed(2) : '0.00',
    sgst_amount: withGST ? (gstAmount / 2).toFixed(2) : '0.00',
    grand_total: grandTotal.toFixed(2),
    amount_in_words: '',
    withGST: withGST,
  };
}

/**
 * Generate invoice PDF with text rendered directly (not fillable form)
 */
async function generateInvoicePdf(booking, overrides = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = 50;
  const contentWidth = A4_WIDTH - margin * 2;

  // Colors
  const brandBlue = rgb(0.11, 0.36, 0.80);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.9, 0.9, 0.9);

  // Prepare data
  const defaults = buildDefaultInvoiceData(booking, overrides);
  const data = { ...defaults, ...overrides };

  // Helper functions
  const drawText = (text, x, y, options = {}) => {
    const { font = fontRegular, size = 10, color = black, align = 'left', maxWidth = null } = options;
    page.setFont(font);
    page.setFontSize(size);
    page.setFontColor(color);
    
    let finalX = x;
    if (align === 'right' && maxWidth) {
      const textWidth = font.widthOfTextAtSize(text, size);
      finalX = x + maxWidth - textWidth;
    } else if (align === 'center' && maxWidth) {
      const textWidth = font.widthOfTextAtSize(text, size);
      finalX = x + (maxWidth - textWidth) / 2;
    }
    
    page.drawText(text, { x: finalX, y, font, size, color });
  };

  const wrapText = (text, maxWidth, font, size) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  const drawMultilineText = (text, x, y, maxWidth, options = {}) => {
    const { font = fontRegular, size = 9, color = black, lineHeight = 12 } = options;
    let currentY = y;
    
    // Split by newlines first, then wrap each line
    const paragraphs = text.split('\n');
    
    paragraphs.forEach(paragraph => {
      if (paragraph) {
        const wrappedLines = wrapText(paragraph, maxWidth, font, size);
        wrappedLines.forEach(line => {
          drawText(line, x, currentY, { font, size, color });
          currentY -= lineHeight;
        });
      } else {
        currentY -= lineHeight; // Empty line
      }
    });
    
    return currentY;
  };

  // Draw text-based logo: "namma" in green and "cabs" in black
  let currentY = A4_HEIGHT - margin;
  const logoHeight = 40; // Height for text logo
  
  // Draw "namma" in green
  const greenColor = rgb(0.086, 0.639, 0.298); // #16a34a green color
  drawText('namma', margin, currentY - 10, { font: fontBold, size: 24, color: greenColor });
  
  // Calculate width of "namma" to position "cabs" right after it
  const nammaWidth = fontBold.widthOfTextAtSize('namma', 24);
  const spacing = 4; // Small spacing between words
  
  // Draw "cabs" in black right after "namma"
  drawText('cabs', margin + nammaWidth + spacing, currentY - 10, { font: fontBold, size: 24, color: black });
  
  // Company details (right aligned, starting from top of logo area)
  const rightX = margin + contentWidth;
  let rightY = currentY;
  drawText('Bengaluru, Karnataka, India', rightX, rightY, { font: fontRegular, size: 9, align: 'right', maxWidth: 200 });
  rightY -= 12;
  drawText(`Phone: ${process.env.COMPANY_PHONE || '+91 00000 00000'}`, rightX, rightY, { font: fontRegular, size: 9, align: 'right', maxWidth: 200 });
  rightY -= 12;
  drawText(`Email: ${process.env.COMPANY_EMAIL || 'support@namma-cabs.com'}`, rightX, rightY, { font: fontRegular, size: 9, align: 'right', maxWidth: 200 });

  // Move currentY down past the logo/header area
  currentY -= Math.max(logoHeight, 40) + 15;

  // INVOICE banner
  page.drawRectangle({
    x: margin,
    y: currentY - 25,
    width: contentWidth,
    height: 25,
    color: brandBlue,
  });
  drawText('INVOICE', margin, currentY - 18, { font: fontBold, size: 14, color: rgb(1, 1, 1), align: 'center', maxWidth: contentWidth });

  currentY -= 45;

  // Two column layout for customer and invoice details
  const colWidth = (contentWidth - 30) / 2;

  // Customer Details (Left)
  drawText('Customer Details', margin, currentY, { font: fontBold, size: 11 });
  currentY -= 18;

  drawText('Customer Name', margin, currentY, { font: fontRegular, size: 8, color: gray });
  currentY -= 12;
  drawText(data.customer_name || '', margin, currentY, { font: fontRegular, size: 10 });
  currentY -= 18;

  drawText('Address', margin, currentY, { font: fontRegular, size: 8, color: gray });
  currentY -= 12;
  // Ensure address wraps properly within the left column width
  const addressMaxWidth = colWidth - 20; // Leave more margin for safety
  const afterAddress = drawMultilineText(data.customer_address || '', margin, currentY, addressMaxWidth, { 
    font: fontRegular,
    size: 9, 
    lineHeight: 12 
  });
  currentY = afterAddress - 10;

  drawText('Phone', margin, currentY, { font: fontRegular, size: 8, color: gray });
  currentY -= 12;
  drawText(data.customer_phone || '', margin, currentY, { font: fontRegular, size: 10 });

  // Invoice Details (Right) - start from top
  let invoiceY = A4_HEIGHT - margin - 55 - 45;
  const invoiceX = margin + colWidth + 30;

  drawText('Invoice Details', invoiceX, invoiceY, { font: fontBold, size: 11 });
  invoiceY -= 18;

  drawText('Invoice No', invoiceX, invoiceY, { font: fontRegular, size: 8, color: gray });
  invoiceY -= 12;
  drawText(data.invoice_no || '', invoiceX, invoiceY, { font: fontRegular, size: 10 });
  invoiceY -= 18;

  drawText('Invoice Date', invoiceX, invoiceY, { font: fontRegular, size: 8, color: gray });
  invoiceY -= 12;
  drawText(data.invoice_date || '', invoiceX, invoiceY, { font: fontRegular, size: 10 });
  invoiceY -= 18;

  // Show GSTIN only if withGST is true
  if (data.withGST && data.company_gstin) {
    drawText('Our GSTIN', invoiceX, invoiceY, { font: fontRegular, size: 8, color: gray });
    invoiceY -= 12;
    drawText(data.company_gstin, invoiceX, invoiceY, { font: fontBold, size: 10, color: brandBlue });
    invoiceY -= 18;

    drawText('HSN / SAC', invoiceX, invoiceY, { font: fontRegular, size: 8, color: gray });
    invoiceY -= 12;
    drawText(data.hsn_sac || '', invoiceX, invoiceY, { font: fontRegular, size: 10 });
  }

  // Continue from where customer details left off
  currentY -= 30;

  // Service Details Table
  const tableTop = currentY;
  const tableHeaderHeight = 22;

  // Table header background
  page.drawRectangle({
    x: margin,
    y: tableTop - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: lightGray,
  });

  // Table header text - adjusted column positions to prevent overlap
  const colPositions = {
    sl: margin + 5,
    desc: margin + 35,
    kms: margin + 220,
    days: margin + 280,
    rate: margin + 330,
    amount: margin + contentWidth - 75,
  };

  drawText('Sl No', colPositions.sl, tableTop - 15, { font: fontBold, size: 9 });
  drawText('Description', colPositions.desc, tableTop - 15, { font: fontBold, size: 9 });
  drawText('Total Kms', colPositions.kms, tableTop - 15, { font: fontBold, size: 9 });
  drawText('Days', colPositions.days, tableTop - 15, { font: fontBold, size: 9 });
  drawText('Rate Details', colPositions.rate, tableTop - 15, { font: fontBold, size: 9 });
  drawText('Amount (Rs)', colPositions.amount, tableTop - 15, { font: fontBold, size: 9 });

  // Table body
  let rowY = tableTop - tableHeaderHeight - 10;
  
  drawText(data.sl_no || '1', colPositions.sl, rowY, { font: fontRegular, size: 9 });
  // Wrap service description properly within the description column width
  // Adjusted max width to prevent overlap with other columns
  const descMaxWidth = 180; // Max width for description column (reduced from 210)
  const descEndY = drawMultilineText(data.service_description || '', colPositions.desc, rowY, descMaxWidth, { 
    font: fontRegular,
    size: 8, 
    lineHeight: 11 
  });
  drawText(data.total_kms || '0', colPositions.kms, rowY, { font: fontRegular, size: 9 });
  drawText(data.no_of_days || '-', colPositions.days, rowY, { font: fontRegular, size: 9 });
  // Rate details - truncate text to fit within column width and prevent overlap
  const rateMaxWidth = colPositions.amount - colPositions.rate - 10; // Leave 10px gap before amount
  let rateText = data.rate_details || '-';
  // Truncate text if it's too long to fit
  const rateTextWidth = fontRegular.widthOfTextAtSize(rateText, 8);
  if (rateTextWidth > rateMaxWidth) {
    // Find the maximum number of characters that fit
    let truncated = rateText;
    while (fontRegular.widthOfTextAtSize(truncated + '...', 8) > rateMaxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    rateText = truncated + (truncated.length < rateText.length ? '...' : '');
  }
  drawText(rateText, colPositions.rate, rowY, { font: fontRegular, size: 8 });
  drawText(data.service_amount || '0.00', colPositions.amount, rowY, { font: fontBold, size: 10 });

  // Table border
  const rowHeight = Math.abs(descEndY - rowY) + 20;
  page.drawRectangle({
    x: margin,
    y: descEndY - 10,
    width: contentWidth,
    height: rowHeight,
    borderColor: gray,
    borderWidth: 0.5,
  });

  currentY = descEndY - 30;

  // Charges Breakdown (right aligned)
  const breakdownX = margin + contentWidth - 250;
  const labelX = breakdownX;
  const valueX = breakdownX + 150;

  drawText('Charges Breakdown', labelX, currentY, { font: fontBold, size: 11 });
  currentY -= 20;

  const addCharge = (label, value) => {
    drawText(label, labelX, currentY, { font: fontRegular, size: 9 });
    drawText(value, valueX, currentY, { font: fontRegular, size: 9 });
    currentY -= 14;
  };

  if (parseFloat(data.toll_tax) > 0) addCharge('Toll Tax', data.toll_tax);
  if (parseFloat(data.state_tax) > 0) addCharge('State Tax', data.state_tax);
  if (parseFloat(data.parking_charges) > 0) addCharge('Parking Charges', data.parking_charges);
  
  addCharge('Sub Total', data.sub_total);
  
  if (data.withGST) {
    addCharge('CGST @ 9%', data.cgst_amount);
    addCharge('SGST @ 9%', data.sgst_amount);
    currentY -= 3;
    drawText('Total GST (18%)', labelX, currentY, { font: fontBold, size: 9 });
    drawText(data.gst_amount, valueX, currentY, { font: fontBold, size: 9 });
    currentY -= 17;
  } else {
    currentY -= 3;
  }

  // Grand total with background
  page.drawRectangle({
    x: breakdownX - 5,
    y: currentY - 3,
    width: 255,
    height: 16,
    color: lightGray,
  });
  drawText('Grand Total', labelX, currentY, { font: fontBold, size: 10 });
  drawText(`Rs ${data.grand_total}`, valueX, currentY, { font: fontBold, size: 11, color: brandBlue });

  currentY -= 35;

  // Terms & Conditions
  drawText('Terms & Conditions', margin, currentY, { font: fontBold, size: 10 });
  currentY -= 14;
  
  const terms = [
    '1. All disputes are subject to Bengaluru jurisdiction only.',
    '2. Waiting and detentions will be charged as per company policy.',
    '3. Tolls, parking, and state taxes are extra unless specified.',
    '4. Please verify all details; no claims will be entertained after 7 days.',
  ];
  
  terms.forEach(term => {
    drawText(term, margin, currentY, { font: fontRegular, size: 8, color: gray });
    currentY -= 11;
  });

  // Footer removed - no longer showing "computer generated invoice" text

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = {
  buildDefaultInvoiceData,
  generateInvoicePdf,
};


