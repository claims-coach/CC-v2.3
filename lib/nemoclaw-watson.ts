/**
 * NemoClaw Agent Configuration
 * Defines how Watson handles browser tab pages
 */

export const NEMOCLAW_AGENTS = {
  watson: {
    name: "Watson",
    action: "Extract vehicle comp data",
    endpoint: "/api/watson-nemoclaw",
    inputTypes: ["AutoTrader", "CarGurus", "Edmunds", "Facebook Marketplace", "Craigslist"],
    outputTypes: ["JSON comp data", "PDF bundle", "Drive filing"],
    instructions: `
1. User finds comp listing (AutoTrader/CarGurus/etc)
2. Click NemoClaw toolbar → Select "Watson"
3. Watson extracts: VIN, price, mileage, condition, location, photo notes
4. Returns structured JSON + working link confirmation
5. Optionally generates PDF + files to Drive [caseId]
    `,
  },
  
  gbpAuditor: {
    name: "GBP Auditor",
    action: "Extract competitor GBP data",
    endpoint: "/api/gbp-audit",
    inputTypes: ["Google Business Profile", "Google Maps listing"],
    outputTypes: ["JSON attributes", "Spreadsheet row", "Photo capture"],
    instructions: `
1. User searches competitor GBP on Google Maps
2. Click NemoClaw toolbar → Select "GBP Auditor"
3. Extracts: categories, attributes, reviews, photos, ratings
4. Feeds into GBP audit spreadsheet (Prompt 1-8)
    `,
  },

  caseIntake: {
    name: "Case Intake",
    action: "File page to case folder",
    endpoint: "/api/case-intake-nemoclaw",
    inputTypes: ["Repair estimates", "Insurance letters", "Vehicle listings", "Any document page"],
    outputTypes: ["Drive filing", "Convex case update"],
    instructions: `
1. User finds document related to a case (estimate, insurance letter, vehicle photo)
2. Click NemoClaw toolbar → Select "Case Intake"
3. Prompt for caseId (or auto-detect from URL)
4. Extracts data (if applicable), saves to Drive
5. Updates case record in Convex
    `,
  },

  blogResearcher: {
    name: "Blog Researcher",
    action: "Research for blog post",
    endpoint: "/api/blog-research-nemoclaw",
    inputTypes: ["Articles", "News pages", "Case law websites", "Insurance resources"],
    outputTypes: ["Blog outline", "Key points", "Source citations"],
    instructions: `
1. User finds article relevant to blog topic (appraisal clause, DV, total loss, etc)
2. Click NemoClaw toolbar → Select "Blog Researcher"
3. Agent extracts key points, statistics, citations
4. Builds blog outline with source references
5. CC writes blog, auto-posts
    `,
  },
};

export const NEMOCLAW_SETUP = {
  extensionName: "NemoClaw",
  version: "1.0",
  installUrl: "https://chrome.google.com/webstore/detail/nemoclaw",
  triggerButton: "NemoClaw toolbar icon (top right)",
  workflows: {
    compResearch: "Watson",
    gbpAudit: "GBP Auditor",
    caseFileIngest: "Case Intake",
    contentResearch: "Blog Researcher",
  },
  benefits: [
    "✅ Real comp links (no hallucinations)",
    "✅ Actual GBP data (no manual screenshots)",
    "✅ Auto-filing (no copy/paste)",
    "✅ Source attribution (for blogs)",
  ],
};
