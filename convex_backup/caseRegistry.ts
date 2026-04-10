import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

const STARTING_ID = 150; // 000001–000149 reserved for pre-system historical matters

// ── Create Drive folder structure for a case ─────────────────────────────────
export const createDriveFolderForCase = action({
  args: { caseKey: v.string() },
  handler: async (ctx, args) => {
    const CASES_FOLDER = "1qx0S0rG7yjsJXP540fCvIFP4-BdjiwtO";
    const SUBFOLDERS = [
      "01_INTAKE", "02_VALUATIONS", "03_REPORTS",
      "04_COMMUNICATIONS", "05_EXHIBITS",
      "06_SETTLEMENT", "07_TIMEKEEPING", "08_ARCHIVE",
    ];

    try {
      // Credentials stored in env (will be baked into action at deploy time)
      const clientId = "809330926323-m678qia2hr5pbtimgqn6uglio9v7c9mn.apps.googleusercontent.com";
      const clientSecret = "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";
      const refreshToken = "1//06ke5gcJ3G2SlCgYIARAAGAYSNwF-L9Ir9KedmcgkdQat7dqKHnc-unPnAJIzh4QDOZh0R7VzlOL0JSLXwOo1sngT9d9rzfkLEH4";

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.access_token;

      if (!token) throw new Error(`Token fetch failed: ${JSON.stringify(tokenData).slice(0, 200)}`);

      // Create main case folder
      const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: args.caseKey,
          mimeType: "application/vnd.google-apps.folder",
          parents: [CASES_FOLDER],
        }),
      });
      const folderData = await folderRes.json();
      const caseFolder = folderData.id;

      if (!caseFolder) throw new Error("Folder creation failed");

      // Create subfolders
      for (const sub of SUBFOLDERS) {
        await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: sub,
            mimeType: "application/vnd.google-apps.folder",
            parents: [caseFolder],
          }),
        });
      }

      return { ok: true, caseFolder, subfolders: SUBFOLDERS.length };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
});

// ── Quick add to claims table for backward compat ──────────────────────────────
export const quickAddToClaims = mutation({
  args: {
    clientName: v.string(),
    ghlContactId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("claims", {
      clientName: args.clientName,
      vin: "unknown",
      insurer: "Unknown",
      stage: "valuation",
      claimType: "ACV",
      assignedAgent: "Johnny Walker",
      priority: "medium",
      tags: [],
      daysOpen: 0,
      openedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      documents: [],
      ...(args.ghlContactId ? { ghlContactId: args.ghlContactId } : {}),
    });
  },
});

// ── Get next available MasterCaseID ──────────────────────────────────────
export const nextId = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("caseRegistry").collect();
    if (all.length === 0) return String(STARTING_ID).padStart(6, "0");
    const max = Math.max(...all.map(c => parseInt(c.masterCaseId ?? "0", 10)).filter(n => !isNaN(n)));
    const next = Math.max(max + 1, STARTING_ID);
    return String(next).padStart(6, "0");
  },
});

// ── Create a new case ─────────────────────────────────────────────────────
export const create = mutation({
  args: {
    division:     v.union(v.literal("AUTO"), v.literal("PROP")),
    role:         v.union(v.literal("DV"), v.literal("AC"), v.literal("UMP"), v.literal("EXP"), v.literal("CON"), v.literal("LIT"), v.literal("OTH")),
    lastName:     v.string(),
    carrier:      v.string(),
    clientName:   v.optional(v.string()),
    contactId:    v.optional(v.string()),
    opportunityId: v.optional(v.string()),
    status:       v.optional(v.union(v.literal("prospect"), v.literal("active"), v.literal("settled"), v.literal("closed"), v.literal("cancelled"))),
    notes:        v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate next ID
    const all = await ctx.db.query("caseRegistry").collect();
    const maxId = all.length === 0 ? STARTING_ID - 1 : Math.max(...all.map(c => parseInt(c.masterCaseId ?? "0", 10)).filter(n => !isNaN(n)));
    const nextNum = Math.max(maxId + 1, STARTING_ID);
    const masterCaseId = String(nextNum).padStart(6, "0");

    const year = String(new Date().getFullYear()).slice(-2);
    const caseKey = `${masterCaseId}_${year}-${args.division}-${args.role}_${args.lastName}_${args.carrier}`;

    const id = await ctx.db.insert("caseRegistry", {
      masterCaseId,
      caseKey,
      year,
      division:    args.division,
      role:        args.role,
      lastName:    args.lastName,
      carrier:     args.carrier,
      clientName:  args.clientName,
      contactId:   args.contactId,
      opportunityId: args.opportunityId,
      status:      args.status ?? "active",
      openedAt:    Date.now(),
      updatedAt:   Date.now(),
      notes:       args.notes,
    });

    // Also insert into legacy 'claims' table for backward compatibility with workbench
    const claimsRecord: any = {
      clientName: args.clientName || args.lastName,
      vin: "unknown",
      insurer: args.carrier,
      stage: "valuation",
      claimType: "ACV",
      assignedAgent: "CC",
      priority: "medium",
      tags: [],
      daysOpen: 0,
      documents: [],
      openedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (args.contactId) claimsRecord.ghlContactId = args.contactId;
    if (args.opportunityId) claimsRecord.ghlOpportunityId = args.opportunityId;
    const claimsId = await ctx.db.insert("claims", claimsRecord);

    // Note: Drive folder creation would go here, but skipped for now to avoid blocking;

    return { id, masterCaseId, caseKey, claimsId };
  },
});

// ── Update a case ─────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    id:            v.id("caseRegistry"),
    status:        v.optional(v.union(v.literal("prospect"), v.literal("active"), v.literal("settled"), v.literal("closed"), v.literal("cancelled"))),
    driveFolder:   v.optional(v.string()),
    notes:         v.optional(v.string()),
    contactId:     v.optional(v.string()),
    opportunityId: v.optional(v.string()),
    happyCustomer: v.optional(v.boolean()),
    billingType:   v.optional(v.union(v.literal("te"), v.literal("flat"), v.literal("contingency"))),
    hourlyRate:    v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });

    // When status changes to settled and contact exists — fire GHL tag webhook
    const wasSettled = existing?.status !== "settled" && fields.status === "settled";
    const contactId  = fields.contactId || existing?.contactId;
    if (wasSettled && contactId) {
      const tags = fields.happyCustomer ? ["customer", "happy customer"] : ["customer"];
      // Fire-and-forget GHL tag via internal fetch
      try {
        const GHL_KEY = process.env.GHL_API_KEY;
        if (GHL_KEY) {
          const cur = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
            headers: { Authorization: `Bearer ${GHL_KEY}`, Version: "2021-07-28" },
          });
          const cd = await cur.json();
          const existing_tags: string[] = cd.contact?.tags || [];
          const merged = [...new Set([...existing_tags, ...tags])];
          await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${GHL_KEY}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ tags: merged }),
          });
        }
      } catch { /* non-blocking */ }
    }
  },
});

// ── Get by MasterCaseID ───────────────────────────────────────────────────
export const getById = query({
  args: { masterCaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("caseRegistry")
      .withIndex("by_masterCaseId", q => q.eq("masterCaseId", args.masterCaseId))
      .first();
  },
});

// ── Get by GHL contactId ──────────────────────────────────────────────────
export const getByContact = query({
  args: { contactId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("caseRegistry")
      .withIndex("by_contact", q => q.eq("contactId", args.contactId))
      .collect();
  },
});

// ── List all ──────────────────────────────────────────────────────────────
export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("caseRegistry").order("desc").collect();
    if (args.status) return all.filter(c => c.status === args.status);
    return all;
  },
});
