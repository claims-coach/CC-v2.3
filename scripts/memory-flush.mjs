#!/usr/bin/env node
/**
 * Memory Flush — Active Cases
 * Queries Convex for open claims and writes a structured memory file
 * so CC is always primed on live cases at session start.
 *
 * Run manually:  node scripts/memory-flush.mjs
 * Called by:     ghl-sync.mjs (post-sync), daily cron at 6:50am PST
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const CONVEX_URL  = "https://calm-warbler-536.convex.cloud";
const MEMORY_DIR  = join(process.env.HOME, ".openclaw/workspace/memory");
const OUTPUT_FILE = join(MEMORY_DIR, "ACTIVE_CASES_LIVE.md");

// ── Convex query helper ──────────────────────────────────────────────────────
async function convexQuery(path, args = {}) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!res.ok) throw new Error(`Convex query failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.status !== "success") throw new Error(`Convex error: ${JSON.stringify(data)}`);
  return data.value;
}

// ── Priority sort ────────────────────────────────────────────────────────────
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
const STAGE_ORDER   = ["intake", "valuation", "report_draft", "review", "negotiation", "unassigned"];

function sortClaims(claims) {
  return claims.sort((a, b) => {
    const stageDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    if (stageDiff !== 0) return stageDiff;
    const priDiff = (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
    if (priDiff !== 0) return priDiff;
    return b.daysOpen - a.daysOpen; // oldest first within same stage+priority
  });
}

// ── Next action heuristics ───────────────────────────────────────────────────
function nextAction(claim) {
  switch (claim.stage) {
    case "intake":       return "Complete intake — gather estimate, VIN, insurer info";
    case "valuation":    return "Run valuation — pull comps, calculate ACV/DV gap";
    case "report_draft": return "Draft report — apply market-based methodology";
    case "review":       return "Review & approve report with Johnny";
    case "negotiation":  return "Track insurer response — follow up if >7 days";
    case "unassigned":   return "Assign to pipeline stage";
    default:             return "—";
  }
}

// ── Calculate real daysOpen from openedAt (GHL sync sets it to 0 at creation) ──
function calcDaysOpen(claim) {
  if (claim.openedAt && claim.openedAt > 0) {
    return Math.floor((Date.now() - claim.openedAt) / (1000 * 60 * 60 * 24));
  }
  return claim.daysOpen ?? 0;
}

// ── Sanity-check opening offer (GHL sometimes packs two fields together) ──────
function sanitizeOffer(n) {
  if (!n) return undefined;
  // Values over $2M for auto claims are almost certainly bad data
  if (n > 2_000_000) return undefined;
  return n;
}

// ── Format currency ──────────────────────────────────────────────────────────
function fmt$(n) {
  if (n === undefined || n === null) return "—";
  return "$" + Number(n).toLocaleString("en-US");
}

// ── Build markdown ───────────────────────────────────────────────────────────
function buildMarkdown(claims, generatedAt) {
  const active = claims.filter(c => !["settled", "closed"].includes(c.stage));
  const sorted = sortClaims(active);

  // Group by stage
  const byStage = {};
  for (const c of sorted) {
    if (!byStage[c.stage]) byStage[c.stage] = [];
    byStage[c.stage].push(c);
  }

  const stageLabels = {
    intake:       "📥 Intake",
    valuation:    "📊 Valuation",
    report_draft: "📄 Report Draft",
    review:       "👀 Review",
    negotiation:  "🤝 Negotiation",
    unassigned:   "❓ Unassigned",
  };

  // Enrich daysOpen and sanitize offers
  for (const c of sorted) {
    c.daysOpen      = calcDaysOpen(c);
    c.openingOffer  = sanitizeOffer(c.openingOffer);
  }

  // Hot cases = urgent or high priority, or >30 days open
  const hot = sorted.filter(c =>
    c.priority === "urgent" ||
    c.priority === "high" ||
    c.daysOpen > 30
  ).slice(0, 8);

  let md = `# ACTIVE_CASES_LIVE.md — Live Claims Tracker\n`;
  md += `\nLast updated: ${generatedAt}\n`;
  md += `Active: **${active.length}** open claims\n`;
  md += `\n---\n`;

  // Hot cases section
  if (hot.length > 0) {
    md += `\n## 🔥 Hot Cases (Urgent / High / Stale)\n\n`;
    md += `| Client | Type | Stage | Insurer | Days | Priority | Gap | Next Action |\n`;
    md += `|--------|------|-------|---------|------|----------|-----|-------------|\n`;
    for (const c of hot) {
      const vehicle = [c.year, c.make, c.model].filter(Boolean).join(" ") || "—";
      const gap = c.claimType === "DV"
        ? (c.targetValue && c.openingOffer ? fmt$(c.targetValue - c.openingOffer) : "—")
        : (c.targetValue && c.openingOffer ? fmt$(c.targetValue - c.openingOffer) : "—");
      md += `| **${c.clientName}** | ${c.claimType} | ${c.stage} | ${c.insurer || "—"} | ${c.daysOpen}d | ${c.priority} | ${gap} | ${nextAction(c)} |\n`;
    }
  }

  // By stage sections
  for (const stage of STAGE_ORDER) {
    const group = byStage[stage];
    if (!group || group.length === 0) continue;

    md += `\n## ${stageLabels[stage] || stage} (${group.length})\n\n`;
    md += `| Client | Vehicle | Type | Insurer | Days Open | Priority | Opening Offer | Target | Next Action |\n`;
    md += `|--------|---------|------|---------|-----------|----------|---------------|--------|-------------|\n`;

    for (const c of group) {
      const vehicle = [c.year, c.make, c.model].filter(Boolean).join(" ") || "—";
      md += `| ${c.clientName} | ${vehicle} | ${c.claimType} | ${c.insurer || "—"} | ${c.daysOpen}d | ${c.priority} | ${fmt$(c.openingOffer)} | ${fmt$(c.targetValue)} | ${nextAction(c)} |\n`;
    }
  }

  // Stage summary
  md += `\n---\n\n## Stage Summary\n\n`;
  for (const stage of STAGE_ORDER) {
    const group = byStage[stage];
    if (!group || group.length === 0) continue;
    const urgent = group.filter(c => c.priority === "urgent").length;
    const high   = group.filter(c => c.priority === "high").length;
    md += `- **${stageLabels[stage] || stage}**: ${group.length} cases`;
    if (urgent) md += ` · ${urgent} urgent`;
    if (high)   md += ` · ${high} high`;
    md += `\n`;
  }

  md += `\n---\n\n*Auto-generated by memory-flush.mjs — do not edit manually*\n`;
  md += `*Source: Convex ${CONVEX_URL}*\n`;

  return { md, activeCount: active.length, hotCount: hot.length };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔄 Memory flush — querying active claims...");

  let claims;
  try {
    claims = await convexQuery("claims:list", {});
  } catch (err) {
    console.error("❌ Convex query failed:", err.message);
    process.exit(1);
  }

  if (!Array.isArray(claims)) {
    console.error("❌ Unexpected response from Convex:", claims);
    process.exit(1);
  }

  const generatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const { md, activeCount, hotCount } = buildMarkdown(claims, generatedAt);

  // Write memory file
  mkdirSync(MEMORY_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, md, "utf8");

  console.log(`✅ Memory flush complete`);
  console.log(`   Active claims: ${activeCount}`);
  console.log(`   Hot cases: ${hotCount}`);
  console.log(`   Written to: ${OUTPUT_FILE}`);

  return { activeCount, hotCount };
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
