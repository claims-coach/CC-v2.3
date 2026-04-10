#!/usr/bin/env node
/**
 * Research Agent — Claims.Coach
 * Powered by xAI Grok-4
 *
 * Scans for:
 * - OpenClaw updates, new skills, memory patterns
 * - AI automation trends for insurance/claims
 * - Suggestions for what to build next at Claims.Coach
 *
 * Run: node scripts/research-agent.mjs
 * Cron: scheduled via OpenClaw cron
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, "../.env.local");
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const [k, ...v] = line.split("=");
    if (k && v.length) env[k.trim()] = v.join("=").trim();
  });
}

const XAI_API_KEY   = env.XAI_API_KEY   || process.env.XAI_API_KEY;
const CONVEX_URL    = "https://calm-warbler-536.convex.cloud"; // PROD — always
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT  = "8733921180";

if (!XAI_API_KEY) { console.error("XAI_API_KEY not set"); process.exit(1); }

// ─── Grok API call ───────────────────────────────────────────────
async function askGrok(systemPrompt, userPrompt, model = "grok-4-latest") {
  const resp = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: userPrompt   },
      ],
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Grok API error: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Research prompts ────────────────────────────────────────────
const SYSTEM = `You are Watson, the Research Agent for Claims.Coach — a public adjusting and appraisal consulting firm in Everett, WA.

Claims.Coach specializes in:
- Auto diminished value (DV) reports
- ACV / Appraisal Clause disputes  
- Loss of use claims
- Expert witness services

We use OpenClaw as our AI agent platform. Our tech stack:
- Mission Control: Next.js + Convex dashboard (claims pipeline, case registry, valuation workbenches)
- Agent: Claude Sonnet as Chief of Staff (CC)
- Integrations: GHL CRM, Telegram, Vercel

Your job: find what's new, relevant, and actionable. Be specific. Skip generic AI hype.

CRITICAL ACCURACY RULES — these are non-negotiable:
1. OpenClaw updates: ONLY report confirmed, verifiable announcements from openclaw.ai, github.com/openclaw, or @openclaw on X. Do NOT speculate, infer, or fabricate features. If you cannot find a confirmed update with a real source URL, set openclaw_updates to an empty array []. A hallucinated OpenClaw release is worse than no release.
2. All items must have a real source URL or be explicitly marked "source: inferred from known capabilities" — never present speculation as confirmed fact.
3. Trends must be from real published sources (Insurance Journal, Claims Magazine, AI news outlets, LinkedIn) — not invented scenarios.

Format your response as JSON with keys: trends, openclaw_updates, suggestions, urgent_flag (bool), summary`;

async function runResearch() {
  console.log("🔍 Research Agent starting...");
  const today = new Date().toISOString().split("T")[0];

  // ── Research query 1: OpenClaw & AI agent trends ──────────────
  const trendsPrompt = `Today is ${today}.

Research and summarize:
1. VERIFIED OpenClaw updates only: search openclaw.ai, github.com/openclaw/openclaw/releases, and @openclaw on X for CONFIRMED releases in the past 7 days. If you find nothing verifiable, return an empty array for openclaw_updates — do NOT fabricate or infer releases.
2. Top 3 AI automation trends specifically relevant to insurance claims / public adjusting — cite real sources (Insurance Journal, Claims Magazine, LinkedIn, etc.)
3. Any new tools or techniques for: CRM automation, claims valuation AI, legal-tech automation, vehicle market data APIs
4. Any real GHL, Convex, Vercel, or Anthropic updates relevant to our stack

Return JSON matching this schema:
{
  "trends": [{ "title": "", "summary": "", "relevance": "high|medium|low", "source": "" }],
  "openclaw_updates": [{ "title": "", "summary": "", "action_needed": bool }],
  "suggestions": [{ "priority": 1, "title": "", "description": "", "effort": "small|medium|large" }],
  "urgent_flag": false,
  "summary": "2-3 sentence executive summary for Johnny Walker"
}`;

  let research;
  try {
    const raw = await askGrok(SYSTEM, trendsPrompt, "grok-4-latest");
    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    research = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Research parse error:", err.message);
    research = {
      trends: [],
      openclaw_updates: [],
      suggestions: [],
      urgent_flag: false,
      summary: "Research agent encountered an error. Will retry next cycle.",
      _error: err.message,
    };
  }

  // ── Save to file for morning brief ────────────────────────────
  const outputPath = path.join(__dirname, "../.research-latest.json");
  const output = {
    generatedAt: new Date().toISOString(),
    date: today,
    ...research,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log("✅ Research saved to .research-latest.json");

  // ── Format Telegram message ────────────────────────────────────
  const lines = [`🔍 *Research Brief — ${today}*`, "", research.summary, ""];

  if (research.openclaw_updates?.length > 0) {
    lines.push("*📦 OpenClaw Updates*");
    research.openclaw_updates.slice(0, 3).forEach(u => {
      lines.push(`• ${u.title}${u.action_needed ? " ⚡" : ""}: ${u.summary}`);
    });
    lines.push("");
  }

  if (research.trends?.length > 0) {
    lines.push("*📊 Top Trends*");
    research.trends.filter(t => t.relevance === "high").slice(0, 3).forEach(t => {
      lines.push(`• *${t.title}*: ${t.summary}`);
    });
    lines.push("");
  }

  if (research.suggestions?.length > 0) {
    lines.push("*💡 Build Suggestions*");
    research.suggestions.sort((a,b) => a.priority - b.priority).slice(0, 3).forEach(s => {
      const effort = s.effort === "small" ? "⚡" : s.effort === "medium" ? "🔧" : "🏗️";
      lines.push(`${effort} *${s.title}*: ${s.description}`);
    });
  }

  const message = lines.join("\n");
  console.log("\n--- TELEGRAM MESSAGE ---");
  console.log(message);
  console.log("--- END ---\n");

  // ── Urgent interrupt: ping Telegram immediately if flagged ────
  if (research.urgent_flag) {
    const urgentLines = [
      `🚨 *URGENT — Research Alert*`,
      ``,
      research.summary,
      ``,
    ];
    if (research.openclaw_updates?.some(u => u.action_needed)) {
      urgentLines.push(`*Action needed:*`);
      research.openclaw_updates.filter(u => u.action_needed).forEach(u => {
        urgentLines.push(`• ${u.title}: ${u.summary}`);
      });
    }
    const urgentMsg = urgentLines.join("\n");
    try {
      execSync(
        `openclaw message send --channel telegram --target 8733921180 --message "${urgentMsg.replace(/"/g, '\\"')}"`,
        { stdio: "pipe", shell: "/bin/bash" }
      );
      console.log("🚨 Urgent alert sent to Telegram");
    } catch (err) {
      // fallback: write to a flag file that morning brief will pick up
      fs.writeFileSync(path.join(__dirname, "../.research-urgent.txt"), urgentMsg);
      console.log("⚠️ Urgent Telegram send failed, wrote to .research-urgent.txt:", err.message);
    }
  } else {
    console.log("ℹ️  No urgent items — findings queued for morning brief");
  }

  // ── Return summary for morning brief ─────────────────────────
  return output;
}

runResearch().then(result => {
  console.log(`\n✅ Research complete. Urgent: ${result.urgent_flag}`);
  if (result.suggestions?.length > 0) {
    console.log(`\nTop suggestion: ${result.suggestions[0]?.title}`);
  }
}).catch(err => {
  console.error("Research agent failed:", err);
  process.exit(1);
});
