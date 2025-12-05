import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainNavbar from '../components/MainNavbar';
import './UserAuth.css';

const UserAuth = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { username, email, password } = form;
    let result;

    if (mode === 'login') {
      result = await login(username, password);
    } else {
      result = await register(username, email, password);
    }

    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Something went wrong');
      return;
    }

    navigate('/');
  };

  return (
    <div className="user-auth-page">
      <MainNavbar />
      <div className="container">
        <div className="user-auth-card">
          <div className="auth-toggle">
            <button
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <h2>{mode === 'login' ? 'User Login' : 'Create an Account'}</h2>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="user-auth-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting
                ? mode === 'login'
                  ? 'Logging in...'
                  : 'Registering...'
                : mode === 'login'
                  ? 'Login'
                  : 'Register'}
            </button>
          </form>

          {mode === 'login' ? (
            <p className="auth-helper">
              New here?{' '}
              <button type="button" onClick={() => setMode('register')}>
                Create an account
              </button>
            </p>
          ) : (
            <p className="auth-helper">
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')}>
                Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserAuth;


