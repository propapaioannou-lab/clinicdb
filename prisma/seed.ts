// Reference data only. Never real patient data.
import { db } from "../src/lib/db";
import { Prisma, type ListKind } from "../src/generated/prisma/client";
import { QUESTION_CHOICES } from "../src/lib/history/question-choices-seed";
import { HISTORY_QUESTIONS } from "../src/lib/history/questions-seed";
import { PROCEDURE_AREAS } from "../src/lib/visits/catalog";
import { audit } from "../src/lib/audit";
import { SPA_HOURS } from "../src/lib/calendar/hours";

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
// Charged visit types and their default fee in cents (decided 11 Oct 2026: €100).
const CHARGED_VISIT_TYPES: Record<string, number> = { "Πρώτη επίσκεψη": 10000 };

// Appointment types (SPEC §4c seeds): [Greek, English, minutes, colour, layer].
type TypeSeed = [string, string, number, string, "OFFICE" | "ONLINE" | "SURGERY" | "SPA"];
// Calendar v2 (SPEC §4c, 12 Oct 2026). Lengths are only the starting length of a new
// appointment: editable in Settings and on each appointment.
const PRACTICE_TYPES: TypeSeed[] = [
  ["Πρώτη επίσκεψη", "First visit", 30, "teal", "OFFICE"],
  ["Νέα συμβουλευτική", "New consultation", 25, "consult", "OFFICE"],
  ["Επανέλεγχος", "Follow-up", 10, "recheck", "OFFICE"],
  ["Botox", "Botox", 10, "purple", "OFFICE"],
  ["Προεγχειρητική", "Pre-op", 30, "amber", "OFFICE"],
  ["Online", "Online", 30, "online", "ONLINE"],
  ["Χειρουργείο", "Surgery", 120, "blue", "SURGERY"],
];
// Types before calendar v2 → the type their appointments move to (the old type is hidden).
const CONVERT_TYPES: Record<string, string> = { "Μετεγχειρητικός": "Επανέλεγχος", "Ενέσιμα": "Botox" };
const RENAME_TYPES: Record<string, string> = { "Προεγχειρητική εκτίμηση": "Προεγχειρητική" };
const SPA_TYPES: TypeSeed[] = [
  ["Laser", "Laser", 60, "purple", "SPA"],
  ["Peeling", "Peel", 45, "amber", "SPA"],
  ["Hydrafacial", "Hydrafacial", 60, "teal", "SPA"],
  ["Μεσοθεραπεία", "Mesotherapy", 45, "rose", "SPA"],
  ["Πακέτο σώματος", "Body package", 90, "tealLight", "SPA"],
];

const perCompany: Record<string, Partial<Record<ListKind, string[]>>> = {
  surgery: {
    // Clean list from the approved design; old my-medical types are mapped at import.
    VISIT_TYPE: ["Πρώτη επίσκεψη", "Προεγχειρητική εκτίμηση", "Επανέλεγχος", "Μετεγχειρητικός", "Άλλο"],
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
          chargeable: kind === "VISIT_TYPE" && label in CHARGED_VISIT_TYPES,
          defaultFeeCents: kind === "VISIT_TYPE" ? (CHARGED_VISIT_TYPES[label] ?? null) : null,
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
    // Procedure catalogue: missing procedures are added; existing ones only gain new
    // sub-options (names, order and hiding set in Settings are kept).
    for (const area of PROCEDURE_AREAS) {
      for (const [i, pr] of area.procedures.entries()) {
        const subs = (pr.subs ?? []).map((x) => ({ key: x.key, labelEl: x.el, labelEn: x.en }));
        const existing = await db.catalogProcedure.findUnique({ where: { companyId_key: { companyId: company.id, key: pr.key } } });
        if (!existing) {
          await db.catalogProcedure.create({
            data: { companyId: company.id, key: pr.key, area: area.key, labelEl: pr.el, labelEn: pr.en, sortOrder: i, nonSurgical: !!pr.nonSurgical, ...(subs.length && { subs }) },
          });
          continue;
        }
        const have = Array.isArray(existing.subs) ? (existing.subs as { key: string }[]) : [];
        const added = subs.filter((x) => !have.some((h) => h.key === x.key));
        if (added.length) await db.catalogProcedure.update({ where: { id: existing.id }, data: { subs: [...have, ...added] } });
      }
    }
    // Calendar (SPEC §4c): appointment types and resources — added only if missing.
    const types = c.code === "spa" ? SPA_TYPES : PRACTICE_TYPES;
    if (c.code !== "spa") await convertTypesV2(company.id);
    await db.appointmentType.createMany({
      data: types.map(([labelEl, labelEn, defaultMinutes, color, layer], i) => ({ companyId: company.id, labelEl, labelEn, defaultMinutes, color, layer, sortOrder: i })),
      skipDuplicates: true,
    });
    if (!(await db.resource.count({ where: { companyId: company.id } }))) {
      const surgeons = await db.user.findMany({ where: { role: "SURGEON", isActive: true, memberships: { some: { companyId: company.id } } }, orderBy: { name: "asc" } });
      const resources =
        c.code === "spa"
          ? [{ kind: "CABIN" as const, label: "Καμπίνα 1" }, { kind: "CABIN" as const, label: "Καμπίνα 2" }]
          : [
              ...(surgeons.length ? surgeons.map((u) => ({ kind: "DOCTOR" as const, label: u.name, userId: u.id })) : [{ kind: "DOCTOR" as const, label: "Ιατρός" }]),
              { kind: "NURSE" as const, label: "Νοσηλεύτρια" },
              { kind: "OPERATING_ROOM" as const, label: "Χειρουργείο", hours: [1, 2, 3, 4, 5].map((day) => ({ day, from: "08:00", to: "16:00" })) },
            ];
      await db.resource.createMany({ data: resources.map((r, i) => ({ companyId: company.id, sortOrder: i, ...r })) });
    }
    // Spa cabins without their own hours keep the pre-v2 hours (the new default is the
    // practice's office hours).
    if (c.code === "spa") {
      await db.resource.updateMany({ where: { companyId: company.id, hours: { equals: Prisma.DbNull } }, data: { hours: SPA_HOURS as unknown as Prisma.InputJsonValue } });
    }
  }
  console.log(`Companies, lists, history questions, procedures and calendar ready: ${companies.map((c) => c.code).join(", ")}`);
}

// One-time move to the calendar v2 types (decided 12 Oct 2026): runs only while an old
// type is still active, so later edits in Settings are never undone. Logged.
async function convertTypesV2(companyId: string) {
  const old = await db.appointmentType.findMany({ where: { companyId, isActive: true, labelEl: { in: [...Object.keys(CONVERT_TYPES), ...Object.keys(RENAME_TYPES)] } } });
  if (!old.length) return;
  const moved: Record<string, number> = {};
  for (const [from, to] of Object.entries(RENAME_TYPES)) {
    const t = old.find((x) => x.labelEl === from);
    if (t && !(await db.appointmentType.findFirst({ where: { companyId, labelEl: to } }))) await db.appointmentType.update({ where: { id: t.id }, data: { labelEl: to } });
  }
  for (const [label, en, minutes, color, layer] of PRACTICE_TYPES) {
    const existing = await db.appointmentType.findFirst({ where: { companyId, labelEl: label } });
    if (existing) await db.appointmentType.update({ where: { id: existing.id }, data: { defaultMinutes: minutes, color, isActive: true } });
    else await db.appointmentType.create({ data: { companyId, labelEl: label, labelEn: en, defaultMinutes: minutes, color, layer } });
  }
  for (const [from, to] of Object.entries(CONVERT_TYPES)) {
    const a = old.find((x) => x.labelEl === from);
    const b = await db.appointmentType.findFirst({ where: { companyId, labelEl: to } });
    if (!a || !b) continue;
    moved[from] = (await db.appointment.updateMany({ where: { companyId, typeId: a.id }, data: { typeId: b.id } })).count;
    await db.appointmentType.update({ where: { id: a.id }, data: { isActive: false } });
  }
  // Order as in SPEC §4c; anything else keeps its place after them.
  const all = await db.appointmentType.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const rank = (l: string) => { const i = PRACTICE_TYPES.findIndex((x) => x[0] === l); return i < 0 ? 100 : i; };
  const sorted = [...all].sort((x, y) => rank(x.labelEl) - rank(y.labelEl) || x.sortOrder - y.sortOrder);
  await db.$transaction(sorted.map((x, i) => db.appointmentType.update({ where: { id: x.id }, data: { sortOrder: i } })));
  await audit(
    { action: "settings.appointmentType.convertedV2", actorEmail: "seed", companyId, entityType: "AppointmentType", details: { moved, types: PRACTICE_TYPES.map((x) => `${x[0]} ${x[2]}′`) } },
    { ip: null, userAgent: null },
  );
  console.log(`Appointment types converted to calendar v2 (${JSON.stringify(moved)}).`);
}

main().finally(() => db.$disconnect());
