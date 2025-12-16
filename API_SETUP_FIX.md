# 🔧 Google Maps API Setup - Fix All Errors

## ✅ What I Just Fixed

1. **Removed broken Loader import** - Google Maps JS is NOT an ES module
2. **Simplified to legacy Autocomplete** - Works reliably, just shows deprecation warning
3. **Fixed script loading** - Single script tag, no module imports
4. **Fixed Geocoding** - Proper error handling

---

## 🚨 CRITICAL: Enable These APIs in Google Cloud Console

Go to: https://console.cloud.google.com/apis/library?project=715663439134

### Enable ALL of these:

1. ✅ **Maps JavaScript API**
   - Status: Probably enabled
   - Link: https://console.cloud.google.com/apis/library/maps-backend.googleapis.com

2. ✅ **Places API** (Legacy - REQUIRED)
   - Status: Probably enabled
   - Link: https://console.cloud.google.com/apis/library/places-backend.googleapis.com

3. ✅ **Geocoding API** (REQUIRED - You're using it!)
   - Status: **NOT ENABLED** ← This is why you see "not authorized"
   - Link: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
   - **Click "ENABLE"**

4. ⚠️ **Places API (New)** (Optional - for future migration)
   - Status: **NOT ENABLED** ← This is why you see 403 errors
   - Link: https://console.cloud.google.com/apis/library/places.googleapis.com
   - **You can skip this for now** - legacy API works fine

---

## 🔑 API Key Restrictions

Go to: https://console.cloud.google.com/apis/credentials?project=715663439134

### For your FRONTEND API key:

**Application restrictions:**
- HTTP referrers (web sites)
- Add: `https://namma-cabs.com/*`
- Add: `https://*.namma-cabs.com/*`
- Add: `http://localhost:*` (for testing)

**API restrictions:**
- Restrict key to these APIs:
  - ✅ Maps JavaScript API
  - ✅ Places API
  - ✅ Geocoding API
  - ❌ Distance Matrix API (do NOT include - backend only)

---

## 🧹 Clean Build (IMPORTANT)

After enabling APIs, rebuild:

```bash
cd /var/www/nammacabs.com/cab/frontend

# Clean everything
rm -rf node_modules
rm -rf build
rm -rf .cache

# Reinstall
npm install

# Rebuild
npm run build
```

**Then restart your frontend server/nginx**

---

## 🧪 Test After Fix

1. **Hard refresh browser:** `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)

2. **Check browser console:**
   - ✅ Should see NO "Loader export" errors
   - ✅ Should see NO "403 Forbidden" errors
   - ✅ Should see NO "Geocoding not authorized" errors
   - ⚠️ May see deprecation warning (harmless - legacy API still works)

3. **Test autocomplete:**
   - Type in location field
   - Should see suggestions appear
   - Should work smoothly

4. **Test current location:**
   - Click 📍 button
   - Should get your address (not just coordinates)

---

## 📋 Error Checklist

| Error | Fix |
|-------|-----|
| `Loader is not exported` | ✅ Fixed - Removed module import |
| `403 Places API (New)` | ✅ Fixed - Using legacy API now |
| `Geocoding not authorized` | ⚠️ **Enable Geocoding API** |
| `This property is not available` | ✅ Fixed - Removed new API code |
| `r is not defined` | ✅ Should be fixed - was from map animation |

---

## 🎯 What Changed

### Before (Broken):
- ❌ Tried to use ES module import (doesn't work)
- ❌ Tried to use new PlaceAutocompleteElement (needs new API enabled)
- ❌ Mixed old + new APIs

### After (Fixed):
- ✅ Single script tag (works)
- ✅ Legacy Autocomplete (works, just deprecated)
- ✅ Proper error handling
- ✅ Clean, simple code

---

## ⚠️ Deprecation Warning

You'll still see this warning:
```
google.maps.places.Autocomplete is not available to new customers
```

**This is OK for now.** The legacy API still works. Google will give 12+ months notice before discontinuing.

**To remove the warning later:**
1. Enable "Places API (New)" in Google Cloud Console
2. Migrate to PlaceAutocompleteElement (I can help with this later)

---

## 🚀 Next Steps

1. **Enable Geocoding API** (most important - fixes current location)
2. **Rebuild frontend** (clears cached errors)
3. **Test everything** (autocomplete + current location)
4. **Report back** if any errors remain

---

**Status:** ✅ Code fixed, waiting for API enablement

