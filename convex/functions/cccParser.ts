// ============================================================
// functions/cccParser.ts — CCC One PDF extraction pipeline
//
// Two-stage extraction:
//   1. Cloud Function (pdfplumber regex) — fast, deterministic
//   2. MLX/Ollama fallback on M4 Mini — LLM-based, handles messy PDFs
//
// ENV VARS:
//   CCC_PARSER_URL        — Cloud Function URL (e.g. https://us-central1-xxx.cloudfunctions.net/parse-ccc-pdf)
//   MLX_ENDPOINT           — M4 Mini inference endpoint (e.g. http://mc-prod.local:8080/v1/chat/completions)
//   MLX_MODEL              — Model name for MLX (e.g. mlx-community/Qwen2.5-7B-Instruct-4bit)
//   OLLAMA_ENDPOINT        — Fallback Ollama endpoint (e.g. http://mc-ollama.local:11434/api/chat)
//   OLLAMA_MODEL           — Ollama model name
// ============================================================

import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ============================================================
// EXTRACTION SCHEMA (mirrors Python Cloud Function output)
// ============================================================
interface CccExtraction {
  success: boolean;
  method: string | null;
  error: string | null;
  vehicle: {
    year: string | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    vin: string | null;
    mileage: number | null;
    condition: string | null;
    color: string | null;
  };
  valuation: {
    baseValue: number | null;
    adjustments: Array<{ label: string; amount: number }>;
    projectedSoldAdjustment: number | null;
    totalAcv: number | null;
    effectiveDate: string | null;
    marketArea: string | null;
  };
  comparables: Array<{
    compNumber: number;
    vin: string | null;
    year: string | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    mileage: number | null;
    askingPrice: number | null;
    adjustedValue: number | null;
    location: string | null;
  }>;
  conditionNotes: string[];
  rawText: string | null;
}

// ============================================================
// LLM EXTRACTION PROMPT
// ============================================================
const LLM_SYSTEM_PROMPT = `You are a CCC One valuation PDF data extractor. You receive raw text from a CCC One total loss valuation report.

Extract the following into a JSON object with EXACTLY this structure. If a field cannot be found, use null. Never fabricate values.

{
  "vehicle": {
    "year": "string or null",
    "make": "string or null",
    "model": "string or null",
    "trim": "string or null",
    "vin": "17-character VIN or null",
    "mileage": "integer or null",
    "condition": "string or null",
    "color": "string or null"
  },
  "valuation": {
    "baseValue": "number or null — the unadjusted base value",
    "adjustments": [{"label": "string", "amount": "number"}],
    "projectedSoldAdjustment": "number or null",
    "totalAcv": "number or null — the final ACV/total value opinion",
    "effectiveDate": "date string or null",
    "marketArea": "string or null"
  },
  "comparables": [
    {
      "compNumber": "integer",
      "vin": "17-char VIN or null",
      "year": "string or null",
      "make": "string or null",
      "model": "string or null",
      "trim": "string or null",
      "mileage": "integer or null",
      "askingPrice": "number or null",
      "adjustedValue": "number or null",
      "location": "string or null"
    }
  ],
  "conditionNotes": ["strings — any notes about vehicle condition, prior damage, etc."]
}

RULES:
- Return ONLY valid JSON. No markdown fences. No explanations.
- VINs must be exactly 17 characters if present. If partial or unclear, use null.
- Dollar amounts must be numbers (no $ sign, no commas in JSON).
- Never guess or fabricate. If you can't find it, use null.`;

// ============================================================
// STAGE 1: CLOUD FUNCTION (pdfplumber)
// ============================================================
async function tryCloudFunction(base64Pdf: string): Promise<CccExtraction | null> {
  const url = process.env.CCC_PARSER_URL;
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Pdf }),
    });

    if (!res.ok) {
      console.error(`Cloud Function returned ${res.status}: ${await res.text()}`);
      return null;
    }

    const data: CccExtraction = await res.json();

    // Only accept if it got the critical fields
    if (data.success && data.valuation?.totalAcv != null) {
      return data;
    }

    // Partial — return for potential merge but don't count as success
    return data;
  } catch (err: any) {
    console.error(`Cloud Function error: ${err.message}`);
    return null;
  }
}

// ============================================================
// STAGE 2: MLX ENDPOINT (M4 Mini)
// ============================================================
async function tryMlxExtraction(rawText: string): Promise<CccExtraction | null> {
  const endpoint = process.env.MLX_ENDPOINT;
  const model = process.env.MLX_MODEL;

  if (!endpoint) return null;

  try {
    // Truncate to ~6000 chars to fit context window
    const truncated = rawText.slice(0, 6000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "mlx-community/Qwen2.5-7B-Instruct-4bit",
        messages: [
          { role: "system", content: LLM_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract all data from this CCC One valuation PDF text:\n\n${truncated}`,
          },
        ],
        temperature: 0.0,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      console.error(`MLX endpoint returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const parsed = parseJsonFromLlm(content);
    if (!parsed) return null;

    return {
      success: parsed.valuation?.totalAcv != null,
      method: "mlx_llm",
      error: parsed.valuation?.totalAcv == null ? "LLM extraction incomplete" : null,
      vehicle: parsed.vehicle || {},
      valuation: parsed.valuation || {},
      comparables: parsed.comparables || [],
      conditionNotes: parsed.conditionNotes || [],
      rawText: truncated,
    } as CccExtraction;
  } catch (err: any) {
    console.error(`MLX extraction error: ${err.message}`);
    return null;
  }
}

// ============================================================
// STAGE 2b: OLLAMA FALLBACK (mc-ollama node)
// ============================================================
async function tryOllamaExtraction(rawText: string): Promise<CccExtraction | null> {
  const endpoint = process.env.OLLAMA_ENDPOINT;
  const model = process.env.OLLAMA_MODEL;

  if (!endpoint) return null;

  try {
    const truncated = rawText.slice(0, 6000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "qwen3:8b",
        messages: [
          { role: "system", content: LLM_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Extract all data from this CCC One valuation PDF text:\n\n${truncated}`,
          },
        ],
        stream: false,
        options: { temperature: 0.0 },
      }),
    });

    if (!res.ok) {
      console.error(`Ollama returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data.message?.content || "";

    const parsed = parseJsonFromLlm(content);
    if (!parsed) return null;

    return {
      success: parsed.valuation?.totalAcv != null,
      method: "ollama_llm",
      error: parsed.valuation?.totalAcv == null ? "LLM extraction incomplete" : null,
      vehicle: parsed.vehicle || {},
      valuation: parsed.valuation || {},
      comparables: parsed.comparables || [],
      conditionNotes: parsed.conditionNotes || [],
      rawText: truncated,
    } as CccExtraction;
  } catch (err: any) {
    console.error(`Ollama extraction error: ${err.message}`);
    return null;
  }
}

// ============================================================
// JSON PARSE HELPER
// ============================================================
function parseJsonFromLlm(content: string): any {
  // Strip markdown fences if present
  let cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse LLM JSON output");
    return null;
  }
}

// ============================================================
// MERGE: combine partial results from multiple methods
// ============================================================
function mergeExtractions(primary: CccExtraction, fallback: CccExtraction): CccExtraction {
  const merged = JSON.parse(JSON.stringify(primary)) as CccExtraction;

  // Fill nulls from fallback
  for (const key of Object.keys(merged.vehicle) as Array<keyof CccExtraction["vehicle"]>) {
    if (merged.vehicle[key] == null && fallback.vehicle[key] != null) {
      (merged.vehicle as any)[key] = fallback.vehicle[key];
    }
  }

  for (const key of Object.keys(merged.valuation) as Array<keyof CccExtraction["valuation"]>) {
    if (key === "adjustments") continue;
    if (merged.valuation[key] == null && fallback.valuation[key] != null) {
      (merged.valuation as any)[key] = fallback.valuation[key];
    }
  }

  // Merge adjustments if primary has none
  if (merged.valuation.adjustments.length === 0 && fallback.valuation.adjustments.length > 0) {
    merged.valuation.adjustments = fallback.valuation.adjustments;
  }

  // Merge comps if primary has none/fewer
  if (merged.comparables.length < fallback.comparables.length) {
    merged.comparables = fallback.comparables;
  }

  // Merge condition notes
  const noteSet = new Set([...merged.conditionNotes, ...fallback.conditionNotes]);
  merged.conditionNotes = [...noteSet];

  merged.success = merged.valuation.totalAcv != null;
  merged.method = `${primary.method}+${fallback.method}`;

  return merged;
}

// ============================================================
// MAIN EXTRACTION ACTION
// ============================================================
export const extractCccPdf = internalAction({
  args: {
    prospectId: v.string(),
    base64Pdf: v.string(),
  },
  handler: async (ctx, { prospectId, base64Pdf }): Promise<CccExtraction> => {
    // ---- Stage 1: Cloud Function ----
    let result = await tryCloudFunction(base64Pdf);

    if (result?.success) {
      // Full success from pdfplumber — save and return
      await ctx.runMutation(internal.functions.cccParser.saveCccExtraction, {
        prospectId,
        extraction: JSON.stringify(result),
      });
      return result;
    }

    // ---- Stage 2: LLM fallback ----
    // Use raw text from partial result, or decode PDF for text
    const rawText = result?.rawText || "[base64 PDF — text extraction failed]";

    let llmResult = await tryMlxExtraction(rawText);
    if (!llmResult) {
      llmResult = await tryOllamaExtraction(rawText);
    }

    if (llmResult) {
      // Merge if we have partial pdfplumber results
      const final = result ? mergeExtractions(result, llmResult) : llmResult;

      await ctx.runMutation(internal.functions.cccParser.saveCccExtraction, {
        prospectId,
        extraction: JSON.stringify(final),
      });
      return final;
    }

    // ---- Both stages failed ----
    const failure: CccExtraction = result || {
      ...JSON.parse(JSON.stringify(EMPTY_EXTRACTION)),
      error: "All extraction methods failed. Manual extraction required.",
      method: "none",
    };

    await ctx.runMutation(internal.functions.cccParser.saveCccExtraction, {
      prospectId,
      extraction: JSON.stringify(failure),
    });

    return failure;
  },
});

// ============================================================
// SAVE EXTRACTION TO PROSPECT RECORD
// ============================================================
export const saveCccExtraction = internalMutation({
  args: {
    prospectId: v.string(),
    extraction: v.string(), // JSON string
  },
  handler: async (ctx, { prospectId, extraction }) => {
    const prospect = await ctx.db
      .query("prospects")
      .withIndex("by_prospectId", (q) => q.eq("prospectId", prospectId))
      .unique();

    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    const parsed = JSON.parse(extraction);
    const now = Date.now();

    const patches: Record<string, any> = {
      cccPdfParsed: parsed.success === true,
      cccExtractJsonPath: extraction,  // Store inline for now; move to GDrive via job later
      revision: prospect.revision + 1,
      updatedAt: now,
      updatedBy: "CC",
      updateSource: `CccParser:${parsed.method}`,
    };

    // If we got insurer ACV and prospect doesn't have one yet, populate it
    if (parsed.valuation?.totalAcv != null && !prospect.insurerAcvOffer) {
      patches.insurerAcvOffer = parsed.valuation.totalAcv;
    }

    await ctx.db.patch(prospect._id, patches);

    // Activity log
    const compCount = parsed.comparables?.length || 0;
    await ctx.db.insert("activityLog", {
      entityType: "prospect",
      entityId: prospectId,
      date: new Date(now).toISOString().slice(0, 10),
      action: parsed.success ? "CCC PDF parsed successfully" : "CCC PDF parse incomplete",
      party: "CC",
      summary: parsed.success
        ? `Extracted via ${parsed.method}. Insurer ACV: $${parsed.valuation.totalAcv?.toLocaleString() ?? "N/A"}. ${compCount} CCC comps found. VIN: ${parsed.vehicle.vin || "not found"}.`
        : `Extraction ${parsed.method || "failed"}: ${parsed.error}. Manual review needed.`,
      visibleToOperator: true,
      createdAt: now,
    });

    // Register document
    await ctx.db.insert("documents", {
      entityType: "prospect",
      entityId: prospectId,
      documentType: "CCC_EXTRACT_JSON",
      fileName: `CCC_Extract_${prospectId}.json`,
      storagePath: `inline:${prospectId}`,  // Inline storage; will be synced to GDrive
      mimeType: "application/json",
      source: parsed.method || "unknown",
      createdAt: now,
    });

    // Workflow event
    await ctx.db.insert("workflowEvents", {
      eventType: parsed.success ? "ccc.parseSucceeded" : "ccc.parseFailed",
      entityType: "prospect",
      entityId: prospectId,
      payloadJson: JSON.stringify({
        method: parsed.method,
        totalAcv: parsed.valuation?.totalAcv,
        vin: parsed.vehicle?.vin,
        compCount,
        error: parsed.error,
      }),
      createdAt: now,
    });
  },
});
