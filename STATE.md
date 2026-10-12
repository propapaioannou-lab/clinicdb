# ClinicDB — State of the build

As of **12 Oct 2026** (commit after SPEC v1.10). Details: `SPEC.md` (v1.10, incl. §14 deviations
from DESIGN.md), plain-language history: `CHANGELOG.md`. Development only — no real
patient data anywhere yet; 15,600 fake patients for testing. 210 automated tests pass.

| Phase / step | Status | What changed from the original plan |
|---|---|---|
| **1 Foundation** — login, 2FA, users, companies, devices, audit log, backups | **Done** | Levels Owner/Admin/User/Guest **plus** separate roles; Owners can never be removed; generated passwords; trusted devices 90 d; weekly re-login Mon 05:00; audit log append-only in the database; nightly encrypted, test-restored backups. Auto-logout **10 min + PIN** decided later → built in 8c. |
| **2 Patients, visits, documents, search** | **Done** | See rows below. |
| 2 · patients & search | Done | Numbers per company (P-/S-), my-medical numbers kept at import; archive instead of delete; country code per phone; comments and newsletter removed from patient data; gender incl. trans man / trans woman / non-binary; red "incomplete" warnings; duplicate check at entry. |
| 2 · medical history | Done | Versions + verification by surgeon/PA; quick picks on every question; "Όλα Όχι"; high-risk profile; sensitive answers only for surgeon/PA/secretary, and never lost when someone else edits. |
| 2 · visits | Done | Much richer than planned: structured exams for every area with automatic Greek text, breast and eyelid measurement sketches, gender-specific breast findings (gynaecomastia, top surgery, feminizing augmentation), "Προεγχειρητική εκτίμηση" with implant specs and Motiva size charts, expanders, lift techniques, difficulty 1–10. Fee €100 for first visit, hidden from the surgeon; secretary/PA closes after payment; BP/pulse dropped. |
| 2 · documents | Done | Content-checked uploads, gallery, soft delete (Owner restores), Guests limited to clinical files, incremental encrypted document backups. |
| 2 · Settings (7a–7d) | Done | Lists, visit fees (secretary/PA only), history questions + picks, procedure catalogue, research export for Guests. Settings page grouped: Λογαριασμός · Ασφάλεια & πρόσβαση · Προσαρμογή ιατρείου · Οικονομικά. Medication/allergy/surgery picks still in code. |
| **2b UI refit** | **Mostly done** | Login/2FA/invite and admin screens still in the earlier simple layout. Own drop-down everywhere; dates typed dd/mm/yyyy. |
| **3 Intake** (tablet, QR, remote link, consents) | Not started | In the order after 6f. |
| **4 Surgeries, consents, brief** | Not started | Prepared: procedure catalogue with implant/technique details; allergy reminder at booking planned. Next after 6a. |
| **5 Photo browser** | Not started | Architecture changed: originals on the Synology, compressed copies via the mini PC to the cloud. In the order after 3. |
| **6a Calendar core** | **Partly done** | **Done:** 6a-1 data, holidays, clash check, status rules, Settings → Ημερολόγιο · 6a-2 secretary day view + booking · 6a-3 week/month + physician views · 6a-4 live home screens by role, ready-in-room banner (rooms: Θεραπευτήριο 1–3, Αίθουσα συσκέψεων; one «Γραφείο γιατρού» card), calendar ↔ visit link · **6a-5** (calendar v2) hours rules (office Mon/Tue/Thu 16:30–20:00, ±30′ flex with one extra click, off-hours/weekend need a reason, surgery window 07:30–14:00 — Settings → Ημερολόγιο → Ωράριο), types converted (Νέα συμβουλευτική 25′, Επανέλεγχος 10′, Botox 10′; old ones hidden), Mon–Fri week/month with «+ Σαβ/Κυρ», two-band day/week, top strip, one-line header, menu rail, fake week 12–16 Oct. Matched to the v3 boards (CalSec*/CalDoc*): surgery-time bar per day (week/month), surgery blocks in the physician's week/month, band labels, compact top strip. **To do:** 6a-6 quick booking + arrival check · 6a-7 move (drag, resize, undo) · 6a-8 cancel without delete, automatic flags, waiting-list offer · 6a-9 «+ Ραντεβού» from the patient record · 6a-10 staff chat. |
| 6b–6f Surgery scheduling, schedule e-mails, GHL, front desk, tasks | Not started | 6b–6f defined in SPEC v1.6 (new). v1.10: surgery window 07:30–14:00; «+ Χειρουργείο» floating thumbnail, fit badges and override in 6b. |
| **7 AI assistant** | Not started | Build after go-live and after the lawyer's answer on AI Act scope. |
| **8c Integrity** (§3b) | Not started | New in v1.6: versions instead of overwriting everywhere, hash-chained audit log, qualified timestamps, evidence export, auto-logout + PIN. |
| **8 Receipts** (myDATA via Epsilon Net) | Not started | — |
| **9a–9d Mini PC, test import, backups, cloud go-live** | Not started | Replaces "deploy on the Synology after Phase 2". Done ahead: load test (fits easily), safe image builds, backup/restore scripts incl. documents. |
| **10 Spa workspace** | Not started | Spa already has its own company, lists, calendar types and cabins. |

**Current order (SPEC v1.10):** 6a (finish) → 4 → 6b → 6c → 6f → 3 → 5 → 6d → 6e → 8c → 8 →
9a → 9b → 9c → 9d (go-live) → 7 → 10 (Spa).

## Open questions
- Real locations. (Hours and appointment lengths decided in SPEC v1.10.)
- Implant charts still missing: **Mentor** (all lines, expanders) and **Motiva Ergonomix 2 Mini/Demi**.
- Who may collect payments and issue receipts; is the deposit a crucial readiness item; "medical history verified" as crucial item.
- Patients-page filter "Χειρουργείο": surgery within 30 days, or any surgical patient?
- AI: local vs API provider; video service for online consultations.
- Legal: Guest access legal basis + confidentiality agreement; e-signatures; evidential value / qualified timestamp provider; AI Act scope.
- Hosting: choose EU provider + DPA; second provider for write-once off-site backups; email provider with DPA.
- Send the **my-medical export request** early (may take weeks).
- Before your next SPEC edit elsewhere: start from this SPEC.md (v1.10), or decisions get lost again.
