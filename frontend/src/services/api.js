import axios from 'axios';

// API base URL - defaults to localhost for development
// Set REACT_APP_API_URL in .env file for production
const apiBaseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to convert relative image paths to full URLs
// This is needed because the backend returns relative paths like /uploads/...
// but the frontend needs full URLs to load images from the backend server
export function getImageUrl(relativePath) {
  if (!relativePath) return null;
  
  // If it's already a full URL, return as is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // Get the backend base URL
  let backendBaseURL;
  if (apiBaseURL.startsWith('http://') || apiBaseURL.startsWith('https://')) {
    // Full URL provided (e.g., http://localhost:5000/api)
    backendBaseURL = apiBaseURL.replace('/api', '');
  } else if (apiBaseURL.startsWith('/')) {
    // Relative path (e.g., /api) - use current origin
    backendBaseURL = window.location.origin;
  } else {
    // Fallback to current origin
    backendBaseURL = window.location.origin;
  }
  
  // Ensure relative path starts with /
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  
  return `${backendBaseURL}${path}`;
}

export default api;

