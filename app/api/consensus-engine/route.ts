import { NextRequest, NextResponse } from "next/server";

// Consensus Engine: Coordinate Grok + Local Models for confident decisions

interface ClaimProblem {
  claimId: string;
  type: "dv_dispute" | "acv_analysis" | "negotiation" | "research" | "report";
  vehicle: string;
  insurer_offer: number;
  market_data?: unknown;
  question: string;
}

interface ConsensusResult {
  recommendation: string;
  confidence: number;
  reasoning: {
    grok: { reasoning: string; confidence: number };
    mistral: { reasoning: string; confidence: number };
    llama: { reasoning: string; confidence: number };
  };
  agreement_level: "unanimous" | "majority" | "split";
  model_votes: {
    grok: string;
    mistral: string;
    llama: string;
  };
  requires_human_review: boolean;
  assigned_agent: string;
  next_steps: string[];
}

// Route problem to appropriate machine
function routeToMachine(
  problemType: string
): "mc-prod" | "mc-ollama" | "mc-dev" | "cc2" {
  const routing: Record<string, "mc-prod" | "mc-ollama" | "mc-dev" | "cc2"> = {
    research: "mc-ollama", // Primary inference (qwen3:30b-a3b)
    acv_analysis: "mc-ollama", // Deep analysis needs heavy model
    dv_dispute: "mc-ollama", // Strategy + analysis
    negotiation: "mc-ollama", // Complex reasoning
    report: "mc-dev", // Report generation (qwen2.5-coder)
  };

  return routing[problemType] || "mc-prod";
}

// Call Grok for strategic reasoning
async function askGrok(problem: ClaimProblem): Promise<{
  reasoning: string;
  confidence: number;
  recommendation: string;
}> {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) throw new Error("XAI_API_KEY not configured");

  const prompt = `
You are a strategic advisor for claims disputes. Analyze this case and provide reasoning + confidence score.

Case: ${problem.vehicle}
Insurer Offer: $${problem.insurer_offer}
Problem Type: ${problem.type}
Question: ${problem.question}

Provide:
1. Deep reasoning on case merits
2. Confidence score (0-1) that our strategy will succeed
3. Specific recommendation

Format as JSON: { "reasoning": "...", "confidence": 0.85, "recommendation": "..." }
`;

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
      max_tokens: 500,
    }),
  });

  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    return {
      reasoning: parsed.reasoning,
      confidence: parsed.confidence,
      recommendation: parsed.recommendation,
    };
  } catch {
    return {
      reasoning: content,
      confidence: 0.6,
      recommendation: "Requires deeper analysis",
    };
  }
}

// Call local Mistral for fast validation
async function askMistral(
  problem: ClaimProblem,
  grokOutput: string
): Promise<{
  reasoning: string;
  confidence: number;
  vote: string;
}> {
  // Route to mc-prod (has qwen3-4b-4bit via MLX)
  const prompt = `
Validate this analysis quickly:
${grokOutput}

Question: Do you agree with this recommendation? Why or why not?
Confidence (0-1)?

Format as JSON: { "reasoning": "...", "confidence": 0.8, "vote": "agree" or "disagree" }
`;

  try {
    // Call local MLX on mc-prod
    const res = await fetch("http://localhost:8000/api/completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    const data = (await res.json()) as any;
    const content = data.completion || data.text || "";

    try {
      const parsed = JSON.parse(content);
      return {
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        vote: parsed.vote,
      };
    } catch {
      return {
        reasoning: content,
        confidence: 0.5,
        vote: "uncertain",
      };
    }
  } catch (e) {
    // Fallback if MLX unavailable
    return {
      reasoning: "MLX unavailable, skipping fast validation",
      confidence: 0.4,
      vote: "skip",
    };
  }
}

// Call local Llama-70B for deep analysis
async function askLlama(
  problem: ClaimProblem,
  grokOutput: string
): Promise<{
  reasoning: string;
  confidence: number;
  vote: string;
}> {
  // Route to mc-ollama (has qwen3:30b-a3b)
  const prompt = `
Provide comprehensive second opinion on this case:
${grokOutput}

Case Details:
- Vehicle: ${problem.vehicle}
- Insurer Offer: $${problem.insurer_offer}
- Type: ${problem.type}

Do you agree? Confidence? Any edge cases?

Format: { "reasoning": "...", "confidence": 0.85, "vote": "agree" or "disagree" }
`;

  try {
    // Call Ollama on mc-ollama
    const res = await fetch("http://10.0.0.x:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3:30b-a3b",
        prompt,
        temperature: 0.6,
        stream: false,
      }),
    });

    const data = (await res.json()) as any;
    const content = data.response || "";

    try {
      const parsed = JSON.parse(content);
      return {
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
        vote: parsed.vote,
      };
    } catch {
      return {
        reasoning: content,
        confidence: 0.5,
        vote: "uncertain",
      };
    }
  } catch (e) {
    // Fallback if Ollama unavailable
    return {
      reasoning: "Ollama unavailable, using Mistral only",
      confidence: 0.4,
      vote: "skip",
    };
  }
}

// Calculate consensus confidence
function calculateConfidence(
  grokConf: number,
  mistralConf: number,
  llamaConf: number,
  agreement: "unanimous" | "majority" | "split"
): number {
  const baseAvg = (grokConf + mistralConf + llamaConf) / 3;

  const bonuses: Record<string, number> = {
    unanimous: 0.15,
    majority: 0.05,
    split: 0.0,
  };

  return Math.min(1, baseAvg + (bonuses[agreement] || 0));
}

// Main consensus engine
async function consensusEngine(
  problem: ClaimProblem
): Promise<ConsensusResult> {
  console.log(`🤔 Consensus Engine: ${problem.type}`);

  // Step 1: Get Grok reasoning
  console.log("→ Asking Grok...");
  const grokResult = await askGrok(problem);

  // Step 2: Get local model consensus (parallel)
  console.log("→ Validating with local models...");
  const [mistralResult, llamaResult] = await Promise.all([
    askMistral(problem, JSON.stringify(grokResult)),
    askLlama(problem, JSON.stringify(grokResult)),
  ]);

  // Step 3: Determine agreement level
  const votes = [
    grokResult.recommendation,
    mistralResult.vote === "agree" ? grokResult.recommendation : "disagree",
    llamaResult.vote === "agree" ? grokResult.recommendation : "disagree",
  ];

  const voteCount = votes.filter((v) => v === grokResult.recommendation).length;
  const agreementLevel: "unanimous" | "majority" | "split" =
    voteCount === 3 ? "unanimous" : voteCount === 2 ? "majority" : "split";

  // Step 4: Calculate final confidence
  const finalConfidence = calculateConfidence(
    grokResult.confidence,
    mistralResult.confidence,
    llamaResult.confidence,
    agreementLevel
  );

  // Step 5: Determine if requires human review
  const requiresReview = finalConfidence < 0.7;

  // Step 6: Route to appropriate agent
  const targetMachine = routeToMachine(problem.type);
  const agentMap: Record<string, string> = {
    "mc-ollama": "Watson (Research) or Chris (Negotiation)",
    "mc-dev": "Report Generation Agent",
    "mc-prod": "CC (Chief of Staff)",
    "cc2": "Failover (if needed)",
  };
  const assignedAgent = agentMap[targetMachine];

  // Step 7: Next steps
  const nextSteps: string[] = [];
  if (problem.type === "dv_dispute") {
    nextSteps.push("Draft demand letter");
    nextSteps.push("Prepare appraisal-ready documentation");
    nextSteps.push("Schedule negotiation call");
  } else if (problem.type === "acv_analysis") {
    nextSteps.push("Pull comparable sales");
    nextSteps.push("Build valuation report");
    nextSteps.push("Present to client");
  }

  if (requiresReview) {
    nextSteps.unshift("HUMAN REVIEW REQUIRED");
  }

  return {
    recommendation: grokResult.recommendation,
    confidence: finalConfidence,
    reasoning: {
      grok: {
        reasoning: grokResult.reasoning,
        confidence: grokResult.confidence,
      },
      mistral: {
        reasoning: mistralResult.reasoning,
        confidence: mistralResult.confidence,
      },
      llama: {
        reasoning: llamaResult.reasoning,
        confidence: llamaResult.confidence,
      },
    },
    agreement_level: agreementLevel,
    model_votes: {
      grok: grokResult.recommendation,
      mistral: mistralResult.vote,
      llama: llamaResult.vote,
    },
    requires_human_review: requiresReview,
    assigned_agent: assignedAgent,
    next_steps: nextSteps,
  };
}

export async function POST(req: NextRequest) {
  try {
    const problem = (await req.json()) as ClaimProblem;

    // Validate input
    if (!problem.type || !problem.question) {
      return NextResponse.json(
        { error: "Missing required fields: type, question" },
        { status: 400 }
      );
    }

    // Run consensus engine
    const result = await consensusEngine(problem);

    // Log to Convex
    // TODO: Save to consensus_results table

    return NextResponse.json(result);
  } catch (error) {
    console.error("Consensus Engine Error:", error);
    return NextResponse.json(
      {
        error: "Consensus engine failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
