/**
 * POST /api/ingest-gemini-notes
 * Polls Gmail for emails from gemini-notes@google.com (and Plaud summary emails),
 * extracts notes/transcripts, matches to a contact, and:
 *   1. Saves to GHL contact notes
 *   2. Saves transcript to Convex recordings (same as Plaud)
 *   3. Files to Google Drive in the matched case folder
 *
 * Can be called manually or via cron.
 * Body: { lookbackHours? = 24, dryRun? = false }
 */
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY!;
const GHL_KEY         = process.env.GHL_API_KEY!;
const GHL_LOC         = process.env.GHL_LOCATION_ID!;
const G_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!;
const G_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const G_REFRESH       = (process.env.GOOGLE_REFRESH_TOKEN || "").trim();
const J_REFRESH       = (process.env.JOHNNY_GMAIL_REFRESH_TOKEN || "").trim();
const SHARED_DRIVE    = "0APRcBs2pWovZUk9PVA";
const CONVEX_URL      = "https://calm-warbler-536.convex.cloud";

// ── Google auth ───────────────────────────────────────────────────────────────
async function getGoogleToken(refresh = G_REFRESH): Promise<string | null> {
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: G_CLIENT_ID, client_secret: G_CLIENT_SECRET, refresh_token: refresh, grant_type: "refresh_token" }),
    });
    const d = await r.json();
    return d.access_token || null;
  } catch { return null; }
}

// ── Fetch emails from Gmail ───────────────────────────────────────────────────
async function fetchGmailMessages(token: string, query: string, max = 10): Promise<any[]> {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (!d.messages?.length) return [];

  const full = await Promise.all(d.messages.slice(0, max).map(async (m: any) => {
    const mr = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return mr.json();
  }));
  return full.filter(Boolean);
}

// ── Extract text from email parts ─────────────────────────────────────────────
function extractEmailBody(payload: any): { text: string; attachments: any[] } {
  let text = "";
  const attachments: any[] = [];

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64url").toString("utf8") + "\n";
    }
    if (part.mimeType === "text/html" && part.body?.data && !text) {
      const html = Buffer.from(part.body.data, "base64url").toString("utf8");
      text += html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() + "\n";
    }
    if (part.filename && part.body?.attachmentId) {
      attachments.push({ filename: part.filename, attachmentId: part.body.attachmentId, mimeType: part.mimeType });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return { text: text.trim(), attachments };
}

// ── Match contact in GHL by name/email/phone ──────────────────────────────────
async function findGhlContact(query: string): Promise<any | null> {
  const r = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOC}&query=${encodeURIComponent(query)}&limit=3`,
    { headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-07-28" } }
  );
  const d = await r.json();
  return d.contacts?.[0] || null;
}

// ── Add note to GHL contact ───────────────────────────────────────────────────
async function addGhlNote(contactId: string, body: string): Promise<void> {
  await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GHL_KEY}`, "Content-Type": "application/json", Version: "2021-07-28" },
    body: JSON.stringify({ body }),
  });
}

// ── Save to Convex recordings ─────────────────────────────────────────────────
async function saveToConvex(data: {
  source: string; title: string; transcript: string; summary?: string;
  clientName?: string; claimId?: string; tags: string[];
}): Promise<void> {
  await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "recordings:ingest", args: data, format: "json" }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

// ── Upload text file to Drive ─────────────────────────────────────────────────
async function saveToDrive(token: string, folderId: string, fileName: string, content: string): Promise<string | null> {
  const boundary = "note_boundary_" + Date.now();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
  );
  const d = await r.json();
  return d.webViewLink || null;
}

// ── Find Drive case folder by contact/name ────────────────────────────────────
async function findDriveFolder(token: string, lastName: string): Promise<string | null> {
  const q = encodeURIComponent(`'${SHARED_DRIVE}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and name contains '${lastName}'`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&driveId=${SHARED_DRIVE}&corpora=drive&fields=files(id,name)&pageSize=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  return d.files?.[0]?.id || null;
}

// ── Use Claude to parse the note ──────────────────────────────────────────────
async function parseNote(emailBody: string, subject: string): Promise<{
  clientName: string; summary: string; keyPoints: string[]; category: string;
}> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Extract structured info from this meeting/call note. Return JSON only.

Subject: ${subject}
Body: ${emailBody.slice(0, 3000)}

Return:
{
  "clientName": "<full name of client/contact mentioned, or empty string>",
  "summary": "<2-3 sentence summary of the note>",
  "keyPoints": ["<key point 1>", "<key point 2>", ...],
  "category": "<claims_coach|walker_appraisal|mas_solutions|reca|personal|church|uncategorized>"
}`
      }],
    }),
  });
  const d = await r.json();
  const text = d.content?.[0]?.text || "{}";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { clientName: "", summary: text.slice(0, 200), keyPoints: [], category: "uncategorized" };
  } catch {
    return { clientName: "", summary: text.slice(0, 200), keyPoints: [], category: "uncategorized" };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { lookbackHours = 24, dryRun = false } = await req.json().catch(() => ({}));

  // Gmail ONLY: johnny@claims.coach (has gmail.readonly scope)
  // Drive ONLY: cc@claims.coach (has drive scope)
  console.log("[ingest] J_REFRESH length:", J_REFRESH.length, "G_REFRESH length:", G_REFRESH.length);
  const jToken     = J_REFRESH ? await getGoogleToken(J_REFRESH) : null;
  const gToken     = await getGoogleToken(G_REFRESH);
  console.log("[ingest] jToken:", !!jToken, "gToken:", !!gToken);
  const driveToken = gToken; // Drive writes use cc@claims.coach
  const tokens     = jToken ? [jToken] : []; // Gmail reads use johnny only
  if (!tokens.length) return NextResponse.json({ error: "Google auth failed — JOHNNY_GMAIL_REFRESH_TOKEN missing or invalid", debug: { jRefreshLen: J_REFRESH.length, jTokenOk: !!jToken } }, { status: 500 });

  const hoursAgo = Math.floor(Date.now() / 1000) - lookbackHours * 3600;

  // Search for Gemini Notes AND Plaud summary emails
  const queries = [
    `from:gemini-notes@google.com after:${hoursAgo}`,
    `from:noreply@plaud.ai after:${hoursAgo} subject:summary`,
    `from:plaud.ai after:${hoursAgo}`,
  ];

  const results: any[] = [];

  for (const token of tokens) {
   for (const q of queries) {
    let messages: any[];
    try {
      messages = await fetchGmailMessages(token, q, 10);
    } catch (e: any) {
      continue;
    }

    for (const msg of messages) {
      const headers = msg.payload?.headers || [];
      const get = (n: string) => headers.find((h: any) => h.name === n)?.value || "";
      const subject = get("Subject");
      const date    = get("Date");
      const msgId   = msg.id;

      const { text: body, attachments } = extractEmailBody(msg.payload);
      if (!body && !attachments.length) continue;

      // Parse with Claude
      const parsed = await parseNote(body, subject);

      // Try to find GHL contact
      let contact: any = null;
      if (parsed.clientName) {
        contact = await findGhlContact(parsed.clientName);
        // Fallback: search by last name
        if (!contact) {
          const lastName = parsed.clientName.split(" ").pop() || "";
          if (lastName) contact = await findGhlContact(lastName);
        }
      }

      const noteBody = [
        `📝 ${subject}`,
        `Date: ${date}`,
        `\nSummary: ${parsed.summary}`,
        parsed.keyPoints.length ? `\nKey Points:\n${parsed.keyPoints.map(k => `• ${k}`).join("\n")}` : "",
        `\nFull Notes:\n${body.slice(0, 3000)}`,
      ].filter(Boolean).join("\n");

      if (!dryRun) {
        // 1. Save to GHL contact notes
        if (contact?.id) {
          await addGhlNote(contact.id, noteBody);
        }

        // 2. Save to Convex recordings
        await saveToConvex({
          source: q.includes("gemini-notes") ? "manual" : "plaud",
          title: subject,
          transcript: body,
          summary: parsed.summary,
          clientName: parsed.clientName || contact?.firstName + " " + contact?.lastName || undefined,
          tags: [parsed.category, q.includes("gemini") ? "gemini" : "plaud"],
        });

        // 3. Save to Drive (only if driveToken available)
        const lastName = (parsed.clientName || contact?.lastName || "").split(" ").pop() || "";
        let driveUrl: string | null = null;
        if (lastName && driveToken) {
          const folderId = await findDriveFolder(driveToken, lastName);
          if (folderId) {
            const safeName = subject.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 60);
            const dateStr  = new Date().toISOString().split("T")[0];
            driveUrl = await saveToDrive(driveToken!, folderId, `${dateStr}_${safeName}.txt`, noteBody);
          }
        }

        results.push({
          subject, date,
          clientName: parsed.clientName,
          contactFound: !!contact,
          contactId: contact?.id,
          category: parsed.category,
          driveUrl,
          ghlNoteAdded: !!contact,
          convexSaved: true,
        });
      } else {
        results.push({ subject, date, clientName: parsed.clientName, contactFound: !!contact, category: parsed.category, dryRun: true });
      }
    }
   } // end queries loop
  } // end tokens loop

  return NextResponse.json({ ok: true, processed: results.length, results });
}

function getAuthUrl(): string {
  const scopes = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar";
  return `https://accounts.google.com/o/oauth2/auth?client_id=${G_CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost&scope=${encodeURIComponent(scopes)}&response_type=code&access_type=offline&prompt=consent`;
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "POST /api/ingest-gemini-notes", params: { lookbackHours: "number (default 24)", dryRun: "boolean" } });
}
