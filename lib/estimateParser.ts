/**
 * Estimate Parser
 * Extracts vehicle data from uploaded estimate PDFs using Claude vision
 * Input: PDF file path or URL
 * Output: { year, make, model, vin, mileage, estimateAmount }
 */

export async function parseEstimateDocument(pdfPath: string): Promise<{
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  mileage?: number;
  estimateAmount?: number;
  confidence: number;
  rawText?: string;
}> {
  try {
    // Call Claude with vision to extract data from PDF
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract vehicle information from this estimate. Return JSON only:
{
  "year": <number or null>,
  "make": "<string or null>",
  "model": "<string or null>",
  "vin": "<string or null>",
  "mileage": <number or null>,
  "estimateAmount": <number or null>,
  "confidence": <0-1>
}

Look for:
- Year: Often in "Vehicle" section
- Make/Model: Brand name + model name
- VIN: 17-character code
- Mileage: In odometer/miles section
- Estimate Amount: Total repair estimate or ACV

If estimate is an image or PDF, look at all visible text.`,
              },
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: await readFileAsBase64(pdfPath),
                },
              },
            ],
          },
        ],
      }),
    });

    const result = await response.json();
    const content = result.content[0]?.text || "{}";

    // Parse JSON response
    const parsed = JSON.parse(content);
    return {
      year: parsed.year,
      make: parsed.make,
      model: parsed.model,
      vin: parsed.vin,
      mileage: parsed.mileage,
      estimateAmount: parsed.estimateAmount,
      confidence: parsed.confidence || 0.7,
    };
  } catch (err) {
    console.error("Estimate parsing failed:", err);
    return {
      confidence: 0,
      rawText: `Error parsing estimate: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function readFileAsBase64(filePath: string): Promise<string> {
  // In production, would fetch from Drive or upload service
  // For now, return empty — integrate with actual file handling
  return "";
}

/**
 * Usage:
 *
 * const data = await parseEstimateDocument("/path/to/estimate.pdf");
 * if (data.confidence > 0.7) {
 *   // Confidence high — use data for Watson
 *   await triggerWatsonComps({
 *     year: data.year,
 *     make: data.make,
 *     model: data.model,
 *     mileage: data.mileage,
 *   });
 * }
 */
