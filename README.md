# Clinic Database

See `SPEC.md` (what we build) and `CHANGELOG.md` (what changed).

## Run on the laptop

First time only:

    cp .env.example .env      # then set a real POSTGRES_PASSWORD (openssl rand -hex 24)

Start / stop:

    podman compose up -d --build -V
    podman compose down

Open http://localhost:3000

See the app's log:

    podman compose logs -f app

## Database setup (first time, and after pulling new changes)

    podman compose exec app npx prisma migrate deploy
    podman compose exec app npx prisma db seed

## Fake patients (laptop only)

15,600 made-up patients for testing. Never run this on the real server.

    podman compose exec app npm run db:fake               # only if there are no patients yet
    podman compose exec app npm run db:fake -- --replace  # delete ALL patients, make new fake ones

## First Owner account (only once; others are invited from the app)

    podman compose exec app npx tsx scripts/create-owner.ts

Press Enter at the password question to generate a strong password (shown once).
Running it again with the same email resets that account's password.

List users and their roles:

    podman compose exec db psql -U clinicdb -d clinicdb -c 'select u.email, u.name, u.level, c.code as company from "User" u join "Membership" m on m."userId" = u.id join "Company" c on c.id = m."companyId";'

## Tests

    podman compose exec app npm test

Tests use a separate database (`clinicdb_test`), created fresh on every run.

## Test the login

1. Open http://localhost:3000 — you land on the login page.
2. Wrong password → "Λάθος email ή κωδικός."
3. Right password → home page with your name, level and "Η σύνδεση λήγει: Δευτέρα 05:00".
4. Αποσύνδεση → back to the login page.

The audit log is in the app: Αρχείο καταγραφής (Owner/Admin).

Unlock an account that hit 5 wrong passwords (otherwise it unlocks after 15 minutes):

    podman compose exec db psql -U clinicdb -d clinicdb -c "update \"User\" set \"lockedUntil\" = null, \"failedLogins\" = 0 where email = 'name@example.com';"

## After changing the database schema (developer)

    podman compose exec app npm run db:migrate -- --name what_changed
    podman compose restart app

## Backups

Every night at 02:30 (Athens) the `backup` container copies the database, **test-restores
the copy** into a scratch database, bundles it with `.env` (which holds APP_SECRET),
encrypts it and keeps 14 daily, 8 weekly and 12 monthly copies in `./backups/`.
If the computer was off at 02:30, a backup is made as soon as it starts.
**Documents** (patients' files) are backed up too: each file is encrypted once into
`./backups/documents/` and kept (documents are never changed or removed), so each night
adds only the new ones. Every backup checks that each document in the database has its
encrypted copy.
Status: in the app, Αντίγραφα (Owner/Admin). A red bar appears on every page if there
has been no good backup for 26 hours or the last one failed.

**The key.** Backups are encrypted with the public key in `.env` (`BACKUP_AGE_RECIPIENT`).
Only the private key can open them, and it is kept **off the server** (password manager
or printed). Lose it and the backups cannot be opened. On this laptop the test key is
`.backup-key.dev.txt`; the Synology gets its own key at deployment.

Make a backup now:

    podman compose exec backup backup.sh

List backups:

    ls -l ~/ClinicDB/backups

**Check a backup** (restores into a separate database; the live one is untouched):

    podman compose exec -T backup restore.sh clinicdb-YYYYMMDD-HHMMSS.tar.age < /path/to/private-key.txt
    podman compose exec backup dropdb --force clinicdb_restore_check

**Monthly restore test** (SPEC §3): run the check above on the newest backup and confirm
the numbers of users and audit entries look right, and that it says "Documents: N restored
and checked, 0 missing or damaged".

**Disaster recovery** (replaces the live database; the old one is kept, renamed
`clinicdb_before_restore_…`):

    podman compose exec -T backup restore.sh clinicdb-YYYYMMDD-HHMMSS.tar.age --replace-live < /path/to/private-key.txt

If the whole server is lost: install the app on the new machine, put the backup's
`app.env` back as `.env` (it holds APP_SECRET, so 2FA keeps working), start it, then
run the disaster-recovery command above. It also decrypts the documents into
`~/ClinicDB/backups/restored-documents-…/` and prints the one command that puts them back
into the app's documents volume.
