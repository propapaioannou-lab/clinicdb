// Quick-pick choices in the medical history (labels in the translation files).
// Chosen from what is most common: EU surgical statistics (Eurostat: caesarean,
// appendectomy, cholecystectomy, hernia repair among the most frequent) and the drug
// allergies most often recorded in large health-record studies (penicillins,
// sulfonamides, opiates, NSAIDs).

export const MEDICATION_CHOICES = [
  "anticoagulants", "antiplatelets", "thyroxine", "contraceptive", "hrt", "sleeping", "anxiolytics",
  "antidepressants", "antihypertensives", "antidiabetic", "glp1", "corticosteroids", "immunosuppressants",
  "statins", "supplements",
] as const;

export const ALLERGY_CHOICES = [
  "penicillin", "amoxiclav", "cephalosporins", "sulfonamides", "macrolides", "quinolones", "nsaids",
  "aspirin", "metamizole", "opioids", "localAnaesthetics", "chlorhexidine", "iodine", "foods",
] as const;

// Previous surgeries: a pick adds a row with the procedure's name, ready for year and
// complications.
export const SURGERY_CHOICES = [
  "caesarean", "appendectomy", "cholecystectomy", "hernia", "hysterectomy", "tonsillectomy", "thyroidectomy",
  "bariatric", "breast", "orthopaedic", "varicose", "rhinoplasty", "bodyContouring", "cataract",
] as const;

export type MedicationChoice = (typeof MEDICATION_CHOICES)[number];
export type AllergyChoice = (typeof ALLERGY_CHOICES)[number];
