/**
 * Comp Consensus Validator
 * Validates each comparable through Grok + Mistral for confidence scoring
 */

interface CompData {
  description: string;
  askingPrice: number;
  compMileage: number;
  source: string;
  url: string;
  vin?: string;
  title?: string;
}

interface ValidatedComp extends CompData {
  consensusScore: number; // 0-100
  grokApproval: boolean;
  mistralApproval: boolean;
  reasoning: string;
  issues: string[];
}

/**
 * Validate a single comp through Grok
 */
export async function validateCompWithGrok(
  comp: CompData,
  subjectVehicle: string,
  subjectTrim: string,
  subjectMileage: number,
  targetPrice: number | null
): Promise<{
  approved: boolean;
  confidence: number;
  reasoning: string;
  issues: string[];
}> {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    return { approved: true, confidence: 50, reasoning: "Grok unavailable", issues: [] };
  }

  const prompt = `You are a vehicle valuation expert validating a comparable vehicle for an insurance claim dispute.

SUBJECT VEHICLE: ${subjectVehicle} (${subjectTrim} trim, ${subjectMileage.toLocaleString()} miles)
TARGET PRICE: $${targetPrice ? targetPrice.toLocaleString() : "N/A"}

COMPARABLE BEING VALIDATED:
- Description: ${comp.description}
- Asking Price: $${comp.askingPrice.toLocaleString()}
- Mileage: ${comp.compMileage.toLocaleString()}
- VIN: ${comp.vin || "NOT PROVIDED"}
- Source: ${comp.source}
- URL: ${comp.url}
- Title: ${comp.title || "N/A"}

VALIDATION CHECKLIST:
1. Is this comp the EXACT same year, make, model, trim as the subject vehicle? (Allow ±1 trim level)
2. Is the mileage within 50,000 miles of the subject?
3. Is the asking price realistic for this vehicle in this condition?
4. Does the URL appear to be a real, active listing?
5. Is the VIN present and valid (if available)?

CRITICAL RULES:
- REJECT if different trim (e.g., subject is EX but comp is DX or Si — these are NOT comparable)
- REJECT if price is suspiciously low (likely damaged or fraud)
- REJECT if URL is broken or listing appears inactive
- REJECT if mileage differs by more than 50,000 miles from subject

Respond ONLY with JSON:
{
  "approved": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation of approval/rejection",
  "issues": ["issue1", "issue2"] or []
}`;

  try {
    const res = await fetch("https://api.x.ai/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      return { approved: true, confidence: 40, reasoning: "Grok error", issues: ["API error"] };
    }

    const data = (await res.json()) as any;
    const responseText = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(responseText);

    return {
      approved: parsed.approved !== false,
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning || "No reasoning provided",
      issues: parsed.issues || [],
    };
  } catch (e) {
    return { approved: true, confidence: 30, reasoning: "Parse error", issues: [(e as Error).message] };
  }
}

/**
 * Validate a comp through Mistral (fast consensus check)
 */
export async function validateCompWithMistral(
  comp: CompData,
  subjectVehicle: string,
  grokApproved: boolean
): Promise<{
  approved: boolean;
  confidence: number;
}> {
  // For now, use simple validation rules
  // In production, this would call Mistral via Ollama
  const issues: string[] = [];

  // Check price reasonableness
  if (comp.askingPrice < 2000) issues.push("Price suspiciously low");
  if (comp.askingPrice > 100000) issues.push("Price suspiciously high");

  // Check mileage
  if (comp.compMileage < 0 || comp.compMileage > 300000) issues.push("Mileage unrealistic");

  // Check URL format
  if (!comp.url.startsWith("http")) issues.push("Invalid URL format");

  const hasIssues = issues.length > 0;
  return {
    approved: grokApproved && !hasIssues,
    confidence: grokApproved ? 75 : 25,
  };
}

/**
 * Calculate final consensus score from Grok + Mistral
 */
export function calculateConsensusScore(
  grokConfidence: number,
  grokApproved: boolean,
  mistralConfidence: number,
  mistralApproved: boolean
): number {
  const grokWeight = 0.6; // Grok's reasoning is heavier
  const mistralWeight = 0.4;

  let score =
    (grokConfidence * grokWeight + mistralConfidence * mistralWeight) / 100;

  // Bonus if both approve
  if (grokApproved && mistralApproved) {
    score = Math.min(100, score * 1.15);
  }

  // Penalty if either rejects
  if (!grokApproved || !mistralApproved) {
    score = Math.max(0, score * 0.7);
  }

  return Math.round(score);
}

/**
 * Validate all comps through consensus model
 */
export async function validateCompsConsensus(
  comps: CompData[],
  subjectVehicle: string,
  subjectTrim: string,
  subjectMileage: number,
  targetPrice: number | null
): Promise<{
  validated: ValidatedComp[];
  rejected: Array<CompData & { reason: string }>;
  avgConfidence: number;
}> {
  const validated: ValidatedComp[] = [];
  const rejected: Array<CompData & { reason: string }> = [];

  for (const comp of comps) {
    // Get Grok approval
    const grokResult = await validateCompWithGrok(
      comp,
      subjectVehicle,
      subjectTrim,
      subjectMileage,
      targetPrice
    );

    // Get Mistral approval
    const mistralResult = await validateCompWithMistral(comp, subjectVehicle, grokResult.approved);

    // Calculate consensus score
    const consensusScore = calculateConsensusScore(
      grokResult.confidence,
      grokResult.approved,
      mistralResult.confidence,
      mistralResult.approved
    );

    // Decision gate: only keep if consensus score >= 60
    if (consensusScore >= 60) {
      validated.push({
        ...comp,
        consensusScore,
        grokApproval: grokResult.approved,
        mistralApproval: mistralResult.approved,
        reasoning: grokResult.reasoning,
        issues: grokResult.issues,
      });
    } else {
      rejected.push({
        ...comp,
        reason: `Low consensus score: ${consensusScore}/100. Issues: ${[...grokResult.issues].join(", ")}`,
      });
    }
  }

  // Sort by consensus score (highest first)
  validated.sort((a, b) => b.consensusScore - a.consensusScore);

  const avgConfidence =
    validated.length > 0
      ? Math.round(
          validated.reduce((sum, c) => sum + c.consensusScore, 0) / validated.length
        )
      : 0;

  return { validated, rejected, avgConfidence };
}
