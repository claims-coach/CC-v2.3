#!/bin/bash
# plaud-sync-wrapper.sh — Load env vars and run plaud-sync.mjs
# This wrapper handles the .env.local file which contains pipes and special chars
# that can't be safely sourced by bash.

cd ~/claims-coach-mc || exit 1

# Parse .env.local and export as env vars
export $(grep -v '^#' .env.local | xargs)

# Run the sync script
node scripts/plaud-sync.mjs
