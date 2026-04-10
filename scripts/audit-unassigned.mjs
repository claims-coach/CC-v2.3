/**
 * audit-unassigned.mjs
 * Checks first 30 unassigned claims in Convex against GHL conversation history
 * Updates stage to 'closed' if GHL conversation shows resolution
 */
import { ConvexHttpClient } from 'convex/browser';

const GHL_KEY = 'pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1';
const LOC = 'Lud9I0SSpb992pgRS4gJ';
const H = {
  'Authorization': 'Bearer ' + GHL_KEY,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};

const CONVEX_URL = 'https://calm-warbler-536.convex.cloud';
const client = new ConvexHttpClient(CONVEX_URL);

const CLOSED_KEYWORDS = ['settled', 'closed', 'paid', 'complete', 'resolved', 'done', 'finalized', 'accepted', 'awarded', 'won', 'check received'];

function isClosedConvo(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CLOSED_KEYWORDS.some(kw => lower.includes(kw));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getGHLContact(name) {
  try {
    const url = `https://services.leadconnectorhq.com/contacts/?locationId=${LOC}&query=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: H });
    if (!res.ok) return null;
    const data = await res.json();
    return data.contacts?.[0] || null;
  } catch (e) {
    return null;
  }
}

async function getLastConversationText(contactId) {
  try {
    // Search for conversation
    const convRes = await fetch(
      `https://services.leadconnectorhq.com/conversations/search?contactId=${contactId}&locationId=${LOC}`,
      { headers: H }
    );
    if (!convRes.ok) return null;
    const convData = await convRes.json();
    const convId = convData.conversations?.[0]?.id;
    if (!convId) return null;

    // Get messages
    const msgRes = await fetch(
      `https://services.leadconnectorhq.com/conversations/${convId}/messages`,
      { headers: H }
    );
    if (!msgRes.ok) return null;
    const msgData = await msgRes.json();
    const messages = msgData.messages?.messages || msgData.messages || [];
    if (!messages.length) return null;

    // Combine last 5 messages for context
    const last5 = messages.slice(-5);
    return last5.map(m => m.body || m.text || m.message || '').join(' ').trim();
  } catch (e) {
    return null;
  }
}

async function updateClaimStage(claimId, stage, notes) {
  try {
    await client.mutation('claims:update', { id: claimId, stage, notes });
    return true;
  } catch (e) {
    console.error(`  ❌ Failed to update ${claimId}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Fetching unassigned claims from Convex...');
  const allClaims = await client.query('claims:list', {});
  const unassigned = allClaims.filter(c => c.stage === 'unassigned' || !c.stage);
  console.log(`📋 Found ${unassigned.length} unassigned claims. Processing first 30...\n`);

  const batch = unassigned.slice(0, 30);

  let closedCount = 0;
  let activeCount = 0;
  let notFoundCount = 0;
  const results = [];

  for (let i = 0; i < batch.length; i++) {
    const claim = batch[i];
    const name = claim.clientName;
    console.log(`[${i+1}/30] ${name} (ID: ${claim._id})`);

    // Rate limit GHL calls
    if (i > 0) await sleep(300);

    // Look up in GHL
    const ghlContact = await getGHLContact(name);

    if (!ghlContact) {
      console.log(`  ⚠️  Not found in GHL`);
      notFoundCount++;
      results.push({ name, status: 'not_found_in_ghl', id: claim._id });
      continue;
    }

    console.log(`  ✓ GHL contact: ${ghlContact.id} (${ghlContact.email || 'no email'})`);

    await sleep(200);
    const lastText = await getLastConversationText(ghlContact.id);

    if (!lastText) {
      console.log(`  💬 No conversation found`);
      activeCount++;
      results.push({ name, status: 'no_conversation', ghlId: ghlContact.id, id: claim._id });
      continue;
    }

    const preview = lastText.substring(0, 100).replace(/\n/g, ' ');
    console.log(`  💬 Last msg: "${preview}..."`);

    if (isClosedConvo(lastText)) {
      console.log(`  ✅ CLOSED — updating stage`);
      const notes = `Auto-audited ${new Date().toISOString().split('T')[0]}: GHL conversation indicates case resolved. Last message: "${preview}"`;
      await updateClaimStage(claim._id, 'closed', notes);
      closedCount++;
      results.push({ name, status: 'closed', ghlId: ghlContact.id, id: claim._id, preview });
    } else {
      console.log(`  📂 Active — no keywords found`);
      activeCount++;
      results.push({ name, status: 'active', ghlId: ghlContact.id, id: claim._id, preview });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed:    ${batch.length}`);
  console.log(`✅ Closed:          ${closedCount}`);
  console.log(`📂 Active:          ${activeCount}`);
  console.log(`⚠️  Not in GHL:     ${notFoundCount}`);
  console.log('='.repeat(60));

  // Print detailed results
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((r, i) => {
    const icon = r.status === 'closed' ? '✅' : r.status === 'not_found_in_ghl' ? '⚠️' : '📂';
    console.log(`${i+1}. ${icon} ${r.name} → ${r.status}`);
    if (r.preview) console.log(`   "${r.preview}"`);
  });
}

main().catch(console.error);
