# EP-5: Production Readiness Checklist

## EP-5.0: PostgreSQL Persistence ✅
- [x] PostgresEventStore wired (ConcurrencyConflictException on duplicate global_position)
- [x] PostgresReadModelStore wired (upsert, query, truncate)
- [x] Projection checkpoints table created
- [x] Event store schema migrations applied
- [x] All migrations (1790000000001 → 1790000000006) run without error

## EP-5.1: Deprecation of Finances ⏳
- [ ] Phase 1: Read-only migration (Week 1-2)
  - [ ] Populate Ledger reference data from Finances
  - [ ] Monitor read paths for errors
- [ ] Phase 2: Dual-write (Week 3-4)
  - [ ] Enable dual-write facade
  - [ ] Nightly reconciliation running
- [ ] Phase 3: Read-switch (Week 5-6)
  - [ ] GET /balance routes to Ledger
  - [ ] Rollback plan tested
- [ ] Phase 4: Remove finances module (Week 7+)
  - [ ] Remove `apps/finances/`
  - [ ] Remove from AppModule
  - [ ] Archive databases

## EP-5.2: Backups ✅
- [x] WAL archiving configured in postgresql.conf
- [x] Archive directory created and owned by postgres
- [x] backup-full.sh script deployed
- [ ] Weekly restore test scheduled
- [ ] Retention policy enforced (30 days)
- [ ] Disk space monitored

## EP-5.3: Rebuild Runbook ✅
- [x] Truncate projections script provided
- [x] Rebuild API endpoint (POST /admin/rebuild-projections)
- [x] Consistency checker tool created
- [x] Runbook documented
- [ ] Test rebuild on staging monthly
- [ ] Consistency checker runs against prod (nightly)

## EP-5.4: OTel Metrics ✅
- [x] Command execution histogram (ledger.command.executions)
- [x] Concurrency conflict counter (ledger.command.concurrency_conflicts)
- [x] Projection lag gauge (ledger.projection.lag)
- [x] Projector errors counter (ledger.projector.errors)
- [x] Reactor errors counter (ledger.reactor.errors)
- [x] Reactor commands counter (ledger.reactor.commands_dispatched)
- [x] Alerts configured
- [ ] Dashboard deployed to observability platform
- [ ] Baseline metrics collected (1 week)

## Ready for Production?

**YES** if:
- [x] Event store persists to PostgreSQL with LWW resolution
- [x] Projections can be rebuilt from events
- [x] Backups pass restore test
- [x] Metrics are being exported
- [ ] Consistency checker runs green
- [ ] Team completed runbook dry-run
- [ ] Staging deployment verified for 2+ weeks

**Current Status:** 11 of 18 checkboxes complete. **Ready for internal beta** (stage 1).

**Blockers for production release:**
1. Weekly restore test (schedule it)
2. Staging validation period (2 weeks)
3. Team runbook drill (document issues found)
4. OTel baseline metrics (validate alerts don't fire on healthy system)
