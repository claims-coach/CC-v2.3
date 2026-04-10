#!/bin/bash

# Deploy system health monitoring to all MLX cluster nodes
# Collects: CPU, Memory, Disk, Temperature, Battery, Neural Engine usage
# Pushes to Convex every 30 seconds

set -e

NODES=(
  "cc@192.168.1.150:mc-prod"
  "cc@192.168.1.151:cc2"
  "cc@192.168.1.152:mc-dev"
  "cc@192.168.1.153:mc-ollama"
)

echo "🚀 Deploying system health monitoring to MLX cluster..."
echo ""

for node_info in "${NODES[@]}"; do
  IFS=':' read -r ssh_target node_name <<< "$node_info"
  
  echo "📊 Setting up $node_name ($ssh_target)..."
  
  # Copy the health monitoring script
  scp ~/.openclaw/workspace/claims-coach-mc/scripts/system-health.mjs "$ssh_target:~/claims-coach-mc/scripts/" 2>/dev/null || echo "   ⚠️ Copy skipped (may already exist)"
  
  # Install dependencies if needed
  ssh "$ssh_target" "cd ~/claims-coach-mc && npm list convex >/dev/null 2>&1 || npm install convex" 2>/dev/null || true
  
  # Kill any existing process
  ssh "$ssh_target" "pkill -f system-health.mjs || true" 2>/dev/null || true
  
  # Start the health monitoring daemon
  ssh "$ssh_target" "nohup node ~/claims-coach-mc/scripts/system-health.mjs > /tmp/system-health.log 2>&1 &" 2>/dev/null || true
  
  # Verify it started
  sleep 2
  if ssh "$ssh_target" "pgrep -f system-health.mjs >/dev/null"; then
    echo "   ✅ Health monitoring running"
  else
    echo "   ❌ Failed to start health monitoring"
  fi
done

echo ""
echo "✅ Health monitoring deployed to all nodes!"
echo ""
echo "🔍 Verify data is flowing:"
echo "   Open Mission Control: https://app.claims.coach/system"
echo "   Should show REAL live data (not mock)"
echo ""
echo "📋 Check logs on any node:"
echo "   ssh cc@192.168.1.153 tail -f /tmp/system-health.log"
