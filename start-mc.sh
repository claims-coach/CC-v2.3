#!/bin/bash
cd "$(dirname "$0")"
export NODE_ENV=production
export PORT=3000

# Start Next.js production server
npx next start -p $PORT
