# 📍 Distance Calculation - How It Works

## 🔄 Complete Flow

### 1. **User Selects Locations (Frontend)**
   - User types in location fields
   - Google Places Autocomplete provides suggestions
   - User selects a location
   - Location object stored: `{address: "Full Address", lat: 12.97, lng: 77.59}`

### 2. **User Clicks "Calculate Fare" (Frontend)**
   - `BookingPage.js` line 204-245: `calculateFare()` function
   - For **Airport** bookings:
     ```javascript
     requestData.from = { lat: fromLocation.lat, lng: fromLocation.lng }
     requestData.to = { lat: toLocation.lat, lng: toLocation.lng }
     ```
   - Sends POST to: `/api/bookings/calculate-fare`

### 3. **Backend Receives Request** (`routes/bookings.js`)
   - Line 35: Extracts `from`, `to`, `service_type`
   - Line 157: Checks if `from` and `to` have coordinates
   - **For Airport bookings only:**
     - Line 160-174: Checks cache in `routes` table
     - Line 181: If not cached, calls Google Distance Matrix API
     - Line 280: Returns `distance_km` in response

### 4. **Google Distance Matrix API Call** (`services/googleDistanceService.js`)
   - Line 20: Calls `https://maps.googleapis.com/maps/api/distancematrix/json`
   - Parameters:
     - `origins`: `"12.97,77.59"` (from coordinates)
     - `destinations`: `"12.30,76.64"` (to coordinates)
     - `units`: `"metric"` (kilometers)
     - `key`: Backend API key
   - Returns: `{distance_km: 150, duration_min: 90}`

### 5. **Backend Response**
   ```json
   {
     "fare": 2500.00,
     "distance_km": 150,
     "estimated_time_minutes": 90,
     "breakdown": {
       "base_fare": 100,
       "distance_charge": 1800,
       "time_charge": 108
     }
   }
   ```

### 6. **Frontend Displays** (`BookingPage.js`)
   - Line 781: `Distance ({fare.distance_km} km)`
   - Line 1014: `{fare.distance_km} km`

---

## 🎯 Where Distance is Shown

### 1. **Fare Breakdown** (After Calculate Fare)
   - Location: Booking form, fare breakdown section
   - Code: `BookingPage.js` line 781
   - Shows: `Distance (150 km): ₹1800.00`

### 2. **Booking Summary** (Before Confirmation)
   - Location: Confirmation modal
   - Code: `BookingPage.js` line 1014
   - Shows: `Distance: 150 km`

### 3. **Booking Details** (After Booking)
   - Location: Check Booking page
   - Code: `CheckBooking.js` line 166
   - Shows: `Distance: 150 km`

---

## ⚠️ Important Notes

### Distance is ONLY calculated for:
- ✅ **Airport bookings** - Uses Google Distance Matrix API

### Distance is NOT calculated for:
- ❌ **Local bookings** - Uses hours instead (distance = 0)
- ❌ **Outstation bookings** - Uses multiplier instead (distance = 0)

---

## 🐛 Why Distance Might Not Show

### Issue 1: Testing Wrong Service Type
**Symptom:** Distance shows as 0 or not shown
**Cause:** Testing Local or Outstation booking
**Fix:** Test with **Airport** booking type

### Issue 2: Backend API Key Missing
**Symptom:** Error in backend logs: "GOOGLE_MAPS_BACKEND_KEY environment variable is not set"
**Fix:** Add to `backend/.env`:
```env
GOOGLE_MAPS_BACKEND_KEY=your_backend_api_key
```

### Issue 3: Distance Matrix API Not Enabled
**Symptom:** 403 Forbidden error
**Fix:** Enable "Distance Matrix API" in Google Cloud Console

### Issue 4: Coordinates Not Sent
**Symptom:** Backend logs: "From and To coordinates (lat, lng) are required"
**Cause:** Location objects don't have lat/lng
**Fix:** Verify autocomplete is working and returning coordinates

### Issue 5: API Call Failing
**Symptom:** Backend logs: "Error calculating distance"
**Fix:** Check API key, enable Distance Matrix API, check server IP restrictions

---

## 🧪 Quick Test

1. **Select:** Airport booking
2. **From:** "Kempegowda International Airport, Bangalore"
3. **To:** "MG Road, Bangalore"
4. **Select:** Any car
5. **Click:** Calculate Fare
6. **Expected:** Distance shows ~35-40 km

---

## 📊 Code Locations

| Component | File | Line | Purpose |
|-----------|------|------|---------|
| Frontend API Call | `BookingPage.js` | 245 | Sends request with coordinates |
| Backend Endpoint | `routes/bookings.js` | 20 | Receives request |
| Distance Logic | `routes/bookings.js` | 157-217 | Calculates distance |
| Google API Service | `googleDistanceService.js` | 9 | Calls Distance Matrix API |
| Frontend Display | `BookingPage.js` | 781, 1014 | Shows distance |

---

## 🔍 Debug Checklist

- [ ] Testing **Airport** booking (not Local/Outstation)
- [ ] Backend `.env` has `GOOGLE_MAPS_BACKEND_KEY`
- [ ] Distance Matrix API enabled in Google Cloud Console
- [ ] API key allows server IP address
- [ ] Browser Network tab shows `from: {lat, lng}` in request
- [ ] Browser Network tab shows `distance_km` in response
- [ ] Backend logs show no errors
- [ ] Frontend console shows no errors

---

## 💡 Next Steps

1. **Check browser Network tab** - See what's being sent/received
2. **Check backend logs** - See if API is being called
3. **Verify API key** - Make sure it's set in `.env`
4. **Test API directly** - Use curl to test Google API

Let me know what you find in the browser Network tab or backend logs!

