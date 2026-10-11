#!/bin/sh
# Restore a backup. The private key is read from standard input, never stored.
#
#   Check a backup (restores into a separate database, the live one is untouched):
#     podman compose exec -T backup restore.sh clinicdb-20261011-023000.tar.age < key.txt
#
#   Disaster recovery (replaces the live database; the old one is kept, renamed):
#     podman compose exec -T backup restore.sh clinicdb-20261011-023000.tar.age --replace-live < key.txt
set -eu
FILE="${1:?usage: restore.sh <backup file> [--replace-live] < private-key.txt}"
MODE="${2:-check}"
[ -f "/backups/$FILE" ] || { echo "No such backup: $FILE (see: ls ~/ClinicDB/backups)"; exit 1; }
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
cat > "$WORK/key"; chmod 600 "$WORK/key"
grep -q AGE-SECRET-KEY "$WORK/key" || { echo "No private key on standard input (… < key.txt)"; exit 1; }

age -d -i "$WORK/key" -o "$WORK/bundle.tar" "/backups/$FILE"
tar -C "$WORK" -xf "$WORK/bundle.tar"
rm -f "$WORK/key"

if [ "$MODE" = "--replace-live" ]; then
  KEEP="${PGDATABASE}_before_restore_$(date +%Y%m%d%H%M%S)"
  psql -d postgres -v ON_ERROR_STOP=1 -tAc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$PGDATABASE' AND pid <> pg_backend_pid()" >/dev/null
  psql -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$PGDATABASE\" RENAME TO \"$KEEP\""
  TARGET="$PGDATABASE"
  echo "Live database kept as $KEEP"
else
  TARGET="${PGDATABASE}_restore_check"
  dropdb --if-exists --force "$TARGET"
fi
createdb "$TARGET"
pg_restore --no-owner --exit-on-error --dbname="$TARGET" "$WORK/database.dump"
echo "Restored $FILE into database '$TARGET':"
psql -d "$TARGET" -c "SELECT (SELECT count(*) FROM \"User\") AS users, (SELECT count(*) FROM \"AuditLog\") AS audit_entries, (SELECT max(at) FROM \"AuditLog\") AS newest_entry"
[ -f "$WORK/app.env" ] && echo "The backup also contains the settings file (.env) with APP_SECRET."
if [ "$MODE" != "--replace-live" ]; then
  echo "This was a check only; the live database was not touched. Remove the copy with:"
  echo "  podman compose exec backup dropdb --force $TARGET"
fi
