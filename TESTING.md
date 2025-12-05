# Testing Guide

## Quick Start Testing

### Step 1: Install Dependencies (if not already done)

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Setup Backend

1. **Create `.env` file in `backend/` directory:**
```
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

2. **Setup admin user:**
```bash
cd backend
npm run setup-admin
```
This creates admin user with:
- Username: `admin`
- Password: `admin123`
- Email: `admin@cabcompany.com`

3. **Start backend server:**
```bash
npm run dev
```
You should see:
```
Connected to SQLite database
Database schema initialized successfully
Server is running on port 5000
```

### Step 3: Setup Frontend

1. **(Optional) Create `.env` file in `frontend/` directory:**
```
REACT_APP_API_URL=http://localhost:5000/api
```
(Defaults to this if not set)

2. **Start frontend:**
```bash
cd frontend
npm start
```
This will open http://localhost:3000 in your browser automatically.

### Step 4: Test the Application

## Testing Checklist

### ✅ Backend API Testing

#### 1. Health Check
```bash
curl http://localhost:5000/api/health
```
Expected: `{"status":"OK","message":"Server is running"}`

#### 2. Get Cab Types (Public)
```bash
curl http://localhost:5000/api/cabs/types
```
Expected: Array of cab types (Economy, Premium, Luxury, SUV)

#### 3. Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
Expected: JSON with `token` and `user` object

#### 4. Get Routes (Public)
```bash
curl http://localhost:5000/api/routes
```
Expected: Array of routes (empty initially)

### ✅ Frontend Testing

#### 1. Booking Page
- Navigate to: http://localhost:3000
- **Test:**
  - Enter "From Location" (e.g., "Airport")
  - Enter "To Location" (e.g., "City Center")
  - Select a cab type (Economy, Premium, etc.)
  - Click "Calculate Fare"
  - Verify fare is displayed
  - Fill in passenger details
  - Submit booking
  - Verify success message with booking ID

#### 2. Admin Login
- Navigate to: http://localhost:3000/admin/login
- **Test:**
  - Login with: `admin` / `admin123`
  - Should redirect to admin dashboard

#### 3. Admin Dashboard
- **Test Dashboard Tab:**
  - View statistics (Total Bookings, Active Cabs, etc.)
  
- **Test Cab Types Tab:**
  - View existing cab types
  - Click "+ Add Cab Type"
  - Create a new cab type
  - Edit an existing cab type
  - Delete a cab type

- **Test Cabs Tab:**
  - View existing cabs (empty initially)
  - Click "+ Add Cab"
  - Create a new cab with vehicle number and driver info
  - Edit a cab
  - Delete a cab

- **Test Routes Tab:**
  - View existing routes (empty initially)
  - Click "+ Add Route"
  - Create a route (From, To, Distance, Time)
  - Edit a route
  - Delete a route

- **Test Bookings Tab:**
  - View all bookings
  - Change booking status (Pending → Confirmed → In Progress → Completed)
  - Copy booking ID

### ✅ Integration Testing

1. **Create a Route:**
   - Go to Admin → Routes
   - Add route: From "Airport", To "Downtown", Distance: 15km, Time: 25min

2. **Create a Cab:**
   - Go to Admin → Cabs
   - Add cab: Vehicle Number "ABC-1234", select Cab Type, Driver Name, Phone

3. **Make a Booking:**
   - Go to Home page
   - Use the route you created (Airport → Downtown)
   - Select cab type
   - Calculate fare
   - Complete booking

4. **Verify in Admin:**
   - Go to Admin → Bookings
   - See your booking
   - Update status

## Common Issues & Solutions

### Backend Issues

**Issue: "Cannot find module 'sqlite3'"**
```bash
cd backend
npm install sqlite3
```

**Issue: "Database locked"**
- Close any other connections to the database
- Restart the server

**Issue: "Port 5000 already in use"**
- Change PORT in `.env` file
- Or kill the process using port 5000

### Frontend Issues

**Issue: "Cannot connect to API"**
- Check backend is running on port 5000
- Check `REACT_APP_API_URL` in frontend `.env`
- Check CORS is enabled in backend

**Issue: "Module not found"**
```bash
cd frontend
npm install
```

### Database Issues

**Issue: "Admin login fails"**
- Run setup script again:
```bash
cd backend
npm run setup-admin admin admin123 admin@cabcompany.com
```

**Issue: "Want to reset database"**
- Delete `backend/db/cab_booking.db`
- Restart server (will recreate database)
- Run setup-admin again

## Testing with Postman/Thunder Client

### Import these requests:

1. **Health Check**
   - GET `http://localhost:5000/api/health`

2. **Login**
   - POST `http://localhost:5000/api/auth/login`
   - Body: `{"username":"admin","password":"admin123"}`

3. **Get Cab Types**
   - GET `http://localhost:5000/api/cabs/types`

4. **Calculate Fare** (Public)
   - POST `http://localhost:5000/api/bookings/calculate-fare`
   - Body: 
   ```json
   {
     "from_location": "Airport",
     "to_location": "Downtown",
     "cab_type_id": 1
   }
   ```

5. **Create Booking** (Public)
   - POST `http://localhost:5000/api/bookings`
   - Body:
   ```json
   {
     "from_location": "Airport",
     "to_location": "Downtown",
     "cab_type_id": 1,
     "passenger_name": "John Doe",
     "passenger_phone": "1234567890",
     "passenger_email": "john@example.com"
   }
   ```

6. **Get All Bookings** (Admin - requires token)
   - GET `http://localhost:5000/api/admin/bookings`
   - Headers: `Authorization: Bearer <token_from_login>`

## Automated Testing Script

You can test the backend API with this simple script:

```bash
# Save as test-api.sh
#!/bin/bash

echo "Testing Health Check..."
curl http://localhost:5000/api/health

echo -e "\n\nTesting Cab Types..."
curl http://localhost:5000/api/cabs/types

echo -e "\n\nTesting Login..."
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

echo "Token: $TOKEN"

echo -e "\n\nTesting Admin Dashboard Stats..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/admin/dashboard/stats
```

## Next Steps After Testing

1. ✅ Verify all features work
2. ✅ Test error handling (invalid inputs, etc.)
3. ✅ Test edge cases (empty data, long strings, etc.)
4. ✅ Change admin password
5. ✅ Add more test data (cabs, routes)
6. ✅ Test booking flow end-to-end

