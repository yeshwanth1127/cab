#!/bin/bash
# Start backend with PM2 on port 3223
cd /var/www/nammacabs/cab/backend
pm2 start server.js --name nammabackend --watch
pm2 save
pm2 startup
