#!/bin/bash
# Array Setup Script — Configure 3-machine unified system
# Run once on each machine to enable cross-machine communication

set -e

MACHINE_TYPE=${1:-unknown}  # "prod" | "dev" | "ollama"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Claims.Coach Array Setup — $MACHINE_TYPE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Verify mDNS / Bonjour is enabled ────────────────────────────
echo "✓ Checking mDNS (macOS Bonjour)..."
if ! dscl localhost -ls / | grep -q mdns; then
  echo "⚠️  mDNS may not be configured. Ensure Bonjour is enabled."
fi

# ── Step 2: Broadcast machine hostname via mDNS ──────────────────────────
case $MACHINE_TYPE in
  prod)
    HOSTNAME="mc-prod"
    DESCRIPTION="Production (Mission Control, GHL, crons)"
    ;;
  dev)
    HOSTNAME="mc-dev"
    DESCRIPTION="Development (Local testing)"
    ;;
  ollama)
    HOSTNAME="mc-ollama"
    DESCRIPTION="LLM Inference (Ollama)"
    ;;
  *)
    echo "❌ Usage: ./array-setup.sh [prod|dev|ollama]"
    exit 1
    ;;
esac

echo "✓ Setting hostname: $HOSTNAME"
sudo scutil --set HostName "$HOSTNAME"
sudo scutil --set LocalHostName "$HOSTNAME"
sudo scutil --set ComputerName "$HOSTNAME"

# ── Step 3: Verify connectivity to other machines ────────────────────────
echo "✓ Testing mDNS connectivity..."

MACHINES=("mc-prod" "mc-dev" "mc-ollama")
for m in "${MACHINES[@]}"; do
  if [ "$m" != "$HOSTNAME" ]; then
    if ping -c 1 "$m.local" &>/dev/null; then
      echo "  ✓ $m.local is reachable"
    else
      echo "  ⚠️  $m.local not reachable yet (will work once all are on network)"
    fi
  fi
done

# ── Step 4: Start OpenClaw gateway (if mc-prod) ────────────────────────
if [ "$MACHINE_TYPE" = "prod" ]; then
  echo "✓ Verifying OpenClaw gateway..."
  if ! pgrep -f "openclaw.*gateway" > /dev/null; then
    echo "  ⚠️  Gateway not running. Start with: openclaw gateway start"
  else
    echo "  ✓ Gateway is running (pid: $(pgrep -f 'openclaw.*gateway'))"
  fi
fi

# ── Step 5: Start Ollama (if mc-ollama) ────────────────────────────────
if [ "$MACHINE_TYPE" = "ollama" ]; then
  echo "✓ Verifying Ollama service..."
  if ! pgrep -f "ollama.*serve" > /dev/null; then
    echo "  ⚠️  Ollama not running. Start with: ollama serve"
  else
    echo "  ✓ Ollama is running (pid: $(pgrep -f 'ollama.*serve'))"
  fi
  
  # Test Ollama API
  if curl -s http://localhost:11434/api/tags &>/dev/null; then
    MODELS=$(curl -s http://localhost:11434/api/tags | jq '.models | length')
    echo "  ✓ Ollama API working ($MODELS models loaded)"
  else
    echo "  ⚠️  Ollama API not responding"
  fi
fi

# ── Step 6: Install health monitoring agent ────────────────────────────
echo "✓ Setting up health monitoring..."
mkdir -p ~/.openclaw/agents
cp "$(dirname "$0")/system-health.mjs" ~/.openclaw/agents/system-health-$MACHINE_TYPE.mjs 2>/dev/null || echo "  (health script will be deployed separately)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Array Setup Complete for $HOSTNAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next Steps:"
echo "1. Run this script on all 3 machines:"
echo "   - mc-prod:  ./scripts/array-setup.sh prod"
echo "   - mc-dev:   ./scripts/array-setup.sh dev"
echo "   - mc-ollama: ./scripts/array-setup.sh ollama"
echo ""
echo "2. Verify connectivity:"
echo "   ping mc-prod.local"
echo "   ping mc-dev.local"
echo "   ping mc-ollama.local"
echo ""
echo "3. Test R&D Council on mc-ollama:"
echo "   node scripts/rd-council.mjs"
echo ""
