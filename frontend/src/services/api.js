import axios from 'axios';

// API base URL - defaults to localhost for development
// Set REACT_APP_API_URL in .env file for production
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;

