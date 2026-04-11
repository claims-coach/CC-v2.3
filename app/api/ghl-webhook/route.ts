import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';

/**
 * GHL Webhook Receiver
 * 
 * Catches real-time events from GHL:
 * - contact.updated
 * - contact.created
 * - appointment.created (booked call)
 * - file.uploaded
 * 
 * Immediately syncs to Mission Control (no 15-min delay)
 */

const CONVEX_URL = 'https://fabulous-roadrunner-674.convex.cloud';
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1';
const GHL_LOCATION = 'Lud9I0SSpb992pgRS4gJ';
const GHL_BASE = 'https://services.leadconnectorhq.com';

const client = new ConvexHttpClient(CONVEX_URL);

// Custom field IDs
const FIELD_IDS = {
  vehicle_year: 'bYA55kg9nzn6YIIUYZ4I',
  vehicle_make: 'FbC0k0MTjr1PRIUhLrJT',
  vehicle_model: '84Cyc2WkPwWSlRzDoNTf',
  vehicle_trim: 'Ayp2CCc8F6V4hlzqPIzq',
  vehicle_vin: 'zQn83d4bJi4CKdSdkhbh',
  vehicle_mileage: 'JafUwf29wAIz1y1U5BNe',
  claimValue: '5McVrjyMZLO4twt3aVbz',
  notes: 'jfnPb04ubsbuAJ5bmzSk',
  accidentDate: 'vURmeXQ8WLvzell9gbly',
  estimateFile: 'qi9zy4jnBRSQvgBNQ2L2',
};

async function ghlFetch(path: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GHL ${path} → ${res.status}: ${error}`);
  }
  return res.json();
}

function extractCustomField(customFields: any[], fieldId: string): any {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find(f => f.id === fieldId);
  return field?.value || null;
}

async function syncContactToMissionControl(contactId: string) {
  console.log(`[GHL Webhook] Syncing contact ${contactId}`);

  try {
    // Fetch contact details from GHL
    const contact = await ghlFetch(`/contacts/${contactId}/?locationId=${GHL_LOCATION}`);

    if (!contact) {
      console.log(`[GHL Webhook] Contact not found: ${contactId}`);
      return;
    }

    // Extract vehicle info
    const customFields = contact.customFields || [];
    const vehicleYear = extractCustomField(customFields, FIELD_IDS.vehicle_year);
    const vehicleMake = extractCustomField(customFields, FIELD_IDS.vehicle_make);
    const vehicleModel = extractCustomField(customFields, FIELD_IDS.vehicle_model);
    const vehicleTrim = extractCustomField(customFields, FIELD_IDS.vehicle_trim);
    const vehicleVin = extractCustomField(customFields, FIELD_IDS.vehicle_vin);
    const vehicleMileage = extractCustomField(customFields, FIELD_IDS.vehicle_mileage);
    const claimValue = extractCustomField(customFields, FIELD_IDS.claimValue);
    const notes = extractCustomField(customFields, FIELD_IDS.notes);
    const accidentDate = extractCustomField(customFields, FIELD_IDS.accidentDate);

    // Check if case already exists in Mission Control
    const existingClaim = await client.query('claims:listByGhl', {
      ghlId: contactId,
    });

    if (existingClaim && existingClaim.length > 0) {
      console.log(`[GHL Webhook] Case already exists for ${contactId}, updating...`);
      // Update existing case
      await client.mutation('claims:update', {
        id: existingClaim[0]._id,
        clientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        carrier: extractCustomField(customFields, 'carrier_field_id') || 'Unknown',
        year: vehicleYear ? parseInt(vehicleYear) : undefined,
        make: vehicleMake,
        model: vehicleModel,
        vin: vehicleVin,
        ghlId: contactId,
      });
    } else {
      console.log(`[GHL Webhook] Creating new case for ${contactId}`);
      // Create new case in Mission Control
      await client.mutation('claims:create', {
        clientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        clientEmail: contact.email || '',
        clientPhone: contact.phone || '',
        status: 'intake',
        stage: 'intake',
        carrier: 'Unknown',
        claimType: 'ACV',
        year: vehicleYear ? parseInt(vehicleYear) : undefined,
        make: vehicleMake,
        model: vehicleModel,
        vin: vehicleVin,
        daysOpen: 0,
        nextAction: 'Review vehicle data and estimate',
        priority: 'high',
        ghlId: contactId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      console.log(`[GHL Webhook] ✅ Case created for ${contact.firstName} ${contact.lastName}`);
    }
  } catch (e: any) {
    console.error(`[GHL Webhook] Error syncing ${contactId}:`, e.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log(`[GHL Webhook] Received event:`, body.type);

    // Handle different event types
    switch (body.type) {
      case 'contact.created':
      case 'contact.updated':
        // Contact was created or updated in GHL
        if (body.data?.id) {
          await syncContactToMissionControl(body.data.id);
        }
        break;

      case 'appointment.created':
        // Call was booked
        if (body.data?.contactId) {
          console.log(`[GHL Webhook] Call booked for contact ${body.data.contactId}`);
          await syncContactToMissionControl(body.data.contactId);
        }
        break;

      case 'file.created':
      case 'file.updated':
        // File was uploaded (e.g., estimate/evaluation)
        if (body.data?.contactId) {
          console.log(`[GHL Webhook] File uploaded for contact ${body.data.contactId}`);
          await syncContactToMissionControl(body.data.contactId);
        }
        break;

      default:
        console.log(`[GHL Webhook] Unhandled event type: ${body.type}`);
    }

    return NextResponse.json({ ok: true, message: 'Webhook processed' });
  } catch (e: any) {
    console.error('[GHL Webhook] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
