#!/bin/sh
# Update the online demo: sends the latest COMMITTED code to GitHub; Render then rebuilds
# the demo by itself (5–10 minutes) and keeps the demo's fake data and suggestions.
#   npm run demo:update
set -e
git remote get-url demo >/dev/null 2>&1 || { echo "Not linked yet: run  npm run demo:connect -- https://github.com/NAME/REPOSITORY"; exit 1; }
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Note: changes that are not committed yet are NOT sent (only the last commit is)."
fi
git push demo HEAD:main
echo ""
echo "Sent: $(git log -1 --format='%h %s')"
echo "Render is rebuilding the demo now (5–10 minutes): https://dashboard.render.com"
