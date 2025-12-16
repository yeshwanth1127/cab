# 🐛 Debug Distance = 0 km Issue

## ✅ What I Just Did

1. **Added debugging to backend** - Will log every step of distance calculation
2. **Added debugging to frontend** - Will log what's being sent/received
3. **Verified API key is set** - ✅ Confirmed

---

## 🔍 Next Steps to Debug

### Step 1: Restart Backend

**Important:** Backend needs to restart to load the new debugging code.

```bash
# If using PM2:
pm2 restart all

# If using systemd:
systemctl restart your-backend-service

# If running directly:
# Stop and restart your node process
```

### Step 2: Open Browser Console

1. Open your booking page
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Keep it open

### Step 3: Test Airport Booking

1. Select **"Airport"** service type (NOT Local or Outstation)
2. Enter **From:** "Kempegowda International Airport"
3. Enter **To:** "MG Road, Bangalore"  
4. Select a car
5. Click **"Calculate Fare"**

### Step 4: Check Browser Console

You should see logs like:
```
[FRONTEND DEBUG] Sending calculate-fare request: {...}
[FRONTEND DEBUG] Received response: {...}
[FRONTEND DEBUG] Distance in response: 35.5
```

**What to check:**
- Does `from` have `lat` and `lng`?
- Does `to` have `lat` and `lng`?
- What is `distance_km` in the response?

### Step 5: Check Backend Logs

**Method 1 - PM2:**
```bash
pm2 logs --lines 50
```

**Method 2 - systemd:**
```bash
journalctl -u your-backend-service -n 50 -f
```

**Method 3 - Direct node:**
```bash
# If running in terminal, logs appear there
# If background, check nohup.out or log file
```

You should see logs like:
```
[BACKEND DEBUG] Received calculate-fare request
[BACKEND DEBUG] service_type: airport
[BACKEND DEBUG] from: { lat: 12.97, lng: 77.59 }
[DISTANCE DEBUG] Airport booking - checking coordinates
[GOOGLE API] Calling Distance Matrix API...
[GOOGLE API] Success! Distance: 35.5 km
[BACKEND DEBUG] Final distance_km: 35.5
```

---

## 🎯 What to Look For

### If you see in Browser Console:

**✅ Good:**
```javascript
from: {lat: 12.97, lng: 77.59}  // Coordinates present
distance_km: 35.5  // Distance calculated
```

**❌ Bad:**
```javascript
from: null  // No coordinates!
from: {address: "..."}  // Missing lat/lng
distance_km: 0  // Distance not calculated
distance_km: undefined  // Not in response
```

### If you see in Backend Logs:

**✅ Good:**
```
[DISTANCE DEBUG] Coordinates valid, calculating distance...
[GOOGLE API] Success! Distance: 35.5 km
```

**❌ Bad:**
```
[DISTANCE DEBUG] Missing coordinates
[GOOGLE API] GOOGLE_MAPS_BACKEND_KEY environment variable is not set
[GOOGLE API] 403 Forbidden
```

---

## 🔧 Common Issues & Fixes

### Issue 1: `distance_km: 0` in response

**Possible causes:**
1. Testing **Local** booking (distance is always 0 by design)
2. Testing **Outstation** booking (distance is always 0 by design)
3. Backend not calling Google API (check logs)
4. Google API returning 0 (unlikely)

**Fix:**
- Make sure you're testing **Airport** booking
- Check backend logs for `[DISTANCE DEBUG]` messages

### Issue 2: `from: null` or `to: null`

**Cause:** Frontend not sending coordinates

**Fix:**
- Check if autocomplete is working
- Verify location objects have `lat` and `lng`
- Check browser console for errors

### Issue 3: Backend logs show "Missing coordinates"

**Cause:** Coordinates not reaching backend

**Fix:**
- Check browser Network tab - see what's actually sent
- Verify frontend code is sending `from: {lat, lng}`

### Issue 4: Google API error in logs

**Cause:** API key issue or API not enabled

**Fix:**
- Verify `GOOGLE_MAPS_BACKEND_KEY` in `.env`
- Enable Distance Matrix API in Google Cloud Console
- Check API key restrictions

---

## 📋 Quick Checklist

- [ ] Backend restarted (to load debugging code)
- [ ] Testing **Airport** booking (not Local/Outstation)
- [ ] Browser console open (F12)
- [ ] Backend logs accessible
- [ ] Calculate fare and check both logs

---

## 📸 What to Share

After testing, share:

1. **Browser Console output** (the `[FRONTEND DEBUG]` logs)
2. **Backend logs** (the `[BACKEND DEBUG]` and `[GOOGLE API]` logs)
3. **Service type** you tested (Airport/Local/Outstation)

This will help me identify exactly where the issue is!

