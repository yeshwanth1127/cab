# Location Features

## Overview

The booking system now includes location-based features:

1. **Geolocation Request**: On page load, users are asked if they want to use their current location
2. **Current Location Button**: Users can click the 📍 button to use their current location for pickup
3. **Autocomplete Suggestions**: As users type, location suggestions appear based on their input
4. **Location-Aware Suggestions**: Suggestions are prioritized based on user's current location (if available)

## How It Works

### Geolocation API
- Uses browser's built-in `navigator.geolocation` API
- Requests permission from user on first visit
- Falls back gracefully if permission is denied

### Place Search
- Uses **OpenStreetMap Nominatim API** (free, no API key required)
- Provides autocomplete suggestions as user types
- Shows up to 5 suggestions per search
- Prioritizes results near user's location (if available)

### Location Service (`locationService.js`)

**Functions:**
- `getCurrentLocation()` - Gets user's current GPS coordinates
- `getAddressFromCoordinates(lat, lng)` - Converts coordinates to address
- `searchPlaces(query, userLocation)` - Searches for places with autocomplete
- `searchPlacesGoogle(query, userLocation, apiKey)` - Alternative Google Maps API (optional)

## Usage

### For Users:
1. When the page loads, you'll be asked if you want to use your current location
2. Click "OK" to allow location access (or "Cancel" to skip)
3. If allowed, your current location will be set as the pickup point
4. Start typing in the location fields to see suggestions
5. Click the 📍 button next to "From Location" to use your current location anytime

### For Developers:

**Using OpenStreetMap (Default - Free):**
No configuration needed! Works out of the box.

**Using Google Maps Places API (Optional):**
1. Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Places API" and "Geocoding API"
3. Add to `.env` file:
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
4. Update `locationService.js` to use `searchPlacesGoogle` instead of `searchPlaces`

## Features

✅ **Automatic Location Request**: Asks user on page load  
✅ **Current Location Button**: Quick access to use GPS location  
✅ **Real-time Suggestions**: Shows suggestions as you type (after 2+ characters)  
✅ **Location-Aware**: Prioritizes nearby results if location is available  
✅ **Free to Use**: Uses OpenStreetMap (no API key needed)  
✅ **Fallback Support**: Works even if location is denied  
✅ **Mobile Friendly**: Works on mobile devices with GPS  

## API Rate Limits

**OpenStreetMap Nominatim:**
- 1 request per second (automatically handled)
- No API key required
- Free for commercial use (with attribution)

**Google Maps (if used):**
- Free tier: $200 credit/month
- Places Autocomplete: $2.83 per 1000 requests
- Geocoding: $5.00 per 1000 requests

## Browser Compatibility

✅ Chrome/Edge (Desktop & Mobile)  
✅ Firefox (Desktop & Mobile)  
✅ Safari (Desktop & Mobile)  
✅ Opera  

**Note**: Geolocation requires HTTPS in production (works on localhost for development)

## Customization

### Change the location prompt message:
Edit `BookingPage.js` line ~45:
```javascript
const userWantsLocation = window.confirm(
  'Your custom message here'
);
```

### Adjust suggestion limit:
Edit `locationService.js` line ~35:
```javascript
let url = `...&limit=5...`; // Change 5 to desired number
```

### Change minimum characters for search:
Edit `LocationInput.js` line ~30:
```javascript
if (inputValue.length >= 2) { // Change 2 to desired number
```

## Troubleshooting

**Location not working?**
- Check browser permissions (Settings → Privacy → Location)
- Ensure you're using HTTPS (or localhost)
- Some browsers require user interaction before requesting location

**Suggestions not showing?**
- Check browser console for errors
- Verify internet connection
- OpenStreetMap API might be rate-limited (wait a moment)

**Want to use Google Maps instead?**
- Get API key from Google Cloud Console
- Update `locationService.js` to use `searchPlacesGoogle`
- Add API key to environment variables

