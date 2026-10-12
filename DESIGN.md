# DESIGN.md — Interface (approved 11 Oct 2026, v2: secretary + calendar; v3 12 Oct 2026: calendar v2)

The surgeon reviewed and approved these screens on a design canvas. This file plus
the mockups in `design/` describe **how the app looks and behaves**. `SPEC.md`
describes **what it does**. If they disagree, ask the surgeon.

## How to use the mockups in `design/`
- They are reference drawings in HTML with inline styles. They do **not** run on
  their own. Read them as source code. Do not copy them into the app.
- Rebuild each screen as React components with Tailwind, using the tokens below.
- Ignore the mockup machinery: `<x-dc>`, `<helmet>`, `{{holes}}`, `<sc-for>`,
  `<sc-if>` and the `class Component extends DCLogic` script. The script only shows
  which states exist (e.g. tab selected, Yes/No answered, history verified).
- The arrays inside the scripts are useful seed data, for example the procedure
  catalogue with sub-options in `Visit.dc.html`, the history questions in
  `IntakeHistory.dc.html`, and the patient-page tabs. All names and figures are fake.

| File | Screen |
|---|---|
| `Main.dc.html` | 1a · Home — physician, office day ("Ιατρείο") |
| `Assistant.dc.html` | 1b · Home — PA / nurse |
| `Surgery.dc.html` | 1c · Physician, surgery day ("Χειρουργεία") |
| `SurgeryMobile.dc.html` | 1d · Surgery day on a phone |
| `Patients.dc.html` | 2a · Patients — search page |
| `Patient.dc.html` | 2b · Patient record |
| `Visit.dc.html` | 3 · New visit |
| `Intake.dc.html` | 4 · Intake form on tablet, step 2a (medication, allergies, smoking, weight) |
| `IntakeHistory.dc.html` | 4b · Intake form, step 2b (full history questionnaire) |
| `Secretary.dc.html` | 1e · Home — secretary / reception ("Υποδοχή") |
| `Calendar.dc.html` | 6 · Calendar functions: booking panel, surgery booking + availability grid, schedule e-mails (layout superseded by 6a–6f) |
| `CalDocDay/Week/Month.dc.html` | 6a–6c · Physician calendar — day / week / month |
| `CalSecDay/Week/Month.dc.html` | 6d–6f · Secretary calendar — day / week / month |
| `CalSecDay`, `CalSecWeek`, `CalSecMonth`, `CalDocDay`, `CalDocWeek`, `CalDocMonth`, `CalStates` (6g), `Patient` (2b) — v3, approved 12 Oct 2026 | 6a–6f redrawn for calendar v2 (two bands, top strip, Mon–Fri); **6g** booking, move, cancel, arrival and override states; **2b · booking from the patient record** («+ Ραντεβού ▾» / «+ Χειρουργείο») |

## Design tokens (put them in `tailwind.config` as named colours)
- Font: **Commissioner** (Google Fonts, has Greek), weights 400/500/600/700; fallback
  system-ui. Self-host the font files, so no request goes to Google from the server.
- Colours:
  - `primary` #0E5E63 (teal), hover #0A4549, tint #E6F0EF, light tint #F5F9F9
  - `ground` #F4F3EF (app background), `surface` #FFFFFF, `surface-2` #FBFAF8
  - `ink` #1C2024 (text), `ink-2` #2C3238, `ink-3` #3B4249, `muted` #5B636B,
    placeholder #6B7178
  - `line` #E4E2DC (borders), `line-strong` #DAD8D1 (input borders), `line-soft`
    #ECEAE5 / #F1F0EC (dividers, segmented-control background)
  - Status: green #2E9E63 (text #1E6B45 on #E3F1EA); orange #D98A1C (text #8A4B08 on
    #FCF1E3); red #C8312A (text #8C1D18 on #FBE9E7); info navy #2F4B6E on #EEF2F7
- Radius: inputs/buttons 9–12px, cards 14–16px, pills 999px.
- Sizes: staff screens min 44px touch targets and 14.5–15px body text. **Patient
  tablet form**: 56–60px buttons and inputs, 16–18px text, one column.
- Cards: white, 1px `line` border, no heavy shadows.

## Layout rules
- **App shell**: left menu (≈232px) + top bar with global patient search
  (placeholder "Αναζήτηση ασθενή — όνομα, τηλέφωνο, email, ΑΜΚΑ", shortcut Ctrl K).
- **Left menu**, in order: Ιατρείο · Ασθενείς · Ημερολόγιο · Χειρουργεία · Εργασίες
  (with counter). Ρυθμίσεις and the user card sit at the bottom. Above the menu is a
  company switch **Ιατρείο | Spa**. Keep the menu short. Everything else goes inside
  pages, not in the menu.
- **No mode toggles.** Office day and surgery day are two menu items. Each opens on
  today with ‹ › day navigation and a "Σήμερα" button.
- **Mobile-first**: every screen works on a phone. On a phone the left menu becomes a
  bottom bar (Σήμερα, Αναζήτηση, Chat, Ημερολόγιο), and cards expand on tap. See
  `SurgeryMobile.dc.html`.
- **Role-based home**: physician → 1a; PA/nurse → 1b; secretary → 1e.
- **Menus per role.** Physician: Ιατρείο · Ασθενείς · Ημερολόγιο · Χειρουργεία ·
  Εργασίες. PA/nurse: see 1b. Secretary: Υποδοχή · Ημερολόγιο · Ασθενείς · Μηνύματα ·
  Πληρωμές · Λίστα αναμονής.
- **Company switch (Ιατρείο | Spa) really switches data.** Spa has its own calendar,
  resources and appointment types; practice and spa never appear in one calendar.
- **Expand in place**: long lists (to-dos, surgery checklists) are grouped and
  collapsed. Click a group to expand it. Avoid modal pop-ups where possible.
- All text in translation files (Greek first, English later), as CLAUDE.md requires.

## Screens

### 1a · Physician — Ιατρείο (office day)
- Live clock **at the top left** (before the greeting/date), with seconds and a countdown to the next appointment (amber ≤5 min,
  red "late X min").
- A **"ready in room" banner** appears when the assistant marks a patient ready,
  with a sound and an optional phone push.
- Today's appointments, with status Αναμένεται → Στην αναμονή → Έτοιμος · Δωμάτιο X →
  Ολοκληρώθηκε. Online appointments show "Έναρξη κλήσης".
- Side column: staff chat with one-tap presets, and the physician's own tasks.
- **"Για έλεγχο σήμερα"** list in the side column: follow-up photos to review, new
  patients asking for an evaluation (email/WhatsApp with photos), results to sign,
  urgent items flagged by staff. One tap opens the item; tick to clear. (Not yet drawn.)
- No money on the surgeon's screens: quotes and payments are handled by PA/secretary.

### 1b · PA / nurse home
- Room board (waiting / room 1 / room 2). "Ready → notify doctor" sets the status
  and triggers the banner on 1a/1c.
- Today's schedule table, with confirmation, form and payment status.
- "Προς διεκπεραίωση": collapsible groups (intake forms to review and duplicates,
  WhatsApp messages, unconfirmed bookings).
- Surgery checklists: collapsible per patient, with action buttons (send consent
  link, remind about bloods, send brief).
- Chat with the doctor.

### 1c · Physician — Χειρουργεία (surgery day)
- Full width, with **no** chat, tasks or upcoming list. The "ready in OR" banner still
  shows.
- One card per operation: time, patient, procedures, plan snippet (from the
  planning sketch), pre-op photo thumbnails, and a **readiness light**:
  - green = all items done
  - orange = a secondary item is missing (deposit, photos, brief sent)
  - red = a crucial item is missing (consent, bloods, pre-op clearance)
  - which items are crucial is set in Settings
- Each card has an expandable checklist.

### 1e · Secretary — Υποδοχή
- Top: date + location, small stat tiles (appointments, waiting, to pay, collected
  today). Header buttons: Φόρμα εισόδου (QR), Νέος ασθενής, + Νέο ραντεβού.
- **Αφίξεις σήμερα**: one row per appointment with time, name, flag, type, small tags
  (form not filled, not confirmed, possible duplicate) and status. One main button per
  row moves the patient on: Άφιξη ✓ → Έτοιμος · ειδοποίηση (notifies doctor) → Τέλος
  επίσκεψης → **Είσπραξη X €**. Secondary: Δεν ήρθε, Στείλε φόρμα. Online appointments:
  "Άνοιγμα κλήσης".
- Είσπραξη expands **inline** under the row: amount, method (cash / card POS / bank
  transfer), "Είσπραξη & απόδειξη (Epsilon Net)" → row shows "Εξοφλήθηκε · ΑΠΥ n".
- Right column: tiles (new intake forms, duplicates, WhatsApp messages); **tomorrow's
  confirmations** with progress bar and the unanswered ones (Επιβεβαιώθηκε / Κλήση);
  **waiting list** — on a cancellation, matching people with "Πρόταση WhatsApp"
  (first to accept gets the slot, others are told automatically); **surgeries –
  administrative** (hospital booked, quote signed, deposit, bloods appointment) with
  red/orange/green dot; chat with presets.
- **No clinical notes** anywhere on the secretary's screens.

### 6 · Calendar
- Toolbar: ‹ Σήμερα ›, range title, view switch Ημέρα | Εβδομάδα | Μήνας,
  "+ Νέο χειρουργείο" (dark blue, practice only), "+ Νέο ραντεβού".
- Second bar: calendar chips that switch layers on/off (practice: Ιατρείο, Online,
  Χειρουργεία; spa: Θεραπείες Spa), location, "✉ Εβδομαδιαίο χειρουργείων",
  "✉ Μηνιαίο πλάνο κλινικής", GHL sync status.
- **Week**: Mon–Sat columns, 08:00–21:00, 56 px/hour, scrolls inside its box. Colour
  per type (first visit teal, follow-up/post-op light teal, pre-op amber, injectable
  purple, online dashed, surgery dark blue, blocked hatched). ✓ confirmed, ? waiting,
  ✕ no-show (struck through), done = faded. Nurse appointments sit in a narrow side
  lane. Under each date a **surgical load bar** (e.g. "7ω 30′/7ω · πλήρες").
- **Day**: one column per resource (practice: Δρ Παπαϊωάννου, Νοσηλεύτρια,
  Χειρουργείο; spa: Καμπίνα 1, 2). 96 px/hour, more detail per block: time range,
  type, confirmation / form / payment; for surgeries anaesthesiologist, anaesthesia
  type, nurse.
- **Month**: per day, pills with number of appointments and "Χειρ. ×n · hours"
  coloured by load (blue full, orange limited); public holidays marked.
- Red "now" line on today. Click empty slot → new appointment at that time.
- **Side panel** (right, 360 px; 420 px for surgery booking / e-mails):
  - Appointment details: phone, place, confirmation, form, money, who booked it
    (staff or online via GHL); buttons Επιβεβαίωση / Υπενθύμιση WhatsApp / Μετακίνηση /
    Ακύρωση / Άφιξη / Δεν ήρθε; link to patient record. Note: no clinical notes.
  - **New appointment**: patient search (shows matched field, "+ Νέος ασθενής"), type
    chips (each with default length), "Πότε" box with clash warning and suggested free
    slots, with whom / where, switches (WhatsApp confirmation via GHL, 24 h reminder,
    send intake form, request deposit), "Κράτηση ραντεβού".
  - **New surgery**: procedure chips with estimated time → total; **availability
    grid** (3 weeks × Mon–Fri): green "Ελεύθερο / υπόλ. Xω", orange "Μόνο ≤2ω", grey
    "Δεν χωράει / Πλήρες / Αργία"; tap a day → proposed start/end ("μετά από …");
    switches (inform patient, create surgery checklist, send consent, deposit);
    "Κράτηση χειρουργείου".
  - **Schedule e-mail**: preview table (when, patient, age, procedure, anaesthesia,
    duration), recipients with ticks, auto-send switch, privacy note, "Αποστολή τώρα"
    → "✓ Στάλθηκε … · καταγράφηκε".

### 6a–6f · Calendar views per role (11 Oct 2026, supersedes the layout of 6)
Principle: each person sees only what they act on.
- **Physician** (no money, no other people's columns, no booking buttons):
  - Day: one wide timeline (72 px/h), blocks with time, name, type + reason, status
    pill; free gaps as faint text; red now-line. Side: "Τώρα", **next patient** card
    (flag, key history, history-verified state, intake photos, "Άνοιγμα καρτέλας"),
    day at a glance (counts), tomorrow's surgeries with readiness dots.
  - Week: 6 day cards — day-type chips, surgeries (dark blue, time, procedure,
    duration, readiness dot), load bar, office hours + count, new patients by name +
    area, blocks; totals on top. A card opens the day.
  - Month: per day surgeries (count · hours · procedures, dark blue) and office count;
    holidays; totals on top.
- **Secretary** (operational; "+ Χειρουργείο", "+ Ραντεβού" in the header; GHL status):
  - Day: columns Δρ / Νοσηλεύτρια, status chips (✓ WhatsApp, Ήρθε 11:38, Φόρμα 2/4,
    100 € μετά), **free gaps as dashed green "+ ελεύθερο 30′"** (click = book there);
    side: **Αιτήματα κράτησης** cards (reason chip: Υψηλή αξία / Πλήρες > 10 ημέρες /
    Σύγκρουση; actions Βρες χρόνο, Πρόταση, Κλήση) and tomorrow's confirmations.
  - Week: compact grid 52 px/h, one line per appointment with ✓/?, out-of-hours
    shaded grey, header per day "ελεύθερα Xω" (red 0′, amber 15′) + surgical load bar;
    nurse column toggled on demand; requests banner on top; legend below.
  - Month: availability map (green ≥ 2 h free, amber < 2 h, red full) + surgery-day
    chip (πλήρες / μόνο ≤2ω / υπόλ. Xω), holidays; orange banner when new-patient
    slots are full > 10 days, with the first free slot.

### 6a–6g · Calendar v2 (12 Oct 2026, supersedes the layout parts of 6 and 6a–6f)
**Layout**
- The left menu collapses to a **68 px icon rail** with a «»» button; the choice is
  remembered per device; it collapses by itself under 1280 px.
- **One-line header**: ‹ Σήμερα › · title · Ημέρα / Εβδομάδα / Μήνας · Δευ–Παρ (with
  «+ Σαβ/Κυρ») · actions.
- Side widgets move to a **top strip of tiles** that expand downward:
  - secretary: Αιτήματα κράτησης, Επιβεβαιώσεις αύριο, Λίστα αναμονής, Νέες φόρμες, GHL
    status;
  - physician: Τώρα, Επόμενος (rich), Σήμερα, Αύριο.
- The calendar itself uses the full width.

**Time scale**
- Day and week views use **two bands**, with 14:30–16:00 collapsed:
  - surgery band compact (day ≈ 52 px/h, week ≈ 40 px/h);
  - office band detailed (day ≈ 144 px/h, week ≈ 112 px/h), so 10′ appointments stay
    readable.
- Replaces the uniform 96 px/h (and 56 / 72 / 52 px/h above). The now-line and
  auto-scroll work per band.

**Other**
- Week Mon–Fri; month **5 columns** (Mon–Fri); Sat/Sun only with «+ Σαβ/Κυρ».
- Colours: Νέα συμβουλευτική #4E9A95; Επανέλεγχος #9CC3BF; Botox #8A5A9E; flex zone
  hatched; closed #ECEAE5; surgery-window tint #F5F7FA.
- **6g** states: quick-booking panel next to the slot (search, type chips, new patient
  with name only, «Μήπως υπάρχει ήδη;»), arrival «Επιβεβαίωση στοιχείων», lifted card /
  red ghost while moving, toast «Μετακινήθηκε → …» with undo and «☑ Ενημέρωση ασθενούς»,
  the four cancel options, the override step (reason).
- **2b · booking from the patient record**: «+ Ραντεβού ▾» (type → week view with the
  floating patient thumbnail and a ghost block of the exact length) and «+ Χειρουργείο»
  (navy thumbnail, «✓ χωράει / ⚠» per day — phase 6b).

### 2a · Patients
- A large search box with accent-, case- and space-insensitive search as you type.
  Each result shows **which field matched**.
- When the search box is empty, the page shows "Προτεινόμενοι σήμερα" (patients
  with an appointment or surgery today) and "Πρόσφατα".
- Filter chips: Όλοι · Ιατρείο · Χειρουργείο · Spa · Με σήμανση.
- Yellow and red flags show as small markers.

### 2b · Patient record
- The header row holds three cards side by side:
  - **Patient card**: name, age, ID, AMKA, phone, flag, infectious-disease alert.
  - **Weight widget**: current weight, maximum weight, BMI, and a small trend.
  - **Medical history widget**: key answers, with the footer "Συμπλήρωσε η ασθενής ·
    date". When the history is unverified, the footer shows a "Εκκρεμεί επιβεβαίωση"
    pill and an "Επιβεβαίωση ✓" button. When verified, it shows "✓ Επιβεβαιώθηκε ·
    name (role) · date time".
- The header has no back link and no row of action buttons.
- Tabs with counts: Επισκόπηση · Ιατρικό ιστορικό · Επισκέψεις · Χειρουργεία ·
  Θεραπείες · Φωτογραφίες · Οικονομικά · Έγγραφα.
  - The Visits tab has a "Νέα επίσκεψη" button.
  - The Financial tab shows charged / paid / pending, each movement, and the Epsilon
    Net receipt with its ΜΑΡΚ.
  - The Photos tab shows sessions with thumbnails.
  - Treatments is its own table, separate from surgeries.

### 3 · New visit
- Visit type and an optional recording control (Phase 7).
- **Clinical evaluation**: a "General / patient's request" text box, plus one
  section per area (Μαστός, Πρόσωπο, Σώμα, Μύτη, Γεννητικά, Άλλο). Sections
  are added and removed as needed. Each section has reminder chips and free text.
- **Procedures discussed**: a picker by area. Some procedures open sub-options when
  chosen (facelift, rhinoplasty, eyelids, FFS, facial implants). The chosen items
  show as chips.
- **Surgical planning panel** appears only when a surgical procedure is chosen. It
  has one tab per needed template:
  - breast: unified worksheet with R/L measurements, classification, conditional
    revision and reconstruction groups, and plan
  - rhinoplasty: sketch plus checklist
  - face
  - body: full-body front and back including the face, plus measurements
  - each tab has pen input
- Vitals (weight prompt, height, BMI, BP, pulse), fee and amount collected. The
  previous visit is shown for reference.

### 4 / 4b · Intake form (tablet, QR, remote link)
- Steps: 1 Στοιχεία · 2 Ιστορικό · 3 Συγκαταθέσεις · 4 Υπογραφή.
- A Greek/English switch is at the top. A lock icon exits guest mode and asks for the
  staff PIN.
- Step 2a: medication, allergies, smoking (with per-day amount and product
  follow-ups), and weight / maximum weight / height.
- Step 2b: the full questionnaire by body system (see SPEC §4 Medical history), with
  Ναι/Όχι buttons, a detail box that opens on Ναι, a progress counter "x / y
  απαντήθηκαν", and a previous-surgeries table with "+ Προσθήκη".
- Large targets, one column, and no free-form layout.

## Screen → phase (build each piece when its phase comes, already in this design)
| Phase | Build now from the design |
|---|---|
| **2b UI refit** (now) | App shell and left menu, company switch, global search, 2a Patients, 2b patient record (header widgets; Overview, Medical history, Visits, Documents tabs), 3 New visit (without planning sketches and recording), phone layout. Tabs for later phases are shown greyed out with "σύντομα". |
| 3 Intake | 4 / 4b intake form; history verification in 2b; intake and duplicate items in 1b "Προς διεκπεραίωση" |
| 4 Surgeries | Surgeries and Treatments tabs; planning panel with sketches and pen; 1c and 1d surgery day with readiness lights and checklists |
| 5 Photos | Photos tab; photo thumbnails on surgery cards |
| 6a Calendar v2 (6a-5 … 6a-10) | 6a–6g layout (rail, one-line header, top strip, two bands, Mon–Fri), quick booking, arrival check, move, cancel, «+ Ραντεβού» from 2b, staff chat |
| 6 Calendar + GHL | Calendar (6) incl. surgery booking/capacity and schedule e-mails, 1e secretary home, 1a and 1b home screens with live appointments, room board, ready-in-room banner, staff chat with presets, online-call button |
| 6f Tasks | "Εργασίες" page (tabs Σήμερα / Καθυστερούν / Επόμενες / Ολοκληρωμένες, filter by person), "+ Εργασία" buttons, "→ Εργασία" in chat, tasks on home screens and patient record — screen to be drawn; follow the cards/rows style of 1b "Προς διεκπεραίωση" |
| 7 AI | Recording control in New visit |
| 8 Receipts / Spa | Financial tab (Epsilon Net, ΜΑΡΚ) |

Until Phase 6, the home page can show a simple placeholder ("Σήμερα" with links to
Ασθενείς and Νέα επίσκεψη).
