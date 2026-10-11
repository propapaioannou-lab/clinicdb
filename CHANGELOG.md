# Changelog

Plain-language record of what changed and how to check it.

## 11 Oct 2026 — Suspend and delete users

- The hidden "Ενεργός λογαριασμός" tick box is gone. Instead, the user page has:
  - **Αναστολή** (suspend): logged out at once, cannot log in, everything kept.
    **Επανενεργοποίηση** gives access back.
  - **Διαγραφή** (delete): permanent. The person moves to **Διαγραμμένοι χρήστες**
    (name, email, level, companies, when and by whom). Their activity history stays.
- The test user you deleted earlier was added to the Deleted users list from its log entry.

**Check it:** open a user → Αναστολή → try logging in as them → Επανενεργοποίηση →
Διαγραφή → Χρήστες → Διαγραμμένοι χρήστες.

## 11 Oct 2026 — Phase 1, Step 5: Users, invitations, devices

- **Χρήστες** and **Συσκευές** links in the header (Owner and Admin only). Everyone
  else gets "page not found" for these pages.
- **Users list:** name, level, companies, status (active, invited, locked, expired,
  inactive), 2FA, last login, number of logged-in devices.
- **New user:** name, email, level, company access, end date for Guests, and either
  - an **email invitation** (link valid 72 hours, single use), or
  - a **generated permanent password**, shown once, that you hand over in person.
- **Invitation page:** the person chooses a password (or presses "Δημιουργία ισχυρού
  κωδικού"), then sets up 2FA straight away.
- **User page:** change name, level, companies, Guest end date, active/inactive;
  re-send invitation; generate a new password; reset 2FA (lost phone); unlock;
  delete. Every change is in the audit log with before/after values.
- **Devices:** per user, all logged-in browsers (device, IP, since, last activity,
  ends) with **Τερματισμός**, and trusted devices with **Κατάργηση εμπιστοσύνης**.
  The Συσκευές page shows everyone logged in right now.
- Rules enforced on the server (not just hidden buttons): Owners are never deleted,
  deactivated or demoted; Admins cannot touch Owners or create Owners; nobody can
  deactivate, demote or delete themselves; Admins only give access to their own
  companies; Guests must have a future end date.
- **Laptop test mailbox** at http://localhost:8025 — every email the app sends lands
  there; nothing leaves the laptop. The real email provider is set at deployment.
- 57 automated tests, including a real invitation email.

**Check it:** see README, "Test users and invitations".

## 11 Oct 2026 — Phase 1, Step 4: Two-step verification (2FA)

- **Everyone now needs a 6-digit code** from an authenticator app (Google
  Authenticator, Microsoft Authenticator, …) after the password.
- **First login:** the app shows a QR code to scan, asks for one code to confirm, then
  shows **10 recovery codes once**. Print them or keep them in a password manager.
- **Lost phone:** type a recovery code instead of the 6-digit code. Each works once;
  the app says how many are left.
- **"Trust this device for 90 days"** tick box: that browser skips the code (the
  password is still always required). Only on your own devices.
- Wrong codes count toward the same lock as wrong passwords (5 tries → 15 minutes).
- Each 6-digit code works only once. 2FA secrets are stored encrypted; recovery codes
  and device keys only as fingerprints.
- **Emergency reset** (lost phone AND recovery codes): a command on the server, see
  README. Admins will get a button for this in Step 5.
- Everything is in the audit log: setup, codes used, trusted devices, resets.
- Your current login was ended so that 2FA applies to you right away.
- New secret key `APP_SECRET` in `.env` encrypts the 2FA data. **It must be kept and
  copied to the Synology unchanged**; if lost, everyone sets up 2FA again.

**Check it:** see README, "Test 2FA".

## 11 Oct 2026 — Phase 1, Step 3: Login, sessions, audit log

- **Login page** in Greek. Without logging in, every page sends you to it.
- **Sessions end every Monday at 05:00** Athens time (summer/winter time handled).
  The header shows when your session ends.
- **5 wrong passwords lock the account for 15 minutes**, even for the right password.
  Unknown emails get the same answer as wrong passwords, so nobody can find out
  which emails have accounts.
- Inactive users and Guests past their end date cannot log in, and are logged out
  immediately if that happens while they are logged in.
- **Logout** button in the header.
- **Audit log started:** every login, failed login, lockout and logout is recorded with
  time, IP and browser. (The screen to read it comes in Step 6.)
- Each logged-in browser is stored as a session in the database. This is what the
  Devices screen will show in Step 5. The browser keeps only a random key; the
  database keeps only its fingerprint, so a copy of the database cannot be used to log in.
- 27 automated tests, run against a separate test database.

**Check it:** see README, "Test the login".

## 11 Oct 2026 — Owners are permanent

- An Owner can never be deleted, deactivated or demoted from the app, not even by
  another Owner. Removing an Owner will only be possible by a deliberate command on
  the server. Rule built in and tested.

## 11 Oct 2026 — User levels: Owner, Admin, User, Guest

- Each person now has one **level** (Owner, Admin, User, Guest) and **company access**
  (Surgery, Spa or both). This replaces the earlier Surgeon/Secretary/Spa-staff roles.
- Your account is now **Owner**.
- Rules built in and tested: only Owner and Admin manage users; Admins can grant up to
  Admin; only an Owner can make an Owner, and nobody else can touch an Owner.
- Guests are read-only and **must** have an end date (the database refuses otherwise).
- Generated passwords are now **permanent** (no forced change).
- The account script is now `scripts/create-owner.ts` and is only for the first
  account. Everyone else will be invited by email from the app (Step 5).
- SPEC §11 rewritten with all of the above, including the invitation flow.

**Check it:** see README, "List users" — your account shows level OWNER.

## 11 Oct 2026 — Generated passwords

- The account script can now generate a strong password: press Enter instead of typing
  one. It looks like `Kx7m-Pq3r-Tz9a-Hw4e` (no look-alike letters such as 0/O or 1/l).
- A generated password is shown once, is not stored anywhere readable, and is
  temporary: the user must choose their own at first login (enforced from Step 3).
- The same generator will be a button on the user screens in Step 5.

**Check it:** run the account script with a test email, press Enter at the password
question, and see the password printed once.

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
