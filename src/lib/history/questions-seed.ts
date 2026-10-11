// Starting questionnaire (SPEC §4, design/IntakeHistory.dc.html). Editable later in
// Settings; the seed only adds questions that are missing, never overwrites edits.
// [key, section, Greek label, Greek detail prompt, Greek hint, English label, English detail prompt, flags]
type Q = [string, string, string, string, string, string, string, { sensitive?: boolean; infection?: boolean }?];

export const HISTORY_QUESTIONS: Q[] = [
  ["hyper", "heart", "Υπέρταση", "Φάρμακα και τιμές", "π.χ. Amlodipine 5 mg", "High blood pressure", "Medication and readings"],
  ["heart", "heart", "Καρδιοπάθεια, αρρυθμία, βαλβίδες, βηματοδότης", "Ποια;", "", "Heart disease, arrhythmia, valves, pacemaker", "Which?"],
  ["clot", "heart", "Θρόμβωση ή πνευμονική εμβολή (εσείς ή συγγενείς)", "Πότε και ποιος;", "", "Thrombosis or pulmonary embolism (you or relatives)", "When and who?"],
  ["varic", "heart", "Κιρσοί", "Πού;", "", "Varicose veins", "Where?"],
  ["asthma", "lungs", "Άσθμα ή χρόνια βρογχίτιδα (ΧΑΠ)", "Φάρμακα;", "", "Asthma or chronic bronchitis (COPD)", "Medication?"],
  ["apnea", "lungs", "Άπνοια ύπνου / ροχαλητό", "Χρησιμοποιείτε CPAP;", "", "Sleep apnoea / snoring", "Do you use CPAP?"],
  ["bleed", "blood", "Εύκολοι μώλωπες ή παρατεταμένη αιμορραγία", "Περιγράψτε", "", "Easy bruising or prolonged bleeding", "Describe"],
  ["anticoag", "blood", "Αντιπηκτικά ή ασπιρίνη", "Ποιο και δόση", "", "Anticoagulants or aspirin", "Which and dose"],
  ["anemia", "blood", "Αναιμία ή μεσογειακή αναιμία (στίγμα)", "Ποια;", "", "Anaemia or thalassaemia (trait)", "Which?"],
  ["genetic", "blood", "Κληρονομική πάθηση (π.χ. έλλειψη G6PD)", "Ποια;", "", "Inherited condition (e.g. G6PD deficiency)", "Which?"],
  ["gi", "gi", "Γαστρίτιδα, έλκος, παλινδρόμηση", "Περιγράψτε", "", "Gastritis, ulcer, reflux", "Describe"],
  ["liver", "gi", "Παθήσεις ήπατος", "Ποια;", "", "Liver disease", "Which?"],
  ["kidney", "gi", "Παθήσεις νεφρών", "Ποια;", "", "Kidney disease", "Which?"],
  ["neuro", "neuro", "Επιληψία, εγκεφαλικό, ημικρανίες", "Ποια;", "", "Epilepsy, stroke, migraines", "Which?"],
  ["mental", "neuro", "Κατάθλιψη, άγχος ή άλλη ψυχική πάθηση (με ή χωρίς θεραπεία)", "Θεραπεία;", "", "Depression, anxiety or other mental health condition (treated or not)", "Treatment?"],
  ["diab", "endocrine", "Σακχαρώδης διαβήτης", "Τύπος και θεραπεία", "", "Diabetes", "Type and treatment"],
  ["thyroid", "endocrine", "Θυρεοειδής", "Ποια πάθηση και θεραπεία", "", "Thyroid", "Which condition and treatment"],
  ["hormone", "endocrine", "Ορμονοθεραπεία ή αντισύλληψη", "Ποια;", "", "Hormone therapy or contraception", "Which?"],
  ["hiv", "infections", "HIV", "Θεραπεία / ιικό φορτίο", "", "HIV", "Treatment / viral load", { infection: true }],
  ["hepb", "infections", "Ηπατίτιδα B", "Λεπτομέρειες", "", "Hepatitis B", "Details", { infection: true }],
  ["hepc", "infections", "Ηπατίτιδα C", "Λεπτομέρειες", "", "Hepatitis C", "Details", { infection: true }],
  ["herpes", "infections", "Έρπης (επιχείλιος ή άλλος)", "Πόσο συχνά;", "π.χ. 2 φορές τον χρόνο", "Herpes (cold sores or other)", "How often?"],
  ["otherinf", "infections", "Άλλη μεταδοτική λοίμωξη", "Ποια;", "", "Other transmissible infection", "Which?", { infection: true }],
  ["alcohol", "habits", "Αλκοόλ", "Πόσα ποτά την εβδομάδα;", "π.χ. 4", "Alcohol", "How many drinks per week?"],
  ["drugs", "habits", "Χρήση ουσιών", "Ποιες και πόσο συχνά; (εμπιστευτικό)", "", "Substance use", "Which and how often? (confidential)", { sensitive: true }],
  ["glp", "habits", "Φάρμακα αδυνατίσματος (π.χ. Ozempic, Mounjaro)", "Ποιο και από πότε;", "", "Weight-loss medication (e.g. Ozempic, Mounjaro)", "Which and since when?"],
  ["iso", "habits", "Ισοτρετινοΐνη (Roaccutane) τους τελευταίους 12 μήνες", "Πότε σταμάτησε;", "", "Isotretinoin (Roaccutane) in the last 12 months", "When did you stop?"],
  ["keloid", "healing", "Παχιές ή χηλοειδείς ουλές", "Πού;", "", "Thick or keloid scars", "Where?"],
  ["healing", "healing", "Πρόβλημα επούλωσης τραυμάτων", "Περιγράψτε", "", "Wound-healing problems", "Describe"],
  ["anaest", "healing", "Πρόβλημα με αναισθησία (εσείς ή συγγενείς)", "Περιγράψτε", "", "Problems with anaesthesia (you or relatives)", "Describe"],
  ["latex", "healing", "Αλλεργία σε λάτεξ, ταινίες ή αντισηπτικά", "Σε τι;", "", "Allergy to latex, tape or antiseptics", "To what?"],
  ["preg", "gyn", "Πιθανή εγκυμοσύνη ή θηλασμός", "Λεπτομέρειες", "", "Possible pregnancy or breastfeeding", "Details"],
  ["futurepreg", "gyn", "Σχέδια για εγκυμοσύνη στο μέλλον", "Πότε περίπου;", "", "Plans for a future pregnancy", "Roughly when?"],
  ["children", "gyn", "Παιδιά", "Πόσα; Φυσιολογικός τοκετός ή καισαρική;", "", "Children", "How many? Vaginal birth or caesarean?"],
  ["fam_breast", "family", "Καρκίνος μαστού σε συγγενή α΄ βαθμού", "Ποιος;", "", "Breast cancer in a first-degree relative", "Who?"],
  ["fam_diab", "family", "Σακχαρώδης διαβήτης σε συγγενή α΄ βαθμού", "Ποιος;", "", "Diabetes in a first-degree relative", "Who?"],
  ["fam_clot", "family", "Διαταραχή πήξης σε συγγενή α΄ βαθμού", "Ποιος;", "", "Clotting disorder in a first-degree relative", "Who?"],
  // Added later; sorts last in its section.
  ["thrombophilia", "blood", "Θρομβοφιλία (π.χ. Leiden, έλλειψη πρωτεΐνης C/S)", "Ποια;", "", "Thrombophilia (e.g. factor V Leiden, protein C/S deficiency)", "Which?"],
];

// Order of sections on screen.
export const HISTORY_SECTIONS = ["heart", "lungs", "blood", "gi", "neuro", "endocrine", "infections", "habits", "healing", "gyn", "family"];
