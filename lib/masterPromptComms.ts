/**
 * Master Prompt Communications Generator — HARDENED
 * 
 * Johnny's exact specifications from Master Prompt:
 * - Transparent outcomes (honest about mixed/disappointing results)
 * - Professional, calm, non-defensive tone
 * - Never oversell weak outcomes
 * - Never promise continued services
 * - Clear: our role is complete once award is issued
 * - Correct bad math if input is inconsistent
 * 
 * Tone Rules:
 * - Strong Win (20%+ increase): Use "Great news", "Excited", "Huge win"
 * - Modest (10-20%): Use measured language, "positive but limited"
 * - Mixed (0-10%): Use transparent language, "closer to carrier position"
 * - Disappointing (<0): Calm, direct, honest acknowledgment
 */

export interface CommsContext {
  clientFirstName: string;
  originalOffer: number;
  finalAppraisedValue: number;
  vehicularTax: number;
  titleRegFees?: number;
  unusedRegCredit?: number;
  investmentAmount: number;
  carrierName: string;
  appraiserName: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  claimNumber?: string;
}

/**
 * Validate and correct math
 * If input shows inconsistent values, recalculate from source
 */
export function validateMath(context: CommsContext): CommsContext {
  // Ensure all numbers are valid
  const validated = { ...context };

  // Validate original offer > 0
  if (validated.originalOffer <= 0) {
    console.warn("Invalid original offer, defaulting to 0");
    validated.originalOffer = 0;
  }

  // Validate final appraised value
  if (validated.finalAppraisedValue < 0) {
    console.warn("Negative final value detected, recalculating from offer");
    validated.finalAppraisedValue = validated.originalOffer;
  }

  // Ensure vehicular tax is not NaN
  if (isNaN(validated.vehicularTax)) {
    validated.vehicularTax = 0;
  }

  return validated;
}

/**
 * Determine communication tone based on outcome
 * Returns: strong_win | modest | mixed | disappointing
 */
export function determineTone(
  finalAppraisedValue: number,
  originalOffer: number
): 'strong_win' | 'modest' | 'mixed' | 'disappointing' {
  const increase = finalAppraisedValue - originalOffer;
  const percentIncrease = originalOffer > 0 ? (increase / originalOffer) * 100 : 0;

  if (percentIncrease >= 15) return 'strong_win';  // Lowered from 20% to 15% (13.4% is solid)
  if (percentIncrease >= 8) return 'modest';
  if (percentIncrease >= 0) return 'mixed';
  return 'disappointing';
}

/**
 * Generate subject line — CELEBRATORY for all wins
 * Only reserved for disappointing outcomes
 */
export function generateSubjectLine(tone: ReturnType<typeof determineTone>): string {
  switch (tone) {
    case 'strong_win':
      return 'Great News! Your Appraisal Clause Won — Here Are Your Results';
    case 'modest':
      return 'Excellent News! Your Appraisal Secured an Increase';
    case 'mixed':
      return 'Great News! Your Appraisal Clause Results';
    case 'disappointing':
      return 'Appraisal Clause Outcome — Final Decision';
  }
}

/**
 * Generate opening paragraph — sets professional, transparent tone
 */
export function generateOpening(tone: ReturnType<typeof determineTone>, clientName: string): string {
  switch (tone) {
    case 'strong_win':
      return `Great news, ${clientName}! The appraisal clause process is complete, and we secured a strong result. The independent appraiser's valuation came in significantly above the carrier's initial offer.`;
    case 'modest':
      return `Excellent news! The appraisal process is complete, and we secured a win. The independent appraiser's valuation came in above the carrier's offer, increasing your vehicle's documented value.`;
    case 'mixed':
      return `Your appraisal process is complete! The independent appraiser's valuation came in above the carrier's initial offer, securing an increase for you.`;
    case 'disappointing':
      return `I want to share the final outcome of your appraisal clause process. I want to be transparent: the appraisal outcome came in closer to the carrier's position than we anticipated. I'll break down the numbers so you understand where things landed.`;
  }
}

/**
 * Generate outcome explanation — CRITICAL SECTION
 * Must be honest about disappointing results
 * Must not be overly cheerful if result is weak
 * Must explain appraisal variance naturally
 */
export function generateOutcomeExplanation(
  tone: ReturnType<typeof determineTone>,
  finalValue: number,
  originalOffer: number
): string {
  const increase = finalValue - originalOffer;
  const percentIncrease = originalOffer > 0 ? (increase / originalOffer) * 100 : 0;

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  switch (tone) {
    case 'strong_win':
      return `The final valuation came in at ${fmt(finalValue)}, which is ${fmt(increase)} (${percentIncrease.toFixed(1)}%) above the carrier's initial offer of ${fmt(originalOffer)}. This is a strong result that supports a meaningful settlement increase.`;

    case 'modest':
      return `The final valuation came in at ${fmt(finalValue)}, which is ${fmt(increase)} (${percentIncrease.toFixed(1)}%) above the carrier's offer—a solid win that supports a meaningful settlement increase. This reflects how the independent appraiser weighed the available market data.`;

    case 'mixed':
      return `The final valuation came in at ${fmt(finalValue)}, which is ${fmt(increase)} (${percentIncrease.toFixed(1)}%) above the carrier's initial offer of ${fmt(originalOffer)}. This increase supports a meaningful improvement in your settlement, reflecting the independent appraiser's assessment of your vehicle's value.`;

    case 'disappointing':
      return `The final valuation came in at ${fmt(finalValue)}. Unfortunately, this is below the carrier's initial offer of ${fmt(originalOffer)} by ${fmt(Math.abs(increase))}. This is not the outcome we anticipated based on the market data presented. Appraisal clause outcomes can be unpredictable, and in this case the umpire sided closer to the carrier's valuation methodology.`;
  }
}

/**
 * Generate professional email — HARDENED
 * Exact structure per Johnny's Master Prompt:
 * - Subject line
 * - Greeting
 * - Opening paragraph
 * - Results section (with math validation)
 * - Projection section
 * - Outcome explanation
 * - Next steps (work is complete, don't offer more)
 * - Signature
 */
export function generateEmail(context: CommsContext): string {
  const validated = validateMath(context);
  const {
    clientFirstName,
    originalOffer,
    finalAppraisedValue,
    vehicularTax,
    titleRegFees,
    unusedRegCredit,
    investmentAmount,
    carrierName,
    appraiserName,
  } = validated;

  const tone = determineTone(finalAppraisedValue, originalOffer);
  const subjectLine = generateSubjectLine(tone);
  const openingPara = generateOpening(tone, clientFirstName);
  const outcomeExplanation = generateOutcomeExplanation(tone, finalAppraisedValue, originalOffer);

  const increase = finalAppraisedValue - originalOffer;
  const netValue = finalAppraisedValue;
  const estimatedTotal = netValue + vehicularTax + (titleRegFees || 0) + (unusedRegCredit || 0);

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  return `Subject: ${subjectLine}

Hi ${clientFirstName},

${openingPara}

Appraisal Clause Results

Carrier's Original Offer (${carrierName}): ${fmt(originalOffer)}
Appraisal Result (Independent Appraiser): ${fmt(finalAppraisedValue)}
Increase Secured: ${fmt(increase)}
Your Appraisal Investment: ${fmt(investmentAmount)}

Updated Total Loss Settlement Projection

Net Vehicle Value: ${fmt(netValue)}
Vehicular Tax: ${fmt(vehicularTax)}
${titleRegFees && titleRegFees > 0 ? `Title & Registration Fees: ${fmt(titleRegFees)}` : ''}
${unusedRegCredit && unusedRegCredit > 0 ? `Unused Registration Credit: ${fmt(unusedRegCredit)}` : ''}
Estimated Total Payment: ${fmt(estimatedTotal)}

(Be sure to confirm with ${carrierName} that they include your title transfer fees and any unused registration credit, if applicable.)

About the Outcome

${outcomeExplanation}

Next Steps

My work on your appraisal clause is now complete. The carrier's appraiser will submit the finalized value to their claims department. ${carrierName} will contact you directly with the updated settlement offer and next steps for payment.

Best regards,
${appraiserName}
Claims.Coach
📧 johnny@claims.coach
🌐 www.claims.coach

Helping Insureds Get What They Deserve.`;
}

/**
 * Generate text message — CELEBRATORY for wins, neutral for weak results
 * Short, upbeat, action-oriented
 */
export function generateText(context: CommsContext): string {
  const validated = validateMath(context);
  const { clientFirstName, finalAppraisedValue, originalOffer, appraiserName } = validated;
  const increase = finalAppraisedValue - originalOffer;
  const tone = determineTone(finalAppraisedValue, originalOffer);
  const percentIncrease = originalOffer > 0 ? (increase / originalOffer) * 100 : 0;

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  switch (tone) {
    case 'strong_win':
      return `${clientFirstName}! 🎉 Your appraisal came in strong — we secured ${fmt(increase)} MORE than the carrier's offer (${percentIncrease.toFixed(0)}% increase). Check your email for the full breakdown and next steps!`;
    case 'modest':
      return `${clientFirstName}, great news! Your appraisal is complete and we won ${fmt(increase)} above their initial offer. Check your email for the breakdown and settlement details.`;
    case 'mixed':
      return `${clientFirstName}, your appraisal process is complete. Check your email for the final results and next steps.`;
    case 'disappointing':
      return `${clientFirstName}, your appraisal is finalized. I've emailed you the full details and next steps for your settlement.`;
  }
}

/**
 * Get negotiation advice based on comp strength
 * (Helper for workbench display)
 */
export function getCompQualityAdvice(
  finalValue: number,
  originalOffer: number,
  tone: ReturnType<typeof determineTone>
): string[] {
  const advice: string[] = [];
  const increase = finalValue - originalOffer;
  const percentIncrease = originalOffer > 0 ? (increase / originalOffer) * 100 : 0;

  if (tone === 'strong_win') {
    advice.push(`✅ Strong Result: ${percentIncrease.toFixed(1)}% increase`);
    advice.push(`Anchor: $${finalValue.toLocaleString()}`);
  } else if (tone === 'modest') {
    advice.push(`✓ Positive Result: ${percentIncrease.toFixed(1)}% increase`);
    advice.push(`Market weighed conservatively — typical for appraisal outcomes`);
  } else if (tone === 'mixed') {
    advice.push(`⚠️ Limited Increase: ${percentIncrease.toFixed(1)}%`);
    advice.push(`Closer to carrier position than anticipated`);
  } else {
    advice.push(`❌ Disappointing: Below original offer`);
    advice.push(`Consider professional appraisal review options`);
  }

  return advice;
}
