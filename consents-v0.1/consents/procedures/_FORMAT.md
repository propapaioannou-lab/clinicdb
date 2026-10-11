# Procedure consent files — format

Status of all files in this folder: **DRAFT — medical content to be reviewed by the
surgeon, legal wording to be approved by the lawyers.** Not legal or medical advice.

## How a procedure consent is assembled by the app

When a surgery is booked, the app builds ONE document per surgery, in the patient's
**communication language** (Greek or English, from the patient record):

1. Header (patient, procedure(s), date, clinic, surgeon, anaesthesia, implants)
   — from `CONSENTS.md` Form 6.
2. For **each** procedure in the surgery: sections 1–8 from its file here.
   (Combined surgeries, e.g. abdominoplasty + liposuction, include both.)
3. `00-general-risks.md` — risks common to all surgery, included once.
4. Section 9 "Risks specific to me" — written by the surgeon per patient.
5. Procedure-specific declarations from each procedure file (de-duplicated).
6. Standard declarations — `CONSENTS.md` Form 6.
7. Signature block (patient, guardian if minor, surgeon).

## File layout (every procedure file follows this exactly)

```
# NN — <English name> / <Greek name>
- key: <procedure_key>            ← links to the surgery type list in the app
- version: 0.1-draft
- related: <other keys often combined>
- notes for surgeon: <what to check>

## ΕΛΛΗΝΙΚΑ
### 1. Περιγραφή της επέμβασης
### 2. Αναμενόμενο αποτέλεσμα και όρια
### 3. Εναλλακτικές επιλογές
### 4. Συχνοί κίνδυνοι και παρενέργειες
### 5. Σπάνιοι αλλά σοβαροί κίνδυνοι
### 6. Αναισθησία
### 7. Ανάρρωση και μετεγχειρητική φροντίδα
### 8. Διορθωτική επέμβαση και κόστος
### Ειδικές δηλώσεις
- [ ] `<item_key>` · required|optional — <wording>

## ENGLISH
### 1. Description of the procedure
### 2. Expected result and limitations
### 3. Alternatives
### 4. Common risks and side effects
### 5. Rare but serious risks
### 6. Anaesthesia
### 7. Recovery and aftercare
### 8. Revision surgery and costs
### Specific declarations
- [ ] `<item_key>` · required|optional — <wording>

## Consultation checklist (for the AI assistant, SPEC §9)
- <topic the surgeon should have covered in the consultation>
```

## Writing rules
- Plain language a patient understands; medical term in brackets once if useful.
- Section 4 lists only what is specific to the procedure; generic risks
  (bleeding, infection, DVT, scars in general…) live in `00-general-risks.md`.
- No invented statistics. Use words ("common", "uncommon", "rare") unless a figure
  is well established; any figure is marked **[ΕΛΕΓΧΟΣ ΙΑΤΡΟΥ]**.
- **[ΕΛΕΓΧΟΣ ΙΑΤΡΟΥ]** = surgeon must confirm or adapt (technique, timings,
  his own practice). **[ΕΚΚΡΕΜΕΙ]** = for the lawyers.
- Greek and English must say the same thing; the item keys are identical.
- Timings in section 7 are typical ranges, always "as instructed by your surgeon".
