# Clinic Database — Specification v1.1

Status: draft, 11 Oct 2026. Living document — update as decisions are made.
Owner: the surgeon (product owner, tester). Code: written by Claude Code.
Screens and look: `DESIGN.md` + reference mockups in `design/` (approved 11 Oct 2026).

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
  Built (Phase 1): nightly 02:30 Athens; each copy test-restored before it is kept;
  bundle includes settings (.env with APP_SECRET); encrypted with a public key, the
  private key kept off the server by the owner; keeps 14 daily, 8 weekly, 12 monthly;
  status page and warning bar in the app; every run in the audit log.
- Development on the Linux laptop; deployment to the Synology with the same containers.
- **Resilience & security hardening** (from the 11 Oct review):
  - Encrypted Synology volume; a written, timed restore procedure; one backup copy the
    server itself cannot delete (immutable/offline) against ransomware.
  - UPS with automatic safe shutdown; 4G backup router; staff in the office can reach
    the app over the local network if the internet is down.
  - Printable "today" sheet (PDF): time, initials, procedure — no full names or
    clinical details on paper that leaves the building.
  - **No** auto-logout after inactivity (decided again 11 Oct 2026, see §11); new devices approved in
    Tailscale; per-person logins only; same-day disable for departing staff.
  - Audit log append-only and hash-chained; monthly "who opened what" report flags
    unusual access.
  - Extra field encryption + clinical-roles-only visibility for the most sensitive
    answers (HIV, hepatitis, substance use, mental health); never in schedules, exports
    or briefs unless needed. **Decided 11 Oct 2026:** visible to Surgeon, PA/nurse and
    Secretary only (not spa staff, "Other" roles or Guests); for them the
    infectious-disease alert reads just "Μολυσματικό ⚠", without the disease.
    Field encryption of these answers: before deployment.
  - Patients get a secure photo-upload link (instead of sending photos by WhatsApp).

## 4. Core data

### Patient — basic info (from my-medical "Βασικά", ~15,300 patients today)
- **Patient number** — primary identifier, unique within each company. Patients imported
  from my-medical keep their my-medical number; new patients get the next number after
  the highest. After the import, the duplicate batch tool (§6b) checks names.
  (Decided 11 Oct 2026.) Shown as in the design: `P-004218` (Spa: `S-000123`).
- Surname (required), name, father's name
- Marital status (list), referral / "Σύσταση" (who referred)
  (my-medical's "Κατηγορία" dropped — never used)
- Date of birth → age shown automatically (years + months)
- Registration date (auto)
- Area, address, city, postcode, country
- Phones: several, each with a type (mobile, home, work); one marked main/WhatsApp.
  Each number is entered with a **country code** (picker, Greece +30 by default).
  Emails are checked for a valid format as they are typed. (Decided 11 Oct 2026.)
- **WhatsApp check of the main number** (Phase 6, via GHL): "Verify via WhatsApp" sends
  the patient a message; the patient taps to confirm; the number shows verified (with
  date) or "not delivered — check the number / resend". Saving never waits for it;
  until confirmed the number shows "unverified".
- Emails (several)
- Sex, occupation
- **Communication language** (Greek / English; default Greek). Decides the language
  of every form, consent, link and message for this patient; synced to GHL as a field
  so GHL workflows send in the right language. Set at intake from the language the
  patient chose on the form; staff can change it.
- AMKA — optional, searchable
- Tax data for receipts: ΑΦΜ, ΔΟΥ (list)
- City + phone for e-prescription (separate fields in my-medical)
- Newsletter / marketing consent: **not** in basic details — only in the consent forms (§7).
  (Decided 11 Oct 2026.)
- Infectious diseases (ΜΟΛΥΣΜΑΤΙΚΑ) — shown as an alert on the patient header; entered in the
  medical history (Infections section), **not** in basic details (decided 11 Oct 2026).
- Profile photo (upload or tablet camera)
- Treating doctor — chosen from app users whose role is Surgeon (§11)
- Comments: **removed from patient data** (decided 11 Oct 2026) — the field came from the
  previous agency's system and caused confusion; my-medical comments are not imported.
- **Patient flag** (replaces my-medical "Κριτική"): none / 🟡 yellow / 🔴 red, with
  reason(s) from an editable list (bargained for discount, no-show, came late, …),
  free-text note, date and who set it. Shown as a small coloured marker on the patient
  header, in search results and in the calendar. Staff-only; never sent to GHL or shown
  to the patient. Write reasons factually — under GDPR a patient's access request can
  include them.
- GHL contact ID (link); company (`Surgery` / `Spa`)
- Patient overview shows the list of past visits (date, type, diagnosis).
- **Never deleted in the app** (records are kept 10 years, §7a). An Owner can
  **archive** a patient: hidden from search and lists, everything kept, can be undone.
  Permanent removal (e.g. a merged duplicate) only through §6b merge or a server command.



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
- Smoking: yes/no/former; if yes → per day (0–5 · 5–20 · >20) and product
  (cigarette · e-cigarette · heated tobacco).
- Same questions appear in the patient intake form (§6) so patients fill them in
  themselves; the surgeon reviews.
- **Structured questionnaire** (gather as much as possible; reference
  `design/IntakeHistory.dc.html`). Each question = Yes/No + detail text when Yes;
  questions live in a list editable in Settings (key, label GR/EN, detail prompt,
  section, order), so new ones need no code change. Seed sections and keys:
  - Heart & circulation: `hyper` hypertension, `heart` heart disease/arrhythmia/
    valves/pacemaker, `clot` thrombosis/PE (self or relatives), `varic` varicose veins
  - Lungs: `asthma` asthma/COPD, `apnea` sleep apnoea/snoring (CPAP?)
  - Blood & clotting: `bleed` easy bruising/prolonged bleeding, `anticoag`
    anticoagulants/aspirin, `anemia` anaemia/thalassaemia trait
  - Stomach, liver, kidneys: `gi`, `liver`, `kidney`
  - Nervous system & mental health: `neuro` epilepsy/stroke/migraine, `mental`
    depression/anxiety/other (treated or not)
  - Endocrine: `diab` diabetes (type, treatment), `thyroid`, `hormone` hormone
    therapy/contraception
  - Infections: `hiv`, `hepb`, `hepc`, `herpes` (how often), `otherinf`
  - Habits: `alcohol` (drinks/week), `drugs` substance use (marked confidential),
    `glp` weight-loss drugs (Ozempic/Mounjaro…), `iso` isotretinoin in last 12 months
  - Healing & anaesthesia: `keloid`, `anaest` anaesthesia problems (self/relatives),
    `latex` latex/tape/antiseptic allergy
  - Gynaecological: `preg` possible pregnancy/breastfeeding, `futurepreg` future plans
  - A free-text "history notes" box at the end of the questionnaire stays (decided
  11 Oct 2026).
- Plus medication, allergies, smoking, weight/max weight/height (step 2a) and a
    **previous surgeries table** (procedure, year, complications; add rows).
- Any Yes in Infections also fills the "Infectious diseases" alert on the patient
  header (§4) — after verification.
- **Quick picks** (decided 11 Oct 2026): on Yes, medication, allergies and previous
  surgeries offer the most common choices to tick, each with a notes box:
  medication (anticoagulants, antiplatelets, thyroxine/T4, contraceptive, HRT, sleeping
  pills, anxiolytics, antidepressants, antihypertensives, antidiabetic/insulin, GLP-1,
  corticosteroids, immunosuppressants, statins, supplements); allergies (penicillin,
  amoxicillin/Augmentin, cephalosporins, sulfonamides, macrolides, quinolones, NSAIDs,
  aspirin, metamizole, opioids, local anaesthetics, chlorhexidine, iodine/contrast,
  foods); surgeries (caesarean, appendectomy, cholecystectomy, hernia, hysterectomy,
  tonsillectomy, thyroidectomy, bariatric, breast, orthopaedic, varicose veins,
  rhinoplasty/septum, liposuction/abdominoplasty, cataract). Lists editable in Settings.
  **Every questionnaire question** has its own quick picks too (e.g. Υπέρταση: ACE/ARB,
  β-blockers, Ca-blockers, diuretics, controlled/uncontrolled; Θρομβοφιλία: Leiden,
  prothrombin, protein C/S, antithrombin, APS, MTHFR; Ψυχική υγεία incl. body dysmorphic
  disorder), shown on Yes, plus the notes box. Stored with each question, editable in
  Settings (decided 11 Oct 2026).
- **"Όλα Όχι"** button (whole form and per section) sets every *unanswered* item to No;
  answers are never pre-filled, so every No was given by someone.
- **High-risk profile** (decided 11 Oct 2026), worked out from the latest answers
  (verified or not): smoker >20/day; anticoagulants or antiplatelets; thrombophilia or
  past thrombosis/PE, own or in a first-degree relative (confirmed 11 Oct 2026); thyroxine (T4). Shown as a red "Υψηλός κίνδυνος" badge with the
  reasons on the patient record, patient lists and search, and later on visits,
  planning, calendar, surgery booking and surgery-day cards. Rules editable in Settings.
- **Allergy reminder**: when a surgery is booked (Phase 4/6) and when medication is
  prescribed or listed for a surgery/brief, the patient's recorded allergies are shown
  as a warning to confirm.
- **Verification** (required): patient-entered history is marked "Pending
  verification" until a physician or PA/nurse reviews it with the patient and presses
  "Verify ✓". Stored: verified by (user + role), date/time, and a snapshot/version of
  the answers verified. Staff may correct answers while verifying (each change
  audited, original patient answer kept). Any later patient update (e.g. "update your
  history" link) resets the status to pending. Shown on the medical-history widget of
  the patient record.

### Visit
- Date/time, type from an editable list. **Clean list of our own** (decided 11 Oct 2026):
  Πρώτη επίσκεψη · Προεγχειρητική εκτίμηση · Επανέλεγχος · Μετεγχειρητικός · Άλλο. The old
  my-medical visit types are messy and are **not copied**; how they map onto ours is
  decided at import time, once the export is in hand (§10).
- Diagnosis / comment (free text)
- **Procedures discussed**: picker by area (Face · Breast · Body · Genital · Other),
  multi-select across areas; list editable in Settings. Procedures can have
  sub-options shown when selected, e.g. Facelift (deep plane, deep neck, temporal
  MORE, nanofat, eyelids, mini lift, midface, endoscopic brow, forehead lift, SMG
  reduction, platysmaplasty, fat); Rhinoplasty (open/closed/preservation, revision,
  septoplasty, spreader, septal extension, columellar strut, alar rim, diced cartilage,
  rib/ear cartilage, osteotomies, base reduction, turbinates) — also a checklist beside
  the rhino sketch; upper/lower blepharoplasty variants; FFS and facial implant
  components. Face list includes Bichat reduction and lip lift. Drives consent templates,
  planning-sketch template and the AI consultation checklist.
- **Structured examination per area** (decided 11 Oct 2026; built for Breast first,
  the other areas follow the same pattern): tapping a finding (e.g. Πτώση, Όγκος,
  Ασυμμετρία, Χαλαρότητα δέρματος, Πάχος ιστού, Θηλή-άλως, Υπομαστική πτυχή,
  Σωληνοειδής, Θωρακικό τοίχωμα) opens its multiple-choice details (degree, side,
  which side is bigger, Regnault grade, cup, …). The findings are **written up as
  Greek sentences automatically** («Ασθενής 43 ετών με μέτρια πτώση (Regnault II)…»)
  straight into the area's **"Επιπλέον ευρήματα"** text, which stays editable: it follows
  the taps until the doctor edits it, then keeps the doctor's wording ("↻ Ξαναγράψε από
  τις επιλογές" rewrites it). That text is the visit's record of the findings, for memos
  and private-insurance certificates.
  **Revision**: a switch adds previous operations in the same area (with year, typed)
  and implant findings (Baker, malposition, rippling, rupture, double bubble,
  animation). **Difficulty 1–10**: rank 1 = standard; each rank above adds **+5% to the
  surgical fee** (applied in the quote, never shown to the surgeon) and **+10′ to the
  operating time**. Used when there is no AI transcript.
  **All areas** (decided 11 Oct 2026) use the same engine, with standard scales:
  Breast/chest — the basic measurements in cm, right/left (JMD, nipple–midline, N–IMF
  under stretch, base width, areola; intermammary distance), in a compact table with a
  **front-view breast evaluation sketch** beside it (consultation-sheet style) where the
  same values can be typed on the drawn lines (decided 11 Oct 2026); breast and nose
  measurements use English abbreviations (JMD, N–ML, N–IMF, BW, IMD; NFA, NLA, Goode);
  **gender** (patient field: female, male, trans man, trans woman, non-binary — "other"
  removed) picks the findings offered: women → breast findings, men → gynaecomastia,
  trans men / non-binary → top surgery, trans women → breast findings + feminizing
  augmentation documentation (dysphoria, estrogen and months, breast growth on
  hormones, WPATH letter, capacity, stable health); the breast procedures offered follow
  the same rule (trans women → augmentation only; trans men → top surgery); "all" is one
  tap away; before any breast procedure the app warns if JMD, N–IMF under
  stretch and base width are missing (for gynaecomastia/top surgery: areola instead of
  base width). Gynaecomastia (Simon I–III), and **top surgery / gender dysphoria
  documented separately** (identity, persistent chest dysphoria, goal, nipples, binder,
  hormones and months, WPATH SOC-8 assessment letter, capacity, technique). Face —
  forehead, brows, upper lids (dermatochalasis, fat, MRD1, levator function, ptosis),
  lower lids (fat bags, tear trough Hirmand, snap/distraction, scleral show, negative
  vector, festoons), midface deflation, jowls, neck (Dedo I–VI, laxity, submental fat,
  platysmal bands, submandibular gland ptosis, cervicomental angle), skin (Glogau,
  Fitzpatrick), ears, chin. Nose — dorsum, deviation, tip, base, airway (septum, valves,
  turbinates), skin; angles, Goode ratio, projection, length. Body — abdomen (Matarasso,
  pannus grade, diastasis cm, hernias, scars), massive weight loss, lipoedema (stage 1–4,
  type I–V, symptoms, cuff sign, Stemmer), arms/thighs/buttocks/back/mons (Pittsburgh
  laxity). Genital — labia minora (Franco, length), clitoral hood, labia majora, vaginal,
  MtF prerequisites. Other — scar (Vancouver), skin lesion (ABCDE). Write-ups never
  assume the patient's gender.
- **Fewer taps** (decided 11 Oct 2026): a newly added evaluation area opens at the top.
  Each examined area opens its surgical area in the preoperative assessment (same order)
  and offers only the fitting procedures (Μύτη → rhinoplasty; Μαστός → breast list by
  gender; face/body/genital/other findings map to their procedures, e.g. Άνω βλέφαρα →
  upper blepharoplasty, Λιποίδημα → lipoedema liposuction); "+ Όλες" shows the full list.
  Inside an area, the most recently tapped finding (and chosen procedure) shows its
  details first.
- **Incomplete warnings** (decided 11 Oct 2026): the patient card shows a red "Ελλιπή
  στοιχεία: …" badge naming what is missing among surname, first name, date of birth,
  phone and email (contact details checked only for users allowed to see them; tapping
  it opens editing). Medical history never saved by staff or the patient → red
  "Ελλιπές" on the history card and a red dot on the history tab.
- **Eyelid measurements** (decided 11 Oct 2026): when brows or eyelids are examined, a
  block with MRD1, MRD2, LF, MCD (lid crease), TPS (mm, Δ/Α) and a standard eyelid
  diagram (both eyes, brow, crease, lid margins, light reflex) showing the values.
- **Προεγχειρητική εκτίμηση** (decided 11 Oct 2026; was "Επεμβάσεις που συζητήθηκαν" —
  it is my-medical's "Προεγχειρητική εκτίμηση"): areas (Πρόσωπο, Μαστός, Σώμα, Γεννητικά,
  Άλλο) are added like the evaluation areas; an area opens its procedures; ✕ closes it
  and unselects its procedures. **Every implant records its specs**: breast —
  manufacturer (Motiva: Round / Ergonomix / Ergonomix 2, projection Mini / Demi / Full /
  Corsé; Mentor: MemoryGel / Xtra / Boost / MemoryShape, Moderate … Ultra High), size cc,
  diameter and projection (Δ/Α), technique (subglandular, subfascial, dual plane,
  submuscular, PRESERVE, MIA), incision; **reconstruction** — tissue expander (Mentor
  CPX4 / CPX4 with suture tabs / Artoura, volume, width, initial fill, pre- or
  subpectoral), direct-to-implant (implant fields) or autologous (DIEP, LD, TUG, PAP,
  SIEA); facial — maker, material, size; buttock —
  maker, shape, cc, plane. **Lift / reduction**: pattern (crescent, periareolar
  Benelli, vertical Lejour / Hall-Findlay, L/J, Wise / keyhole inverted-T, no vertical
  scar), pedicle, extras (auto-augmentation, mesh, fat). Gynaecomastia / top surgery:
  technique. The choices are written as one line next to the procedure. **Size charts**:
  choosing a size from the official Motiva / Mentor charts fills diameter and projection
  automatically — the charts are loaded only from the manufacturers' official tables
  (never typed from memory); until then size, diameter and projection are typed.
- **Clinical evaluation** (main content): (the "General / patient's request" box was
  dropped — decided 11 Oct 2026)
  one section per area of interest (Breast, Face, Body, Nose, Genital, Other), added
  and removed as needed, several per visit. Each section: reminder chips of what to
  examine (editable in Settings) + free text. AI transcript fills these sections.
- Money per visit: fee, amount collected → patient totals: fees, collected, balance
  (as in my-medical). **Decided 11 Oct 2026:** consultation visits carry a charge,
  follow-ups none (default per visit type; consultation **€100** unless changed);
  entered and collected by the **secretary or
  PA/nurse** only; never shown on the surgeon's screens. In the Spa (set up later) the
  aestheticians may also charge.
- Built (Phase 2): the doctor saves the visit and returns to the patient's visits; the
  surgeon has no close button. The **secretary (or PA/nurse) closes the visit after
  payment** ("Αποθήκευση & κλείσιμο"), which locks the clinical part; they or a surgeon
  can reopen it. Visit type chosen from a dropdown (decided 11 Oct 2026).
  Visits without a default charge (e.g. follow-ups) also stay open until the secretary
  closes them by hand: they may still be charged (e.g. a triamcinolone injection). Procedure catalogue and exam
  areas from the design, in code for now; they move to the Settings lists.
- **Vitals / measurements on every visit:** weight (required prompt), height,
  BMI (auto). Weight shown as a trend chart. (Blood pressure and pulse dropped —
  decided 11 Oct 2026.)
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
- **Estimated duration**: sum of each procedure's default OR time (editable list in
  Settings, e.g. facelift 4h30′, rhinoplasty 3h, blepharoplasty 2h, breast
  augmentation 2h, abdominoplasty 3h30′); can be overridden per surgery.
- Team: anaesthesiologist, anaesthesia type, scrub / recovery nurse (editable lists of
  external collaborators with e-mail).
- Linked: specific consent (§7), surgical brief (§8), photos

### Quote and cost breakdown (decided 11 Oct 2026)
- The surgeon only sets the surgical plan (procedures, implants, hospital, nights).
  The app then **generates the estimated cost automatically** from a price list in
  Settings: surgeon fee per procedure (with combination discount rules), anaesthesia,
  hospital / operating room per hour and per night, implants, garments, extras.
- Financial discussion is done by the **PA or secretary**, never the surgeon. They can
  adjust lines (with reason, logged), then send the quote (branded PDF, patient's
  language) for signature.
- Quote: number, date, validity (e.g. 3 months), lines, total, payment terms,
  deposit and cancellation terms, revision policy, signature (same signing flow as
  consents) → status draft / sent / signed / expired.
- **Deposit:** €500 by default (amount editable per quote, depending on total cost) to
  book the surgery date. Deducted from the surgeon's fee. **Refunded if cancelled ≥ 4
  weeks before surgery; non-refundable if later.** These terms print on every quote;
  the app shows the refund deadline on the surgery record. (Lawyer to confirm wording.)
- Booking a surgery requires a signed quote + deposit, or a logged override.

### Outcomes and complications
- Per surgery: complications (structured list + free text, date, severity, treatment),
  revisions linked to the original surgery, patient satisfaction (e.g. at 3 m and 1 y).
- Used for the surgeon's own audit and as part of the record; never sent to GHL.

### Treatment (repeated, non-surgical) — kept separate from Surgery
- Botox, fillers, lasers, skin treatments; Surgery and Spa both record them
- Date, treatment type, product + lot number, areas, units/ml, performed by, company
- Next-due date (e.g. botox ~3 months) → reminder to patient via GHL and on screen
- Packages/courses: sessions used / remaining
- Own tab "Θεραπείες" in the patient record; not mixed into the surgery timeline

### Receipts (view only in our app, issued through myDATA provider later)
my-medical shows: series, number, created date, description, total amount,
document type (e.g. ΑΠΥ). Imported history kept read-only.

### Drawings / surgical planning (Σχέδιο)
- On the visit screen: "Surgical planning" panel appears automatically only when a
  surgical procedure is selected; templates follow the selected procedures (breast,
  rhinoplasty, face; more later), one tab per relevant template.
- **Body template**: full-body front + back sketch including head/face (submental
  lipo), zones marked; for liposuction, lipoedema, abdominoplasty (full/mini/lipo-),
  thigh, arm, back, buttock lift, BBL, body lift, gynaecomastia lipo, submental lipo.
  Measurements: weight/max, waist/hip, rectus diastasis, pinch, laxity grades,
  estimated lipo volume, hernia/scars.
- **Unified breast worksheet** (sketch + form) for augmentation, lift, aug-mastopexy,
  reduction, reconstruction, revision, top surgery, inverted nipple, tuberous breast,
  deformities. Measurements R/L (SN–N, N–midline, N–IMF relaxed/stretched, base width,
  pinch upper pole/IMF, skin stretch, areola); classification (Regnault, asymmetry,
  tuberous type, nipple inversion grade, Baker, skin quality); conditional groups
  (existing implants for revision; oncological history for reconstruction); plan
  (incision, pocket, implant, resection pattern, pedicle, new NAC position/IMF, free
  nipple graft). Values flow to surgery record, procedure consent and clinic brief.
- Pen input (digitizer/tablet pen): pen, eraser, colours, undo, draw over a photo.
  Saved with the visit and linked to the surgery (shown in surgery-day view).
- Measurement fields per template, right/left (e.g. SN–nipple, nipple–IMF, base width;
  nasal length, tip projection, nasolabial/nasofrontal angles).
- Templates are our own generic outlines; society worksheets only if licence allows.
- Virtual simulation button: from visit photos via an external simulation system
  (Crisalix / Vectra / other) — **decision pending**; results saved to photos.

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
Tabs (from design review), each with a count: Overview · Medical history · Visits ·
Surgeries · Treatments · Photos (total count) · Financial · Documents.
Financial tab: totals (charged / paid / pending + due date), every movement with
payment method, receipt issued via **Epsilon Net** with myDATA ΜΑΡΚ shown; actions
"New charge" and "Collect & issue receipt". (myDATA provider = Epsilon Net.)
Prescriptions link out to ΗΔΙΚΑ; drawings live under Visits/Surgeries.
(my-medical's "Σημειώσεις" tab dropped — never used.)
Also from my-medical: a global To-Do list with reminders (bell with counter).

## 4c. Calendar (designed — see DESIGN.md §6)
my-medical's calendar is NOT the model. Known needs: appointments linked to a patient
record; surgery details (procedures, implants) live in the surgery record, not in
appointment titles; more than one location.

**Data**
- `Appointment`: company, patient, type, start, duration, resource (doctor / nurse /
  room / cabin / operating room), location, status (ONE list for the whole app, see
  below), confirmation channel and time, source (staff user or online via GHL), GHL
  appointment ID.
- **Appointment status — the only list** (Greek label · who presses it):
  booked «Κλείστηκε» (staff / online) → confirmed «Επιβεβαιώθηκε» (patient reply via GHL
  or staff) → arrived «Στην αναμονή» (secretary: Άφιξη) → ready «Έτοιμος · Δωμάτιο X»
  (the person assigned to that room — PA/nurse, or the secretary when no PA; pressing
  it twice does nothing, others see who did it) → with doctor «Με τον γιατρό»
  (surgeon opens the visit) → to pay «Προς πληρωμή» (surgeon closes the visit) → done
  «Ολοκληρώθηκε» (payment recorded, or no charge). Side exits: cancelled «Ακυρώθηκε»,
  no-show «Δεν ήρθε» (feeds the patient flag). Every change is logged with user + time.
- **Online bookings** (GHL / website) create a **pending patient** in our app if no
  match is found → duplicate check → intake link sent automatically.
- `AppointmentType` (editable): name GR/EN, colour, default length, calendar layer
  (office / online / surgery / spa), company. Seed practice: first visit 30′,
  follow-up 15′, pre-op 30′, post-op 15′, online 30′, injectable 30′. Seed spa:
  laser 60′, peel 45′, hydrafacial 60′, mesotherapy 45′, body package 90′.
- `Resource` (editable): practice — surgeon, nurse room, operating room (per
  hospital); spa — cabins / aestheticians. Blocked time (break, congress, holiday) as
  its own entries. Greek public holidays pre-loaded.
- **Practice and Spa are separate calendars** (company switch). Never shown together.

**Views**: day (one column per resource, more detail), week (Mon–Sat, layers on/off,
surgical load bar per day), month (counts per day + surgery load). Click empty slot →
new appointment. Clash warning and suggested free slots when booking.

**Surgery capacity rules** (Settings, defaults):
- Surgery days Mon–Fri. Per day max 3 operations or 7 hours of OR time; 30′ turnover
  between cases.
- A case ≥ 4 h leaves room only for short cases (≤ 2 h); a case ≥ 5 h closes the day.
- "+ Νέο χειρουργείο": choose procedures → estimated time → availability grid for the
  next 3 weeks (fits / only ≤2 h / full / holiday) → pick day → proposed start after
  the existing cases. Booking creates the Surgery (status booked), its checklist (§4e
  readiness), the **post-op appointment plan** (1 d, 1 w, 1 m, 3 m, 6 m, 1 y — editable
  per procedure, linked to the photo timepoints) and, if ticked, the consent link and
  deposit request.
- **Override:** the surgeon, the secretary and the PA may book beyond the limits with a
  reason (e.g. revision, urgent case); logged and shown on the day.
- Anaesthesiologist / hospital availability is not checked by the app: surgeries are
  booked 1–2 months ahead and confirmed through the monthly plan.
- **Safety flags on the surgery checklist**, computed from the verified history:
  anticoagulants/aspirin, GLP-1 weight-loss drugs, isotretinoin (last 12 m), smoking,
  BMI above a set limit, personal/family clot history, diabetes, sleep apnoea. Each flag
  shows the rule (e.g. "stop X days before" — values set by the surgeon in Settings).
  Body-contouring procedures show a **Caprini VTE score**. Flags inform; the surgeon
  decides.

**Schedule e-mails** (protected PDF, every send audited):
- Weekly surgical schedule → external anaesthesiologists and nurses taking part.
  Auto every Thursday 14:00 for the next week (configurable) + "send now".
- Monthly surgical plan → the hospital (e.g. Διαβαλκανικό operating-theatre office).
  Auto on the 20th for the next month + "send now".
- Content limited to: date, time, patient name, age, procedure(s), estimated
  duration, anaesthesia type. Clinical details go only in the per-patient surgical
  brief (§8). Any change after sending → automatic "schedule change" e-mail.

**Waiting list**: patient, wanted type, preferred days/times, since when. On a
cancellation the app lists matching people; "offer via WhatsApp" (GHL) to several,
first "yes" gets the slot, the rest are told automatically.

**Confirmations / reminders** go out through GHL (WhatsApp default, patient's
language); replies update the appointment status. Tomorrow's unconfirmed list on the
secretary home.

## 4d. Reports and other my-medical features (decide which to keep)
my-medical offers: income by visits and by packages, total visits, total surgeries,
referral-source stats, communication stats, birthdays, export to Excel, data backup,
receipt totals, prescription/referral statistics (diagnoses, substances, products),
bulk SMS and email, suppliers list, doctors list, e-consultation.
None of my-medical's statistics work in practice, so nothing is inherited. Our own
reports will be designed later from what the surgeon actually wants to know.
Bulk SMS/email move to GHL. Prescription statistics dropped.

## 4e. Home screen and front-desk workflow (from design review)
- **Role-based home screens.** Physician sees only clinical flow (clock, ready-in-room
  banner, today's patients, chat, own tasks) plus a **"Για έλεγχο σήμερα" (today's
  review) list**: follow-up photos waiting for review, new-patient emails/messages asking
  for an evaluation (photos attached), results to sign off, urgent items (e.g. payment
  issues the staff flagged). Each item opens where it is handled; ticking it off
  clears it. PA/nurse home: room board (waiting /
  room 1 / room 2) with "ready → notify doctor", today's schedule with confirmation,
  form and payment status, to-dos (intake forms, duplicates, patient messages,
  unconfirmed bookings), surgery checklists with send/remind actions, chat with doctor.
- Physician switches via the left menu: "Ιατρείο" (appointments) and "Χειρουργεία"
  (operations); both open on today with ‹ › day navigation. No separate toggle.
  Office view: today's appointments.
  Surgery mode: today's operations only, full width (no chat, tasks or upcoming list);
  "ready in OR" still arrives as a banner. The "Surgeries" menu opens this same view:
  starts on today, ‹ › for previous/next day, "Today" button to jump back.
- Live clock (with seconds) at the top left + next-appointment countdown; amber ≤5 min, red "late X min".
- Patient status flow: see §4c "Appointment status — the only list".
  The assistant marks "ready in room X" from her screen/phone → surgeon gets a banner,
  sound and optional phone push. Same for "ready in operating room" in surgery mode.
- Online video consultations: appointment type "Online"; "Start call" button in today's
  list; link sent to the patient via GHL (WhatsApp/email); call opens beside the visit
  notes (recording consent rules apply). Video service must be self-hosted (e.g. Jitsi)
  or an EU provider with a DPA — **decision pending**.

- Surgery mode card per operation: plan snippet, pre-op photo thumbnails, readiness
  light — green = all done; orange = secondary item missing; red = crucial item missing.
  Default crucial: consent, blood work, pre-op clearance. Secondary: deposit, photos,
  brief sent to clinic. Configurable in Settings (deposit classification TBC).
- Mobile-first: every screen usable on a phone (surgeon between operations). Phone
  layout: bottom bar (Today, Search, Chat, Calendar), cards that expand on tap.
- Internal staff chat on the home screen: live messages between surgeon, assistant and
  front desk, with one-tap preset messages editable in Settings (e.g. "send next
  patient", "running 10 min late", "come to room 1"). Runs on our own server only.

## 5. Finding a patient

- Global search bar on every screen: name, surname, phone, email, AMKA, ID.
- "Patients" menu page: large search (accent/space-insensitive, shows which field
  matched); when empty, shows "Suggested today" (patients with appointments or
  surgeries today) and "Recently opened"; filters: all, practice, spa, flagged,
  surgery within 30 days.
- **"Προτεινόμενοι σήμερα" — contents and order** (decided 11 Oct 2026):
  1. **Surgical patients** of the previous, current and next week: today's first, then
     tomorrow's, then ranked by how many days their surgery is from today (closest
     first; on a tie, the upcoming one before the past one). Phase 4 (surgeries).
  2. **Today's patients from the calendar** (appointments). Phase 6.
  3. **Calls arranged for today** (phone / online). Phase 6.
  4. **Things the doctor must check today** that belong to a patient: emails, photos
     sent for evaluation, follow-up photos, results — the patient-linked items of the
     "Για έλεγχο σήμερα" list (§4e). Phases 5–6.
  Each row says why the patient is suggested (e.g. "Χειρουργείο σήμερα 08:00",
  "Ραντεβού 11:30", "Κλήση 14:00", "Φωτογραφίες για έλεγχο"). Until those phases exist
  the box says it will fill in; "Πρόσφατα ανοιγμένοι" stays below it.
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
  (patient-friendly, conditional detail boxes, current/max weight, height; step 2a =
  medication/allergies/smoking/weight, step 2b = full questionnaire of §4 with
  progress "x / y answered"),
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
- Sent **only** if the surgery is booked for that date, not cancelled or moved, and the
  consent is valid (not withdrawn). Otherwise nothing is sent and the surgeon and PA get
  an alert.

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
  Also sends the WhatsApp check message for the main number (§4) — the number only, no
  clinical data.
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
  - Mapping rules (e.g. my-medical visit types → our clean list) are written once the
    exported data has been seen; nothing messy is copied as-is.
  - my-medical "Αντικειμενικά ευρήματα" of a visit → that visit's "Επιπλέον ευρήματα"
    text (decided 11 Oct 2026).
- Later: myDATA provider API (receipts); e-prescription stays on ΗΔΙΚΑ.

## 11. Users and permissions

Each user has one **level** (what they may do), one **role** (their job) and **company
access** (Surgery, Spa, or both); a user only sees records of the companies they have
access to.

| Level | Can do |
|---|---|
| **Owner** | Everything. Only an Owner can make someone Owner or edit an Owner. **An Owner can never be deleted, deactivated or demoted in the app — not even by another Owner** (only by a deliberate command on the server). |
| **Admin** | Everything a User can, plus: invite users, set levels (up to Admin) and company access, manage devices, settings, backups. |
| **User** | Day-to-day work: full patient records (including clinical notes) in their companies. Secretary and spa staff are Users. |
| **Guest** | Research (e.g. a medical student). **Read-only.** Sees clinical data, patient name, age (not date of birth) and photos. **Never** sees contact details (phones, emails, address) or AMKA/ΑΦΜ. Account has a mandatory **end date**. Every view logged. |

Decided 11 Oct 2026.
**Guest export** (decided Phase 2): a spreadsheet of clinical data **without** names,
contact details, address, AMKA/ΑΦΜ or date of birth (age only); patients appear under a
research code, not their patient number. Every export logged. Free-text notes may still
contain identifying details — the guest's confidentiality agreement (§13) covers this.

### Roles (decided 11 Oct 2026: role is separate from level)
The role decides the home screen (§4e, DESIGN.md), who may verify medical history,
and who appears as treating doctor. It does not add permissions beyond the level.
- **Surgeon**: physician home (Ιατρείο / Χειρουργεία); treating doctor; verifies history;
  signs off operative notes.
- **PA / nurse**: PA/nurse home (room board, checklists, intake review, chat); clinical
  read and write; verifies medical history; not sign-off of operative notes.
- **Secretary**: home = "Υποδοχή" (DESIGN.md 1e): contact details, appointments,
  calendar, check-in, payments and receipts, waiting list, intake review, documents,
  surgery administration (hospital booking, deposit, quotes). Her own screens show no
  clinical notes, but she **may open and read the full patient record** — access to
  everything in her companies (decided Phase 1, confirmed again 11 Oct 2026; the
  "clinical notes" remark meant the old comments field, now removed — §4).
- **Spa staff**: usually Spa company only.
- **Other** (e.g. research guest, IT).
Admin work (users, settings, backups) comes from the level, not the role.

### New users (invitation)
- Only Owner and Admin create users: enter name, email, level, role, company access
  (and end date for Guests). The app emails an **invitation link**.
- The link is single-use, expires after **72 hours**, contains no personal data, and
  can be re-sent (the old link stops working). It opens only over Tailscale, so the
  person must be added to Tailscale first.
- On the setup page the person chooses a password (or clicks "generate a strong
  password") and sets up 2FA.
- Alternatively an Owner/Admin can **generate a password** for a user and hand it over
  in person. Generated passwords are permanent (16 characters, no look-alike letters).
  Passwords are never sent by email.

### Suspending and deleting users
- **Suspend:** the user is logged out everywhere and cannot log in; everything is kept;
  **Reactivate** restores access as it was.
- **Delete:** permanent. A record (name, email, level, companies, when and by whom)
  stays under **Deleted users**, and their audit-log history is kept.
- Owners can be neither suspended nor deleted; nobody can suspend or delete themselves.

### Login and sessions
- Password + 2FA (authenticator app) with one-time recovery codes.
- **Trusted devices:** after a successful 2FA login the user may tick "Trust this
  device". That device skips the 2FA code (password still required) for 90 days.
- **Weekly re-login:** all sessions end every Monday at 05:00 Athens time.
- No automatic logout on inactivity (Phase 1 decision, confirmed 11 Oct 2026).
- **Devices screen (Owner/Admin):** per user, see logged-in devices (browser, IP, last
  activity) and trusted devices; end any session or remove trust. All logged.

## 12. Build phases

1. Foundation — login (with 2FA), user levels & invitations, companies, devices, audit log, backups
2. Patients, visits & vitals, documents, global search
2b. **UI refit** — apply `DESIGN.md` to everything already built (app shell + left
   menu, patients page, patient record, new visit) before starting Phase 3. Screens
   whose features belong to later phases are built when their phase comes, already
   in the new design (see DESIGN.md "Screen → phase").
3. Intake: guest/tablet mode, QR, remote link, first-contact consents
4. Surgeries, procedure consent templates & signing, surgical brief, auto-email
5. Photo browser (Synology folders)
6. Calendar + GHL sync — calendar, surgery capacity & booking, schedule e-mails,
   waiting list, secretary home (1e), physician/PA home screens, WhatsApp check of the
   patient's main number (§10)
7. AI consultation assistant
8. Receipts (myDATA provider), Spa workspace
9. my-medical import — just before the test phase (export request sent then)

## 13. Open decisions

Decided 11 Oct 2026: **our calendar is the master** (GHL bookings flow in; GHL sends
confirmations and reminders); quote auto-generated, money handled by PA/secretary;
deposit €500 default, refundable ≥ 4 weeks before; capacity override by surgeon,
secretary or PA; outcomes/complications record — yes.

- Real locations (offices, hospitals) — "Ιατρείο Αθήνας" in mockups is a placeholder
- Appointment default lengths (30′ / 15′ guessed)
- Who may collect payments and issue receipts (secretary? PA? surgeon only?)
- Maximum surgery days per week (burnout guard)?
- Phone (VoIP) integration — caller's record opens on incoming call (optional, later)
- Is the deposit a crucial (red) or secondary (orange) readiness item?
- Should "medical history verified" be a crucial readiness item for surgery?
  (suggested: yes)
- Patients-page filter "Surgery": surgery within 30 days, or any surgical patient?
- Breast reconstruction consent: one form, or split by sub-type first?
- AI: local vs API provider
- Exact patient fields (my-medical screenshots)
- Photo folder structure on the Synology today
- Legal check: e-signatures for surgical consent; consent wording
- Off-site backup destination (needed by deployment)
- Legal check: Guest (research) access to identifiable data — legal basis (consent or
  ethics approval) and confidentiality agreement for the guest
- Email provider with DPA (for invitations now; briefs and consent links later)
- Medical review of the 21 procedure consent drafts (items marked [ΕΛΕΓΧΟΣ ΙΑΤΡΟΥ])
- Revision-cost policy text (`{{revision_policy}}`), implant warranty/registry
- Whether `neck_lift` becomes its own procedure or stays within `facelift`
