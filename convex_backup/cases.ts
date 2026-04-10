import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get next available MasterCaseID
export const getNextId = query({
  handler: async (ctx) => {
    const all = await ctx.db
      .query("cases")
      .filter(q => q.neq(q.field("masterCaseId"), undefined))
      .collect();

    if (all.length === 0) return "000001";

    const ids = all
      .map(c => parseInt(c.masterCaseId ?? "0", 10))
      .filter(n => !isNaN(n));

    const max = ids.length > 0 ? Math.max(...ids) : 0;
    return String(max + 1).padStart(6, "0");
  },
});

// List all cases
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("cases").order("desc").collect();
  },
});

// Get stats
export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("cases").collect();
    return {
      total: all.length,
      prospects: all.filter(c => c.isProspect).length,
      active: all.filter(c => c.status === "active").length,
      settled: all.filter(c => c.status === "settled").length,
      closed: all.filter(c => c.status === "closed").length,
      cancelled: all.filter(c => c.status === "cancelled").length,
    };
  },
});

// Generate folder name
function buildFolderName(args: {
  masterCaseId?: string;
  isProspect: boolean;
  prospectId?: string;
  clientLastName: string;
  carrier: string;
  role: string;
  division: string;
  year?: number;
}): string {
  const yy = new Date().getFullYear().toString().slice(2);

  if (args.isProspect) {
    return args.prospectId ?? `P-${yy}-???_${args.clientLastName}_${args.carrier}`;
  }

  return `${args.masterCaseId}_${yy}-${args.division}-${args.role}_${args.clientLastName}_${args.carrier}`;
}

// Create a new case
export const create = mutation({
  args: {
    isProspect: v.boolean(),
    clientLastName: v.string(),
    clientName: v.optional(v.string()),
    carrier: v.string(),
    role: v.string(),
    division: v.string(),
    incidentDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    ghlContactId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const yy = new Date().getFullYear().toString().slice(2);
    let masterCaseId: string | undefined;
    let prospectId: string | undefined;

    if (!args.isProspect) {
      // Get next sequential ID
      const all = await ctx.db
        .query("cases")
        .filter(q => q.neq(q.field("masterCaseId"), undefined))
        .collect();
      const ids = all.map(c => parseInt(c.masterCaseId ?? "0", 10)).filter(n => !isNaN(n));
      const max = ids.length > 0 ? Math.max(...ids) : 0;
      masterCaseId = String(max + 1).padStart(6, "0");
    } else {
      // Prospect sequential ID
      const prospects = await ctx.db
        .query("cases")
        .filter(q => q.eq(q.field("isProspect"), true))
        .collect();
      const nextNum = String(prospects.length + 1).padStart(3, "0");
      prospectId = `P-${yy}-${nextNum}_${args.clientLastName}_${args.carrier}`;
    }

    const folderName = buildFolderName({
      masterCaseId,
      isProspect: args.isProspect,
      prospectId,
      clientLastName: args.clientLastName,
      carrier: args.carrier,
      role: args.role,
      division: args.division,
    });

    return await ctx.db.insert("cases", {
      masterCaseId,
      isProspect: args.isProspect,
      prospectId,
      clientLastName: args.clientLastName,
      clientName: args.clientName,
      carrier: args.carrier,
      role: args.role,
      division: args.division,
      status: args.isProspect ? "prospect" : "active",
      incidentDate: args.incidentDate,
      openedAt: now,
      folderName,
      notes: args.notes,
      ghlContactId: args.ghlContactId,
    });
  },
});

// Update case status
export const updateStatus = mutation({
  args: {
    id: v.id("cases"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.status === "closed" || args.status === "settled" || args.status === "cancelled") {
      updates.closedAt = Date.now();
    }
    // If converting prospect to active, assign MasterCaseID
    if (args.status === "active") {
      const existing = await ctx.db.get(args.id);
      if (existing?.isProspect && !existing.masterCaseId) {
        const all = await ctx.db
          .query("cases")
          .filter(q => q.neq(q.field("masterCaseId"), undefined))
          .collect();
        const ids = all.map(c => parseInt(c.masterCaseId ?? "0", 10)).filter(n => !isNaN(n));
        const max = ids.length > 0 ? Math.max(...ids) : 0;
        const masterCaseId = String(max + 1).padStart(6, "0");
        const yy = new Date().getFullYear().toString().slice(2);
        const folderName = `${masterCaseId}_${yy}-${existing.division}-${existing.role}_${existing.clientLastName}_${existing.carrier}`;
        updates.masterCaseId = masterCaseId;
        updates.isProspect = false;
        updates.folderName = folderName;
      }
    }
    await ctx.db.patch(args.id, updates);
  },
});
