import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ── GHL Webhook Handler ──────────────────────────────────────────────────────
// Endpoint: https://calm-warbler-536.convex.site/ghl/webhook
// Register this URL in GHL → Settings → Integrations → Webhooks

const GHL_API_KEY  = "pit-2aef29e2-efb0-4cc7-b4bf-fa5b9bc75803";
const GHL_LOCATION = "Lud9I0SSpb992pgRS4gJ";
const GHL_BASE     = "https://services.leadconnectorhq.com";
const GHL_HEADERS  = {
  "Authorization": `Bearer ${GHL_API_KEY}`,
  "Version": "2021-07-28",
};

// Custom field IDs
const F = {
  make:         "FbC0k0MTjr1PRIUhLrJT",
  model:        "84Cyc2WkPwWSlRzDoNTf",
  trim:         "jfnPb04ubsbuAJ5bmzSk",
  submodel:     "Ayp2CCc8F6V4hlzqPIzq",
  year:         "bYA55kg9nzn6YIIUYZ4I",
  vin:          "KYwVdMAgTIaKMa2pOgfu",
  mileage:      "JafUwf29wAIz1y1U5BNe",
  claimValue:   "5McVrjyMZLO4twt3aVbz",
  notes:        "yPlztXHcK16EksU7us51",
  estimateFile: "qi9zy4jnBRSQvgBNQ2L2",
};

const STAGE_MAP: Record<string, string> = {
  "dedf0a23-93b8-4f3d-8fc3-28e261351547": "intake",
  "9e26eacf-9c64-4a3f-9c15-3a7b2ea588c9": "intake",
  "82aa65d0-8540-4a8f-b330-9e952c02cdf3": "intake",
  "d67bd63e-20b2-4b86-862f-6d8504eb07a9": "intake",
  "c2dbdf9b-2802-4110-9fee-4a9d8c293735": "intake",
  "e7c8613f-77ff-4563-86a0-294719e3a5a5": "intake",
  "0b65d872-0149-4bdc-8de4-5adb75c6df2d": "valuation",
  "ee6207a6-8240-4ce6-999f-5611b0806e10": "valuation",
  "6fc5baba-816f-4bbc-9e9f-775fcc17d56f": "valuation",
  "883df3a0-990d-4866-9d2d-c159040e8083": "negotiation",
  "5fcf438f-786d-41d5-817e-95935bb1bb70": "settled",
  "40c7bd72-d926-4f65-8f93-bd4cba5b49e0": "settled",
  "7c0032e0-d364-4ecb-a424-73a252fd28b4": "closed",
};

function cf(fields: any[], id: string) {
  return fields?.find((f: any) => f.id === id)?.value ?? null;
}

function parseNumber(val: any): number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

async function fetchContact(contactId: string) {
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, { headers: GHL_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  return data.contact || null;
}

async function fetchOpportunities(contactId: string) {
  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/${contactId}/opportunities?locationId=${GHL_LOCATION}`,
      { headers: GHL_HEADERS }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.opportunities || data.data || [];
  } catch {
    return [];
  }
}

function buildUpsertArgs(contact: any, opp?: any) {
  const fields = contact.customFields || [];

  const vin   = cf(fields, F.vin);
  const make  = cf(fields, F.make);

  // Estimate URL
  let estimateUrl: string | undefined;
  const estimateField = cf(fields, F.estimateFile);
  if (estimateField && typeof estimateField === "object") {
    const first = Object.values(estimateField)[0] as any;
    estimateUrl = first?.url;
  }

  let stage = "intake";
  let ghlOpportunityId, ghlPipelineId, ghlStageId;
  if (opp) {
    ghlOpportunityId = opp.id;
    ghlPipelineId    = opp.pipelineId;
    ghlStageId       = opp.pipelineStageId;
    stage            = STAGE_MAP[ghlStageId] ?? "intake";
  }

  const clientName =
    contact.contactName ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    contact.phone || "Unknown";

  return {
    ghlContactId:     contact.id,
    ghlOpportunityId,
    ghlPipelineId,
    ghlStageId,
    clientName,
    phone:            contact.phone || undefined,
    email:            contact.email || undefined,
    vin:              vin?.trim() || undefined,
    year:             parseNumber(cf(fields, F.year)),
    make:             make?.trim() || undefined,
    model:            cf(fields, F.model)?.trim() || undefined,
    trim:             cf(fields, F.trim)?.trim() || cf(fields, F.submodel)?.trim() || undefined,
    mileage:          parseNumber(cf(fields, F.mileage)),
    openingOffer:     parseNumber(cf(fields, F.claimValue)),
    notes:            cf(fields, F.notes) || undefined,
    tags:             contact.tags || [],
    stage,
    estimateUrl,
    openedAt:         contact.dateAdded ? new Date(contact.dateAdded).getTime() : Date.now(),
  };
}

http.route({
  path: "/ghl/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }

    const eventType: string = body.type || body.event || "";
    const locationId: string = body.locationId || body.location_id || "";

    // Only handle events for our location
    if (locationId && locationId !== GHL_LOCATION) {
      return new Response("OK", { status: 200 });
    }

    console.log(`[GHL Webhook] Event: ${eventType}`);

    // ── Contact created or updated ──────────────────────────────────────────
    if (
      eventType === "ContactCreate" ||
      eventType === "ContactUpdate" ||
      eventType === "contact.create" ||
      eventType === "contact.update"
    ) {
      const contactId = body.id || body.contactId || body.contact?.id;
      if (!contactId) return new Response("No contactId", { status: 400 });

      const contact = await fetchContact(contactId);
      if (!contact) return new Response("Contact not found", { status: 404 });

      const fields = contact.customFields || [];
      const hasVehicle = cf(fields, F.vin) || cf(fields, F.make);
      if (!hasVehicle) return new Response("OK - no vehicle data", { status: 200 });

      const opps = await fetchOpportunities(contactId);
      const upsertArgs = buildUpsertArgs(contact, opps[0]);

      await ctx.runMutation(api.ghl.upsertFromGHL, upsertArgs);

      // Log activity
      await ctx.runMutation(api.activity.log, {
        agentName: "CC",
        action: eventType.includes("Create") ? "New GHL contact → claim created" : "GHL contact updated",
        details: `${upsertArgs.clientName} — ${upsertArgs.year || ""} ${upsertArgs.make || ""} ${upsertArgs.model || ""}`.trim(),
        type: "api",
      });
    }

    // ── Opportunity stage changed ───────────────────────────────────────────
    if (
      eventType === "OpportunityCreate" ||
      eventType === "OpportunityUpdate" ||
      eventType === "OpportunityStatusUpdate" ||
      eventType === "opportunity.create" ||
      eventType === "opportunity.update" ||
      eventType === "opportunity.stageUpdate"
    ) {
      const opp = body.opportunity || body;
      const contactId = opp.contactId || opp.contact?.id;
      if (!contactId) return new Response("OK - no contactId in opp", { status: 200 });

      const contact = await fetchContact(contactId);
      if (!contact) return new Response("OK - contact not found", { status: 200 });

      const upsertArgs = buildUpsertArgs(contact, opp);
      await ctx.runMutation(api.ghl.upsertFromGHL, upsertArgs);

      await ctx.runMutation(api.activity.log, {
        agentName: "CC",
        action: "GHL pipeline stage updated",
        details: `${upsertArgs.clientName} → ${upsertArgs.stage}`,
        type: "api",
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

// ── Health check ─────────────────────────────────────────────────────────────
http.route({
  path: "/ghl/webhook",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ status: "ok", service: "Claims.Coach GHL Webhook" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

export default http;
