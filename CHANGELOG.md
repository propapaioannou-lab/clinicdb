# Changelog

Plain-language record of what changed and how to check it.

## 11 Oct 2026 — Phase 1, Step 1: Project skeleton

- The app and its database now run in containers on the laptop with one command.
- The welcome page is in Greek. All text lives in translation files
  (`messages/el.json`, `messages/en.json`), so English can be added later.
- The app and database are reachable only from this laptop, not from the network.
- Decisions recorded in SPEC: the secretary sees everything, including clinical notes;
  2FA uses an authenticator app with recovery codes; no automatic logout.

**Check it:** open http://localhost:3000 and see "Καλώς ήρθατε".
