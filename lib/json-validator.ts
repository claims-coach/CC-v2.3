/**
 * JSON Validator & Auto-Repair
 * Catches malformed JSON and auto-fixes common issues
 */

export interface ValidationResult {
  valid: boolean;
  data?: unknown;
  error?: string;
  fixed?: boolean;
  originalError?: string;
  repairs?: string[];
}

/**
 * Common JSON errors and fixes
 */
const commonIssues = [
  {
    name: "Trailing comma",
    pattern: /,(\s*[}\]])/g,
    fix: (str: string) => str.replace(/,(\s*[}\]])/g, "$1"),
  },
  {
    name: "Single quotes instead of double",
    pattern: /'([^']*?)'/g,
    fix: (str: string) => str.replace(/'([^']*?)'/g, '"$1"'),
  },
  {
    name: "Unquoted keys",
    pattern: /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g,
    fix: (str: string) => str.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3'),
  },
  {
    name: "Missing quotes around values with spaces",
    pattern: /:\s*([a-zA-Z0-9 ]*[a-zA-Z ][a-zA-Z0-9 ]*)\s*([,}\]])/g,
    fix: (str: string) => str.replace(/:\s*([a-zA-Z0-9 ]*[a-zA-Z ][a-zA-Z0-9 ]*)\s*([,}\]])/g, ': "$1"$2'),
  },
  {
    name: "Comments (// or /* */)",
    pattern: /\/\/.*/g,
    fix: (str: string) => str.replace(/\/\/.*/g, ""),
  },
  {
    name: "Control characters",
    pattern: /[\x00-\x1F\x7F-\x9F]/g,
    fix: (str: string) => str.replace(/[\x00-\x1F\x7F-\x9F]/g, ""),
  },
  {
    name: "Newlines inside strings",
    pattern: /: "([^"]*\n[^"]*)"/g,
    fix: (str: string) => str.replace(/: "([^"]*\n[^"]*)"/g, (match) => ': "' + match.slice(2, -1).replace(/\n/g, "\\n") + '"'),
  },
];

/**
 * Try to parse JSON with automatic repair
 */
export function validateAndRepairJSON(jsonString: string): ValidationResult {
  // Try direct parse first
  try {
    const data = JSON.parse(jsonString);
    return { valid: true, data };
  } catch (e) {
    const originalError = (e as Error).message;
  }

  // Try repairs
  let repaired = jsonString;
  const appliedRepairs: string[] = [];

  for (const issue of commonIssues) {
    if (issue.pattern.test(repaired)) {
      const before = repaired;
      repaired = issue.fix(repaired);
      if (before !== repaired) {
        appliedRepairs.push(issue.name);
      }
    }
  }

  // Try parsing again after repairs
  try {
    const data = JSON.parse(repaired);
    return {
      valid: true,
      data,
      fixed: appliedRepairs.length > 0,
      repairs: appliedRepairs,
    };
  } catch (e) {
    const repairError = (e as Error).message;
  }

  // Last resort: try to extract valid JSON object
  const extracted = extractValidJSON(jsonString);
  if (extracted) {
    try {
      const data = JSON.parse(extracted);
      return {
        valid: true,
        data,
        fixed: true,
        repairs: ["extracted valid JSON object"],
      };
    } catch {
      // Extraction didn't help
    }
  }

  return {
    valid: false,
    error: `Failed to parse JSON: ${originalError || "Unknown error"}`,
    originalError,
    repairs: appliedRepairs,
  };
}

/**
 * Extract first valid JSON object from malformed string
 * Tries to find matching braces and return that substring
 */
function extractValidJSON(str: string): string | null {
  const start = str.indexOf("{");
  if (start === -1) return null;

  let braceCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") braceCount++;
    if (char === "}") braceCount--;

    if (braceCount === 0) {
      return str.substring(start, i + 1);
    }
  }

  return null;
}

/**
 * Validate endpoint response and auto-repair
 */
export async function fetchJSONWithRepair(
  url: string,
  options?: RequestInit
): Promise<ValidationResult> {
  try {
    const response = await fetch(url, options);
    const text = await response.text();

    if (!response.ok) {
      return {
        valid: false,
        error: `HTTP ${response.status}: ${text}`,
      };
    }

    return validateAndRepairJSON(text);
  } catch (e) {
    return {
      valid: false,
      error: `Fetch failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Middleware for Next.js API routes to validate response
 */
export function withJSONValidation(handler: Function) {
  return async (req: any, res: any) => {
    // Wrap response.json() to validate
    const originalJson = res.json.bind(res);

    res.json = function(data: unknown) {
      // Ensure data is valid before sending
      if (typeof data === "object" && data !== null) {
        try {
          const jsonStr = JSON.stringify(data);
          const validation = validateAndRepairJSON(jsonStr);

          if (!validation.valid) {
            console.error("Response JSON validation failed:", validation.error);
            return originalJson({
              error: "Invalid response data",
              details: validation.error,
            });
          }

          // If repairs were applied, log them
          if (validation.repairs && validation.repairs.length > 0) {
            console.warn("JSON repairs applied:", validation.repairs);
          }
        } catch (e) {
          console.error("JSON stringify failed:", e);
          return originalJson({ error: "Data serialization failed" });
        }
      }

      return originalJson(data);
    };

    return handler(req, res);
  };
}

/**
 * Safe JSON stringify with fallback
 */
export function safeStringify(data: unknown, fallback = "{}"): string {
  try {
    return JSON.stringify(data);
  } catch (e) {
    console.error("JSON stringify failed:", e);
    return fallback;
  }
}

/**
 * Deep clone with circular reference handling
 */
export function safeClone(obj: unknown): unknown {
  const seen = new WeakSet();

  function clone(value: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (seen.has(value as object)) {
      return "[Circular Reference]";
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map(clone);
    }

    const cloned: Record<string, unknown> = {};
    for (const key in value as Record<string, unknown>) {
      cloned[key] = clone((value as Record<string, unknown>)[key]);
    }
    return cloned;
  }

  return clone(obj);
}

/**
 * Validate and extract specific fields from potentially malformed JSON
 */
export function extractFields(
  jsonString: string,
  fields: string[]
): Record<string, unknown> {
  const validation = validateAndRepairJSON(jsonString);

  if (!validation.valid || !validation.data) {
    return {};
  }

  const data = validation.data as Record<string, unknown>;
  const extracted: Record<string, unknown> = {};

  for (const field of fields) {
    if (field in data) {
      extracted[field] = data[field];
    }
  }

  return extracted;
}
