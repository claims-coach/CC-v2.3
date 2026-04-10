import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Field ID map (GHL custom fields for Claims.Coach location) ──────────────
export const GHL_FIELDS = {
  make:          "FbC0k0MTjr1PRIUhLrJT",
  model:         "84Cyc2WkPwWSlRzDoNTf",
  trim:          "jfnPb04ubsbuAJ5bmzSk",
  submodel:      "Ayp2CCc8F6V4hlzqPIzq",
  year:          "bYA55kg9nzn6YIIUYZ4I",
  vin:           "KYwVdMAgTIaKMa2pOgfu",
  mileage:       "JafUwf29wAIz1y1U5BNe",
  claimValue:    "5McVrjyMZLO4twt3aVbz",  // insurer offer / stated value
  notes:         "yPlztXHcK16EksU7us51",
  accidentDate:  "vURmeXQ8WLvzell9gbly",
  estimateFile:  "qi9zy4jnBRSQvgBNQ2L2",
  referralSrc:   "ERhIG8T6dcru7a6D9DN8",
};

// ── GHL pipeline/stage → Mission Control stage ───────────────────────────────
export const STAGE_MAP: Record<string, string> = {
  // Sales Pipeline
  "dedf0a23-93b8-4f3d-8fc3-28e261351547": "intake",    // New Lead
  "9e26eacf-9c64-4a3f-9c15-3a7b2ea588c9": "intake",    // Call Booked
  "82aa65d0-8540-4a8f-b330-9e952c02cdf3": "intake",    // Follow Up
  "d67bd63e-20b2-4b86-862f-6d8504eb07a9": "intake",    // Send Agreement
  "c2dbdf9b-2802-4110-9fee-4a9d8c293735": "intake",    // Agreement Sent
  "e7c8613f-77ff-4563-86a0-294719e3a5a5": "intake",    // Agreement Signed
  "0b65d872-0149-4bdc-8de4-5adb75c6df2d": "valuation", // Invoice Paid → start working
  // Claims Pipeline
  "ee6207a6-8240-4ce6-999f-5611b0806e10": "valuation",      // Awaiting Opposing Appraiser
  "6fc5baba-816f-4bbc-9e9f-775fcc17d56f": "valuation",      // Contact Opposing Appraiser
  "883df3a0-990d-4866-9d2d-c159040e8083": "negotiation",    // Active Negotiations
  "5fcf438f-786d-41d5-817e-95935bb1bb70": "settled",        // Agreement Made
  "40c7bd72-d926-4f65-8f93-bd4cba5b49e0": "settled",        // Client Notified
  "7c0032e0-d364-4ecb-a424-73a252fd28b4": "closed",         // File Closed
};

// ── Upsert a claim from GHL contact data ────────────────────────────────────
export const upsertFromGHL = mutation({
  args: {
    ghlContactId:    v.string(),
    ghlOpportunityId: v.optional(v.string()),
    ghlPipelineId:   v.optional(v.string()),
    ghlStageId:      v.optional(v.string()),
    clientName:      v.string(),
    phone:           v.optional(v.string()),
    email:           v.optional(v.string()),
    address1:        v.optional(v.string()),
    city:            v.optional(v.string()),
    state:           v.optional(v.string()),
    postalCode:      v.optional(v.string()),
    vin:             v.optional(v.string()),
    year:            v.optional(v.number()),
    make:            v.optional(v.string()),
    model:           v.optional(v.string()),
    trim:            v.optional(v.string()),
    mileage:         v.optional(v.number()),
    insurer:         v.optional(v.string()),
    openingOffer:    v.optional(v.number()),
    notes:           v.optional(v.string()),
    tags:            v.array(v.string()),
    stage:           v.optional(v.string()),
    claimType:       v.optional(v.string()),
    source:          v.optional(v.string()),
    openedAt:        v.optional(v.number()),
    estimateUrl:     v.optional(v.string()),
    ghlDocuments:    v.optional(v.string()), // JSON array of { name, url, type, size }
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Determine stage
    const stage = (args.stage ?? "intake") as
      "intake" | "valuation" | "report_draft" | "review" | "negotiation" | "settled" | "closed";

    // Determine claim type from tags
    let claimType: "ACV" | "DV" | "both" = "ACV";
    const tagLower = args.tags.map(t => t.toLowerCase());
    if (tagLower.some(t => t.includes("dv") || t.includes("diminished"))) {
      claimType = tagLower.some(t => t.includes("acv") || t.includes("appraisal")) ? "both" : "DV";
    } else if (args.claimType === "DV") claimType = "DV";
    else if (args.claimType === "both") claimType = "both";

    // Check if claim already exists for this GHL contact
    const existing = await ctx.db
      .query("claims")
      .withIndex("by_ghl_contact", q => q.eq("ghlContactId", args.ghlContactId))
      .first();

    // Build documents array from all GHL file uploads
    const documents: Array<{ name: string; type: "estimate" | "photo" | "recording" | "report" | "correspondence" | "other"; url: string }> = [];
    if (args.ghlDocuments) {
      try {
        const parsed = JSON.parse(args.ghlDocuments) as Array<{ name: string; type: string; url: string; size?: number }>;
        parsed.forEach(d => documents.push({
          name: d.name,
          type: d.type === "estimate" ? "estimate" : "other",
          url:  d.url,
        }));
      } catch { /* ignore parse error */ }
    } else if (args.estimateUrl) {
      documents.push({ name: "Estimate of Record", type: "estimate" as const, url: args.estimateUrl });
    }

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        ghlOpportunityId: args.ghlOpportunityId ?? existing.ghlOpportunityId,
        ghlPipelineId:    args.ghlPipelineId ?? existing.ghlPipelineId,
        ghlStageId:       args.ghlStageId ?? existing.ghlStageId,
        clientName:       args.clientName,
        phone:            args.phone ?? existing.phone,
        email:            args.email ?? existing.email,
        address1:         args.address1 ?? existing.address1,
        city:             args.city ?? existing.city,
        state:            args.state ?? existing.state,
        postalCode:       args.postalCode ?? existing.postalCode,
        vin:              args.vin ?? existing.vin,
        year:             args.year ?? existing.year,
        make:             args.make ?? existing.make,
        model:            args.model ?? existing.model,
        trim:             args.trim ?? existing.trim,
        mileage:          args.mileage ?? existing.mileage,
        insurer:          args.insurer ?? existing.insurer,
        openingOffer:     args.openingOffer ?? existing.openingOffer,
        notes:            args.notes ?? existing.notes,
        tags:             args.tags.length > 0 ? args.tags : existing.tags,
        documents:        documents.length > 0 ? documents : existing.documents,
        stage,
        claimType,
        updatedAt:        now,
      });
      return { action: "updated", id: existing._id };
    } else {
      // Create
      const id = await ctx.db.insert("claims", {
        ghlContactId:     args.ghlContactId,
        ghlOpportunityId: args.ghlOpportunityId,
        ghlPipelineId:    args.ghlPipelineId,
        ghlStageId:       args.ghlStageId,
        clientName:       args.clientName,
        phone:            args.phone,
        email:            args.email,
        address1:         args.address1,
        city:             args.city,
        state:            args.state,
        postalCode:       args.postalCode,
        vin:              args.vin ?? "UNKNOWN",
        year:             args.year,
        make:             args.make,
        model:            args.model,
        trim:             args.trim,
        mileage:          args.mileage,
        insurer:          args.insurer,
        openingOffer:     args.openingOffer,
        notes:            args.notes,
        tags:             args.tags,
        stage,
        claimType,
        assignedAgent:    "CC",
        priority:         "medium",
        daysOpen:         0,
        openedAt:         args.openedAt ?? now,
        documents,
        createdAt:        now,
        updatedAt:        now,
      });
      // ── Auto-create initial tasks ────────────────────────────────────
      // When claim enters intake or valuation, create default tasks
      if (stage === "intake" || stage === "valuation") {
        const tasksToCreate: Array<{
          title: string;
          description: string;
          priority: "low" | "medium" | "high" | "urgent";
          status: "todo" | "in_progress" | "review" | "done";
          assignee: string;
          tags: string[];
          createdAt: number;
          updatedAt: number;
        }> = [
          {
            title: "Run EPIC VIN Report",
            description: "Pull EPIC VIN report — vehicle history, title check, prior damage. Upload to 01_VEHICLE_DOCS/. Flag branded title, structural damage, odometer issues.",
            priority: "high",
            status: "todo",
            assignee: "CC",
            tags: ["ACV", "DV", "vehicle-history", "intake"],
            createdAt: now,
            updatedAt: now,
          },
          {
            title: "Run Carfax Report",
            description: "Pull Carfax — accident history, owner count, service records. Cross-reference with EPIC VIN. Upload to 01_VEHICLE_DOCS/. Document accident severity and airbag deployment.",
            priority: "high",
            status: "todo",
            assignee: "CC",
            tags: ["ACV", "DV", "vehicle-history", "intake"],
            createdAt: now,
            updatedAt: now,
          },
          {
            title: "Pull JD Power Value",
            description: "Get JD Power private party value (clean condition). Enter into ACV Workbench jdPowerValue field. Note condition tier used.",
            priority: "high",
            status: "todo",
            assignee: "CC",
            tags: ["ACV", "valuation", "JDPower"],
            createdAt: now,
            updatedAt: now,
          },
          {
            title: "Pull KBB Value",
            description: "Get KBB private party value (good condition default). Enter into ACV Workbench kbbValue field. Note if significantly different from JD Power.",
            priority: "high",
            status: "todo",
            assignee: "CC",
            tags: ["ACV", "valuation", "KBB"],
            createdAt: now,
            updatedAt: now,
          },
          {
            title: "Find Comps",
            description: "Search for 3-5 comparables within 150 miles using state guidelines. Use Watson or manual market search. Document location, mileage, condition, asking price.",
            priority: "high",
            status: "todo",
            assignee: "CC",
            tags: ["ACV", "DV", "comps", "research"],
            createdAt: now,
            updatedAt: now,
          },
        ];

        // Insert all tasks
        for (const task of tasksToCreate) {
          await ctx.db.insert("tasks", task);
        }
      }

      return { action: "created", id };
    }
  },
});

// ── Get claim by GHL contact ID ──────────────────────────────────────────────
export const getByGHLContact = query({
  args: { ghlContactId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claims")
      .withIndex("by_ghl_contact", q => q.eq("ghlContactId", args.ghlContactId))
      .first();
  },
});
