#!/bin/bash
set -e

# The monolith owns `finances` (created by POSTGRES_DB=finances). The ledger's
# event store and projections live in their own database on the same instance
# (EP-0.5, spec §6). Runs only on a fresh data volume — to pick it up on an
# existing one, create the database by hand or recreate the volume.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE DATABASE ledger;
SQL
