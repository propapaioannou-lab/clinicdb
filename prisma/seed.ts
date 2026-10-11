// Reference data only. Never real patient data.
import { db } from "../src/lib/db";
import { Prisma, type ListKind } from "../src/generated/prisma/client";
import { QUESTION_CHOICES } from "../src/lib/history/question-choices-seed";
import { HISTORY_QUESTIONS } from "../src/lib/history/questions-seed";

const companies = [
  { code: "surgery", name: "Πλαστική Χειρουργική" },
  { code: "spa", name: "Medical Spa" },
];

// Starting values for the editable lists. Added only if missing, so edits made in
// the app are never overwritten.
const shared: Partial<Record<ListKind, string[]>> = {
  MARITAL_STATUS: ["Άγαμος/η", "Έγγαμος/η", "Σύμφωνο συμβίωσης", "Διαζευγμένος/η", "Σε χηρεία"],
  REFERRAL_SOURCE: ["Ιατρός", "Φίλος / γνωστός", "Ασθενής μας", "Instagram", "Facebook", "Google", "Ιστοσελίδα", "Άλλο"],
  TAX_OFFICE: [
    "Α' Θεσσαλονίκης", "Δ' Θεσσαλονίκης", "Ε' Θεσσαλονίκης", "Ζ' Θεσσαλονίκης", "Θ' Θεσσαλονίκης",
    "Ι' Θεσσαλονίκης", "Ιωνίας Θεσσαλονίκης", "Καλαμαριάς", "Νεάπολης Θεσσαλονίκης", "Τούμπας",
    "Αμπελοκήπων", "Λαγκαδά", "Κατερίνης", "Σερρών", "Βέροιας",
  ],
  FLAG_REASON: ["Ζήτησε έκπτωση", "Δεν ήρθε στο ραντεβού", "Ήρθε αργά", "Ακύρωσε την τελευταία στιγμή"],
  CONDITION: [
    "Υπέρταση", "Σακχαρώδης διαβήτης", "Θυρεοειδοπάθεια", "Άσθμα", "Καρδιοπάθεια", "Θρομβοφιλία",
    "Κατάθλιψη / αγχώδης διαταραχή", "Αυτοάνοσο νόσημα", "Καρκίνος (ιστορικό)",
  ],
};
const CHARGED_VISIT_TYPES = ["Πρώτη επίσκεψη"];

const perCompany: Record<string, Partial<Record<ListKind, string[]>>> = {
  surgery: {
    VISIT_TYPE: ["Πρώτη επίσκεψη", "Επανεξέταση", "ΠΡΟΕΓΧΕΙΡΗΤΙΚΗ ΕΚΤΙΜΗΣΗ", "Μετεγχειρητική", "Αφαίρεση ραμμάτων", "Μικροεπέμβαση"],
  },
  spa: {
    VISIT_TYPE: ["Πρώτη επίσκεψη", "Θεραπεία", "Επανεξέταση"],
  },
};

async function main() {
  for (const c of companies) {
    const company = await db.company.upsert({ where: { code: c.code }, update: {}, create: c });
    const lists = { ...shared, ...perCompany[c.code] };
    for (const [kind, labels] of Object.entries(lists) as [ListKind, string[]][]) {
      await db.listItem.createMany({
        // Consultations are charged; other visit types are not (decided 11 Oct 2026).
        data: labels.map((label, i) => ({
          companyId: company.id, kind, label, sortOrder: i,
          chargeable: kind === "VISIT_TYPE" && CHARGED_VISIT_TYPES.includes(label),
        })),
        skipDuplicates: true,
      });
    }
    await db.historyQuestion.createMany({
      data: HISTORY_QUESTIONS.map(([key, section, labelEl, detailEl, hintEl, labelEn, detailEn, flags], i) => ({
        companyId: company.id, key, section, labelEl, detailEl: detailEl || null, hintEl: hintEl || null,
        labelEn, detailEn: detailEn || null, sortOrder: i, sensitive: flags?.sensitive ?? false, infection: flags?.infection ?? false,
      })),
      skipDuplicates: true,
    });
    // Quick picks: filled in only where a question has none yet (edits are kept).
    for (const [key, list] of Object.entries(QUESTION_CHOICES)) {
      await db.historyQuestion.updateMany({
        where: { companyId: company.id, key, choices: { equals: Prisma.DbNull } },
        data: { choices: list.map(([k, labelEl, labelEn]) => ({ key: k, labelEl, labelEn })) },
      });
    }
  }
  console.log(`Companies, lists and history questions ready: ${companies.map((c) => c.code).join(", ")}`);
}

main().finally(() => db.$disconnect());
