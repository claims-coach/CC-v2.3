/**
 * Machine Task Router
 * Routes inference tasks to optimal machines based on hardware + workload
 */

export type Machine = "mc-prod" | "mc-ollama" | "mc-dev" | "cc2";
export type TaskType =
  | "grok_reasoning"
  | "fast_consensus"
  | "deep_analysis"
  | "report_generation"
  | "control_execution";

export interface MachineConfig {
  name: Machine;
  hardware: string;
  memory_gb: number;
  models: string[];
  inference_framework: "mlx" | "ollama" | "cloud";
  latency_requirement_ms: number;
  throughput_tasks_per_min: number;
  cost_per_inference: number; // Relative cost (1 = baseline)
  role: string;
}

export interface TaskRequest {
  type: TaskType;
  priority: "critical" | "high" | "normal" | "low";
  estimated_tokens: number;
  timeout_ms: number;
  fallback_to_cloud?: boolean;
}

// Machine inventory
const machines: Record<Machine, MachineConfig> = {
  "mc-prod": {
    name: "mc-prod",
    hardware: "M4 Mac mini, 16GB",
    memory_gb: 16,
    models: ["qwen3-4b-4bit"],
    inference_framework: "mlx",
    latency_requirement_ms: 3000, // Fast decision logic
    throughput_tasks_per_min: 20,
    cost_per_inference: 0.1, // Cheap (local)
    role: "ORCHESTRATION ENGINE",
  },

  "mc-ollama": {
    name: "mc-ollama",
    hardware: "M1 MacBook, 32GB",
    memory_gb: 32,
    models: ["qwen3:30b-a3b"],
    inference_framework: "ollama",
    latency_requirement_ms: 20000, // Can afford to be slower
    throughput_tasks_per_min: 3,
    cost_per_inference: 0.2, // Cheap (local)
    role: "PRIMARY INFERENCE ENGINE",
  },

  "mc-dev": {
    name: "mc-dev",
    hardware: "M4 MacBook, 24GB",
    memory_gb: 24,
    models: ["qwen2.5-coder-14b-instruct-4bit"],
    inference_framework: "mlx",
    latency_requirement_ms: 10000, // Moderate
    throughput_tasks_per_min: 5,
    cost_per_inference: 0.15, // Cheap (local)
    role: "REPORT GENERATION",
  },

  "cc2": {
    name: "cc2",
    hardware: "M1 MacBook, 24GB",
    memory_gb: 24,
    models: ["qwen3-14b-4bit"],
    inference_framework: "mlx",
    latency_requirement_ms: 5000, // Fast failover decisions
    throughput_tasks_per_min: 5,
    cost_per_inference: 0.1, // Cheap (local)
    role: "FAILOVER COORDINATOR",
  },
};

// Task routing rules: what should run where
const routingRules: Record<TaskType, Machine[]> = {
  grok_reasoning: ["mc-prod"], // External, no local routing
  fast_consensus: ["mc-prod", "cc2"], // Quick decisions
  deep_analysis: ["mc-ollama", "mc-dev"], // Heavy lifting
  report_generation: ["mc-dev", "mc-ollama"], // PDF + structured data
  control_execution: ["mc-prod", "cc2"], // Orchestration
};

/**
 * Find best machine for a task
 */
export function routeTask(
  taskType: TaskType,
  priority: "critical" | "high" | "normal" | "low"
): Machine {
  const candidates = routingRules[taskType];

  if (!candidates || candidates.length === 0) {
    return "mc-prod"; // Default to gateway
  }

  // For critical tasks, use fastest machine
  if (priority === "critical") {
    let fastest = candidates[0];
    let fastestLatency = machines[fastest].latency_requirement_ms;

    for (const candidate of candidates) {
      if (machines[candidate].latency_requirement_ms < fastestLatency) {
        fastest = candidate;
        fastestLatency = machines[candidate].latency_requirement_ms;
      }
    }

    return fastest;
  }

  // For normal tasks, use cheapest machine
  let cheapest = candidates[0];
  let lowestCost = machines[cheapest].cost_per_inference;

  for (const candidate of candidates) {
    if (machines[candidate].cost_per_inference < lowestCost) {
      cheapest = candidate;
      lowestCost = machines[candidate].cost_per_inference;
    }
  }

  return cheapest;
}

/**
 * Get machine config
 */
export function getMachineConfig(machine: Machine): MachineConfig {
  const config = machines[machine];
  if (!config) {
    throw new Error(`Unknown machine: ${machine}`);
  }
  return config;
}

/**
 * Get endpoint for machine
 */
export function getMachineEndpoint(
  machine: Machine,
  framework: "mlx" | "ollama"
): string {
  const endpoints: Record<Machine, Record<string, string>> = {
    "mc-prod": {
      mlx: "http://localhost:8000/api/completion",
      ollama: "http://localhost:11434/api/generate",
    },
    "mc-ollama": {
      mlx: "http://10.0.0.x:8000/api/completion",
      ollama: "http://10.0.0.x:11434/api/generate",
    },
    "mc-dev": {
      mlx: "http://10.0.2.2:8000/api/completion",
      ollama: "http://10.0.2.2:11434/api/generate",
    },
    "cc2": {
      mlx: "http://10.0.2.3:8000/api/completion",
      ollama: "http://10.0.2.3:11434/api/generate",
    },
  };

  return endpoints[machine][framework];
}

/**
 * Check if machine is healthy
 */
export async function checkMachineHealth(machine: Machine): Promise<boolean> {
  const config = machines[machine];
  const endpoint = getMachineEndpoint(machine, config.inference_framework);

  try {
    const res = await fetch(endpoint, {
      method: "HEAD",
      timeout: 5000,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get current load on machine
 */
export async function getMachineLoad(
  machine: Machine
): Promise<{ memory_used: number; memory_total: number; queue_size: number }> {
  // TODO: Implement health check endpoint on each machine
  // For now, return dummy data
  const config = machines[machine];

  return {
    memory_used: Math.random() * config.memory_gb,
    memory_total: config.memory_gb,
    queue_size: Math.floor(Math.random() * 10),
  };
}

/**
 * Routing strategy: balance by load
 */
export async function routeTaskWithLoadBalancing(
  taskType: TaskType,
  priority: "critical" | "high" | "normal" | "low"
): Promise<Machine> {
  const candidates = routingRules[taskType];

  if (!candidates || candidates.length === 0) {
    return "mc-prod";
  }

  // Check health
  const healthyMachines = await Promise.all(
    candidates.map(async (machine) => ({
      machine,
      healthy: await checkMachineHealth(machine),
    }))
  );

  const healthy = healthyMachines.filter((m) => m.healthy).map((m) => m.machine);

  if (healthy.length === 0) {
    console.warn(`No healthy machines for ${taskType}, using fallback`);
    return "mc-prod";
  }

  // Load balance among healthy machines
  const loads = await Promise.all(healthy.map(getMachineLoad));
  const sorted = healthy.sort(
    (a, b) => loads[healthy.indexOf(a)].queue_size - loads[healthy.indexOf(b)].queue_size
  );

  return sorted[0];
}

/**
 * Report on cluster capacity
 */
export async function clusterCapacityReport(): Promise<{
  total_machines: number;
  healthy_machines: number;
  total_memory_gb: number;
  total_throughput_tasks_per_min: number;
  machines: Array<{
    name: Machine;
    healthy: boolean;
    memory_used_gb: number;
    queue_size: number;
  }>;
}> {
  const machineNames = Object.keys(machines) as Machine[];
  const statuses = await Promise.all(
    machineNames.map(async (name) => ({
      name,
      healthy: await checkMachineHealth(name),
      load: await getMachineLoad(name),
    }))
  );

  const healthyCount = statuses.filter((s) => s.healthy).length;
  const totalMemory = machineNames.reduce(
    (sum, name) => sum + machines[name].memory_gb,
    0
  );
  const totalThroughput = machineNames.reduce(
    (sum, name) => sum + machines[name].throughput_tasks_per_min,
    0
  );

  return {
    total_machines: machineNames.length,
    healthy_machines: healthyCount,
    total_memory_gb: totalMemory,
    total_throughput_tasks_per_min: totalThroughput,
    machines: statuses.map((s) => ({
      name: s.name,
      healthy: s.healthy,
      memory_used_gb: s.load.memory_used,
      queue_size: s.load.queue_size,
    })),
  };
}
