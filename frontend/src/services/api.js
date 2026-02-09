import axios from 'axios';

const rawApiURL = process.env.REACT_APP_API_URL || '';
const apiBaseURL = (typeof rawApiURL === 'string' && (rawApiURL.startsWith('http://') || rawApiURL.startsWith('https://')))
  ? rawApiURL
  : (typeof window !== 'undefined' && window.location)
    ? window.location.origin + (rawApiURL.startsWith('/') ? rawApiURL : '/' + (rawApiURL || 'api').replace(/^\/?/, ''))
    : rawApiURL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getBackendBaseURL() {
  if (typeof apiBaseURL === 'string' && (apiBaseURL.startsWith('http://') || apiBaseURL.startsWith('https://'))) {
    return apiBaseURL.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
}

function shouldUseApiUploadsPath() {
  if (typeof rawApiURL !== 'string') return true;
  if (rawApiURL.startsWith('http://') || rawApiURL.startsWith('https://')) return false;
  return true;
}

export function getImageUrl(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null;
  const trimmed = relativePath.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (!path.toLowerCase().startsWith('/uploads')) {
    path = path.startsWith('/') ? `/uploads${path}` : `/uploads/${path}`;
  }

  const backendBaseURL = getBackendBaseURL();
  if (shouldUseApiUploadsPath() && backendBaseURL) {
    const uploadsSegment = path.replace(/^\/uploads\/?/, '/');
    return `${backendBaseURL}/api/uploads${uploadsSegment}`;
  }
  if (backendBaseURL) {
    return `${backendBaseURL}${path}`;
  }

  return path;
}

export default api;
