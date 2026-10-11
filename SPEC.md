# Clinic Database — Specification v0.1

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

### Patient
- Internal unique ID (e.g. `P-000123`), generated automatically. **Primary identifier.**
- Name, surname, father's name, date of birth, sex
- Phones (several, one marked main/WhatsApp), emails (several)
- Address
- AMKA — optional, searchable
- ΑΦΜ — optional (receipts)
- Referral source; GHL contact ID (link)
- Medical background: allergies, medication, conditions, smoking, previous surgeries
- Company (`Surgery` / `Spa`)
- Exact field list to be finalized from my-medical screenshots (pending).

### Visit
- Date/time, type (consultation, follow-up, post-op, other)
- **Free-text notes** (main content)
- **Vitals / measurements on every visit:** weight (required prompt), height,
  BMI (auto), blood pressure, pulse — list extensible. Weight shown as a trend chart.
- Optional: audio recording + AI transcript + AI review (§9)

### Surgery
- Date, hospital/clinic, procedure(s), anaesthesia, team
- Implants/materials with lot numbers
- Operative note, complications
- Status: proposed → booked → done
- Linked: specific consent (§7), surgical brief (§8), photos

### Document
- Type (general consent, procedure consent, lab result, other), file (PDF), date
- Optionally linked to a visit or surgery
- Signed documents store: signature image, timestamp, signer device/IP, file hash

### Photo link
- Patient folder on Synology, mapped by patient ID
- Tags: timepoint (pre-op, 1w, 1m, 3m, 6m, 1y…), body area, linked visit/surgery

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

## 7. Consents

- **First contact (everyone):** GDPR / data processing, photography consent,
  communication & marketing consent (separate tick boxes), consent to record the
  consultation (if used, §9). Signed digitally at intake.
- **Procedure-specific:** when a procedure is decided, the app generates the consent
  from a template for that procedure (patient details, procedure, risks pre-filled).
  The patient must sign it once the surgery is **booked** — the app tracks this and
  warns if unsigned as surgery approaches.
- Templates: one per procedure, editable by the surgeon, versioned (we always know
  which version a patient signed).
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
- Privacy: transcription/AI either runs locally (needs stronger hardware than the
  DS224+) or through an API provider with a signed DPA and zero data retention.
  **Decision pending.** Audio retention policy to be decided.

## 10. Integrations

- **GHL**: two-way sync of contact + appointment data only (name, phones, emails,
  lead source, appointment time, category). Never clinical data. Calendar choice pending.
- **Email (SMTP)** via a provider with a DPA: surgical briefs, consent links.
- **my-medical import**: one-time migration of patients and history (fields from
  screenshots, pending).
- Later: myDATA provider API (receipts); e-prescription stays on ΗΔΙΚΑ.

## 11. Users and roles (draft)

- Surgeon: everything
- Secretary: full access to patient records, including clinical notes (decided 11 Oct 2026)
- Spa staff: Spa company only
- Admin: users, settings, backups

Login and sessions (decided 11 Oct 2026):
- Password + 2FA (authenticator app) with one-time recovery codes.
- **Trusted devices:** after a successful 2FA login the user may tick "Trust this
  device". That device skips the 2FA code (password still required) for 90 days.
- **Weekly re-login:** all sessions end every Monday at 05:00 Athens time.
- No automatic logout on inactivity.
- **Generated passwords:** when creating a user or resetting a password, the admin can
  generate a strong password (16 characters, no look-alike letters). It is shown once,
  is temporary, and the user must choose their own at first login.
- **Admin devices screen:** per user, see logged-in devices (browser, IP, last
  activity) and trusted devices; end any session or remove trust. All logged.

## 12. Build phases

1. Foundation — login (with 2FA), roles, companies, audit log, backups
2. Patients, visits & vitals, documents, global search
3. my-medical import (once screenshots/export are available)
4. Intake: guest/tablet mode, QR, remote link, first-contact consents
5. Surgeries, procedure consent templates & signing, surgical brief, auto-email
6. Photo browser (Synology folders)
7. Calendar + GHL sync
8. AI consultation assistant
9. Receipts (myDATA provider), Spa workspace

## 13. Open decisions

- Calendar: built-in vs GHL
- AI: local vs API provider
- Off-site backup destination (needed by deployment)
- Exact patient fields (my-medical screenshots)
- Photo folder structure on the Synology today
- Legal check: e-signatures for surgical consent; consent wording
