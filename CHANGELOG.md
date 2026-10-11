# Changelog

Plain-language record of what changed and how to check it.

## 11 Oct 2026 — Phase 1, Step 2: Companies, users, roles

- The database now has the two companies (Surgery, Spa), users, and which company
  each user works in with which role (Surgeon, Secretary, Spa staff).
- "Admin" is a separate switch on a user, so you can be both Surgeon and Admin.
- Passwords are stored scrambled (scrypt); nobody, including us, can read them back.
- A script creates the first Admin account.
- SPEC updated with your login rules: trusted devices skip the 2FA code for 90 days,
  everyone logs in again every Monday at 05:00, and Admin can see and end devices.

**Check it:** create your account (see README, "First Admin account"), then list users.

## 11 Oct 2026 — Phase 1, Step 1: Project skeleton

- The app and its database now run in containers on the laptop with one command.
- The welcome page is in Greek. All text lives in translation files
  (`messages/el.json`, `messages/en.json`), so English can be added later.
- The app and database are reachable only from this laptop, not from the network.
- Decisions recorded in SPEC: the secretary sees everything, including clinical notes;
  2FA uses an authenticator app with recovery codes; no automatic logout.

**Check it:** open http://localhost:3000 and see "Καλώς ήρθατε".
