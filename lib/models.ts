/**
 * lib/models.ts — Central Model Configuration
 * Single source of truth for all AI model routing.
 * Swap models here for the Mac Studio migration in May 2026.
 *
 * Mac Studio M3 Ultra (256GB) migration plan:
 *   - Replace SONNET → "ollama/llama3.1:405b-instruct-q4_K_M"
 *   - Replace HAIKU   → "ollama/llama3.3:70b"
 *   - Replace VISION  → "ollama/llama3.2-vision:11b"
 *   - GROK stays — needs live web search
 */

export const MODELS = {
  // ── Reasoning / drafting (complex tasks) ─────────────────────────────────
  SONNET: "claude-sonnet-4-6",

  // ── Fast / cheap (summarization, parsing, tagging) ────────────────────────
  HAIKU: "claude-haiku-4-5-20251001",

  // ── Vision (image analysis, document OCR) ────────────────────────────────
  VISION: "claude-sonnet-4-6",  // Haiku also supports vision; upgrade to sonnet for accuracy

  // ── Live web / comp research (needs real-time internet) ──────────────────
  GROK: "grok-4-0709",          // xAI — keep this one post-migration (live web search)

  // ── Google Gemini (cost optimization: $0.075/M input, $0.30/M output) ──────
  GEMINI_FLASH: "google/gemini-2.0-flash",  // Text content, blog writing, report sections (85% cheaper than Sonnet)
  GEMINI_VISION: "google/gemini-2.0-flash", // Image analysis & feedback

  // ── OpenAI (for comparison / fallback) ──────────────────────────────────
  GPT4: "openai/gpt-4-turbo",                // Complex reasoning (cost parity with Sonnet)
  GPT4O: "openai/gpt-4o",                    // Faster variant
  GPT35: "openai/gpt-3.5-turbo",             // Budget tier

  // ── Local (Ollama) ────────────────────────────────────────────────────────
  LOCAL_FAST:      "qwen2.5:14b",           // Mac mini — fast tasks ($0)
  LOCAL_REASONING: "llama3.3:70b",          // 70B reasoning model (now loaded!)
  LOCAL_EMBED:     "nomic-embed-text",      // Embeddings — always local
  // Mac Studio (May 2026):
  // LOCAL_LARGE:  "llama3.1:405b-instruct-q4_K_M"  // ~18 tok/sec, GPT-4 tier
  // LOCAL_FAST:   "llama3.3:70b"                    // ~70 tok/sec, Sonnet tier
  // LOCAL_VISION: "llama3.2-vision:11b"             // replaces VISION
} as const;

export type ModelKey = keyof typeof MODELS;

/**
 * Route a task to the right model.
 * Add new routes here as we build — never hardcode model strings in routes.
 */
export const MODEL_ROUTES: Record<string, string> = {
  // Claims analysis — GPT-4 for reliable reasoning
  "analyze-oa-response":    MODELS.GPT4,  // GPT-4 for negotiation analysis
  "find-comps":             MODELS.GROK,       // needs live web search
  "find-comps-fallback":    MODELS.HAIKU,
  "parse-evaluation":       MODELS.LOCAL_FAST,  // qwen2.5 — $0 instead of $0.80/M
  "parse-invoice":          MODELS.LOCAL_FAST,  // Local free parsing
  "case-context":           MODELS.LOCAL_FAST,  // Local free extraction

  // Report generation — GPT-4 (reliable for content)
  "generate-acv-report":    MODELS.SONNET,  // Keep Sonnet for complex logic
  "generate-report-text":   MODELS.GPT4,  // GPT-4 for narrative
  "draft-settlement-summary": MODELS.GPT4,  // GPT-4 for summaries

  // FEATURE 9 LLM ROUTES — all using llama3.3:70b
  "draft-demand-letter":           MODELS.LOCAL_REASONING,  // Feature 1
  "analyze-counter-offer":         MODELS.LOCAL_REASONING,  // Feature 2
  "recommend-settlement":          MODELS.LOCAL_REASONING,  // Feature 3
  "summarize-case":                MODELS.LOCAL_REASONING,  // Feature 4
  "preprocess-estimate":           MODELS.LOCAL_REASONING,  // Feature 6
  "classify-and-file-document":    MODELS.LOCAL_REASONING,  // Feature 7
  "analyze-competitor-settlement": MODELS.LOCAL_REASONING,  // Feature 9

  // Image analysis
  "analyze-vehicle-image":  MODELS.VISION,
  "feedback-design":        MODELS.GEMINI_VISION,  // Gemini for aesthetic feedback

  // Memory / embedding
  "embed":                  MODELS.LOCAL_EMBED,

  // Research
  "research-agent":         MODELS.GROK,
  "morning-brief":          MODELS.SONNET,    // CC's main session

  // Marketing — GPT-4 (reliable for content)
  "draft-social-post":      MODELS.GPT4,  // GPT-4 for social
  "draft-blog-post":        MODELS.GPT4,  // GPT-4 for blog
  "draft-email":            MODELS.GPT4,  // GPT-4 for email
  "draft-client-comms":     MODELS.GPT4,  // GPT-4 for comms
} as const;

export function getModel(route: string): string {
  return MODEL_ROUTES[route] ?? MODELS.HAIKU;
}

/** Cost per 1M tokens (input / output) in USD */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":          { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":  { input: 0.80,  output: 4.00  },
  "grok-4-0709":                { input: 3.00,  output: 15.00 },
  "google/gemini-2.0-flash":    { input: 0.075, output: 0.30  }, // 85% cheaper than Sonnet
  "openai/gpt-4-turbo":         { input: 10.00, output: 30.00 }, // 3.3x more expensive than Sonnet
  "openai/gpt-4o":              { input: 5.00,  output: 15.00 }, // Parity with Sonnet
  "openai/gpt-3.5-turbo":       { input: 0.50,  output: 1.50  }, // Budget tier
  // Local models — $0
  "qwen2.5:14b":        { input: 0, output: 0 },
  "llama3.3:70b":       { input: 0, output: 0 },
  "llama3.2:3b":        { input: 0, output: 0 },
  "nomic-embed-text":   { input: 0, output: 0 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
}
