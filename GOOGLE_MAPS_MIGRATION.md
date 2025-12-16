# Google Maps Migration - Complete Guide

## ✅ Migration Complete!

The system has been successfully migrated from OpenStreetMap (Nominatim) to Google Maps (Places + Distance Matrix).

---

## 🔑 Environment Variables Required

### Frontend (React App)

**File:** `cab/frontend/public/index.html`

**Action Required:** Replace `FRONTEND_GOOGLE_MAPS_KEY` with your actual Google Maps API key.

**Current line 17:**
```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=FRONTEND_GOOGLE_MAPS_KEY&libraries=places"
  async
  defer
></script>
```

**Replace with:**
```html
<script
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_GOOGLE_MAPS_API_KEY&libraries=places"
  async
  defer
></script>
```

**Note:** For production, you may want to use a build-time replacement or environment variable injection. The key must be exposed in the HTML (this is safe for frontend keys with domain restrictions).

### Backend (Node.js/Express)

**File:** `cab/backend/.env` (create if it doesn't exist)

**Add this line:**
```env
GOOGLE_MAPS_BACKEND_KEY=your_backend_google_maps_api_key_here
```

**Important:** 
- Use a **separate API key** for the backend (server-side key)
- This key should have **Distance Matrix API** enabled
- Restrict this key to your server IP addresses only

---

## 📋 Google Cloud Console Setup

### Required APIs

Enable these APIs in your Google Cloud Console:

1. **Places API** (for frontend autocomplete)
2. **Distance Matrix API** (for backend distance calculation)
3. **Geocoding API** (for reverse geocoding - coordinates to address)

### API Keys

Create **TWO separate API keys**:

1. **Frontend Key:**
   - Restrict by HTTP referrer (your domain)
   - Enable: Places API, Geocoding API
   - Example: `https://namma-cabs.com/*`

2. **Backend Key:**
   - Restrict by IP address (your server IPs)
   - Enable: Distance Matrix API, Geocoding API
   - Add your server IP addresses

---

## 🔄 What Changed

### Frontend Changes

1. **LocationInput Component** (`frontend/src/components/LocationInput.js`)
   - ✅ Replaced OpenStreetMap Nominatim with Google Places Autocomplete
   - ✅ Now returns location objects: `{address, lat, lng}`
   - ✅ Uses Google Geocoding for current location

2. **BookingPage** (`frontend/src/pages/BookingPage.js`)
   - ✅ Updated all location state to use objects instead of strings
   - ✅ Updated `calculateFare` to send `from` and `to` objects with lat/lng
   - ✅ Updated `handleConfirmBooking` to send lat/lng to backend
   - ✅ Updated all display logic to show `address` from location objects

3. **CorporateBookingPage** (`frontend/src/pages/CorporateBookingPage.js`)
   - ✅ Updated to use location objects
   - ✅ Sends lat/lng in booking payload

### Backend Changes

1. **New Service** (`backend/services/googleDistanceService.js`)
   - ✅ Google Distance Matrix API integration
   - ✅ Returns `{distance_km, duration_min}`

2. **Calculate Fare Endpoint** (`backend/routes/bookings.js`)
   - ✅ Accepts `from` and `to` objects with lat/lng
   - ✅ Uses Google Distance Matrix API for airport bookings
   - ✅ Implements caching in `routes` table
   - ✅ Removed string-based route lookup
   - ✅ Removed default 10km/20min fallback

3. **Create Booking Endpoint** (`backend/routes/bookings.js`)
   - ✅ Accepts lat/lng coordinates
   - ✅ Uses Google Distance Matrix API when needed
   - ✅ Caches results

4. **Database Migration** (`backend/db/database.js`)
   - ✅ Added `from_lat`, `from_lng`, `to_lat`, `to_lng` columns to `routes` table
   - ✅ Automatic migration on server start

---

## 🗄️ Database Schema Changes

The `routes` table now includes coordinate columns:

```sql
ALTER TABLE routes ADD COLUMN from_lat REAL;
ALTER TABLE routes ADD COLUMN from_lng REAL;
ALTER TABLE routes ADD COLUMN to_lat REAL;
ALTER TABLE routes ADD COLUMN to_lng REAL;
```

**Migration Status:** ✅ Automatic migration added to `database.js`

---

## 🎯 API Contract Changes

### Calculate Fare Endpoint

**Before:**
```json
{
  "service_type": "airport",
  "from_location": "Airport",
  "to_location": "City Center",
  "cab_type_id": 3
}
```

**After:**
```json
{
  "service_type": "airport",
  "from": {"lat": 12.9716, "lng": 77.5946},
  "to": {"lat": 12.2958, "lng": 76.6394},
  "from_location": "Kempegowda International Airport",
  "to_location": "City Center",
  "cab_type_id": 3
}
```

**Note:** `from_location` and `to_location` are still sent for display purposes, but distance calculation uses `from` and `to` coordinates.

---

## 💾 Caching Strategy

The system now caches Google Distance Matrix results in the `routes` table:

1. **Cache Lookup:** Before calling Google API, checks if a route exists within ~100m tolerance
2. **Cache Miss:** Calls Google Distance Matrix API
3. **Cache Write:** Stores result in `routes` table with coordinates
4. **Future Requests:** Uses cached result (saves API calls and cost)

**Cache Tolerance:** 0.001 degrees (~100 meters)

---

## 🚀 Deployment Steps

1. **Get Google Maps API Keys:**
   - Create project in Google Cloud Console
   - Enable required APIs
   - Create two API keys (frontend + backend)

2. **Update Frontend:**
   - Replace `FRONTEND_GOOGLE_MAPS_KEY` in `index.html` with your frontend key
   - Rebuild frontend: `cd frontend && npm run build`

3. **Update Backend:**
   - Add `GOOGLE_MAPS_BACKEND_KEY` to `.env` file
   - Restart backend server

4. **Test:**
   - Test location autocomplete on booking page
   - Test fare calculation for airport bookings
   - Verify distance is calculated correctly

---

## ⚠️ Important Notes

1. **No Breaking Changes:** The system maintains backward compatibility where possible
2. **Local Bookings:** Still use hours-based calculation (no distance needed)
3. **Outstation Bookings:** Still use multiplier-based calculation (no distance needed)
4. **Airport Bookings:** Now use real-time Google Distance Matrix API
5. **Error Handling:** If Google API fails, the request will return an error (no silent fallback)

---

## 🧪 Testing Checklist

- [ ] Location autocomplete works in booking form
- [ ] Current location button works
- [ ] Airport booking fare calculation uses Google Distance Matrix
- [ ] Distance is cached in database
- [ ] Cached routes are reused (check database)
- [ ] Local bookings still work (hours-based)
- [ ] Outstation bookings still work (multiplier-based)
- [ ] Corporate bookings work with new location format

---

## 📞 Support

If you encounter issues:

1. Check Google Cloud Console for API quota/errors
2. Verify API keys are correctly set
3. Check browser console for frontend errors
4. Check backend logs for API errors
5. Verify database migration ran successfully

---

## 🎉 Benefits

✅ **Accurate Distance:** Real-time distance calculation using Google's routing
✅ **Cost Efficient:** Caching reduces API calls
✅ **Scalable:** Handles any route, not just pre-configured ones
✅ **Secure:** Server-side distance calculation (can't be manipulated)
✅ **Professional:** Industry-standard Google Maps integration

---

**Migration Date:** $(date)
**Status:** ✅ Complete - Ready for testing

