#!/bin/sh
# One backup: dump -> test-restore into a scratch DB -> bundle with settings -> encrypt -> prune.
# Connection comes from PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
set -eu
umask 077
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is not set (public backup key in .env)}"
OUT="${BACKUP_DIR:-/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
NAME="clinicdb-${STAMP}.tar.age"
WORK=$(mktemp -d)
VERIFY_DB="${PGDATABASE}_backup_verify"
trap 'rm -rf "$WORK"; dropdb --if-exists --force "$VERIFY_DB" 2>/dev/null || true' EXIT

sql() { psql -q -v ON_ERROR_STOP=1 -tAc "$1"; }
RUN_ID=$(sql "INSERT INTO \"BackupRun\" (id, status) VALUES ('br_' || md5(random()::text), 'running') RETURNING id")

fail() {
  msg=$(printf '%s' "$1" | tr -d "'" | head -c 500)
  sql "UPDATE \"BackupRun\" SET status = 'failed', \"finishedAt\" = now(), details = jsonb_build_object('error', '$msg') WHERE id = '$RUN_ID'" || true
  sql "INSERT INTO \"AuditLog\" (action, \"actorEmail\", details) VALUES ('backup.failed', 'backup-service', jsonb_build_object('error', '$msg'))" || true
  echo "$(date '+%F %T') BACKUP FAILED: $1" >&2
  exit 1
}

echo "$(date '+%F %T') Backup ${NAME} starting"
pg_dump --format=custom --compress=9 --file="$WORK/database.dump" 2>"$WORK/err" || fail "pg_dump: $(cat "$WORK/err")"

# Test: the copy must restore cleanly. Row counts are recorded.
dropdb --if-exists --force "$VERIFY_DB" 2>/dev/null
createdb "$VERIFY_DB" || fail "createdb verify"
pg_restore --no-owner --exit-on-error --dbname="$VERIFY_DB" "$WORK/database.dump" 2>"$WORK/err" || fail "test restore: $(cat "$WORK/err")"
COUNTS=$(psql -d "$VERIFY_DB" -v ON_ERROR_STOP=1 -tAc "SELECT jsonb_build_object(
  'users', (SELECT count(*) FROM \"User\"),
  'auditLog', (SELECT count(*) FROM \"AuditLog\"),
  'companies', (SELECT count(*) FROM \"Company\"),
  'migrations', (SELECT count(*) FROM _prisma_migrations),
  'documents', (SELECT count(*) FROM \"Document\"))") || fail "verify counts"
[ "$(echo "$COUNTS" | sed 's/.*"companies": \([0-9]*\).*/\1/')" -ge 1 ] || fail "verify: no companies in restored copy"
psql -d "$VERIFY_DB" -v ON_ERROR_STOP=1 -tAc 'SELECT "storageKey" FROM "Document"' > "$WORK/document-keys" || fail "verify: document list"
dropdb --force "$VERIFY_DB"

# Documents: each file is encrypted once into backups/documents/<storage key>.age and never
# changes (documents are never edited or removed), so each night adds only new files.
DOCS_IN="${DOCUMENTS_DIR:-/documents}"
DOCS_OUT="$OUT/documents"
NEW_DOCS=0
if [ -d "$DOCS_IN" ]; then
  mkdir -p "$DOCS_OUT"
  while IFS= read -r key; do
    [ -n "$key" ] || continue
    dest="$DOCS_OUT/$key.age"
    [ -f "$dest" ] && continue
    [ -f "$DOCS_IN/$key" ] || fail "document file missing on the server: $key"
    mkdir -p "$(dirname "$dest")"
    age -r "$BACKUP_AGE_RECIPIENT" -o "$dest.part" "$DOCS_IN/$key" || fail "document encryption: $key"
    mv "$dest.part" "$dest"
    NEW_DOCS=$((NEW_DOCS + 1))
  done < "$WORK/document-keys"
fi
# Test: every document in this backup has its encrypted file.
MISSING=0
while IFS= read -r key; do
  [ -n "$key" ] && [ ! -f "$DOCS_OUT/$key.age" ] && MISSING=$((MISSING + 1))
done < "$WORK/document-keys"
[ "$MISSING" -eq 0 ] || fail "verify: $MISSING document files have no backup copy"
COUNTS=$(echo "$COUNTS" | sed "s/}\$/, \"newDocuments\": $NEW_DOCS}/")

# Settings (.env) travel with the database: APP_SECRET is needed to read 2FA secrets.
[ -f /config/app.env ] && cp /config/app.env "$WORK/app.env"
tar -C "$WORK" -cf "$WORK/bundle.tar" database.dump $( [ -f "$WORK/app.env" ] && echo app.env )
age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT/.${NAME}.part" "$WORK/bundle.tar" || fail "encryption"
mv "$OUT/.${NAME}.part" "$OUT/$NAME"
SIZE=$(stat -c %s "$OUT/$NAME")

sql "UPDATE \"BackupRun\" SET status = 'ok', \"finishedAt\" = now(), \"fileName\" = '$NAME', \"sizeBytes\" = $SIZE, verified = true, details = '$COUNTS'::jsonb WHERE id = '$RUN_ID'"
sql "INSERT INTO \"AuditLog\" (action, \"actorEmail\", details) VALUES ('backup.completed', 'backup-service', jsonb_build_object('file', '$NAME', 'sizeBytes', $SIZE) || '$COUNTS'::jsonb)"
echo "$(date '+%F %T') Backup ${NAME} done ($SIZE bytes, verified: $COUNTS)"

prune.sh "$OUT"
