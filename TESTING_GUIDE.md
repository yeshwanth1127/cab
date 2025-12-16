# 🧪 Google Maps Migration - Testing Guide

## ✅ Pre-Testing Checklist

Before you start testing, ensure:

- [ ] Frontend Google Maps API key is added to `index.html`
- [ ] Backend `.env` file has `GOOGLE_MAPS_BACKEND_KEY` set
- [ ] Backend server is running
- [ ] Frontend is built and running
- [ ] Database migration has run (check server logs for "Migration: from_lat column added to routes")

---

## 🧪 Test 1: Location Autocomplete (Frontend)

### What to Test:
Google Places Autocomplete should appear when typing in location fields.

### How to Test:

1. **Open Booking Page:**
   - Navigate to your booking page
   - Select a service type (Local, Airport, or Outstation)

2. **Test Autocomplete:**
   - Click on "Pickup Location" or "From Location" field
   - Start typing: "Bangalore" or "Mysore" or any city name
   - **Expected:** Google Places suggestions dropdown should appear
   - **Expected:** Suggestions should be relevant to your input
   - **Expected:** Suggestions should show full addresses

3. **Select a Location:**
   - Click on any suggestion
   - **Expected:** Input field should be filled with the full address
   - **Expected:** Location object is stored (lat/lng captured)

### ✅ Success Criteria:
- [ ] Autocomplete dropdown appears
- [ ] Suggestions are relevant
- [ ] Selecting a suggestion fills the input
- [ ] No console errors in browser

### ❌ If It Fails:
- Check browser console for errors
- Verify API key is correct in `index.html`
- Check if Places API is enabled in Google Cloud Console
- Verify API key restrictions allow your domain

---

## 🧪 Test 2: Current Location Button

### What to Test:
The 📍 button should get user's current location and convert it to an address.

### How to Test:

1. **Click Current Location Button:**
   - Click the 📍 button next to "Pickup Location"
   - **Expected:** Browser should ask for location permission (first time)
   - Click "Allow" or "Allow location access"

2. **Verify Location:**
   - **Expected:** Input field should be filled with your current address
   - **Expected:** Address should be a full formatted address (not just coordinates)
   - **Expected:** Location object should have lat/lng

### ✅ Success Criteria:
- [ ] Browser prompts for location permission
- [ ] Address is populated after permission granted
- [ ] Address is a readable location (not just lat/lng numbers)
- [ ] No console errors

### ❌ If It Fails:
- Check browser console for geolocation errors
- Verify Geocoding API is enabled in Google Cloud Console
- Check if location permission was denied

---

## 🧪 Test 3: Airport Booking - Distance Calculation

### What to Test:
For airport bookings, distance should be calculated using Google Distance Matrix API.

### How to Test:

1. **Create Airport Booking:**
   - Select "Airport" service type
   - Enter "From Location": "Kempegowda International Airport, Bangalore"
   - Enter "To Location": "MG Road, Bangalore" (or any city location)
   - Select a car
   - Click "Calculate Fare"

2. **Check Fare Calculation:**
   - **Expected:** Fare should be calculated
   - **Expected:** Distance should be realistic (e.g., 35-40 km for airport to city)
   - **Expected:** Estimated time should be realistic (e.g., 45-60 minutes)

3. **Check Backend Logs:**
   - Look at backend console/logs
   - **Expected:** Should see "Error calculating distance" OR successful calculation
   - **Expected:** If first time, should call Google Distance Matrix API
   - **Expected:** Should cache result in database

### ✅ Success Criteria:
- [ ] Fare is calculated successfully
- [ ] Distance is realistic (not 10km default)
- [ ] Estimated time is realistic
- [ ] No error messages

### ❌ If It Fails:
- Check backend logs for Google API errors
- Verify `GOOGLE_MAPS_BACKEND_KEY` is set in `.env`
- Verify Distance Matrix API is enabled
- Check API key restrictions (should allow your server IP)

---

## 🧪 Test 4: Distance Caching

### What to Test:
Same route should use cached distance (not call Google API again).

### How to Test:

1. **First Request:**
   - Calculate fare for: Airport → MG Road
   - Check backend logs: Should see Google API call

2. **Second Request (Same Route):**
   - Calculate fare for the same route again
   - **Expected:** Should use cached result
   - **Expected:** Faster response (no API call)

3. **Verify in Database:**
   ```sql
   SELECT * FROM routes 
   WHERE from_lat IS NOT NULL 
   AND to_lat IS NOT NULL 
   ORDER BY id DESC LIMIT 5;
   ```
   - **Expected:** Should see your route with lat/lng coordinates
   - **Expected:** `distance_km` and `estimated_time_minutes` should be populated

### ✅ Success Criteria:
- [ ] First request calls Google API
- [ ] Second request uses cache (faster, no API call)
- [ ] Route is stored in database with coordinates

---

## 🧪 Test 5: Local Booking (Hours-Based)

### What to Test:
Local bookings should still work with hours (no distance calculation).

### How to Test:

1. **Create Local Booking:**
   - Select "Local" service type
   - Enter pickup location
   - Select number of hours (e.g., 4 hours)
   - Select a car
   - Click "Calculate Fare"

2. **Verify:**
   - **Expected:** Fare should be calculated based on hours
   - **Expected:** Distance should be 0 (local bookings don't use distance)
   - **Expected:** Time should be hours × 60 (e.g., 4 hours = 240 minutes)

### ✅ Success Criteria:
- [ ] Fare calculated based on hours
- [ ] Distance is 0
- [ ] Time is correct (hours × 60)

---

## 🧪 Test 6: Outstation Booking (Multiplier-Based)

### What to Test:
Outstation bookings should still work with trip type multipliers.

### How to Test:

1. **Create Outstation Booking:**
   - Select "Outstation" service type
   - Select trip type (One Way, Round Trip, or Multiple Way)
   - Enter pickup and drop locations
   - Select a car
   - Click "Calculate Fare"

2. **Verify:**
   - **Expected:** Fare should be calculated
   - **Expected:** Round trip should cost more than one way
   - **Expected:** Multiple way should cost more than round trip

### ✅ Success Criteria:
- [ ] Fare calculated successfully
- [ ] Multipliers work correctly (round trip > one way)

---

## 🧪 Test 7: Complete Booking Flow

### What to Test:
End-to-end booking creation with new location format.

### How to Test:

1. **Fill Booking Form:**
   - Select service type
   - Enter locations (using autocomplete)
   - Select car
   - Calculate fare
   - Fill passenger details
   - Submit booking

2. **Verify Booking:**
   - **Expected:** Booking should be created successfully
   - **Expected:** Booking ID should be returned
   - **Expected:** Booking should be saved in database with location addresses

3. **Check Database:**
   ```sql
   SELECT id, from_location, to_location, distance_km, estimated_time_minutes 
   FROM bookings 
   ORDER BY id DESC LIMIT 1;
   ```
   - **Expected:** `from_location` and `to_location` should have addresses
   - **Expected:** `distance_km` should be populated for airport bookings

### ✅ Success Criteria:
- [ ] Booking created successfully
- [ ] All location data saved correctly
- [ ] Distance/time saved for airport bookings

---

## 🧪 Test 8: Corporate Booking

### What to Test:
Corporate booking page should work with new location format.

### How to Test:

1. **Open Corporate Booking Page:**
   - Navigate to `/corporate` page

2. **Fill Form:**
   - Enter name, phone, company
   - Enter pickup point (use autocomplete)
   - Enter drop point (use autocomplete)
   - Submit

3. **Verify:**
   - **Expected:** Booking request should be submitted
   - **Expected:** Locations should be saved with addresses

### ✅ Success Criteria:
- [ ] Form submits successfully
- [ ] Locations work with autocomplete
- [ ] Data saved correctly

---

## 🔍 Debugging Tips

### Check Browser Console:
```javascript
// Open browser console (F12)
// Look for:
// - Google Maps API errors
// - Location permission errors
// - Network errors
```

### Check Backend Logs:
```bash
# Look for:
# - "Error calculating distance"
# - "Failed to cache route"
# - Google API errors
```

### Verify API Keys:
```bash
# Frontend: Check index.html
grep "maps/api/js" frontend/public/index.html

# Backend: Check .env
grep "GOOGLE_MAPS" backend/.env
```

### Test Google API Directly:
```bash
# Test Distance Matrix API (replace YOUR_KEY)
curl "https://maps.googleapis.com/maps/api/distancematrix/json?origins=12.9716,77.5946&destinations=12.2958,76.6394&key=YOUR_KEY"
```

---

## 📊 Expected Results Summary

| Test | Expected Result |
|------|----------------|
| Autocomplete | Google Places suggestions appear |
| Current Location | Address populated from GPS |
| Airport Distance | Real distance (not 10km default) |
| Caching | Second request uses cache |
| Local Booking | Hours-based, distance = 0 |
| Outstation | Multiplier-based |
| Complete Flow | Booking created with addresses |
| Corporate | Form submits successfully |

---

## ✅ Final Checklist

After testing, verify:

- [ ] All location inputs use Google Places autocomplete
- [ ] Current location button works
- [ ] Airport bookings calculate real distance
- [ ] Distance is cached in database
- [ ] Local bookings work (hours-based)
- [ ] Outstation bookings work (multiplier-based)
- [ ] Complete booking flow works
- [ ] Corporate bookings work
- [ ] No console errors
- [ ] No backend errors

---

## 🚨 Common Issues & Solutions

### Issue: Autocomplete not appearing
**Solution:**
- Check API key in `index.html`
- Verify Places API is enabled
- Check API key restrictions

### Issue: "Error calculating distance"
**Solution:**
- Check `GOOGLE_MAPS_BACKEND_KEY` in `.env`
- Verify Distance Matrix API is enabled
- Check API key restrictions (IP whitelist)

### Issue: Distance always 10km
**Solution:**
- This means Google API is not being called
- Check backend logs for errors
- Verify coordinates are being sent from frontend

### Issue: Current location shows coordinates only
**Solution:**
- Geocoding API might not be enabled
- Check browser console for errors
- Verify API key has Geocoding API access

---

**Happy Testing! 🎉**

