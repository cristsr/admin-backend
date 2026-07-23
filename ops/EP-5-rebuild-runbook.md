# EP-5.3: Rebuild Runbook + Consistency Checker

## Full Projection Rebuild

Use this procedure after a corruption or when syncing a replica.

### Prerequisites
- Event store is intact and consistent
- Read-model database is writable
- Ledger app is **stopped**

### Procedure

#### Step 1: Truncate projections
```bash
psql -U postgres -d ledger -c "
  TRUNCATE proj_accounts, proj_balances, proj_transactions, 
           proj_ledger_settings, proj_currencies, proj_prices,
           proj_budgets, proj_goals, proj_adjustment_audit CASCADE;
"
```

#### Step 2: Reset checkpoints
```bash
psql -U postgres -d ledger -c "
  DELETE FROM projection_checkpoints;
"
```

#### Step 3: Run rebuild via API
```bash
curl -X POST http://localhost:3000/admin/rebuild-projections \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

The rebuild stream processes all events from position 0, reapplying each event to projectors until all projections are caught up.

**Expected output:**
```json
{
  "status": "completed",
  "events_processed": 123456,
  "projections_rebuilt": [
    "proj_accounts",
    "proj_balances",
    "proj_transactions",
    ...
  ],
  "duration_seconds": 45
}
```

#### Step 4: Verify
```bash
psql -U postgres -d ledger -c "
  SELECT projection_name, last_position, updated_at 
  FROM projection_checkpoints 
  ORDER BY last_position DESC;
"
```

All projections must show `last_position` matching the latest event in the event store.

#### Step 5: Restart app
```bash
systemctl start ledger-app
systemctl status ledger-app
```

## Consistency Checker (Offline Tool)

Computes aggregates from events and compares against projections to detect data anomalies.

### Build
```bash
cd apps/ledger
npm run build:consistency-checker
```

### Run
```bash
node dist/consistency-checker.js \
  --event-store postgres://localhost/ledger \
  --read-model postgres://localhost/ledger \
  --sample-size 100 \
  --output-file consistency-report.json
```

### Sample Output
```json
{
  "status": "PASSED",
  "timestamp": "2026-07-23T15:30:00Z",
  "checks": [
    {
      "name": "Account balances match sum of movements",
      "samples_checked": 100,
      "failures": 0
    },
    {
      "name": "All transactions are accounted in movements",
      "samples_checked": 100,
      "failures": 0
    }
  ],
  "anomalies": [],
  "duration_seconds": 23
}
```

### Failure Response
If anomalies are detected:
```json
{
  "status": "FAILED",
  "anomalies": [
    {
      "type": "ORPHAN_MOVEMENT",
      "description": "Movement references non-existent account",
      "account_id": "acc-123",
      "movement_id": "mov-456"
    }
  ]
}
```

**Action:** Stop the app, investigate event log, restore from backup if necessary.

## Deployment Checklist

- [ ] Event store backups pass restore test
- [ ] Consistency checker runs cleanly on prod
- [ ] Projection rebuild completes in < 5 minutes
- [ ] All projections recover to latest position within 30 seconds of app restart
- [ ] Monitoring alerts are in place for projection lag > 5 seconds
