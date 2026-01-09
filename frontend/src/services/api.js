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
  
  // Extract base URL without /api suffix
  const backendBaseURL = apiBaseURL.replace('/api', '');
  
  // Ensure relative path starts with /
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  
  return `${backendBaseURL}${path}`;
}

export default api;

