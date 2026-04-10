import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Consensus Results Schema
 * Tracks all consensus engine decisions + outcomes
 */

export const consensusResults = {
  consensus_id: v.string(),
  claim_id: v.string(),
  problem_type: v.union(
    v.literal("dv_dispute"),
    v.literal("acv_analysis"),
    v.literal("negotiation"),
    v.literal("research"),
    v.literal("report")
  ),
  vehicle: v.string(),
  insurer_offer: v.number(),
  question: v.string(),

  // Model outputs
  grok_confidence: v.number(),
  grok_reasoning: v.string(),
  grok_recommendation: v.string(),

  mistral_confidence: v.number(),
  mistral_reasoning: v.string(),
  mistral_vote: v.union(v.literal("agree"), v.literal("disagree"), v.literal("uncertain")),

  llama_confidence: v.number(),
  llama_reasoning: v.string(),
  llama_vote: v.union(v.literal("agree"), v.literal("disagree"), v.literal("uncertain")),

  // Consensus scoring
  final_confidence: v.number(),
  agreement_level: v.union(v.literal("unanimous"), v.literal("majority"), v.literal("split")),
  confidence_band: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.literal("critical")),
  requires_human_review: v.boolean(),
  decision_rule: v.union(
    v.literal("proceed_auto"),
    v.literal("proceed_with_sign_off"),
    v.literal("escalate"),
    v.literal("reject")
  ),

  // Recommendation & routing
  final_recommendation: v.string(),
  assigned_agent: v.string(),
  assigned_machine: v.union(v.literal("mc-prod"), v.literal("mc-ollama"), v.literal("mc-dev"), v.literal("cc2")),
  next_steps: v.array(v.string()),

  // Status tracking
  status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"), v.literal("escalated")),
  human_review_notes: v.optional(v.string()),
  human_reviewer: v.optional(v.string()),

  // Outcome tracking (for calibration)
  actual_outcome: v.optional(v.string()),
  outcome_success: v.optional(v.boolean()),
  calibration_error: v.optional(v.number()),
  resolved_at: v.optional(v.number()),

  // Timestamps
  created_at: v.number(),
  updated_at: v.number(),
};

/**
 * Save consensus result
 */
export const saveConsensusResult = mutation({
  args: {
    consensus_id: v.string(),
    claim_id: v.string(),
    problem_type: v.string(),
    vehicle: v.string(),
    insurer_offer: v.number(),
    question: v.string(),
    grok_confidence: v.number(),
    grok_reasoning: v.string(),
    grok_recommendation: v.string(),
    mistral_confidence: v.number(),
    mistral_reasoning: v.string(),
    mistral_vote: v.string(),
    llama_confidence: v.number(),
    llama_reasoning: v.string(),
    llama_vote: v.string(),
    final_confidence: v.number(),
    agreement_level: v.string(),
    confidence_band: v.string(),
    requires_human_review: v.boolean(),
    decision_rule: v.string(),
    final_recommendation: v.string(),
    assigned_agent: v.string(),
    assigned_machine: v.string(),
    next_steps: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("consensus_results", {
      consensus_id: args.consensus_id,
      claim_id: args.claim_id,
      problem_type: args.problem_type as any,
      vehicle: args.vehicle,
      insurer_offer: args.insurer_offer,
      question: args.question,
      grok_confidence: args.grok_confidence,
      grok_reasoning: args.grok_reasoning,
      grok_recommendation: args.grok_recommendation,
      mistral_confidence: args.mistral_confidence,
      mistral_reasoning: args.mistral_reasoning,
      mistral_vote: args.mistral_vote as any,
      llama_confidence: args.llama_confidence,
      llama_reasoning: args.llama_reasoning,
      llama_vote: args.llama_vote as any,
      final_confidence: args.final_confidence,
      agreement_level: args.agreement_level as any,
      confidence_band: args.confidence_band as any,
      requires_human_review: args.requires_human_review,
      decision_rule: args.decision_rule as any,
      final_recommendation: args.final_recommendation,
      assigned_agent: args.assigned_agent,
      assigned_machine: args.assigned_machine as any,
      next_steps: args.next_steps,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    return id;
  },
});

/**
 * Get consensus result by ID
 */
export const getConsensusResult = query({
  args: { consensus_id: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("consensus_results")
      .filter((q) => q.eq(q.field("consensus_id"), args.consensus_id))
      .take(1);

    return results[0] || null;
  },
});

/**
 * List recent consensus results
 */
export const listConsensusResults = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const offset = args.offset || 0;

    const results = await ctx.db
      .query("consensus_results")
      .order("desc")
      .take(limit + offset);

    return results.slice(offset);
  },
});

/**
 * Get pending human reviews
 */
export const getPendingReviews = query({
  handler: async (ctx) => {
    const results = await ctx.db
      .query("consensus_results")
      .filter((q) => q.and(
        q.eq(q.field("requires_human_review"), true),
        q.eq(q.field("status"), "pending")
      ))
      .order("desc")
      .take(100);

    return results;
  },
});

/**
 * Resolve consensus with outcome
 */
export const resolveConsensus = mutation({
  args: {
    consensus_id: v.string(),
    actual_outcome: v.string(),
    outcome_success: v.boolean(),
    reviewer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("consensus_results")
      .filter((q) => q.eq(q.field("consensus_id"), args.consensus_id))
      .take(1);

    if (!result[0]) {
      throw new Error(`Consensus ${args.consensus_id} not found`);
    }

    const consensus = result[0];
    const calibrationError = args.outcome_success
      ? 0
      : Math.abs(consensus.final_confidence - (args.outcome_success ? 1 : 0));

    await ctx.db.patch(result[0]._id, {
      status: "completed",
      actual_outcome: args.actual_outcome,
      outcome_success: args.outcome_success,
      calibration_error: calibrationError,
      human_reviewer: args.reviewer,
      resolved_at: Date.now(),
      updated_at: Date.now(),
    });

    return consensus._id;
  },
});

/**
 * Escalate consensus to human
 */
export const escalateConsensus = mutation({
  args: {
    consensus_id: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("consensus_results")
      .filter((q) => q.eq(q.field("consensus_id"), args.consensus_id))
      .take(1);

    if (!results[0]) {
      throw new Error(`Consensus ${args.consensus_id} not found`);
    }

    await ctx.db.patch(results[0]._id, {
      status: "escalated",
      human_review_notes: args.reason,
      updated_at: Date.now(),
    });

    return results[0]._id;
  },
});

/**
 * Calibration report: how well are confidence scores?
 */
export const calibrationReport = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const results = await ctx.db
      .query("consensus_results")
      .filter((q) => q.and(
        q.gte(q.field("created_at"), cutoffTime),
        q.neq(q.field("outcome_success"), undefined)
      ))
      .take(1000);

    if (results.length === 0) {
      return {
        total_predictions: 0,
        accuracy: 0,
        mean_calibration_error: 0,
        recommendations: ["No completed predictions yet"],
      };
    }

    const resolved = results.filter((r) => r.resolved_at);
    const correct = resolved.filter((r) => r.outcome_success).length;
    const accuracy = correct / resolved.length;
    const meanError =
      resolved.reduce((sum, r) => sum + (r.calibration_error || 0), 0) /
      resolved.length;

    const recommendations: string[] = [];
    if (accuracy < 0.7) {
      recommendations.push(
        "Accuracy below 70%. Increase decision threshold to 0.8 or adjust model weights."
      );
    }
    if (meanError > 0.2) {
      recommendations.push(
        "High calibration error. Reweight models: favor Grok for strategy, Mistral for speed."
      );
    }
    if (accuracy > 0.9) {
      recommendations.push(
        "Excellent accuracy! Consider lowering threshold to 0.65 to proceed more aggressively."
      );
    }

    return {
      total_predictions: resolved.length,
      accuracy: Math.round(accuracy * 100),
      mean_calibration_error: Math.round(meanError * 100) / 100,
      recommendations,
    };
  },
});

/**
 * Model performance breakdown
 */
export const modelPerformance = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const results = await ctx.db
      .query("consensus_results")
      .filter((q) => q.and(
        q.gte(q.field("created_at"), cutoffTime),
        q.neq(q.field("outcome_success"), undefined)
      ))
      .take(1000);

    const models = {
      grok: { correct: 0, total: 0, avg_confidence: 0 },
      mistral: { correct: 0, total: 0, avg_confidence: 0 },
      llama: { correct: 0, total: 0, avg_confidence: 0 },
    };

    for (const result of results) {
      // Check if each model's vote matched outcome
      const grokCorrect =
        (result.grok_recommendation === "agree") === result.outcome_success;
      const mistralCorrect =
        (result.mistral_vote === "agree") === result.outcome_success;
      const llamaCorrect =
        (result.llama_vote === "agree") === result.outcome_success;

      if (grokCorrect) models.grok.correct++;
      if (mistralCorrect) models.mistral.correct++;
      if (llamaCorrect) models.llama.correct++;

      models.grok.total++;
      models.mistral.total++;
      models.llama.total++;

      models.grok.avg_confidence += result.grok_confidence;
      models.mistral.avg_confidence += result.mistral_confidence;
      models.llama.avg_confidence += result.llama_confidence;
    }

    return {
      grok: {
        accuracy: Math.round((models.grok.correct / models.grok.total) * 100),
        avg_confidence: Math.round((models.grok.avg_confidence / models.grok.total) * 100) / 100,
      },
      mistral: {
        accuracy: Math.round((models.mistral.correct / models.mistral.total) * 100),
        avg_confidence: Math.round((models.mistral.avg_confidence / models.mistral.total) * 100) / 100,
      },
      llama: {
        accuracy: Math.round((models.llama.correct / models.llama.total) * 100),
        avg_confidence: Math.round((models.llama.avg_confidence / models.llama.total) * 100) / 100,
      },
    };
  },
});
