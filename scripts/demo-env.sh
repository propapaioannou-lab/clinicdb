# Sourced by demo-build.sh / demo-start.sh (online demo on Render + Neon).
# Neon's connection string, made safe for this app whichever box was ticked when copying it:
# the DIRECT host (live updates need LISTEN, which Neon's "-pooler" host does not support)
# and without channel_binding (not understood by every database driver used here).
DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed \
  -e 's/-pooler\./\./' \
  -e 's/&channel_binding=[a-z]*//' \
  -e 's/?channel_binding=[a-z]*&/?/' \
  -e 's/?channel_binding=[a-z]*$//')
export DATABASE_URL
