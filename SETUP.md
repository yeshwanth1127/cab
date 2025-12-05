# Quick Setup Guide

## Step 1: Database Setup

**No database installation needed!** SQLite is file-based and will be created automatically when you first run the server.

The database file will be created at `backend/db/cab_booking.db`.

## Step 2: Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_change_this
NODE_ENV=development
```

**Note**: SQLite database will be created automatically. No database server setup required!

Set up admin user:
```bash
npm run setup-admin admin admin123 admin@cabcompany.com
```

Start backend:
```bash
npm run dev
```

## Step 3: Frontend Setup

```bash
cd frontend
npm install
```

(Optional) Create `.env` file:
```
REACT_APP_API_URL=http://localhost:5000/api
```

Start frontend:
```bash
npm start
```

## Step 4: Access the Application

- Frontend: http://localhost:3000
- Admin Panel: http://localhost:3000/admin/login
- Backend API: http://localhost:5000/api

## Default Admin Credentials

- Username: `admin`
- Password: `admin123`

**Change this immediately after first login!**
