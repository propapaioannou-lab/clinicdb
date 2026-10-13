#!/bin/sh
# One time: link this folder to the PRIVATE GitHub repository the online demo is built from.
#   npm run demo:connect -- https://github.com/NAME/clinicdb
# Uses the key ~/.ssh/clinicdb_demo_deploy (a GitHub "deploy key": it opens this one
# repository only). Then sends the code there for the first time.
set -e
url="$1"
[ -n "$url" ] || { echo "Usage: npm run demo:connect -- https://github.com/NAME/REPOSITORY"; exit 1; }
case "$url" in
  https://github.com/*) path=${url#https://github.com/}; path=${path%/}; url="git@github.com:${path%.git}.git" ;;
esac
[ -f "$HOME/.ssh/clinicdb_demo_deploy" ] || { echo "The key ~/.ssh/clinicdb_demo_deploy is missing."; exit 1; }
git remote remove demo 2>/dev/null || true
git remote add demo "$url"
git config core.sshCommand "ssh -i ~/.ssh/clinicdb_demo_deploy -o IdentitiesOnly=yes"
sh scripts/demo-update.sh
