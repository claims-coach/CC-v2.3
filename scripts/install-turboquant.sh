#!/bin/bash
set -e

echo "🚀 Installing TurboQuant for MLX across cluster..."

# Function to install on a machine
install_turboquant() {
    local HOST=$1
    local USER=$2
    local SSH_KEY=$3
    local NAME=$4
    
    echo "📦 Installing TurboQuant on $NAME ($HOST)..."
    
    if [ -z "$SSH_KEY" ]; then
        # Local machine, no SSH needed
        bash << 'EOF'
    else
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$USER@$HOST" << 'EOF'
    fi
    set -e
    
    # Install via uv (faster than pip)
    if ! command -v uv &> /dev/null; then
        curl -LsSf https://astral.sh/uv/install.sh | sh
    fi
    
    # Clone the production MLX implementation
    if [ ! -d ~/turboquant-mlx ]; then
        git clone https://github.com/rachittshah/mlx-turboquant ~/turboquant-mlx
        cd ~/turboquant-mlx
    else
        cd ~/turboquant-mlx
        git pull
    fi
    
    # Install dependencies
    uv sync --dev
    
    # Run unit tests to verify
    echo "✅ Running unit tests..."
    uv run python tests/test_core.py
    
    echo "✅ TurboQuant installed and verified on $(hostname)"
EOF
}

# Install on all nodes
install_turboquant "localhost" "cc" "" "mc-prod (gateway)"
install_turboquant "192.168.19.107" "cc3" "~/.ssh/mc-dev-key" "mc-dev"
install_turboquant "mc-ollama.local" "ccm1" "~/.ssh/mc-ollama-key" "mc-ollama"
install_turboquant "10.0.2.3" "cc2" "~/.ssh/id_ed25519" "cc2"

echo "✅ TurboQuant installation complete across all nodes!"
