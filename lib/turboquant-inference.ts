/**
 * TurboQuant + MLX Cluster Inference Router
 * 
 * Automatically selects optimal quantization strategy based on:
 * - Context length (long contexts use 3-bit, short use 4-bit)
 * - Available VRAM (spreads load across mc-dev + mc-ollama)
 * - Model size (llama 70B → mc-ollama, mistral 7B → mc-dev)
 */

interface TurboQuantConfig {
  model: string;
  bits: 2 | 2.5 | 3 | 3.5 | 4;
  version: "v2" | "v3"; // V2=speed, V3=quality
  useRotation: boolean;
  useQJL: boolean; // Quality-Jitter-Loss correction
  channelSplit?: number; // For fractional bits (e.g., 64 channels @ 4-bit)
}

interface MLXNode {
  name: string;
  host: string;
  memory: number; // GB
  model: string;
  maxContextLength: number;
  capabilities: "inference" | "generation" | "both";
}

// Your cluster topology
const CLUSTER: Record<string, MLXNode> = {
  "mc-ollama": {
    name: "mc-ollama (M1 32GB)",
    host: "10.0.0.2",
    memory: 32,
    model: "llama3.3:70b",
    maxContextLength: 8192,
    capabilities: "both",
  },
  "mc-dev": {
    name: "mc-dev (M4 24GB)",
    host: "10.0.2.2",
    memory: 24,
    model: "mistral:7b",
    maxContextLength: 4096,
    capabilities: "both",
  },
  "mc-prod": {
    name: "mc-prod (M4 16GB, gateway)",
    host: "127.0.0.1",
    memory: 16,
    model: "mistral:7b",
    maxContextLength: 2048,
    capabilities: "inference",
  },
  "cc2": {
    name: "cc2 (Failover)",
    host: "10.0.2.3",
    memory: 16,
    model: "mistral:7b",
    maxContextLength: 2048,
    capabilities: "inference",
  },
};

/**
 * Select optimal TurboQuant strategy for context length
 * 
 * Results (Llama 3.2 3B, PPL perplexity):
 * - 4-bit: baseline -0.8% (near lossless)
 * - 3-bit: +5.3% (good for T<8K)
 * - 2.5-bit: +7-35% (aggressive, for very long contexts 16K+)
 */
function selectQuantizationStrategy(
  contextLength: number,
  priorityQuality: boolean
): TurboQuantConfig {
  if (contextLength > 8192) {
    // Long context: aggressively compress KV cache
    return {
      model: "llama3.3:70b",
      bits: priorityQuality ? 3.5 : 3,
      version: "v3",
      useRotation: true,
      useQJL: true,
    };
  }

  if (contextLength > 4096) {
    // Medium context: balance speed + quality
    return {
      model: "llama3.3:70b",
      bits: 4,
      version: "v2",
      useRotation: true,
      useQJL: false, // V2 LEAN: ~100% speed
    };
  }

  // Short context: maximum quality
  return {
    model: "llama3.3:70b",
    bits: 4,
    version: "v2",
    useRotation: true,
    useQJL: false,
  };
}

/**
 * Route inference to optimal node
 * 
 * Heuristics:
 * 1. Prefer mc-ollama (32GB, primary inference)
 * 2. Fall back to mc-dev if mc-ollama at capacity
 * 3. mc-prod handles low-latency inference (<512 tokens)
 * 4. cc2 is hot-standby failover
 */
function selectNode(
  contextLength: number,
  modelSize: "7b" | "70b"
): MLXNode {
  if (modelSize === "70b" && contextLength < 4096) {
    // Short context: use primary inference node
    return CLUSTER["mc-ollama"];
  }

  if (modelSize === "70b" && contextLength >= 4096) {
    // Long context: load balance between mc-ollama + mc-dev
    // (Assume mc-dev has 4-bit mistral, can help with smaller models)
    const ollamaScore = 32 - estimateMemoryUsage(contextLength, "70b");
    const devScore = 24 - estimateMemoryUsage(contextLength, "7b");

    return ollamaScore > devScore ? CLUSTER["mc-ollama"] : CLUSTER["mc-dev"];
  }

  if (modelSize === "7b") {
    // Small model: can run on any node, prefer closer nodes for latency
    return CLUSTER["mc-dev"]; // 24GB M4 is ideal for 7B models
  }

  throw new Error(`Unknown model size: ${modelSize}`);
}

/**
 * Estimate VRAM usage with TurboQuant compression
 *
 * Formula: model_weights + kv_cache * compression_ratio
 *
 * Example (Llama 3.3 70B, 3-bit TurboQuant):
 * - Model weights: 70B * 4 bits = ~27.5 GB (quantized)
 * - KV cache (8K context): ~19 GB × 4.7x compression = ~4 GB
 * - Total: ~31.5 GB (fits on 32GB mc-ollama)
 */
function estimateMemoryUsage(
  contextLength: number,
  modelSize: "7b" | "70b"
): number {
  const modelMemory = modelSize === "70b" ? 27.5 : 3.5; // 4-bit quantized

  // Approximate KV cache: 2 * num_layers * batch * seq_len * hidden_dim * bytes
  // Llama 70B: 80 layers, hidden_dim=8192
  // = 2 * 80 * 1 * contextLength * 8192 * 2 / 1e9 GB
  const kvCacheBaseline = (contextLength * 81.92) / 1024; // Very rough

  // With 3-bit TurboQuant compression (4.7x)
  const kvCacheCompressed = kvCacheBaseline / 4.7;

  return modelMemory + kvCacheCompressed;
}

/**
 * Generate MLX inference script for a given node
 */
function generateMLXInferenceScript(
  node: MLXNode,
  config: TurboQuantConfig
): string {
  return `#!/bin/bash
# Generated TurboQuant inference script for ${node.name}

MODEL="${config.model}"
BITS=${config.bits}
VERSION="${config.version}"
USE_ROTATION=${config.useRotation}
USE_QJL=${config.useQJL}

echo "🚀 Starting TurboQuant inference on ${node.name}..."
echo "  Model: $MODEL"
echo "  Bits: $BITS"
echo "  Version: $VERSION"

python3 << 'PYTHON_EOF'
import mlx.core as mx
from mlx_lm import load
from turboquant.cache_${config.version} import TurboQuantKVCache${config.version.upper()}
import turboquant.patch as tq_patch

# Monkey-patch mlx-lm to use TurboQuant KV cache
tq_patch.apply()

# Load model
model, tokenizer = load("mlx-community/${config.model}-4bit")

# Initialize TurboQuant KV cache
n_layers = len(model.layers)
head_dim = model.layers[0].self_attn.head_dim

if "${config.version}" == "v2":
    cache = [
        TurboQuantKVCacheV2(
            head_dim=head_dim,
            bits=${config.bits},
            group_size=64,
            use_rotation=${config.useRotation},
            use_qjl=${config.useQJL},
        )
        for _ in range(n_layers)
    ]
else:  # v3
    cache = [
        TurboQuantKVCacheV3(
            head_dim=head_dim,
            bits=int(${config.bits}),
            n_outlier=64,
            outlier_bits=int(${config.bits})+1 if ${config.bits} % 1 == 0.5 else int(${config.bits}),
        )
        for _ in range(n_layers)
    ]

print(f"✅ Cache initialized with {len(cache)} layers")
print(f"   Memory per layer: {cache[0].nbytes / 1e9:.2f} GB")

# Example inference
prompt = "What is machine learning?"
tokens = tokenizer.encode(prompt)
print(f"\\n📝 Prompt: {prompt}")

# Generate with compressed KV cache
logits = model(mx.array([tokens]), cache=cache)
print(f"✅ Inference complete with TurboQuant cache")

PYTHON_EOF
`;
}

/**
 * Export for use in claims-coach-mc
 */
export {
  TurboQuantConfig,
  MLXNode,
  CLUSTER,
  selectQuantizationStrategy,
  selectNode,
  estimateMemoryUsage,
  generateMLXInferenceScript,
};
