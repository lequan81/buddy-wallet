#!/bin/bash

# Prune Worker - Native Bash Implementation
# Removes stale data directly via SQLite to avoid JS runtime overhead.

# Resolve DB path relative to script location
DB_PATH="/home/server/buddy-wallet/packages/db/database.sqlite"

# Check if sqlite3 is installed
if ! command -v sqlite3 &> /dev/null; then
    echo "Error: sqlite3 is not installed or not in PATH."
    echo "Please install SQLite3 CLI or use the Bun version."
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at $DB_PATH"
    exit 1
fi

echo "[Native Prune] Starting cleanup via sqlite3..."
START_TIME=$(date +%s%N | cut -b1-13 2>/dev/null || date +%s000)

# SQL queries comparing timestamps in milliseconds
# strftime('%s', 'now', '-1 day') returns seconds, multiply by 1000 for ms

sqlite3 "$DB_PATH" <<EOF
-- 1. Cleanup Stale Pending Import Logs (>24h)
DELETE FROM import_logs 
WHERE status = 'pending' 
AND created_at <= (cast(strftime('%s', 'now', '-1 day') as integer) * 1000);

-- 2. Cleanup Revoked/Logged Out Sessions (>24h)
DELETE FROM sessions 
WHERE status IN ('revoked', 'logged_out') 
AND revoked_at <= (cast(strftime('%s', 'now', '-1 day') as integer) * 1000);

-- 3. Cleanup Expired Sessions (>24h)
DELETE FROM sessions 
WHERE status = 'expired' 
AND refresh_token_expires_at <= (cast(strftime('%s', 'now', '-1 day') as integer) * 1000);

VACUUM;
EOF

END_TIME=$(date +%s%N | cut -b1-13 2>/dev/null || date +%s000)
DURATION=$((END_TIME - START_TIME))

echo "[Native Prune] Cleanup completed in ${DURATION}ms"
