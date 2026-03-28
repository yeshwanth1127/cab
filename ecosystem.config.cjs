/**
 * PM2 ecosystem config for Namma Cabs backend.
 * Usage: pm2 start ecosystem.config.cjs
 * From: /var/www/nammacabs.com/cab (or use full path to this file).
 */
module.exports = {
  apps: [
    {
      name: 'nammacabs-backend',
      cwd: '/var/www/nammacabs.com/cab/backend',
      script: 'server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: './logs/nammacabs-backend-error.log',
      out_file: './logs/nammacabs-backend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
