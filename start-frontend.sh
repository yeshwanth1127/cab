#!/bin/bash
# Serve frontend on port 3333 using a simple static server (e.g., serve)
cd /var/www/nammacabs/cab/frontend
npx serve -s public -l 3333
