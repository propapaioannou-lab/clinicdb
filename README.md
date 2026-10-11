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

## First Admin account

    podman compose exec app npx tsx scripts/create-admin.ts

Running it again with the same email resets that account's password.

List users and their roles:

    podman compose exec db psql -U clinicdb -d clinicdb -c 'select u.email, u.name, u."isAdmin", c.code as company, m.role from "User" u join "Membership" m on m."userId" = u.id join "Company" c on c.id = m."companyId";'

## Tests

    podman compose exec app npm test
