# EP-5.2: Backup Strategy for Event Store

## Overview
The Ledger event store (table `events` in PostgreSQL) is append-only and immutable. Production backups use PostgreSQL WAL archiving (Write-Ahead Logging) to guarantee zero data loss.

## WAL Archiving Setup

### Configuration
Add to `postgresql.conf`:
```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
archive_timeout = 300
```

### Archive Directory
```bash
mkdir -p /var/lib/postgresql/archive
chown postgres:postgres /var/lib/postgresql/archive
chmod 700 /var/lib/postgresql/archive
```

### Full Backup (Daily)
```bash
#!/bin/bash
# backup-full.sh
pg_basebackup -D /backups/ledger-$(date +%Y%m%d) -Ft -z -P -l "daily-$(date +%Y%m%d)" -h localhost -U postgres
```

### Point-in-Time Recovery (PITR)
If corruption or data loss occurs:
```bash
# 1. Stop ledger app
systemctl stop ledger-app

# 2. Restore base backup
cd /var/lib/postgresql/main
rm -rf *
tar -xzf /backups/ledger-20260723/base.tar.gz

# 3. Restore WAL archive
cp -r /archive/* /var/lib/postgresql/main/pg_wal/

# 4. Create recovery.signal (PostgreSQL 12+)
touch /var/lib/postgresql/main/recovery.signal

# 5. Set target time (optional)
cat > /var/lib/postgresql/main/recovery.conf <<EOF
recovery_target_timeline = 'latest'
recovery_target_time = '2026-07-23 14:30:00'
EOF

# 6. Restart PostgreSQL
systemctl start postgresql

# 7. Verify recovery and restart app
systemctl start ledger-app
```

### Retention Policy
- Keep daily full backups for 30 days
- WAL files: keep until next full backup succeeds
- Test restore weekly to verify backup integrity

## Event Store Schema (Backup Scope)

Table `events` is the primary backup target:
```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  aggregate_id VARCHAR NOT NULL,
  aggregate_type VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  schema_version INT NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  global_position BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  INDEX (aggregate_id, aggregate_type)
);
```

Projections (`proj_*` tables) are **derived** and can be rebuilt from events (see EP-5.3).

## Monitoring
- Alert if `archive_command` fails
- Alert if WAL archiving lags (> 1 minute)
- Monitor disk space for `/archive` and backups
- Schedule weekly restore tests
