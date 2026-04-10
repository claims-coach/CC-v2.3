#!/usr/bin/env node
/**
 * morning-brief-data.mjs
 * Fetches live case data from Convex PROD and writes a structured brief context file
 * to ~/claims-coach-mc/.brief-context.json for use by the morning-brief cron.
 * Run: node scripts/morning-brief-data.mjs
 */

import { readFileSync, writeFileSync } from "fs";

const CONVEX_URL = "https://calm-warbler-536.convex.cloud";

async function query(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const d = await res.json();
  return d.value;
}

function daysAgo(ms) {
  return Math.floor((Date.now() - ms) / 86400000);
}

async function main() {
  console.log("📊 Fetching live case data...");

  const [claims, tasks, activity, negTasks, recordings] = await Promise.all([
    query("claims:list", {}),
    query("tasks:list", {}),
    query("activity:list", { limit: 20 }),
    query("negotiationTasks:list", {}),
    query("recordings:list", { limit: 100 }), // Get last 100 to count Gemini Notes from past 24h
  ]);

  const allClaims = claims ?? [];
  const activeClaims = allClaims.filter(c => !["settled","closed","cancelled"].includes(c.status));

  // Hot cases — urgent, high priority, or stale >14 days
  const hot = activeClaims.filter(c =>
    c.priority === "urgent" ||
    c.priority === "high" ||
    (c.daysOpen != null && c.daysOpen > 14)
  ).sort((a, b) => {
    const p = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
  }).slice(0, 5);

  // Gemini Notes from past 24h
  const now = Date.now();
  const oneDayMs = 86400000;
  const geminiNotes = (recordings ?? []).filter(r =>
    r.source === "gemini" && (now - (r.createdAt ?? 0)) < oneDayMs
  );

  // Stage breakdown
  const byStage = {};
  for (const c of activeClaims) {
    const s = c.stage || "Unknown";
    byStage[s] = (byStage[s] || 0) + 1;
  }

  // Pending tasks
  const pendingTasks = (tasks ?? []).filter(t => t.status !== "done").slice(0, 5);

  // Open negotiations
  const openNegs = (negTasks ?? []).filter(t => t.status === "pending_review").slice(0, 3);

  // Recent activity
  const recentActivity = (activity ?? []).slice(0, 8);

  const context = {
    generatedAt: new Date().toISOString(),
    pipeline: {
      total: activeClaims.length,
      byStage,
      hotCases: hot.map(c => ({
        name: c.clientName,
        vehicle: [c.year, c.make, c.model].filter(Boolean).join(" "),
        stage: c.stage,
        priority: c.priority,
        daysOpen: c.daysOpen,
        insurer: c.insurer,
        openingOffer: c.openingOffer,
        nextAction: c.nextAction,
      })),
    },
    pendingTasks: pendingTasks.map(t => ({ title: t.title, priority: t.priority, due: t.dueDate })),
    openNegotiations: openNegs.map(n => ({
      clientName: n.clientName,
      oaACV: n.oaACV,
      gap: n.gap,
      status: n.status,
    })),
    recentActivity: recentActivity.map(a => ({
      agent: a.agentName,
      action: a.action,
      details: a.details?.slice(0, 80),
    })),
    geminiNotesSummary: {
      count: geminiNotes.length,
      message: geminiNotes.length > 0 
        ? `${geminiNotes.length} Gemini Notes ingested in past 24h`
        : "No new Gemini Notes"
    },
  };

  const outPath = `${process.env.HOME}/claims-coach-mc/.brief-context.json`;
  writeFileSync(outPath, JSON.stringify(context, null, 2));
  console.log(`✅ Brief context written → ${outPath}`);
  console.log(`   ${activeClaims.length} active claims | ${hot.length} hot | ${pendingTasks.length} pending tasks`);
}

main().catch(e => { console.error(e); process.exit(1); });
