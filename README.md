# Cab Booking System

A full-stack cab booking system with admin panel built with React, Node.js/Express, and SQLite.

## Features

- **Customer Booking Interface**
  - Select pickup and destination locations
  - Choose from multiple cab types (Economy, Premium, Luxury, SUV)
  - Dynamic fare calculation based on distance and time
  - Complete booking with passenger details

- **Admin Panel**
  - Secure admin login
  - Dashboard with statistics
  - Manage cab types (add, edit, delete, set fares)
  - Manage individual cabs (vehicles and drivers)
  - Manage routes (popular routes with fixed distances)
  - View and manage all bookings
  - Update booking statuses

## Tech Stack

- **Frontend**: React, React Router, Axios
- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Authentication**: JWT (JSON Web Tokens)

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Database Setup

**No database installation needed!** SQLite is file-based and will be created automatically.

The database file will be created at `backend/db/cab_booking.db` when you first run the server.

1. Set up the admin user:
```bash
cd backend
npm run setup-admin [username] [password] [email]
```

Default values (if not provided):
- Username: `admin`
- Password: `admin123`
- Email: `admin@cabcompany.com`

Example:
```bash
npm run setup-admin admin MySecurePassword123 admin@mycompany.com
```

**Important**: Change the default admin password after first login!

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (copy from `.env.example`):
```bash
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

**Note**: SQLite database file will be created automatically at `backend/db/cab_booking.db`. No database server setup needed!

4. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, defaults to localhost:5000):
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

4. Start the frontend development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

### Running Both Servers

From the root directory, you can run both servers concurrently:
```bash
npm run dev
```

Or install all dependencies at once:
```bash
npm run install-all
```

## Project Structure

```
cab/
├── backend/
│   ├── db/
│   │   ├── schema.sql          # Database schema
│   │   ├── database.js          # SQLite database connection
│   │   └── cab_booking.db      # SQLite database file (created automatically)
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── routes/
│   │   ├── admin.js            # Admin routes
│   │   ├── auth.js             # Authentication routes
│   │   ├── bookings.js         # Booking routes
│   │   ├── cabs.js             # Cab routes
│   │   └── routes.js           # Route routes
│   ├── scripts/
│   │   └── setup-admin.js      # Admin user setup script
│   ├── server.js               # Express server
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── context/            # React context (Auth)
│   │   ├── pages/              # Page components
│   │   ├── services/           # API service
│   │   └── App.js
│   └── package.json
└── README.md
```

## API Endpoints

### Public Endpoints
- `GET /api/cabs/types` - Get all active cab types
- `GET /api/routes` - Get all active routes
- `POST /api/bookings/calculate-fare` - Calculate fare
- `POST /api/bookings` - Create a booking

### Admin Endpoints (Requires Authentication)
- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current user
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/cab-types` - Get all cab types
- `POST /api/admin/cab-types` - Create cab type
- `PUT /api/admin/cab-types/:id` - Update cab type
- `DELETE /api/admin/cab-types/:id` - Delete cab type
- Similar endpoints for `/api/admin/cabs`, `/api/admin/routes`, `/api/admin/bookings`

## Default Data

The schema includes default cab types:
- Economy: Base ₹50, ₹12/km
- Premium: Base ₹100, ₹20/km
- Luxury: Base ₹150, ₹30/km
- SUV: Base ₹120, ₹25/km

## Security Notes

- Change the default admin password immediately
- Use a strong JWT_SECRET in production
- Implement rate limiting in production
- Use HTTPS in production
- Consider adding input validation and sanitization
- Add CORS configuration for production
- Keep the SQLite database file (`cab_booking.db`) secure and backed up

## Future Enhancements

- User registration and login
- Payment integration
- Real-time tracking
- Google Maps integration for accurate distance calculation
- Email notifications
- SMS notifications
- Driver mobile app
- Rating and review system

## License

ISC

