import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // GHL booking webhook payload
    const {
      eventType,
      contact: { firstName, lastName, phone, email } = {},
      event: { title, dateTime, location } = {},
      customFields = {},
    } = payload;

    // Only process booking created events
    if (eventType !== 'contact.updated') {
      return NextResponse.json({ received: true });
    }

    // Extract vehicle data from custom fields
    const vehicleYear = parseInt(customFields.vehicle_year || '0', 10);
    const vehicleMake = customFields.vehicle_make || '';
    const vehicleModel = customFields.vehicle_model || '';
    const vehicleVin = customFields.vehicle_vin || '';
    const vehicleMileage = parseInt(customFields.vehicle_mileage || '0', 10);
    const estimateUrl = customFields.estimate_url || '';
    const carrier = customFields.insurance_carrier || 'Unknown';
    const claimType = customFields.claim_type || 'DV';

    // If we have minimal vehicle data, create a case
    if (vehicleYear && vehicleMake && vehicleModel && phone) {
      const result = await convex.mutation(api.caseManagement.createCase, {
        clientName: `${firstName} ${lastName}`,
        clientPhone: phone,
        clientEmail: email,
        carrier,
        claimType: claimType as any,
        vehicleYear,
        vehicleMake,
        vehicleModel,
        vehicleVin,
        vehicleMileage,
        insuranceEstimate: estimateUrl,
        dateOfLoss: dateTime,
        source: 'ghl_booking' as const,
        notes: `Booked from GHL: ${title}`,
      });

      console.log(`✅ Case created from GHL booking: ${result.masterId}`);

      return NextResponse.json({
        success: true,
        caseId: result.caseId,
        masterId: result.masterId,
      });
    }

    return NextResponse.json({ received: true, note: 'Insufficient vehicle data for case creation' });
  } catch (error) {
    console.error('GHL booking webhook error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
