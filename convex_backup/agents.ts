import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({ handler: async (ctx) => ctx.db.query("agents").collect() });

export const seed = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("agents").collect();
    if (existing.length > 0) return;
    const now = Date.now();
    const defs = [
      { name: "CC", role: "Chief of Staff", type: "primary" as const, status: "active" as const, emoji: "🧠", pixelColor: "#5e6ad2", responsibilities: ["Orchestrate all sub-agents", "Direct client communication", "Strategic planning", "Morning briefs & reporting", "Memory & continuity management"], tasksCompleted: 0 },
      { name: "Jason", role: "Lead Developer", type: "primary" as const, status: "active" as const, emoji: "⚡", pixelColor: "#f59e0b", responsibilities: ["Mission Control app development", "Vercel deployments", "Architecture decisions", "Complex refactoring", "Production builds"], tasksCompleted: 0 },
      { name: "Watson", role: "Research Agent", type: "sub-agent" as const, status: "active" as const, emoji: "🔍", pixelColor: "#3b82f6", responsibilities: ["JD Power / KBB / Carfax valuations", "Find comparable vehicles in market", "ACV dispute research", "Market trend analysis", "Valuation consensus"], tasksCompleted: 0 },
      { name: "Analysis", role: "Estimate Parsing", type: "sub-agent" as const, status: "idle" as const, emoji: "📊", pixelColor: "#a78bfa", responsibilities: ["Parse repair estimates line by line", "Identify insurer discrepancies", "Flag hidden or missed damage", "Compare labor rates to market"], tasksCompleted: 0 },
      { name: "Report", role: "Report Generation", type: "sub-agent" as const, status: "idle" as const, emoji: "📄", pixelColor: "#22c55e", responsibilities: ["Generate DV reports with exhibits", "Build ACV dispute packages", "Format expert witness declarations", "Compile appraisal clause demand letters"], tasksCompleted: 0 },
      { name: "Chris", role: "Lead Negotiator", type: "sub-agent" as const, status: "idle" as const, emoji: "🤝", pixelColor: "#f59e0b", responsibilities: ["Draft demand letters (Voss-inspired)", "Counter-offer analysis", "Negotiation tactics & strategy", "Settlement optimization", "Insurer positioning"], tasksCompleted: 0 },
      { name: "Marketing", role: "SEO & Content", type: "sub-agent" as const, status: "working" as const, emoji: "📣", pixelColor: "#f97316", responsibilities: ["Research trending claim topics daily", "Write video scripts (TikTok/YouTube/IG)", "Generate SEO blog content", "Auto-post across all platforms"], tasksCompleted: 2, currentTask: "Researching trending insurance topics" },
      { name: "Database", role: "RAG & Learning", type: "sub-agent" as const, status: "idle" as const, emoji: "🗄️", pixelColor: "#ec4899", responsibilities: ["Index past reports for RAG retrieval", "Surface hints from similar past cases", "Client record management", "Pattern recognition across claims"], tasksCompleted: 0 },
      { name: "Gemini", role: "Document Analysis & Vision", type: "sub-agent" as const, status: "idle" as const, emoji: "🔮", pixelColor: "#10b981", responsibilities: ["OCR extraction from estimate PDFs", "Damage photo analysis", "Document classification", "Structured data parsing from images", "Consensus panel member"], tasksCompleted: 0 },
    ];
    for (const d of defs) await ctx.db.insert("agents", { ...d, createdAt: now });
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    type: v.union(v.literal("primary"), v.literal("sub-agent")),
    status: v.union(v.literal("active"), v.literal("idle"), v.literal("working"), v.literal("offline")),
    responsibilities: v.array(v.string()),
    emoji: v.string(),
    pixelColor: v.optional(v.string()),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("agents").collect();
    if (existing.find(a => a.name === args.name)) return null;
    return ctx.db.insert("agents", { ...args, tasksCompleted: 0, createdAt: Date.now() });
  },
});

export const updateStatus = mutation({
  args: { id: v.id("agents"), status: v.union(v.literal("active"), v.literal("idle"), v.literal("working"), v.literal("offline")), currentTask: v.optional(v.string()) },
  handler: async (ctx, args) => ctx.db.patch(args.id, { status: args.status, currentTask: args.currentTask }),
});

// Called by API routes — set agent working by name (no _id needed)
export const setWorking = mutation({
  args: { name: v.string(), task: v.string() },
  handler: async (ctx, { name, task }) => {
    const agent = await ctx.db.query("agents").filter(q => q.eq(q.field("name"), name)).first();
    if (agent) await ctx.db.patch(agent._id, { status: "working", currentTask: task });
    // Log to activity feed
    await ctx.db.insert("activity", {
      agentName: name,
      action: "started",
      details: task,
      type: "task",
      createdAt: Date.now(),
    });
  },
});

// Called by API routes — mark task done, increment counter
export const completeTask = mutation({
  args: { name: v.string(), result: v.optional(v.string()) },
  handler: async (ctx, { name, result }) => {
    const agent = await ctx.db.query("agents").filter(q => q.eq(q.field("name"), name)).first();
    if (agent) {
      await ctx.db.patch(agent._id, {
        status: "idle",
        currentTask: undefined,
        tasksCompleted: (agent.tasksCompleted || 0) + 1,
      });
    }
    if (result) {
      await ctx.db.insert("activity", {
        agentName: name,
        action: "completed",
        details: result,
        type: "task",
        createdAt: Date.now(),
      });
    }
  },
});

export const renameAgent = mutation({
  args: { id: v.id("agents"), name: v.string() },
  handler: async (ctx, { id, name }) => ctx.db.patch(id, { name }),
});

// Ensure Jason agent exists in seed
export const ensureJason = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("agents").filter(q => q.eq(q.field("name"), "Jason")).first();
    if (!existing) {
      await ctx.db.insert("agents", {
        name: "Jason",
        role: "Lead Developer",
        type: "sub-agent",
        status: "idle",
        emoji: "⚡",
        pixelColor: "#06b6d4",
        responsibilities: [
          "Build and maintain Mission Control (Next.js + Convex)",
          "Implement features assigned by CC",
          "Deploy to Vercel on task completion",
          "Write clean, production-ready TypeScript",
        ],
        tasksCompleted: 0,
        createdAt: Date.now(),
      });
    }
  },
});
