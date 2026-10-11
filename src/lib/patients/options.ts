import { db } from "@/lib/db";

// Choices for the patient form, from this company's editable lists (Settings).
export async function patientFormOptions(companyId: string) {
  const [items, doctors] = await Promise.all([
    db.listItem.findMany({
      where: { companyId, isActive: true, kind: { in: ["MARITAL_STATUS", "REFERRAL_SOURCE", "TAX_OFFICE", "FLAG_REASON"] } },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, kind: true, label: true },
    }),
    db.user.findMany({
      where: { role: "SURGEON", isActive: true, memberships: { some: { companyId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const of = (kind: string) => items.filter((i) => i.kind === kind).map(({ id, label }) => ({ id, label }));
  return {
    marital: of("MARITAL_STATUS"),
    referral: of("REFERRAL_SOURCE"),
    taxOffices: of("TAX_OFFICE"),
    flagReasons: of("FLAG_REASON"),
    doctors,
  };
}
export type PatientFormOptions = Awaited<ReturnType<typeof patientFormOptions>>;
