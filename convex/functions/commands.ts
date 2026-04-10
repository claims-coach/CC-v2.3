// ============================================================
// functions/commands.ts — Telegram command intake + routing
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

type ParsedCommand = {
  commandName: string;
  args: Record<string, string>;
  entityType?: "prospect" | "matter";
  entityId?: string;
};

/**
 * Parse raw Telegram text into structured command.
 */
function parseCommandText(raw: string): ParsedCommand {
  const text = raw.trim();

  // "call notes P-26-014_Johnson_StateFarm Client wants $18k..."
  const callNotesMatch = text.match(/^call\s+notes\s+(P-\S+)\s+(.+)$/i);
  if (callNotesMatch) {
    return {
      commandName: "call_notes",
      args: { notes: callNotesMatch[2] },
      entityType: "prospect",
      entityId: callNotesMatch[1],
    };
  }

  // "yes activate"
  if (/^yes\s+activate$/i.test(text)) {
    return { commandName: "yes_activate", args: {} };
  }

  // "generate report 000163_26-AUTO-AC_Johnson_StateFarm"
  const genMatch = text.match(/^generate\s+report\s+(\S+)$/i);
  if (genMatch) {
    return {
      commandName: "generate_report",
      args: {},
      entityType: "matter",
      entityId: genMatch[1],
    };
  }

  // "closed 000163_26-AUTO-AC_Johnson_StateFarm settled $14250"
  const closedMatch = text.match(
    /^closed\s+(\S+)\s+(settled|awarded|withdrawn|other)\s+\$?([\d,]+(?:\.\d{2})?)$/i
  );
  if (closedMatch) {
    return {
      commandName: "close_matter",
      args: {
        outcome: closedMatch[2].toUpperCase(),
        amount: closedMatch[3].replace(/,/g, ""),
      },
      entityType: "matter",
      entityId: closedMatch[1],
    };
  }

  // Role confirmation: "AC", "DV", "EXP", "UMP", "CON", "LIT", "OTH description"
  const roleMatch = text.match(/^(AC|DV|EXP|UMP|CON|LIT|OTH)\s*(.*)$/i);
  if (roleMatch) {
    return {
      commandName: "confirm_role",
      args: {
        role: roleMatch[1].toUpperCase(),
        description: roleMatch[2]?.trim() || "",
      },
    };
  }

  // "help"
  if (/^help$/i.test(text)) {
    return { commandName: "help", args: {} };
  }

  return { commandName: "unknown", args: { raw: text } };
}

/**
 * ingestCommand — parse and record a Telegram command.
 */
export const ingestCommand = mutation({
  args: {
    source: v.union(v.literal("Telegram"), v.literal("System")),
    rawText: v.string(),
  },
  handler: async (ctx, { source, rawText }) => {
    const parsed = parseCommandText(rawText);
    const now = Date.now();

    const docId = await ctx.db.insert("commands", {
      source,
      rawText,
      commandName: parsed.commandName,
      parsedArgsJson: JSON.stringify(parsed.args),
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      status: "PARSED",
      createdAt: now,
    });

    return { _id: docId, ...parsed };
  },
});

/**
 * markExecuted / markFailed — update command status after processing.
 */
export const markExecuted = mutation({
  args: { commandId: v.id("commands") },
  handler: async (ctx, { commandId }) => {
    await ctx.db.patch(commandId, { status: "EXECUTED" });
  },
});

export const markFailed = mutation({
  args: { commandId: v.id("commands"), error: v.string() },
  handler: async (ctx, { commandId, error }) => {
    await ctx.db.patch(commandId, { status: "FAILED", error });
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const results = await ctx.db.query("commands").order("desc").take(limit ?? 20);
    return results;
  },
});
