# 🔍 Distance Calculation Debug Guide

## How Distance Calculation Works

### Flow:

1. **Frontend (BookingPage.js)** → User selects locations
   - Location objects: `{address: "...", lat: 12.97, lng: 77.59}`
   - Sends to backend: `POST /api/bookings/calculate-fare`
   - Payload includes: `from: {lat, lng}`, `to: {lat, lng}`

2. **Backend (routes/bookings.js)** → `/calculate-fare` endpoint
   - Line 157: Checks if `from` and `to` coordinates exist
   - Line 160-174: Checks cache in `routes` table (within 100m tolerance)
   - Line 181: If not cached, calls `getDistanceAndTime(from, to)`
   - Line 280: Returns `distance_km` in response

3. **Backend Service (googleDistanceService.js)**
   - Calls Google Distance Matrix API
   - Returns: `{distance_km: number, duration_min: number}`

4. **Frontend** → Displays distance
   - Line 781: `Distance ({fare.distance_km} km)`
   - Line 1014: `{fare.distance_km} km`

---

## 🐛 Debugging Steps

### Step 1: Check Backend API Key

```bash
cd /var/www/nammacabs.com/cab/backend
cat .env | grep GOOGLE_MAPS_BACKEND_KEY
```

**Expected:** Should show your API key
**If missing:** Add `GOOGLE_MAPS_BACKEND_KEY=your_key_here` to `.env`

### Step 2: Check Backend Logs

```bash
# Check if backend is logging errors
cd /var/www/nammacabs.com/cab/backend
# Look for:
# - "Error calculating distance"
# - "GOOGLE_MAPS_BACKEND_KEY environment variable is not set"
# - "Google Distance Matrix API error"
```

### Step 3: Test API Call Directly

Test if Google Distance Matrix API works:

```bash
# Replace YOUR_KEY with your backend API key
curl "https://maps.googleapis.com/maps/api/distancematrix/json?origins=12.9716,77.5946&destinations=12.2958,76.6394&key=YOUR_KEY&units=metric"
```

**Expected Response:**
```json
{
  "status": "OK",
  "rows": [{
    "elements": [{
      "distance": {"value": 150000, "text": "150 km"},
      "duration": {"value": 5400, "text": "1 hour 30 mins"}
    }]
  }]
}
```

### Step 4: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Calculate fare for airport booking
4. Find the request to `/api/bookings/calculate-fare`
5. Check:
   - **Request payload:** Does it have `from: {lat, lng}` and `to: {lat, lng}`?
   - **Response:** Does it have `distance_km`?

### Step 5: Check Frontend Console

Look for:
- API errors
- `fare.distance_km` is undefined
- Network errors

---

## 🔧 Common Issues & Fixes

### Issue 1: `distance_km` is 0

**Cause:** 
- Local bookings always return 0 (by design)
- Outstation bookings return 0 (by design)
- Airport bookings: API call failed or coordinates missing

**Fix:**
- Check if you're testing **Airport** booking type
- Verify `from` and `to` objects have `lat` and `lng`
- Check backend logs for errors

### Issue 2: `distance_km` is undefined

**Cause:**
- Backend not returning `distance_km` in response
- API call failed silently

**Fix:**
- Check backend response structure
- Verify Google Distance Matrix API is enabled
- Check backend API key is set

### Issue 3: "Error calculating distance"

**Cause:**
- `GOOGLE_MAPS_BACKEND_KEY` not set
- Distance Matrix API not enabled
- API key restrictions blocking server IP

**Fix:**
1. Add `GOOGLE_MAPS_BACKEND_KEY` to `.env`
2. Enable Distance Matrix API in Google Cloud Console
3. Add server IP to API key restrictions

### Issue 4: Distance shows but is wrong

**Cause:**
- Using cached route (old data)
- API returning wrong distance

**Fix:**
- Clear routes table cache
- Test with fresh coordinates

---

## 📊 Expected Values

### Airport Booking (Bangalore Airport → City):
- **Distance:** ~35-40 km
- **Time:** ~45-60 minutes

### If you see:
- **0 km:** Local/Outstation booking OR API failed
- **10 km:** Old default fallback (shouldn't happen now)
- **Undefined:** Backend not returning distance_km

---

## 🧪 Quick Test

1. **Select Airport booking**
2. **From:** "Kempegowda International Airport"
3. **To:** "MG Road, Bangalore"
4. **Select car**
5. **Calculate fare**
6. **Check:** Should show ~35-40 km

---

## 📝 Code Locations

- **Frontend API call:** `BookingPage.js` line 196
- **Backend endpoint:** `routes/bookings.js` line 20
- **Distance calculation:** `routes/bookings.js` line 157-217
- **Google API service:** `services/googleDistanceService.js`
- **Frontend display:** `BookingPage.js` lines 781, 1014

---

## ✅ Checklist

- [ ] Backend `.env` has `GOOGLE_MAPS_BACKEND_KEY`
- [ ] Distance Matrix API is enabled in Google Cloud Console
- [ ] API key allows server IP
- [ ] Testing **Airport** booking (not Local/Outstation)
- [ ] Frontend sends `from: {lat, lng}` and `to: {lat, lng}`
- [ ] Backend logs show no errors
- [ ] Browser Network tab shows `distance_km` in response

