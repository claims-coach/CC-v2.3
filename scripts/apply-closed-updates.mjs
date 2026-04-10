/**
 * apply-closed-updates.mjs
 * Applies 'closed' stage to claims identified in the audit
 */
import { ConvexHttpClient } from 'convex/browser';

const CONVEX_URL = 'https://calm-warbler-536.convex.cloud';
const client = new ConvexHttpClient(CONVEX_URL);

// Claims identified as closed by audit-unassigned.mjs
// (determined by GHL conversation keywords)
const CLOSED_CLAIMS = [
  { id: 'j574rqrzaeg7wrv85cj3dwe6zd82d4h6', name: 'tari rawson' },
  { id: 'j57f85bn7gtsvsv565ew10x3g582c8gj', name: 'tianyi cui' },
  { id: 'j577treq58rt4wxqjttqn9k4sd82djv6', name: 'carter pannell' },
  { id: 'j572twnqrm89x2ysse02ef003h82ck42', name: 'john ellis' },
  { id: 'j57egw34m4zcxhbnxtkxmd6hc982dkqq', name: 'carl mustoe' },
  { id: 'j5726s8sx03pa57379ajjsh1ks82c7ja', name: 'lucas hill' },
  { id: 'j576g5k8pkqhm2ftwvper1jhvn82dvaz', name: 'jacinda boso' },
];

// Get the IDs for patrick shannon (#20) and jessica sawin (#22) from the live claims
async function main() {
  console.log('🔍 Loading all claims to find remaining IDs...');
  const allClaims = await client.query('claims:list', {});
  
  const toFind = ['patrick shannon', 'jessica sawin'];
  for (const name of toFind) {
    const match = allClaims.find(c => c.clientName?.toLowerCase() === name);
    if (match) {
      CLOSED_CLAIMS.push({ id: match._id, name });
      console.log(`  Found ${name}: ${match._id}`);
    }
  }

  console.log(`\n📝 Applying 'closed' stage to ${CLOSED_CLAIMS.length} claims...\n`);
  
  let success = 0;
  let failed = 0;

  for (const claim of CLOSED_CLAIMS) {
    try {
      await client.mutation('claims:updateStage', { id: claim.id, stage: 'closed' });
      console.log(`  ✅ ${claim.name} → closed`);
      success++;
    } catch (e) {
      console.error(`  ❌ ${claim.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Updated: ${success} | ❌ Failed: ${failed}`);
}

main().catch(console.error);
