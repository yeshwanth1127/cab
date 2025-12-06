const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { sendBookingConfirmationEmail } = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');
const { getCarCategory } = require('../utils/carMapping');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '..', 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const router = express.Router();

// Calculate fare
router.post('/calculate-fare', [
  body('from_location').notEmpty().withMessage('From location is required'),
  body('to_location').optional().notEmpty().withMessage('To location is required for non-local bookings'),
  body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('number_of_hours').optional().isInt({ min: 1 }).withMessage('Number of hours must be a positive integer'),
  body('cab_type_id').optional().isInt().withMessage('Cab type ID must be an integer'),
  body('distance_km').optional().isNumeric().withMessage('Distance must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { from_location, to_location, cab_type_id, service_type, distance_km, estimated_time_minutes, number_of_hours } = req.body;

    // Validate local bookings require number_of_hours (strict validation)
    if (service_type === 'local') {
      if (!number_of_hours || number_of_hours <= 0) {
        return res.status(400).json({ error: 'Number of hours is required and must be greater than 0 for local bookings' });
      }
      // Ensure number_of_hours is a valid integer
      if (!Number.isInteger(Number(number_of_hours))) {
        return res.status(400).json({ error: 'Number of hours must be a valid integer for local bookings' });
      }
    }

    // Validate non-local bookings require to_location
    if (service_type !== 'local' && !to_location) {
      return res.status(400).json({ error: 'To location is required for this service type' });
    }

    // Resolve rate meter: use service_type and car_category from car_option
    let rateMeter = null;
    let carCategory = null;
    let effectiveCabTypeId = cab_type_id;

    // Get car option to determine car category
    if (cab_type_id) {
      // cab_type_id might actually be car_option_id in the request
      const carOption = await db.getAsync(
        'SELECT * FROM car_options WHERE id = ? AND is_active = 1',
        [cab_type_id]
      );
      if (carOption) {
        carCategory = getCarCategory(carOption);
      }
    }

    // If no car category found, default to Sedan
    if (!carCategory) {
      carCategory = 'Sedan';
    }

    // Get rate meter for this service type and car category
    rateMeter = await db.getAsync(
      'SELECT * FROM rate_meters WHERE service_type = ? AND car_category = ? AND is_active = 1',
      [service_type, carCategory]
    );

    // Fallback to any rate meter for this service type if specific category not found
    if (!rateMeter) {
      rateMeter = await db.getAsync(
        'SELECT * FROM rate_meters WHERE service_type = ? AND is_active = 1 LIMIT 1',
        [service_type]
      );
    }

    // Final fallback: use cab_types (legacy support)
    let cabType = null;
    if (!rateMeter) {
      if (effectiveCabTypeId) {
        cabType = await db.getAsync(
          'SELECT * FROM cab_types WHERE id = ? AND is_active = 1',
          [effectiveCabTypeId]
        );
      } else {
        cabType = await db.getAsync(
          'SELECT * FROM cab_types WHERE LOWER(name) = LOWER(?) AND is_active = 1',
          [service_type]
        );
        if (cabType) {
          effectiveCabTypeId = cabType.id;
        }
      }

      if (!cabType) {
        cabType = await db.getAsync(
          'SELECT * FROM cab_types WHERE is_active = 1 LIMIT 1'
        );
        if (!cabType) {
          return res.status(404).json({ error: 'No active rate meters or cab types configured' });
        }
        effectiveCabTypeId = cabType.id;
      }
    }

    let distance = distance_km;
    let time = estimated_time_minutes;

    // For local bookings, use hours instead of distance
    if (service_type === 'local') {
      if (number_of_hours) {
        time = number_of_hours * 60; // Convert hours to minutes
        distance = 0; // Local bookings don't use distance
      } else {
        return res.status(400).json({ error: 'Number of hours is required for local bookings' });
      }
    } else {
      // For airport/outstation, check if route exists in database
      if (!distance && to_location) {
        const route = await db.getAsync(
          `SELECT distance_km, estimated_time_minutes FROM routes 
           WHERE LOWER(from_location) = LOWER(?) AND LOWER(to_location) = LOWER(?) AND is_active = 1`,
          [from_location, to_location]
        );

        if (route) {
          distance = parseFloat(route.distance_km);
          time = route.estimated_time_minutes;
        } else {
          // Default distance calculation (you can integrate with Google Maps API here)
          // For now, using a simple estimate: 10km default
          distance = 10;
          time = 20;
        }
      }
    }

    // Calculate fare using rate meter if available, otherwise use cab type (legacy)
    let baseFare, distanceCharge, timeCharge, fare;
    let multiplier = 1.0;

    if (rateMeter) {
      // Use rate meter for fare calculation
      baseFare = parseFloat(rateMeter.base_fare);
      
      if (service_type === 'local' && number_of_hours) {
        // Local bookings use per_hour_rate
        const hourCharge = number_of_hours * parseFloat(rateMeter.per_hour_rate);
        fare = baseFare + hourCharge;
        distanceCharge = 0;
        timeCharge = hourCharge;
      } else {
        // Airport/Outstation use per_km and per_minute
        distanceCharge = distance * parseFloat(rateMeter.per_km_rate);
        timeCharge = time * parseFloat(rateMeter.per_minute_rate || 0);
        fare = baseFare + distanceCharge + timeCharge;
      }
    } else {
      // Legacy: use cab type with service multiplier
      const serviceMultipliers = {
        'local': 1.0,
        'airport': 1.2, // 20% extra for airport
        'outstation': 1.5, // 50% extra for outstation
      };
      multiplier = serviceMultipliers[service_type] || 1.0;
      
      baseFare = parseFloat(cabType.base_fare);
      distanceCharge = distance * parseFloat(cabType.per_km_rate);
      timeCharge = time * parseFloat(cabType.per_minute_rate || 0);
      const subtotal = baseFare + distanceCharge + timeCharge;
      fare = subtotal * multiplier;
    }

    res.json({
      fare: Math.round(fare * 100) / 100, // Round to 2 decimal places
      distance_km: distance,
      estimated_time_minutes: time,
      number_of_hours: service_type === 'local' ? number_of_hours : null,
      service_type: service_type,
      breakdown: {
        base_fare: baseFare || 0,
        distance_charge: distanceCharge || 0,
        time_charge: timeCharge || 0,
        service_multiplier: rateMeter ? 1.0 : multiplier,
        service_type: service_type,
        number_of_hours: service_type === 'local' ? number_of_hours : null,
      },
    });
  } catch (error) {
    console.error('Error calculating fare:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create booking (attaches user_id if authenticated)
router.post('/', [
  body('from_location').notEmpty().withMessage('From location is required'),
  body('to_location').optional().notEmpty().withMessage('To location is required for non-local bookings'),
  body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('number_of_hours').optional().isInt({ min: 1 }).withMessage('Number of hours must be a positive integer'),
  body('cab_type_id').optional().isInt().withMessage('Cab type ID must be an integer'),
  body('car_option_id').optional().isInt().withMessage('Car option ID must be an integer'),
  body('passenger_name').notEmpty().withMessage('Passenger name is required'),
  body('passenger_phone').notEmpty().withMessage('Passenger phone is required'),
  body('passenger_email').isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      from_location,
      to_location,
      cab_type_id,
      service_type,
      passenger_name,
      passenger_phone,
      passenger_email,
      distance_km,
      estimated_time_minutes,
      fare_amount,
      travel_date,
      notes,
      number_of_hours,
    } = req.body;

    // Validate local bookings require number_of_hours
    if (service_type === 'local' && !number_of_hours) {
      return res.status(400).json({ error: 'Number of hours is required for local bookings' });
    }

    // Validate non-local bookings require to_location
    if (service_type !== 'local' && !to_location) {
      return res.status(400).json({ error: 'To location is required for this service type' });
    }

    // Try to attach user_id if a valid token is provided
    let userId = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = require('jsonwebtoken').verify(
          token,
          process.env.JWT_SECRET || 'your_secret_key'
        );
        userId = decoded.id;
      } catch (e) {
        // Ignore invalid token for public booking; booking still succeeds without user_id
        userId = null;
      }
    }

    // Resolve cab type and calculate fare if not provided
    let fare = fare_amount;
    let distance = distance_km;
    let time = estimated_time_minutes;

    if (!fare || !distance) {
      // Resolve rate meter: use service_type and car_category from car_option
      let rateMeter = null;
      let carCategory = null;
      let effectiveCabTypeId = cab_type_id;

      // Get car option to determine car category
      if (req.body.car_option_id) {
        const carOption = await db.getAsync(
          'SELECT * FROM car_options WHERE id = ? AND is_active = 1',
          [req.body.car_option_id]
        );
        if (carOption) {
          carCategory = getCarCategory(carOption);
        }
      } else if (effectiveCabTypeId) {
        // cab_type_id might actually be car_option_id
        const carOption = await db.getAsync(
          'SELECT * FROM car_options WHERE id = ? AND is_active = 1',
          [effectiveCabTypeId]
        );
        if (carOption) {
          carCategory = getCarCategory(carOption);
        }
      }

      // If no car category found, default to Sub
      if (!carCategory) {
        carCategory = 'Sub';
      }

      // Get rate meter for this service type and car category
      rateMeter = await db.getAsync(
        'SELECT * FROM rate_meters WHERE service_type = ? AND car_category = ? AND is_active = 1',
        [service_type, carCategory]
      );

      // Fallback to any rate meter for this service type
      if (!rateMeter) {
        rateMeter = await db.getAsync(
          'SELECT * FROM rate_meters WHERE service_type = ? AND is_active = 1 LIMIT 1',
          [service_type]
        );
      }

      // Final fallback: use cab_types (legacy support)
      let cabType = null;
      if (!rateMeter) {
        if (effectiveCabTypeId) {
          cabType = await db.getAsync(
            'SELECT * FROM cab_types WHERE id = ? AND is_active = 1',
            [effectiveCabTypeId]
          );
        } else {
          cabType = await db.getAsync(
            'SELECT * FROM cab_types WHERE LOWER(name) = LOWER(?) AND is_active = 1',
            [service_type]
          );
          if (cabType) {
            effectiveCabTypeId = cabType.id;
          }
        }

        if (!cabType) {
          cabType = await db.getAsync(
            'SELECT * FROM cab_types WHERE is_active = 1 LIMIT 1'
          );
          if (!cabType) {
            return res.status(404).json({ error: 'No active rate meters or cab types configured' });
          }
          effectiveCabTypeId = cabType.id;
        }
      }

      // For local bookings, use hours instead of distance
      if (service_type === 'local') {
        if (number_of_hours) {
          time = number_of_hours * 60; // Convert hours to minutes
          distance = 0; // Local bookings don't use distance
        }
      } else if (!distance && to_location) {
        const route = await db.getAsync(
          `SELECT distance_km, estimated_time_minutes FROM routes 
           WHERE LOWER(from_location) = LOWER(?) AND LOWER(to_location) = LOWER(?) AND is_active = 1`,
          [from_location, to_location]
        );

        if (route) {
          distance = parseFloat(route.distance_km);
          time = route.estimated_time_minutes;
        } else {
          distance = 10; // Default
          time = 20;
        }
      }

      if (!fare) {
        let baseFare, distanceCharge, timeCharge;

        if (rateMeter) {
          // Use rate meter for fare calculation
          baseFare = parseFloat(rateMeter.base_fare);
          
          if (service_type === 'local' && number_of_hours) {
            // Local bookings use per_hour_rate
            const hourCharge = number_of_hours * parseFloat(rateMeter.per_hour_rate);
            fare = baseFare + hourCharge;
            distanceCharge = 0;
            timeCharge = hourCharge;
          } else {
            // Airport/Outstation use per_km and per_minute
            distanceCharge = distance * parseFloat(rateMeter.per_km_rate);
            timeCharge = time * parseFloat(rateMeter.per_minute_rate || 0);
            fare = baseFare + distanceCharge + timeCharge;
          }
        } else {
          // Legacy: use cab type with service multiplier
          const serviceMultipliers = {
            'local': 1.0,
            'airport': 1.2,
            'outstation': 1.5,
          };
          const multiplier = serviceMultipliers[service_type] || 1.0;
          const subtotal = parseFloat(cabType.base_fare) + 
                          (distance * parseFloat(cabType.per_km_rate)) + 
                          (time * parseFloat(cabType.per_minute_rate || 0));
          fare = subtotal * multiplier;
        }
      }

      // Update cab_type_id to the effective one we resolved (for legacy support)
      if (!rateMeter && cabType) {
        req.body.cab_type_id = effectiveCabTypeId;
        cab_type_id = effectiveCabTypeId;
      }
    }

    // Find an available cab
    const cab = await db.getAsync(
      `SELECT id FROM cabs 
       WHERE cab_type_id = ? AND is_available = 1 AND is_active = 1 
       LIMIT 1`,
      [cab_type_id]
    );

    const cab_id = cab ? cab.id : null;

    // Create booking
    const result = await db.runAsync(
      `INSERT INTO bookings (
        user_id, cab_id, cab_type_id, car_option_id, from_location, to_location, distance_km, 
        estimated_time_minutes, fare_amount, booking_status, passenger_name, passenger_phone, 
        passenger_email, travel_date, notes, service_type, number_of_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        cab_id,
        cab_type_id,
        req.body.car_option_id || null,
        from_location,
        service_type === 'local' ? 'N/A' : (to_location || 'N/A'), // Set 'N/A' for local bookings to satisfy NOT NULL constraint
        distance,
        time,
        fare,
        'pending',
        passenger_name,
        passenger_phone,
        passenger_email, // Now required
        travel_date || null,
        notes || null,
        service_type || 'local',
        service_type === 'local' ? (number_of_hours ? parseInt(number_of_hours) : null) : null,
      ]
    );

    // Mark cab as unavailable if assigned
    if (cab_id) {
      await db.runAsync('UPDATE cabs SET is_available = 0 WHERE id = ?', [cab_id]);
    }

    // Get full booking details with joins
    const newBooking = await db.getAsync(
      `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name, c.driver_phone
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       WHERE b.id = ?`,
      [result.lastID]
    );

    // Send confirmation email (non-blocking)
    sendBookingConfirmationEmail(newBooking)
      .then((result) => {
        if (result.success) {
          console.log('Booking confirmation email sent successfully');
        } else {
          console.log('Failed to send email:', result.message || result.error);
        }
      })
      .catch((error) => {
        console.error('Error sending email:', error);
      });

    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bookings for current logged-in user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const bookings = await db.allAsync(
      `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC`,
      [req.user.id]
    );

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download receipt PDF for a booking (only owner or admin)
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await db.getAsync(
      `SELECT b.*, u.username, u.email, ct.name as cab_type_name, co.name as car_option_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       WHERE b.id = ?`,
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only owner or admin can download
    if (req.user.role !== 'admin' && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to access this receipt' });
    }

    const doc = new PDFDocument({ margin: 50 });

    const filename = `booking-${booking.id}-receipt.pdf`;
    const filePath = path.join(receiptsDir, filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Save to disk and stream to client at the same time
    const fileStream = fs.createWriteStream(filePath);
    doc.pipe(fileStream);
    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .text('Namma Cabs – Booking Receipt', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .text(`Receipt ID: NC-${booking.id}`, { align: 'center' })
      .text(`Date: ${new Date(booking.booking_date).toLocaleString()}`, {
        align: 'center',
      })
      .moveDown(1.5);

    // Customer
    doc.fontSize(14).text('Customer Details', { underline: true }).moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Name: ${booking.passenger_name || booking.username || ''}`)
      .text(`Phone: ${booking.passenger_phone || '-'}`)
      .text(`Email: ${booking.passenger_email || booking.email || '-'}`)
      .moveDown(1);

    // Trip
    doc.fontSize(14).text('Trip Details', { underline: true }).moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Service Type: ${booking.service_type === 'local' ? 'Local' : booking.service_type === 'airport' ? 'Airport' : 'Outstation'}`)
      .text(`From: ${booking.from_location}`)
      .text(`To: ${booking.to_location}`)
      .text(`Cab Type: ${booking.cab_type_name || 'Cab'}`)
      .text(`Car Option: ${booking.car_option_name || 'Not specified'}`)
      .text(`Distance: ${booking.distance_km} km`)
      .text(`Estimated Time: ${booking.estimated_time_minutes} minutes`)
      .text(`Travel Date: ${
        booking.travel_date
          ? new Date(booking.travel_date).toLocaleString()
          : 'Not specified'
      }`)
      .moveDown(1);

    // Fare
    doc.fontSize(14).text('Fare Summary', { underline: true }).moveDown(0.5);
    doc.fontSize(12).text(`Total Fare: ₹${booking.fare_amount.toFixed(2)}`);
    doc.text(`Status: ${booking.booking_status}`);
    if (booking.notes) {
      doc.moveDown(0.5).text(`Notes: ${booking.notes}`);
    }

    doc.moveDown(2).fontSize(10).text('Thank you for riding with Namma Cabs!', {
      align: 'center',
    });

    doc.end();
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Error generating receipt' });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.getAsync(
      `SELECT b.*, ct.name as cab_type_name, co.name as car_option_name,
              c.vehicle_number, c.driver_name, c.driver_phone
       FROM bookings b
       LEFT JOIN cab_types ct ON b.cab_type_id = ct.id
       LEFT JOIN car_options co ON b.car_option_id = co.id
       LEFT JOIN cabs c ON b.cab_id = c.id
       WHERE b.id = ?`,
      [id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
