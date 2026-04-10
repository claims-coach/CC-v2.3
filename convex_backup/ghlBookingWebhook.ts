import { httpAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * GHL Booking Webhook
 * Triggers when someone books a call → auto-creates case in Mission Control
 * Endpoint: POST /api/webhooks/ghl-booking
 * 
 * CRITICAL: This MUST create the case immediately. No delays, no queues.
 * When a call is booked → case exists in Mission Control instantly.
 */

export const handleGHLBooking = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await request.json();
    console.log("📅 GHL booking webhook received:", body);

    // Extract booking data
    const {
      eventType,
      contact,
      booking,
      customFields,
    } = body as any;

    if (!eventType?.includes("booking") || !contact) {
      return new Response("Invalid payload", { status: 400 });
    }

    const firstName = contact.firstName || "";
    const lastName = contact.lastName || "";
    const phone = contact.phone || "";
    const email = contact.email || "";
    const bookingTime = booking?.startTime || new Date().toISOString();

    // Extract vehicle data from custom fields (if available)
    const vehicleYear = customFields?.year ? parseInt(customFields.year) : undefined;
    const vehicleMake = customFields?.make || undefined;
    const vehicleModel = customFields?.model || undefined;
    const vehicleVin = customFields?.vin || undefined;
    const mileage = customFields?.mileage ? parseInt(customFields.mileage) : undefined;
    const carrier = customFields?.carrier || undefined;
    const openingOffer = customFields?.estimateAmount
      ? parseFloat(customFields.estimateAmount)
      : undefined;
    const notes = customFields?.notes || undefined;

    // Create case in Mission Control via Convex mutation
    const result = await ctx.runMutation("ghl:upsertFromGHL" as any, {
      ghlContactId: contact.id,
      clientName: `${firstName} ${lastName}`.trim(),
      phone,
      email,
      vin: vehicleVin,
      year: vehicleYear,
      make: vehicleMake,
      model: vehicleModel,
      mileage,
      insurer: carrier,
      openingOffer,
      notes,
      tags: ["ghl-auto", "from-booking"],
      stage: "intake",
      source: "ghl_booking",
      openedAt: new Date(bookingTime).getTime(),
    });

    console.log("✅ Case created from GHL booking:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Case created from GHL booking",
        caseId: result,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ GHL booking webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed", details: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
