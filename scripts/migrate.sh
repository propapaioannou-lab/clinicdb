#!/bin/sh
# Create/apply a migration, then refresh the generated client (Prisma 7 no longer does it).
# Usage: npm run db:migrate -- --name what_changed
set -e
prisma migrate dev "$@"
prisma generate
