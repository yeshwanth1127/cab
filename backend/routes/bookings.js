const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { sendBookingConfirmationEmail } = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');
const { getCarCategory } = require('../utils/carMapping');
const { getDistanceAndTime } = require('../services/googleDistanceService');
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
  body('from_location').optional().notEmpty().withMessage('From location is required for local and airport bookings'),
  body('to_location').optional().notEmpty().withMessage('To location is required for airport bookings'),
  body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('trip_type').optional().isIn(['one_way', 'round_trip', 'multiple_way']).withMessage('Trip type must be one_way, round_trip, or multiple_way'),
  body('number_of_hours').optional().isInt({ min: 1 }).withMessage('Number of hours must be a positive integer'),
  body('number_of_days').optional().isInt({ min: 1 }).withMessage('Number of days must be a positive integer'),
  body('cab_type_id').optional().isInt().withMessage('Cab type ID must be an integer'),
  body('distance_km').optional().isNumeric().withMessage('Distance must be a number'),
  body('from').optional().custom((value) => {
    if (value && (!value.lat || !value.lng)) {
      throw new Error('from must have lat and lng');
    }
    return true;
  }),
  body('to').optional().custom((value) => {
    if (value && (!value.lat || !value.lng)) {
      throw new Error('to must have lat and lng');
    }
    return true;
  }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { from, to, from_location, to_location, cab_type_id, service_type, trip_type, distance_km, estimated_time_minutes, number_of_hours, number_of_days } = req.body;
    
    console.log('[BACKEND DEBUG] ========== CALCULATE FARE REQUEST ==========');
    console.log('[BACKEND DEBUG] service_type:', service_type);
    console.log('[BACKEND DEBUG] from:', JSON.stringify(from, null, 2));
    console.log('[BACKEND DEBUG] to:', JSON.stringify(to, null, 2));
    console.log('[BACKEND DEBUG] from_location:', from_location);
    console.log('[BACKEND DEBUG] to_location:', to_location);
    console.log('[BACKEND DEBUG] cab_type_id:', cab_type_id);

    // Validate local bookings require number_of_hours (strict validation)
    if (service_type === 'local') {
      if (!from_location) {
        return res.status(400).json({ error: 'From location is required for local bookings' });
      }
      if (!number_of_hours || number_of_hours <= 0) {
        return res.status(400).json({ error: 'Number of hours is required and must be greater than 0 for local bookings' });
      }
      // Ensure number_of_hours is a valid integer
      if (!Number.isInteger(Number(number_of_hours))) {
        return res.status(400).json({ error: 'Number of hours must be a valid integer for local bookings' });
      }
    } else if (service_type === 'outstation') {
      // Validate outstation bookings require trip_type
      if (!trip_type || (typeof trip_type === 'string' && !trip_type.trim())) {
        return res.status(400).json({ error: 'Trip type is required for outstation bookings' });
      }
      // For round trip outstation, number_of_days is required
      if (trip_type === 'round_trip') {
        if (!number_of_days || Number(number_of_days) <= 0) {
          return res.status(400).json({ error: 'Number of days is required and must be greater than 0 for outstation round trips' });
        }
        if (!Number.isInteger(Number(number_of_days))) {
          return res.status(400).json({ error: 'Number of days must be a valid integer for outstation round trips' });
        }
      }
    } else {
      // Validate airport bookings require from_location and to_location
      if (!from_location || !to_location) {
        return res.status(400).json({ error: 'From location and To location are required for airport bookings' });
      }
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

    // Local bookings: ONLY hours-based, do NOT use Google Distance Matrix
    if (service_type === 'local') {
      console.log('[DISTANCE DEBUG] local booking - using hours only, ignoring distance');
      if (!number_of_hours) {
        return res.status(400).json({ error: 'Number of hours is required for local bookings' });
      }
      distance = 0;
      time = number_of_hours * 60; // minutes
      console.log('[DISTANCE DEBUG] local booking - Final distance:', distance, 'km');
      console.log('[DISTANCE DEBUG] local booking - Final time:', time, 'minutes');
    } else {
      // Airport + Outstation: use Google Distance Matrix when coordinates are provided
      console.log(`[DISTANCE DEBUG] ${service_type} booking - checking for distance calculation`);
      console.log('[DISTANCE DEBUG] from:', JSON.stringify(from, null, 2));
      console.log('[DISTANCE DEBUG] to:', JSON.stringify(to, null, 2));
      console.log('[DISTANCE DEBUG] distance_km provided:', distance_km);
      
      if (!distance && from && to && from.lat && from.lng && to.lat && to.lng) {
        console.log(`[DISTANCE DEBUG] ${service_type} booking - coordinates valid, calculating distance...`);
        try {
          // First, check cache (routes table with coordinates)
          const tolerance = 0.001; // ~100 meters tolerance
          const cachedRoute = await db.getAsync(
            `SELECT distance_km, estimated_time_minutes FROM routes 
             WHERE from_lat IS NOT NULL 
             AND from_lng IS NOT NULL 
             AND to_lat IS NOT NULL 
             AND to_lng IS NOT NULL
             AND ABS(from_lat - ?) < ? 
             AND ABS(from_lng - ?) < ?
             AND ABS(to_lat - ?) < ?
             AND ABS(to_lng - ?) < ?
             AND is_active = 1
             LIMIT 1`,
            [from.lat, tolerance, from.lng, tolerance, to.lat, tolerance, to.lng, tolerance]
          );

          if (cachedRoute) {
            console.log(`[DISTANCE DEBUG] Using cached route for ${service_type}:`, cachedRoute);
            distance = parseFloat(cachedRoute.distance_km);
            time = cachedRoute.estimated_time_minutes;
          } else {
            console.log(`[DISTANCE DEBUG] No cache found for ${service_type}, calling Google Distance Matrix API...`);
            // Call Google Distance Matrix API
            const result = await getDistanceAndTime(from, to);
            console.log(`[DISTANCE DEBUG] Google API result for ${service_type}:`, result);
            distance = result.distance_km;
            time = result.duration_min;

            // Cache the result in routes table
            try {
              await db.runAsync(
                `INSERT INTO routes (from_location, to_location, from_lat, from_lng, to_lat, to_lng, distance_km, estimated_time_minutes, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                  from_location || '',
                  to_location || '',
                  from.lat,
                  from.lng,
                  to.lat,
                  to.lng,
                  distance,
                  time
                ]
              );
              console.log(`[DISTANCE DEBUG] ${service_type} route cached successfully`);
            } catch (cacheError) {
              // Log but don't fail if caching fails
              console.warn(`[DISTANCE DEBUG] Failed to cache ${service_type} route:`, cacheError.message);
            }
          }
        } catch (error) {
          console.error(`[DISTANCE DEBUG] Error calculating distance for ${service_type}:`, error);
          console.error('[DISTANCE DEBUG] Error stack:', error.stack);
          
          // For airport bookings, distance is required - return error
          if (service_type === 'airport') {
            return res.status(500).json({ 
              error: 'Failed to calculate distance. Please try again.',
              details: error.message 
            });
          }
          
          // For outstation, if distance calculation fails, proceed with 0 distance
          console.warn(`[DISTANCE DEBUG] ${service_type} booking will proceed with distance = 0`);
          distance = 0;
          time = 0;
        }
      } else {
        console.log(`[DISTANCE DEBUG] ${service_type} booking - no coordinates provided or distance already set`);
        console.log('[DISTANCE DEBUG] from exists:', !!from);
        console.log('[DISTANCE DEBUG] to exists:', !!to);
        if (from) console.log('[DISTANCE DEBUG] from has lat/lng:', !!from.lat, !!from.lng);
        if (to) console.log('[DISTANCE DEBUG] to has lat/lng:', !!to.lat, !!to.lng);
        
        // For airport bookings, coordinates are required
        if (service_type === 'airport' && (!from || !to)) {
          return res.status(400).json({ 
            error: 'From and To coordinates (lat, lng) are required for airport bookings' 
          });
        }

        // For outstation without coordinates, distance/time stay 0 (multiplier-based fare)
        if (service_type === 'outstation') {
          if (!distance) distance = 0;
          if (!time) time = 0;
        }
      }
      
      console.log(`[DISTANCE DEBUG] ${service_type} booking - Final distance:`, distance, 'km');
      console.log(`[DISTANCE DEBUG] ${service_type} booking - Final time:`, time, 'minutes');
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
      } else if (service_type === 'outstation' && trip_type) {
        // Outstation bookings
        if (trip_type === 'round_trip') {
          // Round trip: 300 km per day, distance-based
          const days = Number(number_of_days) && Number(number_of_days) > 0
            ? parseInt(number_of_days, 10)
            : 1;
          const perKmRate = parseFloat(rateMeter.per_km_rate || 0);
          const totalKm = 300 * days;

          distance = totalKm; // For reporting
          distanceCharge = totalKm * perKmRate;
          timeCharge = 0;
          fare = baseFare + distanceCharge;
        } else {
          // One-way and multiple-way: distance-based using Google-calculated distance
          const perKmRate = parseFloat(rateMeter.per_km_rate || 0);
          const effectiveDistance = distance || 0;
          distanceCharge = effectiveDistance * perKmRate;
          timeCharge = 0;
          fare = baseFare + distanceCharge;
        }
      } else {
        // Airport use per_km and per_minute
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
      
      if (service_type === 'outstation' && trip_type) {
        // Apply trip type multiplier for outstation
        const tripMultipliers = {
          'one_way': 1.0,
          'round_trip': 1.8,
          'multiple_way': 2.2,
        };
        multiplier = multiplier * (tripMultipliers[trip_type] || 1.0);
      }
      
      baseFare = parseFloat(cabType.base_fare);
      distanceCharge = distance * parseFloat(cabType.per_km_rate);
      timeCharge = time * parseFloat(cabType.per_minute_rate || 0);
      const subtotal = baseFare + distanceCharge + timeCharge;
      fare = subtotal * multiplier;
    }

    const responseData = {
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
        number_of_days: service_type === 'outstation' && trip_type === 'round_trip' ? number_of_days || 1 : null,
      },
    };
    
    console.log('[BACKEND DEBUG] ========== CALCULATE FARE RESPONSE ==========');
    console.log('[BACKEND DEBUG] Final distance_km:', distance);
    console.log('[BACKEND DEBUG] Final estimated_time_minutes:', time);
    console.log('[BACKEND DEBUG] Final fare:', responseData.fare);
    console.log('[BACKEND DEBUG] Full response:', JSON.stringify(responseData, null, 2));
    
    res.json(responseData);
  } catch (error) {
    console.error('Error calculating fare:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create booking (attaches user_id if authenticated)
router.post('/', [
  body('from_location').optional().notEmpty().withMessage('From location is required for local and airport bookings'),
  body('to_location').optional().notEmpty().withMessage('To location is required for airport bookings'),
  body('service_type').isIn(['local', 'airport', 'outstation']).withMessage('Service type must be local, airport, or outstation'),
  body('trip_type').optional().isIn(['one_way', 'round_trip', 'multiple_way']).withMessage('Trip type must be one_way, round_trip, or multiple_way'),
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
      trip_type,
      stops,
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

    // Validate local bookings require number_of_hours and from_location
    if (service_type === 'local') {
      if (!from_location) {
        return res.status(400).json({ error: 'From location is required for local bookings' });
      }
      if (!number_of_hours) {
        return res.status(400).json({ error: 'Number of hours is required for local bookings' });
      }
    } else if (service_type === 'outstation') {
      // Validate outstation bookings require trip_type
      if (!trip_type || (typeof trip_type === 'string' && !trip_type.trim())) {
        return res.status(400).json({ error: 'Trip type is required for outstation bookings' });
      }
    } else {
      // Validate airport bookings require from_location and to_location
      if (!from_location || !to_location) {
        return res.status(400).json({ error: 'From location and To location are required for airport bookings' });
      }
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
      } else if (service_type === 'outstation') {
        // For outstation, we don't have from/to locations, so use defaults
        // The fare will be calculated based on base fare and trip type multiplier
        distance = 0; // Will be calculated later if needed
        time = 0; // Will be calculated later if needed
      } else if (!distance && req.body.from && req.body.to && req.body.from.lat && req.body.from.lng && req.body.to.lat && req.body.to.lng) {
        // Airport bookings: use Google Distance Matrix API
        try {
          // First, check cache (routes table with coordinates)
          const tolerance = 0.001; // ~100 meters tolerance
          const cachedRoute = await db.getAsync(
            `SELECT distance_km, estimated_time_minutes FROM routes 
             WHERE from_lat IS NOT NULL 
             AND from_lng IS NOT NULL 
             AND to_lat IS NOT NULL 
             AND to_lng IS NOT NULL
             AND ABS(from_lat - ?) < ? 
             AND ABS(from_lng - ?) < ?
             AND ABS(to_lat - ?) < ?
             AND ABS(to_lng - ?) < ?
             AND is_active = 1
             LIMIT 1`,
            [req.body.from.lat, tolerance, req.body.from.lng, tolerance, req.body.to.lat, tolerance, req.body.to.lng, tolerance]
          );

          if (cachedRoute) {
            distance = parseFloat(cachedRoute.distance_km);
            time = cachedRoute.estimated_time_minutes;
          } else {
            // Call Google Distance Matrix API
            const result = await getDistanceAndTime(req.body.from, req.body.to);
            distance = result.distance_km;
            time = result.duration_min;

            // Cache the result in routes table
            try {
              await db.runAsync(
                `INSERT INTO routes (from_location, to_location, from_lat, from_lng, to_lat, to_lng, distance_km, estimated_time_minutes, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                  from_location || '',
                  to_location || '',
                  req.body.from.lat,
                  req.body.from.lng,
                  req.body.to.lat,
                  req.body.to.lng,
                  distance,
                  time
                ]
              );
            } catch (cacheError) {
              // Log but don't fail if caching fails
              console.warn('Failed to cache route:', cacheError.message);
            }
          }
        } catch (error) {
          console.error('Error calculating distance:', error);
          return res.status(500).json({ 
            error: 'Failed to calculate distance. Please try again.',
            details: error.message 
          });
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
          } else if (service_type === 'outstation') {
            // Outstation bookings: apply trip type multiplier
            const tripMultipliers = {
              'one_way': 1.0,
              'round_trip': 1.8, // 80% extra for round trip
              'multiple_way': 2.2, // 120% extra for multiple way
            };
            const tripMultiplier = tripMultipliers[trip_type] || 1.0;
            // For outstation, use base fare with trip type multiplier
            fare = baseFare * tripMultiplier;
            distanceCharge = 0;
            timeCharge = 0;
          } else {
            // Airport use per_km and per_minute
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
          let multiplier = serviceMultipliers[service_type] || 1.0;
          
          if (service_type === 'outstation' && trip_type) {
            // Apply trip type multiplier for outstation
            const tripMultipliers = {
              'one_way': 1.0,
              'round_trip': 1.8,
              'multiple_way': 2.2,
            };
            multiplier = multiplier * (tripMultipliers[trip_type] || 1.0);
          }
          
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
        passenger_email, travel_date, notes, service_type, number_of_hours, trip_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        cab_id,
        cab_type_id,
        req.body.car_option_id || null,
        from_location || null,
        (service_type === 'local') ? 'N/A' : (to_location || 'N/A'), // Set 'N/A' only for local bookings
        distance || 0,
        time || 0,
        fare,
        'pending',
        passenger_name,
        passenger_phone,
        passenger_email, // Now required
        travel_date || null,
        (() => {
          // For multiple way trips, add stops to notes
          if (service_type === 'outstation' && trip_type === 'multiple_way' && stops) {
            try {
              const stopsArray = typeof stops === 'string' ? JSON.parse(stops) : stops;
              if (Array.isArray(stopsArray) && stopsArray.length > 0) {
                const stopsText = `Stops: ${stopsArray.join(' → ')}`;
                return notes ? `${notes}\n${stopsText}` : stopsText;
              }
            } catch (e) {
              // If parsing fails, just use original notes
            }
          }
          return notes || null;
        })(),
        service_type || 'local',
        service_type === 'local' ? (number_of_hours ? parseInt(number_of_hours) : null) : null,
        service_type === 'outstation' ? (trip_type && trip_type.trim() ? trip_type.trim() : null) : null,
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

// Download GST-compliant fillable invoice PDF for a booking (only owner or admin)
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

    const { generateInvoicePdf } = require('../services/invoiceService');
    const pdfBytes = await generateInvoicePdf(booking, {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking.id}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Error generating invoice' });
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
