#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://calm-warbler-536.convex.cloud");

const todos = [
  // FACEBOOK & GOOGLE ADS (HIGHEST PRIORITY)
  {
    title: "Provide Facebook Ads API Key",
    description: "Access token + Ad Account ID needed to connect live Facebook Ads data to dashboard. Once provided, Jason can build live integration (2-3 days).",
    priority: "urgent",
    status: "todo",
    tags: ["ads", "api-integration", "facebook"],
    dueDate: "2026-03-30",
  },
  {
    title: "Provide Google Ads API Key",
    description: "Client ID + Client Secret + Refresh Token needed to connect live Google Ads data to dashboard. Once provided, Jason builds live integration (2-3 days).",
    priority: "urgent",
    status: "todo",
    tags: ["ads", "api-integration", "google"],
    dueDate: "2026-03-30",
  },

  // GOOGLE DRIVE & GEMINI (HIGH PRIORITY)
  {
    title: "Fix Google OAuth Refresh Token",
    description: "Refresh token expired (unauthorized_client). Need to run 'gogcli oauth' to get fresh token for Drive folder auto-creation. 10-minute fix.",
    priority: "high",
    status: "todo",
    tags: ["google-drive", "oauth", "blocking"],
    dueDate: "2026-03-31",
  },
  {
    title: "Send Brand Assets (Logo, Colors) for PDF Reports",
    description: "Johnny needs to send Claims.Coach brand assets (logo image file, brand colors) so we can embed them in ACV PDFs. Currently using generic placeholders.",
    priority: "high",
    status: "todo",
    tags: ["branding", "pdf-generation"],
    dueDate: "2026-04-02",
  },

  // TECHNICAL SETUP (HIGH PRIORITY)
  {
    title: "Complete TB5 Network Setup (mc-prod, cc2, mc-dev, mc-ollama)",
    description: "Network lockdown daemon installed. Next: run setup script on all 4 machines. Order: mc-prod (first, gateway), then cc2, mc-dev, mc-ollama. Script: tb5-exo-master-setup.sh",
    priority: "high",
    status: "todo",
    tags: ["tb5", "network", "infrastructure"],
    dueDate: "2026-03-31",
  },
  {
    title: "Verify PDF Report Generation End-to-End",
    description: "PDF redesign deployed but not visually tested. Need to generate a real ACV report and verify formatting (no black bars, proper brand assets, cover letter fills page).",
    priority: "high",
    status: "todo",
    tags: ["pdf", "quality-assurance"],
    dueDate: "2026-04-01",
  },

  // OPERATIONS WORKFLOW (HIGH PRIORITY — BLOCKING)
  {
    title: "Harden GHL→Google Drive→Mission Control Operations Workflow",
    description: "Complete audit shows critical gaps: calendar-sync NOT automated, no CCC evaluation pull, Drive folders not auto-created. Phase 1 (2-3h): Add calendar-sync to cron + build calendar-event-intake.mjs for auto-case-creation. Phase 2 (2-3h): CCC pull + upload. Phase 3 (4h): Real-time Drive sync. Currently when calls are booked (e.g., Quentin Orem) — case doesn't appear in workbench. Full audit: OPERATIONS_WORKFLOW_AUDIT.md",
    priority: "urgent",
    status: "todo",
    tags: ["operations", "workflow", "ghl", "drive", "automation", "blocking"],
    dueDate: "2026-04-04",
  },
  {
    title: "Phase 1: Automate Calendar→Case Creation (2-3 hours)",
    description: "Step 1: Add calendar-sync to cron (5 min). Step 2: Build calendar-event-intake.mjs to process unlinked calendar events. Step 3: Auto-create Drive folder (8-subfolder structure) + Convex claim when call booked. Result: Calendar booking → case in workbench automatically.",
    priority: "urgent",
    status: "todo",
    tags: ["operations", "calendar", "automation", "phase1"],
    dueDate: "2026-04-01",
  },
  {
    title: "Phase 2: Pull & Upload CCC Evaluation (2-3 hours)",
    description: "Step 1: Discover CCC location in GHL (custom field? email attachment?). Step 2: Build pull-ccc-from-ghl.mjs. Step 3: Build upload-ccc-to-drive.mjs. Step 4: Link CCC fileId to Convex claim. Result: CCC evaluation auto-appears in workbench when case created.",
    priority: "high",
    status: "todo",
    tags: ["operations", "ccc-evaluation", "automation", "phase2"],
    dueDate: "2026-04-02",
  },
  {
    title: "Phase 3: Real-Time Drive→Workbench Sync (4 hours)",
    description: "Step 1: Implement Drive folder watcher (polling or webhook). Step 2: Auto-analyze uploaded documents with Gemini (OCR, extraction). Step 3: Real-time workbench update. Result: New documents in Drive automatically sync to workbench within seconds.",
    priority: "medium",
    status: "todo",
    tags: ["operations", "drive-sync", "real-time", "phase3"],
    dueDate: "2026-04-05",
  },

  // FEATURE COMPLETION (MEDIUM PRIORITY)
  {
    title: "Wire Screenshot → Convex Storage → Bundle Pipeline in Workbench",
    description: "Screenshot capture button exists but not connected to Convex file storage. Need to wire capture → upload → storageId → include in PDF bundle.",
    priority: "high",
    status: "todo",
    tags: ["workbench", "screenshot-capture"],
    dueDate: "2026-04-02",
  },
  {
    title: "Build Capture Button Endpoint on Mac mini",
    description: "Capture button returns 503 (Vercel can't run Playwright). Need to build Express endpoint on Mac mini to handle screenshot + return URL. 30 min work.",
    priority: "medium",
    status: "todo",
    tags: ["mac-mini", "screenshot-capture"],
    dueDate: "2026-04-03",
  },
  {
    title: "Integrate Plaud Sync with Auto-Classification",
    description: "Plaud category system built (schema, mutations, UI tabs). Need to wire classify-recording API call into plaud-sync.mjs so new recordings auto-categorize.",
    priority: "medium",
    status: "todo",
    tags: ["plaud", "recordings", "classification"],
    dueDate: "2026-04-02",
  },
  {
    title: "Deploy LLM Dashboard (Claude, GPT-4, Gemini, Grok, Ollama Usage)",
    description: "LLM usage tracking code deployed to routes but dashboard not shown. Need to add component to System Health showing token usage by platform + costs.",
    priority: "low",
    status: "todo",
    tags: ["dashboard", "monitoring"],
    dueDate: "2026-04-05",
  },

  // TESTING & VALIDATION (MEDIUM PRIORITY)
  {
    title: "Test Gemini Notes Email Sync End-to-End",
    description: "Gemini Notes connected to cc@claims.coach and johnny@claims.coach. Need to test that new Gemini notes auto-ingest into GHL contacts + Drive.",
    priority: "medium",
    status: "todo",
    tags: ["gemini-notes", "email-sync", "testing"],
    dueDate: "2026-04-01",
  },
  {
    title: "Monitor Research Agent Cron at 6am (Tomorrow)",
    description: "research-agent cron job fixed. Run tomorrow morning at 6am PST to verify Telegram delivery works and research brief appears in Telegram chat.",
    priority: "medium",
    status: "todo",
    tags: ["cron", "research-agent", "monitoring"],
    dueDate: "2026-03-30",
  },

  // BUILD CONSENSUS PANEL (MEDIUM PRIORITY)
  {
    title: "Build /api/consensus-panel Endpoint",
    description: "Query Claude, Grok, Llama in parallel. Aggregate responses, score confidence, flag disagreements. Full architecture in AI_CONSENSUS_PANEL.md.",
    priority: "medium",
    status: "todo",
    tags: ["consensus-panel", "ai-orchestration"],
    dueDate: "2026-04-07",
  },
  {
    title: "Wire Consensus Panel into Claims Detail View",
    description: "Add Consensus Panel card to claims detail page showing all 3 model outputs, confidence %, disagreements. Auto-recommend when confidence >90%.",
    priority: "medium",
    status: "todo",
    tags: ["consensus-panel", "mission-control"],
    dueDate: "2026-04-10",
  },

  // NICE-TO-HAVE (LOW PRIORITY)
  {
    title: "Enhance Comp Research with Advanced Filtering",
    description: "Comp search needs: VIN extraction, trim matching, 150-mile radius, anchor comp detection. Currently basic matching only.",
    priority: "low",
    status: "todo",
    tags: ["comp-research", "valuation"],
    dueDate: "2026-04-14",
  },
  {
    title: "Set Up GoDaddy DNS A Record for app.claims.coach",
    description: "SSL cert issued but DNS not pointing to Vercel. Need to add A record or CNAME for app subdomain.",
    priority: "low",
    status: "todo",
    tags: ["dns", "infrastructure"],
    dueDate: "2026-04-05",
  },
  {
    title: "Rewire mc-dev to TB4 connection via TB5 cable",
    description: "Currently mc-dev (M4 MacBook Pro, 24GB) is connected via TB5 using basic Ethernet-over-TB5. Upgrade to TB4 connection for higher bandwidth (40Gbps vs 20Gbps). This will improve report generation parallelization and reduce PDF processing latency. Verify bandwidth improvement before/after with iperf benchmarks.",
    priority: "medium",
    status: "todo",
    tags: ["infrastructure", "tb5-network", "mc-dev", "bandwidth-upgrade"],
    dueDate: "2026-04-15",
  },
  {
    title: "Integrate Gstack (Garry Tan's Software Factory) into Claude Code workflow",
    description: "Add Gstack to claims-coach-mc project for structured AI-driven development. Setup: git clone gstack to .claude/skills/gstack, run ./setup, add gstack section to CLAUDE.md. Key skills: /office-hours (reframe features), /qa (test with real browser), /review (staff engineer audit), /ship (deploy verified code), /retro (weekly reflection). Use for: Consensus Panel endpoint, Ads dashboard features, claims pipeline improvements. Guarantees rigor at every step: think → plan → build → review → test → ship.",
    priority: "high",
    status: "todo",
    tags: ["claude-code", "development-workflow", "quality-assurance", "automation"],
    dueDate: "2026-04-08",
  },
];

async function addTodos() {
  console.log(`Adding ${todos.length} tasks to Mission Control...`);
  
  for (const todo of todos) {
    try {
      const taskId = await client.mutation("tasks:create", todo);
      console.log(`✅ Added: ${todo.title}`);
    } catch (error) {
      console.error(`❌ Failed to add "${todo.title}":`, error.message);
    }
  }
  
  console.log(`\n✅ Done! ${todos.length} tasks added to your Mission Control.`);
  console.log("\n📋 View them at: https://app.claims.coach/tasks");
}

addTodos().catch(console.error);
