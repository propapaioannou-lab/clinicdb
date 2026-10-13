#!/bin/sh
# Render build command of the ONLINE DEMO (render.yaml). Fake data only; never real data.
# Each build: install → database changes (migrations) → lists/settings → the two demo logins
# → fake patients (first time) → fake calendar (first time, then whenever it runs out) → app.
set -e
[ "$DEMO_MODE" = "1" ] || { echo "Refusing: DEMO_MODE=1 is not set (this build is for the online demo only)."; exit 1; }
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL is missing (Render → Environment)."; exit 1; }
. ./scripts/demo-env.sh

npm ci --no-audit --no-fund
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npx tsx scripts/demo-seed.ts users
npx tsx scripts/seed-fake-patients.ts --small
WEEK=$(npx tsx scripts/demo-seed.ts calendar-week)
if [ -n "$WEEK" ]; then FAKE_CALENDAR_WEEK=$WEEK FAKE_CALENDAR_WEEKS=8 npx tsx scripts/seed-fake-appointments.ts; fi

NODE_ENV=production npx next build
# The self-contained server needs its static files next to it.
if [ -d public ]; then cp -r public .next/standalone/; fi
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
