import { mutation } from "./_generated/server";

const SEED_MEMORIES = [
  {
    title: "Mission Control Launched",
    content: "Claims.Coach Mission Control went live on March 5, 2026. Built on Next.js 16 + Convex + Tailwind v4. 8 screens: Task Board, Calendar, Memory, Projects, Documents, Team, Office, Activity Feed. LaunchAgent configured for auto-start on port 3000.",
    type: "decision" as const,
    tags: ["infrastructure", "mission-control", "launch"],
    source: "system",
    sourceId: "seed:launch-2026-03-05",
    recordedAt: new Date("2026-03-05T17:22:00-08:00").getTime(),
  },
  {
    title: "CC Agent Team Initialized",
    content: "Deployed 7-agent team: CC (Chief of Staff), Research (valuations/comps), Analysis (estimate parsing), Report (DV/ACV PDF generation), Negotiation (demand letters), Marketing (SEO/social), Database (RAG indexing). All agents seeded in Convex with roles and responsibilities.",
    type: "decision" as const,
    tags: ["agents", "team", "infrastructure"],
    source: "system",
    sourceId: "seed:agents-2026-03-05",
    recordedAt: new Date("2026-03-05T17:30:00-08:00").getTime(),
  },
  {
    title: "Morning Brief Cron — 7am PST Daily",
    content: "Configured daily 7am PST Telegram brief via @ClaimsCC_bot to Johnny (chat ID 8733921180). Cron ID: 51ec2486-4dd6-4302-ad9a-43bc4746f39c. Also set content research cron at 8am PST (d83cd1ad). Both added to Convex calendar.",
    type: "decision" as const,
    tags: ["cron", "telegram", "automation"],
    source: "system",
    sourceId: "seed:cron-2026-03-05",
    recordedAt: new Date("2026-03-05T18:00:00-08:00").getTime(),
  },
  {
    title: "Tech Stack Decisions",
    content: "Claims.Coach tech decisions locked in: (1) Next.js 16 + Convex for Mission Control — real-time, no polling. (2) Tailwind v4: use @import 'tailwindcss', not @tailwind directives. Dark mode via @custom-variant. (3) Claude (Anthropic) only — OpenAI not configured. (4) Inline style props as fallback for Tailwind JIT purge issues.",
    type: "lesson" as const,
    tags: ["tech", "tailwind", "convex", "nextjs"],
    source: "system",
    sourceId: "seed:tech-stack-2026-03-05",
    recordedAt: new Date("2026-03-05T19:00:00-08:00").getTime(),
  },
  {
    title: "Claims Pipeline — Active Claims Screen",
    content: "Built active claims pipeline screen with 7 stages: Intake → Valuation → Report Draft → Review → Negotiation → Settled → Closed. Convex claims table with full schema: VIN, insurer, adjuster, financials (offer/target/settlement), documents, timeline. Kanban-style drag with stage transitions.",
    type: "decision" as const,
    tags: ["claims", "pipeline", "ui"],
    source: "system",
    sourceId: "seed:claims-pipeline-2026-03-05",
    recordedAt: new Date("2026-03-05T19:30:00-08:00").getTime(),
  },
  {
    title: "Integrations Roadmap",
    content: "Priority integrations to build: (1) GHL (GoHighLevel) — CRM, calendar, pipeline. (2) Plaud — voice recordings → structured claim data. (3) JD Power / KBB / Carfax — vehicle valuations. (4) Past reports (thousands of PDFs) → RAG database. (5) TikTok/IG/YouTube/FB auto-posting. None connected yet as of March 2026.",
    type: "decision" as const,
    tags: ["integrations", "roadmap", "ghl", "plaud", "kbb"],
    source: "system",
    sourceId: "seed:roadmap-2026-03-05",
    recordedAt: new Date("2026-03-05T20:00:00-08:00").getTime(),
  },
];

export const seedMemories = mutation({
  handler: async (ctx) => {
    let added = 0;
    for (const mem of SEED_MEMORIES) {
      const existing = await ctx.db.query("memories")
        .filter(q => q.eq(q.field("sourceId"), mem.sourceId))
        .first();
      if (!existing) {
        const now = mem.recordedAt || Date.now();
        await ctx.db.insert("memories", { ...mem, createdAt: now, updatedAt: now });
        added++;
      }
    }
    return { added, total: SEED_MEMORIES.length };
  },
});
