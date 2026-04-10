#!/usr/bin/env node
/**
 * R&D Council — Autonomous Business Intelligence System
 * 
 * Five AI models meet twice daily to review Claims.Coach,
 * debate growth strategies, and generate actionable memos.
 *
 * Run: node scripts/rd-council.mjs
 * Cron: 9am and 5pm PST daily
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

const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY    = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const GEMINI_KEY    = env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
const XAI_KEY       = env.XAI_API_KEY || process.env.XAI_API_KEY;
const CONVEX_URL    = "https://calm-warbler-536.convex.cloud";
const TELEGRAM_CHAT = "8733921180";

if (!ANTHROPIC_KEY || !OPENAI_KEY || !GEMINI_KEY || !XAI_KEY) {
  console.error("❌ Missing API keys");
  process.exit(1);
}

// ─── Council Members ───────────────────────────────────────────────
const council = {
  strategic: {
    name: "Strategic",
    model: "llama3.3:70b",  // LOCAL: complex reasoning
    specialty: "Long-term vision & 6+ month planning",
    provider: "ollama",
  },
  builder: {
    name: "Builder",
    model: "qwen2.5:14b",  // LOCAL: practical implementation
    specialty: "Implementation & technical feasibility",
    provider: "ollama",
  },
  innovator: {
    name: "Innovator",
    model: "llama3.3:70b",  // LOCAL: creative reasoning
    specialty: "Product ideas & next features",
    provider: "ollama",
  },
  market: {
    name: "Market",
    model: "grok-4-latest",  // CLOUD: needs web access for trends
    specialty: "Trends & competitive analysis",
    provider: "xai",
  },
  efficiency: {
    name: "Efficiency",
    model: "qwen2.5:14b",  // LOCAL: optimization analysis
    specialty: "Cost optimization & scalability",
    provider: "ollama",
  },
};

// ─── LLM Calls ────────────────────────────────────────────────────
async function callAnthropicModel(model, systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAIModel(model, systemPrompt, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGeminiModel(model, systemPrompt, userPrompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    }
  );
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callXAIModel(model, systemPrompt, userPrompt) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${XAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callOllamaModel(model, systemPrompt, userPrompt) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    // Use mDNS hostname for array-wide access (falls back to localhost if not found)
    const ollamaHost = process.env.OLLAMA_HOST || "http://mc-ollama.local:11434";
    const res = await fetch(`${ollamaHost}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const d = await res.json();
    return d.message?.content || "";
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`⏱️  Ollama timeout for ${model}, will fallback to cloud`);
    }
    throw err; // Signal caller to try cloud fallback
  }
}

async function callModel(member, systemPrompt, userPrompt) {
  console.log(`🤖 ${member.name} thinking... [${member.provider}:${member.model}]`);
  try {
    let response = "";
    
    if (member.provider === "ollama") {
      try {
        response = await callOllamaModel(member.model, systemPrompt, userPrompt);
      } catch (err) {
        // Fallback to cloud if Ollama times out
        console.log(`⚡ Fallback: ${member.name} using cloud model`);
        const fallback = {
          strategic: () => callAnthropicModel("claude-3-5-sonnet-20241022", systemPrompt, userPrompt),
          builder: () => callOpenAIModel("gpt-4-turbo", systemPrompt, userPrompt),
          innovator: () => callAnthropicModel("claude-3-5-sonnet-20241022", systemPrompt, userPrompt),
          efficiency: () => callAnthropicModel("claude-3-haiku-20240307", systemPrompt, userPrompt),
        };
        const key = Object.keys(council).find(k => council[k].name === member.name);
        if (fallback[key]) {
          response = await fallback[key]();
        } else {
          throw err;
        }
      }
    } else if (member.provider === "anthropic") {
      response = await callAnthropicModel(member.model, systemPrompt, userPrompt);
    } else if (member.provider === "openai") {
      response = await callOpenAIModel(member.model, systemPrompt, userPrompt);
    } else if (member.provider === "gemini") {
      response = await callGeminiModel(member.model, systemPrompt, userPrompt);
    } else if (member.provider === "xai") {
      response = await callXAIModel(member.model, systemPrompt, userPrompt);
    }
    
    console.log(`✅ ${member.name} response received (${response.length} chars)`);
    return response;
  } catch (err) {
    console.error(`❌ ${member.name} failed:`, err.message);
    return "";
  }
}

// ─── Main Council Meeting ──────────────────────────────────────────
async function runCouncil() {
  console.log("\n📊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   R&D COUNCIL MEETING — ${new Date().toLocaleString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Step 1: Fetch business context ────────────────────────────
  console.log("📂 Gathering business context...");
  let briefContext = { activeClaims: 0, hotCases: 0, pendingTasks: 0 };
  try {
    const briefPath = path.join(__dirname, "../.brief-context.json");
    if (fs.existsSync(briefPath)) {
      briefContext = JSON.parse(fs.readFileSync(briefPath, "utf8"));
    }
  } catch (e) {
    console.warn("⚠️  Could not load brief context");
  }

  const businessContext = `
CLAIMS.COACH BUSINESS STATE:
- Active claims: ${briefContext.activeClaims?.claimsInStages?.active || 0}
- Hot cases (urgent/stale): ${briefContext.claimsOverview?.hotCases?.length || 0}
- Pending tasks: ${briefContext.pendingTasks?.length || 0}
- Recent deployments: Check git log for last 24h changes
- R&D focus areas: 5 issues (Watson comp search, Angelina dupes, Capture routing, State guidelines, Drive folders)
  `;

  // ── Step 2: Rotate idea proposer ────────────────────────────
  const proposers = Object.keys(council);
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const ideaAuthor = proposers[dayOfYear % proposers.length];
  const ideaAuthorMember = council[ideaAuthor];

  console.log(`\n💡 ${ideaAuthorMember.name} proposes an idea...\n`);

  const ideaPrompt = `You are Claims.Coach's "${ideaAuthorMember.name}" strategic advisor.
Your specialty: ${ideaAuthorMember.specialty}

Business context:
${businessContext}

Generate ONE specific, actionable idea to grow Claims.Coach revenue in the next 30 days.
Format:
IDEA: [Title]
REASONING: [Why this matters]
EFFORT: [hours needed]
IMPACT: [Expected revenue or efficiency gain]
NEXT STEPS: [3 concrete first actions]`;

  const idea = await callModel(ideaAuthorMember, "", ideaPrompt);

  // ── Step 3: Debate round ──────────────────────────────────────
  console.log("\n🎯 Debate round...\n");

  const debatePrompt = `You are Claims.Coach's "${council[proposers[0]].name}" advisor.
Your specialty: ${council[proposers[0]].specialty}

The "${ideaAuthorMember.name}" just proposed this idea:
${idea}

EVALUATE THIS IDEA from YOUR perspective (${council[proposers[0]].specialty}):
- Pros from your viewpoint
- Cons or risks
- How to improve it
- Feasibility score (1-10)
- Resource requirements

Be concise (5-7 sentences). Focus on YOUR unique viewpoint.`;

  const debates = {};
  for (const memberKey of proposers) {
    const member = council[memberKey];
    const response = await callModel(member, "", debatePrompt);
    debates[memberKey] = response;
  }

  // ── Step 4: Generate memo ──────────────────────────────────────
  console.log("\n📋 Generating memo...\n");

  const memoPrompt = `You are synthesizing a memo from Claims.Coach's R&D Council meeting.

IDEA:
${idea}

DEBATE PERSPECTIVES:
${Object.entries(debates).map(([key, response]) => `${council[key].name}: ${response}`).join("\n\n")}

Write a PROFESSIONAL MEMO that:
1. Summarizes the idea in 2 sentences
2. Lists 3 key debate points from different council members
3. Gives a verdict: PURSUE / DEPRIORITIZE / ENHANCE
4. Lists specific next steps (assignable to CC or Johnny)
5. Estimates resource needs (hours, cost)
6. Suggests success metrics

Format for Telegram delivery (markdown-compatible, <500 chars).`;

  const memo = await callModel(council.strategic, "", memoPrompt);

  // ── Step 5: Log and deliver ────────────────────────────────────
  console.log("\n✅ MEMO GENERATED\n");
  console.log(memo);

  // Save to file for morning brief integration
  const outputPath = path.join(__dirname, "../.rd-council-latest.json");
  const output = {
    timestamp: new Date().toISOString(),
    ideaAuthor: ideaAuthorMember.name,
    idea: idea.slice(0, 300),
    memo: memo,
    debateParticipants: proposers.length,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📊 Memo saved → ${outputPath}`);

  // Deliver to Telegram
  try {
    const telegramMsg = `🤖 R&D Council Memo\n\n${memo}`;
    execSync(
      `openclaw message send --channel telegram --target 8733921180 --message "${telegramMsg.replace(/"/g, '\\"')}"`,
      { stdio: "pipe", shell: "/bin/bash" }
    );
    console.log("✅ Memo delivered to Telegram");
  } catch (err) {
    console.log("⚠️ Telegram delivery failed, memo saved locally");
  }

  return output;
}

// ─── Main ─────────────────────────────────────────────────────────
runCouncil().catch(err => {
  console.error("❌ R&D Council failed:", err);
  process.exit(1);
});
