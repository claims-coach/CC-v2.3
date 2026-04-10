#!/usr/bin/env node

/**
 * plaud-sync.mjs — Continuous Plaud recording sync
 * 
 * Fetches Plaud AutoFlow emails (voice meeting transcripts) from Gmail,
 * classifies claims-related recordings, matches to cases, and ingests into
 * Mission Control via Convex HTTP API.
 * 
 * Runs every 30 minutes via cron.
 */

import { getOAuth2Client } from "./oauth-helper.mjs";
import Anthropic from "@anthropic-ai/sdk";

const CONVEX_URL = process.env.CONVEX_URL || "https://agreeable-goose-357.convex.cloud";
const PLAUD_SENDER = "notifications@plaud.ai";
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

const anthropic = new Anthropic();

/**
 * Call Convex HTTP API
 */
async function callConvex(functionName, args) {
  const url = `${CONVEX_URL}/api/query`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: functionName,
      args: args || {},
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Convex API error: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Call Convex mutation
 */
async function callConvexMutation(functionName, args) {
  const url = `${CONVEX_URL}/api/mutation`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: functionName,
      args: args || {},
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Convex mutation error: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Fetch Plaud AutoFlow emails from Gmail since last sync
 */
async function fetchPlaudEmails() {
  const oauth2Client = await getOAuth2Client();

  const { google } = await import("googleapis");
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Query: from Plaud in last 2 days (covers multiple 30-min runs)
  const query = `from:${PLAUD_SENDER} newer_than:2d`;

  let emails = [];
  let pageToken = null;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        pageToken,
        maxResults: 20,
      });

      if (!res.data.messages) break;

      for (const msg of res.data.messages) {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        const headers = fullMsg.data.payload.headers || [];
        const subject =
          headers.find((h) => h.name === "Subject")?.value || "Untitled";
        const body = fullMsg.data.snippet || "";

        emails.push({
          id: msg.id,
          subject,
          body,
          timestamp: new Date(parseInt(fullMsg.data.internalDate)),
        });
      }

      pageToken = res.data.nextPageToken;
      hasMore = !!pageToken;
    } catch (err) {
      console.error("❌ Gmail fetch error:", err.message);
      break;
    }
  }

  return emails;
}

/**
 * Classify email as claims-related using Claude
 */
async function classifyEmail(email) {
  const prompt = `You are a claims expert. Analyze this Plaud meeting transcript email and determine:
1. Is it claims-related? (claims case, vehicle, damage, etc.)
2. What type of claim? (ACV, DV, Loss of Use, etc.)
3. Extract any vehicle/damage/claimant details if present

Email Subject: ${email.subject}
Email Body: ${email.body.substring(0, 500)}

Respond ONLY with valid JSON:
{
  "isClaims": boolean,
  "claimType": "ACV|DV|LOU|Expert Witness|Other",
  "keywords": ["keyword1", "keyword2"],
  "confidence": 0.0-1.0,
  "extracted": { "vehicle": "", "claimant": "", "damage": "" }
}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const content =
      msg.content[0].type === "text" ? msg.content[0].text : "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ Classification error:", err.message);
    return {
      isClaims: false,
      confidence: 0,
      keywords: [],
      extracted: { vehicle: "", claimant: "", damage: "" },
    };
  }
}

/**
 * Match recording to existing case
 */
async function matchToCase(classification) {
  if (!classification.isClaims || classification.confidence < 0.6) {
    return null;
  }

  try {
    // Query all cases
    const cases = await callConvex("cases:list");
    
    if (!Array.isArray(cases)) {
      console.warn("⚠️ Unexpected cases response:", typeof cases);
      return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const caseRecord of cases) {
      let score = 0;

      // Match on extracted vehicle
      if (
        classification.extracted?.vehicle &&
        caseRecord.vehicle?.toLowerCase?.() ===
          classification.extracted.vehicle.toLowerCase()
      ) {
        score += 0.5;
      }

      // Match on keywords
      if (classification.keywords && caseRecord.notes) {
        const caseText = (caseRecord.notes + " " + (caseRecord.vehicle || "")).toLowerCase();
        for (const keyword of classification.keywords) {
          if (caseText.includes(keyword.toLowerCase())) {
            score += 0.25;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = caseRecord;
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  } catch (err) {
    console.error("❌ Case matching error:", err.message);
    return null;
  }
}

/**
 * Ingest recording into Mission Control
 */
async function ingestRecording(email, classification, matchedCase) {
  try {
    // Prepare tags
    const tags = [
      classification.isClaims ? "claims" : "non-claims",
      classification.claimType,
      "plaud",
    ].filter(Boolean);

    // Create recording entry via Convex
    const result = await callConvexMutation("recordings:ingest", {
      source: "plaud",
      externalId: email.id, // Prevent duplicates
      title: email.subject,
      transcript: email.body,
      clientName: matchedCase?.clientName || undefined,
      claimId: matchedCase?.masterCaseId || undefined,
      tags: tags,
      category: classification.isClaims ? classification.claimType : "general",
      recordedAt: email.timestamp.getTime(),
    });

    return result;
  } catch (err) {
    console.error("❌ Ingest error:", err.message);
    throw err;
  }
}

/**
 * Main sync loop with retry logic
 */
async function syncPlaudRecordings() {
  console.log(`⏱️ Plaud sync started — ${new Date().toISOString()}`);

  try {
    // 1. Fetch emails
    console.log("📧 Fetching Plaud emails...");
    const emails = await fetchPlaudEmails();
    console.log(`Found ${emails.length} emails`);

    if (emails.length === 0) {
      console.log("✅ No new emails — sync complete");
      return;
    }

    // 2. Process in batches
    let processed = 0;
    let ingested = 0;

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);

      for (const email of batch) {
        let retries = 0;

        while (retries < MAX_RETRIES) {
          try {
            // Classify
            const classification = await classifyEmail(email);

            // Match to case
            const matchedCase = classification.isClaims
              ? await matchToCase(classification)
              : null;

            // Ingest
            const recordingId = await ingestRecording(email, classification, matchedCase);

            if (recordingId) {
              console.log(
                `✅ Ingested: ${email.subject.substring(0, 50)}... ${
                  matchedCase ? `→ ${matchedCase.masterCaseId}` : "(unlinked)"
                }`
              );
              ingested++;
            }

            processed++;
            break;
          } catch (err) {
            retries++;
            if (retries < MAX_RETRIES) {
              console.warn(
                `⚠️ Retry ${retries}/${MAX_RETRIES} for: ${email.subject.substring(0, 50)}`
              );
              await new Promise((r) => setTimeout(r, 2000 * retries)); // Exponential backoff
            } else {
              console.error(
                `❌ Max retries exceeded for: ${email.subject.substring(0, 50)}`
              );
              processed++;
            }
          }
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < emails.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 3. Summary
    console.log(`\n✅ Plaud sync complete:`);
    console.log(`   ${processed}/${emails.length} emails processed`);
    console.log(`   ${ingested} recordings ingested`);
  } catch (err) {
    console.error("❌ Plaud sync failed:", err.message);
    process.exit(1);
  }
}

// Run
syncPlaudRecordings()
  .then(() => {
    console.log("✅ Plaud sync completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Plaud sync crashed:", err.message);
    process.exit(1);
  });
