/**
 * lib/drive.ts — Google Drive filing into Claims Coach Shared Drive
 *
 * Shared Drive: "Claims Coach" (0APRcBs2pWovZUk9PVA)
 * Folder naming: [TYPE] [ClientName] [Vehicle]
 *   AC = Appraisal Clause, DV = Diminished Value, EW = Expert Witness, PA = Public Adjuster
 *
 * All documents auto-file into the matching client folder.
 * If no folder exists, one is created.
 */

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";
const SHARED_DRIVE  = "0APRcBs2pWovZUk9PVA"; // Claims Coach Shared Drive
const BASE          = "https://www.googleapis.com/drive/v3";

// Shared Drive requires these params on every request
const SDP = "supportsAllDrives=true&includeItemsFromAllDrives=true";

async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN, grant_type: "refresh_token" }),
    });
    const d = await r.json();
    return d.access_token || null;
  } catch { return null; }
}

/** Find a folder by name inside a parent (searches Shared Drive) */
async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const r = await fetch(
    `${BASE}/files?q=${q}&${SDP}&fields=files(id,name)&pageSize=5&driveId=${SHARED_DRIVE}&corpora=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  return d.files?.[0]?.id || null;
}

/** Find or create a folder inside a parent */
async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const existing = await findFolder(token, name, parentId);
  if (existing) return existing;
  const r = await fetch(`${BASE}/files?${SDP}&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId], driveId: SHARED_DRIVE }),
  });
  const d = await r.json();
  return d.id;
}

/**
 * Get or create case folder using Case Management System schema.
 * New cases: [MasterCaseID]_[YY]-[DIV]-[ROLE]_[LastName]_[Carrier]
 *   e.g. 000421_26-AUTO-AC_Movsky_StateFarm
 * Falls back to matching existing old-format folders by client name.
 *
 * @param caseId - full case ID e.g. "000421_26-AUTO-AC_Movsky_StateFarm" (or null for new)
 * @param role   - "AC" | "DV" | "EW" | "UMP" | "PA" etc.
 * @param clientName - full name
 * @param carrier - carrier name
 * @param subFolder - subfolder within case e.g. "03_VALUATION_ANALYSIS"
 */
async function getCaseFolder(
  token: string,
  caseId: string | null,
  role: string,
  clientName: string,
  carrier?: string,
  subFolder?: string,
): Promise<string> {
  // List all top-level folders in shared drive
  const q = encodeURIComponent(`'${SHARED_DRIVE}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`);
  const r = await fetch(
    `${BASE}/files?q=${q}&${SDP}&fields=files(id,name)&pageSize=100&driveId=${SHARED_DRIVE}&corpora=drive&orderBy=name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { files = [] } = await r.json();

  let caseFolder: string | null = null;

  if (caseId) {
    // New schema — look for exact match first
    const exact = files.find((f: any) => f.name === caseId);
    if (exact) {
      caseFolder = exact.id;
    } else {
      // Create new folder with full 8-subfolder structure
      caseFolder = await findOrCreateFolder(token, caseId, SHARED_DRIVE);
      // Create standard subfolder structure
      const subFolders = [
        "01_POLICY_AND_CLAIM",
        "02_DAMAGE_AND_SCOPE",
        "03_VALUATION_ANALYSIS",
        "04_COMMUNICATIONS",
        "05_PROCESS_RECORD",
        "06_DEMAND_OR_AWARD",
        "07_SETTLEMENT",
        "08_INTERNAL_NOTES",
      ];
      await Promise.all(subFolders.map(sf => findOrCreateFolder(token, sf, caseFolder!)));
      // Create EMAILS subfolder inside 04_COMMUNICATIONS
      const commsFolder = await findOrCreateFolder(token, "04_COMMUNICATIONS", caseFolder);
      await findOrCreateFolder(token, "EMAILS", commsFolder);
    }
  } else {
    // No caseId — fuzzy match on client name (legacy support)
    const lastName  = clientName.split(" ").pop()?.toLowerCase() || "";
    const firstName = clientName.split(" ")[0]?.toLowerCase() || "";
    const match = files.find((f: any) => {
      const n = f.name.toLowerCase();
      return n.includes(lastName) && (n.includes(firstName) || n.includes(role.toLowerCase()));
    });
    if (match) {
      caseFolder = match.id;
    } else {
      // Create with new schema format — generate a placeholder name
      const year = new Date().getFullYear().toString().slice(-2);
      const last = clientName.split(" ").pop() || "Client";
      const car  = (carrier || "Unknown").replace(/s+/g, "");
      const folderName = `NEW_${year}-AUTO-${role}_${last}_${car}`;
      caseFolder = await findOrCreateFolder(token, folderName, SHARED_DRIVE);
    }
  }

  if (!subFolder) return caseFolder!;

  // Get the specific subfolder
  return findOrCreateFolder(token, subFolder, caseFolder!);
}

/** Upload a file to a folder in the Shared Drive */
async function uploadFile(
  token: string,
  folderId: string,
  fileName: string,
  content: Buffer | Uint8Array,
  mimeType = "application/pdf"
): Promise<string | null> {
  try {
    const boundary = "gc_boundary_" + Date.now();
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      Buffer.from(content),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const r = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&${SDP}&fields=id,webViewLink`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      }
    );
    const d = await r.json();
    return d.webViewLink || (d.id ? `https://drive.google.com/file/d/${d.id}/view` : null);
  } catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

const date = () => new Date().toISOString().split("T")[0];

export async function saveReportToDrive(pdfBytes: Uint8Array, caseId: string, clientName: string, vehicle?: string, carrier?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const folder = await getCaseFolder(token, caseId || null, "AC", clientName, carrier, "03_VALUATION_ANALYSIS");
  return uploadFile(token, folder, `${caseId || "DRAFT"}_ACV_Report_${date()}.pdf`, pdfBytes);
}

export async function saveBundleToDrive(pdfBytes: Uint8Array, caseId: string, clientName: string, vehicle?: string, carrier?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const folder = await getCaseFolder(token, caseId || null, "AC", clientName, carrier, "06_DEMAND_OR_AWARD");
  return uploadFile(token, folder, `${caseId || "DRAFT"}_ACV_Bundle_${date()}.pdf`, pdfBytes);
}

export async function saveAwardToDrive(pdfBytes: Uint8Array, caseId: string, clientName: string, vehicle?: string, carrier?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const folder = await getCaseFolder(token, caseId || null, "AC", clientName, carrier, "06_DEMAND_OR_AWARD");
  return uploadFile(token, folder, `${caseId || "DRAFT"}_ACV_Award_${date()}.pdf`, pdfBytes);
}

export async function saveDemandToDrive(content: string, caseId: string, clientName: string, carrier?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const folder = await getCaseFolder(token, caseId || null, "DV", clientName, carrier, "06_DEMAND_OR_AWARD");
  return uploadFile(token, folder, `${caseId || "DRAFT"}_Demand_${date()}.txt`, Buffer.from(content, "utf8"), "text/plain");
}

export async function saveCommsToDrive(emailBody: string, textBody: string, caseId: string, clientName: string, carrier?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const folder = await getCaseFolder(token, caseId || null, "AC", clientName, carrier, "04_COMMUNICATIONS");
  const content = `CLIENT COMMUNICATION — ${date()}\nCase: ${caseId}\nClient: ${clientName}\n\n--- EMAIL ---\n${emailBody}\n\n--- TEXT MESSAGE ---\n${textBody}`;
  return uploadFile(token, folder, `${caseId || "DRAFT"}_Comms_${date()}.txt`, Buffer.from(content, "utf8"), "text/plain");
}

export async function saveWorkbenchToDrive(state: any, caseId: string, clientName: string, vehicle?: string, carrier?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const folder = await getCaseFolder(token, caseId || null, "AC", clientName, carrier, "03_VALUATION_ANALYSIS");
  const ts = new Date().toISOString().replace("T","_").slice(0,16).replace(":","h");
  return uploadFile(token, folder, `${caseId || "DRAFT"}_Workbench_${ts}.json`, Buffer.from(JSON.stringify(state, null, 2), "utf8"), "application/json");
}

export async function saveRecordingToDrive(transcript: string, title: string, category: string, clientName?: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const docsFolder = await findOrCreateFolder(token, "_Documents", SHARED_DRIVE);
  const catMap: Record<string, string> = {
    claims_coach: "Claims.Coach", walker_appraisal: "Walker Appraisal",
    mas_solutions: "MA Solutions", reca: "RECA", personal: "Personal", church: "Church", uncategorized: "Claims.Coach",
  };
  const catFolder = await findOrCreateFolder(token, catMap[category] || "Claims.Coach", docsFolder);
  const content = `RECORDING\nTitle: ${title}\nDate: ${date()}\nClient: ${clientName || "—"}\n\n${transcript}`;
  const safe = (title || "recording").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 50);
  return uploadFile(token, catFolder, `${date()}_${safe}.txt`, Buffer.from(content, "utf8"), "text/plain");
}

export async function driveHealthCheck(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const r = await fetch(`https://www.googleapis.com/drive/v3/drives/${SHARED_DRIVE}?${SDP}`, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok;
  } catch { return false; }
}
