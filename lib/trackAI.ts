/**
 * trackAI — log every AI call to Convex with model, tokens, estimated cost.
 * Fire-and-forget. Call AFTER getting a response so you have token counts.
 *
 * Cost estimates (per 1M tokens):
 *   claude-sonnet-4-6:       $3 in / $15 out
 *   claude-haiku-4-5-*:      $0.25 in / $1.25 out
 *   grok-4-0709:             $5 in / $15 out  (approximate)
 *   qwen2.5:14b (ollama):    $0 (local)
 *   llama3.2:3b (ollama):    $0 (local)
 */

const CONVEX_URL = "https://fabulous-roadrunner-674.convex.cloud";

// Cost per 1M tokens [input, output]
const MODEL_COST: Record<string, [number, number]> = {
  "claude-sonnet-4-6":          [3.00, 15.00],
  "claude-sonnet-4-5-20251015":  [3.00, 15.00],
  "claude-sonnet-4-5":           [3.00, 15.00],
  "claude-haiku-4-5-20251001":   [0.25,  1.25],
  "claude-haiku-4-5":            [0.25,  1.25],
  "grok-4-0709":                 [5.00, 15.00],
  "grok-4-latest":               [5.00, 15.00],
  "grok-3":                      [3.00,  9.00],
  // OpenAI
  "gpt-4-turbo":                 [10.00, 30.00],
  "gpt-4o":                      [5.00, 15.00],
  "gpt-3.5-turbo":               [0.50, 1.50],
  // Google Gemini
  "gemini-2.0-flash":            [0.075, 0.30],
  "gemini-1.5-pro":              [0.075, 0.30],
  "gemini-1.5-flash":            [0.075, 0.30],
  // Local models — $0
  "qwen2.5:14b":                 [0.00,  0.00],
  "llama3.3:70b":                [0.00,  0.00],
  "llama3.2:3b":                 [0.00,  0.00],
};

function providerOf(model: string): string {
  if (model.startsWith("claude"))  return "anthropic";
  if (model.startsWith("grok"))    return "xai";
  if (model.includes(":"))         return "ollama";  // ollama models have colon (qwen2.5:14b)
  if (model.startsWith("gpt"))     return "openai";
  if (model.startsWith("gemini"))  return "google";
  return "unknown";
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inRate, outRate] = MODEL_COST[model] ?? [1.00, 3.00]; // default to mid-tier
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}

interface TrackOptions {
  model: string;
  agentName: string;
  route: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  success?: boolean;
}

export async function trackAI(opts: TrackOptions): Promise<void> {
  const { model, agentName, route, inputTokens = 0, outputTokens = 0, durationMs, success = true } = opts;
  const provider   = providerOf(model);
  const estCostUsd = estimateCost(model, inputTokens, outputTokens);

  try {
    await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "aiUsage:log",
        args: {
          ts: Date.now(),
          provider, model, agentName, route,
          inputTokens:  inputTokens  || undefined,
          outputTokens: outputTokens || undefined,
          estCostUsd:   estCostUsd   || undefined,
          durationMs:   durationMs   || undefined,
          success,
        },
        format: "json",
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* non-blocking — never fail the caller */ }
}

/** Wrap a fetch to Anthropic and auto-track */
export async function claudeWithTracking(
  prompt: string,
  opts: { model: string; maxTokens?: number; agentName: string; route: string; apiKey: string }
): Promise<string> {
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await res.json();
  const text = d.content?.[0]?.text || "";
  trackAI({
    model: opts.model,
    agentName: opts.agentName,
    route: opts.route,
    inputTokens:  d.usage?.input_tokens,
    outputTokens: d.usage?.output_tokens,
    durationMs:   Date.now() - t0,
    success:      res.ok,
  });
  return text;
}

/** Wrap a fetch to xAI and auto-track */
export async function grokWithTracking(
  prompt: string,
  opts: { model?: string; maxTokens?: number; agentName: string; route: string; apiKey: string }
): Promise<string> {
  const model = opts.model || "grok-4-0709";
  const t0    = Date.now();
  const res   = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d    = await res.json();
  const text = d.choices?.[0]?.message?.content || "";
  trackAI({
    model,
    agentName: opts.agentName,
    route: opts.route,
    inputTokens:  d.usage?.prompt_tokens,
    outputTokens: d.usage?.completion_tokens,
    durationMs:   Date.now() - t0,
    success:      res.ok,
  });
  return text;
}

/** Wrap an Ollama call and auto-track */
export async function ollamaWithTracking(
  prompt: string,
  opts: { model?: string; agentName: string; route: string; baseUrl?: string }
): Promise<string> {
  const model   = opts.model || "qwen2.5:14b";
  // Use mDNS hostname for array-wide access (falls back to localhost if on same machine)
  const baseUrl = opts.baseUrl || process.env.OLLAMA_HOST || "http://mc-ollama.local:11434";
  const t0      = Date.now();
  try {
    const res  = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(120_000),
    });
    const d    = await res.json();
    const text = d.message?.content || "";
    trackAI({
      model,
      agentName: opts.agentName,
      route: opts.route,
      inputTokens:  d.prompt_eval_count,
      outputTokens: d.eval_count,
      durationMs:   Date.now() - t0,
      success:      true,
    });
    return text;
  } catch (err) {
    console.error("ollamaWithTracking error:", err);
    return "";
  }
}

/** Wrap an OpenAI call and auto-track */
export async function openaiWithTracking(
  prompt: string,
  opts: { model?: string; maxTokens?: number; agentName: string; route: string; apiKey: string }
): Promise<string> {
  const model = opts.model || "gpt-4-turbo";
  const t0    = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d    = await res.json();
    const text = d.choices?.[0]?.message?.content || "";
    trackAI({
      model,
      agentName: opts.agentName,
      route: opts.route,
      inputTokens:  d.usage?.prompt_tokens,
      outputTokens: d.usage?.completion_tokens,
      durationMs:   Date.now() - t0,
      success:      res.ok,
    });
    return text;
  } catch (err) {
    console.error("openaiWithTracking error:", err);
    return "";
  }
}

/** Wrap a Google Gemini call and auto-track */
export async function geminiWithTracking(
  prompt: string,
  opts: { model?: string; maxTokens?: number; agentName: string; route: string; apiKey: string }
): Promise<string> {
  const model = opts.model || "gemini-2.0-flash";
  const t0    = Date.now();
  try {
    console.log("[geminiWithTracking] Starting call to", model);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: opts.maxTokens ?? 2000 },
      }),
    });
    console.log("[geminiWithTracking] Response status:", res.status);
    const d = await res.json();
    console.log("[geminiWithTracking] Response data keys:", Object.keys(d).join(","));
    
    if (!res.ok) {
      console.error("[geminiWithTracking] API Error:", d.error?.message || JSON.stringify(d).substring(0, 200));
    }
    
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("[geminiWithTracking] Extracted text length:", text.length);
    
    trackAI({
      model,
      agentName: opts.agentName,
      route: opts.route,
      inputTokens:  d.usageMetadata?.promptTokenCount,
      outputTokens: d.usageMetadata?.candidatesTokenCount,
      durationMs:   Date.now() - t0,
      success:      res.ok && !!text,
    });
    return text;
  } catch (err) {
    console.error("[geminiWithTracking] Caught exception:", err instanceof Error ? err.message : String(err));
    return "";
  }
}
