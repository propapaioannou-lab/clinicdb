// Reference data only. Never real patient data.
import { db } from "../src/lib/db";
import type { ListKind } from "../src/generated/prisma/client";

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
        data: labels.map((label, i) => ({ companyId: company.id, kind, label, sortOrder: i })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`Companies and lists ready: ${companies.map((c) => c.code).join(", ")}`);
}

main().finally(() => db.$disconnect());
