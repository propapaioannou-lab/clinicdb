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

See the audit log so far:

    podman compose exec db psql -U clinicdb -d clinicdb -c 'select at, "actorEmail", action, ip, details from "AuditLog" order by id desc limit 20;'

Unlock an account that hit 5 wrong passwords (otherwise it unlocks after 15 minutes):

    podman compose exec db psql -U clinicdb -d clinicdb -c "update \"User\" set \"lockedUntil\" = null, \"failedLogins\" = 0 where email = 'name@example.com';"

## After changing the database schema (developer)

    podman compose exec app npm run db:migrate -- --name what_changed
