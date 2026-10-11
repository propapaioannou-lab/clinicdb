# Clinic Database — Specification v0.8

Status: draft, 11 Oct 2026. Living document — update as decisions are made.
Owner: the surgeon (product owner, tester). Code: written by Claude Code.

## 1. Goal

Replace my-medical with a fast, self-hosted patient database for a plastic surgery
practice and (later) a medical spa. Runs on the practice's own server (Synology DS224+
now, possibly a mini PC later), accessed privately from anywhere. Government-facing
functions (e-prescription, myDATA receipts, ERGANI) stay with certified external
services and are NOT rebuilt here.

## 2. Principles

- **Speed first.** Every common screen loads instantly; patient search returns as you type.
- **Privacy by design.** Health data never leaves our server except where listed in §10.
  GHL receives contact/scheduling data only, never clinical data.
- **Multi-company from day one.** Every record belongs to a company: `Surgery` or `Spa`.
  Today they are one legal entity; later they will separate. Patients who use both get
  two linked records, shared only with consent.
- **Everything audited.** Who viewed/created/changed what, and when.
- **Bilingual-ready.** UI in Greek first; English for foreign patients' forms.

## 3. Architecture

- Next.js (TypeScript) + PostgreSQL + Prisma, all in Docker.
- Staff access: private only, via Tailscale VPN. No open ports.
- Patient-facing intake (§6): a separate, minimal public service exposed through a
  secure tunnel (e.g. Cloudflare Tunnel). It can only *submit* forms into a holding
  area — it can never read patient data. Staff review and accept submissions.
- Photos: stay in their existing Synology folders; the app reads them (read-only mount).
- Backups: encrypted, off-site, versioned, nightly. Restore tested monthly.
- Development on the Linux laptop; deployment to the Synology with the same containers.

## 4. Core data

### Patient — basic info (from my-medical "Βασικά", ~15,300 patients today)
- Internal unique ID (e.g. `P-000123`), generated automatically. **Primary identifier.**
- Surname (required), name, father's name
- Marital status (list), referral / "Σύσταση" (who referred)
  (my-medical's "Κατηγορία" dropped — never used)
- Date of birth → age shown automatically (years + months)
- Registration date (auto)
- Area, address, city, postcode, country
- Phones: several, each with a type (mobile, home, work); one marked main/WhatsApp
- Emails (several)
- Sex, occupation
- **Communication language** (Greek / English; default Greek). Decides the language
  of every form, consent, link and message for this patient; synced to GHL as a field
  so GHL workflows send in the right language. Set at intake from the language the
  patient chose on the form; staff can change it.
- AMKA — optional, searchable
- Tax data for receipts: ΑΦΜ, ΔΟΥ (list)
- City + phone for e-prescription (separate fields in my-medical)
- Newsletter / marketing consent (checkbox → becomes part of §7 consents)
- Infectious diseases (ΜΟΛΥΣΜΑΤΙΚΑ) — free text, shown as an alert on the patient header
- Profile photo (upload or tablet camera)
- Treating doctor
- Comments
- **Patient flag** (replaces my-medical "Κριτική"): none / 🟡 yellow / 🔴 red, with
  reason(s) from an editable list (bargained for discount, no-show, came late, …),
  free-text note, date and who set it. Shown as a small coloured marker on the patient
  header, in search results and in the calendar. Staff-only; never sent to GHL or shown
  to the patient. Write reasons factually — under GDPR a patient's access request can
  include them.
- GHL contact ID (link); company (`Surgery` / `Spa`)
- Patient overview shows the list of past visits (date, type, diagnosis).

### Medical history (from my-medical "Αναμνηστικό")
- Conditions (Νοσήματα): list, add several
- Family/social: occupation, marital status, children, breastfeeding (yes/no + text),
  first-degree family history: breast cancer, diabetes, clotting disorder (checkboxes)
- Personal: regular medication (yes/no + which), allergies, genetic conditions (G6PD
  etc.), smoking (list), previous surgeries (yes/no), healing problems (yes/no),
  bleeding disorder (yes/no)
- Weight: current body weight and maximum weight ever (important for massive weight
  loss / body contouring)
- Free-text by system: circulatory, respiratory, digestive, urogenital, nervous,
  musculoskeletal, endocrine, hereditary, operations & births, smoking & alcohol,
  children/breastfeeding, chronic medication, comments
- Note: my-medical asks some things twice (smoking, children, breastfeeding,
  medication, previous surgeries) — merge into one question each.
- Same questions appear in the patient intake form (§6) so patients fill them in
  themselves; the surgeon reviews.

### Visit
- Date/time, type from an editable list (e.g. ΠΡΟΕΓΧΕΙΡΗΤΙΚΗ ΕΚΤΙΜΗΣΗ, consultation,
  follow-up, post-op…)
- Diagnosis
- **Free-text notes** (main content)
- Money per visit: fee, amount collected → patient totals: fees, collected, balance
  (as in my-medical)
- **Vitals / measurements on every visit:** weight (required prompt), height,
  BMI (auto), blood pressure, pulse — list extensible. Weight shown as a trend chart.
- Optional: audio recording + AI transcript + AI review (§9)

### Surgery
Fields used today in my-medical (keep all):
- Title (required)
- Admission date/time, discharge date/time
- Surgery type — from an editable list (add new types inline)
- Hospital/clinic — editable list (e.g. Διαβαλκανικό)
- Surgeon (defaults to the logged-in surgeon)
- Anaesthesiologist — editable list
- Anaesthesia type — editable list (GA, sedation, local…)
- Files (several at once), e.g. the scanned handwritten operative record
- Operative record (Πρακτικό Χειρουργείου) as its own sub-section
New in our app:
- Procedure(s) as structured items, several per surgery (e.g. augmentation + mastopexy)
- Implants/materials as structured items: brand, model, size/volume, side, lot number
  (today this lives as free text in calendar titles — e.g. brand, profile, cc)
- Operative note typed directly, complications
- Status: proposed → booked → done
- Linked: specific consent (§7), surgical brief (§8), photos

### Receipts (view only in our app, issued through myDATA provider later)
my-medical shows: series, number, created date, description, total amount,
document type (e.g. ΑΠΥ). Imported history kept read-only.

### Drawings (Σχέδιο)
my-medical has a dated drawings tab. To keep: sketch on a body diagram (tablet/pen),
saved by date, attachable to a visit or surgery.

### Prescriptions & referrals (history only)
my-medical is connected to ΗΔΙΚΑ (prescriptions, referrals/παραπεμπτικά). Our app
does not prescribe (see §1); it imports past prescriptions read-only and links out
to the ΗΔΙΚΑ portal.

### Document
- Today: name, file type, file name, date; comment, download, edit, delete;
  "show images" gallery view. Keep all of these.
- Type (general consent, procedure consent, lab result, history, other), file (PDF), date
- Optionally linked to a visit or surgery
- Signed documents store: signature image, timestamp, signer device/IP, file hash

### Photo link
- Patient folder on Synology, mapped by patient ID
- Tags: timepoint (pre-op, 1w, 1m, 3m, 6m, 1y…), body area, linked visit/surgery

## 4b. Patient screen layout (inherited from my-medical, to modernize)
Header: patient name, age (auto from birth date), AMKA, flag, infectious-disease alert.
Quick actions: print, email, reminder/to-do, edit.
Sections: Basic info · Medical history (Αναμνηστικό) · Visits · Files · Prescriptions
(link out to ΗΔΙΚΑ) · Surgeries · Receipts · Drawings.
(my-medical's "Σημειώσεις" tab dropped — never used.)
Also from my-medical: a global To-Do list with reminders (bell with counter).

## 4c. Calendar
my-medical's calendar is NOT the model — to be designed from scratch with the surgeon
(built-in vs GHL still open). Known needs so far: appointments linked to a patient
record; surgery details (procedures, implants) live in the surgery record, not in
appointment titles; more than one location.

## 4d. Reports and other my-medical features (decide which to keep)
my-medical offers: income by visits and by packages, total visits, total surgeries,
referral-source stats, communication stats, birthdays, export to Excel, data backup,
receipt totals, prescription/referral statistics (diagnoses, substances, products),
bulk SMS and email, suppliers list, doctors list, e-consultation.
None of my-medical's statistics work in practice, so nothing is inherited. Our own
reports will be designed later from what the surgeon actually wants to know.
Bulk SMS/email move to GHL. Prescription statistics dropped.

## 5. Finding a patient

- Global search bar on every screen: name, surname, phone, email, AMKA, ID.
- Patient selector from the calendar (built-in or GHL — **decision pending**).

## 6. New-patient intake (guest mode)

Three ways for a new patient to fill in their details and history:
1. **Tablet in the office** — staff starts "guest mode"; the tablet shows only the
   intake form, locked to that one patient; exits back to staff login.
2. **QR code** — generated per patient/session, scanned with their own phone.
3. **Remote link** — sent by WhatsApp/email, probably via GHL. Link is single-use,
   expires (e.g. 72 h), contains no personal data.

The intake collects personal details, medical history and the **first-contact
consents** (§7). Submissions land in a review queue; staff confirm, match to an
existing patient if one exists, then accept.

### 6a. Phase 3 details (decided)
- Public form address: `forms.drpapaioannou.gr` (subdomain of the surgeon's domain),
  through a secure tunnel (recommended: Cloudflare Tunnel + Turnstile anti-bot).
- Office tablet: **Android**. Form runs as an installable web app; tablet locked to it
  with Android screen pinning or a kiosk browser (e.g. Fully Kiosk). Leaving guest
  mode requires a staff PIN.
- QR: generated on the staff screen, single-use, short expiry (e.g. 30 min).
- Remote link: single-use, 72 h expiry, save-and-continue; written to the patient's
  GHL contact; a GHL workflow sends it (WhatsApp/email).
- Form: personal details, reason for visit, how they heard about us, medical history
  (patient-friendly, conditional detail boxes, current/max weight, height),
  first-contact consents with finger signature. Greek/English.
- Under-18 → parent/guardian details and signature required.
- Returning patients: "update your history" link (same mechanism), e.g. before surgery.
- Every submission goes to the review queue (§6) — nothing enters a record without
  a staff click.
- GHL WhatsApp is connected → remote links go out by WhatsApp by default, email as
  alternative.
- **Spa is served from the start.** Each QR/link/guest session belongs to a company
  (Surgery or Spa) and lands in that company's review queue. Spa form = same personal
  details + spa-specific questions (to be defined) + spa consents.
- Consent texts: lawyers are updating them. Build the consent system with clearly
  marked placeholder templates; real texts are pasted in later through the template
  editor (versioned, no code change needed).

### 6c. Moving patients between Surgery and Spa
- Users with the right permission (admin, or a role granted "cross-company import")
  can import a patient from one company into the other.
- The import creates a **linked** record in the target company; user chooses what to
  copy (contact details always; medical history / documents only if chosen).
- Requires the patient's data-sharing consent between the two businesses (added to
  the first-contact consents). If missing, contact details can be copied but the app
  asks for consent before copying anything medical.
- Every import is audited (who, when, what was copied).

## 6b. Duplicate patients
Older patients often forget they visited before, so duplicates must be caught.

**Live check** — whenever a patient is created (intake review or manual entry) or
contact details change:
- Strong match (any one is enough): same AMKA; same phone (normalised: spaces,
  dashes, +30/0030 removed); same email (case-insensitive).
- Medium match: same surname + name + date of birth.
- Weak match: similar name only — accent- and case-insensitive, Greek/Greeklish
  equivalence (e.g. Παπαδοπούλου = Papadopoulou), married-name changes considered.
- Staff see the existing record(s) side by side with the new data and choose:
  **update existing** (choose field by field what to keep) or **create new anyway**.
  "Not the same person" is remembered for that pair, so the warning doesn't repeat.
- Shared phones/emails are normal (family members, parent's phone for a minor):
  warn, never block.

**Batch tool** (later, essential after the my-medical import):
- Scans the whole database and lists likely duplicate pairs/groups, scored by
  match strength, strongest first.
- Merge screen: field-by-field choice; all visits, surgeries, documents, photos,
  consents and receipts move to the surviving record.
- Old patient ID keeps pointing to the merged record; every merge is audited and
  can be undone.
- Bulk-merge allowed only for strong matches, after review.

## 7. Consents

- **First contact (everyone):** GDPR / data processing, photography consent,
  communication & marketing consent (separate tick boxes), consent to record the
  consultation (if used, §9), consent to share data between the Surgery practice
  and the Spa (§6c). Signed digitally at intake.
- **Procedure-specific:** when a procedure is decided, the app generates the consent
  from a template for that procedure (patient details, procedure, risks pre-filled).
  The patient must sign it once the surgery is **booked** — the app tracks this and
  warns if unsigned as surgery approaches.
- Templates: one per procedure, editable by the surgeon, versioned (we always know
  which version a patient signed).
- **Procedure consent texts** (seed): `consents/procedures/`, 21 procedures + general
  risks, each in Greek and English. Format and assembly order: `_FORMAT.md`.
  - Each file's `key` = an entry in the surgery-type list; seeding creates the
    surgery types and their consent templates together.
  - A surgery with several procedures produces ONE consent document: each
    procedure's sections 1–8, general risks once, the surgeon's "risks specific to
    me", all specific declarations (de-duplicated), standard declarations, signatures.
  - Language = patient's communication language; the surgeon can switch it before
    sending.
  - Conditional items (e.g. "only if implants", "only if buttock area", the optional
    gender-affirming paragraph) are shown only when the surgeon ticks the matching
    option on the surgery record.
  - Placeholders such as `{{implant_brand}}`, `{{implant_pocket}}`,
    `{{blepharoplasty_extent}}` are filled from structured surgery fields; missing
    values block sending with a clear message.
  - Every file is marked "awaiting medical review / legal approval"; the badge stays
    until the surgeon marks each one approved in the consent manager (§7b).

### 7a. Template structure (based on current documents)
Current first-contact documents (today in my-medical, issued by
«ΠΑΠΑΪΩΑΝΝΟΥ ΠΛΑΣΤΙΚΗ ΧΕΙΡΟΥΡΓΙΚΗ Ι.Κ.Ε.»):
1. **Data processing notice** — information text (legal basis GDPR art. 6(1)(b),
   9(2)(h), 9(3); retention 10 years from last visit, art. 14(4) Ν.3418/2005; rights;
   contact info@drpapaioannou.gr). Patient acknowledges + signs.
2. **Photography consent** — information text + two separate tick boxes:
   (a) taking and storing photos in the patient's record;
   (b) publication on the website and social media.

Each template in the app = company (Surgery/Spa) + language + version +
information text + list of **consent items** (each: wording, required or optional) +
signature. Each ticked/unticked item is stored on its own, so it can be checked and
withdrawn individually.
- Withdrawal: staff record a withdrawal (date, item); it applies from that date,
  never retroactively.
- Consent status feeds the rest of the app: e.g. photo browser shows whether a
  patient's photos may be published; marketing consent syncs to GHL as a tag.
- Retention: the app computes "keep until" = last visit + 10 years and lists records
  past that date for review (never auto-deletes).
- Seed templates: from `CONSENTS.md` (drafts, marked "PLACEHOLDER — awaiting
  lawyers' version"). Spa gets its own set under the spa's legal entity once it exists.

### 7b. Settings → Consent forms (manager)
Lets the surgeon/admin manage all forms without code changes. Access: admin and
surgeon only; every action audited.
- **List** of templates, filterable by company (Surgery/Spa), type, language and
  status. Shows current published version, number of signatures, and a badge
  "Awaiting legal approval" where set.
- **Editor**:
  - Title, type, company, language, the flow(s) it appears in (first contact,
    surgery booked, before recorded consultation, manual), and the procedure it
    belongs to (for procedure consents).
  - Information text with simple formatting (headings, bold, lists) and a button
    to insert placeholders (`{{patient_full_name}}`, `{{surgery_date}}`, …).
  - Consent items: add/remove/reorder; each has wording, required/optional, and a
    **key** that links it to app behaviour (e.g. `photo_publish_face`,
    `marketing_whatsapp`). Keys are picked from a list, so behaviour can't break
    by mistyping.
  - Guardian block on/off for minors.
  - **Preview** as the patient sees it on tablet and on phone, with sample data.
- **Versioning**: draft → published. A published version is never edited; editing
  creates a new draft. Signed consents always point to the exact version signed.
  Greek and English of the same form are linked as one version.
- **Re-consent**: when publishing a new version, choose "existing signatures stay
  valid" or "ask patients to re-sign at their next contact" (app then flags them).
- **Archive** instead of delete once a template has signatures.
- **Signed-consent viewer** on each patient: all consents, items ticked, version,
  date, PDF; record a withdrawal per item.
- Signatures: on tablet in the office or remotely via secure link.
- ⚠️ To confirm with a lawyer: required signature type for surgical consent in Greece.

## 8. Day of surgery

- **Surgical brief**: compiled from patient record + surgery record (patient details,
  procedure, allergies, medication, relevant history, implants, anaesthesia, notes).
  Stored as a PDF in the patient's documents.
- **Automatic email to the clinic/hospital** on the day of surgery: surgical brief +
  signed procedure consent. Default address per clinic; option to add/override with
  an alternate address. Sent as a protected PDF over secure mail; every send logged.
- Blocked (with warning) if the procedure consent is not signed.

## 9. AI consultation assistant (later phase)

- Record the consultation (only with the patient's signed consent).
- Transcribe (Greek + English), distinguishing surgeon and patient.
- Fill gaps: draft structured note from the conversation for the surgeon to approve.
- Review the consultation against a per-procedure checklist: options discussed,
  risks/complications explained, alternatives, recovery, costs; medical history
  completeness. Output: a short private report to the surgeon.
  The checklists are the "Consultation checklist" sections of the procedure consent
  files (`consents/procedures/`), editable in the consent manager, so consent content
  and consultation review stay in step.
- Privacy: transcription/AI either runs locally (needs stronger hardware than the
  DS224+) or through an API provider with a signed DPA and zero data retention.
  **Decision pending.** Audio retention policy to be decided.

## 10. Integrations

- **GHL**: two-way sync of contact + appointment data only (name, phones, emails,
  lead source, appointment time, category). Never clinical data. Calendar choice pending.
- **Email (SMTP)** via a provider with a DPA: surgical briefs, consent links.
- **my-medical import**: one-time migration of ~15,300 patients with history, visits,
  surgeries, files, receipts and prescription history.
  - my-medical's built-in backup = spreadsheet with contact data only (names, phones,
    emails, addresses). **No medical data.** Usable for Phase 2 contact import.
  - Clinical data (history, visits, surgeries, files): formal written request to
    my-medical for a complete export (database dump + all uploaded files). The surgeon
    is the data controller and my-medical the processor; GDPR Art. 28(3)(g) obliges a
    processor to return all personal data at the end of the service.
  - Fallback if they refuse or stall: automated export from the surgeon's own logged-in
    account, run locally (slow but feasible for ~15,300 patients).
  - Keep my-medical access (read-only use) until the import is verified.
  Import scripts run locally; real data never leaves our machines.
- Later: myDATA provider API (receipts); e-prescription stays on ΗΔΙΚΑ.

## 11. Users and roles (draft)

- Surgeon: everything
- Secretary: patients' contact details, appointments, intake review, documents;
  clinical notes read-only or hidden (to decide)
- Spa staff: Spa company only
- Admin: users, settings, backups

## 12. Build phases

1. Foundation — login (with 2FA), roles, companies, audit log, backups
2. Patients, visits & vitals, documents, global search
3. Intake: guest/tablet mode, QR, remote link, first-contact consents
4. Surgeries, procedure consent templates & signing, surgical brief, auto-email
5. Photo browser (Synology folders)
6. Calendar + GHL sync
7. AI consultation assistant
8. Receipts (myDATA provider), Spa workspace
9. my-medical import — just before the test phase (export request sent then)

## 13. Open decisions

- Calendar: built-in vs GHL
- AI: local vs API provider
- Secretary's access to clinical notes
- Exact patient fields (my-medical screenshots)
- Photo folder structure on the Synology today
- Legal check: e-signatures for surgical consent; consent wording
- Medical review of the 21 procedure consent drafts (items marked [ΕΛΕΓΧΟΣ ΙΑΤΡΟΥ])
- Revision-cost policy text (`{{revision_policy}}`), implant warranty/registry
- Whether `neck_lift` becomes its own procedure or stays within `facelift`
