# EP-5.1: Deprecation Strategy for `finances` Module

## Overview
The `apps/finances` monolith (users, exchanges, accounts legacy) is deprecated in favor of the event-sourced Ledger. This document outlines the retirement timeline and data migration path.

## Phase 1: Read-Only Migration (Week 1-2)
- Deploy Ledger alongside Finances (dual-write mode disabled for now)
- Migrate reference data: users, currencies, base accounts
- **Action:** Populate `ledger.users`, `ledger.accounts`, `ledger.currencies` from `finances` snapshot
- Client traffic: still routed to Finances

## Phase 2: Dual-Write (Week 3-4)
- Enable dual-write in a facade service: all account/transaction mutations go to both Finances and Ledger
- Run nightly reconciliation: flag any divergences
- **Action:** Populate `ledger.transactions`, `ledger.movements` from Finances events
- Client traffic: still routed to Finances; Ledger is write-only
- Monitoring: lag alert if Ledger transactions lag > 100

## Phase 3: Read-Switch (Week 5-6)
- Route reads to Ledger (queries: balances, transactions, net worth)
- Writes still dual-write to both systems
- **Action:** Cutover `GET /accounts/{id}/balance` to query Ledger projections
- Rollback plan: if Ledger query errors, fallback to Finances
- Monitoring: alert on read lag (projection checkpoint drift > 30 sec)

## Phase 4: Deprecation (Week 7+)
- Disable all writes to Finances (`finances` module removed from AppModule)
- Ledger is sole system of record
- **Action:** Remove:
  - `apps/finances/` directory
  - Finance imports from `app.module.ts`
  - Finance migrations
- Data is permanently in Ledger event store and projections
- Rollback: restore from git tag `pre-finances-deprecation`

## Data Retention
- Finances database: can be archived (historical reference)
- Ledger event store: permanent (immutable)
- Ledger projections: can be rebuilt from events

## Communication
1. Week 1: Announce to teams (Ledger now primary; Finances maintenance frozen)
2. Week 3: Dual-write begins (no visible change)
3. Week 5: Read traffic switches (monitor error logs closely)
4. Week 7: Finances module retired (internal implementation only)

## Known Issues
- Finances had no audit trail for balance adjustments; Ledger captures via `AdjustmentCreated` events
- Some legacy transactions may lack metadata; Ledger requires explicit categorization
- Currency precision: Finances used decimals, Ledger enforces string arithmetic (INV-8)
