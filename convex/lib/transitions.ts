// ============================================================
// lib/transitions.ts — Stage transition guards + carrier normalization
// ============================================================

// ---- PROSPECT stage transitions ----
const PROSPECT_TRANSITIONS: Record<string, string[]> = {
  INTAKE_CREATED:    ["RESEARCH_RUNNING", "CLOSED_LOST"],
  RESEARCH_RUNNING:  ["RESEARCH_COMPLETE"],
  RESEARCH_COMPLETE: ["CALL_COMPLETE"],
  CALL_COMPLETE:     ["QUALIFIED", "NEEDS_REVIEW", "CLOSED_NQ", "CLOSED_LOST"],
  QUALIFIED:         ["CONVERTED", "CLOSED_LOST"],
  NEEDS_REVIEW:      ["QUALIFIED", "CLOSED_NQ", "CLOSED_LOST"],
  CLOSED_NQ:         [],  // terminal
  CLOSED_LOST:       [],  // terminal
  CONVERTED:         [],  // terminal
};

// ---- MATTER stage transitions ----
const MATTER_TRANSITIONS: Record<string, string[]> = {
  ACTIVE:             ["REPORT_GENERATING", "CLOSED"],
  REPORT_GENERATING:  ["REPORT_READY", "ACTIVE"],   // rollback allowed
  REPORT_READY:       ["SUBMITTED", "ACTIVE"],       // rollback allowed
  SUBMITTED:          ["AWAITING_RESPONSE", "CLOSED"],
  AWAITING_RESPONSE:  ["CLOSED"],
  CLOSED:             [],  // terminal
};

export function validateProspectTransition(from: string, to: string): { valid: boolean; reason?: string } {
  const allowed = PROSPECT_TRANSITIONS[from];
  if (!allowed) return { valid: false, reason: `Unknown prospect stage: ${from}` };
  if (!allowed.includes(to)) {
    return { valid: false, reason: `Cannot transition prospect from ${from} → ${to}. Allowed: [${allowed.join(", ")}]` };
  }
  return { valid: true };
}

export function validateMatterTransition(from: string, to: string): { valid: boolean; reason?: string } {
  const allowed = MATTER_TRANSITIONS[from];
  if (!allowed) return { valid: false, reason: `Unknown matter stage: ${from}` };
  if (!allowed.includes(to)) {
    return { valid: false, reason: `Cannot transition matter from ${from} → ${to}. Allowed: [${allowed.join(", ")}]` };
  }
  return { valid: true };
}

// ---- Prospect status derivation from stage ----
export function deriveProspectStatus(stage: string): string {
  switch (stage) {
    case "INTAKE_CREATED":
    case "RESEARCH_RUNNING":
    case "RESEARCH_COMPLETE":
    case "CALL_COMPLETE":
      return "PROSPECT";
    case "QUALIFIED":
      return "QUALIFIED";
    case "NEEDS_REVIEW":
      return "NEEDS_REVIEW";
    case "CONVERTED":
      return "CONVERTED";
    case "CLOSED_NQ":
      return "CLOSED_NQ";
    case "CLOSED_LOST":
      return "CLOSED_LOST";
    default:
      throw new Error(`Cannot derive status for unknown stage: ${stage}`);
  }
}

// ---- Carrier normalization ----
const CARRIER_ALIASES: Record<string, string> = {
  "state farm":       "STATE_FARM",
  "statefarm":        "STATE_FARM",
  "geico":            "GEICO",
  "progressive":      "PROGRESSIVE",
  "allstate":         "ALLSTATE",
  "usaa":             "USAA",
  "liberty mutual":   "LIBERTY_MUTUAL",
  "libertymutual":    "LIBERTY_MUTUAL",
  "nationwide":       "NATIONWIDE",
  "farmers":          "FARMERS",
  "travelers":        "TRAVELERS",
  "erie":             "ERIE",
  "american family":  "AMERICAN_FAMILY",
  "amfam":            "AMERICAN_FAMILY",
  "pemco":            "PEMCO",
  "safeco":           "SAFECO",
  "hartford":         "HARTFORD",
  "the hartford":     "HARTFORD",
  "mercury":          "MERCURY",
  "esurance":         "ESURANCE",
  "root":             "ROOT",
  "metlife":          "METLIFE",
  "amica":            "AMICA",
};

export function normalizeCarrier(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
  return CARRIER_ALIASES[key] ?? raw.trim().toUpperCase().replace(/\s+/g, "_");
}

// ---- Phone normalization ----
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

// ---- Email normalization ----
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ---- Date formatting ----
export function toDateStr(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().slice(0, 10);
}

// ---- MasterCaseID formatting ----
export function formatMasterCaseId(num: number): string {
  return String(num).padStart(6, "0");
}

// ---- Matter ID construction ----
export function buildMatterId(args: {
  masterCaseId: number;
  year: number;
  division: string;
  role: string;
  lastName: string;
  carrier: string;
}): string {
  const mcid = formatMasterCaseId(args.masterCaseId);
  const yy = String(args.year).slice(-2);
  return `${mcid}_${yy}-${args.division}-${args.role}_${args.lastName}_${args.carrier}`;
}

// ---- Prospect ID construction ----
export function buildProspectId(args: {
  year: number;
  seq: number;
  lastName: string;
  carrier: string;
}): string {
  const yy = String(args.year).slice(-2);
  const seq = String(args.seq).padStart(3, "0");
  return `P-${yy}-${seq}_${args.lastName}_${args.carrier}`;
}

// ---- Default integration status ----
export function defaultIntegrationStatus() {
  return {
    gdrive: "PENDING" as const,
    registry: "PENDING" as const,
    workbench: "PENDING" as const,
    telegram: "PENDING" as const,
  };
}

// ---- Role validation ----
const VALID_ROLES = ["DV", "AC", "UMP", "EXP", "CON", "LIT", "OTH"] as const;
export type Role = typeof VALID_ROLES[number];

export function validateRole(role: string, othDescription?: string): { valid: boolean; reason?: string } {
  if (!VALID_ROLES.includes(role as Role)) {
    return { valid: false, reason: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}` };
  }
  if (role === "OTH" && (!othDescription || othDescription.trim().length === 0)) {
    return { valid: false, reason: "Role OTH requires a written description. Never use OTH as a default." };
  }
  return { valid: true };
}
