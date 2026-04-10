import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const DRIVE_CASES_FOLDER = "1qx0S0rG7yjsJXP540fCvIFP4-BdjiwtO"; // Cases root folder
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN; // cc@claims.coach (Drive)

const SUBFOLDERS = [
  "01_INTAKE",
  "02_VALUATIONS",
  "03_REPORTS",
  "04_COMMUNICATIONS",
  "05_EXHIBITS",
  "06_SETTLEMENT",
  "07_TIMEKEEPING",
  "08_ARCHIVE",
];

/**
 * Create case folder structure in Google Drive
 * Fire-and-forget from case creation mutation
 */
export const createCaseFolder = internalAction({
  args: {
    caseId: v.string(),
    caseKey: v.string(),
    clientName: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get access token
      const token = await getAccessToken();
      if (!token) {
        console.error("No Drive auth token available");
        return;
      }

      // 1. Create main case folder
      const folderMeta = {
        name: args.caseKey,
        mimeType: "application/vnd.google-apps.folder",
        parents: [DRIVE_CASES_FOLDER],
      };

      const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderMeta),
      });

      const folderData = await folderRes.json();
      const caseFolder = folderData.id;

      if (!caseFolder) {
        console.error("Failed to create case folder:", folderData);
        return;
      }

      // 2. Create 8 subfolders
      for (const subfolder of SUBFOLDERS) {
        const subRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: subfolder,
            mimeType: "application/vnd.google-apps.folder",
            parents: [caseFolder],
          }),
        });
        const subData = await subRes.json();
        if (!subData.id) {
          console.error(`Failed to create subfolder ${subfolder}:`, subData);
        }
      }

      // 3. Create CASE_ACTIVITY_LOG.md
      const logContent = `# ${args.caseKey} — Case Activity Log

**Client:** ${args.clientName}
**Created:** ${new Date().toISOString().split("T")[0]}

## Timeline

| Date | Stage | Action | Notes |
|------|-------|--------|-------|
|  |  |  |  |
`;

      await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "CASE_ACTIVITY_LOG.md",
          mimeType: "text/markdown",
          parents: [caseFolder],
        }),
      });

      // 4. Update case record with folder ID
      const { ConvexHttpClient } = require("convex/browser");
      const client = new ConvexHttpClient("https://calm-warbler-536.convex.cloud");
      await client.mutation("caseRegistry:update", {
        id: args.caseId,
        driveFolder: caseFolder,
      });

      console.log(`✅ Created case folder: ${args.caseKey} → ${caseFolder}`);
    } catch (e) {
      console.error("Drive folder creation failed:", e);
      // Fire-and-forget — don't throw
    }
  },
});

/**
 * Get Google Drive access token using refresh token
 */
async function getAccessToken(): Promise<string | null> {
  if (!GOOGLE_REFRESH_TOKEN) {
    console.error("GOOGLE_REFRESH_TOKEN not set");
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID || "",
        client_secret: GOOGLE_CLIENT_SECRET || "",
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }).toString(),
    });

    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error("Failed to get Drive access token:", e);
    return null;
  }
}
