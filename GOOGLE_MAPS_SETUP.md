# Google Maps API Setup Guide

## Fixing "ApiTargetBlockedMapError"

This error occurs when your Google Maps API key has restrictions that block your domain. Follow these steps:

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Select your project (or create a new one)
3. Go to **APIs & Services** > **Credentials**

### Step 2: Find Your API Key

1. Click on your API key (the one starting with `AIzaSy...`)
2. Under **API restrictions**, make sure these APIs are enabled:
   - ✅ **Maps JavaScript API**
   - ✅ **Places API**
   - ✅ **Geocoding API**

### Step 3: Set HTTP Referrer Restrictions

1. Under **Application restrictions**, select **HTTP referrers (web sites)**
2. Click **Add an item**
3. Add your domains (one per line):
   ```
   https://namma-cabs.com/*
   https://*.namma-cabs.com/*
   http://localhost:3000/*
   http://127.0.0.1:3000/*
   ```

**Important**: 
- Use `*` at the end to allow all paths
- Include both `http://` and `https://` for localhost
- Add your production domain

### Step 4: Enable Required APIs

1. Go to **APIs & Services** > **Library**
2. Search and enable:
   - **Maps JavaScript API** - Click "Enable"
   - **Places API** - Click "Enable"  
   - **Geocoding API** - Click "Enable"

### Step 5: Save and Wait

1. Click **Save** in the API key settings
2. Wait 1-2 minutes for changes to propagate
3. Clear your browser cache
4. Restart your React dev server

## Testing

After making changes:

1. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. **Restart your React app**: `npm start`
3. **Check browser console** - the error should be gone

## Common Issues

### Still Getting ApiTargetBlockedMapError?

- ✅ Check that all 3 APIs are enabled (Maps JavaScript, Places, Geocoding)
- ✅ Verify your domain is in the HTTP referrer list (exact match required)
- ✅ Make sure you saved the changes
- ✅ Wait 2-3 minutes for propagation
- ✅ Try in incognito/private browsing mode

### CORS Errors?

- ✅ The code now uses Google Maps JavaScript API (no CORS issues)
- ✅ Make sure Places API is enabled
- ✅ Check browser console for specific error messages

## API Key Security Best Practices

1. **Restrict by HTTP referrer** (already done above)
2. **Enable only needed APIs** (Maps JavaScript, Places, Geocoding)
3. **Monitor usage** in Google Cloud Console
4. **Set up billing alerts** to avoid unexpected charges
5. **Rotate keys** if compromised

## Cost Information

- **Maps JavaScript API**: Free up to 28,000 loads/month
- **Places API (Autocomplete)**: $2.83 per 1,000 requests
- **Geocoding API**: $5.00 per 1,000 requests

Google provides $200 free credit per month, which covers most small to medium applications.

## Need Help?

If you're still having issues:
1. Check the error message in browser console
2. Verify API key restrictions in Google Cloud Console
3. Check that all required APIs are enabled
4. Ensure your domain matches exactly (including https://)

