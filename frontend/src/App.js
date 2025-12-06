import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import CarOptions from './pages/CarOptions';
import CheckBooking from './pages/CheckBooking';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import UserAuth from './pages/UserAuth';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import AccountPage from './pages/AccountPage';
import CornerLogo from './components/CornerLogo';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/car-options" element={<CarOptions />} />
          <Route path="/check-booking" element={<CheckBooking />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/login" element={<UserAuth />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

