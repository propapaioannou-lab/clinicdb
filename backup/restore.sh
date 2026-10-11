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
B="${BACKUP_DIR:-/backups}"
[ -f "$B/$FILE" ] || { echo "No such backup: $FILE (see: ls ~/ClinicDB/backups)"; exit 1; }
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
cat > "$WORK/key"; chmod 600 "$WORK/key"
grep -q AGE-SECRET-KEY "$WORK/key" || { echo "No private key on standard input (… < key.txt)"; exit 1; }

age -d -i "$WORK/key" -o "$WORK/bundle.tar" "$B/$FILE"
tar -C "$WORK" -xf "$WORK/bundle.tar"

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

# Documents: decrypt each file of this backup and compare it with its fingerprint.
psql -d "$TARGET" -v ON_ERROR_STOP=1 -tAF' ' -c 'SELECT "storageKey", sha256 FROM "Document"' > "$WORK/docs"
if [ -s "$WORK/docs" ]; then
  if [ "$MODE" = "--replace-live" ]; then DOCS_TO="$B/restored-documents-$(date +%Y%m%d%H%M%S)"; else DOCS_TO="$WORK/documents"; fi
  OK=0; BAD=0
  while read -r key sum; do
    [ -n "$key" ] || continue
    mkdir -p "$(dirname "$DOCS_TO/$key")"
    if age -d -i "$WORK/key" -o "$DOCS_TO/$key" "$B/documents/$key.age" 2>/dev/null && [ "$(sha256sum "$DOCS_TO/$key" | cut -d' ' -f1)" = "$sum" ]; then
      OK=$((OK + 1))
    else
      BAD=$((BAD + 1)); echo "  document NOT OK: $key"
    fi
  done < "$WORK/docs"
  echo "Documents: $OK restored and checked, $BAD missing or damaged."
  if [ "$MODE" = "--replace-live" ]; then
    echo "The documents are in ~/ClinicDB/backups/$(basename "$DOCS_TO"). Put them back into the app's documents volume with:"
    echo "  podman run --rm -v clinicdb_documents:/data -v ~/ClinicDB/backups/$(basename "$DOCS_TO"):/src:ro,z docker.io/library/alpine cp -a /src/. /data/"
    echo "then delete that folder."
  fi
fi
rm -f "$WORK/key"
[ -f "$WORK/app.env" ] && echo "The backup also contains the settings file (.env) with APP_SECRET."
if [ "$MODE" != "--replace-live" ]; then
  echo "This was a check only; the live database was not touched. Remove the copy with:"
  echo "  podman compose exec backup dropdb --force $TARGET"
fi
