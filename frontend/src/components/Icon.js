import React from 'react';

const icons = {
  office: (
    <path d="M3 21h18V3H3v18zm2-2v-4h3v4H5zm5 0v-4h3v4h-3zm5 0v-4h3v4h-3z" />
  ),
  car: (
    <path d="M3 11v6a1 1 0 0 0 1 1h1a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h1a1 1 0 0 0 1-1v-6l-2-4H5l-2 4zM6.5 16a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
  ),
  billing: (
    <path d="M10 4V3h4v1h5v4H5V4h5zM4 9h16v10H4z" />
  ),
  shield: (
    <path d="M12 2l7 4v6c0 5.25-3.25 9.74-7 10-3.75-.26-7-4.75-7-10V6l7-4z" />
  ),
  pin: (
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
  ),
  airport: (
    <path d="M21 16v-2l-8-5V3.5a.5.5 0 0 0-.85-.36L10 5 3 7v2l7-2 2.15 1.86A.5.5 0 0 0 13 9.5V14l8 2z" />
  ),
  target: (
    <path d="M12 6.5A5.5 5.5 0 1 0 17.5 12 5.51 5.51 0 0 0 12 6.5zm0 2A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5zM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5z" />
  ),
  events: (
    <path d="M12 2l1.5 4L18 8l-3 2 1 4-4-2-4 2 1-4-3-2 4.5-2L12 2z" />
  )
};

const Icon = ({ name, size = 24, className = '', title }) => {
  const path = icons[name];
  if (!path) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
    >
      {path}
    </svg>
  );
};

export default Icon;
