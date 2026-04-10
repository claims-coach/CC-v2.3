import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── GHL Calendar Events ─────────────────────────────────────────────────────
// Synced from GHL consultation calendars via scripts/calendar-sync.mjs

export const upsertEvent = mutation({
  args: {
    eventId: v.string(),
    calendarId: v.string(),
    title: v.string(),
    contactId: v.optional(v.string()),
    contactName: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    status: v.string(),
    appointmentStatus: v.optional(v.string()),
    locationId: v.string(),
    notes: v.optional(v.string()),
    calendarName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ghlCalendarEvents")
      .withIndex("by_event_id", q => q.eq("eventId", args.eventId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    } else {
      return await ctx.db.insert("ghlCalendarEvents", { ...args, createdAt: now, updatedAt: now });
    }
  },
});

export const listUpcoming = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("ghlCalendarEvents")
      .withIndex("by_start_time", q => q.gte("startTime", now))
      .collect();
    return events
      .filter(e => e.startTime <= sevenDays)
      .sort((a, b) => a.startTime - b.startTime);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("ghlCalendarEvents")
      .withIndex("by_start_time")
      .order("desc")
      .collect();
  },
});

export const listByCalendar = query({
  args: { calendarId: v.string() },
  handler: async (ctx, { calendarId }) => {
    return await ctx.db
      .query("ghlCalendarEvents")
      .withIndex("by_calendar_id", q => q.eq("calendarId", calendarId))
      .order("desc")
      .collect();
  },
});

export const deleteOldEvents = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days ago
    const old = await ctx.db
      .query("ghlCalendarEvents")
      .withIndex("by_start_time", q => q.lt("startTime", cutoff))
      .collect();
    for (const e of old) await ctx.db.delete(e._id);
    return old.length;
  },
});
