#!/usr/bin/env node

/**
 * Gemini Notes Sync
 * Fetches voice notes from Gemini Notebooknotes (via Gmail),
 * parses claim details, and ingests into Mission Control recordings table
 */

import { getOAuth2Client } from "./oauth-helper.mjs";
import Anthropic from "@anthropic-ai/sdk";

const CONVEX_URL = process.env.CONVEX_URL || "https://calm-warbler-536.convex.cloud";
const GEMINI_NOTES_SUBJECT = "from:notes@gemini.google.com";

const anthropic = new Anthropic();

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
 * Fetch Gemini notes from Gmail
 */
async function fetchGeminiNotes() {
  const oauth2Client = await getOAuth2Client();
  const { google } = await import("googleapis");
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `${GEMINI_NOTES_SUBJECT} newer_than:2d`,
      maxResults: 20,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) return [];

    const notes = [];
    for (const msg of messages) {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = fullMsg.data.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "Gemini Note";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || new Date().toISOString();

      let body = "";
      if (fullMsg.data.payload.parts) {
        const textPart = fullMsg.data.payload.parts.find((p) => p.mimeType === "text/plain");
        if (textPart && textPart.body.data) {
          body = Buffer.from(textPart.body.data, "base64").toString();
        }
      } else if (fullMsg.data.payload.body?.data) {
        body = Buffer.from(fullMsg.data.payload.body.data, "base64").toString();
      }

      notes.push({
        id: msg.id,
        subject,
        body,
        from,
        date: new Date(date),
      });
    }

    return notes;
  } catch (err) {
    console.error("Error fetching Gemini notes:", err.message);
    return [];
  }
}

/**
 * Parse claim details from note using Claude
 */
async function parseNoteWithClaude(noteText) {
  try {
    const res = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Parse this claim note and extract: claim #, vehicle (year/make/model), carrier, damage type, next action.
Return JSON format ONLY, no markdown.

Note:
${noteText}`,
        },
      ],
    });

    const text = res.content[0].type === "text" ? res.content[0].text : "";
    try {
      return JSON.parse(text);
    } catch {
      // If Claude returns partial JSON, extract what we can
      return {
        claimNumber: text.includes("#") ? text.match(/#(\d+)/)?.[1] : undefined,
        vehicleYear: text.match(/(\d{4})/)?.[1],
        vehicleMake: text.match(/(Toyota|Honda|Ford|Chevy|Chevrolet|BMW|Lexus|Kia|Hyundai)/i)?.[1],
        damageType: text.includes("collision")
          ? "collision"
          : text.includes("theft")
            ? "theft"
            : text.includes("damage")
              ? "damage"
              : "unknown",
        nextAction: text.split(".")[0].substring(0, 100),
      };
    }
  } catch (err) {
    console.error("Error parsing note with Claude:", err.message);
    return {};
  }
}

/**
 * Ingest note as recording
 */
async function ingestNote(note, parsed) {
  try {
    const result = await callConvexMutation("recordings:ingest", {
      source: "gemini_notes",
      externalId: note.id,
      title: note.subject,
      transcript: note.body,
      summary: parsed.nextAction || note.body.substring(0, 200),
      tags: ["gemini-notes", "claim-notes", parsed.claimNumber ? `claim-${parsed.claimNumber}` : null].filter(Boolean),
      category: "claim-note",
      recordedAt: note.date.getTime(),
    });

    // Also save to geminiNotesParsed for analysis
    await callConvexMutation("parseGeminiNotes:saveParsedNote", {
      originalNoteId: note.id,
      claimNumber: parsed.claimNumber,
      vehicleYear: parsed.vehicleYear,
      vehicleMake: parsed.vehicleMake,
      vehicleModel: parsed.vehicleModel,
      carrier: parsed.carrier,
      damageType: parsed.damageType,
      nextAction: parsed.nextAction,
      confidence: 0.75,
    });

    return result;
  } catch (err) {
    console.error("Error ingesting note:", err.message);
    throw err;
  }
}

/**
 * Main sync
 */
async function main() {
  console.log(`⏱️  Gemini Notes sync started — ${new Date().toISOString()}`);

  const notes = await fetchGeminiNotes();
  console.log(`Found ${notes.length} Gemini notes`);

  if (notes.length === 0) {
    console.log("✅ No new notes — sync complete");
    return;
  }

  let ingested = 0;
  for (const note of notes) {
    try {
      const parsed = await parseNoteWithClaude(note.body);
      await ingestNote(note, parsed);
      ingested++;
      console.log(`✅ Ingested: ${note.subject.substring(0, 40)}...`);
    } catch (err) {
      console.error(`❌ Failed to ingest note: ${err.message}`);
    }
  }

  console.log(`✅ Gemini Notes sync complete — ingested ${ingested}/${notes.length}`);
}

main().catch(console.error);
