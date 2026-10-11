#!/bin/sh
# One backup: dump -> test-restore into a scratch DB -> bundle with settings -> encrypt -> prune.
# Connection comes from PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
set -eu
umask 077
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is not set (public backup key in .env)}"
OUT=/backups
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
  'migrations', (SELECT count(*) FROM _prisma_migrations))") || fail "verify counts"
[ "$(echo "$COUNTS" | sed 's/.*"companies": \([0-9]*\).*/\1/')" -ge 1 ] || fail "verify: no companies in restored copy"
dropdb --force "$VERIFY_DB"

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
