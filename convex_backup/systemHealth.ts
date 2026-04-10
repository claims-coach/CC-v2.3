import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  handler: async (ctx) => {
    return ctx.db.query("systemHealth")
      .withIndex("by_key", q => q.eq("key", "latest"))
      .first();
  },
});

// Returns the last 60 history snapshots (30 min at 30s intervals) for mc-prod
export const getHistory = query({
  handler: async (ctx) => {
    const health = await ctx.db.query("systemHealth")
      .withIndex("by_key", q => q.eq("key", "latest"))
      .first();
    if (!health?.history) return [];
    try {
      return JSON.parse(health.history) as Array<{
        ts: number; cpu: number; gpu: number; mem: number; disk: number;
      }>;
    } catch {
      return [];
    }
  },
});

// Get health data for all nodes (for dashboard)
export const getAllNodes = query({
  handler: async (ctx) => {
    const health = await ctx.db.query("systemHealth")
      .withIndex("by_key", q => q.eq("key", "latest"))
      .first();

    if (!health) return [];

    // If we have full per-node data, use it
    if (health.nodesJson) {
      try {
        return JSON.parse(health.nodesJson) as NodeData[];
      } catch { /* fall through to derived */ }
    }

    // Fallback: derive from health fields (mc-prod only has real data)
    return [
      buildNode("mc-prod", "Gateway",      "10.0.0.1",   "M4 Mac mini (16GB)",        null,
        health.cpu || 0, health.memPct || 0, health.memUsedGb || 0, 16,
        health.gpuDevice || 0, health.gpuRenderer || 0, health.diskPct || 0,
        health.diskUsedGb || 0, health.diskTotalGb || 0,
        [], health.ollamaModels || [], true),

      buildNode("mc-ollama", "LLM Inference", "10.0.0.2", "M1 Max MacBook Pro (32GB)", 100,
        0, health.memOllamaPct || 0, health.memOllamaUsedGb || 0, 32,
        0, 0, 0, 0, 0,
        [], [], health.mcOllamaOnline === true),

      buildNode("mc-dev", "Report Gen",   "10.0.2.2",   "M4 MacBook Pro (24GB)",      100,
        0, health.memDevPct || 0, health.memDevUsedGb || 0, 24,
        0, 0, 0, 0, 0,
        [], [], health.mcDevOnline === true),

      buildNode("cc2", "Failover",        "10.0.2.3",   "M1 Mac mini (24GB)",         null,
        0, 0, 0, 24,
        0, 0, 0, 0, 0,
        [], [], false),
    ];
  },
});

type NodeData = {
  name: string; role: string; ip: string; hardware: string; battery: number | null;
  online: boolean; cpu: number; memory: number; memUsedGb: number; memTotalGb: number;
  gpu: number; neuralEngine: number; disk: number; diskUsedGb: number; diskTotalGb: number;
  mlxModels: string[]; ollamaModels: string[];
};

function buildNode(
  name: string, role: string, ip: string, hardware: string, battery: number | null,
  cpu: number, memory: number, memUsedGb: number, memTotalGb: number,
  gpu: number, neuralEngine: number, disk: number, diskUsedGb: number, diskTotalGb: number,
  mlxModels: string[], ollamaModels: string[], online: boolean,
): NodeData {
  return { name, role, ip, hardware, battery, online, cpu, memory, memUsedGb, memTotalGb, gpu, neuralEngine, disk, diskUsedGb, diskTotalGb, mlxModels, ollamaModels };
}

export const upsert = mutation({
  args: {
    ts:          v.number(),
    cpu:         v.number(),
    memUsedGb:   v.number(),
    memTotalGb:  v.number(),
    memPct:      v.number(),
    gpuDevice:   v.number(),
    gpuRenderer: v.number(),
    gpuTiler:    v.number(),
    diskUsedGb:  v.number(),
    diskTotalGb: v.number(),
    diskPct:     v.number(),
    ollamaModels: v.array(v.string()),
    memDevUsedGb:    v.optional(v.number()),
    memDevPct:       v.optional(v.number()),
    memDevTs:        v.optional(v.number()),
    memOllamaUsedGb: v.optional(v.number()),
    memOllamaPct:    v.optional(v.number()),
    memOllamaTs:     v.optional(v.number()),
    mcDevOnline:     v.optional(v.boolean()),
    mcOllamaOnline:  v.optional(v.boolean()),
    nodesJson:       v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("systemHealth")
      .withIndex("by_key", q => q.eq("key", "latest"))
      .first();

    // Append to history ring buffer (keep last 60 = 30 min at 30s intervals)
    const newSnap = {
      ts: args.ts, cpu: args.cpu,
      gpu: args.gpuDevice, mem: args.memPct, disk: args.diskPct,
    };
    let history: typeof newSnap[] = [];
    if (existing?.history) {
      try { history = JSON.parse(existing.history); } catch { history = []; }
    }
    history.push(newSnap);
    if (history.length > 60) history = history.slice(-60);

    const doc = { ...args, key: "latest", history: JSON.stringify(history), status: "ok", checkedAt: args.ts };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("systemHealth", doc);
    }
  },
});
