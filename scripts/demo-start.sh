#!/bin/sh
# Render start command of the ONLINE DEMO (render.yaml).
set -e
[ "$DEMO_MODE" = "1" ] || { echo "Refusing: DEMO_MODE=1 is not set."; exit 1; }
. ./scripts/demo-env.sh
export NODE_ENV=production HOSTNAME=0.0.0.0
exec node .next/standalone/server.js
