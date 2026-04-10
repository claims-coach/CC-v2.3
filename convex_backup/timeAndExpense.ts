import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Time Entries ──────────────────────────────────────────────────────────────

export const addTime = mutation({
  args: {
    caseId: v.string(), date: v.string(), category: v.string(),
    description: v.string(), hours: v.number(),
    rate: v.optional(v.number()), billable: v.boolean(),
    source: v.optional(v.string()), emailRef: v.optional(v.string()),
    approved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("timeEntries", { ...args, createdAt: Date.now() }),
});

export const updateTime = mutation({
  args: { id: v.id("timeEntries"), hours: v.optional(v.number()), description: v.optional(v.string()), approved: v.optional(v.boolean()), billable: v.optional(v.boolean()) },
  handler: async (ctx, { id, ...patch }) => ctx.db.patch(id, patch),
});

export const deleteTime = mutation({
  args: { id: v.id("timeEntries") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const listTime = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) =>
    ctx.db.query("timeEntries").withIndex("by_case", q => q.eq("caseId", caseId)).order("desc").collect(),
});

// ── Expense Entries ───────────────────────────────────────────────────────────

export const addExpense = mutation({
  args: {
    caseId: v.string(), date: v.string(), category: v.string(),
    description: v.string(), amount: v.number(), billable: v.boolean(),
    receipt: v.optional(v.string()), source: v.optional(v.string()),
    emailRef: v.optional(v.string()), approved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    ctx.db.insert("expenseEntries", { ...args, createdAt: Date.now() }),
});

export const updateExpense = mutation({
  args: { id: v.id("expenseEntries"), amount: v.optional(v.number()), description: v.optional(v.string()), approved: v.optional(v.boolean()) },
  handler: async (ctx, { id, ...patch }) => ctx.db.patch(id, patch),
});

export const deleteExpense = mutation({
  args: { id: v.id("expenseEntries") },
  handler: async (ctx, { id }) => ctx.db.delete(id),
});

export const listExpenses = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) =>
    ctx.db.query("expenseEntries").withIndex("by_case", q => q.eq("caseId", caseId)).order("desc").collect(),
});

// ── Summaries ─────────────────────────────────────────────────────────────────

export const summary = query({
  args: { caseId: v.string() },
  handler: async (ctx, { caseId }) => {
    const times    = await ctx.db.query("timeEntries").withIndex("by_case", q => q.eq("caseId", caseId)).collect();
    const expenses = await ctx.db.query("expenseEntries").withIndex("by_case", q => q.eq("caseId", caseId)).collect();
    const billableHours    = times.filter(t => t.billable).reduce((s, t) => s + t.hours, 0);
    const totalHours       = times.reduce((s, t) => s + t.hours, 0);
    const billableExpenses = expenses.filter(e => e.billable).reduce((s, e) => s + e.amount, 0);
    const totalExpenses    = expenses.reduce((s, e) => s + e.amount, 0);
    const pendingCount     = [...times, ...expenses].filter(e => e.approved === false).length;
    return { billableHours, totalHours, billableExpenses, totalExpenses, pendingCount, timeCount: times.length, expenseCount: expenses.length };
  },
});

// ── Pending suggestions (email-parsed, awaiting approval) ────────────────────

export const listPending = query({
  args: { caseId: v.optional(v.string()) },
  handler: async (ctx, { caseId }) => {
    const times = caseId
      ? await ctx.db.query("timeEntries").withIndex("by_case", q => q.eq("caseId", caseId)).collect()
      : await ctx.db.query("timeEntries").order("desc").take(100);
    const expenses = caseId
      ? await ctx.db.query("expenseEntries").withIndex("by_case", q => q.eq("caseId", caseId)).collect()
      : await ctx.db.query("expenseEntries").order("desc").take(100);
    return {
      time:    times.filter(t => t.approved === false),
      expense: expenses.filter(e => e.approved === false),
    };
  },
});
