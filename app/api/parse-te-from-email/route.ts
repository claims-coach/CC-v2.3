/**
 * POST /api/parse-te-from-email
 * Reads recent Gmail emails, matches to cases, suggests T&E entries.
 * Body: { caseId?, lookbackDays? }
 */
import { NextRequest, NextResponse } from "next/server";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

const G_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || "";
const G_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const G_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";

async function getGoogleToken(): Promise<string | null> {
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: G_CLIENT_ID, client_secret: G_CLIENT_SECRET, refresh_token: G_REFRESH_TOKEN, grant_type: "refresh_token" }),
    });
    const d = await r.json();
    return d.access_token || null;
  } catch { return null; }
}

async function fetchRecentEmails(token: string, query: string, maxResults = 20): Promise<any[]> {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  const messages = d.messages || [];

  const full = await Promise.all(messages.slice(0, 10).map(async (m: any) => {
    const mr = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const md = await mr.json();
    const headers = md.payload?.headers || [];
    const get = (n: string) => headers.find((h: any) => h.name === n)?.value || "";
    return {
      id: m.id,
      subject: get("Subject"),
      from: get("From"),
      date: get("Date"),
      snippet: md.snippet || "",
    };
  }));
  return full;
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, lookbackDays = 7, caseList = [] } = await req.json();
    const token = await getGoogleToken();
    if (!token) return NextResponse.json({ error: "Gmail not authorized" }, { status: 500 });

    // Build Gmail search query
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - lookbackDays);
    const after = Math.floor(daysAgo.getTime() / 1000);
    let gmailQuery = `to:me after:${after} -label:spam`;
    if (caseId) {
      // Extract last name from caseId e.g. "000421_26-AUTO-AC_Movsky_StateFarm" → "Movsky"
      const parts = caseId.split("_");
      if (parts.length >= 3) gmailQuery += ` ${parts[parts.length - 2]}`;
    }

    const emails = await fetchRecentEmails(token, gmailQuery, 20);
    if (!emails.length) return NextResponse.json({ suggestions: [] });

    // Ask Claude to parse T&E suggestions
    const emailSummary = emails.map((e, i) =>
      `[${i + 1}] Date: ${e.date}\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`
    ).join("\n\n");

    const caseContext = caseId
      ? `Focus on case: ${caseId}`
      : caseList.length
        ? `Known cases: ${caseList.slice(0, 20).join(", ")}`
        : "Match to any claims/legal/appraisal work";

    const prompt = `You are a legal billing assistant for Claims.Coach, a public adjusting firm.

${caseContext}

Review these recent emails and suggest Time & Expense entries for any that involve billable work.

Emails:
${emailSummary}

Return a JSON array only — no other text. Each object:
{
  "emailIndex": <number>,
  "emailSubject": "<subject>",
  "emailDate": "<YYYY-MM-DD>",
  "emailFrom": "<sender>",
  "caseId": "<matched case ID or best guess>",
  "type": "time" or "expense",
  "category": "<Review|Correspondence|Research|Report|Inspection|Deposition|Travel|Mileage|Filing Fee|Other>",
  "description": "<specific description, 1-2 sentences>",
  "hours": <number 0.1 increments, time only>,
  "amount": <number USD, expense only>,
  "billable": true,
  "confidence": "high" | "medium" | "low"
}
Only billable professional activity. Skip personal/marketing. If none, return [].`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    const aiData = await aiRes.json();
    const raw = aiData.content?.[0]?.text || "";
    let suggestions = [];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch { suggestions = []; }

    return NextResponse.json({ suggestions, emailsScanned: emails.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
