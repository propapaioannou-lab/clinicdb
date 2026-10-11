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

## Test 2FA

1. Install Google Authenticator or Microsoft Authenticator on your phone.
2. Log in at http://localhost:3000 → you are asked to set up 2FA.
3. Scan the QR code, type the 6-digit code → your 10 recovery codes appear. Save them.
4. Αποσύνδεση, log in again → you are asked for the 6-digit code.
5. Tick "Εμπιστεύομαι αυτή τη συσκευή", log out, log in again → no code asked.
6. Try one recovery code in a private browser window → "Σας έμειναν 9 κωδικοί".

## Test users and invitations

1. Χρήστες → Νέος χρήστης. Use a made-up email such as `test-secretary@example.com`,
   level Χρήστης, company Πλαστική Χειρουργική, "Αποστολή πρόσκλησης με email".
2. Open the test mailbox http://localhost:8025 — the invitation is there. Open its link
   in a **private browser window** (so you stay logged in as yourself in the other).
3. Choose or generate a password, set up 2FA with your phone → logged in as the new user.
   No Χρήστες/Συσκευές links for them.
4. Back as yourself: Συσκευές shows both logins. Open the new user, press Τερματισμός
   on their login → the private window is sent to the login page.
5. Try Νέος χρήστης → Επισκέπτης without an end date → refused.

## Lost phone and recovery codes (emergency)

Owners and Admins: open the user → "Επαναφορά 2FA". If nobody can log in at all:

this command removes the person's 2FA, trusted devices and logins; they set up 2FA again at next login:

    podman compose exec app npx tsx scripts/reset-2fa.ts name@example.com

Unlock an account that hit 5 wrong passwords (otherwise it unlocks after 15 minutes):

    podman compose exec db psql -U clinicdb -d clinicdb -c "update \"User\" set \"lockedUntil\" = null, \"failedLogins\" = 0 where email = 'name@example.com';"

## After changing the database schema (developer)

    podman compose exec app npm run db:migrate -- --name what_changed
    podman compose restart app
