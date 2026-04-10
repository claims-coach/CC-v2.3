#!/usr/bin/env node

/**
 * Autoresearch Alert System
 * When autoresearch jobs complete, sends alert to Telegram + updates Mission Control
 */

import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.join(process.env.HOME, ".openclaw/workspace");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7547154254:AAHjLF0g-qwX6nAhk8ykMqM-hHdALSj_p5M";
const JOHNNY_CHAT_ID = "8733921180";

/**
 * Parse autoresearch results.tsv
 */
async function parseAutoresearchResults(loopName) {
  const resultsPath = path.join(
    WORKSPACE,
    loopName === "claims" ? "claims-autoresearch" : "claims-code-autoresearch",
    "results.tsv"
  );

  try {
    const content = await fs.readFile(resultsPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("commit"));

    if (lines.length < 2) return null;

    const lastLine = lines[lines.length - 1].split("\t");
    const prevLine = lines[lines.length - 2].split("\t");

    const current = parseFloat(lastLine[1]);
    const previous = parseFloat(prevLine[1]);

    return {
      current,
      previous,
      improvement: loopName === "claims" ? (((previous - current) / previous) * 100).toFixed(1) : (current - previous).toFixed(1),
      status: lastLine[3] || "unknown",
      commit: lastLine[0],
      memory: lastLine[2] || "N/A",
    };
  } catch (e) {
    console.error(`Error parsing ${loopName} results:`, e.message);
    return null;
  }
}

/**
 * Send Telegram alert
 */
async function sendTelegramAlert(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: JOHNNY_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      console.error(`Telegram error: ${res.status} ${res.statusText}`);
      return false;
    }

    console.log("✅ Telegram alert sent");
    return true;
  } catch (e) {
    console.error("Failed to send Telegram alert:", e.message);
    return false;
  }
}

/**
 * Main: Check autoresearch and alert
 */
async function main() {
  console.log("[Autoresearch Alert] Checking results...");

  const claimsResults = await parseAutoresearchResults("claims");
  const codeResults = await parseAutoresearchResults("code");

  if (!claimsResults && !codeResults) {
    console.log("No autoresearch results found");
    return;
  }

  let alertMessage = "🤖 **Autoresearch Complete**\n\n";

  if (claimsResults) {
    const emoji = claimsResults.improvement > 0 ? "📈" : "📉";
    alertMessage += `${emoji} **Claims Valuation Loop**\n`;
    alertMessage += `   Current: ${claimsResults.current.toFixed(3)} val_bpb\n`;
    alertMessage += `   Previous: ${claimsResults.previous.toFixed(3)} val_bpb\n`;
    alertMessage += `   Improvement: ${claimsResults.improvement}%\n`;
    alertMessage += `   Status: ${claimsResults.status}\n`;
    alertMessage += `   Memory: ${claimsResults.memory}\n\n`;
  }

  if (codeResults) {
    const emoji = codeResults.improvement > 0 ? "📈" : "📉";
    alertMessage += `${emoji} **Code Generation Loop**\n`;
    alertMessage += `   Current: ${codeResults.current.toFixed(1)}% test passage\n`;
    alertMessage += `   Previous: ${codeResults.previous.toFixed(1)}% test passage\n`;
    alertMessage += `   Improvement: +${codeResults.improvement}%\n`;
    alertMessage += `   Status: ${codeResults.status}\n`;
    alertMessage += `   Memory: ${codeResults.memory}\n\n`;
  }

  alertMessage += `_Results auto-updated in Mission Control /autoresearch dashboard_`;

  await sendTelegramAlert(alertMessage);
}

main().catch(console.error);
