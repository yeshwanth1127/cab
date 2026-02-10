#!/bin/bash
# Build React frontend and prepare for serving.
# The Node backend serves files from cab/frontend/build when it runs.
set -e
cd "$(dirname "$0")/frontend"
echo "Building frontend..."
npm run build
echo "Done. Restart the backend (e.g. pm2 restart nammacabs-backend) to serve the new build."
