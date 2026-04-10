/**
 * GHL Case Stamp — writes MasterCaseID and full case key into GHL contact + opportunity
 * contact.file_number         → "000150_26-AUTO-DV_Smith_GEICO"
 * opportunity.claim_file_number → "000150_26-AUTO-DV_Smith_GEICO"
 */

const GHL_KEY     = process.env.GHL_API_KEY!;
const BASE        = "https://services.leadconnectorhq.com";
const CONTACT_FIELD_ID = "SEqQE7EfHk93uZrcIA5o";   // Most Recent File Number
const OPP_FIELD_ID     = "X5fhFg7vD1Ncpqz3qpEj";   // Claim File Number

export async function stampCaseOnContact(contactId: string, caseKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/contacts/${contactId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GHL_KEY}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",
      },
      body: JSON.stringify({
        customFields: [{ id: CONTACT_FIELD_ID, field_value: caseKey }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function stampCaseOnOpportunity(opportunityId: string, caseKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/opportunities/${opportunityId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GHL_KEY}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",
      },
      body: JSON.stringify({
        customFields: [{ id: OPP_FIELD_ID, field_value: caseKey }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function stampCase(caseKey: string, contactId?: string, opportunityId?: string) {
  const results = await Promise.all([
    contactId     ? stampCaseOnContact(contactId, caseKey)         : Promise.resolve(null),
    opportunityId ? stampCaseOnOpportunity(opportunityId, caseKey) : Promise.resolve(null),
  ]);
  return { contactStamped: results[0], oppStamped: results[1] };
}
