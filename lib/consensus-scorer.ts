/**
 * Consensus Confidence Scoring
 * Determines how confident we should be in a recommendation
 */

export interface ConfidenceBreakdown {
  grok_score: number; // 0-1: Grok's confidence in reasoning
  mistral_score: number; // 0-1: Mistral's confidence in agreement
  llama_score: number; // 0-1: Llama's confidence in analysis
  agreement_bonus: number; // 0.15 (unanimous), 0.05 (majority), 0 (split)
  final_confidence: number; // 0-1: Final consensus score
  decision_threshold: number; // 0.7: Proceed if >= this
  requires_human_review: boolean;
  confidence_band: "high" | "medium" | "low" | "critical";
}

/**
 * Calculate final confidence from 3-model consensus
 */
export function scoreConfidence(
  grokScore: number,
  mistralScore: number,
  llamaScore: number,
  agreementLevel: "unanimous" | "majority" | "split"
): ConfidenceBreakdown {
  // Base average
  const baseAverage = (grokScore + mistralScore + llamaScore) / 3;

  // Agreement bonuses
  const agreementBonuses: Record<string, number> = {
    unanimous: 0.15, // +15% if all agree
    majority: 0.05, // +5% if 2/3 agree
    split: 0.0, // No bonus if split
  };

  const bonus = agreementBonuses[agreementLevel] || 0;
  const finalConfidence = Math.min(1, baseAverage + bonus);

  // Decision threshold
  const threshold = 0.7;
  const requiresReview = finalConfidence < threshold;

  // Confidence band
  let band: "high" | "medium" | "low" | "critical";
  if (finalConfidence >= 0.85) {
    band = "high";
  } else if (finalConfidence >= 0.7) {
    band = "medium";
  } else if (finalConfidence >= 0.5) {
    band = "low";
  } else {
    band = "critical";
  }

  return {
    grok_score: grokScore,
    mistral_score: mistralScore,
    llama_score: llamaScore,
    agreement_bonus: bonus,
    final_confidence: finalConfidence,
    decision_threshold: threshold,
    requires_human_review: requiresReview,
    confidence_band: band,
  };
}

/**
 * Explain confidence score in human terms
 */
export function explainConfidence(breakdown: ConfidenceBreakdown): string {
  const { final_confidence, confidence_band, requires_human_review } =
    breakdown;

  const explanations: Record<string, string> = {
    high: `Very confident (${(final_confidence * 100).toFixed(0)}%). All models agree. Proceed without hesitation.`,
    medium: `Reasonably confident (${(final_confidence * 100).toFixed(0)}%). Most models agree. Proceed with human sign-off.`,
    low: `Uncertain (${(final_confidence * 100).toFixed(0)}%). Models diverge. Escalate to human for decision.`,
    critical: `Not confident (${(final_confidence * 100).toFixed(0)}%). Significant model disagreement. Return to research.`,
  };

  let explanation = explanations[confidence_band];
  if (requires_human_review) {
    explanation += " ⚠️ REQUIRES HUMAN REVIEW.";
  }

  return explanation;
}

/**
 * Decision rule based on confidence
 */
export function getDecisionRule(confidence: number): {
  action: "proceed_auto" | "proceed_with_sign_off" | "escalate" | "reject";
  description: string;
} {
  if (confidence >= 0.85) {
    return {
      action: "proceed_auto",
      description: "Proceed immediately, minimal human review",
    };
  } else if (confidence >= 0.7) {
    return {
      action: "proceed_with_sign_off",
      description: "Proceed with human sign-off",
    };
  } else if (confidence >= 0.5) {
    return {
      action: "escalate",
      description: "Escalate to human for decision",
    };
  } else {
    return {
      action: "reject",
      description: "Reject recommendation, return to research",
    };
  }
}

/**
 * Track prediction accuracy over time
 * (for model improvement via autoresearch)
 */
export interface PredictionRecord {
  consensus_id: string;
  predicted_confidence: number;
  predicted_outcome: string;
  actual_outcome?: string;
  actual_success?: boolean;
  calibration_error?: number;
  created_at: Date;
  resolved_at?: Date;
}

export function recordPrediction(
  consensusId: string,
  predictedConfidence: number,
  predictedOutcome: string
): PredictionRecord {
  return {
    consensus_id: consensusId,
    predicted_confidence: predictedConfidence,
    predicted_outcome: predictedOutcome,
    created_at: new Date(),
  };
}

export function resolvePrediction(
  record: PredictionRecord,
  actualOutcome: string,
  actualSuccess: boolean
): PredictionRecord {
  const calibrationError = actualSuccess
    ? 0 // Perfect prediction
    : Math.abs(record.predicted_confidence - (actualSuccess ? 1 : 0));

  return {
    ...record,
    actual_outcome: actualOutcome,
    actual_success: actualSuccess,
    calibration_error: calibrationError,
    resolved_at: new Date(),
  };
}

/**
 * Batch calibration: How well are our confidence scores?
 */
export function calibrationReport(predictions: PredictionRecord[]): {
  total_predictions: number;
  accuracy: number;
  mean_calibration_error: number;
  recommendations: string[];
} {
  const resolved = predictions.filter((p) => p.resolved_at);
  const accuracy = resolved.filter((p) => p.actual_success).length / resolved.length;
  const meanError =
    resolved.reduce((sum, p) => sum + (p.calibration_error || 0), 0) /
    resolved.length;

  const recommendations: string[] = [];
  if (accuracy < 0.7) {
    recommendations.push(
      "Model accuracy below 70%. Increase decision threshold to 0.8."
    );
  }
  if (meanError > 0.2) {
    recommendations.push(
      "High calibration error. Reweight model confidences (favor Grok for strategy, Mistral for speed)."
    );
  }

  return {
    total_predictions: resolved.length,
    accuracy,
    mean_calibration_error: meanError,
    recommendations,
  };
}
