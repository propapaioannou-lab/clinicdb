# Consent forms — DRAFT v0.1 (seed templates)

Status: **PLACEHOLDER — awaiting lawyers' version.** Not legal advice.
Languages: Greek and English. The app shows each form in the patient's
**communication language** (patient record). The Greek text is the reference
version the lawyers approve; English versions are at the end of this file and in
each procedure file, and must be updated whenever the Greek changes.

Procedure-specific consents (21 procedures) live in `consents/procedures/`,
one file per procedure, Greek + English — see `consents/procedures/_FORMAT.md`.

How to read this file (for Claude Code):
- Each form = `type`, `company`, `flow` (where it appears), information text,
  consent items, signature block.
- Each consent item has a `key` (the app stores it and uses it elsewhere),
  and `required` (must be ticked to submit) or `optional`.
- `{{...}}` = placeholders filled automatically by the app.
- `[ΕΚΚΡΕΜΕΙ: ...]` = point the lawyers must complete or confirm.
- Every form ends with the shared signature block (§0).

---

## §0. Shared signature block (all forms)

**Στοιχεία υπογράφοντος**
Ονοματεπώνυμο: {{patient_full_name}} · Ημ/νία γέννησης: {{patient_dob}}
Ημερομηνία & ώρα: {{signed_at}} · Έκδοση εντύπου: {{template_version}}
Υπογραφή: {{signature}}

*Εάν ο/η ασθενής είναι ανήλικος/η (εμφανίζεται αυτόματα):*
Ο/Η κάτωθι υπογράφων/ουσα {{guardian_full_name}}, με την ιδιότητα του/της
{{guardian_relation}} (γονέας / νόμιμος/η κηδεμόνας), δηλώνω ότι ασκώ τη γονική
μέριμνα/επιμέλεια του/της ανηλίκου και υπογράφω για λογαριασμό του/της.
[ΕΚΚΡΕΜΕΙ: απαιτείται υπογραφή και των δύο γονέων για ιατρικές πράξεις μη
αναγκαίες; Επιβεβαίωση από δικηγόρο.]
Υπογραφή γονέα/κηδεμόνα: {{guardian_signature}}

---

## Φόρμα 1 — Ενημέρωση για την επεξεργασία προσωπικών δεδομένων

- type: `privacy_notice` · company: Surgery · flow: first contact (required)

**ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ ΠΡΟΣΩΠΙΚΩΝ ΔΕΔΟΜΕΝΩΝ**

**1. Υπεύθυνος επεξεργασίας.** {{company_legal_name}} (εφεξής «η εταιρεία»),
{{company_address}}, ΑΦΜ {{company_vat}}, e-mail: {{company_privacy_email}}.
[ΕΚΚΡΕΜΕΙ: στοιχεία Υπευθύνου Προστασίας Δεδομένων (DPO), εάν έχει οριστεί.]

**2. Ποια δεδομένα επεξεργαζόμαστε.** Στοιχεία ταυτότητας και επικοινωνίας
(ονοματεπώνυμο, ημερομηνία γέννησης, τηλέφωνα, e-mail, διεύθυνση, ΑΜΚΑ, ΑΦΜ),
δεδομένα υγείας (ιατρικό ιστορικό, εξετάσεις, ιατρικές σημειώσεις, χειρουργικά
στοιχεία), φωτογραφίες (μόνο σύμφωνα με τη χωριστή συγκατάθεσή σας) και οικονομικά
στοιχεία συναλλαγών.

**3. Σκοποί και νομική βάση.**
- Παροχή ιατρικών υπηρεσιών και εκτέλεση της μεταξύ μας σύμβασης (άρθρο 6 παρ. 1
  στ. β' ΓΚΠΔ).
- Ιατρική διάγνωση και θεραπεία υπό την ευθύνη επαγγελματία υγείας που δεσμεύεται
  από το ιατρικό απόρρητο (άρθρο 9 παρ. 2 στ. η' και παρ. 3 ΓΚΠΔ).
- Τήρηση νομικών υποχρεώσεων, όπως η τήρηση ιατρικού αρχείου και η φορολογική
  νομοθεσία (άρθρο 6 παρ. 1 στ. γ' ΓΚΠΔ).
- Επικοινωνία για ραντεβού, υπενθυμίσεις και ενημερώσεις σχετικά με τη θεραπεία
  σας (άρθρο 6 παρ. 1 στ. β' ΓΚΠΔ). Η προωθητική επικοινωνία γίνεται μόνο με τη
  χωριστή συγκατάθεσή σας.

**4. Πού φυλάσσονται τα δεδομένα σας.** Ο ιατρικός σας φάκελος τηρείται σε
ιδιόκτητο, κρυπτογραφημένο διακομιστή της εταιρείας, εντός Ελλάδας. Τα
αντίγραφα ασφαλείας τηρούνται κρυπτογραφημένα [ΕΚΚΡΕΜΕΙ: πάροχος και χώρα
αποθήκευσης αντιγράφων ασφαλείας, π.χ. εντός ΕΕ].

**5. Αποδέκτες.** Τα δεδομένα σας είναι προσβάσιμα μόνο από εξουσιοδοτημένο
προσωπικό της εταιρείας. Κατά περίπτωση διαβιβάζονται σε:
- Συνεργαζόμενες κλινικές, νοσοκομεία, αναισθησιολόγους και διαγνωστικά
  εργαστήρια, όταν απαιτείται για τη θεραπεία σας.
- Πάροχο ηλεκτρονικής τιμολόγησης και λογιστή, για φορολογικούς σκοπούς.
- Εκτελούντες την επεξεργασία, με σύμβαση επεξεργασίας δεδομένων:
  - **GoHighLevel (ΗΠΑ)** — διαχείριση ραντεβού και επικοινωνίας. Λαμβάνει μόνο
    στοιχεία επικοινωνίας και ραντεβού, **ποτέ** ιατρικά δεδομένα.
    [ΕΚΚΡΕΜΕΙ: νομική βάση διαβίβασης εκτός ΕΕ — Πλαίσιο Προστασίας Δεδομένων
    ΕΕ-ΗΠΑ ή Τυποποιημένες Συμβατικές Ρήτρες.]
  - **Cloudflare** — ασφαλής μετάδοση των ηλεκτρονικών φορμών (π.χ. όταν
    συμπληρώνετε τη φόρμα από το κινητό σας). [ΕΚΚΡΕΜΕΙ: όπως ανωτέρω.]
  - **Πάροχος ηλεκτρονικού ταχυδρομείου** {{email_provider}} — αποστολή
    εγγράφων και ενημερώσεων.
  - **Πάροχος τεχνητής νοημοσύνης** {{ai_provider}} — μόνο εφόσον δώσετε τη χωριστή
    συγκατάθεση για ηχογράφηση της συνεδρίας (Φόρμα 4).
- Δημόσιες αρχές, όταν το επιβάλλει ο νόμος.

**6. Χρόνος τήρησης.** Ο ιατρικός φάκελος τηρείται για 10 έτη από την τελευταία
επίσκεψή σας (άρθρο 14 παρ. 4 ν. 3418/2005, Κώδικας Ιατρικής Δεοντολογίας).
Φορολογικά στοιχεία τηρούνται για όσο ορίζει η φορολογική νομοθεσία.

**7. Τα δικαιώματά σας.** Έχετε δικαίωμα ενημέρωσης, πρόσβασης, διόρθωσης,
διαγραφής (με την επιφύλαξη της υποχρεωτικής τήρησης ιατρικού αρχείου),
περιορισμού, φορητότητας και εναντίωσης (άρθρα 12–22 ΓΚΠΔ), καθώς και δικαίωμα
ανάκλησης οποιασδήποτε συγκατάθεσης ανά πάσα στιγμή, χωρίς να θίγεται η νομιμότητα
της επεξεργασίας πριν από την ανάκληση. Αιτήματα: {{company_privacy_email}}.
Απαντούμε εντός ενός μηνός, δωρεάν.
Έχετε επίσης δικαίωμα καταγγελίας στην Αρχή Προστασίας Δεδομένων Προσωπικού
Χαρακτήρα (www.dpa.gr).

Περισσότερα: {{company_privacy_policy_url}}

**Δήλωση**
- [ ] `privacy_notice_ack` · required — Δηλώνω ότι έλαβα γνώση της παραπάνω
  ενημέρωσης για την επεξεργασία των προσωπικών μου δεδομένων.

---

## Φόρμα 2 — Συγκατάθεση για λήψη, τήρηση και χρήση φωτογραφιών

- type: `photo_consent` · company: Surgery · flow: first contact (required to show;
  items optional)

**ΣΥΓΚΑΤΑΘΕΣΗ ΓΙΑ ΤΗ ΛΗΨΗ, ΤΗΡΗΣΗ ΚΑΙ ΧΡΗΣΗ ΦΩΤΟΓΡΑΦΙΩΝ**

Η εταιρεία λαμβάνει συγκριτικές φωτογραφίες πριν και μετά από επέμβαση ή θεραπεία.
Οι φωτογραφίες αποτελούν μέρος του ιατρικού σας φακέλου και τηρούνται στον ιδιόκτητο
διακομιστή της εταιρείας. Οποιαδήποτε άλλη χρήση γίνεται μόνο εάν τη συναινέσετε
χωριστά παρακάτω. Κάθε επιλογή είναι ανεξάρτητη· μπορείτε να επιλέξετε όσες
επιθυμείτε ή καμία από τις προαιρετικές.

Οι φωτογραφίες για το ιατρικό αρχείο τηρούνται για 10 έτη από την τελευταία σας
επίσκεψη. Φωτογραφίες που έχουν δημοσιευθεί παραμένουν δημοσιευμένες έως ότου
ανακαλέσετε τη συγκατάθεσή σας. Μετά την ανάκληση, η εταιρεία αφαιρεί τις
φωτογραφίες από τα δικά της μέσα και καταβάλλει κάθε εύλογη προσπάθεια να μην
χρησιμοποιηθούν περαιτέρω· δεν μπορεί όμως να ελέγξει αντίγραφα που ενδέχεται να
έχουν ήδη δημιουργήσει τρίτοι. Η χρήση είναι δωρεάν· δεν οφείλεται αμοιβή.

**Δηλώσεις** — Συναινώ ρητά:
- [ ] `photo_record` · required — Στη λήψη φωτογραφιών και την τήρησή τους στον
  ιατρικό μου φάκελο, για την τεκμηρίωση και παρακολούθηση της θεραπείας μου.
  [ΕΚΚΡΕΜΕΙ: required ή optional; Χωρίς φωτογραφίες ο ιατρός ενδέχεται να μην
  μπορεί να αναλάβει την επέμβαση.]
- [ ] `photo_education` · optional — Στη χρήση των φωτογραφιών μου, χωρίς στοιχεία
  που με ταυτοποιούν, για επιστημονικούς και εκπαιδευτικούς σκοπούς (ιατρικά
  συνέδρια, επιστημονικές δημοσιεύσεις, εκπαίδευση ιατρών).
- [ ] `photo_publish_noface` · optional — Στη δημοσίευση των φωτογραφιών μου στην
  ιστοσελίδα και τα μέσα κοινωνικής δικτύωσης της εταιρείας, **χωρίς** το πρόσωπό
  μου ή άλλα χαρακτηριστικά που με ταυτοποιούν (π.χ. τατουάζ).
- [ ] `photo_publish_face` · optional — Στη δημοσίευση των φωτογραφιών μου στην
  ιστοσελίδα και τα μέσα κοινωνικής δικτύωσης της εταιρείας, **με** ορατό το πρόσωπό
  μου.

---

## Φόρμα 3 — Συγκατάθεση για επικοινωνία και ενημερωτικό υλικό

- type: `marketing_consent` · company: Surgery · flow: first contact (items optional)

**ΣΥΓΚΑΤΑΘΕΣΗ ΓΙΑ ΕΠΙΚΟΙΝΩΝΙΑ ΚΑΙ ΕΝΗΜΕΡΩΤΙΚΟ ΥΛΙΚΟ**

Μηνύματα που αφορούν τη θεραπεία σας (επιβεβαιώσεις και υπενθυμίσεις ραντεβού,
οδηγίες πριν και μετά από επέμβαση, αποστολή εγγράφων) αποστέλλονται στο πλαίσιο
της παροχής των υπηρεσιών μας και δεν απαιτούν τη συγκατάθεσή σας.

Επιπλέον, θα θέλαμε να σας στέλνουμε ενημερωτικό και προωθητικό υλικό (νέες
θεραπείες, προσφορές, εκδηλώσεις, άρθρα). Επιλέξτε τα κανάλια που επιθυμείτε.
Μπορείτε να διακόψετε τη λήψη οποτεδήποτε, με το σύνδεσμο διαγραφής σε κάθε μήνυμα
ή επικοινωνώντας μαζί μας. Η αποστολή γίνεται μέσω της πλατφόρμας GoHighLevel,
χωρίς χρήση ιατρικών δεδομένων.

**Δηλώσεις** — Επιθυμώ να λαμβάνω ενημερωτικό και προωθητικό υλικό μέσω:
- [ ] `marketing_email` · optional — E-mail
- [ ] `marketing_sms` · optional — SMS
- [ ] `marketing_whatsapp` · optional — WhatsApp / Viber

---

## Φόρμα 4 — Συγκατάθεση για ηχογράφηση της ιατρικής συνεδρίας και επεξεργασία με τεχνητή νοημοσύνη

- type: `recording_consent` · company: Surgery · flow: first contact (optional);
  also shown before a recorded consultation if missing

**ΣΥΓΚΑΤΑΘΕΣΗ ΓΙΑ ΗΧΟΓΡΑΦΗΣΗ ΤΗΣ ΙΑΤΡΙΚΗΣ ΣΥΝΕΔΡΙΑΣ**

Για την καλύτερη και πληρέστερη τεκμηρίωση της ιατρικής σας συνεδρίας, ο ιατρός
μπορεί να ηχογραφήσει τη συζήτησή σας. Η ηχογράφηση μετατρέπεται σε γραπτό κείμενο
και επεξεργάζεται με λογισμικό τεχνητής νοημοσύνης, το οποίο:
- βοηθά στη σύνταξη των ιατρικών σημειώσεων·
- ελέγχει ότι καλύφθηκαν όλα τα σημαντικά θέματα (ιατρικό ιστορικό, εναλλακτικές
  επιλογές, κίνδυνοι και επιπλοκές, ανάρρωση).

Όλα τα αποτελέσματα ελέγχονται από τον ιατρό· το λογισμικό δεν λαμβάνει αποφάσεις
για τη θεραπεία σας.

- Η επεξεργασία γίνεται [ΕΚΚΡΕΜΕΙ: είτε τοπικά στον διακομιστή της εταιρείας, είτε
  από τον πάροχο {{ai_provider}} με σύμβαση επεξεργασίας δεδομένων, χωρίς διατήρηση
  των δεδομένων από τον πάροχο και χωρίς χρήση τους για εκπαίδευση μοντέλων].
- Το ηχητικό αρχείο διαγράφεται εντός {{audio_retention_days}} ημερών
  [ΕΚΚΡΕΜΕΙ: διάρκεια]. Το γραπτό κείμενο και οι σημειώσεις τηρούνται στον ιατρικό
  σας φάκελο, όπως όλα τα ιατρικά δεδομένα.
- Η συγκατάθεση είναι εντελώς προαιρετική. Αν δεν τη δώσετε, η συνεδρία γίνεται
  κανονικά χωρίς ηχογράφηση. Μπορείτε να ζητήσετε τη διακοπή της ηχογράφησης
  οποιαδήποτε στιγμή.

**Δήλωση**
- [ ] `recording_ai` · optional — Συναινώ στην ηχογράφηση των ιατρικών μου
  συνεδριών και στην επεξεργασία τους με τεχνητή νοημοσύνη, όπως περιγράφεται.

---

## Φόρμα 5 — Συγκατάθεση για κοινή χρήση δεδομένων μεταξύ ιατρείου και spa

- type: `cross_company_consent` · company: Surgery **and** Spa · flow: first contact
  (optional) — shown on both forms

**ΣΥΓΚΑΤΑΘΕΣΗ ΓΙΑ ΚΟΙΝΗ ΧΡΗΣΗ ΔΕΔΟΜΕΝΩΝ**

Το ιατρείο πλαστικής χειρουργικής {{surgery_legal_name}} και το ιατρικό spa
{{spa_legal_name}} συνεργάζονται. [ΕΚΚΡΕΜΕΙ: διατύπωση όσο είναι ακόμη η ίδια
νομική οντότητα, και μετά τον διαχωρισμό — τότε κάθε εταιρεία είναι χωριστός
υπεύθυνος επεξεργασίας.]

Εάν το επιθυμείτε, οι δύο επιχειρήσεις μπορούν να μοιράζονται τα στοιχεία σας,
ώστε να μη χρειάζεται να τα δίνετε ξανά και ώστε ο θεράπων ιατρός και οι θεραπευτές
να γνωρίζουν σχετικές θεραπείες σας (π.χ. πρόσφατη επέμβαση πριν από θεραπεία
προσώπου ή σώματος). Η κοινή χρήση αφορά μόνο όσα είναι σχετικά με την εξυπηρέτησή
σας, καταγράφεται και μπορείτε να την ανακαλέσετε οποτεδήποτε.

**Δηλώσεις** — Συναινώ να μοιράζονται το ιατρείο και το spa:
- [ ] `share_contact` · optional — Τα στοιχεία ταυτότητας και επικοινωνίας μου.
- [ ] `share_medical` · optional — Το ιατρικό μου ιστορικό και τις θεραπείες μου,
  στο βαθμό που είναι σχετικά με την ασφαλή παροχή υπηρεσιών.

---

## Φόρμα 6 — Ειδική συγκατάθεση για χειρουργική επέμβαση (ΔΟΜΗ ΠΡΟΤΥΠΟΥ)

- type: `procedure_consent` · company: Surgery · flow: when a surgery is **booked**
  (required before surgery) · one template **per procedure**. Below is the shared
  frame (header + standard declarations + signatures). Sections 1–8 come from
  `consents/procedures/NN-<procedure>.md`, general risks from
  `consents/procedures/00-general-risks.md`; assembly order in `_FORMAT.md`.
  `{{...}}` fields come from the surgery record.

**ΣΥΓΚΑΤΑΘΕΣΗ ΜΕΤΑ ΑΠΟ ΕΝΗΜΕΡΩΣΗ ΓΙΑ ΧΕΙΡΟΥΡΓΙΚΗ ΕΠΕΜΒΑΣΗ**

Ασθενής: {{patient_full_name}} · Ημ/νία γέννησης: {{patient_dob}}
Επέμβαση: {{procedure_names}} · Προγραμματισμένη ημ/νία: {{surgery_date}}
Κλινική: {{hospital}} · Χειρουργός: {{surgeon}} · Αναισθησία: {{anaesthesia_type}}
Εμφυτεύματα (αν υπάρχουν): {{implants_summary}}

1. **Περιγραφή της επέμβασης** — [κείμενο ανά επέμβαση]
2. **Αναμενόμενο αποτέλεσμα και όρια** — [κείμενο ανά επέμβαση]
3. **Εναλλακτικές επιλογές** (συμπεριλαμβανομένης της μη επέμβασης) — [κείμενο]
4. **Συχνοί κίνδυνοι και επιπλοκές** — [κείμενο]
5. **Σπάνιοι αλλά σοβαροί κίνδυνοι** — [κείμενο]
6. **Αναισθησία** — [κείμενο ή παραπομπή στη συγκατάθεση του αναισθησιολόγου]
7. **Ανάρρωση και μετεγχειρητική φροντίδα** — [κείμενο]
8. **Πιθανότητα διορθωτικής επέμβασης και κόστος** — [κείμενο]
9. **Ειδικοί κίνδυνοι για εμένα** (από τον ιατρό, ανά ασθενή): {{patient_specific_notes}}

**Δηλώσεις**
- [ ] `proc_informed` · required — Ενημερώθηκα προφορικά και γραπτώς από τον ιατρό
  για την επέμβαση, τις εναλλακτικές επιλογές, τους κινδύνους και την ανάρρωση.
- [ ] `proc_questions` · required — Είχα επαρκή χρόνο να σκεφτώ και να υποβάλω
  ερωτήσεις, οι οποίες απαντήθηκαν ικανοποιητικά.
- [ ] `proc_history_true` · required — Δήλωσα με ειλικρίνεια το ιατρικό μου
  ιστορικό, τα φάρμακα που λαμβάνω και τις αλλεργίες μου.
- [ ] `proc_no_guarantee` · required — Κατανοώ ότι δεν μπορεί να εγγυηθεί
  συγκεκριμένο αισθητικό αποτέλεσμα.
- [ ] `proc_extension` · required — Συναινώ σε επέκταση ή τροποποίηση της επέμβασης
  μόνο εάν κατά τη διάρκειά της κριθεί ιατρικά αναγκαίο για την υγεία μου.
- [ ] `proc_consent` · required — Συναινώ ελεύθερα στη διενέργεια της παραπάνω
  επέμβασης.

[ΕΚΚΡΕΜΕΙ: ελάχιστο διάστημα σκέψης μεταξύ ενημέρωσης και επέμβασης για αισθητικές
επεμβάσεις· υπογραφή μάρτυρα/ιατρού· αποδεκτή μορφή ηλεκτρονικής υπογραφής.]

Υπογραφή ιατρού: {{surgeon_signature}}

---

## Spa versions
Forms 1–5 are duplicated for the Spa under {{spa_legal_name}}, with spa wording
(e.g. "θεραπεία" instead of "επέμβαση") — drafted once the spa's entity and its
spa-specific intake questions are defined.

---
---

# ENGLISH VERSIONS (Forms 0–6)

Same keys, placeholders and pending points as the Greek; the Greek text is the
reference version.

## §0. Shared signature block

**Signatory details**
Full name: {{patient_full_name}} · Date of birth: {{patient_dob}}
Date & time: {{signed_at}} · Form version: {{template_version}}
Signature: {{signature}}

*If the patient is a minor (shown automatically):*
I, the undersigned {{guardian_full_name}}, acting as {{guardian_relation}}
(parent / legal guardian), declare that I hold parental responsibility/custody of
the minor and sign on their behalf.
[ΕΚΚΡΕΜΕΙ: are both parents' signatures required for non-essential medical
procedures? To be confirmed by the lawyer.]
Signature of parent/guardian: {{guardian_signature}}

---

## Form 1 — Information on the processing of personal data
- type: `privacy_notice` · company: Surgery · flow: first contact (required)

**INFORMATION ON THE PROCESSING OF PERSONAL DATA**

**1. Data controller.** {{company_legal_name}} ("the company"), {{company_address}},
VAT no. {{company_vat}}, e-mail: {{company_privacy_email}}.
[ΕΚΚΡΕΜΕΙ: Data Protection Officer details, if appointed.]

**2. What data we process.** Identity and contact details (name, date of birth,
phones, e-mail, address, AMKA social-security number, tax number), health data
(medical history, tests, medical notes, surgical details), photographs (only in line
with your separate consent) and financial transaction data.

**3. Purposes and legal basis.**
- Providing medical services and performing our contract with you (Art. 6(1)(b) GDPR).
- Medical diagnosis and treatment under the responsibility of a health professional
  bound by medical confidentiality (Art. 9(2)(h) and 9(3) GDPR).
- Compliance with legal obligations, such as keeping medical records and tax law
  (Art. 6(1)(c) GDPR).
- Communication about appointments, reminders and updates about your treatment
  (Art. 6(1)(b) GDPR). Promotional communication only with your separate consent.

**4. Where your data is kept.** Your medical file is kept on the company's own
encrypted server in Greece. Backups are kept encrypted [ΕΚΚΡΕΜΕΙ: backup provider
and country of storage, e.g. within the EU].

**5. Recipients.** Only authorised company staff can access your data. Where needed,
it is shared with:
- Partner clinics, hospitals, anaesthesiologists and diagnostic laboratories, when
  required for your treatment.
- Our e-invoicing provider and accountant, for tax purposes.
- Processors acting on our behalf under a data processing agreement:
  - **GoHighLevel (USA)** — appointment and communication management. It receives
    contact and appointment details only, **never** medical data.
    [ΕΚΚΡΕΜΕΙ: legal basis for transfer outside the EU — EU-US Data Privacy
    Framework or Standard Contractual Clauses.]
  - **Cloudflare** — secure transmission of online forms (e.g. when you fill in a form
    on your phone). [ΕΚΚΡΕΜΕΙ: as above.]
  - **E-mail provider** {{email_provider}} — sending documents and updates.
  - **AI provider** {{ai_provider}} — only if you give the separate consent to
    recording of the consultation (Form 4).
- Public authorities, where required by law.

**6. Retention.** Your medical file is kept for 10 years from your last visit
(Art. 14(4) Law 3418/2005, Code of Medical Ethics). Tax records are kept as long as
tax law requires.

**7. Your rights.** You have the right to information, access, rectification,
erasure (subject to the mandatory retention of medical records), restriction,
portability and objection (Arts. 12–22 GDPR), and the right to withdraw any consent at
any time, without affecting the lawfulness of processing before withdrawal.
Requests: {{company_privacy_email}}. We reply within one month, free of charge.
You also have the right to lodge a complaint with the Hellenic Data Protection
Authority (www.dpa.gr).

More information: {{company_privacy_policy_url}}

**Declaration**
- [ ] `privacy_notice_ack` · required — I confirm that I have read the above
  information on the processing of my personal data.

---

## Form 2 — Consent to taking, keeping and using photographs
- type: `photo_consent` · company: Surgery · flow: first contact

**CONSENT TO TAKING, KEEPING AND USING PHOTOGRAPHS**

The company takes comparative photographs before and after surgery or treatment. The
photographs form part of your medical file and are kept on the company's own server.
Any other use happens only if you consent to it separately below. Each option is
independent; you may choose any or none of the optional ones.

Photographs for the medical record are kept for 10 years from your last visit.
Published photographs remain published until you withdraw your consent. After
withdrawal, the company removes them from its own channels and makes every reasonable
effort to prevent further use, but cannot control copies third parties may already
have made. Use is free of charge; no fee is payable.

**Declarations** — I expressly consent:
- [ ] `photo_record` · required — To photographs being taken and kept in my medical
  file, to document and monitor my treatment.
  [ΕΚΚΡΕΜΕΙ: required or optional? Without photographs the surgeon may be unable to
  perform the procedure.]
- [ ] `photo_education` · optional — To the use of my photographs, without anything
  that identifies me, for scientific and educational purposes (medical congresses,
  scientific publications, training of doctors).
- [ ] `photo_publish_noface` · optional — To the publication of my photographs on the
  company's website and social media **without** my face or other identifying
  features (e.g. tattoos).
- [ ] `photo_publish_face` · optional — To the publication of my photographs on the
  company's website and social media **with** my face visible.

---

## Form 3 — Consent to communication and promotional material
- type: `marketing_consent` · company: Surgery · flow: first contact (items optional)

**CONSENT TO COMMUNICATION AND PROMOTIONAL MATERIAL**

Messages about your treatment (appointment confirmations and reminders, pre- and
post-operative instructions, documents) are sent as part of our services and do not
require your consent.

We would also like to send you information and promotional material (new treatments,
offers, events, articles). Choose the channels you prefer. You can stop at any time
using the unsubscribe link in each message or by contacting us. Messages are sent via
the GoHighLevel platform, without using medical data.

**Declarations** — I would like to receive information and promotional material by:
- [ ] `marketing_email` · optional — E-mail
- [ ] `marketing_sms` · optional — SMS
- [ ] `marketing_whatsapp` · optional — WhatsApp / Viber

---

## Form 4 — Consent to recording of the medical consultation and AI processing
- type: `recording_consent` · company: Surgery · flow: first contact (optional);
  also shown before a recorded consultation if missing

**CONSENT TO RECORDING OF THE MEDICAL CONSULTATION**

To document your consultation better and more completely, the surgeon may record your
conversation. The recording is converted to text and processed with artificial
intelligence software, which:
- helps write the medical notes;
- checks that all important topics were covered (medical history, alternatives, risks
  and complications, recovery).

All results are checked by the surgeon; the software does not make decisions about
your treatment.

- Processing takes place [ΕΚΚΡΕΜΕΙ: either locally on the company's server, or by the
  provider {{ai_provider}} under a data processing agreement, with no data retention
  by the provider and no use for training models].
- The audio file is deleted within {{audio_retention_days}} days [ΕΚΚΡΕΜΕΙ: period].
  The transcript and notes are kept in your medical file like all medical data.
- This consent is entirely optional. If you do not give it, the consultation takes
  place normally without recording. You may ask for recording to stop at any time.

**Declaration**
- [ ] `recording_ai` · optional — I consent to my medical consultations being recorded
  and processed with artificial intelligence as described.

---

## Form 5 — Consent to sharing data between the practice and the spa
- type: `cross_company_consent` · company: Surgery **and** Spa · flow: first contact
  (optional)

**CONSENT TO DATA SHARING**

The plastic surgery practice {{surgery_legal_name}} and the medical spa
{{spa_legal_name}} work together. [ΕΚΚΡΕΜΕΙ: wording while still one legal entity,
and after separation — each company then is a separate data controller.]

If you wish, the two businesses can share your details, so you do not have to provide
them again and so the treating doctor and therapists know about relevant treatments
(e.g. recent surgery before a face or body treatment). Sharing covers only what is
relevant to your care, is logged, and can be withdrawn at any time.

**Declarations** — I consent to the practice and the spa sharing:
- [ ] `share_contact` · optional — My identity and contact details.
- [ ] `share_medical` · optional — My medical history and treatments, to the extent
  relevant to providing services safely.

---

## Form 6 — Informed consent for surgery (frame)
- type: `procedure_consent` — sections 1–8 from `consents/procedures/`.

**INFORMED CONSENT FOR SURGERY**

Patient: {{patient_full_name}} · Date of birth: {{patient_dob}}
Procedure(s): {{procedure_names}} · Planned date: {{surgery_date}}
Clinic: {{hospital}} · Surgeon: {{surgeon}} · Anaesthesia: {{anaesthesia_type}}
Implants (if any): {{implants_summary}}

[Sections 1–8 for each procedure · general risks · 9. Risks specific to me:
{{patient_specific_notes}}]

**Declarations**
- [ ] `proc_informed` · required — I have been informed verbally and in writing by the
  surgeon about the procedure, the alternatives, the risks and the recovery.
- [ ] `proc_questions` · required — I have had enough time to think and to ask
  questions, which were answered to my satisfaction.
- [ ] `proc_history_true` · required — I have truthfully declared my medical history,
  the medicines I take and my allergies.
- [ ] `proc_no_guarantee` · required — I understand that no specific aesthetic result
  can be guaranteed.
- [ ] `proc_extension` · required — I consent to the procedure being extended or
  modified only if, during surgery, this is judged medically necessary for my health.
- [ ] `proc_consent` · required — I freely consent to the above procedure being
  performed.

[ΕΚΚΡΕΜΕΙ: minimum reflection period between information and surgery for aesthetic
procedures; witness/surgeon signature; acceptable form of electronic signature.]

Surgeon's signature: {{surgeon_signature}}
