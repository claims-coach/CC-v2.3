// ============================================================
// functions/webhooks.ts — HTTP entry points for GHL + Telegram
// ============================================================
//
// These are Convex httpAction handlers. Deploy as HTTP routes:
//   POST /ghl/intake    — GHL appointment webhook
//   POST /telegram      — Telegram bot webhook
//
// Both use idempotency checks before processing.

import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";

// ============================================================
// GHL INTAKE WEBHOOK — Stage 0 entry point
// ============================================================
export const ghlIntake = httpAction(async (ctx, request) => {
  const body = await request.json();

  // ---- Extract GHL webhook fields ----
  const externalEventId = body.id || body.contact_id || `ghl_${Date.now()}`;

  // ---- Idempotency check ----
  const idemCheck = await ctx.runMutation(api.functions.ingestedEvents.checkAndRecord, {
    source: "GHL",
    externalEventId: String(externalEventId),
    eventType: "appointment.booked",
  });

  if (idemCheck.isDuplicate) {
    return new Response(JSON.stringify({ ok: true, status: "duplicate_ignored" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ---- Map GHL fields to prospect input ----
    const prospectInput = {
      firstName: body.first_name || body.firstName || "",
      lastName: body.last_name || body.lastName || "",
      phoneRaw: body.phone || "",
      emailRaw: body.email || "",
      vehicleYear: parseInt(body.vehicle_year || body.vehicleYear || "0", 10),
      vehicleMake: body.vehicle_make || body.vehicleMake || "",
      vehicleModel: body.vehicle_model || body.vehicleModel || "",
      vehicleTrim: body.vehicle_trim || body.vehicleTrim || undefined,
      vehicleVin: body.vin || body.vehicle_vin || undefined,
      vehicleMileage: body.mileage ? parseInt(body.mileage, 10) : undefined,
      carrierDisplayName: body.insurance_company || body.carrier || "UNKNOWN",
      claimNumber: body.claim_number || undefined,
      insurerAcvOffer: body.insurer_offer ? parseFloat(body.insurer_offer) : undefined,
      clientTargetValue: body.client_target ? parseFloat(body.client_target) : undefined,
      callDateTime: body.appointment_time
        ? new Date(body.appointment_time).getTime()
        : undefined,
      ghlContactId: body.contact_id || undefined,
      cccPdfPresent: body.ccc_pdf_uploaded === "true" || body.ccc_pdf_uploaded === true,
      source: "GHL",
    };

    // ---- Create prospect (canonical write + jobs enqueued) ----
    const result = await ctx.runMutation(api.functions.prospects.createProspect, prospectInput);

    // ---- Mark event processed ----
    await ctx.runMutation(api.functions.ingestedEvents.markProcessed, {
      eventDocId: idemCheck.eventDocId!,
    });

    // ---- Transition to RESEARCH_RUNNING ----
    await ctx.runMutation(api.functions.prospects.transitionProspectStage, {
      prospectId: result.prospectId,
      toStage: "RESEARCH_RUNNING",
      reason: "Auto-triggered pre-call comp research.",
      source: "GHL",
    });

    return new Response(
      JSON.stringify({ ok: true, prospectId: result.prospectId }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    await ctx.runMutation(api.functions.ingestedEvents.markFailed, {
      eventDocId: idemCheck.eventDocId!,
      error: err.message || "Unknown error",
    });
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// TELEGRAM WEBHOOK — Command routing
// ============================================================
export const telegram = httpAction(async (ctx, request) => {
  const body = await request.json();

  // Extract text from Telegram update
  const message = body.message || body.edited_message;
  if (!message?.text) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const chatId = message.chat.id;
  const rawText = message.text;
  const messageId = String(message.message_id);

  // ---- Idempotency ----
  const idemCheck = await ctx.runMutation(api.functions.ingestedEvents.checkAndRecord, {
    source: "Telegram",
    externalEventId: `tg_${chatId}_${messageId}`,
    eventType: "command",
  });

  if (idemCheck.isDuplicate) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  try {
    // ---- Parse command ----
    const parsed = await ctx.runMutation(api.functions.commands.ingestCommand, {
      source: "Telegram",
      rawText,
    });

    // Command routing happens in the OpenClaw orchestration layer,
    // not inline here. The command record is now in PARSED status
    // and available for the CC agent to pick up and execute.

    await ctx.runMutation(api.functions.ingestedEvents.markProcessed, {
      eventDocId: idemCheck.eventDocId!,
    });

    return new Response(
      JSON.stringify({ ok: true, command: parsed.commandName }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    await ctx.runMutation(api.functions.ingestedEvents.markFailed, {
      eventDocId: idemCheck.eventDocId!,
      error: err.message || "Unknown error",
    });
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
