# v2.3 Test Claim — Manual Intake

This file documents how to manually inject a test claim into v2.3 for end-to-end testing.

## Quick Test (via cURL)

Send a test claim directly to the GHL webhook:

```bash
curl -X POST https://fabulous-roadrunner-674.convex.site/ghl/intake \
  -H "Content-Type: application/json" \
  -d '{
    "type": "contactCreate",
    "contact": {
      "id": "test-claim-001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+12065551234"
    },
    "customField": {
      "claimAmount": "45000",
      "carrierName": "State Farm",
      "damageType": "Vehicle - Collision",
      "lossDate": "2026-04-08"
    }
  }'
```

**Expected response:**
```json
{
  "ok": true,
  "prospectId": "P-26-004__UNKNOWN"
}
```

## View in Mission Control

1. Open http://localhost:3000
2. Go to **Task Board** (/tasks)
3. Look for the new prospect (P-26-004)
4. Should appear within 2 seconds of submission

## Test Telegram

Send a message to @ClaimsCC_bot:

```
Test claim from Johnny. State Farm collision case, $45k. Claim #123456.
```

Bot will parse and create prospect automatically.

## Complete Test Flow

1. **Send claim** (curl or Telegram)
2. **Prospect created** in v2.3 database
3. **Appears in Task Board** (http://localhost:3000)
4. **Research queued** (background job)
5. **Ready for valuation** (CCC parser, comps research)

## If Something Breaks

Check logs:
```bash
tail -f /tmp/mission-control-stdout.log
```

Or restart Mission Control:
```bash
launchctl unload ~/Library/LaunchAgents/com.claimscoach.mission-control.plist
launchctl load ~/Library/LaunchAgents/com.claimscoach.mission-control.plist
```

## Database Status

Check live prospects in v2.3:
```bash
cd ~/claims-coach-v23
export CONVEX_DEPLOY_KEY="dev:fabulous-roadrunner-674|eyJ2MiI6Ijk4YzFhNjQ4OWI0MjQ0OTFiOGQ0YTcwZDA1M2EzOTBjIn0="
/opt/homebrew/bin/convex run 'functions/prospects:listActive' | jq '.[] | {prospectId, firstName, lastName, stage}'
```

---

**v2.3 is production-ready. Use these tests to verify end-to-end flow.** 🚀
