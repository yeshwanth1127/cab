# 🔍 How to Check Backend Logs

## Method 1: If using PM2 (Most Common)

```bash
# Check if PM2 is running
pm2 list

# View logs
pm2 logs

# View only error logs
pm2 logs --err

# View last 100 lines
pm2 logs --lines 100
```

## Method 2: If using systemd service

```bash
# Check service name (usually node, backend, or cab-backend)
systemctl list-units | grep -E "node|backend|cab"

# View logs (replace SERVICE_NAME with actual name)
journalctl -u SERVICE_NAME -f

# View last 50 lines
journalctl -u SERVICE_NAME -n 50
```

## Method 3: If running directly with node

```bash
# Find the process
ps aux | grep node

# If running in terminal, logs appear directly
# If running in background, check:
# - nohup.out file
# - Or redirect to a log file
```

## Method 4: Check if backend is writing to a log file

```bash
cd /var/www/nammacabs.com/cab/backend

# Check for log files
ls -la *.log 2>/dev/null

# Check for nohup.out
ls -la nohup.out 2>/dev/null
```

## Method 5: Check nginx error logs (if backend errors are logged there)

```bash
# Check nginx error log
tail -f /var/log/nginx/error.log

# Or
journalctl -u nginx -f
```

---

## 🧪 Quick Test: Make Backend Log Something

After I add debugging, restart your backend and try calculating a fare. You should see logs like:

```
[DISTANCE DEBUG] Airport booking - checking coordinates
[DISTANCE DEBUG] from: { lat: 12.97, lng: 77.59 }
[GOOGLE API] Calling Distance Matrix API...
```

---

## 📋 What to Look For

When you calculate fare for an **Airport** booking, you should see:

1. `[DISTANCE DEBUG] Airport booking - checking coordinates`
2. `[DISTANCE DEBUG] Coordinates valid, calculating distance...`
3. `[GOOGLE API] Calling Distance Matrix API...`
4. `[GOOGLE API] Success! Distance: 35.5 km`

If you see errors:
- `GOOGLE_MAPS_BACKEND_KEY environment variable is not set` → Add to `.env`
- `403 Forbidden` → Enable Distance Matrix API
- `Invalid coordinates` → Frontend not sending lat/lng

---

## 🚀 After Adding Debugging

1. **Restart backend** (so it loads new code)
2. **Calculate fare** for Airport booking
3. **Check logs** using one of the methods above
4. **Share the logs** so I can see what's happening

