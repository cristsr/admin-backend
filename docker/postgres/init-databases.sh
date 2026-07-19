#!/bin/bash
set -e

# The monolith uses a single database (created by POSTGRES_DB=finances). The
# former per-service `users`/`exchanges` databases were folded into it, so
# there is nothing extra to create here.
