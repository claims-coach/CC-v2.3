#!/bin/bash

# Combined Plaud + Gemini Notes Sync
# Runs both sync scripts and logs results

echo "=========================================="
echo "$(date '+%Y-%m-%d %H:%M:%S') - Note Sync Started"
echo "=========================================="

# Source env vars
export $(cat /Users/cc/claims-coach-mc/.env.local 2>/dev/null | grep -v "^#" | xargs -0)

# Sync Plaud recordings
echo ""
echo ">>> Plaud Sync..."
node /Users/cc/claims-coach-mc/scripts/plaud-sync.mjs

# Sync Gemini notes
echo ""
echo ">>> Gemini Notes Sync..."
node /Users/cc/claims-coach-mc/scripts/gemini-notes-sync.mjs

echo ""
echo "=========================================="
echo "$(date '+%Y-%m-%d %H:%M:%S') - Note Sync Complete"
echo "=========================================="
