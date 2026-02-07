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

// Helper function to convert relative image paths to full URLs.
// - Paths in frontend/public/ (e.g. "ciaz.jpg", "ertiga.avif") → same-origin, e.g. /ciaz.jpg
// - Paths for backend uploads (contain "uploads") → full backend URL, e.g. /uploads/car-options/...
export function getImageUrl(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null;
  const trimmed = relativePath.trim();
  if (!trimmed) return null;

  // If it's already a full URL, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Backend uploads: path contains "uploads" → resolve against backend URL
  if (trimmed.toLowerCase().includes('uploads')) {
    let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (!path.toLowerCase().startsWith('/uploads')) {
      path = path.startsWith('/') ? `/uploads${path}` : `/uploads/${path}`;
    }
    let backendBaseURL = '';
    if (typeof apiBaseURL === 'string' && (apiBaseURL.startsWith('http://') || apiBaseURL.startsWith('https://'))) {
      backendBaseURL = apiBaseURL.replace(/\/api\/?$/, '');
    } else if (typeof window !== 'undefined' && window.location) {
      backendBaseURL = window.location.origin;
    }
    return `${backendBaseURL}${path}`;
  }

  // Frontend public folder: files in public/ are served at site root (same origin)
  // e.g. "ciaz.jpg" or "ertiga.avif" → /ciaz.jpg, /ertiga.avif
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return path;
}

export default api;

