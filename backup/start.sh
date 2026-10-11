#!/bin/sh
# Runs the nightly schedule. If the last good backup is older than a day
# (e.g. the computer was off at 02:30), make one now.
set -eu
: "${BACKUP_TIME:=30 2}"
echo "${BACKUP_TIME} * * * /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

until pg_isready -q; do sleep 2; done
recent=$(psql -tAc "SELECT count(*) FROM \"BackupRun\" WHERE status = 'ok' AND \"startedAt\" > now() - interval '24 hours'" 2>/dev/null || echo 0)
if [ "$recent" = "0" ]; then backup.sh || true; fi

echo "Backups scheduled daily at $(echo "$BACKUP_TIME" | awk '{printf "%02d:%02d", $2, $1}') Athens time."
exec crond -f -l 8
