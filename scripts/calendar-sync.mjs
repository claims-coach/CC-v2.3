/**
 * calendar-sync.mjs
 * Fetches GHL consultation calendar events and upserts into Convex.
 * Syncs: past 30 days + next 60 days to catch all relevant appointments.
 *
 * Calendars:
 *   LbMYTNHF582imp0fx7bw — "Appraisal Consultation with Johnny"
 *   YTYwvLvWaO0WAMgwHVSp — "$200 - 1 on 1 Consultation with Johnny!"
 *   uOYapA76JzNhuVBDRpRu — "$200 - 1 on 1 Consultation with Johnny"
 */
import { ConvexHttpClient } from 'convex/browser';

const GHL_KEY = 'pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1';
const LOC = 'Lud9I0SSpb992pgRS4gJ';
const CONVEX_URL = 'https://calm-warbler-536.convex.cloud';

const CALENDARS = [
  { id: 'LbMYTNHF582imp0fx7bw', name: 'Appraisal Consultation with Johnny' },
  { id: 'YTYwvLvWaO0WAMgwHVSp', name: '$200 - 1 on 1 Consultation with Johnny!' },
  { id: 'uOYapA76JzNhuVBDRpRu', name: '$200 - 1 on 1 Consultation with Johnny' },
];

const client = new ConvexHttpClient(CONVEX_URL);

/**
 * Parse GHL datetime string "2025-02-07 13:30:00" to epoch ms (UTC)
 * GHL appears to store times in account timezone (America/Los_Angeles)
 */
function parseGHLTime(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  // "2025-02-07 13:30:00" → assume Pacific time
  // Using Date.parse with T and Z would be wrong; use as local approximation
  const iso = str.replace(' ', 'T') + '-08:00'; // PST offset (approximate)
  const ms = Date.parse(iso);
  return isNaN(ms) ? new Date(str).getTime() : ms;
}

async function fetchCalendarEvents(calendarId, startMs, endMs) {
  const url = `https://services.leadconnectorhq.com/calendars/events?locationId=${LOC}&calendarId=${calendarId}&startTime=${startMs}&endTime=${endMs}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GHL_KEY}`,
      'Version': '2021-07-28',
    }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ❌ GHL API error for ${calendarId}: ${res.status} ${text.slice(0, 200)}`);
    return [];
  }
  const data = await res.json();
  return data.events || data.appointments || [];
}

async function main() {
  const now = Date.now();
  const startMs = now - 30 * 24 * 60 * 60 * 1000;  // 30 days back
  const endMs   = now + 60 * 24 * 60 * 60 * 1000;  // 60 days forward

  console.log(`🗓️  GHL Calendar Sync — ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`);
  console.log(`   Range: -30 days → +60 days\n`);

  let totalFetched = 0;
  let totalUpserted = 0;
  let errors = 0;

  for (const cal of CALENDARS) {
    console.log(`📅 Calendar: ${cal.name}`);
    const events = await fetchCalendarEvents(cal.id, startMs, endMs);
    console.log(`   Fetched ${events.length} events`);

    for (const ev of events) {
      try {
        const eventId = ev.id || ev.appointmentId || ev._id;
        if (!eventId) {
          console.warn(`   ⚠️  Skipping event with no ID`);
          continue;
        }

        // Parse GHL datetime strings
        const startTime = parseGHLTime(ev.startTime);
        const endTime = parseGHLTime(ev.endTime) || startTime + 3600000;

        const contactId = ev.contactId || ev.contact?.id || undefined;
        const contactName = ev.title ||
          (ev.contact ? `${ev.contact.firstName || ''} ${ev.contact.lastName || ''}`.trim() : undefined) ||
          'Consultation';

        // Skip deleted events
        if (ev.deleted === true) {
          console.log(`   ⏭️  Skipped (deleted): ${contactName}`);
          continue;
        }

        await client.mutation('ghlCalendar:upsertEvent', {
          eventId,
          calendarId: cal.id,
          calendarName: cal.name,
          title: contactName,
          contactId,
          contactName,
          startTime,
          endTime,
          status: ev.appointmentStatus || ev.status || 'confirmed',
          appointmentStatus: ev.appointmentStatus || undefined,
          locationId: LOC,
          notes: ev.address || ev.notes || ev.description || undefined,
        });

        totalUpserted++;
        const dateStr = new Date(startTime).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        console.log(`   ✅ ${contactName} — ${dateStr} [${ev.appointmentStatus || 'confirmed'}]`);
      } catch (e) {
        console.error(`   ❌ Failed to upsert event ${ev.id || 'unknown'}: ${e.message}`);
        errors++;
      }
    }
    totalFetched += events.length;
    console.log();
  }

  console.log('='.repeat(50));
  console.log(`📊 Sync Complete:`);
  console.log(`   Events fetched:  ${totalFetched}`);
  console.log(`   Events upserted: ${totalUpserted}`);
  console.log(`   Errors:          ${errors}`);
  console.log('='.repeat(50));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
