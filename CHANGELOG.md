# Changelog

Plain-language record of what changed and how to check it.

## 11 Oct 2026 — Fix: phone number box

- The phone number box was squeezed out by the country-code list, so only the list
  could be used. Now: a small country-code box (GR +30 by default) and a wide box for the
  number beside it; on a phone they get their own row. The two are saved together,
  e.g. "+357 99 123456".

## 11 Oct 2026 — Phase 2, Step 4: Medical history

- **Ιατρικό ιστορικό** tab: the questionnaire from your design (Ναι / Όχι buttons, a details
  box opens on Ναι, "x / y απαντήθηκαν" stays visible while scrolling). 37 questions in 11
  sections (heart, lungs, blood & clotting incl. G6PD, stomach/liver/kidneys, nervous system
  & mental health, endocrine, infections, habits, healing & anaesthesia, gynaecological incl.
  children, first-degree family history), plus medication, allergies, smoking (Ναι · Όχι ·
  Πρώην with per-day and product), weight, highest weight, height with live BMI, previous
  surgeries table (+ Προσθήκη), and free notes. Questions are stored in the database, ready
  for the Settings editor; "Χρήση ουσιών" is confidential (hidden from Guests).
- **Every save is a new version**; nothing is overwritten. "Ιστορικό αλλαγών" lists them and
  opens any earlier one — so a patient's original answers stay readable after corrections.
- **Verification**: a history saved by a Χειρουργός or Βοηθός/νοσηλεύτρια counts as verified;
  saved by anyone else it shows **Εκκρεμεί επιβεβαίωση** with an **Επιβεβαίωση ✓** button
  (surgeon or PA/nurse only). Verified shows "✓ Επιβεβαιώθηκε · name (role) · time" with
  **Αναίρεση**. All logged.
- The **red infectious-disease alert** now comes from the verified Infections answers (any
  Ναι is listed with its details; all Όχι clears it).
- Header cards: **Ιατρικό ιστορικό** shows Φάρμακα, Αλλεργίες, Χειρουργεία, Οικ. ιστορικό and
  the verification line; **Βάρος** shows weight, BMI and highest weight (the trend arrives
  with visits). The patient card shows **Αλλεργία: …** (red) and smoking chips.
- Patient form: phone numbers have a **country code** (Greece +30 by default); a wrong email
  is flagged as soon as you leave the field.

**Check it:** open a patient → Ιατρικό ιστορικό → Συμπλήρωση; answer a few, say Ναι to
Ηπατίτιδα C with a detail, add an allergy, save. Look at the red alert and chips. Edit
again and change something: "Ιστορικό αλλαγών" now has two versions.

## 11 Oct 2026 — Fixes: back links, saving patient edits

- Every page inside **Ρυθμίσεις** has a **← Ρυθμίσεις** link at the top (a user's page,
  "Νέος χρήστης" and "Διαγραμμένοι χρήστες" lead back to **← Χρήστες**).
- **Bug fixed:** saving a patient's edited details seemed to do nothing. Any change (even
  just the city) set off the duplicate warning, because the patient's own name resembles
  other patients'; the warning sat at the top of the long form, out of view. Now editing
  checks only what you changed (a new phone or email, a new AMKA, a changed name or birth
  date). After a successful save the form closes and "Οι αλλαγές αποθηκεύτηκαν" appears.

## 11 Oct 2026 — Patient details form trimmed

- Removed from the patient details form and the details view, at your request:
  **newsletter consent** (it belongs in the consent forms, Phase 3), **comments** and
  **infectious diseases** (these go to the medical history, Step 4).
- Nothing is deleted: values already stored stay in the database, and saving the details
  form never changes them. The red infectious-disease alert on the patient header stays.

## 11 Oct 2026 — Phase 2, Step 3c: Patient record and new patients

- **Patient record** in the approved design: the patient card (name, flag, code, age,
  sex, AMKA, main phone, email, communication language, red infectious-disease alert),
  the **Βάρος** and **Ιατρικό ιστορικό** cards (filled in the next steps), and tabs:
  Επισκόπηση · Ιατρικό ιστορικό · Επισκέψεις · Έγγραφα, with Χειρουργεία, Θεραπείες,
  Φωτογραφίες, Οικονομικά greyed out until their phase.
- **"Όλα τα στοιχεία ▾"** opens every detail right under the card. From there:
  **Επεξεργασία** (all fields: several phones with one main/WhatsApp, several emails,
  address, AMKA, ΑΦΜ/ΔΟΥ, e-prescription, referral, treating doctor, notes…),
  **Σήμανση** (yellow/red flag with reasons and a note) and, for Owners only,
  **Αρχειοθέτηση** (hidden from search and lists, nothing deleted, "Επαναφορά" undoes it).
- **Νέος ασθενής**: same form; the new patient gets the next free number of the company.
- **Duplicate check** before saving (SPEC §6b): same AMKA, phone or email (strong);
  same name and birth date (medium); similar name, also in Greeklish, or same first
  name and birthday under another surname (weak). The look-alikes appear side by side:
  - **"Ίδιο πρόσωπο"** → choose field by field what to keep; new phones/emails are added
    to the existing record; no new record is made;
  - **"Δεν είναι ο ίδιος"** → saves anyway and remembers it, so that pair never warns again.
  Editing contact details runs the same check.
- **Birth date is typed as ηη/μμ/εεεε** (e.g. 5/3/1990), whatever language the computer
  is set to, so 01/02 can never be mistaken for 2 January.
- The treating-doctor list shows users whose role is **Χειρουργός**.
- **Guests** see name, code, age, sex and clinical alerts only: no contact details,
  AMKA/ΑΦΜ, birth date, flag or comments, and no edit buttons.
- Every opening, creation, change (with old and new values), flag change, archive and
  "not the same person" goes to the audit log.

**Check it:** Ασθενείς → **Νέος ασθενής**; type a name and the phone of an existing
patient → the warning appears. Try both buttons. Open a patient → "Όλα τα στοιχεία" →
Επεξεργασία, Σήμανση. Then Ρυθμίσεις → Αρχείο καταγραφής → Ασθενείς.

## 11 Oct 2026 — Phase 2, Step 3b: Patients page in the new design

- **Ασθενείς** now matches the approved design: a large search box that updates the list
  as you type, and every result shows **which field matched** (όνομα, τηλέφωνο, email,
  ΑΜΚΑ, κωδικός), with phone, email and AMKA underneath (not for Guests).
- **Filter chips**: Όλοι (both companies) · Ιατρείο · Spa · Με σήμανση. "Χειρουργείο" is
  greyed out until surgeries exist (Phase 4; its exact meaning is still open in SPEC §13).
- With an empty search: **Πρόσφατα ανοιγμένοι** (the patients you opened last) and
  "Προτεινόμενοι σήμερα" (filled once the calendar exists).
- **Νέος ασθενής** button (the form comes in the next part).

**Check it:** Ασθενείς → type a name, a phone fragment, an email, "P-4218". Click
"Με σήμανση". Open a patient, come back with an empty search: it is under "Πρόσφατα".

## 11 Oct 2026 — Phase 2, Step 3a: New look (DESIGN.md) and roles

- The app now uses the **approved design**: teal colours, the Commissioner font (served
  from our own server, no request to Google), white cards on a warm grey background.
- **Left menu**: Ιατρείο · Ασθενείς · Ημερολόγιο · Χειρουργεία · Εργασίες (the last three
  greyed out, "σύντομα", until their phase), **Ρυθμίσεις** and your name/role at the bottom
  with a logout button.
- **Ιατρείο | Spa switch** above the menu: search and patient lists show only the company
  you are working in. Remembered on each computer.
- **Search bar** on top in the new style; "Ctrl K" or "/" jumps to it. Patient codes are
  shown as in the design, **P-004218** (Spa: S-000123); typing "P-4218" also finds them.
- **On a phone** the menu becomes a bottom bar (Σήμερα, Αναζήτηση, Chat, Ημερολόγιο).
- **Ρυθμίσεις** holds your account and the admin screens (Χρήστες, Συσκευές, Αρχείο
  καταγραφής, Αντίγραφα), so the menu stays short.
- Every user now has a **role** besides the level: Χειρουργός, Βοηθός / νοσηλεύτρια,
  Γραμματεία, Προσωπικό Spa, Άλλο. It decides the home screen and the treating-doctor
  list later; it gives no extra rights. Your account is Χειρουργός. Role changes are logged.
- The home page is a simple "Σήμερα" placeholder until the calendar arrives (Phase 6).

**Check it:** reload. Click through the menu; switch Ιατρείο/Spa and search; open
Ρυθμίσεις → Χρήστες → a user and set a role. Narrow the browser window to phone width.

## 11 Oct 2026 — Phase 2, Step 2: Search bar on every screen

- A **search box in the header** of every page. Results appear as you type (about
  0.05 s with 15,600 patients), best matches first: exact patient number, then
  surnames starting with what you typed, then everything else.
- Finds by **name** (accents, capitals and word order don't matter; Greek or Greeklish:
  "papadopoulou maria" = "Μαρία Παπαδοπούλου"), **phone** in any format (+30, spaces,
  part of the number), **email**, **AMKA** and **patient number**.
- Small **spelling mistakes** are forgiven when nothing matches exactly
  ("Παπαδοπόλου" still finds Παπαδοπούλου).
- Keyboard: **/** or **Ctrl+K** jumps to the box; **Enter** opens the full results
  list; **↓** then **Enter** opens a single patient; **Esc** closes.
- **Guests** can search only by name or patient number (a phone search would let
  them identify people) and never see phone numbers in the results.
- Clicking a result opens a first **patient page** (name, number, age in years and
  months, father's name, AMKA, flag, red infectious-disease bar). The full record
  comes in the next steps. **Every opening is in the audit log** (new filter
  "Ασθενείς"), with patient number and name.

**Check it:** type in the header box from any page — try a surname in Greek, then
the same in Latin letters, then part of a phone number from the list.

## 11 Oct 2026 — Phase 2, Step 1: Patient records and fake patients

- The database now holds patients with every "Basic info" field from SPEC §4: several
  phones (one main/WhatsApp) and emails, communication language, AMKA, tax details,
  flag (yellow/red with reasons), infectious-disease alert, treating doctor, and more.
- **Patient numbers** count separately for Surgery and Spa; imported my-medical
  patients will keep their number.
- **Editable lists** for each company, with starting values: marital status, referral
  source, ΔΟΥ, flag reasons, visit types, conditions (screen to edit them comes later).
- **15,600 fake patients** (15,000 Surgery, 600 Spa) for testing speed, including some
  deliberate "forgot they came before" duplicates, some typed in Latin letters.
  All fake: emails end in @example.com; never run on the real server.
- New **Ασθενείς** link: alphabetical list, 50 per page, with flag marker and ⚠ for
  infectious disease. Guests see name and age only — no phone, no city.
- Search groundwork: names are stored in a simplified form so that accents, capitals
  and Greeklish won't matter (Παπαδοπούλου = papadopoulou = PAPADOPOULOU).

**Check it:** click **Ασθενείς**. Page through; switch Surgery/Spa at the top right.

## 11 Oct 2026 — Phase 1, Step 7: Backups

- **Every night at 02:30** the database is copied, **test-restored** into a scratch
  database (so a broken copy is caught the same night), bundled with the settings
  file (it holds the key that unlocks everyone's 2FA) and **encrypted**.
- Kept: 14 daily, 8 weekly, 12 monthly copies, in `~/ClinicDB/backups/`.
- Encrypted with a public key; only the **private key, kept off the server**, can
  open them. A stolen backup — or a stolen Synology — is unreadable.
- If the computer was off at 02:30, a backup is made as soon as it is back on.
- New page **Αντίγραφα** (Owner/Admin): each run with result, restore check, contents,
  size. A **red bar on every page** if there is no good backup for 26 hours or the
  last one failed. Every run is in the audit log.
- Restore commands: "check" (separate database, live untouched) and "disaster
  recovery" (replaces the live database, keeps the old one). Both were rehearsed
  today: wrong key refused, right key restored, the app kept running.
- Not yet: the **off-site copy** (Synology C2 / Backblaze / USB) — set up at
  deployment once you choose. Photos are backed up separately on the Synology.

**Check it:** see README, "Backups".

## 11 Oct 2026 — Phase 1, Step 6: Audit log screen

- New **Αρχείο καταγραφής** link (Owner and Admin). Every login, failed login,
  lockout, 2FA event, device change and user change, newest first, in Greek time:
  who, what (in Greek), on whom, details (e.g. "επίπεδο: Χρήστης → Επισκέπτης"),
  IP and device.
- Filters: person (deleted users included), type (logins, failures & lockouts,
  2FA & devices, user management, log views), from/to date. 50 per page.
- **Ιστορικό ενεργειών** link on each user's page and on each deleted user.
- Opening the log is itself recorded.
- **The log cannot be changed or deleted** — the database refuses it, even for the
  app. At deployment the app will also use a restricted database account that can
  only add to the log.

**Check it:** see README, "Test the audit log".

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
