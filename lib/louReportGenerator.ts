/**
 * Loss of Use Report Generator
 * Generates expert witness LOU reports using Claude + expert framework
 */

const LOU_SYSTEM_PROMPT = `You are an expert auto appraisal and loss-of-use report writer for Walker Appraisal / Claims.Coach. 
You write professional, legally defensible expert reports in the style of John Walker Jr., 
a Washington State loss-of-use and diminished value expert witness.

When given the structured inputs below, generate a complete Loss of Use & Total Loss Report 
that includes the following sections in order:

1. HEADER — Letterhead (expert name/firm), addressee (attorney or adjuster), and claimant vehicle block
2. VEHICLE DESCRIPTION — A factual paragraph describing the vehicle class, typical specs, towing, MPG, MSRP, and equivalent rental class
3. TIMELINE OF EVENTS — A formatted date/event table, followed by analysis of who caused delay and Washington law on mitigation
4. LOSS OF USE TIMELINE — Analysis of compensable period, start/end dates used, and reasoning for cutoff
5. FREQUENCY OF USE — Whether rental receipts were provided; whether claimant actually rented
6. COMPARABLE RENTAL — Rental research findings, region, company, daily and monthly rates found, and brief disclaimer on airport pricing
7. LOSS-OF-USE CLAIM ANALYSIS — Bullet-point rebuttal of any inflated or unsupported items in the plaintiff's claim
8. OTHER CLAIMED SPECIAL DAMAGES — Itemized rebuttal of speculative or unsubstantiated damages
9. LOSS OF USE VALUATION — Final calculated amount with formula shown (days × daily rate), and a clear conclusion
10. SIGNATURE BLOCK — Expert name, credentials, perjury declaration

Tone: Professional, authoritative, neutral. First-person singular ("I"). No hedging language. 
Support every conclusion with observable facts or Washington law (WPI 30.16 where applicable).
Flag any item the plaintiff claimed that lacks documentary support.
Always note the right to amend the opinion if new documentation is produced.`;

export interface LOUReportInput {
  // Addressee
  attorneyName?: string;
  attorneyAddress?: string;
  adjusterName?: string;
  adjusterEmail?: string;

  // Claimant & Vehicle
  vehicleOwnerName: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  mileageAtLoss?: number;
  dateOfLoss: string;
  fileNumber?: string;

  // Timeline
  claimReportedDate: string;
  vehicleInspectedDate: string;
  valuationIssuedDate: string;
  disputeDate?: string;
  totalLossLetterDate: string;
  lienPaidDate?: string;

  // Delay Analysis
  delayAttribution: "claimant" | "carrier" | "both";
  delayDays: number;
  delayNotes?: string;

  // Rental Documentation
  rentalReceiptsProvided: boolean;
  rentalClaimedPerDay?: number;
  rentalAddOns?: string[];

  // Rental Research
  rentalRegion: string;
  rentalCompany: string;
  rentalVehicleClass: string;
  rentalDailyRate: number;
  rentalWeeklyRate?: number;
  rentalMonthlyRate?: number;
  rentalSearchNotes?: string;

  // LOU Calculation
  louStartDate: string;
  louEndDate: string;
  louTotalDays: number;
  louDailyRate: number;
  louCalculatedAmount: number;
  louAltHighCalc?: number;

  // Other Damages
  otherDamageClaims?: Array<{
    description: string;
    amountClaimed: number;
    rebuttalbasis: string;
  }>;

  // Expert
  expertName: string;
  expertCredentials: string[];
}

export async function generateLOUReport(input: LOUReportInput): Promise<string> {
  try {
    const userPrompt = formatLOUInput(input);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: LOU_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const result = await response.json();
    const reportText = result.content[0]?.text || "";

    console.log(`✅ LOU report generated (${reportText.length} chars)`);
    return reportText;
  } catch (err) {
    console.error("LOU report generation failed:", err);
    throw err;
  }
}

function formatLOUInput(input: LOUReportInput): string {
  const otherDamages = input.otherDamageClaims
    ?.map(
      (d, i) =>
        `Item ${i + 1} — Description: ${d.description}\n           Amount claimed: $${d.amountClaimed}\n           Rebuttal basis: ${d.rebuttalbasis}`
    )
    .join("\n");

  return `=== LOSS OF USE REPORT INPUTS ===

-- ADDRESSEE --
Attorney/Firm Name: ${input.attorneyName || "Not provided"}
Address: ${input.attorneyAddress || "Not provided"}
Adjuster Name: ${input.adjusterName || "Not provided"}
Adjuster Email: ${input.adjusterEmail || "Not provided"}

-- CLAIMANT & VEHICLE --
Vehicle Owner Name: ${input.vehicleOwnerName}
Year/Make/Model/Trim: ${input.year} ${input.make} ${input.model}${input.trim ? ` ${input.trim}` : ""}
VIN: ${input.vin || "Not provided"}
Mileage at Loss: ${input.mileageAtLoss || "Not provided"}
Date of Loss: ${input.dateOfLoss}
File Number: ${input.fileNumber || "Not provided"}

-- TIMELINE --
Date claim was reported to insurer: ${input.claimReportedDate}
Date vehicle was inspected: ${input.vehicleInspectedDate}
Date CCC-1 or valuation was issued: ${input.valuationIssuedDate}
Date claimant disputed valuation: ${input.disputeDate || "N/A"}
Date total loss letter/offer was issued: ${input.totalLossLetterDate}
Date lien paid / interest stopped: ${input.lienPaidDate || "Not provided"}

-- DELAY ANALYSIS --
Who caused the delay? ${input.delayAttribution}
Total delay days attributable to claimant: ${input.delayDays}
Explanation/notes on delay: ${input.delayNotes || "None provided"}

-- RENTAL DOCUMENTATION --
Did claimant provide rental receipts? ${input.rentalReceiptsProvided ? "Yes" : "No"}
If yes, what did they claim per day? ${input.rentalClaimedPerDay ? `$${input.rentalClaimedPerDay}` : "N/A"}
What inflated add-ons did they include? ${input.rentalAddOns?.join(", ") || "None identified"}

-- RENTAL RESEARCH --
Region/city searched: ${input.rentalRegion}
Rental company name: ${input.rentalCompany}
Vehicle class found: ${input.rentalVehicleClass}
Daily rate: $${input.rentalDailyRate}
Weekly rate: ${input.rentalWeeklyRate ? `$${input.rentalWeeklyRate}` : "Not found"}
Monthly rate: ${input.rentalMonthlyRate ? `$${input.rentalMonthlyRate}` : "Not found"}
Notes on search: ${input.rentalSearchNotes || "Standard neighborhood rates"}

-- LOU CALCULATION --
Start date used: ${input.louStartDate}
End date used: ${input.louEndDate}
Total days: ${input.louTotalDays}
Rate used (daily): $${input.louDailyRate}
Total LOU calculated: $${input.louCalculatedAmount}
${input.louAltHighCalc ? `Alternative high-end calculation: $${input.louAltHighCalc}` : ""}

-- OTHER CLAIMED DAMAGES TO REBUT --
${otherDamages || "(None identified)"}

-- EXPERT --
Expert Name: ${input.expertName}
Credentials/Titles: ${input.expertCredentials.join(", ")}`;
}
